import { supabaseAdmin } from '@/lib/supabase'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const PAGE = 1000

async function fetchAllUnassignedGames(): Promise<any[]> {
  const games: any[] = []
  let from = 0
  while (true) {
    // Explicit deterministic order — the round partition below depends on
    // processing games in a stable, repeatable sequence.
    const { data } = await supabaseAdmin.from('games').select('id,week_number,home_team,away_team')
      .eq('status', 'scheduled').is('referee_id', null).order('id').range(from, from + PAGE - 1)
    if (!data || !data.length) break
    games.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return games
}

// Assigns a referee to every not-yet-officiated scheduled game, ahead of
// time (so the calendar can show it before the game is played) — the real
// season schedule already exists as `games` rows with status='scheduled'
// well into the future, so this can catch up the entire remaining season in
// one pass.
//
// `day_of_week` turned out NOT to be a reliable one-real-day label in this
// schedule (confirmed live: a whole week's ~4 games per team can all share
// the exact same day_of_week value) — so "one referee per day" can't be
// enforced by grouping on it. Instead, within each week, greedily partition
// that week's games into rounds where no team appears twice in the same
// round (a simple bucket/edge-coloring pass over the actual matchups) —
// each round is then guaranteed to be a real "everyone plays at most once"
// slate, which is the correct atomic unit for the one-ref-per-day rule.
// Safe to call repeatedly: only touches rows where referee_id is still null.
export async function assignRefereesToScheduledGames(): Promise<{ assigned: number }> {
  const { data: referees } = await supabaseAdmin.from('referees').select('id')
  if (!referees || !referees.length) return { assigned: 0 }
  const refIds = referees.map((r: any) => r.id as string)

  const games = await fetchAllUnassignedGames()
  if (!games.length) return { assigned: 0 }

  const byWeek: Record<number, any[]> = {}
  for (const g of games) {
    if (!byWeek[g.week_number]) byWeek[g.week_number] = []
    byWeek[g.week_number].push(g)
  }

  let assigned = 0
  for (const weekGames of Object.values(byWeek)) {
    const rounds: any[][] = []
    for (const g of weekGames) {
      let placed = false
      for (const round of rounds) {
        const teamsInRound = new Set(round.flatMap((r: any) => [r.home_team, r.away_team]))
        if (!teamsInRound.has(g.home_team) && !teamsInRound.has(g.away_team)) {
          round.push(g)
          placed = true
          break
        }
      }
      if (!placed) rounds.push([g])
    }

    for (const round of rounds) {
      const pool = shuffle(refIds)
      for (let i = 0; i < round.length; i++) {
        // Falls back to reuse only if a single round somehow has more games
        // than the whole referee pool — never happens with a real
        // NBA-sized round (max 15 simultaneous games for 30 teams).
        const refereeId = pool[i % pool.length]
        await supabaseAdmin.from('games').update({ referee_id: refereeId }).eq('id', round[i].id)
        assigned++
      }
    }
  }
  return { assigned }
}

import { supabaseAdmin } from '@/lib/supabase'
import { getMarqueeInfoForDate } from '@/lib/marquee-dates'

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
    const { data } = await supabaseAdmin.from('games').select('id,week_number,home_team,away_team,scheduled_date')
      .eq('status', 'scheduled').is('referee_id', null).order('id').range(from, from + PAGE - 1)
    if (!data || !data.length) break
    games.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return games
}

// Officials Ranking — grades a referee's actual performance from what
// really happened in the game (foul symmetry, total foul count, technical
// fouls), never from his hidden trait numbers directly. Those traits
// (foul_rate/home_bias/crowd_error_rate/technical_impatience, read in
// src/lib/game-simulator.ts) already shaped these real box-score outcomes
// with randomness — grading the outcome is what makes this a genuine
// evaluation instead of a restatement of a hidden stat.
export function rateRefereePerformance(homeBox: any[], awayBox: any[], isRivalry: boolean, decisive: boolean): number {
  const sum = (rows: any[], key: string) => rows.reduce((s, b) => s + (b[key] || 0), 0)
  const homePF = sum(homeBox, 'pf'), awayPF = sum(awayBox, 'pf')
  const homeFTA = sum(homeBox, 'fta'), awayFTA = sum(awayBox, 'fta')
  const totalTech = sum(homeBox, 'tech_fouls') + sum(awayBox, 'tech_fouls')
  const totalPF = homePF + awayPF
  const pfDiff = Math.abs(homePF - awayPF)
  const ftaDiff = Math.abs(homeFTA - awayFTA)

  let rating = 7.0

  // Foul-call symmetry — the real complaint is a lopsided whistle, not
  // total foul count.
  if (pfDiff > 8) rating -= Math.min(2.5, (pfDiff - 8) * 0.15)
  if (ftaDiff > 10) rating -= Math.min(2.0, (ftaDiff - 10) * 0.1)

  // Total foul count sanity — way too few (ignored contact) or way too
  // many (over-officiated, stopped the game constantly) both read badly.
  if (totalPF < 30) rating -= Math.min(1.5, (30 - totalPF) * 0.08)
  else if (totalPF > 55) rating -= Math.min(1.5, (totalPF - 55) * 0.06)

  // Technical fouls — losing control of the game's temperature.
  if (totalTech >= 3) rating -= Math.min(2, (totalTech - 2) * 0.6)

  // Handling a hard assignment (rivalry/decisive) cleanly is genuinely
  // more impressive than the same clean game in a meaningless matchup.
  const clean = pfDiff <= 6 && ftaDiff <= 8 && totalTech <= 1
  if ((isRivalry || decisive) && clean) rating += 0.5

  // A little real subjectivity — two GMs read the same game differently.
  // Flavor layered on top of the real signal above, never replacing it.
  rating += Math.random() * 0.6 - 0.3

  return Math.max(0, Math.min(10, Math.round(rating * 10) / 10))
}

// Officials Ranking meritocracy — season average per referee, computed
// client-side (only ~40 referees — trivially small, same pattern as
// teamContexts/coachBonus elsewhere). A referee with no rated games yet
// defaults to 7.0 (the same neutral baseline rateRefereePerformance()
// itself starts from), so rookies aren't unfairly buried at the bottom
// before they've worked a single game. Shared by the regular-season
// assignment below and the playoff/play-in resolver (every one of those
// games is decisive by definition, so it always wants the best available).
export async function getRefereeAvgRatings(): Promise<Record<string, number>> {
  const { data: ratedGames } = await supabaseAdmin.from('games').select('referee_id,referee_rating').not('referee_rating', 'is', null)
  const sums: Record<string, { sum: number, n: number }> = {}
  ;(ratedGames || []).forEach((g: any) => {
    const r = (sums[g.referee_id] ||= { sum: 0, n: 0 })
    r.sum += g.referee_rating; r.n++
  })
  const avg: Record<string, number> = {}
  Object.keys(sums).forEach(id => { avg[id] = sums[id].sum / sums[id].n })
  return avg
}

// Picks a referee from the top tier (top half, at least 5) of all referees
// by rating — meritocracy without literally always picking the single #1
// (real playoffs rotate several top officials across different games, not
// one person working every game of every series).
export function pickTopTierReferee(refIds: string[], avgRatings: Record<string, number>): string {
  const rated = [...refIds].sort((a, b) => (avgRatings[b] ?? 7.0) - (avgRatings[a] ?? 7.0))
  const tierSize = Math.max(5, Math.floor(rated.length / 2))
  const tier = rated.slice(0, tierSize)
  return tier[Math.floor(Math.random() * tier.length)]
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

  // Officials Ranking meritocracy: top-rated referees should land on the
  // biggest games.
  const avgRatings = await getRefereeAvgRatings()
  const avgRating = (refId: string) => avgRatings[refId] ?? 7.0

  // Decisiveness proxy for assignment purposes — rivalry (real, permanent)
  // or a marquee calendar date (real per-game date, see schedule-generator.ts).
  // Lighter-weight than cron/simulate's full standings-based decisive check,
  // which needs weekly-fresh standings not available this far ahead when
  // pre-assigning the whole remaining season in one pass — an honest
  // simplification, not a hidden gap.
  const { data: teamsForRivalry } = await supabaseAdmin.from('teams').select('id,rival_team_id')
  const rivalMap: Record<string, string> = {}
  ;(teamsForRivalry || []).forEach((t: any) => { if (t.rival_team_id) rivalMap[t.id] = t.rival_team_id })
  const isDecisiveForAssignment = (g: any): boolean => {
    const isRivalry = rivalMap[g.home_team] === g.away_team || rivalMap[g.away_team] === g.home_team
    const marquee = g.scheduled_date ? getMarqueeInfoForDate(g.scheduled_date, g.week_number).marquee : false
    return isRivalry || marquee
  }

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
      // Shuffle first so referees of equal (often default 7.0) rating don't
      // always land in the same relative order, then sort by rating so the
      // best available referees genuinely land on the round's biggest games.
      const shuffledPool: string[] = shuffle(refIds)
      const pool = shuffledPool.sort((a, b) => avgRating(b) - avgRating(a))
      const orderedGames = [...round].sort((a, b) => Number(isDecisiveForAssignment(b)) - Number(isDecisiveForAssignment(a)))
      for (let i = 0; i < orderedGames.length; i++) {
        // Falls back to reuse only if a single round somehow has more games
        // than the whole referee pool — never happens with a real
        // NBA-sized round (max 15 simultaneous games for 30 teams).
        const refereeId = pool[i % pool.length]
        await supabaseAdmin.from('games').update({ referee_id: refereeId }).eq('id', orderedGames[i].id)
        assigned++
      }
    }
  }
  return { assigned }
}

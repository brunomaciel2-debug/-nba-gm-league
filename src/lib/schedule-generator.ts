import { supabaseAdmin } from '@/lib/supabase'

// Generates a real, complete 82-game NBA-style regular season schedule:
// - 4 games vs each of the 4 division rivals (16 games)
// - vs the 10 same-conference, different-division teams: 6 of them 4x and
//   4 of them 3x (36 games) — built from a clean, provably-symmetric
//   bipartite construction between every pair of divisions in a conference
//   (each side gets exactly 3 "4-game" partners + 2 "3-game" partners from
//   the other division; summed over the conference's other 2 divisions
//   that's 3+3=6 at 4 games and 2+2=4 at 3 games — see comments below)
// - 2 games vs each of the 15 other-conference teams (30 games)
// Total: 16 + 36 + 30 = 82 games/team, matching the real NBA format.
export async function generateRegularSeasonSchedule(opts: { startWeek: number; endWeek: number }) {
  const { startWeek, endWeek } = opts

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id,conference,division')
    .not('id', 'in', '(ALL,RVS,ROO,SOP)')
  if (!teams || teams.length !== 30) {
    return { success: false as const, error: `Expected 30 NBA teams, found ${teams?.length ?? 0}` }
  }

  // Group teams: conference -> division -> [team ids] (stable order = index 0..4)
  const conferences: Record<string, Record<string, string[]>> = {}
  for (const t of teams as any[]) {
    conferences[t.conference] ||= {}
    ;(conferences[t.conference][t.division] ||= []).push(t.id)
  }
  for (const conf of Object.values(conferences)) {
    for (const div of Object.values(conf)) div.sort()
  }

  // matchups: Map "A|B" (A<B alphabetically) -> total games required
  const matchups: Record<string, number> = {}
  const addMatchup = (a: string, b: string, count: number) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    matchups[key] = (matchups[key] || 0) + count
  }

  for (const [confName, divisions] of Object.entries(conferences)) {
    const divNames = Object.keys(divisions)

    // Division rivals: 4 games each
    for (const divTeams of Object.values(divisions)) {
      for (let i = 0; i < divTeams.length; i++) {
        for (let j = i + 1; j < divTeams.length; j++) addMatchup(divTeams[i], divTeams[j], 4)
      }
    }

    // Same-conference, different-division: bipartite 3-regular split per division pair.
    // Team X[i] plays 4 games vs Y[j] when (j - i) mod 5 is 0, 1 or 2 — else 3 games.
    // This is a bipartite relation between two DIFFERENT sets (divisions), so both
    // sides automatically get exactly 3 "4-game" partners from that division —
    // no symmetry issue (unlike a graph on a single vertex set).
    for (let d1 = 0; d1 < divNames.length; d1++) {
      for (let d2 = d1 + 1; d2 < divNames.length; d2++) {
        const X = divisions[divNames[d1]], Y = divisions[divNames[d2]]
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 5; j++) {
            const diff = ((j - i) % 5 + 5) % 5
            addMatchup(X[i], Y[j], diff <= 2 ? 4 : 3)
          }
        }
      }
    }
  }

  // Cross-conference: 2 games each
  const confNames = Object.keys(conferences)
  const eastTeams = Object.values(conferences[confNames[0]]).flat()
  const westTeams = Object.values(conferences[confNames[1]]).flat()
  for (const a of eastTeams) for (const b of westTeams) addMatchup(a, b, 2)

  // Expand matchups into individual game instances, splitting home/away as
  // evenly as possible (extra home game alternates by a deterministic rule
  // so it isn't always the same side of the pairing that benefits).
  type GameSlot = { home: string; away: string }
  const allGames: GameSlot[] = []
  for (const [key, count] of Object.entries(matchups)) {
    const [a, b] = key.split('|')
    const aHome = Math.ceil(count / 2)
    const bHome = count - aHome
    const aGetsExtra = (a.charCodeAt(0) + b.charCodeAt(1 % b.length)) % 2 === 0
    const [first, firstHome, second, secondHome] = aGetsExtra ? [a, aHome, b, bHome] : [b, aHome, a, bHome]
    for (let i = 0; i < firstHome; i++) allGames.push({ home: first, away: second })
    for (let i = 0; i < secondHome; i++) allGames.push({ home: second, away: first })
  }

  // Shuffle for variety, then greedily pack into weeks: each week, run
  // repeated "rounds" (every team plays at most once per round) until no
  // more of the remaining games fit without double-booking a team that week.
  for (let i = allGames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allGames[i], allGames[j]] = [allGames[j], allGames[i]]
  }

  const totalWeeks = endWeek - startWeek + 1
  const weekBuckets: GameSlot[][] = Array.from({ length: totalWeeks }, () => [])
  const remaining = [...allGames]
  let weekIdx = 0
  const MAX_ROUNDS_PER_WEEK = 4
  while (remaining.length > 0) {
    for (let round = 0; round < MAX_ROUNDS_PER_WEEK && remaining.length > 0; round++) {
      const usedThisRound = new Set<string>()
      for (let i = 0; i < remaining.length; i++) {
        const g = remaining[i]
        if (usedThisRound.has(g.home) || usedThisRound.has(g.away)) continue
        usedThisRound.add(g.home); usedThisRound.add(g.away)
        weekBuckets[weekIdx % totalWeeks].push(g)
        remaining.splice(i, 1)
        i--
      }
    }
    weekIdx++
    if (weekIdx > totalWeeks * 3) break // safety valve, shouldn't be needed
  }

  // Write to the DB: wipe the old scheduled regular-season games for this
  // range, then insert the new ones.
  // Wipe ANY existing not-yet-played regular-season schedule, regardless of
  // week range — this fully replaces whatever (possibly broken/incomplete)
  // schedule existed before, not just the target week range.
  await supabaseAdmin.from('games')
    .delete()
    .eq('status', 'scheduled').eq('game_type', 'regular')

  let inserted = 0
  for (let w = 0; w < totalWeeks; w++) {
    const week = startWeek + w
    const rows = weekBuckets[w].map((g, i) => ({
      week_number: week, game_number: i + 1,
      home_team: g.home, away_team: g.away,
      status: 'scheduled', game_type: 'regular',
    }))
    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from('games').insert(rows)
      if (error) return { success: false as const, error: error.message }
      inserted += rows.length
    }
  }

  // Sanity check: every team should have exactly 82 games
  const perTeam: Record<string, number> = {}
  for (const g of allGames) {
    perTeam[g.home] = (perTeam[g.home] || 0) + 1
    perTeam[g.away] = (perTeam[g.away] || 0) + 1
  }
  const offCount = Object.values(perTeam).filter(c => c !== 82).length

  return { success: true as const, games: inserted, weeks: totalWeeks, teams_off_82: offCount, per_team: perTeam }
}

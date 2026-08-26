import { supabaseAdmin } from '@/lib/supabase'
import { packGamesByDay, ymd, WEEKDAY_NAMES, type GameSlot } from './schedule-generator'

const SEASON = '2025-26'

// Generates a real, balanced 36-game G-League regular season, replacing
// whatever produced the previous one — a one-off seed script that left
// serious, real-world-impossible gaps: one team (Austin Spurs) played 35 of
// its 36 games at HOME and only 1 away, and "who plays whom twice" wasn't
// decided by any consistent rule, just whatever came out of that script.
//
// Structure (36 games/team, matching the existing season length):
// - Every team plays every OTHER team in the league once (29 games) —
//   nobody is skipped.
// - Same-conference: each team ALSO plays its 6 "nearest" conference-mates
//   (a 6-regular circulant graph on the conference's 15 teams, built from
//   sorted team-id offsets ±1/±2/±3) a second time. 15 teams x 6 = 90, an
//   even total, so this graph exists cleanly with no leftover team — a
//   plain "double everyone" wouldn't (15 x 14 = 210, but the budget only
//   allows 6 extra same-conference games per team, and 15x7=105 is ODD, so
//   "exactly 7 doubled rivals each" is mathematically impossible for 15
//   teams; 6 is the largest regular degree that still fits neatly).
// - Cross-conference: each team ALSO plays exactly one designated partner
//   in the other conference a second time (a perfect 1-to-1 matching
//   between the two 15-team conferences by sorted index).
// 14 (same-conf, once) + 6 (same-conf, extra) + 15 (cross-conf, once) + 1
// (cross-conf, extra) = 36.
//
// Every matchup's home/away is split as evenly as possible (identical
// aHome/bHome trick to schedule-generator.ts's NBA generator), and a final
// balancing pass (see balanceHomeAway below) guarantees no team can end up
// anywhere close to the old 35-1 outlier.
export async function generateGLeagueRegularSeasonSchedule() {
  // Refuses to run once this season's G-League has real, already-played
  // history — this only deletes 'scheduled' rows (never 'final' ones), so
  // running it against an already-completed season wouldn't touch the real
  // 540 played games, but it WOULD insert a second, fictional 36-game
  // "scheduled" calendar layered on top of the exact same season, for dates
  // that already happened. This generator is for standing up a brand-new
  // G-League season (once one exists with no games played yet), not for
  // patching the current one after the fact.
  const { count: alreadyPlayed } = await supabaseAdmin.from('gleague_games')
    .select('*', { count: 'exact', head: true }).eq('season', SEASON).eq('game_type', 'regular').eq('status', 'final')
  if (alreadyPlayed && alreadyPlayed > 0) {
    return { success: false as const, error: `Season ${SEASON}'s G-League already has ${alreadyPlayed} played regular-season games — this generator is for a brand-new season, not for replacing an in-progress or completed one.` }
  }

  const { data: teams } = await supabaseAdmin.from('gleague_teams').select('id,conference')
  if (!teams || teams.length !== 30) {
    return { success: false as const, error: `Expected 30 G-League teams, found ${teams?.length ?? 0}` }
  }
  const east = teams.filter((t: any) => t.conference === 'Eastern').map((t: any) => t.id as string).sort()
  const west = teams.filter((t: any) => t.conference === 'Western').map((t: any) => t.id as string).sort()
  if (east.length !== 15 || west.length !== 15) {
    return { success: false as const, error: `Expected 15 teams per conference, found Eastern:${east.length} Western:${west.length}` }
  }

  const matchups: Record<string, number> = {}
  const addMatchup = (a: string, b: string, count: number) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    matchups[key] = (matchups[key] || 0) + count
  }

  // Same-conference: everyone once, plus the 6-nearest-neighbor circulant
  // for a second meeting.
  for (const conf of [east, west]) {
    for (let i = 0; i < conf.length; i++) {
      for (let j = i + 1; j < conf.length; j++) addMatchup(conf[i], conf[j], 1)
    }
    for (let i = 0; i < conf.length; i++) {
      for (const off of [1, 2, 3]) {
        const j = (i + off) % conf.length
        addMatchup(conf[i], conf[j], 1)
      }
    }
  }

  // Cross-conference: everyone once, plus one designated partner (matched
  // by sorted index) for a second meeting.
  for (let i = 0; i < 15; i++) for (let j = 0; j < 15; j++) addMatchup(east[i], west[j], 1)
  for (let i = 0; i < 15; i++) addMatchup(east[i], west[i], 1)

  // Expand matchups into individual game instances, splitting home/away as
  // evenly as possible per pairing (a 2-game pairing is always 1-1; a
  // 1-game pairing alternates who gets it by a deterministic rule so it
  // isn't always the same side of the alphabet benefiting).
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

  balanceHomeAway(allGames)

  const { data: startEvent } = await supabaseAdmin.from('season_events').select('start_date').eq('season', SEASON).eq('event_key', 'gleague_start').single()
  const { data: endEvent } = await supabaseAdmin.from('season_events').select('start_date').eq('season', SEASON).eq('event_key', 'gleague_end').single()
  if (!startEvent || !endEvent) return { success: false as const, error: 'Missing gleague_start/gleague_end season_events rows' }

  const startDate = new Date(startEvent.start_date + 'T00:00:00')
  const endDate = new Date(endEvent.start_date + 'T00:00:00')
  const dated = packGamesByDay(allGames, startDate, endDate, new Set())

  // Wipe any not-yet-played regular-season G-League games, then insert the
  // new schedule — same "never touch already-played games" contract as the
  // NBA generator.
  await supabaseAdmin.from('gleague_games').delete().eq('season', SEASON).eq('game_type', 'regular').eq('status', 'scheduled')

  const seasonStart = startDate
  const weekForDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return Math.floor((d.getTime() - seasonStart.getTime()) / (7 * 86400000)) + 1
  }

  const rows: any[] = []
  for (const g of dated) {
    rows.push({
      season: SEASON, week_number: weekForDate(g.date),
      home_team: g.home, away_team: g.away,
      status: 'scheduled', game_type: 'regular',
      played_at: `${g.date}T20:00:00.000Z`,
    })
  }
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabaseAdmin.from('gleague_games').insert(chunk)
    if (error) return { success: false as const, error: error.message }
    inserted += chunk.length
  }

  const perTeam: Record<string, number> = {}
  const homePerTeam: Record<string, number> = {}
  for (const g of allGames) {
    perTeam[g.home] = (perTeam[g.home] || 0) + 1
    perTeam[g.away] = (perTeam[g.away] || 0) + 1
    homePerTeam[g.home] = (homePerTeam[g.home] || 0) + 1
  }
  const offCount = Object.values(perTeam).filter(c => c !== 36).length
  const worstHomeSkew = Math.max(...Object.entries(perTeam).map(([t, total]) => Math.abs((homePerTeam[t] || 0) - total / 2)))

  return { success: true as const, games: inserted, teams_off_36: offCount, worst_home_away_skew: worstHomeSkew }
}

// Post-hoc balancing pass: the per-pairing home/away split above already
// balances every INDIVIDUAL matchup as evenly as possible, but the
// deterministic alternator on the many single-game pairings can still leave
// a handful of teams a few games off their own 18-18 target purely by how
// the char-code tie-breaks happen to fall — exactly the kind of drift that
// let one team end up at 35-1 under whatever produced the previous
// schedule. Greedily flips individual games between whichever team
// currently has the MOST home games and whichever has the FEWEST, moving
// both toward their own target (their own total games / 2) each time, until
// every team is within 1 game of balanced or no further improving flip
// exists.
function balanceHomeAway(games: GameSlot[]) {
  const homeCount: Record<string, number> = {}
  const totalCount: Record<string, number> = {}
  for (const g of games) {
    homeCount[g.home] = (homeCount[g.home] || 0) + 1
    totalCount[g.home] = (totalCount[g.home] || 0) + 1
    totalCount[g.away] = (totalCount[g.away] || 0) + 1
  }
  const excess = (team: string) => (homeCount[team] || 0) - (totalCount[team] || 0) / 2

  for (let iter = 0; iter < 2000; iter++) {
    const teams = Object.keys(totalCount)
    let heavy = teams[0], light = teams[0]
    for (const t of teams) {
      if (excess(t) > excess(heavy)) heavy = t
      if (excess(t) < excess(light)) light = t
    }
    if (excess(heavy) <= 1 && excess(light) >= -1) break

    // Best case: a game where `heavy` is home and `light` is away — flipping
    // it helps both at once.
    let idx = games.findIndex(g => g.home === heavy && g.away === light)
    if (idx === -1) idx = games.findIndex(g => g.home === heavy)
    if (idx === -1) break // heavy has no home game left to give up — shouldn't happen given excess(heavy)>1
    const g = games[idx]
    games[idx] = { home: g.away, away: g.home }
    homeCount[g.home] = (homeCount[g.home] || 0) - 1
    homeCount[g.away] = (homeCount[g.away] || 0) + 1
  }
}

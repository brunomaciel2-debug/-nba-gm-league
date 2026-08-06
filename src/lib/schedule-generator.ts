import { supabaseAdmin } from '@/lib/supabase'
import { getWeekDates, getWeekForDate, getHalfWeekDates } from '@/lib/season-week-helper'
import { ALLSTAR_WEEK, ALLSTAR_HALF, REGULAR_SEASON_END_WEEK } from '@/lib/allstar-constants'
import { assignRefereesToScheduledGames } from '@/lib/referees'

const SEASON = '2025-26'

// Plain local Y-M-D string — NOT toISOString(), which converts to UTC and
// can roll the date back a day depending on the server's timezone offset.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type GameSlot = { home: string; away: string }

// Packs a flat pool of {home,away} matchups onto real calendar days, one day
// at a time — replaces the old "4 fixed rounds a week, every other day"
// scheme, which forced the ENTIRE league to only ever play on the same 4 of
// every 7 days, with 3 completely dead league-wide days a week.
// Two hard rules, always enforced: a team never plays twice in one day, and
// never on a 3rd straight day (blocked only if it played on EACH of the
// exact previous 2 calendar days — so a single back-to-back is fine, a 3rd
// game right after it is not).
// A first version of this only enforced those two hard rules and otherwise
// greedily crammed as many games as possible into the earliest eligible
// days — real incident: with back-to-backs unrestricted, that packed the
// ENTIRE remaining season into the first ~80 of ~135 available days, nearly
// half of every team's gaps were 1-day back-to-backs, and the schedule
// finished over a month early. A THIRD, soft rule fixes that: a team may
// only play on a 1-day gap (back-to-back) if it's genuinely running behind
// its own pace — i.e. it has more games left than days left to spread them
// across at a normal 2-day rhythm. Otherwise it must rest at least a day,
// which is what naturally spreads everyone across the FULL window instead
// of the front of it, with back-to-backs surfacing only where real NBA
// schedules actually have them: catching up, not the default rhythm.
function packGamesByDay(
  games: GameSlot[],
  startDate: Date,
  endDate: Date,
  blackoutDates: Set<string>,
  // Real incident this caught: redistributing only PART of an in-progress
  // season (games from some cutoff week onward) with no memory of what each
  // team played just before that cutoff produced a 3-straight-day violation
  // spanning the seam for 9 teams — the packer correctly avoided B2B2B
  // WITHIN the window it knew about, but had no idea those teams had also
  // played on the last day before the window started. Seeding each team's
  // real last 2 play dates (from the untouched, already-real portion of the
  // season) closes that gap.
  seedLastTwo: Record<string, string[]> = {},
): { home: string; away: string; date: string }[] {
  const pool = [...games]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const assignments: { home: string; away: string; date: string }[] = []
  // team -> the exact calendar dates (up to the most recent 2) it played on
  const lastTwo: Record<string, string[]> = {}
  for (const [team, dates] of Object.entries(seedLastTwo)) lastTwo[team] = dates.slice(-2)
  const gamesLeft: Record<string, number> = {}
  for (const g of pool) { gamesLeft[g.home] = (gamesLeft[g.home]||0)+1; gamesLeft[g.away] = (gamesLeft[g.away]||0)+1 }

  const blockedThreeStraight = (team: string, dateStr: string): boolean => {
    const [twoBack, oneBack] = lastTwo[team] || []
    if (!oneBack || !twoBack) return false
    const d = new Date(dateStr + 'T00:00:00')
    const prev = new Date(d); prev.setDate(prev.getDate() - 1)
    const prevPrev = new Date(d); prevPrev.setDate(prevPrev.getDate() - 2)
    return oneBack === ymd(prev) && twoBack === ymd(prevPrev)
  }
  // Soft pacing gate: only allow a back-to-back (played yesterday) if this
  // team can no longer fit its remaining games into its remaining days
  // without one — i.e. it's genuinely behind, not just eligible.
  const needsCatchUp = (team: string, dateStr: string): boolean => {
    const d = new Date(dateStr + 'T00:00:00')
    const daysLeftIncl = Math.round((endDate.getTime() - d.getTime()) / 86400000) + 1
    return (gamesLeft[team] || 0) > daysLeftIncl
  }
  const restBlocked = (team: string, dateStr: string): boolean => {
    const [, oneBack] = lastTwo[team] || []
    if (!oneBack) return false
    const d = new Date(dateStr + 'T00:00:00')
    const prev = new Date(d); prev.setDate(prev.getDate() - 1)
    if (oneBack !== ymd(prev)) return false // didn't play yesterday — no rest issue
    return !needsCatchUp(team, dateStr)
  }

  // Precompute every non-blackout date in the window, so each day's game
  // cap can be sized against exactly how many playable days are actually
  // left (not just raw calendar days).
  const playableDates: string[] = []
  for (const dd = new Date(startDate); dd <= endDate; dd.setDate(dd.getDate() + 1)) {
    const s = ymd(dd)
    if (!blackoutDates.has(s)) playableDates.push(s)
  }

  for (let dayIdx = 0; dayIdx < playableDates.length && pool.length > 0; dayIdx++) {
    const dateStr = playableDates[dayIdx]
    const daysLeftInclToday = playableDates.length - dayIdx
    // Deliberate spread: without a cap, every team that's eligible today
    // gets scheduled today, which — since most teams rest the same ~2 days
    // — packs games onto roughly half the available days and leaves the
    // other half completely empty (a real incident: the first version of
    // this function did exactly that, 49% day coverage). Capping today's
    // total at a bit above the pure remaining-games/remaining-days average
    // forces the games that don't fit today to roll over to tomorrow
    // instead, spreading the same total across far more distinct days —
    // the actual daily NBA-calendar feel Bruno asked for.
    const dailyCap = Math.max(2, Math.ceil((pool.length / daysLeftInclToday) * 1.4))
    // Most urgent (closest to needing a back-to-back to still fit) first,
    // so the cap never starves a team that's genuinely running out of room —
    // shuffled within that priority (pool was pre-shuffled, stable sort
    // keeps that order among equal-urgency games).
    pool.sort((a, b) => {
      const urgency = (g: GameSlot) => {
        const d = new Date(dateStr + 'T00:00:00')
        const daysLeftIncl = Math.round((endDate.getTime() - d.getTime()) / 86400000) + 1
        return Math.max((gamesLeft[g.home]||0) - daysLeftIncl, (gamesLeft[g.away]||0) - daysLeftIncl)
      }
      return urgency(b) - urgency(a)
    })
    const usedToday = new Set<string>()
    let placedToday = 0
    for (let i = 0; i < pool.length && placedToday < dailyCap; i++) {
      const g = pool[i]
      if (usedToday.has(g.home) || usedToday.has(g.away)) continue
      if (blockedThreeStraight(g.home, dateStr) || blockedThreeStraight(g.away, dateStr)) continue
      if (restBlocked(g.home, dateStr) || restBlocked(g.away, dateStr)) continue
      usedToday.add(g.home); usedToday.add(g.away)
      assignments.push({ ...g, date: dateStr })
      gamesLeft[g.home]--; gamesLeft[g.away]--
      pool.splice(i, 1); i--
      placedToday++
    }
    usedToday.forEach(team => {
      const arr = lastTwo[team] || []
      arr.push(dateStr)
      lastTwo[team] = arr.slice(-2)
    })
  }
  // Last resort: the pacing gate + daily cap above guarantee enough room as
  // long as no team ever had more remaining games than remaining days at
  // the start — true by construction — so this should rarely fire, and
  // never for more than a handful of games. A second pass over the same
  // dates, dropping the SOFT pacing gate and the daily cap but keeping both
  // HARD rules (no same day twice, no 3rd straight day).
  // Real incident this replaced: a first attempt at this fallback re-walked
  // dates in order checking each one only BACKWARD (does placing here plus
  // the previous 2 days create a straight 3rd) — correct for the main pass,
  // which only ever adds dates going forward, but wrong here: the fallback
  // can end up filling in an EARLIER date (e.g. Dec 5) for a team that
  // already has a LATER date already fixed by the main pass (e.g. Dec 6),
  // and a backward-only check at Dec 5 has no way to see that already-fixed
  // Dec 6 sitting ahead of it — Dec 4 (seed) + Dec 5 (this fallback pick) +
  // Dec 6 (already fixed) is still 3 straight days, just assembled out of
  // order. Tracks every date each team is confirmed for (not just the last
  // 2) and checks all three positions a new date could occupy in a 3-day
  // window — before it, in the middle, or after — against dates ALREADY
  // fixed in either direction, not just looking backward.
  if (pool.length > 0) {
    const allDates: Record<string, Set<string>> = {}
    const addDate = (team: string, dateStr: string) => (allDates[team] ||= new Set()).add(dateStr)
    for (const [team, dates] of Object.entries(seedLastTwo)) dates.forEach(d => addDate(team, d))
    for (const a of assignments) { addDate(a.home, a.date); addDate(a.away, a.date) }

    const dayOffset = (dateStr: string, n: number) => {
      const d = new Date(dateStr + 'T00:00:00')
      d.setDate(d.getDate() + n)
      return ymd(d)
    }
    const wouldCreateThreeStraight = (team: string, dateStr: string): boolean => {
      const has = (offset: number) => allDates[team]?.has(dayOffset(dateStr, offset)) ?? false
      return (has(-2) && has(-1)) || (has(-1) && has(1)) || (has(1) && has(2))
    }

    for (const dateStr of playableDates) {
      // Same-day conflicts against what pass one ALREADY placed today aren't
      // visible through `wouldCreateThreeStraight` (it only checks +/-1/-2
      // offsets, never the day itself) — real incident: 3 teams ended up
      // with two games apiece on the same date because this check was
      // missing entirely, checked only against what THIS pass had placed
      // today, not what pass one already had there.
      const usedToday = new Set<string>()
      for (const [team, dates] of Object.entries(allDates)) if (dates.has(dateStr)) usedToday.add(team)
      for (let i = 0; i < pool.length; i++) {
        const g = pool[i]
        if (usedToday.has(g.home) || usedToday.has(g.away)) continue
        if (wouldCreateThreeStraight(g.home, dateStr) || wouldCreateThreeStraight(g.away, dateStr)) continue
        usedToday.add(g.home); usedToday.add(g.away)
        assignments.push({ ...g, date: dateStr })
        addDate(g.home, dateStr); addDate(g.away, dateStr)
        pool.splice(i, 1); i--
      }
      if (!pool.length) break
    }
  }
  // Truly last resort — every hard rule above still respected, this only
  // matters if the whole window's capacity (extremely unlikely) is exhausted.
  if (pool.length > 0) {
    const fallbackDate = ymd(endDate)
    for (const g of pool) assignments.push({ ...g, date: fallbackDate })
  }
  return assignments
}

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

  // Pack the whole season's games onto real calendar days (see
  // packGamesByDay above) — every day is a candidate except the All-Star
  // Weekend blackout window (ALLSTAR_HALF of ALLSTAR_WEEK).
  const startDate = getWeekDates(startWeek).start
  const endDate = getWeekDates(endWeek).end
  const allstarBlock = getHalfWeekDates(ALLSTAR_WEEK, ALLSTAR_HALF)
  const blackoutDates = new Set<string>()
  for (const d = new Date(allstarBlock.start); d <= allstarBlock.end; d.setDate(d.getDate() + 1)) blackoutDates.add(ymd(d))
  const dated = packGamesByDay(allGames, startDate, endDate, blackoutDates)

  // Write to the DB: wipe the old scheduled regular-season games for this
  // range, then insert the new ones.
  // Wipe ANY existing not-yet-played regular-season schedule, regardless of
  // week range — this fully replaces whatever (possibly broken/incomplete)
  // schedule existed before, not just the target week range.
  await supabaseAdmin.from('games')
    .delete()
    .eq('status', 'scheduled').eq('game_type', 'regular')

  const byDate: Record<string, typeof dated> = {}
  for (const g of dated) (byDate[g.date] ||= []).push(g)
  const rows: any[] = []
  for (const [dateStr, gamesOnDate] of Object.entries(byDate)) {
    const dayOfWeek = WEEKDAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()]
    const week = getWeekForDate(dateStr)
    gamesOnDate.forEach((g, i) => {
      rows.push({
        week_number: week, game_number: i + 1,
        home_team: g.home, away_team: g.away,
        status: 'scheduled', game_type: 'regular', season: SEASON,
        scheduled_date: dateStr, day_of_week: dayOfWeek,
      })
    })
  }
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabaseAdmin.from('games').insert(chunk)
    if (error) return { success: false as const, error: error.message }
    inserted += chunk.length
  }

  // Sanity check: every team should have exactly 82 games
  const perTeam: Record<string, number> = {}
  for (const g of allGames) {
    perTeam[g.home] = (perTeam[g.home] || 0) + 1
    perTeam[g.away] = (perTeam[g.away] || 0) + 1
  }
  const offCount = Object.values(perTeam).filter(c => c !== 82).length

  return { success: true as const, games: inserted, weeks: endWeek - startWeek + 1, teams_off_82: offCount, per_team: perTeam }
}

// Re-dates every not-yet-played regular-season game from `fromWeek` onward
// onto the new day-by-day cadence (packGamesByDay above), WITHOUT touching
// who plays whom or which side is home — only when. For an in-progress
// season: already-played games (and whatever's mid-simulation this week)
// are left completely alone; only games still 'scheduled' from fromWeek's
// start through the regular season's end get new dates. Existing referee
// assignments are cleared and reassigned afterward (see the route that
// calls this) since assignRefereesToScheduledGames balances workload
// against each game's date/marquee status, which just changed for all of
// these.
export async function redistributeRemainingSchedule(fromWeek: number) {
  const { data: games, error: fetchErr } = await supabaseAdmin
    .from('games').select('id,home_team,away_team')
    .eq('season', SEASON).eq('game_type', 'regular').eq('status', 'scheduled')
    .gte('week_number', fromWeek)
  if (fetchErr) return { success: false as const, error: fetchErr.message }
  if (!games?.length) return { success: true as const, redated: 0 }

  const startDate = getWeekDates(fromWeek).start
  const endDate = getWeekDates(REGULAR_SEASON_END_WEEK).end
  const allstarBlock = getHalfWeekDates(ALLSTAR_WEEK, ALLSTAR_HALF)
  const blackoutDates = new Set<string>()
  for (const d = new Date(allstarBlock.start); d <= allstarBlock.end; d.setDate(d.getDate() + 1)) blackoutDates.add(ymd(d))

  // Seed each team's real last 2 play dates from just before the window
  // (any status — a team's most recent games right before `fromWeek` might
  // still be 'scheduled' if fromWeek itself is a partially-played week left
  // untouched on purpose) — see packGamesByDay's seedLastTwo param for why.
  // 10 days back is comfortably more than the 2 dates any team could
  // possibly need, even at the tightest realistic pace.
  const lookback = new Date(startDate); lookback.setDate(lookback.getDate() - 10)
  const { data: recentGames } = await supabaseAdmin
    .from('games').select('home_team,away_team,scheduled_date')
    .eq('season', SEASON).eq('game_type', 'regular')
    .gte('scheduled_date', ymd(lookback)).lt('scheduled_date', ymd(startDate))
    .order('scheduled_date')
  const seedLastTwo: Record<string, string[]> = {}
  for (const g of (recentGames || []) as any[]) {
    for (const team of [g.home_team, g.away_team]) {
      const arr = seedLastTwo[team] || []
      if (arr[arr.length - 1] !== g.scheduled_date) arr.push(g.scheduled_date)
      seedLastTwo[team] = arr.slice(-2)
    }
  }

  // Carry each game's real id through packGamesByDay's shuffle/placement by
  // encoding it into a synthetic team-slot pair the packer never has to know
  // about — simplest way to reuse the exact same day-by-day logic without
  // threading a third field through every internal step.
  const idByPair: Record<string, string[]> = {}
  const slots: GameSlot[] = games.map((g: any) => {
    const key = `${g.home_team}|${g.away_team}`
    ;(idByPair[key] ||= []).push(g.id)
    return { home: g.home_team, away: g.away_team }
  })
  const dated = packGamesByDay(slots, startDate, endDate, blackoutDates, seedLastTwo)

  let updated = 0
  for (const g of dated) {
    const key = `${g.home}|${g.away}`
    const id = idByPair[key]?.shift()
    if (!id) continue
    const dayOfWeek = WEEKDAY_NAMES[new Date(g.date + 'T00:00:00').getDay()]
    const week = getWeekForDate(g.date)
    const { error } = await supabaseAdmin.from('games').update({
      scheduled_date: g.date, day_of_week: dayOfWeek, week_number: week, referee_id: null,
    }).eq('id', id)
    if (!error) updated++
  }
  const refResult = await assignRefereesToScheduledGames()
  return { success: true as const, redated: updated, referees_assigned: refResult.assigned }
}

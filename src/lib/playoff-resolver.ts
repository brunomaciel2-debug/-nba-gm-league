import { supabaseAdmin } from '@/lib/supabase'
import { simulateGame } from '@/lib/game-simulator'
import { getRefereeAvgRatings, pickTopTierReferee, rateRefereePerformance } from '@/lib/referees'
import { getWeekForDate } from '@/lib/season-week-helper'

const SEASON = '2025-26'
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Local Y-M-D math, matching schedule-generator.ts's ymd() convention (NOT
// toISOString(), which converts to UTC and can roll the date back a day).
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function dayOfWeekFor(dateStr: string): string {
  return WEEKDAY_NAMES[new Date(dateStr + 'T12:00:00').getDay()]
}

// Builds the Play-In + playoff bracket from the final regular-season
// standings — the exact same seeding /api/playoffs/generate/route.ts always
// used for its manual "Generate Playoffs" admin button, extracted here so
// resolvePlayoffDay's caller (run.ts) can also seed it automatically once
// the regular season is actually over, without duplicating this logic.
// Never touches team wins/losses or any already-played game — purely a
// standings snapshot turned into empty/partially-filled series rows.
export async function seedNBAPlayoffBracket(): Promise<{ success: true, created: number } | { success: false, error: string }> {
  const { data: teams } = await supabaseAdmin
    .from('teams').select('*').not('id','in','(ALL,RVS,ROO,SOP)')

  const sortByRecord = (arr: any[]) => [...arr].sort((a,b) =>
    (b.wins/(b.wins+b.losses||1)) - (a.wins/(a.wins+a.losses||1)) || b.wins - a.wins
  )

  const east = sortByRecord((teams||[]).filter((t:any) => t.conference==='Eastern'))
  const west = sortByRecord((teams||[]).filter((t:any) => t.conference==='Western'))
  const series: any[] = []

  for (const [conf, ranked] of [['Eastern',east],['Western',west]] as [string,any[]][]) {
    const c = conf.toLowerCase()
    const [t1,t2,t3,t4,t5,t6,t7,t8,t9,t10] = ranked

    // Play-In: A = 7v8, B = 9v10, C = loser(A) vs winner(B)
    series.push(
      { season: SEASON, round:1, conference:conf, series_type:`playin_a_${c}`, seed_high:7, seed_low:8,  team_high:t7?.id, team_low:t8?.id,  games_needed:1, wins_high:0, wins_low:0, status:t7&&t8?'active':'scheduled' },
      { season: SEASON, round:1, conference:conf, series_type:`playin_b_${c}`, seed_high:9, seed_low:10, team_high:t9?.id, team_low:t10?.id, games_needed:1, wins_high:0, wins_low:0, status:t9&&t10?'active':'scheduled' },
      { season: SEASON, round:1, conference:conf, series_type:`playin_c_${c}`, seed_high:8, seed_low:9,  team_high:null,   team_low:null,    games_needed:1, wins_high:0, wins_low:0, status:'scheduled' }
    )

    // Round 1: 1v8, 2v7, 3v6, 4v5 (7 and 8 seeds TBD from play-in)
    series.push(
      { season: SEASON, round:2, conference:conf, series_type:`r1_${c}_1v8`, seed_high:1, seed_low:8, team_high:t1?.id, team_low:null, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' },
      { season: SEASON, round:2, conference:conf, series_type:`r1_${c}_2v7`, seed_high:2, seed_low:7, team_high:t2?.id, team_low:null, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' },
      { season: SEASON, round:2, conference:conf, series_type:`r1_${c}_3v6`, seed_high:3, seed_low:6, team_high:t3?.id, team_low:t6?.id, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' },
      { season: SEASON, round:2, conference:conf, series_type:`r1_${c}_4v5`, seed_high:4, seed_low:5, team_high:t4?.id, team_low:t5?.id, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' }
    )

    // Conference Semis, Finals
    series.push(
      { season: SEASON, round:3, conference:conf, series_type:`r2_${c}_a`, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' },
      { season: SEASON, round:3, conference:conf, series_type:`r2_${c}_b`, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' },
      { season: SEASON, round:4, conference:conf, series_type:`conf_final_${c}`, games_needed:7, wins_high:0, wins_low:0, status:'scheduled' }
    )
  }

  // NBA Finals
  series.push({ season: SEASON, round:5, series_type:'nba_finals', games_needed:7, wins_high:0, wins_low:0, status:'scheduled' })

  await supabaseAdmin.from('playoff_series').delete().eq('season', SEASON)
  const { error } = await supabaseAdmin.from('playoff_series').insert(series)
  if (error) return { success: false, error: error.message }
  return { success: true, created: series.length }
}

type AdvanceTarget = { seriesType: string, slot: 'team_high' | 'team_low' }

// Fixed bracket progression, mirroring the real NBA Play-In + playoff format
// already described in src/app/playoffs/page.tsx's legend: winner of the
// 7v8 game becomes the true 7 seed (feeds Round 1's 1v8 series); loser of
// that game gets a second life against the winner of 9v10, and THAT winner
// becomes the true 8 seed (feeds Round 1's 2v7 series). Everything else is
// a standard single-elimination bracket.
function buildAdvanceMap(conf: 'eastern' | 'western'): Record<string, { winner: AdvanceTarget, loserTo?: AdvanceTarget }> {
  const c = conf
  return {
    [`playin_a_${c}`]: { winner: { seriesType: `r1_${c}_1v8`, slot: 'team_low' }, loserTo: { seriesType: `playin_c_${c}`, slot: 'team_high' } },
    [`playin_b_${c}`]: { winner: { seriesType: `playin_c_${c}`, slot: 'team_low' } },
    [`playin_c_${c}`]: { winner: { seriesType: `r1_${c}_2v7`, slot: 'team_low' } },
    [`r1_${c}_1v8`]: { winner: { seriesType: `r2_${c}_a`, slot: 'team_high' } },
    [`r1_${c}_4v5`]: { winner: { seriesType: `r2_${c}_a`, slot: 'team_low' } },
    [`r1_${c}_2v7`]: { winner: { seriesType: `r2_${c}_b`, slot: 'team_high' } },
    [`r1_${c}_3v6`]: { winner: { seriesType: `r2_${c}_b`, slot: 'team_low' } },
    [`r2_${c}_a`]: { winner: { seriesType: `conf_final_${c}`, slot: 'team_high' } },
    [`r2_${c}_b`]: { winner: { seriesType: `conf_final_${c}`, slot: 'team_low' } },
  }
}

const FULL_ADVANCE_MAP: Record<string, { winner: AdvanceTarget, loserTo?: AdvanceTarget }> = {
  ...buildAdvanceMap('eastern'),
  ...buildAdvanceMap('western'),
}

async function fillSeriesSlot(seriesType: string, slot: 'team_high' | 'team_low', teamId: string) {
  await supabaseAdmin.from('playoff_series').update({ [slot]: teamId, status: 'active' }).eq('season', SEASON).eq('series_type', seriesType)
}

// Finals MVP — fires once, the moment the NBA Finals series completes.
// Scores every champion-team player the same weighted way as the season MVP
// award, but only across the Finals series' own games (not the whole
// playoffs) — matching the real award's scope. Runner-up players are never
// eligible, even if one of them out-produced everyone on the floor.
async function resolveFinalsMVP(championId: string, runnerUpId: string) {
  const { data: finalsGames } = await supabaseAdmin
    .from('games').select('id').eq('game_type', 'playoff')
    .or(`and(home_team.eq.${championId},away_team.eq.${runnerUpId}),and(home_team.eq.${runnerUpId},away_team.eq.${championId})`)
  const gameIds = (finalsGames || []).map((g: any) => g.id)
  if (!gameIds.length) return

  const { data: boxes } = await supabaseAdmin
    .from('box_scores').select('player_id,pts,reb,ast,stl,blk,mins')
    .in('game_id', gameIds).eq('team_id', championId).gt('mins', 0)

  const byPlayer: Record<string, { pts: number, reb: number, ast: number, stl: number, blk: number, games: number }> = {}
  for (const b of (boxes || [])) {
    const acc = (byPlayer[b.player_id] ||= { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, games: 0 })
    acc.pts += b.pts || 0; acc.reb += b.reb || 0; acc.ast += b.ast || 0
    acc.stl += b.stl || 0; acc.blk += b.blk || 0; acc.games++
  }

  const ranked = Object.entries(byPlayer).map(([playerId, s]) => {
    const g = s.games || 1
    const score = (s.pts / g) * 1.0 + (s.reb / g) * 0.8 + (s.ast / g) * 1.2 + (s.stl / g) * 3 + (s.blk / g) * 3
    return { playerId, score, stats: { ppg: (s.pts / g).toFixed(1), rpg: (s.reb / g).toFixed(1), apg: (s.ast / g).toFixed(1), games: g } }
  }).sort((a, b) => b.score - a.score)

  if (!ranked[0]) return
  await supabaseAdmin.from('awards').upsert({
    season: SEASON, award_type: 'finals_mvp', period: 'season',
    player_id: ranked[0].playerId, team_id: championId, score: ranked[0].score,
    stats_context: ranked[0].stats, notes: 'Finals MVP',
  }, { onConflict: 'season,award_type,period' })
}

// Records the season's champion/runner-up into the shared cross-league
// history table (also used by the G-League bracket) — fires once, the
// moment the NBA Finals series completes. Names are snapshotted at the
// time (not just the id) so the history page never depends on a join that
// could break across a season reset or franchise relocation.
// Books a real 'scheduled' games row for a series' NEXT game the moment its
// date is actually known (computeNextGameDate, called from
// resolvePlayoffDay below) — regardless of whether that date has arrived
// yet. Without this, a future playoff/play-in game never showed up on the
// Schedule page in advance the way every regular-season game already does:
// the old code only ever created a games row at the instant it simulated
// the game. Idempotent (checked by season+date+matchup), so calling it
// again for a game that already has its placeholder is a no-op.
async function ensurePlayoffPlaceholderGame(homeTeamId: string, awayTeamId: string, gameNumber: number, dateStr: string, week: number) {
  const { data: existing } = await supabaseAdmin.from('games').select('id')
    .eq('season', SEASON).eq('game_type', 'playoff').eq('scheduled_date', dateStr)
    .eq('home_team', homeTeamId).eq('away_team', awayTeamId).maybeSingle()
  if (existing) return
  await supabaseAdmin.from('games').insert({
    season: SEASON, week_number: week, game_number: gameNumber,
    home_team: homeTeamId, away_team: awayTeamId,
    status: 'scheduled', game_type: 'playoff',
    scheduled_date: dateStr, day_of_week: dayOfWeekFor(dateStr),
  })
}

async function recordChampionship(championId: string, runnerUpId: string) {
  const { data: teams } = await supabaseAdmin.from('teams').select('id,name').in('id', [championId, runnerUpId])
  const nameById: Record<string, string> = {}
  ;(teams || []).forEach((t: any) => { nameById[t.id] = t.name })
  await supabaseAdmin.from('championship_history').insert({
    season: SEASON, league: 'nba',
    champion_team_id: championId, champion_team_name: nameById[championId] || championId,
    runner_up_team_id: runnerUpId, runner_up_team_name: nameById[runnerUpId] || runnerUpId,
  })
}

async function advanceWinner(seriesType: string, winnerId: string, loserId: string) {
  // NBA Finals isn't in the per-conference map — both conference-final
  // winners feed it, with the better regular-season record hosting (team_high),
  // same real-world home-court-advantage rule used everywhere else this
  // session (never a coin flip when a real record exists to decide it).
  if (seriesType === 'conf_final_eastern' || seriesType === 'conf_final_western') {
    const { data: finals } = await supabaseAdmin.from('playoff_series').select('*').eq('season', SEASON).eq('series_type', 'nba_finals').single()
    const { data: winnerTeam } = await supabaseAdmin.from('teams').select('wins,losses').eq('id', winnerId).single()
    const otherSlotFilled = finals?.team_high || finals?.team_low
    if (!otherSlotFilled) {
      await fillSeriesSlot('nba_finals', 'team_high', winnerId)
      return
    }
    const { data: otherTeam } = await supabaseAdmin.from('teams').select('wins,losses').eq('id', otherSlotFilled).single()
    const winnerPct = (winnerTeam?.wins || 0) / Math.max(1, (winnerTeam?.wins || 0) + (winnerTeam?.losses || 0))
    const otherPct = (otherTeam?.wins || 0) / Math.max(1, (otherTeam?.wins || 0) + (otherTeam?.losses || 0))
    if (winnerPct > otherPct) {
      // Winner has the better record — swap so they take team_high (home court).
      await supabaseAdmin.from('playoff_series').update({ team_high: winnerId, team_low: otherSlotFilled }).eq('season', SEASON).eq('series_type', 'nba_finals')
    } else {
      await fillSeriesSlot('nba_finals', 'team_low', winnerId)
    }
    return
  }

  const advance = FULL_ADVANCE_MAP[seriesType]
  if (!advance) return
  await fillSeriesSlot(advance.winner.seriesType, advance.winner.slot, winnerId)
  if (advance.loserTo) await fillSeriesSlot(advance.loserTo.seriesType, advance.loserTo.slot, loserId)
}

// A team's most recent FINAL game date, any game_type — the anchor used to
// work out when their next game is allowed. Chains regular season → play-in
// → each playoff round uniformly, with no special-casing per transition.
async function mostRecentGameDate(teamId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('games').select('scheduled_date')
    .or(`home_team.eq.${teamId},away_team.eq.${teamId}`).eq('status', 'final')
    .not('scheduled_date', 'is', null)
    .order('scheduled_date', { ascending: false }).limit(1).maybeSingle()
  return data?.scheduled_date || null
}

// A fresh series (no games played yet) needs BOTH teams rested — 2 full
// rest days off since whatever they last played (regular season, play-in,
// or a previous round), so the next game is the 3rd day after (e.g. last
// game Apr 17 -> Apr 18/19 off -> next game Apr 20) — so it opens on
// whichever team is ready later. A series already underway continues its
// own "day yes, day no" cadence from its own last game (a rest day in
// between, so +2 — e.g. Apr 20 -> Apr 21 off -> Apr 22); both teams share
// that same last game, so no max needed.
async function computeNextGameDate(s: any): Promise<string | null> {
  if ((s.wins_high || 0) + (s.wins_low || 0) === 0) {
    const [highDate, lowDate] = await Promise.all([mostRecentGameDate(s.team_high), mostRecentGameDate(s.team_low)])
    if (!highDate || !lowDate) return null
    const readyDate = highDate > lowDate ? highDate : lowDate
    return addDays(readyDate, 3)
  }
  const lastDate = await mostRecentGameDate(s.team_high)
  return lastDate ? addDays(lastDate, 2) : null
}

// Advances the playoff bracket by at most one game per still-open series
// that's actually due on simDate — called once per simulated calendar day
// (see src/lib/daily-tick.ts), not once per week. A series plays every
// other day within itself, and waits 2 full rest days before its first
// game against a freshly-arrived opponent. Creates real `games` +
// `box_scores` rows via the same simulateGame() used everywhere else, so a
// playoff game is simulated exactly like a regular-season one (decisive
// flag always on, near-full arenas) — nothing special-cased in the engine.
// Deliberately not gated on getStatusForWeek() — an unusually long bracket
// keeps resolving regardless of what the nominal week's phase label says,
// rather than freezing mid-series once the week counter moves on.
export async function resolvePlayoffDay(simDate: string): Promise<{ processed: number }> {
  const { data: series } = await supabaseAdmin.from('playoff_series').select('*').eq('season', SEASON).neq('status', 'completed')
  if (!series?.length) return { processed: 0 }

  const week = getWeekForDate(simDate)

  // Officials Ranking — every playoff/play-in game is decisive by
  // definition, so it always draws from the top tier of rated referees
  // (see pickTopTierReferee()), not the single #1 every time — real
  // playoffs rotate several top officials across different games.
  const { data: refereesPool } = await supabaseAdmin.from('referees').select('id')
  const refIds = (refereesPool || []).map((r: any) => r.id as string)
  const avgRatings = await getRefereeAvgRatings()

  let processed = 0
  for (const s of series) {
    if (!s.team_high || !s.team_low) continue // still waiting on a previous round to fill this in

    const majorityNeeded = Math.ceil((s.games_needed || 7) / 2)
    if (s.wins_high >= majorityNeeded || s.wins_low >= majorityNeeded) {
      // Already decided but never marked completed — safety net, shouldn't
      // normally happen since we mark it the moment it's decided below.
      const winnerId = s.wins_high > s.wins_low ? s.team_high : s.team_low
      const loserId = s.wins_high > s.wins_low ? s.team_low : s.team_high
      await supabaseAdmin.from('playoff_series').update({ status: 'completed', next_game_date: null }).eq('id', s.id)
      await advanceWinner(s.series_type, winnerId, loserId)
      if (s.series_type === 'nba_finals') { await resolveFinalsMVP(winnerId, loserId); await recordChampionship(winnerId, loserId) }
      continue
    }

    // Work out (or compute, the first time) when this series' next game is
    // due, then skip it if that's not today.
    let nextGameDate: string | null = s.next_game_date
    if (!nextGameDate) {
      nextGameDate = await computeNextGameDate(s)
      if (!nextGameDate) continue // one team's last game date isn't known yet — shouldn't normally happen
      await supabaseAdmin.from('playoff_series').update({ next_game_date: nextGameDate }).eq('id', s.id)
    }

    const gameNumber = (s.wins_high || 0) + (s.wins_low || 0) + 1
    // Play-in is a single game (higher seed always hosts); best-of-7 uses
    // the standard 2-2-1-1-1 home/away pattern.
    const homeIsHigh = (s.games_needed || 7) === 1 ? true : [1, 2, 5, 7].includes(gameNumber)
    const homeTeamId = homeIsHigh ? s.team_high : s.team_low
    const awayTeamId = homeIsHigh ? s.team_low : s.team_high

    // Book the placeholder as soon as the date is known, whether or not
    // it's actually due yet — this is what makes the game show up on the
    // Schedule page in advance.
    await ensurePlayoffPlaceholderGame(homeTeamId, awayTeamId, gameNumber, nextGameDate, getWeekForDate(nextGameDate))

    if (nextGameDate > simDate) continue // not due yet

    const [{ data: hp }, { data: ap }, { data: teamsData }, { data: orders }] = await Promise.all([
      supabaseAdmin.from('players').select('*').eq('team_id', homeTeamId).eq('status', 'active'),
      supabaseAdmin.from('players').select('*').eq('team_id', awayTeamId).eq('status', 'active'),
      supabaseAdmin.from('teams').select('*').in('id', [homeTeamId, awayTeamId]),
      supabaseAdmin.from('gm_orders').select('*').in('team_id', [homeTeamId, awayTeamId]).order('week_number', { ascending: false }).limit(2),
    ])
    if (!hp?.length || !ap?.length) continue
    const ht = teamsData?.find((t: any) => t.id === homeTeamId)
    const at = teamsData?.find((t: any) => t.id === awayTeamId)
    if (!ht || !at) continue
    // Most recent order per team (orders queried newest-first above) — a
    // playoff game isn't necessarily tied to "this week's" submitted
    // orders the way a regular-season one is, so this just uses whatever
    // each team last set.
    const orderMap: Record<string, any> = {}
    ;(orders || []).forEach((o: any) => { if (!orderMap[o.team_id]) orderMap[o.team_id] = o })

    // Every playoff game is decisive by definition, and arenas are as full
    // as they get — same attRate/decisive plumbing the regular season uses.
    const hOrd = { ...(orderMap[homeTeamId] || {}), decisive: true, attRate: 0.97 }
    const aOrd = { ...(orderMap[awayTeamId] || {}), decisive: true, attRate: 0.97 }
    const result = simulateGame(ht, at, hp, ap, hOrd, aOrd)

    const refereeId = refIds.length ? pickTopTierReferee(refIds, avgRatings) : null
    const refereeRating = refereeId ? rateRefereePerformance(result.homeBox, result.awayBox, false, true) : null

    // The 'scheduled' placeholder for this exact game should already exist
    // (booked above, the moment its date became known) — finish it in
    // place, same pattern used for the G-League playoffs and the All-Star
    // exhibition games. Falls back to a fresh insert only if it's somehow
    // missing. played_at is the SIMULATED calendar date (nextGameDate), not
    // real wall-clock time — every other games row (and this same page's
    // box score header) treats played_at as a date on the simulated season
    // timeline.
    const { data: existingGame } = await supabaseAdmin.from('games').select('id')
      .eq('season', SEASON).eq('game_type', 'playoff').eq('scheduled_date', nextGameDate)
      .eq('home_team', homeTeamId).eq('away_team', awayTeamId).maybeSingle()

    let gameId: string | null = null
    if (existingGame) {
      await supabaseAdmin.from('games').update({
        home_score: result.homeScore, away_score: result.awayScore, status: 'final',
        played_at: `${nextGameDate}T20:00:00.000Z`,
        attendance: Math.round((ht.arena_capacity || 18000) * 0.97), is_rivalry: false,
        referee_id: refereeId, referee_rating: refereeRating, period_scores: result.periods,
      }).eq('id', existingGame.id)
      gameId = existingGame.id
    } else {
      const { data: gameRec } = await supabaseAdmin.from('games').insert({
        week_number: week, game_number: gameNumber, home_team: homeTeamId, away_team: awayTeamId,
        home_score: result.homeScore, away_score: result.awayScore, status: 'final', season: SEASON,
        played_at: `${nextGameDate}T20:00:00.000Z`, game_type: 'playoff',
        scheduled_date: nextGameDate, day_of_week: dayOfWeekFor(nextGameDate),
        attendance: Math.round((ht.arena_capacity || 18000) * 0.97), is_rivalry: false,
        referee_id: refereeId, referee_rating: refereeRating,
        period_scores: result.periods,
      }).select().single()
      gameId = gameRec?.id || null
    }

    if (gameId) {
      const boxRows = [
        ...result.homeBox.map((b: any) => ({ ...b, game_id: gameId, team_id: homeTeamId })),
        ...result.awayBox.map((b: any) => ({ ...b, game_id: gameId, team_id: awayTeamId })),
      ]
      if (boxRows.length) await supabaseAdmin.from('box_scores').insert(boxRows)
    }

    const homeWon = result.homeScore > result.awayScore
    const newWinsHigh = (s.wins_high || 0) + (homeIsHigh ? (homeWon ? 1 : 0) : (homeWon ? 0 : 1))
    const newWinsLow = (s.wins_low || 0) + (homeIsHigh ? (homeWon ? 0 : 1) : (homeWon ? 1 : 0))
    processed++

    if (newWinsHigh >= majorityNeeded || newWinsLow >= majorityNeeded) {
      const winnerId = newWinsHigh > newWinsLow ? s.team_high : s.team_low
      const loserId = newWinsHigh > newWinsLow ? s.team_low : s.team_high
      await supabaseAdmin.from('playoff_series').update({ wins_high: newWinsHigh, wins_low: newWinsLow, status: 'completed', next_game_date: null }).eq('id', s.id)
      await advanceWinner(s.series_type, winnerId, loserId)
      if (s.series_type === 'nba_finals') { await resolveFinalsMVP(winnerId, loserId); await recordChampionship(winnerId, loserId) }
    } else {
      // Series continues — "day yes, day no": one rest day in between, so
      // the next game is 2 days after this one.
      await supabaseAdmin.from('playoff_series').update({ wins_high: newWinsHigh, wins_low: newWinsLow, next_game_date: addDays(nextGameDate, 2) }).eq('id', s.id)
    }
  }
  return { processed }
}

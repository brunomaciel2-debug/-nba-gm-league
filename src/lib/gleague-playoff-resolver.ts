import { supabaseAdmin } from '@/lib/supabase'
import { buildTeamBox } from '@/lib/gleague-simulator'
import { notify } from '@/lib/notifications'
import { getTeamLang, notifGLeaguePlayoffsBegin, notifGLeagueSeasonRecall } from '@/lib/notifications-helpers'

const SEASON = '2025-26'

// Top 8 per conference (16 total) qualify — matches the "Top 8 qualify for
// playoffs" text already shown on /gleague's Standings tab. Same bracket
// SHAPE as the NBA's playoff-resolver.ts (Round 1 -> Round 2 -> Conference
// Final -> Finals, just without a Play-In), but every series is a single
// game instead of best-of-7 — real G-League playoffs are a short, quick
// format, which also keeps this genuinely distinct from the NBA bracket
// rather than a smaller copy of it. Uses the same lightweight
// buildTeamBox() formula as the regular season (no possession engine,
// matchups, or tactics — this league never has any of that), not
// simulateGame().
function buildAdvanceMap(conf: 'eastern' | 'western'): Record<string, { seriesType: string, slot: 'team_high' | 'team_low' }> {
  const c = conf
  return {
    [`r1_${c}_1v8`]: { seriesType: `r2_${c}_a`, slot: 'team_high' },
    [`r1_${c}_4v5`]: { seriesType: `r2_${c}_a`, slot: 'team_low' },
    [`r1_${c}_2v7`]: { seriesType: `r2_${c}_b`, slot: 'team_high' },
    [`r1_${c}_3v6`]: { seriesType: `r2_${c}_b`, slot: 'team_low' },
    [`r2_${c}_a`]: { seriesType: `cf_${c}`, slot: 'team_high' },
    [`r2_${c}_b`]: { seriesType: `cf_${c}`, slot: 'team_low' },
  }
}
const ADVANCE_MAP: Record<string, { seriesType: string, slot: 'team_high' | 'team_low' }> = {
  ...buildAdvanceMap('eastern'), ...buildAdvanceMap('western'),
}

function weekForSeries(seriesType: string): number {
  if (seriesType.startsWith('r1_')) return 14
  if (seriesType.startsWith('r2_')) return 15
  if (seriesType.startsWith('cf_')) return 16
  return 17 // gl_finals
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// When a round is actually DUE to be played — separate from when its
// matchup becomes KNOWN (see ensurePlaceholderGame below), so a round can
// show up on the Schedule tab as a real "Scheduled" game, with its real
// opponent and date, well before it's simulated. Round 1/2/Conf-Finals are
// spaced 2 days apart starting at the announced "G League Playoffs Begin"
// date (season_events.gleague_playoffs); the Finals uses the announced "G
// League Finals" date directly (season_events.gleague_finals), which the
// calendar already books as its own separate window.
function dateForSeries(seriesType: string, playoffsStart: string, finalsStart: string): string {
  if (seriesType.startsWith('r1_')) return playoffsStart
  if (seriesType.startsWith('r2_')) return addDays(playoffsStart, 2)
  if (seriesType.startsWith('cf_')) return addDays(playoffsStart, 4)
  return finalsStart // gl_finals
}

// The moment a series' matchup is fully known (both slots filled) — which
// can happen well before that round is actually due — this books a real
// 'scheduled' gleague_games row for it, dated to its real future play date.
// Without this, a future playoff round genuinely couldn't show up on the
// Schedule tab in advance the way every regular-season game already does:
// the old code only ever created a game row at the INSTANT it simulated a
// series, so nothing about an upcoming round — not the date, not even who's
// playing — was visible on the schedule until the moment it was already
// decided. Idempotent (checked by season+week+matchup) so calling it again
// for a series that already has its placeholder is a no-op.
async function ensurePlaceholderGame(seriesType: string, homeTeamId: string, awayTeamId: string, dateStr: string) {
  const week = weekForSeries(seriesType)
  const { data: existing } = await supabaseAdmin.from('gleague_games').select('id')
    .eq('season', SEASON).eq('game_type', 'playoff').eq('week_number', week)
    .eq('home_team', homeTeamId).eq('away_team', awayTeamId).maybeSingle()
  if (existing) return
  await supabaseAdmin.from('gleague_games').insert({
    season: SEASON, week_number: week, home_team: homeTeamId, away_team: awayTeamId,
    status: 'scheduled', game_type: 'playoff', played_at: `${dateStr}T20:00:00.000Z`,
  })
}

async function fillSlot(seriesType: string, slot: 'team_high' | 'team_low', teamId: string, playoffsStart: string, finalsStart: string) {
  const { data } = await supabaseAdmin.from('gleague_playoff_series')
    .update({ [slot]: teamId, status: 'active' }).eq('season', SEASON).eq('series_type', seriesType)
    .select().single()
  if (data?.team_high && data?.team_low) {
    await ensurePlaceholderGame(seriesType, data.team_high, data.team_low, dateForSeries(seriesType, playoffsStart, finalsStart))
  }
}

async function seedBracket(playoffsStart: string, finalsStart: string) {
  const { data: teams } = await supabaseAdmin.from('gleague_teams').select('id,conference,wins,losses')
  if (!teams?.length) return

  const seedsByConf: Record<string, any[]> = {}
  for (const t of teams) (seedsByConf[t.conference] ||= []).push(t)
  for (const conf of Object.keys(seedsByConf)) {
    seedsByConf[conf].sort((a, b) => {
      const aPct = a.wins / Math.max(1, a.wins + a.losses), bPct = b.wins / Math.max(1, b.wins + b.losses)
      return bPct - aPct || b.wins - a.wins
    })
  }

  const rows: any[] = []
  // Round 1 pairings, per conference, with home team + date already known —
  // used right below to also book their placeholder games.
  const round1Pairs: { seriesType: string, home: string, low: string }[] = []
  for (const [conf, teamsList] of Object.entries(seedsByConf)) {
    const seeds = teamsList.slice(0, 8) // top 8 — matches /gleague's own "Top 8 qualify" text
    if (seeds.length < 8) continue
    const [s1, s2, s3, s4, s5, s6, s7, s8] = seeds
    const key = conf.toLowerCase()
    rows.push({ season: SEASON, series_type: `r1_${key}_1v8`, team_high: s1.id, team_low: s8.id, games_needed: 1, status: 'active' })
    rows.push({ season: SEASON, series_type: `r1_${key}_4v5`, team_high: s4.id, team_low: s5.id, games_needed: 1, status: 'active' })
    rows.push({ season: SEASON, series_type: `r1_${key}_2v7`, team_high: s2.id, team_low: s7.id, games_needed: 1, status: 'active' })
    rows.push({ season: SEASON, series_type: `r1_${key}_3v6`, team_high: s3.id, team_low: s6.id, games_needed: 1, status: 'active' })
    round1Pairs.push({ seriesType: `r1_${key}_1v8`, home: s1.id, low: s8.id })
    round1Pairs.push({ seriesType: `r1_${key}_4v5`, home: s4.id, low: s5.id })
    round1Pairs.push({ seriesType: `r1_${key}_2v7`, home: s2.id, low: s7.id })
    round1Pairs.push({ seriesType: `r1_${key}_3v6`, home: s3.id, low: s6.id })
    rows.push({ season: SEASON, series_type: `r2_${key}_a`, team_high: null, team_low: null, games_needed: 1, status: 'pending' })
    rows.push({ season: SEASON, series_type: `r2_${key}_b`, team_high: null, team_low: null, games_needed: 1, status: 'pending' })
    rows.push({ season: SEASON, series_type: `cf_${key}`, team_high: null, team_low: null, games_needed: 1, status: 'pending' })
  }
  if (!rows.length) return
  rows.push({ season: SEASON, series_type: 'gl_finals', team_high: null, team_low: null, games_needed: 1, status: 'pending' })
  await supabaseAdmin.from('gleague_playoff_series').insert(rows.map(r => ({ ...r, wins_high: 0, wins_low: 0 })))

  // Round 1 always falls on the announced playoffs-start date itself
  // (dateForSeries('r1_...')) — using playoffsStart directly here instead.
  for (const p of round1Pairs) await ensurePlaceholderGame(p.seriesType, p.home, p.low, playoffsStart)

  // League-wide notice — seedBracket() only ever runs once per season (the
  // caller only invokes it when no series exist yet), so no extra
  // idempotency guard is needed here.
  const { data: nbaTeams } = await supabaseAdmin.from('teams').select('id').not('id', 'in', '(ALL,RVS,ROO,SOP)')
  for (const t of (nbaTeams || [])) {
    const lang = await getTeamLang(t.id)
    const notif = notifGLeaguePlayoffsBegin(lang, playoffsStart)
    await notify(t.id, 'gleague_playoffs_begin', notif.subject, notif.body, {})
  }
}

async function advanceWinner(seriesType: string, winnerId: string, playoffsStart: string, finalsStart: string) {
  if (seriesType === 'cf_eastern' || seriesType === 'cf_western') {
    const { data: finals } = await supabaseAdmin.from('gleague_playoff_series').select('*').eq('season', SEASON).eq('series_type', 'gl_finals').single()
    const { data: winnerTeam } = await supabaseAdmin.from('gleague_teams').select('wins,losses').eq('id', winnerId).single()
    const otherSlotFilled = finals?.team_high || finals?.team_low
    if (!otherSlotFilled) { await fillSlot('gl_finals', 'team_high', winnerId, playoffsStart, finalsStart); return }
    const { data: otherTeam } = await supabaseAdmin.from('gleague_teams').select('wins,losses').eq('id', otherSlotFilled).single()
    const winnerPct = (winnerTeam?.wins || 0) / Math.max(1, (winnerTeam?.wins || 0) + (winnerTeam?.losses || 0))
    const otherPct = (otherTeam?.wins || 0) / Math.max(1, (otherTeam?.wins || 0) + (otherTeam?.losses || 0))
    if (winnerPct > otherPct) {
      await supabaseAdmin.from('gleague_playoff_series').update({ team_high: winnerId, team_low: otherSlotFilled }).eq('season', SEASON).eq('series_type', 'gl_finals')
      await ensurePlaceholderGame('gl_finals', winnerId, otherSlotFilled, dateForSeries('gl_finals', playoffsStart, finalsStart))
    } else {
      await fillSlot('gl_finals', 'team_low', winnerId, playoffsStart, finalsStart)
    }
    return
  }
  const advance = ADVANCE_MAP[seriesType]
  if (!advance) return
  await fillSlot(advance.seriesType, advance.slot, winnerId, playoffsStart, finalsStart)
}

async function recordChampionship(championId: string, runnerUpId: string) {
  const { data: teams } = await supabaseAdmin.from('gleague_teams').select('id,name').in('id', [championId, runnerUpId])
  const nameById: Record<string, string> = {}
  ;(teams || []).forEach((t: any) => { nameById[t.id] = t.name })
  await supabaseAdmin.from('championship_history').insert({
    season: SEASON, league: 'gleague',
    champion_team_id: championId, champion_team_name: nameById[championId] || championId,
    runner_up_team_id: runnerUpId, runner_up_team_name: nameById[runnerUpId] || runnerUpId,
  })
}

// Advances the bracket by one game per still-open, DUE series, per call —
// same idempotent, call-repeatedly shape as playoff-resolver.ts. Seeding
// (and booking each round's real 'scheduled' game the moment its matchup
// becomes known) happens as soon as the regular season actually finishes —
// that's just displaying already-known facts (final standings), not
// deciding anything early. Only the SIMULATION of a round — turning its
// 'scheduled' placeholder into a real result — waits for that round's own
// due date (dateForSeries), anchored to the announced "G League Playoffs
// Begin"/"G League Finals" dates (season_events). A real incident this
// split fixes: the regular season finished (Mar 26) several days before
// the announced playoffs date (Mar 31), and the old code — seeding AND
// simulating in the same step — blew through Round 1 and Round 2 the
// moment it got the chance, with no way for a GM to ever see a future
// round's matchup or date in advance the way every regular-season game
// already shows up on the Schedule tab weeks ahead.
export async function resolveGLeaguePlayoffs(week: number, simDate: string): Promise<{ processed: number }> {
  const { count: pendingRegular } = await supabaseAdmin.from('gleague_games')
    .select('*', { count: 'exact', head: true }).eq('season', SEASON).eq('game_type', 'regular').eq('status', 'scheduled')
  if (pendingRegular && pendingRegular > 0) return { processed: 0 }

  const { data: playoffsEvent } = await supabaseAdmin.from('season_events')
    .select('start_date').eq('season', SEASON).eq('event_key', 'gleague_playoffs').maybeSingle()
  const { data: finalsEvent } = await supabaseAdmin.from('season_events')
    .select('start_date').eq('season', SEASON).eq('event_key', 'gleague_finals').maybeSingle()
  if (!playoffsEvent?.start_date || !finalsEvent?.start_date) return { processed: 0 }
  const playoffsStart = playoffsEvent.start_date, finalsStart = finalsEvent.start_date

  const { count: existingSeries } = await supabaseAdmin.from('gleague_playoff_series')
    .select('*', { count: 'exact', head: true }).eq('season', SEASON)
  if (!existingSeries) {
    // Also bail if the regular season simply hasn't started yet (no games
    // played at all) — otherwise this would seed a bracket on day one.
    const { count: anyPlayed } = await supabaseAdmin.from('gleague_games')
      .select('*', { count: 'exact', head: true }).eq('season', SEASON).eq('game_type', 'regular').eq('status', 'final')
    if (!anyPlayed) return { processed: 0 }
    await seedBracket(playoffsStart, finalsStart)
  }

  const { data: series } = await supabaseAdmin.from('gleague_playoff_series').select('*').eq('season', SEASON).neq('status', 'completed')
  if (!series?.length) return { processed: 0 }

  let processed = 0
  for (const s of series) {
    if (!s.team_high || !s.team_low) continue // still waiting on a previous round

    const dueDate = dateForSeries(s.series_type, playoffsStart, finalsStart)
    if (simDate < dueDate) continue // matchup is known and already booked on the schedule, just not due yet

    const homeTeamId = s.team_high // single game — higher seed / better record always hosts
    const awayTeamId = s.team_low

    const { data: roster } = await supabaseAdmin.from('players').select('*').in('gleague_team_id', [homeTeamId, awayTeamId])
    const homeBox = buildTeamBox((roster || []).filter((p: any) => p.gleague_team_id === homeTeamId), homeTeamId)
    const awayBox = buildTeamBox((roster || []).filter((p: any) => p.gleague_team_id === awayTeamId), awayTeamId)
    if (!homeBox.length || !awayBox.length) continue

    const homeScore = homeBox.reduce((sum, b) => sum + b.pts, 0)
    const awayScore = awayBox.reduce((sum, b) => sum + b.pts, 0)
    const homeWon = homeScore > awayScore
    const winnerId = homeWon ? homeTeamId : awayTeamId
    const loserId = homeWon ? awayTeamId : homeTeamId

    // Atomic claim, BEFORE writing anything else — a real incident: two
    // simulate calls landed ~33 seconds apart, both read this same series
    // while it was still 'active', both built and wrote a full (differently
    // randomized) box score for it, and both called advanceWinner. The
    // `.eq('status', s.status)` guard means only the FIRST of two
    // concurrent calls actually flips the row — Postgres serializes
    // concurrent UPDATEs to the same row, so exactly one of them observes
    // its own write taking effect and gets rows back; the other's WHERE no
    // longer matches (status already changed under it) and gets none back,
    // and bails out here before touching gleague_games/box_scores/
    // advanceWinner at all.
    const { data: claimed } = await supabaseAdmin.from('gleague_playoff_series')
      .update({ status: 'completed', wins_high: homeWon ? 1 : 0, wins_low: homeWon ? 0 : 1 })
      .eq('id', s.id).eq('status', s.status).select()
    if (!claimed || claimed.length === 0) continue // another call already resolved this series

    // The 'scheduled' placeholder for this series should already exist
    // (booked the moment its matchup became known, in seedBracket/fillSlot
    // above) — finish it in place, same pattern insertGameAndBox() in
    // allstar-events-simulator.ts uses for the All-Star exhibition games.
    // Falls back to a fresh insert only if it's somehow missing (a series
    // seeded before this placeholder logic existed, etc).
    const week_number = weekForSeries(s.series_type)
    const { data: existingGame } = await supabaseAdmin.from('gleague_games').select('id')
      .eq('season', SEASON).eq('game_type', 'playoff').eq('week_number', week_number)
      .eq('home_team', homeTeamId).eq('away_team', awayTeamId).maybeSingle()

    let gameId: string | null = null
    if (existingGame) {
      await supabaseAdmin.from('gleague_games').update({
        home_score: homeScore, away_score: awayScore, status: 'final',
        played_at: `${simDate}T20:00:00.000Z`,
      }).eq('id', existingGame.id)
      gameId = existingGame.id
    } else {
      const { data: gameRec } = await supabaseAdmin.from('gleague_games').insert({
        season: SEASON, week_number, home_team: homeTeamId, away_team: awayTeamId,
        home_score: homeScore, away_score: awayScore, status: 'final',
        played_at: `${simDate}T20:00:00.000Z`, game_type: 'playoff',
      }).select().single()
      gameId = gameRec?.id || null
    }

    if (gameId) {
      const withGameId = [...homeBox, ...awayBox].map(b => ({ ...b, game_id: gameId }))
      await supabaseAdmin.from('gleague_box_scores').insert(withGameId)
    }
    processed++

    // Single game — decided immediately. Playoff results never touch
    // gleague_teams.wins/losses (same as the NBA bracket): those numbers
    // are the regular-season record this bracket was seeded from, and must
    // stay that way for next season's seeding too.
    await advanceWinner(s.series_type, winnerId, playoffsStart, finalsStart)
    if (s.series_type === 'gl_finals') await recordChampionship(winnerId, loserId)
  }
  return { processed }
}

// Automatically recalls any NBA player on assignment the moment his
// G-League affiliate's OWN season is genuinely over — eliminated from the
// playoffs, or never qualified in the first place — instead of leaving him
// parked there indefinitely until his GM remembers to bring him back
// manually. A team's season is over once it appears in no still-open
// (non-completed) playoff series AND has no games left on the schedule —
// true immediately after the regular season ends for the 14 non-playoff
// teams (they never touch a playoff_series row at all), and true for a
// playoff team the moment its most recent series completes without it
// advancing to fill the next round's slot.
export async function recallExpiredGLeagueAssignments(): Promise<{ recalled: number }> {
  const { count: pendingRegular } = await supabaseAdmin.from('gleague_games')
    .select('*', { count: 'exact', head: true }).eq('season', SEASON).eq('game_type', 'regular').eq('status', 'scheduled')
  if (pendingRegular && pendingRegular > 0) return { recalled: 0 } // regular season still going — nobody's "done" yet

  const { data: assigned } = await supabaseAdmin.from('players')
    .select('id,name,team_id,gleague_team_id').eq('on_gleague_assignment', true).not('gleague_team_id', 'is', null)
  if (!assigned?.length) return { recalled: 0 }

  const [{ data: openSeries }, { data: scheduledGames }] = await Promise.all([
    supabaseAdmin.from('gleague_playoff_series').select('team_high,team_low').eq('season', SEASON).neq('status', 'completed'),
    supabaseAdmin.from('gleague_games').select('home_team,away_team').eq('season', SEASON).eq('status', 'scheduled'),
  ])
  const teamsStillPlaying = new Set<string>()
  for (const s of (openSeries || [])) { if (s.team_high) teamsStillPlaying.add(s.team_high); if (s.team_low) teamsStillPlaying.add(s.team_low) }
  for (const g of (scheduledGames || [])) { teamsStillPlaying.add(g.home_team); teamsStillPlaying.add(g.away_team) }

  let recalled = 0
  for (const p of assigned) {
    if (teamsStillPlaying.has(p.gleague_team_id)) continue // this team still has a game left

    const { data: glTeam } = await supabaseAdmin.from('gleague_teams').select('name').eq('id', p.gleague_team_id).single()
    await supabaseAdmin.from('players').update({ on_gleague_assignment: false, gleague_team_id: null }).eq('id', p.id)
    recalled++

    if (!p.team_id) continue // shouldn't normally happen — an assigned player always keeps his NBA team_id
    const lang = await getTeamLang(p.team_id)
    const notif = notifGLeagueSeasonRecall(lang, p.name, glTeam?.name || p.gleague_team_id)
    await notify(p.team_id, 'gleague_recall', notif.subject, notif.body, {})
    try {
      await supabaseAdmin.from('transactions').insert({
        type: 'gleague_recall', category: 'player',
        description: `${p.name} recalled from the G-League (${glTeam?.name || p.gleague_team_id} — season ended)`,
        teams: [p.team_id], players: [p.name], player_ids: [p.id],
        status: 'completed',
        details: { from: { kind: 'gleague_team', id: p.gleague_team_id }, to: { kind: 'nba_team', id: p.team_id } },
      })
    } catch (txErr) { console.warn('Failed to record automatic G-League recall transaction', txErr) }
  }
  return { recalled }
}

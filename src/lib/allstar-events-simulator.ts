import { supabaseAdmin } from '@/lib/supabase'
import { simulateGame } from '@/lib/game-simulator'
import { buildAutoDepthChart } from '@/lib/auto-depth-chart'
import { ALLSTAR_WEEK } from '@/lib/allstar-constants'

// Simulates the two All-Star Weekend exhibition games (Rising Stars and the
// East/West All-Star Game) once each squad has been announced — see
// allstar-resolver.ts for roster selection. Both are dedicated no-tactics-
// heavy, real-box-score games, run inside the ALLSTAR_WEEK/half-1 no-other-
// games block (see run.ts and schedule-generator.ts).

const SEASON = '2025-26'

function gameScore(b: any): number {
  return (b.pts || 0) + 0.4 * (b.fgm || 0) - 0.7 * (b.fga || 0) - 0.4 * ((b.fta || 0) - (b.ftm || 0))
    + 0.7 * (b.off_reb || 0) + 0.3 * (b.def_reb || 0) + (b.stl || 0) + 0.7 * (b.ast || 0) + 0.7 * (b.blk || 0)
    - 0.4 * (b.pf || 0) - (b.turnovers || 0)
}

// buildAutoDepthChart ranks players by .usage (highest first) into a
// starter (24 min) + 2 subs (16/8 min) tier per position — exactly the
// "not equal, but reasonable" minute spread Bruno asked for. Neither
// exhibition roster's players carry meaningful real .usage against each
// other (rookies/sophomores/All-Stars come from 30 different real rosters),
// so a synthetic descending value keyed to the roster's own starter/reserve
// order (already decided by vote count or Game Score) is stamped on first.
function depthChartFor(orderedPlayers: any[]) {
  const withUsage = orderedPlayers.map((p, i) => ({ ...p, usage: orderedPlayers.length - i }))
  return buildAutoDepthChart(withUsage)
}

async function insertGameAndBox(opts: {
  homeTeamId: string, awayTeamId: string, homeTeamObj: any, awayTeamObj: any,
  homePlayers: any[], awayPlayers: any[], homeOrd: any, awayOrd: any,
  gameType: string, weekNumber: number,
}) {
  const { homeTeamId, awayTeamId, homeTeamObj, awayTeamObj, homePlayers, awayPlayers, homeOrd, awayOrd, gameType, weekNumber } = opts
  const result = simulateGame(homeTeamObj, awayTeamObj, homePlayers, awayPlayers, homeOrd, awayOrd)

  const { count } = await supabaseAdmin.from('games').select('*', { count: 'exact', head: true }).eq('week_number', weekNumber)
  const { data: gameRec } = await supabaseAdmin.from('games').insert({
    week_number: weekNumber, game_number: (count || 0) + 1,
    home_team: homeTeamId, away_team: awayTeamId,
    home_score: result.homeScore, away_score: result.awayScore,
    status: 'final', played_at: new Date().toISOString(),
    game_type: gameType, period_scores: result.periods,
    // Neutral-site exhibition — no real GM's arena/ticket pricing applies,
    // so attendance/referee are flavor-only flat values, not computed.
    attendance: 19000, is_rivalry: false, referee_id: null, referee_rating: null,
  }).select().single()
  if (!gameRec) throw new Error(`Failed to create ${gameType} game record`)

  const mkBox = (rows: any[], teamId: string) => rows.map((b: any) => {
    const dc = [b.pts || 0, b.reb || 0, b.ast || 0, b.stl || 0, b.blk || 0].filter((v: number) => v >= 10).length
    return { ...b, mins: Math.round(b.mins || 0), game_id: gameRec.id, team_id: teamId, is_double_double: dc >= 2, is_triple_double: dc >= 3 }
  })
  const homeBoxRows = mkBox(result.homeBox, homeTeamId)
  const awayBoxRows = mkBox(result.awayBox, awayTeamId)
  const { error: boxErr } = await supabaseAdmin.from('box_scores').insert([...homeBoxRows, ...awayBoxRows])
  if (boxErr) console.warn(`box_scores insert failed for ${gameType} game:`, boxErr.message)
  if (result.pbp?.length) await supabaseAdmin.from('play_by_play').insert(result.pbp.map((p: any) => ({ ...p, game_id: gameRec.id })))

  let mvpPlayerId: any = null, mvpScore = -Infinity
  for (const b of [...homeBoxRows, ...awayBoxRows]) {
    const s = gameScore(b)
    if (s > mvpScore) { mvpScore = s; mvpPlayerId = b.player_id }
  }

  return { gameId: gameRec.id, homeScore: result.homeScore, awayScore: result.awayScore, mvpPlayerId, mvpScore }
}

export async function simulateRisingStarsGame() {
  const { data: claimed } = await supabaseAdmin.from('allstar_config')
    .update({ rising_stars_played: true }).eq('id', 1).eq('rising_stars_played', false).select('id')
  if (!claimed || claimed.length === 0) return { skipped: true as const }

  const { data: roster } = await supabaseAdmin.from('rising_stars_roster').select('*').eq('season', SEASON)
  if (!roster || roster.length === 0) return { skipped: true as const, reason: 'no roster' }

  const playerIds = roster.map((r: any) => r.player_id)
  const { data: playersRaw } = await supabaseAdmin.from('players').select('*').in('id', playerIds)
  const playerMap: Record<string, any> = {}
  ;(playersRaw || []).forEach((p: any) => { playerMap[p.id] = p })

  const buildSide = (teamId: string) => roster.filter((r: any) => r.team_id === teamId)
    .sort((a: any, b: any) => (b.is_starter ? 1 : 0) - (a.is_starter ? 1 : 0) || (b.game_score || 0) - (a.game_score || 0))
    .map((r: any) => playerMap[r.player_id]).filter(Boolean)

  const rookiePlayers = buildSide('ROO')
  const sophPlayers = buildSide('SOP')
  if (!rookiePlayers.length || !sophPlayers.length) return { skipped: true as const, reason: 'empty roster side' }

  const homeOrd = { depth_chart: depthChartFor(rookiePlayers) }
  const awayOrd = { depth_chart: depthChartFor(sophPlayers) }

  const { gameId, homeScore, awayScore, mvpPlayerId, mvpScore } = await insertGameAndBox({
    homeTeamId: 'ROO', awayTeamId: 'SOP',
    homeTeamObj: { id: 'ROO', name: 'Rookie Team' }, awayTeamObj: { id: 'SOP', name: 'Sophomore Team' },
    homePlayers: rookiePlayers, awayPlayers: sophPlayers, homeOrd, awayOrd,
    gameType: 'rising_stars', weekNumber: ALLSTAR_WEEK,
  })

  if (mvpPlayerId) {
    await supabaseAdmin.from('awards').delete().eq('season', SEASON).eq('award_type', 'rising_stars_mvp')
    await supabaseAdmin.from('awards').insert({
      season: SEASON, award_type: 'rising_stars_mvp', period: 'season',
      player_id: mvpPlayerId, score: +mvpScore.toFixed(2), notes: 'Rising Stars Game MVP',
    })
  }

  return { skipped: false as const, gameId, homeScore, awayScore, mvpPlayerId }
}

export async function simulateAllStarGame() {
  const { data: claimed } = await supabaseAdmin.from('allstar_config')
    .update({ all_star_game_played: true }).eq('id', 1).eq('all_star_game_played', false).select('id')
  if (!claimed || claimed.length === 0) return { skipped: true as const }

  const { data: roster } = await supabaseAdmin.from('allstar_roster').select('*').eq('season', SEASON).eq('is_injured', false)
  if (!roster || roster.length === 0) return { skipped: true as const, reason: 'no roster' }

  const playerIds = roster.map((r: any) => r.player_id)
  const { data: playersRaw } = await supabaseAdmin.from('players').select('*').in('id', playerIds)
  const playerMap: Record<string, any> = {}
  ;(playersRaw || []).forEach((p: any) => { playerMap[p.id] = p })

  const buildSide = (conf: string) => roster.filter((r: any) => r.conference === conf)
    .sort((a: any, b: any) => (b.is_starter ? 1 : 0) - (a.is_starter ? 1 : 0) || (b.vote_count || 0) - (a.vote_count || 0))
    .map((r: any) => playerMap[r.player_id]).filter(Boolean)

  const eastPlayers = buildSide('Eastern')
  const westPlayers = buildSide('Western')
  if (!eastPlayers.length || !westPlayers.length) return { skipped: true as const, reason: 'empty roster side' }

  // Bruno's spec: simple tactics that favor offense/high scoring — fast
  // pace + a transition-heavy attack against a plain man defense on both
  // sides, unlike a real GM's carefully-drilled tactical system.
  const tactics = { pace: 90, atk_style: 'transition', def_style: 'man', three_rate: 52 }
  const homeOrd = { depth_chart: depthChartFor(eastPlayers), ...tactics }
  const awayOrd = { depth_chart: depthChartFor(westPlayers), ...tactics }

  const { gameId, homeScore, awayScore, mvpPlayerId, mvpScore } = await insertGameAndBox({
    homeTeamId: 'ALL', awayTeamId: 'RVS',
    homeTeamObj: { id: 'ALL', name: 'All-Stars East' }, awayTeamObj: { id: 'RVS', name: 'All-Stars West' },
    homePlayers: eastPlayers, awayPlayers: westPlayers, homeOrd, awayOrd,
    gameType: 'allstar', weekNumber: ALLSTAR_WEEK,
  })

  if (mvpPlayerId) {
    await supabaseAdmin.from('awards').delete().eq('season', SEASON).eq('award_type', 'all_star_mvp')
    await supabaseAdmin.from('awards').insert({
      season: SEASON, award_type: 'all_star_mvp', period: 'season',
      player_id: mvpPlayerId, score: +mvpScore.toFixed(2), notes: 'All-Star Game MVP',
    })
  }

  return { skipped: false as const, gameId, homeScore, awayScore, mvpPlayerId }
}

import { supabaseAdmin } from '@/lib/supabase'
import { simulateGame } from '@/lib/game-simulator'
import { buildAutoDepthChart } from '@/lib/auto-depth-chart'
import { ALLSTAR_WEEK, ALLSTAR_HALF } from '@/lib/allstar-constants'
import { getHalfWeekDates } from '@/lib/season-week-helper'
import { notify } from '@/lib/notifications'
import { getTeamLang } from '@/lib/notifications-helpers'

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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
  gameType: string, weekNumber: number, scheduledDate: string,
}) {
  const { homeTeamId, awayTeamId, homeTeamObj, awayTeamObj, homePlayers, awayPlayers, homeOrd, awayOrd, gameType, weekNumber, scheduledDate } = opts
  const result = simulateGame(homeTeamObj, awayTeamObj, homePlayers, awayPlayers, homeOrd, awayOrd)

  // A "scheduled" placeholder for this exact exhibition game may already
  // exist (see ensureExhibitionPlaceholders below — created the moment
  // rosters are set, same as every regular-season game already shows up on
  // the Schedule page well before it's played). Finish that same row
  // instead of inserting a second one, which would otherwise leave a dead
  // "Scheduled" row sitting on the Schedule page forever alongside the
  // real final result.
  const { data: existing } = await supabaseAdmin.from('games').select('id')
    .eq('season', SEASON).eq('game_type', gameType).eq('status', 'scheduled').maybeSingle()

  const finalFields = {
    home_score: result.homeScore, away_score: result.awayScore,
    status: 'final', played_at: new Date().toISOString(),
    scheduled_date: scheduledDate, period_scores: result.periods,
    attendance: 19000, is_rivalry: false, referee_id: null, referee_rating: null,
  }
  let gameRec: any
  if (existing) {
    const { data } = await supabaseAdmin.from('games').update(finalFields).eq('id', existing.id).select().single()
    gameRec = data
  } else {
    const { count } = await supabaseAdmin.from('games').select('*', { count: 'exact', head: true }).eq('week_number', weekNumber)
    const { data } = await supabaseAdmin.from('games').insert({
      week_number: weekNumber, game_number: (count || 0) + 1,
      home_team: homeTeamId, away_team: awayTeamId, season: SEASON,
      game_type: gameType, ...finalFields,
    }).select().single()
    gameRec = data
  }
  if (!gameRec) throw new Error(`Failed to create ${gameType} game record`)

  const mkBox = (rows: any[], teamId: string) => rows.map((b: any) => {
    const dc = [b.pts || 0, b.reb || 0, b.ast || 0, b.stl || 0, b.blk || 0].filter((v: number) => v >= 10).length
    return { ...b, mins: Math.round(b.mins || 0), game_id: gameRec.id, team_id: teamId, is_double_double: dc >= 2, is_triple_double: dc >= 3 }
  })
  const homeBoxRows = mkBox(result.homeBox, homeTeamId)
  const awayBoxRows = mkBox(result.awayBox, awayTeamId)
  // upsert on (game_id, player_id) — see ADICIONAR_UNIQUE_BOX_SCORES.sql —
  // so a retried or re-triggered write can never double a player's line.
  const { error: boxErr } = await supabaseAdmin.from('box_scores').upsert([...homeBoxRows, ...awayBoxRows], { onConflict: 'game_id,player_id' })
  if (boxErr) console.warn(`box_scores insert failed for ${gameType} game:`, boxErr.message)
  if (result.pbp?.length) await supabaseAdmin.from('play_by_play').insert(result.pbp.map((p: any) => ({ ...p, game_id: gameRec.id })))

  let mvpPlayerId: any = null, mvpScore = -Infinity
  for (const b of [...homeBoxRows, ...awayBoxRows]) {
    const s = gameScore(b)
    if (s > mvpScore) { mvpScore = s; mvpPlayerId = b.player_id }
  }

  return { gameId: gameRec.id, homeScore: result.homeScore, awayScore: result.awayScore, mvpPlayerId, mvpScore }
}

// League-wide announcement once an exhibition game is actually played —
// previously only a console.log, so no GM ever found out these happened
// short of stumbling onto the Schedule page. metadata.game_id reuses the
// inbox's existing "View Box Score →" button (see inbox/page.tsx), no new
// UI needed.
async function announceExhibitionGame(opts: {
  type: 'rising_stars' | 'allstar', gameId: string, homeLabel: string, awayLabel: string,
  homeScore: number, awayScore: number, mvpName: string | null,
}) {
  const { type, gameId, homeLabel, awayLabel, homeScore, awayScore, mvpName } = opts
  const { data: teams } = await supabaseAdmin.from('teams').select('id').not('id', 'in', '(ALL,RVS,ROO,SOP)')
  for (const t of (teams || [])) {
    const lang = await getTeamLang(t.id)
    const isPT = lang === 'pt'
    const subject = type === 'rising_stars'
      ? (isPT ? `🌟 Jogo Rising Stars: ${homeScore}-${awayScore}` : `🌟 Rising Stars Game: ${homeScore}-${awayScore}`)
      : (isPT ? `⭐ Jogo All-Star: ${homeScore}-${awayScore}` : `⭐ All-Star Game: ${homeScore}-${awayScore}`)
    const eventLabel = type === 'rising_stars'
      ? (isPT ? 'O Rookie Team venceu o Sophomore Team' : 'The Rookie Team beat the Sophomore Team')
      : (isPT ? `${homeLabel} venceu ${awayLabel}` : `${homeLabel} beat ${awayLabel}`)
    const body = `${eventLabel} ${homeScore}-${awayScore}.` + (mvpName
      ? (isPT ? `\n\nMVP do jogo: ${mvpName}.` : `\n\nGame MVP: ${mvpName}.`)
      : '')
    await notify(t.id, type === 'rising_stars' ? 'rising_stars_game' : 'allstar_game', subject, body, { game_id: gameId })
  }
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

  // Real ASW order (matches the season_events description): 3-Point Contest
  // on the block's 1st day (see simulateThreePointContest below — no games
  // row of its own), Rising Stars on the 2nd, the All-Star Game on the 3rd
  // (see simulateAllStarGame() below) — all land inside ALLSTAR_HALF's date
  // range (getHalfWeekDates), never real wall-clock "today".
  const rsDate = ymd((() => { const d = getHalfWeekDates(ALLSTAR_WEEK, ALLSTAR_HALF).start; d.setDate(d.getDate() + 1); return d })())

  const { gameId, homeScore, awayScore, mvpPlayerId, mvpScore } = await insertGameAndBox({
    homeTeamId: 'ROO', awayTeamId: 'SOP',
    homeTeamObj: { id: 'ROO', name: 'Rookie Team' }, awayTeamObj: { id: 'SOP', name: 'Sophomore Team' },
    homePlayers: rookiePlayers, awayPlayers: sophPlayers, homeOrd, awayOrd,
    gameType: 'rising_stars', weekNumber: ALLSTAR_WEEK, scheduledDate: rsDate,
  })

  if (mvpPlayerId) {
    await supabaseAdmin.from('awards').delete().eq('season', SEASON).eq('award_type', 'rising_stars_mvp')
    await supabaseAdmin.from('awards').insert({
      season: SEASON, award_type: 'rising_stars_mvp', period: 'season',
      player_id: mvpPlayerId, score: +mvpScore.toFixed(2), notes: 'Rising Stars Game MVP',
    })
  }

  await announceExhibitionGame({
    type: 'rising_stars', gameId, homeLabel: 'Rookie Team', awayLabel: 'Sophomore Team',
    homeScore, awayScore, mvpName: mvpPlayerId ? (playerMap[mvpPlayerId]?.name || null) : null,
  })

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

  const asDate = ymd((() => { const d = getHalfWeekDates(ALLSTAR_WEEK, ALLSTAR_HALF).start; d.setDate(d.getDate() + 2); return d })())

  const { gameId, homeScore, awayScore, mvpPlayerId, mvpScore } = await insertGameAndBox({
    homeTeamId: 'ALL', awayTeamId: 'RVS',
    homeTeamObj: { id: 'ALL', name: 'All-Stars East' }, awayTeamObj: { id: 'RVS', name: 'All-Stars West' },
    homePlayers: eastPlayers, awayPlayers: westPlayers, homeOrd, awayOrd,
    gameType: 'allstar', weekNumber: ALLSTAR_WEEK, scheduledDate: asDate,
  })

  if (mvpPlayerId) {
    await supabaseAdmin.from('awards').delete().eq('season', SEASON).eq('award_type', 'all_star_mvp')
    await supabaseAdmin.from('awards').insert({
      season: SEASON, award_type: 'all_star_mvp', period: 'season',
      player_id: mvpPlayerId, score: +mvpScore.toFixed(2), notes: 'All-Star Game MVP',
    })
  }

  await announceExhibitionGame({
    type: 'allstar', gameId, homeLabel: 'All-Stars East', awayLabel: 'All-Stars West',
    homeScore, awayScore, mvpName: mvpPlayerId ? (playerMap[mvpPlayerId]?.name || null) : null,
  })

  return { skipped: false as const, gameId, homeScore, awayScore, mvpPlayerId }
}

// Three-Point Contest — the 8-player field is picked earlier (see
// resolveAllStarWeekend in allstar-resolver.ts: top 8 season 3PM as of the
// roster announcement). Bruno's explicit spec for the contest itself is a
// "sorteio" (lottery) guided by shooting quality, not a deterministic
// best-shooter-always-wins pick and not a full shot-by-shot round
// simulation — a weighted random draw on the `three` rating.
export async function simulateThreePointContest() {
  const { data: claimed } = await supabaseAdmin.from('allstar_config')
    .update({ three_point_contest_played: true }).eq('id', 1).eq('three_point_contest_played', false).select('id')
  if (!claimed || claimed.length === 0) return { skipped: true as const }

  const { data: contestants } = await supabaseAdmin.from('three_point_contest').select('*').eq('season', SEASON)
  if (!contestants || contestants.length === 0) return { skipped: true as const, reason: 'no contestants' }

  const playerIds = contestants.map((c: any) => c.player_id)
  const { data: playersRaw } = await supabaseAdmin.from('players').select('id,name,three').in('id', playerIds)
  const playerMap: Record<string, any> = {}
  ;(playersRaw || []).forEach((p: any) => { playerMap[p.id] = p })

  // Squaring the 0-100 `three` rating gives real, meaningful odds to the
  // better shooters (an ~90-rated shooter lands roughly a fifth to a
  // quarter of an 8-man field this way) without ever guaranteeing the
  // outcome — a weaker shooter can still genuinely win, same as real life.
  const weights = contestants.map((c: any) => {
    const rating = playerMap[c.player_id]?.three || 50
    return { id: c.player_id, weight: rating * rating }
  })
  const totalWeight = weights.reduce((s: number, w: any) => s + w.weight, 0)
  let roll = Math.random() * totalWeight
  let winnerId = weights[weights.length - 1].id
  for (const w of weights) { roll -= w.weight; if (roll <= 0) { winnerId = w.id; break } }

  await supabaseAdmin.from('three_point_contest').update({ is_winner: true }).eq('season', SEASON).eq('player_id', winnerId)

  await supabaseAdmin.from('awards').delete().eq('season', SEASON).eq('award_type', 'three_point_contest')
  await supabaseAdmin.from('awards').insert({
    season: SEASON, award_type: 'three_point_contest', period: 'season',
    player_id: winnerId, notes: 'Three-Point Contest Champion',
  })

  const winnerName = playerMap[winnerId]?.name || null
  const { data: teams } = await supabaseAdmin.from('teams').select('id').not('id', 'in', '(ALL,RVS,ROO,SOP)')
  for (const t of (teams || [])) {
    const lang = await getTeamLang(t.id)
    const isPT = lang === 'pt'
    const subject = isPT ? `🎯 ${winnerName} venceu o Concurso de Triplos!` : `🎯 ${winnerName} wins the Three-Point Contest!`
    const body = isPT
      ? `${winnerName} venceu o Concurso de Triplos do All-Star Weekend, entre os 8 maiores marcadores de triplos da época.`
      : `${winnerName} has won the All-Star Weekend Three-Point Contest, among this season's top 8 three-point shooters.`
    await notify(t.id, 'three_point_contest', subject, body, { player_id: winnerId })
  }

  return { skipped: false as const, winnerId, winnerName }
}

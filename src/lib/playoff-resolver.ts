import { supabaseAdmin } from '@/lib/supabase'
import { simulateGame } from '@/lib/game-simulator'
import { getRefereeAvgRatings, pickTopTierReferee, rateRefereePerformance } from '@/lib/referees'

const SEASON = '2025-26'

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

// Advances the playoff bracket by exactly one game per still-open series,
// per call — same idempotent, call-repeatedly-per-tick shape as
// src/lib/summer-league.ts and src/lib/referees.ts. Creates real `games` +
// `box_scores` rows via the same simulateGame() used everywhere else, so a
// playoff game is simulated exactly like a regular-season one (decisive
// flag always on, near-full arenas) — nothing special-cased in the engine.
export async function resolvePlayoffSeries(week: number): Promise<{ processed: number }> {
  const { data: series } = await supabaseAdmin.from('playoff_series').select('*').eq('season', SEASON).neq('status', 'completed')
  if (!series?.length) return { processed: 0 }

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
      await supabaseAdmin.from('playoff_series').update({ status: 'completed' }).eq('id', s.id)
      await advanceWinner(s.series_type, winnerId, loserId)
      if (s.series_type === 'nba_finals') { await resolveFinalsMVP(winnerId, loserId); await recordChampionship(winnerId, loserId) }
      continue
    }

    const gameNumber = (s.wins_high || 0) + (s.wins_low || 0) + 1
    // Play-in is a single game (higher seed always hosts); best-of-7 uses
    // the standard 2-2-1-1-1 home/away pattern.
    const homeIsHigh = (s.games_needed || 7) === 1 ? true : [1, 2, 5, 7].includes(gameNumber)
    const homeTeamId = homeIsHigh ? s.team_high : s.team_low
    const awayTeamId = homeIsHigh ? s.team_low : s.team_high

    const [{ data: hp }, { data: ap }, { data: teamsData }, { data: orders }] = await Promise.all([
      supabaseAdmin.from('players').select('*').eq('team_id', homeTeamId).eq('status', 'active'),
      supabaseAdmin.from('players').select('*').eq('team_id', awayTeamId).eq('status', 'active'),
      supabaseAdmin.from('teams').select('*').in('id', [homeTeamId, awayTeamId]),
      supabaseAdmin.from('gm_orders').select('*').eq('week_number', week).in('team_id', [homeTeamId, awayTeamId]),
    ])
    if (!hp?.length || !ap?.length) continue
    const ht = teamsData?.find((t: any) => t.id === homeTeamId)
    const at = teamsData?.find((t: any) => t.id === awayTeamId)
    if (!ht || !at) continue
    const orderMap: Record<string, any> = {}
    ;(orders || []).forEach((o: any) => { orderMap[o.team_id] = o })

    // Every playoff game is decisive by definition, and arenas are as full
    // as they get — same attRate/decisive plumbing the regular season uses.
    const hOrd = { ...(orderMap[homeTeamId] || {}), decisive: true, attRate: 0.97 }
    const aOrd = { ...(orderMap[awayTeamId] || {}), decisive: true, attRate: 0.97 }
    const result = simulateGame(ht, at, hp, ap, hOrd, aOrd)

    const refereeId = refIds.length ? pickTopTierReferee(refIds, avgRatings) : null
    const refereeRating = refereeId ? rateRefereePerformance(result.homeBox, result.awayBox, false, true) : null

    const { data: gameRec } = await supabaseAdmin.from('games').insert({
      week_number: week, game_number: gameNumber, home_team: homeTeamId, away_team: awayTeamId,
      home_score: result.homeScore, away_score: result.awayScore, status: 'final',
      played_at: new Date().toISOString(), game_type: 'playoff',
      attendance: Math.round((ht.arena_capacity || 18000) * 0.97), is_rivalry: false,
      referee_id: refereeId, referee_rating: refereeRating,
      period_scores: result.periods,
    }).select().single()

    if (gameRec) {
      const boxRows = [
        ...result.homeBox.map((b: any) => ({ ...b, game_id: gameRec.id, team_id: homeTeamId })),
        ...result.awayBox.map((b: any) => ({ ...b, game_id: gameRec.id, team_id: awayTeamId })),
      ]
      if (boxRows.length) await supabaseAdmin.from('box_scores').insert(boxRows)
    }

    const homeWon = result.homeScore > result.awayScore
    const newWinsHigh = (s.wins_high || 0) + (homeIsHigh ? (homeWon ? 1 : 0) : (homeWon ? 0 : 1))
    const newWinsLow = (s.wins_low || 0) + (homeIsHigh ? (homeWon ? 0 : 1) : (homeWon ? 1 : 0))
    await supabaseAdmin.from('playoff_series').update({ wins_high: newWinsHigh, wins_low: newWinsLow }).eq('id', s.id)
    processed++

    if (newWinsHigh >= majorityNeeded || newWinsLow >= majorityNeeded) {
      const winnerId = newWinsHigh > newWinsLow ? s.team_high : s.team_low
      const loserId = newWinsHigh > newWinsLow ? s.team_low : s.team_high
      await supabaseAdmin.from('playoff_series').update({ status: 'completed' }).eq('id', s.id)
      await advanceWinner(s.series_type, winnerId, loserId)
      if (s.series_type === 'nba_finals') { await resolveFinalsMVP(winnerId, loserId); await recordChampionship(winnerId, loserId) }
    }
  }
  return { processed }
}

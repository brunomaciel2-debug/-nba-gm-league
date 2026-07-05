import { supabaseAdmin } from '@/lib/supabase'
import { simulateGame } from '@/lib/game-simulator'

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

    const { data: gameRec } = await supabaseAdmin.from('games').insert({
      week_number: week, game_number: gameNumber, home_team: homeTeamId, away_team: awayTeamId,
      home_score: result.homeScore, away_score: result.awayScore, status: 'final',
      played_at: new Date().toISOString(), game_type: 'playoff',
      attendance: Math.round((ht.arena_capacity || 18000) * 0.97), is_rivalry: false,
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
    }
  }
  return { processed }
}

import { supabaseAdmin } from '@/lib/supabase'
import { simulateGame } from '@/lib/game-simulator'
import { notify } from '@/lib/notifications'
import { getTeamLang, notifInjury } from '@/lib/notifications-helpers'

// Resolves a single scheduled friendly/pre-season game (a preseason_games row) —
// NBA vs NBA, or NBA vs a "Rest of the World" team. Produces an isolated
// result + box score only: never touches team wins/losses, elo, or
// player_stats — friendly games don't count toward anything.
// Shared by /api/admin/simulate-preseason (single-game button) and
// /api/cron/simulate (bulk "Simulate Week" — resolves every pending friendly
// alongside the week's real games, so the commissioner doesn't have to click
// each friendly one by one).

// Same position+usage depth-chart algorithm already used for real NBA teams
// with no GM (see /api/admin/auto-orders) — reused here for any roster with
// no submitted Weekly Orders of its own (a World team never has a GM to
// submit any), so simulateGame() gets real minutes to distribute instead of
// every player sitting at 0 mins.
function buildAutoDepthChart(players: any[]) {
  const byPos: Record<string, any[]> = { PG: [], SG: [], SF: [], PF: [], C: [] }
  const sorted = [...players].sort((a: any, b: any) => (b.usage || 0) - (a.usage || 0))
  for (const p of sorted) {
    const pos = (p.pos || '').toUpperCase()
    if (byPos[pos]) byPos[pos].push(p)
    else if (['PG', 'SG'].includes(pos)) { byPos.PG.push(p); byPos.SG.push(p) }
    else if (['SF', 'PF'].includes(pos)) { byPos.SF.push(p); byPos.PF.push(p) }
  }
  const depth_chart: Record<string, any> = {}
  const usedMins: Record<string, number> = {}
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
    const pool = (byPos[pos] || []).filter((p: any) => (usedMins[p.id] || 0) < 36)
    if (!pool.length) continue
    const starter = pool[0], sub1 = pool[1] || pool[0], sub2 = pool[2] || pool[0]
    depth_chart[pos] = { s: { name: starter.name, mins: 24 }, b1: { name: sub1.name, mins: 16 }, b2: { name: sub2.name, mins: 8 } }
    usedMins[starter.id] = (usedMins[starter.id] || 0) + 24
    usedMins[sub1.id] = (usedMins[sub1.id] || 0) + 16
    usedMins[sub2.id] = (usedMins[sub2.id] || 0) + 8
  }
  // A roster with zero natural players at some position — real gap, seen on
  // roughly a third of World-team rosters (e.g. Red Star Belgrade has no
  // natural SG) — used to just leave that slot out of the depth chart
  // entirely: only 4 of 5 starter slots got built, so that position's
  // minutes vanished instead of being played by anyone. Now the
  // least-used remaining player on the roster fills the gap instead; the
  // existing out-of-position penalty in game-simulator.ts's
  // applyDC/pS/simP already makes that a real disadvantage, so a club
  // actually missing a position plays a real (if worse) 5-man rotation
  // instead of a phantom 4-on-5.
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
    if (depth_chart[pos]) continue
    const pool = sorted.filter((p: any) => (usedMins[p.id] || 0) < 36)
      .sort((a: any, b: any) => (usedMins[a.id] || 0) - (usedMins[b.id] || 0))
    if (!pool.length) continue
    const starter = pool[0], sub1 = pool[1] || pool[0], sub2 = pool[2] || pool[0]
    depth_chart[pos] = { s: { name: starter.name, mins: 24 }, b1: { name: sub1.name, mins: 16 }, b2: { name: sub2.name, mins: 8 } }
    usedMins[starter.id] = (usedMins[starter.id] || 0) + 24
    usedMins[sub1.id] = (usedMins[sub1.id] || 0) + 16
    usedMins[sub2.id] = (usedMins[sub2.id] || 0) + 8
  }
  return depth_chart
}

// Light fatigue + injury pass for real NBA players who actually played —
// same spirit as the weekly simulator's injury system, simplified since
// there's no weekly training-order/pace context for a single friendly. Only
// ever applied to real NBA player ids — a World team's roster is flavor
// opposition with no persistent team in this league, so there's nothing to
// track health/injuries against for them.
async function applyFriendlyFatigueAndInjury(box: any[], nbaPlayerIds: Set<string>) {
  const relevant = box.filter(b => nbaPlayerIds.has(String(b.player_id)))
  if (!relevant.length) return
  const playerIds = relevant.map(b => b.player_id)
  const [{ data: injTypes }, { data: playersInfo }] = await Promise.all([
    supabaseAdmin.from('injury_types').select('*'),
    supabaseAdmin.from('players').select('id,name,team_id,health,moral,durability').in('id', playerIds),
  ])
  const pMap: Record<string, any> = {}
  ;(playersInfo || []).forEach((p: any) => { pMap[p.id] = p })
  const SWEIGHTS: Record<string, number> = { minor: 40, moderate: 25, serious: 15, severe: 8, career_threatening: 2 }

  for (const box2 of relevant) {
    const p = pMap[box2.player_id]
    if (!p) continue
    const healthLoss = (box2.mins || 0) / 12
    const newHealth = Math.round(Math.max(0, (p.health ?? 100) - healthLoss))
    const durFactor = (p.durability || 75) / 100
    const hFactor = newHealth < 70 ? 1.5 : newHealth < 85 ? 1.2 : 1.0
    const injChance = 0.01 * (1 / durFactor) * hFactor // lower than a real season game — it's just a friendly

    if (Math.random() < injChance && injTypes?.length) {
      const weights = (injTypes as any[]).map(t => ({ t, w: (SWEIGHTS[t.severity] || 10) * t.game_probability }))
      const totalW = weights.reduce((s, x) => s + x.w, 0)
      let r = Math.random() * totalW, chosen = weights[0].t
      for (const { t, w } of weights) { r -= w; if (r <= 0) { chosen = t; break } }
      const daysOut = Math.round(chosen.days_min + Math.random() * (chosen.days_max - chosen.days_min))
      const gamesOut = Math.max(1, Math.round(daysOut / 3.5))
      const hImpact = Math.round(chosen.health_impact_min + Math.random() * (chosen.health_impact_max - chosen.health_impact_min))
      await supabaseAdmin.from('injury_log').insert({
        player_id: p.id, season: '2025-26',
        injury_type: chosen.name, injury_category: chosen.category,
        body_part: chosen.body_part, severity: chosen.severity,
        occurred_in: 'preseason_game', health_at_injury: newHealth,
        health_impact: hImpact, moral_impact: chosen.moral_impact || 0,
        days_out: daysOut, games_out: gamesOut,
        is_recurring: false, can_play: newHealth >= 50,
        play_risk: newHealth < 65 ? 75 : newHealth < 75 ? 40 : 15, status: 'active',
      })
      const injHealth = Math.max(0, newHealth - hImpact)
      await supabaseAdmin.from('players').update({
        health: injHealth, moral: Math.max(0, (p.moral ?? 80) - (chosen.moral_impact || 0)),
        status: injHealth < 50 ? 'injured' : 'active',
        injury_type: chosen.name,
      }).eq('id', p.id)

      // Real-game injuries notify the GM (notifications.ts) but friendlies
      // previously didn't — a player could get hurt in a pre-season game
      // with no message ever reaching the GM's inbox.
      if (p.team_id) {
        try {
          const lang = await getTeamLang(p.team_id)
          const notif = notifInjury(lang, p.name, chosen.name, gamesOut)
          await notify(p.team_id, 'injury', notif.subject, notif.body, {
            player_id: p.id, injury_type: chosen.name, severity: chosen.severity,
            games_out: gamesOut, occurred_in: 'preseason_game',
          })
        } catch { /* notification failure shouldn't block the game result */ }
      }
    } else {
      await supabaseAdmin.from('players').update({ health: newHealth }).eq('id', p.id)
    }
  }
}

// weekOverride: the caller (run.ts's bulk friendly-resolution loop) already
// knows the exact week being simulated — pass it through instead of letting
// this function re-derive "current_week+1" on its own. That self-lookup
// used to silently break for any friendly resolved on a week-finalizing
// (half 2) invocation: current_week gets bumped to the just-finished week
// BEFORE the friendly loop runs, so by the time this function re-queried
// it, "current_week+1" pointed one week PAST the real one — a real GM's
// just-submitted Weekly Orders were never found (wrong week_number), so
// the friendly silently fell back to the auto depth chart every time,
// exactly what a GM would call "my orders are decorative." Only the
// single-game admin trigger (no bulk-loop context) still self-derives it.
export async function simulatePreseasonGame(id: string, weekOverride?: number) {
  const { data: pg } = await supabaseAdmin.from('preseason_games').select('*').eq('id', id).single()
  if (!pg) return { success: false as const, error: 'Friendly game not found' }
  if (pg.status === 'final') return { success: false as const, error: 'Already simulated' }
  if (!['scheduled', 'accepted'].includes(pg.status)) {
    return { success: false as const, error: `Game is ${pg.status}, cannot simulate` }
  }

  const isNbaVsNba = pg.home_type === 'nba' && pg.away_type === 'nba'
  let homeScore = 0, awayScore = 0
  let homeBox: any[] = [], awayBox: any[] = [], pbp: any[] = [], periods: any[] = []
  let nbaPlayerIdsForInjury = new Set<string>()

  if (isNbaVsNba) {
    const [{ data: homeTeam }, { data: awayTeam }, { data: hp }, { data: ap }] = await Promise.all([
      supabaseAdmin.from('teams').select('*').eq('id', pg.home_team).single(),
      supabaseAdmin.from('teams').select('*').eq('id', pg.away_team).single(),
      supabaseAdmin.from('players').select('*').eq('team_id', pg.home_team).eq('status', 'active'),
      supabaseAdmin.from('players').select('*').eq('team_id', pg.away_team).eq('status', 'active'),
    ])
    if (!hp?.length || !ap?.length) {
      return { success: false as const, error: 'One of the teams has no active players' }
    }

    // Pre-season exists to let GMs test tactics/rotations — so a friendly
    // should actually respect each team's real Weekly Orders (Depth Chart,
    // Priorities, Pace, Attack/Defense Style, Double Team, Lockdown
    // Defender, Ball Role, Head Coach adjustments), same as a real game.
    let week = weekOverride
    if (week == null) {
      const { data: cfg } = await supabaseAdmin.from('season_config').select('current_week').eq('id', 1).single()
      week = (cfg?.current_week || 0) + 1
    }
    const [{ data: orders }, { data: headCoaches }] = await Promise.all([
      supabaseAdmin.from('gm_orders').select('*').eq('week_number', week).in('team_id', [pg.home_team, pg.away_team]),
      supabaseAdmin.from('coaches').select('team_id,off_adjustment,def_adjustment').eq('role', 'head_coach').in('team_id', [pg.home_team, pg.away_team]),
    ])
    const orderMap: Record<string, any> = {}
    ;(orders || []).forEach((o: any) => { orderMap[o.team_id] = o })
    ;(headCoaches || []).forEach((c: any) => {
      if (orderMap[c.team_id]) { orderMap[c.team_id].off_adjustment = c.off_adjustment; orderMap[c.team_id].def_adjustment = c.def_adjustment }
    })
    const hBallRoles = orderMap[pg.home_team]?.depth_chart?.ball_roles || {}
    const aBallRoles = orderMap[pg.away_team]?.depth_chart?.ball_roles || {}
    hp.forEach((p: any) => { p.ball_role = hBallRoles[p.name] })
    ap.forEach((p: any) => { p.ball_role = aBallRoles[p.name] })

    // A team with no submitted orders yet (e.g. a friendly played before
    // this week's Weekly Orders deadline) gets the same auto depth chart as
    // a GM-less team instead of everyone sitting at 0 mins.
    const hOrdBase = orderMap[pg.home_team] || { depth_chart: buildAutoDepthChart(hp) }
    const aOrdBase = orderMap[pg.away_team] || { depth_chart: buildAutoDepthChart(ap) }

    // Double Team / Lockdown Defender are set per opponent — look up the
    // assignment for this specific friendly's matchup, same as a real game.
    const htAssign = orderMap[pg.home_team]?.special_assignments?.[pg.away_team] || {}
    const atAssign = orderMap[pg.away_team]?.special_assignments?.[pg.home_team] || {}
    const hOrd = { ...hOrdBase, double_team_target: htAssign.double_team_target, lockdown_target: htAssign.lockdown_target, lockdown_defender: htAssign.lockdown_defender }
    const aOrd = { ...aOrdBase, double_team_target: atAssign.double_team_target, lockdown_target: atAssign.lockdown_target, lockdown_defender: atAssign.lockdown_defender }

    const result = simulateGame(homeTeam, awayTeam, hp, ap, hOrd, aOrd)
    homeScore = result.homeScore; awayScore = result.awayScore
    homeBox = result.homeBox; awayBox = result.awayBox; pbp = result.pbp; periods = result.periods
    nbaPlayerIdsForInjury = new Set([...hp, ...ap].map((p: any) => String(p.id)))
  } else {
    // One side is a "Rest of the World" team. These DO have a real roster
    // (players.world_team_id, nba_recruitable=false — see /world/[id] page)
    // with the same full attribute set as NBA players, just no GM/orders of
    // their own — build an auto depth chart the same way as a GM-less NBA
    // team and run the real engine both ways, instead of faking a score and
    // only statting the NBA side.
    const nbaSideIsHome = pg.home_type === 'nba'
    const nbaTeamId = nbaSideIsHome ? pg.home_team : pg.away_team
    const worldTeamId = nbaSideIsHome ? pg.away_team : pg.home_team

    let week = weekOverride
    if (week == null) {
      const { data: cfg } = await supabaseAdmin.from('season_config').select('current_week').eq('id', 1).single()
      week = (cfg?.current_week || 0) + 1
    }
    const [{ data: nbaTeam }, { data: worldTeam }, { data: nbaPlayers }, { data: worldPlayers }, { data: nbaOrders }, { data: nbaHeadCoach }] = await Promise.all([
      supabaseAdmin.from('teams').select('*').eq('id', nbaTeamId).single(),
      supabaseAdmin.from('world_teams').select('*').eq('id', worldTeamId).single(),
      supabaseAdmin.from('players').select('*').eq('team_id', nbaTeamId).eq('status', 'active'),
      supabaseAdmin.from('players').select('*').eq('world_team_id', worldTeamId).eq('nba_recruitable', false),
      supabaseAdmin.from('gm_orders').select('*').eq('week_number', week).eq('team_id', nbaTeamId).maybeSingle(),
      supabaseAdmin.from('coaches').select('off_adjustment,def_adjustment').eq('role', 'head_coach').eq('team_id', nbaTeamId).maybeSingle(),
    ])

    if (nbaPlayers?.length && worldPlayers?.length) {
      // A submitted GM order used to be thrown away here — the NBA side
      // always got the same GM-less auto depth chart as the World team, so
      // a real GM's Weekly Orders (rotation, pace, style, priorities) had
      // zero effect on these friendlies even when they existed. Now it's
      // used exactly like a real NBA-vs-NBA friendly does, falling back to
      // the auto depth chart only when no orders were submitted yet.
      const nbaOrd = nbaOrders
        ? { ...nbaOrders, off_adjustment: nbaHeadCoach?.off_adjustment, def_adjustment: nbaHeadCoach?.def_adjustment }
        : { depth_chart: buildAutoDepthChart(nbaPlayers) }
      const hBallRoles = nbaOrders?.depth_chart?.ball_roles || {}
      nbaPlayers.forEach((p: any) => { p.ball_role = hBallRoles[p.name] })
      const worldOrd = { depth_chart: buildAutoDepthChart(worldPlayers) }
      const homePlayers = nbaSideIsHome ? nbaPlayers : worldPlayers
      const awayPlayers = nbaSideIsHome ? worldPlayers : nbaPlayers
      const homeOrd = nbaSideIsHome ? nbaOrd : worldOrd
      const awayOrd = nbaSideIsHome ? worldOrd : nbaOrd
      const homeTeamObj = nbaSideIsHome ? nbaTeam : { id: worldTeam.id, name: worldTeam.name }
      const awayTeamObj = nbaSideIsHome ? { id: worldTeam.id, name: worldTeam.name } : nbaTeam

      const result = simulateGame(homeTeamObj, awayTeamObj, homePlayers, awayPlayers, homeOrd, awayOrd)
      homeScore = result.homeScore; awayScore = result.awayScore; periods = result.periods
      // box rows only carry player_id + stats — enrich with name/pos so the
      // World-team box score (which has no `games`/`players` join to fall
      // back on, see below) is self-contained for display.
      const nameMap: Record<string, { name: string, pos: string }> = {}
      ;[...homePlayers, ...awayPlayers].forEach((p: any) => { nameMap[p.id] = { name: p.name, pos: p.pos } })
      homeBox = result.homeBox.map((b: any) => ({ ...b, ...nameMap[b.player_id] }))
      awayBox = result.awayBox.map((b: any) => ({ ...b, ...nameMap[b.player_id] }))
      nbaPlayerIdsForInjury = new Set(nbaPlayers.map((p: any) => String(p.id)))
    }
  }

  await applyFriendlyFatigueAndInjury([...homeBox, ...awayBox], nbaPlayerIdsForInjury)

  // games.home_team/away_team have a hard foreign key to teams.id only — a
  // "Rest of the World" team id (e.g. Red Star Belgrade = CZV) would violate
  // that constraint. So a real `games` row (and its box score page) only
  // gets created for NBA-vs-NBA friendlies; World-team friendlies just get
  // their result recorded directly on the preseason_games row.
  let gameId: string | null = null

  if (isNbaVsNba) {
    const { count } = await supabaseAdmin.from('games').select('*', { count: 'exact', head: true }).eq('week_number', 0)

    const { data: gameRec } = await supabaseAdmin.from('games').insert({
      week_number: 0, game_number: (count || 0) + 1,
      home_team: pg.home_team, away_team: pg.away_team,
      home_score: homeScore, away_score: awayScore,
      status: 'final', played_at: new Date().toISOString(),
      // The friendly's own real-world scheduled_date (e.g. Oct 2 2025) — not
      // set previously, so the Schedule page fell back to grouping this row
      // by played_at (the actual real-world moment someone clicked Simulate),
      // showing the same game a second time under whatever month that
      // happened to be in.
      scheduled_date: pg.scheduled_date,
      game_type: 'preseason',
      period_scores: periods,
    }).select().single()
    if (!gameRec) return { success: false as const, error: 'Failed to create game record' }
    gameId = gameRec.id

    if (homeBox.length || awayBox.length) {
      await supabaseAdmin.from('box_scores').insert([
        ...homeBox.map((b: any) => ({ ...b, game_id: gameId, team_id: pg.home_team, is_triple_double: [b.pts || 0, b.reb || 0, b.ast || 0, b.stl || 0, b.blk || 0].filter((v: number) => v >= 10).length >= 3 })),
        ...awayBox.map((b: any) => ({ ...b, game_id: gameId, team_id: pg.away_team, is_triple_double: [b.pts || 0, b.reb || 0, b.ast || 0, b.stl || 0, b.blk || 0].filter((v: number) => v >= 10).length >= 3 })),
      ])
    }
    if (pbp.length > 0) {
      await supabaseAdmin.from('play_by_play').insert(pbp.map((p: any) => ({ ...p, game_id: gameId })))
    }
  }

  // World-team friendlies never get a `games` row (see the comment above), so
  // the real box score for both sides has nowhere else to live — persist it
  // right here instead of just computing and discarding it.
  const worldGameBox = !isNbaVsNba && (homeBox.length || awayBox.length)
    ? { home: homeBox, away: awayBox } : null

  await supabaseAdmin.from('preseason_games').update({
    home_score: homeScore, away_score: awayScore, status: 'final', game_id: gameId,
    period_scores: periods,
    ...(worldGameBox ? { box_score: worldGameBox } : {}),
  }).eq('id', id)

  return { success: true as const, home_score: homeScore, away_score: awayScore, game_id: gameId }
}

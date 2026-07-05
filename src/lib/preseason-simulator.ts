import { supabaseAdmin } from '@/lib/supabase'
import { simulateGame } from '@/lib/game-simulator'

// Resolves a single scheduled friendly/pre-season game (a preseason_games row) —
// NBA vs NBA, or NBA vs a "Rest of the World" team. Produces an isolated
// result + box score only: never touches team wins/losses, elo, or
// player_stats — friendly games don't count toward anything.
// Shared by /api/admin/simulate-preseason (single-game button) and
// /api/cron/simulate (bulk "Simulate Week" — resolves every pending friendly
// alongside the week's real games, so the commissioner doesn't have to click
// each friendly one by one).
function rnd(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a }

export async function simulatePreseasonGame(id: string) {
  const { data: pg } = await supabaseAdmin.from('preseason_games').select('*').eq('id', id).single()
  if (!pg) return { success: false as const, error: 'Friendly game not found' }
  if (pg.status === 'final') return { success: false as const, error: 'Already simulated' }
  if (!['scheduled', 'accepted'].includes(pg.status)) {
    return { success: false as const, error: `Game is ${pg.status}, cannot simulate` }
  }

  const isNbaVsNba = pg.home_type === 'nba' && pg.away_type === 'nba'
  let homeScore = 0, awayScore = 0
  let homeBox: any[] = [], awayBox: any[] = [], pbp: any[] = []

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
    const { data: cfg } = await supabaseAdmin.from('season_config').select('current_week').eq('id', 1).single()
    const week = (cfg?.current_week || 0) + 1
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

    // Double Team / Lockdown Defender are set per opponent — look up the
    // assignment for this specific friendly's matchup, same as a real game.
    const htAssign = orderMap[pg.home_team]?.special_assignments?.[pg.away_team] || {}
    const atAssign = orderMap[pg.away_team]?.special_assignments?.[pg.home_team] || {}
    const hOrd = orderMap[pg.home_team] ? { ...orderMap[pg.home_team], double_team_target: htAssign.double_team_target, lockdown_target: htAssign.lockdown_target, lockdown_defender: htAssign.lockdown_defender } : undefined
    const aOrd = orderMap[pg.away_team] ? { ...orderMap[pg.away_team], double_team_target: atAssign.double_team_target, lockdown_target: atAssign.lockdown_target, lockdown_defender: atAssign.lockdown_defender } : undefined

    const result = simulateGame(homeTeam, awayTeam, hp, ap, hOrd, aOrd)
    homeScore = result.homeScore; awayScore = result.awayScore
    homeBox = result.homeBox; awayBox = result.awayBox; pbp = result.pbp

    // Light fatigue + injury pass for players who actually played — same
    // spirit as the weekly simulator's injury system, simplified since
    // there's no weekly training-order/pace context for a single friendly.
    const allBox = [...homeBox, ...awayBox]
    if (allBox.length) {
      const playerIds = allBox.map(b => b.player_id)
      const [{ data: injTypes }, { data: playersInfo }] = await Promise.all([
        supabaseAdmin.from('injury_types').select('*'),
        supabaseAdmin.from('players').select('id,health,moral,durability').in('id', playerIds),
      ])
      const pMap: Record<string, any> = {}
      ;(playersInfo || []).forEach((p: any) => { pMap[p.id] = p })
      const SWEIGHTS: Record<string, number> = { minor: 40, moderate: 25, serious: 15, severe: 8, career_threatening: 2 }

      for (const box of allBox) {
        const p = pMap[box.player_id]
        if (!p) continue
        const healthLoss = (box.mins || 0) / 12
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
        } else {
          await supabaseAdmin.from('players').update({ health: newHealth }).eq('id', p.id)
        }
      }
    }
  } else {
    // One side is a "Rest of the World" team with no player roster of its own —
    // simplified score, and a box score only for the NBA side's top players.
    const base = 100 + Math.round(Math.random() * 20)
    const homeAdv = 3
    homeScore = base + homeAdv + Math.round(Math.random() * 15)
    awayScore = base - homeAdv + Math.round(Math.random() * 15)

    const nbaSideIsHome = pg.home_type === 'nba'
    const nbaTeamId = nbaSideIsHome ? pg.home_team : pg.away_team
    const { data: nbaPlayers } = await supabaseAdmin.from('players').select('*').eq('team_id', nbaTeamId).eq('status', 'active')
    if (nbaPlayers?.length) {
      const nbaScore = nbaSideIsHome ? homeScore : awayScore
      const sorted = [...nbaPlayers].sort((a: any, b: any) => (b.usage || 0) - (a.usage || 0)).slice(0, 9)
      const weights = sorted.map((p: any) => p.usage || 50)
      const totalW = weights.reduce((s, w) => s + w, 0) || 1
      let remaining = nbaScore
      const box = sorted.map((p: any, i: number) => {
        const share = i === sorted.length - 1 ? Math.max(0, remaining) : Math.round(nbaScore * (weights[i] / totalW))
        remaining -= share
        const offReb = rnd(1, 4), defReb = rnd(1, 5)
        return {
          player_id: p.id, mins: Math.max(8, Math.round(28 - i * 2)), is_starter: i < 5,
          pts: Math.max(0, share), reb: offReb + defReb, off_reb: offReb, def_reb: defReb,
          ast: rnd(1, 6), stl: rnd(0, 2), blk: rnd(0, 1),
          fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, pf: 0, turnovers: rnd(0, 2), plus_minus: 0,
        }
      })
      if (nbaSideIsHome) homeBox = box; else awayBox = box
    }
  }

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
      game_type: 'preseason',
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

  await supabaseAdmin.from('preseason_games').update({
    home_score: homeScore, away_score: awayScore, status: 'final', game_id: gameId,
  }).eq('id', id)

  return { success: true as const, home_score: homeScore, away_score: awayScore, game_id: gameId }
}

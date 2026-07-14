import { supabaseAdmin } from '@/lib/supabase'
import { simulateGame } from '@/lib/game-simulator'
import { notify } from '@/lib/notifications'
import { getTeamLang, notifInjury } from '@/lib/notifications-helpers'
import { computeGameAttendance } from '@/lib/audience-segments'
import { rateRefereePerformance } from '@/lib/referees'
import { getWeekForDate } from '@/lib/season-week-helper'
import { buildAutoDepthChart } from '@/lib/auto-depth-chart'

// Resolves a single scheduled friendly/pre-season game (a preseason_games row) —
// NBA vs NBA, or NBA vs a "Rest of the World" team. Produces an isolated
// result + box score only: never touches team wins/losses, elo, or
// player_stats — friendly games don't count toward anything.
// Shared by /api/admin/simulate-preseason (single-game button) and
// /api/cron/simulate (bulk "Simulate Week" — resolves every pending friendly
// alongside the week's real games, so the commissioner doesn't have to click
// each friendly one by one).

// Light fatigue + injury pass for real NBA players who actually played —
// same spirit as the weekly simulator's injury system, simplified since
// there's no weekly training-order/pace context for a single friendly. Only
// ever applied to real NBA player ids — a World team's roster is flavor
// opposition with no persistent team in this league, so there's nothing to
// track health/injuries against for them.
async function applyFriendlyFatigueAndInjury(box: any[], nbaPlayerIds: Set<string>, gameId: string | null) {
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
      const { error: injErr } = await supabaseAdmin.from('injury_log').insert({
        player_id: p.id, season: '2025-26',
        injury_type: chosen.name, injury_category: chosen.category,
        body_part: chosen.body_part, severity: chosen.severity, notes: chosen.notes,
        occurred_in: 'preseason_game', game_id: gameId, health_at_injury: newHealth,
        health_impact: hImpact, moral_impact: chosen.moral_impact || 0,
        days_out: daysOut, games_out: gamesOut,
        is_recurring: false, can_play: newHealth >= 50,
        play_risk: newHealth < 65 ? 75 : newHealth < 75 ? 40 : 15, status: 'active',
      })
      if (injErr) console.warn('injury_log insert (friendly) failed:', injErr.message)
      const injHealth = Math.max(0, newHealth - hImpact)
      await supabaseAdmin.from('players').update({
        health: injHealth, moral: Math.max(0, (p.moral ?? 80) - (chosen.moral_impact || 0)),
        status: injHealth < 50 ? 'injured' : 'active',
        injury_type: chosen.name,
      }).eq('id', p.id)

      // Real-game injuries notify the GM (notifications.ts) but friendlies
      // previously didn't — a player could get hurt in a pre-season game
      // with no message ever reaching the GM's inbox. The base notifInjury()
      // text only ever said "in a friendly game" with no way to tell WHICH
      // one — body_part/notes give real detail on the injury itself, and
      // metadata.game_id (once gameId exists, i.e. an NBA-vs-NBA friendly)
      // makes inbox.tsx's existing generic "View Box Score →" button appear
      // so the GM can see the exact opponent/date/score.
      if (p.team_id) {
        try {
          const lang = await getTeamLang(p.team_id)
          const notif = notifInjury(lang, p.name, chosen.name, gamesOut, 'preseason_game')
          const detailLine = lang === 'pt'
            ? `\n\nZona afetada: ${chosen.body_part}${chosen.notes ? `\n${chosen.notes}` : ''}`
            : `\n\nBody part: ${chosen.body_part}${chosen.notes ? `\n${chosen.notes}` : ''}`
          await notify(p.team_id, 'injury', notif.subject, `${notif.body}${detailLine}`, {
            player_id: p.id, injury_type: chosen.name, severity: chosen.severity,
            games_out: gamesOut, occurred_in: 'preseason_game', game_id: gameId,
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
async function computeFriendlyGameMeta(homeTeam: any, awayTeam: any, homeBox: any[], awayBox: any[]) {
  const [{ data: ticketConfig }, { data: referees }] = await Promise.all([
    supabaseAdmin.from('franchise_config').select('ticket_lower,ticket_upper,ticket_courtside').eq('team_id', homeTeam.id).maybeSingle(),
    supabaseAdmin.from('referees').select('id'),
  ])
  const isRivalry = homeTeam.rival_team_id === awayTeam.id || awayTeam.rival_team_id === homeTeam.id
  const attendanceResult = computeGameAttendance({
    teamId: homeTeam.id, popularity: homeTeam.popularity ?? 50,
    capacity: homeTeam.arena_capacity || 18000,
    winPct: (homeTeam.wins || 0) / Math.max(1, (homeTeam.wins || 0) + (homeTeam.losses || 0)),
    isRivalry, isMarquee: false,
    prices: {
      lower: ticketConfig?.ticket_lower ?? 80, upper: ticketConfig?.ticket_upper ?? 45,
      courtside: ticketConfig?.ticket_courtside ?? 500,
    },
    randomJitter: Math.random() * 0.06 - 0.03,
    followers: homeTeam.social_media_followers,
  })
  const refIds = (referees || []).map((r: any) => r.id as string)
  const refereeId = refIds.length ? refIds[Math.floor(Math.random() * refIds.length)] : null
  const refereeRating = refereeId ? rateRefereePerformance(homeBox, awayBox, isRivalry, false) : null
  return { attendance: attendanceResult.attendance, isRivalry, refereeId, refereeRating }
}

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
  // A friendly never had a real referee or attendance figure — attendance
  // stayed 0 and referee_id stayed null forever, so the box score's
  // scoreboard header silently showed neither, unlike every real game.
  // Same real formulas as a regular-season game (audience-segments.ts,
  // rateRefereePerformance), just without any of the financial side effects
  // (ticket/concession revenue, referee meritocracy assignment) real games
  // carry — this is display-only, matching this file's existing "isolated
  // result, never touches revenue/standings" contract for friendlies.
  let friendlyGameMeta: { attendance: number, isRivalry: boolean, refereeId: string | null, refereeRating: number | null } | null = null

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
    // The Weekly Orders that apply are whichever week the friendly's own
    // scheduled_date actually falls into — NOT "whatever week the season
    // sim happens to be sitting at right now." Friendlies get scheduled
    // across the whole pre-season window well ahead of time, so by the
    // time one gets resolved, current_week can easily be a week (or more)
    // behind the friendly's real calendar date, silently pulling an
    // earlier, possibly-incomplete week's orders instead of the ones the
    // GM actually set for that date.
    let week = weekOverride ?? (pg.scheduled_date ? getWeekForDate(pg.scheduled_date) : null)
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
    friendlyGameMeta = await computeFriendlyGameMeta(homeTeam, awayTeam, result.homeBox, result.awayBox)
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

    let week = weekOverride ?? (pg.scheduled_date ? getWeekForDate(pg.scheduled_date) : null)
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
      attendance: friendlyGameMeta?.attendance ?? 0,
      is_rivalry: friendlyGameMeta?.isRivalry ?? false,
      referee_id: friendlyGameMeta?.refereeId ?? null,
      referee_rating: friendlyGameMeta?.refereeRating ?? null,
    }).select().single()
    if (!gameRec) return { success: false as const, error: 'Failed to create game record' }
    gameId = gameRec.id

    if (homeBox.length || awayBox.length) {
      const { error: boxErr } = await supabaseAdmin.from('box_scores').insert([
        ...homeBox.map((b: any) => { const dc = [b.pts || 0, b.reb || 0, b.ast || 0, b.stl || 0, b.blk || 0].filter((v: number) => v >= 10).length; return { ...b, game_id: gameId, team_id: pg.home_team, is_double_double: dc >= 2, is_triple_double: dc >= 3 } }),
        ...awayBox.map((b: any) => { const dc = [b.pts || 0, b.reb || 0, b.ast || 0, b.stl || 0, b.blk || 0].filter((v: number) => v >= 10).length; return { ...b, game_id: gameId, team_id: pg.away_team, is_double_double: dc >= 2, is_triple_double: dc >= 3 } }),
      ])
      if (boxErr) console.warn(`box_scores insert failed for friendly game ${gameId}:`, boxErr.message)
    }
    if (pbp.length > 0) {
      await supabaseAdmin.from('play_by_play').insert(pbp.map((p: any) => ({ ...p, game_id: gameId })))
    }
  }

  // Runs after gameId is resolved (moved from right after simulateGame())
  // so a real injury can actually be attributed to this exact game — it
  // used to run before gameId existed, so the injury notification's "which
  // game" link had nothing to point at.
  await applyFriendlyFatigueAndInjury([...homeBox, ...awayBox], nbaPlayerIdsForInjury, gameId)

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

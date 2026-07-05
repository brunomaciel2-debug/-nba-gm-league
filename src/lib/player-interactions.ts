import { supabaseAdmin } from '@/lib/supabase'
import { getTeamLang } from '@/lib/notifications-helpers'
import { notify } from '@/lib/notifications'
import { notifPlayerDiscontent, notifInteractionResolved } from '@/lib/notifications-helpers'
import { MORAL_DISCONTENT_THRESHOLD, WEEKLY_TRIGGER_CHANCE, IMMEDIATE_AUTO_EXPIRE_WEEKS, buildComplaintText, buildResolutionText } from '@/lib/interaction-constants'
import { isSpecialistEligible } from '@/lib/injury-constants'

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const it of items) { r -= it.weight; if (r <= 0) return it }
  return items[items.length - 1]
}

// Minutes/starter history for a player across a week range, from real box_scores.
async function getRecentBoxStats(playerId: number, fromWeek: number, toWeek: number) {
  const { data: games } = await supabaseAdmin.from('games').select('id').gte('week_number', fromWeek).lte('week_number', toWeek).eq('status', 'final')
  const gameIds = (games || []).map((g: any) => g.id)
  if (!gameIds.length) return { avgMins: 0, starterRate: 0, gamesPlayed: 0 }
  const { data: boxes } = await supabaseAdmin.from('box_scores').select('mins,is_starter').eq('player_id', playerId).in('game_id', gameIds)
  if (!boxes || !boxes.length) return { avgMins: 0, starterRate: 0, gamesPlayed: 0 }
  const avgMins = boxes.reduce((s: number, b: any) => s + (b.mins || 0), 0) / boxes.length
  const starterRate = boxes.filter((b: any) => b.is_starter).length / boxes.length * 100
  return { avgMins: Math.round(avgMins * 10) / 10, starterRate: Math.round(starterRate), gamesPlayed: boxes.length }
}

// Was a condition true in gm_orders across the week range at least once ("atLeastOnce")
// or in every week ("everyWeek")? Used for priority list / clutch / lockdown / rest / three_rate.
async function getOrdersInRange(teamId: string, fromWeek: number, toWeek: number) {
  const { data } = await supabaseAdmin.from('gm_orders').select('*').eq('team_id', teamId).gte('week_number', fromWeek).lte('week_number', toWeek)
  return data || []
}

interface ReasonCandidate {
  reasonKey: string
  weight: number
  demandTarget: number | null
  baselineValue: number | null
  partnerPlayerId: number | null
}

// Builds the list of reasons this specific player is actually eligible to raise
// right now, each with its computed demand — nothing generic, nothing a player
// wouldn't credibly say given his real situation.
async function evaluateEligibleReasons(player: any, teamId: string, week: number, types: any[]): Promise<ReasonCandidate[]> {
  const byKey: Record<string, any> = {}
  types.forEach((t: any) => { byKey[t.reason_key] = t })
  const out: ReasonCandidate[] = []
  const w = (k: string) => byKey[k]?.weight || 5

  const recentFrom = Math.max(1, week - 2)
  const { avgMins, starterRate } = await getRecentBoxStats(player.id, recentFrom, week - 1)
  const recentOrders = await getOrdersInRange(teamId, recentFrom, week - 1)
  const currentOrder = recentOrders[recentOrders.length - 1] || {}

  const isListed = (o: any) => [o.priority_1, o.priority_2, o.priority_3].includes(player.name)
  const isClutch = (o: any) => o.clutch_player === player.name
  const isLockdown = (o: any) => Object.values(o.special_assignments || {}).some((a: any) => a?.lockdown_defender === player.name)

  if (avgMins > 0 && avgMins < 28) {
    out.push({ reasonKey: 'wants_more_minutes', weight: w('wants_more_minutes'), demandTarget: Math.min(36, Math.round(avgMins + 8)), baselineValue: avgMins, partnerPlayerId: null })
  }
  if ((player.usage || 0) >= 55 && starterRate < 50) {
    out.push({ reasonKey: 'wants_starter_role', weight: w('wants_starter_role'), demandTarget: 60, baselineValue: starterRate, partnerPlayerId: null })
  }
  if ((player.usage || 0) >= 55 && !recentOrders.some(isListed)) {
    out.push({ reasonKey: 'wants_more_touches', weight: w('wants_more_touches'), demandTarget: 100, baselineValue: 0, partnerPlayerId: null })
  }
  if ((player.pressure || 0) >= 60 && !recentOrders.some(isClutch)) {
    out.push({ reasonKey: 'wants_clutch_role', weight: w('wants_clutch_role'), demandTarget: 100, baselineValue: 0, partnerPlayerId: null })
  }
  if (((player.idef || 0) + (player.pdef || 0)) / 2 >= 60 && !recentOrders.some(isLockdown)) {
    out.push({ reasonKey: 'wants_lockdown_role', weight: w('wants_lockdown_role'), demandTarget: 50, baselineValue: 0, partnerPlayerId: null })
  }
  if (((player.durability || 75) < 70 || (player.stamina || 75) < 70) && (currentOrder.pace > 80 || ['intense', 'very_intense'].includes(currentOrder.training_intensity))) {
    out.push({ reasonKey: 'wants_more_rest', weight: w('wants_more_rest'), demandTarget: 50, baselineValue: 0, partnerPlayerId: null })
  }
  if ((player.three || 0) >= 70 && (currentOrder.three_rate ?? 38) < 35) {
    out.push({ reasonKey: 'wants_more_three_rate', weight: w('wants_more_three_rate'), demandTarget: 50, baselineValue: currentOrder.three_rate ?? 38, partnerPlayerId: null })
  }

  const { data: teammates } = await supabaseAdmin.from('players').select('id,name,age,real_ovr,salary').eq('team_id', teamId).eq('status', 'active').neq('id', player.id)
  if (teammates && teammates.length) {
    const partner = teammates[Math.floor(Math.random() * teammates.length)]
    // Monitored, not a free immediate click: checks whether the two actually
    // started together in real games during the window (box_scores), same
    // verification discipline as every other monitored reason.
    out.push({ reasonKey: 'wants_to_play_with_teammate', weight: w('wants_to_play_with_teammate'), demandTarget: 50, baselineValue: 0, partnerPlayerId: partner.id })
    out.push({ reasonKey: 'conflict_with_teammate', weight: w('conflict_with_teammate'), demandTarget: null, baselineValue: null, partnerPlayerId: partner.id })

    if ((player.age || 25) <= 23 && !teammates.some((t: any) => (t.age || 0) >= 30)) {
      out.push({ reasonKey: 'wants_veteran_mentor', weight: w('wants_veteran_mentor'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
    }
    // Only eligible when he could ACTUALLY receive a new deal under the real
    // extension rule (contracts/extend/route.ts: contract_years <= 2) — a
    // player buried under 3+ years left has no real remedy the GM can offer,
    // so this complaint would otherwise ask for something impossible.
    const similarOvrTeammate = teammates.find((t: any) => Math.abs((t.real_ovr || 0) - (player.real_ovr || 0)) <= 3 && (t.salary || 0) >= (player.salary || 1) * 1.4)
    if (similarOvrTeammate && (player.contract_years || 0) <= 2) {
      out.push({ reasonKey: 'feels_underpaid', weight: w('feels_underpaid'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
    }
  }

  const { data: team } = await supabaseAdmin.from('teams').select('wins,losses').eq('id', teamId).single()
  const gamesPlayed = (team?.wins || 0) + (team?.losses || 0)
  const winPct = gamesPlayed > 0 ? (team?.wins || 0) / gamesPlayed : 0.5
  if (gamesPlayed >= 5 && winPct < 0.35) {
    out.push({ reasonKey: 'unhappy_with_team_record', weight: w('unhappy_with_team_record'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
  }
  if (gamesPlayed >= 5 && winPct < 0.45) {
    out.push({ reasonKey: 'wants_front_office_aggression', weight: w('wants_front_office_aggression'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
  }
  if ((player.age || 25) >= 28 && (player.nba_experience || 0) >= 6) {
    out.push({ reasonKey: 'wants_leadership_recognition', weight: w('wants_leadership_recognition'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
  }
  // Must match the real extension rule exactly (contracts/extend/route.ts:
  // ELIGIBLE_YEARS_LEFT = 2) — otherwise this complaint could fire for a
  // player the GM has no actual way to extend yet.
  if ((player.contract_years || 0) <= 2) {
    out.push({ reasonKey: 'wants_contract_extension_talks', weight: w('wants_contract_extension_talks'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
  }
  if ((player.age || 25) <= 24) {
    out.push({ reasonKey: 'feels_development_neglected', weight: w('feels_development_neglected'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
  }
  const { data: openInjury } = await supabaseAdmin.from('injury_log').select('severity,specialist_used').eq('player_id', player.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1)
  if (openInjury?.[0] && !openInjury[0].specialist_used && isSpecialistEligible(openInjury[0].severity)) {
    out.push({ reasonKey: 'wants_specialist_for_injury', weight: w('wants_specialist_for_injury'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
  }
  out.push({ reasonKey: 'homesickness_family', weight: w('homesickness_family'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
  out.push({ reasonKey: 'media_pressure_stress', weight: w('media_pressure_stress'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
  out.push({ reasonKey: 'personal_crisis', weight: w('personal_crisis'), demandTarget: null, baselineValue: null, partnerPlayerId: null })
  out.push({ reasonKey: 'general_frustration', weight: w('general_frustration'), demandTarget: null, baselineValue: null, partnerPlayerId: null })

  return out
}

export async function checkForNewInteractions(week: number) {
  const { data: types } = await supabaseAdmin.from('player_interaction_types').select('*')
  if (!types || !types.length) return { created: 0 }
  const byKey: Record<string, any> = {}
  types.forEach((t: any) => { byKey[t.reason_key] = t })

  const { data: unhappyPlayers } = await supabaseAdmin.from('players').select('*').eq('status', 'active').not('team_id', 'is', null).lt('moral', MORAL_DISCONTENT_THRESHOLD)
  if (!unhappyPlayers?.length) return { created: 0 }

  const { data: openInteractions } = await supabaseAdmin.from('player_interactions').select('player_id').in('status', ['pending_response', 'monitoring'])
  const openPlayerIds = new Set((openInteractions || []).map((i: any) => i.player_id))

  let created = 0
  for (const player of unhappyPlayers) {
    if (openPlayerIds.has(player.id)) continue
    if (Math.random() >= WEEKLY_TRIGGER_CHANCE) continue

    const candidates = await evaluateEligibleReasons(player, player.team_id, week, types)
    if (!candidates.length) continue
    const chosen = weightedPick(candidates)
    const type = byKey[chosen.reasonKey]
    if (!type) continue

    const isMonitored = type.resolution_type === 'monitored'
    const { data: partner } = chosen.partnerPlayerId ? await supabaseAdmin.from('players').select('name').eq('id', chosen.partnerPlayerId).single() : { data: null }

    const { data: inserted } = await supabaseAdmin.from('player_interactions').insert({
      player_id: player.id, team_id: player.team_id, season: '2025-26', reason_key: chosen.reasonKey,
      status: isMonitored ? 'monitoring' : 'pending_response',
      created_week: week,
      deadline_week: isMonitored ? week + (type.monitor_weeks || 2) : week + IMMEDIATE_AUTO_EXPIRE_WEEKS,
      demand_target: chosen.demandTarget, baseline_value: chosen.baselineValue, current_progress: chosen.baselineValue,
      partner_player_id: chosen.partnerPlayerId, moral_before: player.moral,
    }).select().single()
    if (!inserted) continue
    created++

    const lang = await getTeamLang(player.team_id)
    const complaint = buildComplaintText(chosen.reasonKey, lang, {
      playerName: player.name, demandTarget: chosen.demandTarget ?? undefined, baselineValue: chosen.baselineValue ?? undefined,
      partnerName: partner?.name, deadlineWeek: inserted.deadline_week,
    })
    const notif = notifPlayerDiscontent(lang, player.name, complaint)
    await notify(player.team_id, 'player_interaction', notif.subject, notif.body, { interaction_id: inserted.id, player_id: player.id })
  }
  return { created }
}

// Recomputes current_progress for every open monitored interaction, so the
// Interactions tab always shows a fresh number without its own live query.
export async function refreshMonitoredProgress(week: number) {
  const { data: monitoring } = await supabaseAdmin.from('player_interactions').select('*').eq('status', 'monitoring').lt('deadline_week', week + 1)
  for (const inter of (monitoring || [])) {
    const value = await computeMonitorValue(inter.reason_key, inter.team_id, inter.player_id, inter.created_week, Math.min(week, inter.deadline_week), inter.partner_player_id)
    await supabaseAdmin.from('player_interactions').update({ current_progress: value, updated_at: new Date().toISOString() }).eq('id', inter.id)
  }
}

async function computeMonitorValue(reasonKey: string, teamId: string, playerId: number, fromWeek: number, toWeek: number, partnerPlayerId?: number | null): Promise<number> {
  const { data: player } = await supabaseAdmin.from('players').select('name').eq('id', playerId).single()
  const name = player?.name
  switch (reasonKey) {
    case 'wants_to_play_with_teammate': {
      if (!partnerPlayerId) return 0
      const { data: games } = await supabaseAdmin.from('games').select('id').gte('week_number', fromWeek).lte('week_number', toWeek).eq('status', 'final')
      const gameIds = (games || []).map((g: any) => g.id)
      if (!gameIds.length) return 0
      const [{ data: mine }, { data: theirs }] = await Promise.all([
        supabaseAdmin.from('box_scores').select('game_id,is_starter').eq('player_id', playerId).in('game_id', gameIds),
        supabaseAdmin.from('box_scores').select('game_id,is_starter').eq('player_id', partnerPlayerId).in('game_id', gameIds),
      ])
      if (!mine?.length) return 0
      const theirStartsByGame = new Set((theirs || []).filter((b: any) => b.is_starter).map((b: any) => b.game_id))
      const sharedStarts = mine.filter((b: any) => b.is_starter && theirStartsByGame.has(b.game_id)).length
      return Math.round(sharedStarts / mine.length * 100)
    }
    case 'wants_more_minutes': {
      const { avgMins } = await getRecentBoxStats(playerId, fromWeek, toWeek)
      return avgMins
    }
    case 'wants_starter_role': {
      const { starterRate } = await getRecentBoxStats(playerId, fromWeek, toWeek)
      return starterRate
    }
    case 'wants_more_touches': {
      const orders = await getOrdersInRange(teamId, fromWeek, toWeek)
      const weeksListed = orders.filter((o: any) => [o.priority_1, o.priority_2, o.priority_3].includes(name)).length
      return orders.length ? Math.round(weeksListed / orders.length * 100) : 0
    }
    case 'wants_clutch_role': {
      const orders = await getOrdersInRange(teamId, fromWeek, toWeek)
      const weeksClutch = orders.filter((o: any) => o.clutch_player === name).length
      return orders.length ? Math.round(weeksClutch / orders.length * 100) : 0
    }
    case 'wants_lockdown_role': {
      const orders = await getOrdersInRange(teamId, fromWeek, toWeek)
      const weeksLockdown = orders.filter((o: any) => Object.values(o.special_assignments || {}).some((a: any) => a?.lockdown_defender === name)).length
      return orders.length ? Math.round(weeksLockdown / orders.length * 100) : 0
    }
    case 'wants_more_rest': {
      const orders = await getOrdersInRange(teamId, fromWeek, toWeek)
      const weeksLighter = orders.filter((o: any) => ['rest', 'light'].includes(o.training_intensity) || (o.pace || 70) <= 65).length
      return orders.length ? Math.round(weeksLighter / orders.length * 100) : 0
    }
    case 'wants_more_three_rate': {
      const orders = await getOrdersInRange(teamId, fromWeek, toWeek)
      const weeksRaised = orders.filter((o: any) => (o.three_rate || 38) >= 45).length
      return orders.length ? Math.round(weeksRaised / orders.length * 100) : 0
    }
    default:
      return 0
  }
}

// player_interactions has no declared foreign key to players (raw CREATE
// TABLE, no REFERENCES) so PostgREST can't do an embedded players!inner(...)
// join — it 400s. Batch-fetch players separately instead, same pattern
// used everywhere else in this codebase for cross-table reads.
async function loadPlayersByIds(ids: number[]): Promise<Record<number, any>> {
  if (!ids.length) return {}
  const { data } = await supabaseAdmin.from('players').select('id,name,moral,team_id').in('id', Array.from(new Set(ids)))
  const map: Record<number, any> = {}
  ;(data || []).forEach((p: any) => { map[p.id] = p })
  return map
}

export async function resolveMonitoredInteractions(week: number) {
  const { data: due } = await supabaseAdmin.from('player_interactions').select('*').eq('status', 'monitoring').lte('deadline_week', week)
  const duePlayers = await loadPlayersByIds((due || []).map((i: any) => i.player_id))

  for (const inter of (due || [])) {
    const player = duePlayers[inter.player_id]
    const value = await computeMonitorValue(inter.reason_key, inter.team_id, inter.player_id, inter.created_week, inter.deadline_week, inter.partner_player_id)
    const target = inter.demand_target || 1
    const pct = (value / target) * 100
    const outcome = pct >= 100 ? 'met' : pct >= 50 ? 'partial' : 'ignored'

    const { data: type } = await supabaseAdmin.from('player_interaction_types').select('*').eq('reason_key', inter.reason_key).single()
    const delta = outcome === 'met' ? (type?.moral_met ?? 20) : outcome === 'partial' ? (type?.moral_partial ?? 5) : (type?.moral_ignored ?? -15)

    const currentMoral = player?.moral ?? 80
    const newMoral = Math.max(0, Math.min(100, currentMoral + delta))
    await supabaseAdmin.from('players').update({ moral: newMoral }).eq('id', inter.player_id)

    // Pairing-type interactions (e.g. wants_to_play_with_teammate) genuinely
    // benefit both players when the pairing actually happened for real —
    // the partner wasn't the one complaining, so only the upside carries
    // over to him, never the penalty for a request he didn't make.
    if (inter.partner_player_id && outcome === 'met') {
      const { data: partnerPlayer } = await supabaseAdmin.from('players').select('moral').eq('id', inter.partner_player_id).single()
      if (partnerPlayer) {
        const partnerNewMoral = Math.max(0, Math.min(100, (partnerPlayer.moral || 80) + delta))
        await supabaseAdmin.from('players').update({ moral: partnerNewMoral }).eq('id', inter.partner_player_id)
      }
    }

    await supabaseAdmin.from('player_interactions').update({
      status: 'resolved', outcome, current_progress: value, moral_after: newMoral, resolved_week: week, updated_at: new Date().toISOString(),
    }).eq('id', inter.id)

    const playerName = player?.name || 'Player'
    const lang = await getTeamLang(inter.team_id)
    const resolutionText = buildResolutionText(lang, playerName, outcome, delta, inter.reason_key)
    const notif = notifInteractionResolved(lang, playerName, resolutionText)
    await notify(inter.team_id, 'player_interaction', notif.subject, notif.body, { interaction_id: inter.id, player_id: inter.player_id })
  }

  // Immediate-type interactions the GM never answered — auto-resolve as Dismiss
  // rather than leave them stuck open forever.
  const { data: expired } = await supabaseAdmin.from('player_interactions').select('*').eq('status', 'pending_response').lte('deadline_week', week)
  const expiredPlayers = await loadPlayersByIds((expired || []).map((i: any) => i.player_id))

  for (const inter of (expired || [])) {
    const player = expiredPlayers[inter.player_id]
    const { data: type } = await supabaseAdmin.from('player_interaction_types').select('*').eq('reason_key', inter.reason_key).single()
    const delta = type?.moral_dismiss ?? -12
    const currentMoral = player?.moral ?? 80
    const newMoral = Math.max(0, Math.min(100, currentMoral + delta))
    await supabaseAdmin.from('players').update({ moral: newMoral }).eq('id', inter.player_id)
    await supabaseAdmin.from('player_interactions').update({
      status: 'resolved', outcome: 'dismiss', response_choice: 'dismiss', moral_after: newMoral, resolved_week: week, updated_at: new Date().toISOString(),
    }).eq('id', inter.id)
    const playerName = player?.name || 'Player'
    const lang = await getTeamLang(inter.team_id)
    const resolutionText = buildResolutionText(lang, playerName, 'dismiss', delta, inter.reason_key)
    const notif = notifInteractionResolved(lang, playerName, resolutionText)
    await notify(inter.team_id, 'player_interaction', notif.subject, notif.body, { interaction_id: inter.id, player_id: inter.player_id })
  }
}

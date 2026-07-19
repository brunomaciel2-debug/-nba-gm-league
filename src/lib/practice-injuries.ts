import { supabaseAdmin } from '@/lib/supabase'
import { getGymGradeBonus } from '@/lib/facility-constants'
import { medicalCostAfterInsurance, InjurySeverity, recurrenceWindowWeeks, recurrenceBodyPartWeightBoost } from '@/lib/injury-constants'

// Same severity weighting used by the real-game injury generator in
// cron/simulate/run.ts — one source of truth for "how common is each
// severity tier" would be cleaner, but duplicating this one small table is
// simpler than threading a new shared export through both call sites.
const SWEIGHTS: Record<string, number> = { minor: 40, moderate: 25, serious: 15, severe: 8, career_threatening: 2 }

// Training Intensity (gm_orders.training_intensity) already speeds up real
// attribute development — pushing players harder for faster growth now
// carries a real practice-injury cost too, the same tradeoff an actual NBA
// team faces with heavy-load practices. "rest" weeks are correspondingly
// almost injury-free.
const TRAIN_INTENSITY_INJURY_MULT: Record<string, number> = {
  rest: 0.25, light: 0.6, normal: 1.0, intense: 1.4, very_intense: 1.85,
}

// Weekly practice-injury chance per active player (before modifiers) — real
// but meaningfully lower than a single game's ~0.018 game-injury chance,
// since practice is lower-intensity than live competition.
const PRACTICE_INJURY_BASE_CHANCE = 0.008
// Off-court incidents (car accidents, altercations, freak accidents outside
// the professional environment) are genuinely rare and NOT preventable by
// team investment — unlike practice injuries, this ignores durability,
// facility grade, and the Trainer's injury_prevent entirely.
const OFF_COURT_INCIDENT_CHANCE = 0.0012

// Resolves two injury sources the real-game generator never covers: a
// player getting hurt in team practice, and a rare off-court incident
// unrelated to basketball at all. Runs once per week (call only when
// half===1, same as tactical/social-media resolution) across every active
// rostered player league-wide — practice happens regardless of whether the
// team has a real game that week.
export async function resolveWeeklyPracticeAndOffCourtInjuries(week: number) {
  const [{ data: players }, { data: injTypes }, { data: orders }, { data: facilities }, { data: trainers }] = await Promise.all([
    supabaseAdmin.from('players').select('id,name,health,moral,durability,team_id,status,games_missed,injury_type')
      .eq('status', 'active').not('team_id', 'is', null),
    supabaseAdmin.from('injury_types').select('*'),
    supabaseAdmin.from('gm_orders').select('team_id,training_intensity').eq('week_number', week),
    supabaseAdmin.from('practice_facilities').select('team_id,gym_grade'),
    supabaseAdmin.from('coaches').select('team_id,injury_prevent').eq('role', 'trainer'),
  ])
  if (!players?.length || !injTypes?.length) return { practiceInjuries: 0, offCourtIncidents: 0 }

  const intensityByTeam: Record<string, string> = {}
  ;(orders || []).forEach((o: any) => { intensityByTeam[o.team_id] = o.training_intensity || 'normal' })
  const facilityRiskMap: Record<string, number> = {}
  ;(facilities || []).forEach((f: any) => { facilityRiskMap[f.team_id] = getGymGradeBonus(f.gym_grade).risk })
  const injuryPreventByTeam: Record<string, number> = {}
  ;(trainers || []).forEach((c: any) => {
    const dampen = Math.max(-0.3, Math.min(0.3, ((c.injury_prevent ?? 50) - 50) / 50 * 0.3))
    injuryPreventByTeam[c.team_id] = 1 - dampen
  })

  // Reinjury fragility window — identical mechanic to the real-game generator.
  const pids = players.map((p: any) => p.id)
  const { data: recentlyHealed } = await supabaseAdmin.from('injury_log').select('player_id,injury_type,healed_week')
    .eq('status', 'resolved').in('player_id', pids).not('healed_week', 'is', null).gte('healed_week', week - 6)
  const injTypeByName: Record<string, any> = {}
  ;(injTypes || []).forEach((t: any) => { injTypeByName[t.name] = t })
  const fragileMap: Record<string, { bodyPart: string, risk: number }> = {}
  ;(recentlyHealed || []).forEach((r: any) => {
    const t = injTypeByName[r.injury_type]
    if (!t) return
    const windowWeeks = recurrenceWindowWeeks(t.recurrence_risk || 10)
    if (week - r.healed_week <= windowWeeks) fragileMap[r.player_id] = { bodyPart: t.body_part, risk: t.recurrence_risk || 10 }
  })

  let practiceInjuries = 0, offCourtIncidents = 0
  for (const p of players) {
    const durFactor = (p.durability || 75) / 100
    const fragile = fragileMap[p.id]
    const facilityRiskMod = 1 + (facilityRiskMap[p.team_id] || 0) / 100
    const injuryPreventMod = injuryPreventByTeam[p.team_id] ?? 1
    const intensityMod = TRAIN_INTENSITY_INJURY_MULT[intensityByTeam[p.team_id] || 'normal'] ?? 1.0

    const practiceChance = PRACTICE_INJURY_BASE_CHANCE * (1 / durFactor) * intensityMod * facilityRiskMod * injuryPreventMod * (fragile ? 1.2 : 1)

    let occurredIn: 'practice' | 'off_court' | null = null
    if (Math.random() < practiceChance) occurredIn = 'practice'
    else if (Math.random() < OFF_COURT_INCIDENT_CHANCE) occurredIn = 'off_court'
    if (!occurredIn) continue

    const weights = (injTypes as any[]).map(t => ({
      t, w: (SWEIGHTS[t.severity] || 10) * t.game_probability * ((fragile && t.body_part === fragile.bodyPart) ? recurrenceBodyPartWeightBoost(fragile.risk) : 1),
    }))
    const totalW = weights.reduce((s, x) => s + x.w, 0)
    let r = Math.random() * totalW, chosen = weights[0].t
    for (const { t, w } of weights) { r -= w; if (r <= 0) { chosen = t; break } }

    const { data: prev } = await supabaseAdmin.from('injury_log')
      .select('id').eq('player_id', p.id).eq('injury_type', chosen.name).eq('season', '2025-26')
    const isRec = (prev || []).length > 0
    const recMod = isRec ? 1.5 : 1.0
    const daysOut = Math.round((chosen.days_min + Math.random() * (chosen.days_max - chosen.days_min)) * recMod)
    const gamesOut = Math.max(1, Math.round(daysOut / 3.5))
    const hImpact = Math.round(chosen.health_impact_min + Math.random() * (chosen.health_impact_max - chosen.health_impact_min))
    const newHealth = Math.round(p.health ?? 100)

    const { error: injErr } = await supabaseAdmin.from('injury_log').insert({
      player_id: p.id, season: '2025-26', week_number: week,
      injury_type: chosen.name, injury_category: chosen.category,
      body_part: chosen.body_part, severity: chosen.severity, notes: chosen.notes,
      occurred_in: occurredIn, health_at_injury: newHealth,
      health_impact: hImpact, moral_impact: chosen.moral_impact || 0,
      days_out: daysOut, games_out: gamesOut,
      return_week: week + Math.ceil(gamesOut / 2),
      is_recurring: isRec, can_play: newHealth >= 50,
      play_risk: newHealth < 65 ? 75 : newHealth < 75 ? 40 : 15, status: 'active',
    })
    if (injErr) console.warn('injury_log insert (practice/off-court) failed:', injErr.message)

    // Team only pays its share after Insurance's 75% coverage — see
    // medicalCostAfterInsurance in injury-constants.ts.
    const medicalCost = medicalCostAfterInsurance(chosen.severity as InjurySeverity)
    if (medicalCost > 0 && p.team_id) {
      const { data: fin } = await supabaseAdmin.from('franchise_finances').select('balance').eq('team_id', p.team_id).single()
      if (fin) {
        await supabaseAdmin.from('franchise_finances').update({ balance: (fin.balance || 0) - medicalCost }).eq('team_id', p.team_id)
        await supabaseAdmin.from('franchise_transactions').insert({
          team_id: p.team_id, type: 'expense', category: 'medical', amount: medicalCost,
          description: `Medical bill — ${p.name}: ${chosen.name} (after 75% insurance coverage)`,
          season: '2025-26', week_number: week,
        })
      }
    }

    const injHealth = Math.max(0, newHealth - hImpact)
    await supabaseAdmin.from('players').update({
      health: injHealth, status: injHealth < 50 ? 'injured' : 'active',
      injury_type: chosen.name, games_missed: (p.games_missed || 0) + 1,
    }).eq('id', p.id)

    if (chosen.severity !== 'minor') {
      await supabaseAdmin.from('transactions').insert({
        type: 'injury',
        description: `${p.name} (${p.team_id}) — ${chosen.name}. Est. ${gamesOut} games out.`,
        teams: [p.team_id], players: [p.name], status: 'completed', week_number: week,
      })
    }

    if (occurredIn === 'practice') practiceInjuries++
    else offCourtIncidents++
  }
  return { practiceInjuries, offCourtIncidents }
}

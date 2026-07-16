import { createClient } from '@supabase/supabase-js'
import { getTeamLang, notifScoutTier, notifScoutMaintenanceNegative } from './notifications-helpers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── TIER CONFIGURATION ──────────────────────────────────
// Credit cost per reveal IMPROVES at higher tiers (better ratio),
// rewarding patience. Maintenance is a recurring weekly cost that
// increases the longer a team holds a higher tier — representing
// the overhead of a larger scouting operation (extra staff, travel,
// equipment), independent of whether sessions are actually used.
export const SCOUT_TIERS = {
  1: {
    label: 'Tier 1',
    pointsRequired: 100,
    revealCount: 6,
    creditCost: 10,           // ~1.7 credits per attribute
    weeklyMaintenance: 0,
    description: 'Local scouting network — college games, combine reports',
  },
  2: {
    label: 'Tier 2',
    pointsRequired: 250,
    revealCount: 14,
    creditCost: 15,           // ~1.1 credits per attribute — better ratio than Tier 1
    weeklyMaintenance: 15_000,
    description: 'Regional travel — in-person workouts, deeper film study',
  },
  3: {
    label: 'Tier 3',
    pointsRequired: 400,
    revealCount: 24,
    creditCost: 20,           // ~0.8 credits per attribute — best ratio
    weeklyMaintenance: 40_000,
    description: 'International scouting — private workouts, full team of evaluators',
  },
}

export const TOTAL_ATTRIBUTES = 29

export const SCOUTABLE_ATTRIBUTES = [
  'three','layup','dunk','mid','ft','siq','draw_foul',
  'blk','stl','idef','pdef',
  'def_reb','off_reb',
  'stamina','durability','speed','agility','strength',
  'ball_hdl','pass_vis','pass_iq','assist_role',
  'pressure','consistency','crowd_effect','streaky','trash_talk',
  'close_shot','standing_dunk',
]

function getCurrentTier(points: number): number {
  if (points >= SCOUT_TIERS[3].pointsRequired) return 3
  if (points >= SCOUT_TIERS[2].pointsRequired) return 2
  if (points >= SCOUT_TIERS[1].pointsRequired) return 1
  return 0
}

// ── WEEKLY POINTS GENERATION + MAINTENANCE BILLING ──────
// Called by the weekly cron — adds scouting points based on scout quality,
// and bills weekly maintenance cost for whatever tier the team currently holds.
export async function generateWeeklyScoutPoints() {
  const { data: scouts } = await supabase
    .from('coaches')
    .select('id,team_id,name,scouting_evaluation,scouting_network,scouting_experience')
    .eq('role', 'scout')
    .not('team_id', 'is', null)

  if (!scouts?.length) return { updated: 0 }

  let updated = 0

  for (const scout of scouts) {
    const evaluation = scout.scouting_evaluation ?? 50
    const experience = scout.scouting_experience ?? 50
    const network = scout.scouting_network ?? 50

    const basePoints = Math.round(
      (evaluation * 0.5) + (experience * 0.3) + (network * 0.2)
    )
    const variance = basePoints * (0.85 + Math.random() * 0.3)
    const weeklyPoints = Math.max(5, Math.round(variance))

    const { data: progress } = await supabase
      .from('scout_progress')
      .select('*')
      .eq('team_id', scout.team_id)
      .eq('season', '2025-26')
      .maybeSingle()

    const currentPoints = progress?.points || 0
    const newPoints = currentPoints + weeklyPoints
    const oldTier = getCurrentTier(progress?.lifetime_points || 0)
    const newLifetimePoints = (progress?.lifetime_points || 0) + weeklyPoints
    const newTier = getCurrentTier(newLifetimePoints)

    if (progress) {
      await supabase.from('scout_progress').update({
        points: newPoints,
        lifetime_points: newLifetimePoints,
        updated_at: new Date().toISOString(),
      }).eq('id', progress.id)
    } else {
      await supabase.from('scout_progress').insert({
        team_id: scout.team_id,
        season: '2025-26',
        points: newPoints,
        lifetime_points: weeklyPoints,
      })
    }

    // Notify if tier increased
    if (newTier > oldTier) {
      const tierInfo = SCOUT_TIERS[newTier as 1|2|3]
      const lang = await getTeamLang(scout.team_id)
      const notif = notifScoutTier(lang, scout.name, newTier, tierInfo.revealCount, tierInfo.creditCost, tierInfo.weeklyMaintenance)
      await supabase.from('inbox_messages').insert({
        to_team_id: scout.team_id, type: 'scouting',
        subject: notif.subject, body: notif.body, read: false,
        metadata: { new_tier: newTier, points: newPoints },
      })
    }

    // ── Weekly maintenance billing for current tier ──────
    if (newTier > 0) {
      const tierInfo = SCOUT_TIERS[newTier as 1|2|3]
      if (tierInfo.weeklyMaintenance > 0) {
        const { data: finances } = await supabase
          .from('franchise_finances').select('balance').eq('team_id', scout.team_id).single()

        if (finances) {
          const newBalance = (finances.balance || 0) - tierInfo.weeklyMaintenance
          await supabase.from('franchise_finances').update({ balance: newBalance }).eq('team_id', scout.team_id)
          await supabase.from('franchise_transactions').insert({
            team_id: scout.team_id, type: 'expense', category: 'scouting_maintenance',
            amount: tierInfo.weeklyMaintenance,
            description: `Weekly scouting operation overhead — Tier ${newTier}`,
            season: '2025-26',
          })

          if (newBalance < 0) {
            const lang = await getTeamLang(scout.team_id)
            const notif = notifScoutMaintenanceNegative(lang, newTier, tierInfo.weeklyMaintenance, newBalance)
            await supabase.from('inbox_messages').insert({
              to_team_id: scout.team_id, type: 'scouting',
              subject: notif.subject, body: notif.body, read: false,
              metadata: { tier: newTier, balance: newBalance },
            })
          }
        }
      }
    }

    updated++
  }

  return { updated }
}

// ── REVEAL ATTRIBUTES (spend a session) ─────────────────
// Note: creditCost is the ONLY per-session cost. There is no additional
// money cost per session — money is billed separately as weekly maintenance.
export async function revealAttributes(
  teamId: string,
  tier: 1 | 2 | 3,
  reveals: { prospectId: string, attribute: string }[]
): Promise<{ success: boolean, error?: string }> {
  const tierConfig = SCOUT_TIERS[tier]

  if (reveals.length === 0) {
    return { success: false, error: 'No attributes selected' }
  }
  if (reveals.length > tierConfig.revealCount) {
    return { success: false, error: `Tier ${tier} allows up to ${tierConfig.revealCount} reveals per session` }
  }

  const { data: progress } = await supabase
    .from('scout_progress')
    .select('*')
    .eq('team_id', teamId)
    .eq('season', '2025-26')
    .single()

  if (!progress) {
    return { success: false, error: 'No scouting progress found for this team' }
  }
  if ((progress.lifetime_points || 0) < tierConfig.pointsRequired) {
    return { success: false, error: `Team has not reached Tier ${tier} yet (${progress.lifetime_points || 0}/${tierConfig.pointsRequired} lifetime points)` }
  }
  if ((progress.points ?? 0) < tierConfig.creditCost) {
    return { success: false, error: `Not enough scouting credits — this session costs ${tierConfig.creditCost} credits, you have ${progress.points ?? 0}` }
  }

  // Deduct credits balance (only cost — no per-session money charge)
  await supabase.from('scout_progress').update({
    points: (progress.points ?? 0) - tierConfig.creditCost,
    updated_at: new Date().toISOString(),
  }).eq('id', progress.id)

  // Insert reveals (deduped via UNIQUE constraint)
  const insertRows = reveals.map(r => ({
    team_id: teamId,
    prospect_id: r.prospectId,
    attribute_name: r.attribute,
    season: '2025-26',
  }))

  const { error: insertError } = await supabase
    .from('scouting_reveals')
    .upsert(insertRows, { onConflict: 'team_id,prospect_id,attribute_name,season', ignoreDuplicates: true })

  if (insertError) return { success: false, error: insertError.message }

  return { success: true }
}

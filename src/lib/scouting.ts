import { createClient } from '@supabase/supabase-js'
import { getTeamLang, notifScoutTier, notifScoutMaintenanceNegative } from './notifications-helpers'
import { TOTAL_ATTRIBUTES, SCOUTABLE_ATTRIBUTES } from './scouting-constants'

export { TOTAL_ATTRIBUTES, SCOUTABLE_ATTRIBUTES }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── TIER CONFIGURATION ──────────────────────────────────
// This is a single resettable progress meter (scout_progress.points), not
// three separate cumulative pools. It climbs weekly and, once it crosses a
// tier's pointsRequired threshold, that tier's revealCount becomes the
// team's current available credits — replacing whatever the previous tier
// offered, not adding to it. The GM can keep waiting for a bigger payout
// (higher tiers cost more in weekly maintenance while unspent, rewarding
// patience but not for free) or cash out early. Spending resets the whole
// meter back to 0 regardless of how many of the available credits were
// actually used — there's no partial carryover ("sem troco").
export const SCOUT_TIERS = {
  1: {
    label: 'Tier 1',
    pointsRequired: 100,
    revealCount: 6,
    weeklyMaintenance: 0,
    description: 'Local scouting network — college games, combine reports',
  },
  2: {
    label: 'Tier 2',
    pointsRequired: 250,
    revealCount: 14,
    weeklyMaintenance: 15_000,
    description: 'Regional travel — in-person workouts, deeper film study',
  },
  3: {
    label: 'Tier 3',
    pointsRequired: 400,
    revealCount: 24,
    weeklyMaintenance: 40_000,
    description: 'International scouting — private workouts, full team of evaluators',
  },
}

function getCurrentTier(points: number): number {
  if (points >= SCOUT_TIERS[3].pointsRequired) return 3
  if (points >= SCOUT_TIERS[2].pointsRequired) return 2
  if (points >= SCOUT_TIERS[1].pointsRequired) return 1
  return 0
}

// ── WEEKLY POINTS GENERATION + MAINTENANCE BILLING ──────
// Called by the weekly cron — adds scouting points based on scout quality,
// and bills weekly maintenance cost for whatever tier the current cycle has
// reached.
export async function generateWeeklyScoutPoints(week?: number) {
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

    // The cycle meter pauses once it reaches Tier 3's threshold — same
    // "stop once maxed out until spent" idea as training_slots' fill_pct —
    // instead of climbing forever with no further benefit.
    const currentPoints = progress?.points || 0
    const newPoints = Math.min(SCOUT_TIERS[3].pointsRequired, currentPoints + weeklyPoints)
    const oldTier = getCurrentTier(currentPoints)
    const newTier = getCurrentTier(newPoints)
    // Kept purely as a historical/lifetime stat — no longer gates anything.
    const newLifetimePoints = (progress?.lifetime_points || 0) + weeklyPoints

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

    // Notify if tier increased this cycle
    if (newTier > oldTier) {
      const tierInfo = SCOUT_TIERS[newTier as 1|2|3]
      const lang = await getTeamLang(scout.team_id)
      const notif = notifScoutTier(lang, scout.name, newTier, tierInfo.revealCount, tierInfo.weeklyMaintenance)
      await supabase.from('inbox_messages').insert({
        to_team_id: scout.team_id, type: 'scouting',
        subject: notif.subject, body: notif.body, read: false,
        metadata: { new_tier: newTier, points: newPoints },
      })
    }

    // ── Weekly maintenance billing for the current cycle's tier ──
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
            season: '2025-26', week_number: week,
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

// ── REVEAL ATTRIBUTES (spend the current cycle) ─────────
// The tier — and therefore how many credits are available — is derived
// server-side from the team's current progress, never trusted from the
// client. Spending always resets progress to 0, even if fewer than the
// available credits were actually used.
export async function revealAttributes(
  teamId: string,
  reveals: { prospectId: string, attribute: string }[]
): Promise<{ success: boolean, error?: string }> {
  if (reveals.length === 0) {
    return { success: false, error: 'No attributes selected' }
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

  const currentTier = getCurrentTier(progress.points || 0)
  if (currentTier === 0) {
    return { success: false, error: `Not enough scouting progress yet — ${progress.points || 0}/${SCOUT_TIERS[1].pointsRequired} points to your first credits` }
  }

  const tierConfig = SCOUT_TIERS[currentTier as 1|2|3]
  if (reveals.length > tierConfig.revealCount) {
    return { success: false, error: `You have ${tierConfig.revealCount} credits available — can't reveal more than that` }
  }

  // Spend the whole cycle — no partial carryover regardless of how many of
  // the available credits were actually used.
  await supabase.from('scout_progress').update({
    points: 0,
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

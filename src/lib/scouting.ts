import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── TIER CONFIGURATION ──────────────────────────────────
export const SCOUT_TIERS = {
  1: {
    label: 'Tier 1',
    pointsRequired: 100,
    revealCount: 6,
    creditCost: 10,
    moneyCost: 0,
    description: 'Local scouting network — college games, combine reports',
  },
  2: {
    label: 'Tier 2',
    pointsRequired: 250,
    revealCount: 14,
    creditCost: 35,
    moneyCost: 150_000,
    description: 'Regional travel — in-person workouts, deeper film study',
  },
  3: {
    label: 'Tier 3',
    pointsRequired: 400,
    revealCount: 24,
    creditCost: 80,
    moneyCost: 400_000,
    description: 'International scouting — private workouts, full team of evaluators',
  },
}

export const TOTAL_ATTRIBUTES = 30

export const SCOUTABLE_ATTRIBUTES = [
  'three','layup','dunk','mid','ft','siq','draw_foul','usage',
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

// ── WEEKLY POINTS GENERATION ────────────────────────────
// Called by the weekly cron — adds scouting points based on scout quality
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

    // Weekly points formula: evaluation is the primary driver, experience accelerates,
    // network gives a smaller secondary boost
    const basePoints = Math.round(
      (evaluation * 0.5) + (experience * 0.3) + (network * 0.2)
    )
    // Add small randomness for realism (±15%)
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
      await supabase.from('inbox_messages').insert({
        to_team_id: scout.team_id,
        type: 'scouting',
        subject: `🔍 Scouting Tier ${newTier} unlocked!`,
        body: `${scout.name} has reached Tier ${newTier} scouting capability!\n\nYou can now reveal up to ${tierInfo.revealCount} attributes per session for ${tierInfo.creditCost} credits${tierInfo.moneyCost > 0 ? ` + $${(tierInfo.moneyCost/1000).toFixed(0)}K` : ''}.\n\nVisit the Scouting tab to start evaluating draft prospects.`,
        read: false,
        metadata: { new_tier: newTier, points: newPoints },
      })
    }

    updated++
  }

  return { updated }
}

// ── REVEAL ATTRIBUTES (spend a session) ─────────────────
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

  // Check money if tier 2/3
  if (tierConfig.moneyCost > 0) {
    const { data: finances } = await supabase.from('franchise_finances').select('balance').eq('team_id', teamId).single()
    if (!finances || (finances.balance ?? 0) < tierConfig.moneyCost) {
      return { success: false, error: `Insufficient funds — this session costs $${(tierConfig.moneyCost/1000).toFixed(0)}K` }
    }
  }

  // Deduct credits balance
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

  // Deduct money cost
  if (tierConfig.moneyCost > 0) {
    await supabase.rpc('increment_balance', { p_team_id: teamId, p_amount: -tierConfig.moneyCost })
    await supabase.from('franchise_transactions').insert({
      team_id: teamId, type: 'expense', category: 'scouting',
      amount: tierConfig.moneyCost,
      description: `Tier ${tier} scouting session — ${reveals.length} attributes revealed`,
      season: '2025-26',
    })
  }

  return { success: true }
}

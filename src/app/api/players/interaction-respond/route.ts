import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTeamLang } from '@/lib/notifications-helpers'
import { notify } from '@/lib/notifications'
import { notifInteractionResolved } from '@/lib/notifications-helpers'
import { buildResolutionText, buildCommitmentText } from '@/lib/interaction-constants'
import { isSpecialistEligible, SPECIALIST_COST_BY_SEVERITY, SPECIALIST_BOOST_MULTIPLIER_BY_SEVERITY } from '@/lib/injury-constants'
import { computeCommitment } from '@/lib/player-interactions'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// These reasons no longer resolve the moment the GM clicks Concede/Compromise
// — a click alone isn't proof of anything. Instead the response records a
// commitment and the system verifies real data over the next 2 weeks before
// any morale change happens (player-interactions.ts: computeCommitment /
// computeMonitorValue). Dismiss always stays instant for every reason —
// refusing to engage is itself the complete, self-evident action, nothing to
// verify. wants_specialist_for_injury and general_frustration also stay
// instant: the former already performs a real, atomic action synchronously
// below; the latter isn't a real demand, just an open-ended check-in.
const REASONS_REQUIRING_PROOF = new Set([
  'conflict_with_teammate', 'wants_veteran_mentor', 'unhappy_with_team_record',
  'wants_front_office_aggression', 'wants_leadership_recognition',
  'wants_contract_extension_talks', 'feels_underpaid', 'feels_development_neglected',
  'homesickness_family', 'media_pressure_stress', 'personal_crisis',
])

// Immediate-type Player Interactions: the GM answers right away with one of
// 3 standard choices. Each has its own moral outcome, pulled from the
// reason's row in player_interaction_types — never a generic flat number.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })

  const { interactionId, choice } = await req.json()
  if (!['concede', 'compromise', 'dismiss'].includes(choice)) return NextResponse.json({ error: 'Invalid choice' }, { status: 400 })

  // No declared foreign key from player_interactions to players (raw table,
  // no REFERENCES), so an embedded players!inner(...) select 400s — fetch
  // the player separately instead.
  const { data: interaction } = await admin.from('player_interactions').select('*').eq('id', interactionId).single()
  if (!interaction) return NextResponse.json({ error: 'Interaction not found' }, { status: 404 })
  if (interaction.status !== 'pending_response') return NextResponse.json({ error: 'This interaction is not awaiting a response' }, { status: 400 })

  const isOwner = gm.team_id === interaction.team_id
  const isCommissioner = gm.role === 'commissioner'
  if (!isOwner && !isCommissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { data: player } = await admin.from('players').select('name,moral').eq('id', interaction.player_id).single()

  const { data: type } = await admin.from('player_interaction_types').select('*').eq('reason_key', interaction.reason_key).single()
  if (!type) return NextResponse.json({ error: 'Unknown interaction type' }, { status: 500 })

  const playerName = player?.name || 'Player'

  // Concede/Compromise on these reasons only records a commitment — the real
  // moral change waits for resolveMonitoredInteractions to verify it against
  // actual data, exactly like the always-monitored reasons.
  if (choice !== 'dismiss' && REASONS_REQUIRING_PROOF.has(interaction.reason_key)) {
    const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
    const week = (cfg?.current_week || 0) + 1
    const { demandTarget, baselineValue, monitorWeeks } = await computeCommitment(
      interaction.reason_key, choice as 'concede' | 'compromise', interaction.team_id, interaction.player_id, interaction.partner_player_id, week
    )
    const deadlineWeek = week + monitorWeeks
    await admin.from('player_interactions').update({
      status: 'monitoring', response_choice: choice, demand_target: demandTarget, baseline_value: baselineValue,
      current_progress: baselineValue, deadline_week: deadlineWeek, updated_at: new Date().toISOString(),
    }).eq('id', interactionId)

    const lang = await getTeamLang(interaction.team_id)
    const commitText = buildCommitmentText(lang, playerName, deadlineWeek)
    const notif = notifInteractionResolved(lang, playerName, commitText)
    await notify(interaction.team_id, 'player_interaction', notif.subject, notif.body, { interaction_id: interactionId, player_id: interaction.player_id })

    return NextResponse.json({ success: true, monitoring: true, deadlineWeek })
  }

  const deltaField = choice === 'concede' ? 'moral_concede' : choice === 'compromise' ? 'moral_compromise' : 'moral_dismiss'
  const partnerDeltaField = choice === 'concede' ? 'moral_concede_partner' : choice === 'compromise' ? 'moral_compromise_partner' : 'moral_dismiss_partner'
  const delta = type[deltaField] ?? 0
  const partnerDelta = type[partnerDeltaField] ?? 0

  const currentMoral = player?.moral ?? 80
  const newMoral = Math.max(0, Math.min(100, currentMoral + delta))
  await admin.from('players').update({ moral: newMoral }).eq('id', interaction.player_id)

  if (interaction.partner_player_id && partnerDelta) {
    const { data: partner } = await admin.from('players').select('moral').eq('id', interaction.partner_player_id).single()
    if (partner) {
      const partnerNewMoral = Math.max(0, Math.min(100, (partner.moral || 80) + partnerDelta))
      await admin.from('players').update({ moral: partnerNewMoral }).eq('id', interaction.partner_player_id)
    }
  }

  // Special case: conceding to a player who wants a Specialist for his
  // injury actually triggers the real Specialist mechanic — not just a
  // moral bump. Best-effort: if he's no longer eligible or the team can't
  // afford it, the concession still stands, just without the extra action.
  if (interaction.reason_key === 'wants_specialist_for_injury' && choice === 'concede') {
    try {
      const { data: injuries } = await admin.from('injury_log').select('id,severity,specialist_used')
        .eq('player_id', interaction.player_id).eq('status', 'active').order('created_at', { ascending: false }).limit(1)
      const injury = injuries?.[0]
      if (injury && !injury.specialist_used && isSpecialistEligible(injury.severity)) {
        const cost = SPECIALIST_COST_BY_SEVERITY[injury.severity]!
        const { data: fin } = await admin.from('franchise_finances').select('balance').eq('team_id', interaction.team_id).single()
        if (fin && (fin.balance || 0) >= cost) {
          await admin.from('injury_log').update({ specialist_used: true }).eq('id', injury.id)
          await admin.from('franchise_finances').update({ balance: (fin.balance || 0) - cost }).eq('team_id', interaction.team_id)
          await admin.from('franchise_transactions').insert({
            team_id: interaction.team_id, type: 'expense', category: 'specialist', amount: cost,
            description: `Specialist consultation — ${playerName}`, season: '2025-26',
          })
        }
      }
    } catch { /* best-effort — the concession itself still stands either way */ }
  }

  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  await admin.from('player_interactions').update({
    status: 'resolved', response_choice: choice, outcome: choice, moral_after: newMoral, resolved_week: (cfg?.current_week || 0) + 1, updated_at: new Date().toISOString(),
  }).eq('id', interactionId)

  const lang = await getTeamLang(interaction.team_id)
  const resolutionText = buildResolutionText(lang, playerName, choice, delta, interaction.reason_key)
  const notif = notifInteractionResolved(lang, playerName, resolutionText)
  await notify(interaction.team_id, 'player_interaction', notif.subject, notif.body, { interaction_id: interactionId, player_id: interaction.player_id })

  return NextResponse.json({ success: true, newMoral, delta })
}

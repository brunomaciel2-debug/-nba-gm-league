import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyTradeAccepted, notifyTradeRejected, notifyPlayerArrival, notify } from '@/lib/notifications'
import { resolveInteractionsForTradedPlayer } from '@/lib/player-interactions'
import { MIN_ROSTER, MAX_ROSTER, isFreeAgencyWindow, getActiveRosterCount } from '@/lib/roster-limits'
import { recordPlayerTransaction, recordTradeLegacyTransaction } from '@/lib/player-transactions'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CAP_LIMIT = 180_000_000

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await supabaseAdmin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })

  const { proposalId, action, reason } = await req.json()
  // action: 'accept' | 'reject'

  if (!proposalId || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 })
  }

  const { data: proposal } = await supabaseAdmin
    .from('trade_proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (!proposal) return NextResponse.json({ error: 'Trade proposal not found' }, { status: 404 })
  if (proposal.status !== 'pending') return NextResponse.json({ error: 'This trade has already been resolved' }, { status: 400 })

  const { data: teams } = await supabaseAdmin
    .from('trade_proposal_teams')
    .select('*')
    .eq('proposal_id', proposalId)

  if (!teams || teams.length < 2) return NextResponse.json({ error: 'Invalid trade structure' }, { status: 400 })

  // Authorization: must be GM of a non-initiating team in the trade, or commissioner
  const isInitiator = proposal.initiator_team === gm.team_id
  const isParticipant = teams.some((t: any) => t.team_id === gm.team_id)
  const isCommissioner = gm.role === 'commissioner'

  if (!isCommissioner && (isInitiator || !isParticipant)) {
    return NextResponse.json({ error: 'Not authorized to respond to this trade — only the receiving team can accept or reject' }, { status: 403 })
  }

  const { data: teamRecords } = await supabaseAdmin.from('teams').select('id,name').in('id', teams.map((t: any) => t.team_id))
  const teamNameMap: Record<string, string> = {}
  for (const t of (teamRecords || [])) teamNameMap[t.id] = t.name

  const respondingTeamId = gm.team_id || teams.find((t: any) => t.team_id !== proposal.initiator_team)?.team_id
  const respondingTeamName = teamNameMap[respondingTeamId] || 'A team'

  if (action === 'reject') {
    await supabaseAdmin.from('trade_proposals').update({ status: 'rejected' }).eq('id', proposalId)
    await notifyTradeRejected(proposalId, proposal.initiator_team, respondingTeamId, respondingTeamName, reason)
    // The initiator-team inbox notification above is useless if the
    // Commissioner proposed on behalf of a team they don't actually GM —
    // they'd never see it there, so mirror it to their own inbox too.
    if (proposal.proposed_by_commissioner) {
      try {
        await notify('commissioner', 'trade',
          `❌ Trade rejected by ${respondingTeamName}`,
          `The trade you proposed on behalf of ${teamNameMap[proposal.initiator_team] || proposal.initiator_team} was rejected by ${respondingTeamName}.${reason ? `\n\nReason: ${reason}` : ''}`,
          { proposal_id: proposalId })
      } catch (notifErr) { console.warn('Commissioner rejection notification failed', notifErr) }
    }
    return NextResponse.json({ success: true, status: 'rejected' })
  }

  // ── ACCEPT: validate cap AND roster size for every team, then execute ──
  const fAWindow = await isFreeAgencyWindow(supabaseAdmin)
  for (const teamEntry of teams) {
    const { data: team } = await supabaseAdmin.from('teams').select('cap_used').eq('id', teamEntry.team_id).single()
    const currentCap = team?.cap_used || 0
    const newCap = currentCap - (teamEntry.salary_out || 0) + (teamEntry.salary_in || 0)
    if (newCap > CAP_LIMIT) {
      return NextResponse.json({
        error: `${teamNameMap[teamEntry.team_id] || teamEntry.team_id} would exceed the $180M salary cap with this trade. Trade cannot be completed.`
      }, { status: 400 })
    }

    const currentRoster = await getActiveRosterCount(supabaseAdmin, teamEntry.team_id)
    const projectedRoster = currentRoster - (teamEntry.players_out || []).length + (teamEntry.players_in || []).length
    if (projectedRoster > MAX_ROSTER) {
      return NextResponse.json({
        error: `${teamNameMap[teamEntry.team_id] || teamEntry.team_id} would exceed the ${MAX_ROSTER}-player roster limit with this trade. Trade cannot be completed.`
      }, { status: 400 })
    }
    if (projectedRoster < MIN_ROSTER && !fAWindow) {
      return NextResponse.json({
        error: `${teamNameMap[teamEntry.team_id] || teamEntry.team_id} would drop below the ${MIN_ROSTER}-player roster minimum with this trade. Only allowed during the Free Agency week. Trade cannot be completed.`
      }, { status: 400 })
    }

    // Salary-balance check (±15% + $1M) — previously only enforced client-side
    // on the proposal page, never re-verified here at execution. Applied per
    // team so every participant is held to it, not just the initiator.
    const salaryOut = teamEntry.salary_out || 0
    const salaryIn = teamEntry.salary_in || 0
    if (!(salaryOut === 0 && salaryIn === 0)) {
      const diff = Math.abs(salaryOut - salaryIn)
      const maxDiff = Math.max(salaryOut, salaryIn) * 0.15 + 1_000_000
      if (diff > maxDiff) {
        return NextResponse.json({
          error: `${teamNameMap[teamEntry.team_id] || teamEntry.team_id}'s side of the trade is too unbalanced (must be within ±15% + $1M). Trade cannot be completed.`
        }, { status: 400 })
      }
    }

    // Re-verify pick ownership at the moment of execution too, not just at
    // proposal time — a pick could have been voided (no real draft that
    // season, see ANULAR_DRAFT_PICKS_2026.sql) or otherwise moved on in the
    // time between a proposal being sent and actually being accepted.
    if ((teamEntry.picks_out || []).length) {
      const { data: ownedPicks } = await supabaseAdmin.from('draft_picks')
        .select('id').eq('team_id', teamEntry.team_id).eq('status', 'owned').in('id', teamEntry.picks_out)
      if ((ownedPicks?.length || 0) !== teamEntry.picks_out.length) {
        return NextResponse.json({
          error: `${teamNameMap[teamEntry.team_id] || teamEntry.team_id} no longer owns one of the draft picks in this trade (already used, voided, or moved). Trade cannot be completed.`
        }, { status: 400 })
      }
    }
  }

  const { data: cfg } = await supabaseAdmin.from('season_config').select('current_week').eq('id', 1).single()
  const currentWeek = (cfg?.current_week || 0) + 1

  // Execute player and pick movement for each team
  for (const teamEntry of teams) {
    const playersOut: string[] = teamEntry.players_out || []
    const playersIn: string[] = teamEntry.players_in || []
    const picksOut: string[] = teamEntry.picks_out || []
    const picksIn: string[] = teamEntry.picks_in || []

    // Find destination team for each outgoing player (the team receiving them)
    for (const playerId of playersOut) {
      // Determine which other team entry lists this player as incoming
      const destEntry = teams.find((t: any) => t.team_id !== teamEntry.team_id && (t.players_in || []).includes(playerId))
      const destTeamId = destEntry?.team_id
      if (!destTeamId) continue

      const { data: player } = await supabaseAdmin.from('players').select('name,salary').eq('id', playerId).single()
      await supabaseAdmin.from('players').update({ team_id: destTeamId }).eq('id', playerId)

      try {
        await recordPlayerTransaction(supabaseAdmin, {
          playerId, type: 'trade', fromTeamId: teamEntry.team_id, toTeamId: destTeamId,
          season: '2025-26', week: currentWeek, proposalId,
        })
      } catch (txErr) { console.warn('Failed to record trade transaction history', txErr) }

      // Any open Player Interaction referencing this player (his own complaint,
      // or someone else's "wants to play with him" partner) is now stale —
      // the roster context it was raised about no longer exists.
      try { await resolveInteractionsForTradedPlayer(Number(playerId), currentWeek) }
      catch (interErr) { console.warn('Interaction cleanup after trade failed', interErr) }

      // Notify destination team of arrival
      await notifyPlayerArrival(destTeamId, player?.name || 'A player', teamNameMap[teamEntry.team_id] || teamEntry.team_id)
    }

    // Move draft picks
    for (const pickId of picksOut) {
      const destEntry = teams.find((t: any) => t.team_id !== teamEntry.team_id && (t.picks_in || []).includes(pickId))
      const destTeamId = destEntry?.team_id
      if (!destTeamId) continue
      await supabaseAdmin.from('draft_picks').update({ team_id: destTeamId }).eq('id', pickId)
    }

    // Update cap_used for this team
    const { data: team } = await supabaseAdmin.from('teams').select('cap_used').eq('id', teamEntry.team_id).single()
    const newCap = (team?.cap_used || 0) - (teamEntry.salary_out || 0) + (teamEntry.salary_in || 0)
    await supabaseAdmin.from('teams').update({ cap_used: Math.max(0, newCap) }).eq('id', teamEntry.team_id)
  }

  await supabaseAdmin.from('trade_proposals').update({ status: 'accepted' }).eq('id', proposalId)

  try { await recordTradeLegacyTransaction(supabaseAdmin, proposalId, currentWeek) }
  catch (txErr) { console.warn('Failed to record trade legacy transaction', txErr) }

  // Notify initiator of acceptance
  await notifyTradeAccepted(proposalId, proposal.initiator_team, respondingTeamId, respondingTeamName)
  // Same gap as the reject branch — if the Commissioner proposed this on
  // behalf of a team, they'd never see the acceptance in that team's inbox.
  if (proposal.proposed_by_commissioner) {
    try {
      await notify('commissioner', 'trade',
        `✅ Trade accepted by ${respondingTeamName}`,
        `The trade you proposed on behalf of ${teamNameMap[proposal.initiator_team] || proposal.initiator_team} was accepted by ${respondingTeamName}. It has been processed.`,
        { proposal_id: proposalId })
    } catch (notifErr) { console.warn('Commissioner acceptance notification failed', notifErr) }
  }

  // Log transaction
  await supabaseAdmin.from('franchise_transactions').insert(
    teams.map((t: any) => ({
      team_id: t.team_id,
      type: 'trade',
      category: 'trade',
      amount: 0,
      description: `Trade completed (proposal ${proposalId})`,
      season: '2025-26',
    }))
  )

  return NextResponse.json({ success: true, status: 'accepted' })
}

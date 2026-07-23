import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyTradeProposed } from '@/lib/notifications'
import { MIN_ROSTER, MAX_ROSTER, isFreeAgencyWindow, getActiveRosterCount } from '@/lib/roster-limits'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CAP_LIMIT = 180_000_000

type TeamRow = {
  team_id: string
  players_out: string[]
  players_in: string[]
  picks_out: string[]
  picks_in: string[]
  salary_out: number
  salary_in: number
}

// Moves trade-proposal creation server-side so it can send a real inbox
// notification to every non-initiating team — the previous client-side-only
// version wrote to a "messages" table that no page ever reads, so the
// receiving GM never saw a proposal existed anywhere in the UI.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await supabaseAdmin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })

  const { initiatorTeamId, notes, teams } = await req.json() as { initiatorTeamId: string, notes?: string, teams: TeamRow[] }

  if (!initiatorTeamId || !Array.isArray(teams) || teams.length < 2) {
    return NextResponse.json({ error: 'Missing or invalid trade structure' }, { status: 400 })
  }

  const isCommissioner = gm.role === 'commissioner'
  if (!isCommissioner && gm.team_id !== initiatorTeamId) {
    return NextResponse.json({ error: 'Not authorized to propose on behalf of this team' }, { status: 403 })
  }
  if (!teams.some(t => t.team_id === initiatorTeamId)) {
    return NextResponse.json({ error: 'Initiator team must be one of the trading teams' }, { status: 400 })
  }

  // Same authoritative checks as accept-time — catches an obviously broken
  // trade before it's even proposed, instead of only rejecting it later.
  const fAWindow = await isFreeAgencyWindow(supabaseAdmin)
  for (const t of teams) {
    const { data: team } = await supabaseAdmin.from('teams').select('cap_used').eq('id', t.team_id).single()
    const newCap = (team?.cap_used || 0) - (t.salary_out || 0) + (t.salary_in || 0)
    if (newCap > CAP_LIMIT) {
      return NextResponse.json({ error: `${t.team_id} would exceed the $180M salary cap with this trade.` }, { status: 400 })
    }
    const currentRoster = await getActiveRosterCount(supabaseAdmin, t.team_id)
    const projectedRoster = currentRoster - (t.players_out || []).length + (t.players_in || []).length
    if (projectedRoster > MAX_ROSTER) {
      return NextResponse.json({ error: `${t.team_id} would exceed the ${MAX_ROSTER}-player roster limit with this trade.` }, { status: 400 })
    }
    if (projectedRoster < MIN_ROSTER && !fAWindow) {
      return NextResponse.json({ error: `${t.team_id} would drop below the ${MIN_ROSTER}-player roster minimum with this trade.` }, { status: 400 })
    }
    const salaryOut = t.salary_out || 0, salaryIn = t.salary_in || 0
    if (!(salaryOut === 0 && salaryIn === 0)) {
      const diff = Math.abs(salaryOut - salaryIn)
      const maxDiff = Math.max(salaryOut, salaryIn) * 0.15 + 1_000_000
      if (diff > maxDiff) {
        return NextResponse.json({ error: `${t.team_id}'s side of the trade is too unbalanced (must be within ±15% + $1M).` }, { status: 400 })
      }
    }

    // A void pick (e.g. a season with no real draft, see ANULAR_DRAFT_PICKS_2026.sql)
    // or a pick that isn't actually this team's to send would otherwise slip
    // through since the client only filters what it displays, not what it
    // can submit — re-verify server-side against the authoritative table.
    if ((t.picks_out || []).length) {
      const { data: ownedPicks } = await supabaseAdmin.from('draft_picks')
        .select('id').eq('team_id', t.team_id).eq('status', 'owned').in('id', t.picks_out)
      if ((ownedPicks?.length || 0) !== t.picks_out.length) {
        return NextResponse.json({ error: `${t.team_id} is trying to send a draft pick it doesn't actually own (already used, voided, or not theirs).` }, { status: 400 })
      }
    }
  }

  const { data: proposal, error: proposalErr } = await supabaseAdmin.from('trade_proposals').insert({
    initiator_team: initiatorTeamId, status: 'pending', notes: notes || null,
    proposed_by_commissioner: isCommissioner,
  }).select().single()
  if (!proposal) return NextResponse.json({ error: proposalErr?.message || 'Failed to create trade proposal' }, { status: 500 })

  // The initiator implicitly already agreed by proposing — every other
  // team starts 'pending' and must explicitly accept before the trade can
  // execute. See /api/trade/respond for the multi-team consensus check.
  const { data: insertedTeams, error: teamsErr } = await supabaseAdmin.from('trade_proposal_teams').insert(
    teams.map(t => ({ ...t, proposal_id: proposal.id, status: t.team_id === initiatorTeamId ? 'accepted' : 'pending' }))
  ).select()
  if (teamsErr || (insertedTeams?.length || 0) !== teams.length) {
    // Roll back the header row rather than leaving a permanently-empty
    // "pending" proposal that can never be seen or acted on by anyone.
    // The length check (not just the error) catches a malformed/empty
    // teams array silently "succeeding" an insert of nothing.
    await supabaseAdmin.from('trade_proposals').delete().eq('id', proposal.id)
    return NextResponse.json({ error: `Failed to save trade details: ${teamsErr?.message || 'incomplete team data'}` }, { status: 500 })
  }

  const teamIds = teams.map(t => t.team_id)
  const { data: teamRecords } = await supabaseAdmin.from('teams').select('id,name').in('id', teamIds)
  const teamNameMap: Record<string, string> = {}
  for (const t of (teamRecords || [])) teamNameMap[t.id] = t.name

  const allPlayerIds = Array.from(new Set(teams.flatMap(t => [...t.players_out, ...t.players_in])))
  const { data: playerRecords } = allPlayerIds.length
    ? await supabaseAdmin.from('players').select('id,name').in('id', allPlayerIds)
    : { data: [] as any[] }
  const playerNameMap: Record<string, string> = {}
  for (const p of (playerRecords || [])) playerNameMap[p.id] = p.name

  for (const t of teams) {
    if (t.team_id === initiatorTeamId) continue
    const sendNames = t.players_out.map(id => playerNameMap[id]).filter(Boolean).join(', ')
    const recvNames = t.players_in.map(id => playerNameMap[id]).filter(Boolean).join(', ')
    try {
      await notifyTradeProposed(proposal.id, t.team_id, initiatorTeamId, teamNameMap[initiatorTeamId] || initiatorTeamId, sendNames, recvNames, notes, t.players_out, t.players_in)
    } catch (notifErr) { console.warn('Trade proposal notification failed', notifErr) }
  }

  return NextResponse.json({ success: true, proposalId: proposal.id })
}

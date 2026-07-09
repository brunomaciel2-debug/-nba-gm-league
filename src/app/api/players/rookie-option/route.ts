import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rookieOptionSalary } from '@/lib/draft-constants'
import { MIN_ROSTER, isFreeAgencyWindow, getActiveRosterCount } from '@/lib/roster-limits'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Exercise or decline a rookie's Team Option (Year 3 or Year 4). The dollar
// amount is always a fixed lookup by pick number — never a % raise off the
// player's current salary, so the hard salary cap stays predictable.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })

  const { playerId, action } = await req.json()
  if (!['exercise', 'decline'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const { data: player } = await admin.from('players')
    .select('id,name,team_id,salary,rookie_option_status,rookie_draft_round,rookie_draft_pick')
    .eq('id', playerId).single()
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  if (!player.rookie_option_status?.startsWith('pending_')) {
    return NextResponse.json({ error: 'No pending Team Option for this player' }, { status: 400 })
  }

  const isOwner = gm.team_id === player.team_id
  const isCommissioner = gm.role === 'commissioner'
  if (!isOwner && !isCommissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const stage: 'y3' | 'y4' = player.rookie_option_status === 'pending_y3' ? 'y3' : 'y4'
  const { data: team } = await admin.from('teams').select('cap_used').eq('id', player.team_id).single()

  if (action === 'exercise') {
    const newSalary = rookieOptionSalary(player.rookie_draft_round, player.rookie_draft_pick, stage)
    const delta = newSalary - (player.salary || 0)
    await admin.from('players').update({
      salary: newSalary, contract_years: 1,
      rookie_option_status: stage === 'y3' ? 'exercised_y3' : 'exercised_y4',
      rookie_option_deadline: null,
    }).eq('id', playerId)
    if (team) await admin.from('teams').update({ cap_used: Math.max(0, (team.cap_used || 0) + delta) }).eq('id', player.team_id)
    return NextResponse.json({ success: true, status: 'exercised', newSalary })
  }

  // Decline — player leaves the team entirely, their current salary comes off the cap.
  if (!(await isFreeAgencyWindow(admin)) && player.team_id) {
    const currentRoster = await getActiveRosterCount(admin, player.team_id)
    if (currentRoster - 1 < MIN_ROSTER) {
      return NextResponse.json({ error: `Declining this option would drop your roster below the ${MIN_ROSTER}-player minimum. Only allowed during the Free Agency week.` }, { status: 400 })
    }
  }
  if (team) await admin.from('teams').update({ cap_used: Math.max(0, (team.cap_used || 0) - (player.salary || 0)) }).eq('id', player.team_id)
  await admin.from('players').update({
    team_id: null, status: 'active', rookie_option_status: null, rookie_option_deadline: null, is_rookie_contract: false,
  }).eq('id', playerId)
  return NextResponse.json({ success: true, status: 'declined' })
}

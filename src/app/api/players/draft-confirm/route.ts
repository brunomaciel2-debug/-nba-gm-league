import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Confirm or decline a just-drafted rookie's contract. A drafted player sits
// as status='draft_pending' (invisible to every cap/roster query in the app)
// until the team confirms — only then does the salary count against the cap.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })

  const { playerId, action } = await req.json()
  if (!['confirm', 'decline'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const { data: player } = await admin.from('players').select('id,name,team_id,status,salary').eq('id', playerId).single()
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  if (player.status !== 'draft_pending') return NextResponse.json({ error: 'This player is not awaiting a draft confirmation' }, { status: 400 })

  const isOwner = gm.team_id === player.team_id
  const isCommissioner = gm.role === 'commissioner'
  if (!isOwner && !isCommissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  if (action === 'confirm') {
    await admin.from('players').update({ status: 'active', draft_confirm_deadline: null }).eq('id', playerId)
    const { data: team } = await admin.from('teams').select('cap_used').eq('id', player.team_id).single()
    await admin.from('teams').update({ cap_used: (team?.cap_used || 0) + (player.salary || 0) }).eq('id', player.team_id)
    return NextResponse.json({ success: true, status: 'confirmed' })
  }

  await admin.from('players').update({
    team_id: null, status: 'active', draft_confirm_deadline: null,
    is_rookie_contract: false, rookie_option_status: null, rookie_option_deadline: null,
  }).eq('id', playerId)
  return NextResponse.json({ success: true, status: 'declined' })
}

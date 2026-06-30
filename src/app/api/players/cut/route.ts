import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await supabaseAdmin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })

  const { playerId } = await req.json()
  if (!playerId) return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })

  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id,name,team_id,salary')
    .eq('id', playerId)
    .single()

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  if (!player.team_id) return NextResponse.json({ error: 'Player is already a free agent' }, { status: 400 })

  const isOwner = gm.team_id === player.team_id
  const isCommissioner = gm.role === 'commissioner'
  if (!isOwner && !isCommissioner) {
    return NextResponse.json({ error: 'Not authorized to release this player' }, { status: 403 })
  }

  // Release player — becomes a free agent
  await supabaseAdmin.from('players').update({
    team_id: null,
    salary: 0,
    contract_years: 0,
  }).eq('id', playerId)

  // Update team cap_used — remove this player's salary
  const { data: team } = await supabaseAdmin.from('teams').select('cap_used').eq('id', player.team_id).single()
  if (team) {
    const newCapUsed = Math.max(0, (team.cap_used || 0) - (player.salary || 0))
    await supabaseAdmin.from('teams').update({ cap_used: newCapUsed }).eq('id', player.team_id)
  }

  // Notify the team
  await supabaseAdmin.from('inbox_messages').insert({
    to_team_id: player.team_id,
    type: 'contract',
    subject: `✂️ ${player.name} released to free agency`,
    body: `${player.name} has been waived and is now an unrestricted free agent. Their salary of $${((player.salary||0)/1_000_000).toFixed(1)}M has been removed from your cap.`,
    read: false,
    metadata: { player_id: playerId, salary_freed: player.salary },
  })

  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MIN_ROSTER, isFreeAgencyWindow, getActiveRosterCount } from '@/lib/roster-limits'
import { recordPlayerTransaction } from '@/lib/player-transactions'

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

  if (!(await isFreeAgencyWindow(supabaseAdmin))) {
    const currentRoster = await getActiveRosterCount(supabaseAdmin, player.team_id)
    if (currentRoster - 1 < MIN_ROSTER) {
      return NextResponse.json({ error: `This would drop your roster below the ${MIN_ROSTER}-player minimum. Only allowed during the Free Agency week.` }, { status: 400 })
    }
  }

  // Release player — becomes a free agent
  // NOTE: salary remains on the releasing team's cap (dead cap) until another
  // team signs the player as a free agent. It does NOT free up cap space here.
  await supabaseAdmin.from('players').update({
    team_id: null,
    contract_years: 0,
    previous_team_id: player.team_id,
    dead_cap_amount: player.salary || 0,
  }).eq('id', playerId)

  // cap_used is intentionally left unchanged — dead cap hit remains
  // on the releasing team's cap_used until the player signs with a new team

  try {
    const { data: cfg } = await supabaseAdmin.from('season_config').select('current_week').eq('id', 1).single()
    await recordPlayerTransaction(supabaseAdmin, {
      playerId, type: 'cut', fromTeamId: player.team_id, toTeamId: null,
      season: '2025-26', week: (cfg?.current_week || 0) + 1,
    })
  } catch (txErr) { console.warn('Failed to record cut transaction history', txErr) }

  // Notify the team
  await supabaseAdmin.from('inbox_messages').insert({
    to_team_id: player.team_id,
    type: 'contract',
    subject: `✂️ ${player.name} released to free agency`,
    body: `${player.name} has been waived and is now an unrestricted free agent.\n\nNote: their salary of $${((player.salary||0)/1_000_000).toFixed(1)}M remains on your salary cap as dead money until another team signs them. Your cap space will not increase from this move.`,
    read: false,
    metadata: { player_id: playerId, dead_cap: player.salary },
  })

  return NextResponse.json({ success: true })
}

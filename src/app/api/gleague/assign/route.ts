import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const playerId = body.get('playerId') as string
  const teamId   = body.get('teamId') as string

  // Find the G-League affiliate for this team
  const { data: glTeam } = await admin.from('gleague_teams').select('id,name').eq('nba_affiliate', teamId).single()
  if (!glTeam) return NextResponse.redirect(new URL('/', req.url))

  await admin.from('players').update({
    on_gleague_assignment: true,
    gleague_team_id: glTeam.id
  }).eq('id', playerId)

  // Mirror into the site-wide Transactions feed — this move previously
  // happened completely silently, so /transactions never showed any sign
  // a player had ever been sent down or brought back up.
  try {
    const [{ data: player }, { data: cfg }] = await Promise.all([
      admin.from('players').select('name').eq('id', playerId).single(),
      admin.from('season_config').select('current_week').eq('id', 1).single(),
    ])
    const playerName = player?.name || `Player #${playerId}`
    await admin.from('transactions').insert({
      type: 'gleague_assign', category: 'player',
      description: `${playerName} assigned to the G-League (${glTeam.name})`,
      teams: [teamId], players: [playerName], player_ids: [playerId],
      status: 'completed', week_number: cfg?.current_week ?? null,
    })
  } catch (legacyErr) { console.warn('Failed to record G-League assignment transaction', legacyErr) }

  const referer = req.headers.get('referer') || '/'
  return NextResponse.redirect(new URL(referer, req.url))
}

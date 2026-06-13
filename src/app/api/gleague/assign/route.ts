import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const playerId = body.get('playerId') as string
  const teamId   = body.get('teamId') as string

  // Find the G-League affiliate for this team
  const { data: glTeam } = await admin.from('gleague_teams').select('id').eq('nba_affiliate', teamId).single()
  if (!glTeam) return NextResponse.redirect(new URL('/', req.url))

  await admin.from('players').update({
    on_gleague_assignment: true,
    gleague_team_id: glTeam.id
  }).eq('id', playerId)

  const referer = req.headers.get('referer') || '/'
  return NextResponse.redirect(new URL(referer, req.url))
}

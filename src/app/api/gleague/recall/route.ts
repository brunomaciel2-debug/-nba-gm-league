import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const playerId = body.get('playerId') as string

  await admin.from('players').update({
    on_gleague_assignment: false,
    gleague_team_id: null
  }).eq('id', playerId)

  const referer = req.headers.get('referer') || '/'
  return NextResponse.redirect(new URL(referer, req.url))
}

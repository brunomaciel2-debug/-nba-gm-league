import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revealAttributes } from '@/lib/scouting'

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

  const { tier, reveals, teamId: bodyTeamId } = await req.json()

  const isCommissioner = gm.role === 'commissioner'
  const actingTeamId = isCommissioner ? bodyTeamId : gm.team_id

  if (!actingTeamId) return NextResponse.json({ error: 'No team specified' }, { status: 403 })
  if (![1,2,3].includes(tier)) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  if (!Array.isArray(reveals) || reveals.length === 0) {
    return NextResponse.json({ error: 'No attributes selected' }, { status: 400 })
  }

  const result = await revealAttributes(actingTeamId, tier, reveals)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

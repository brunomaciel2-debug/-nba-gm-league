import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { table, id, field, value } = await req.json()

  // Only allow specific tables and fields
  const allowed: Record<string, string[]> = {
    players:      ['photo_url'],
    coaches:      ['photo_url'],
    teams:        ['logo_url'],
    gleague_teams:['logo_url'],
    world_teams:  ['logo_url'],
  }
  if (!allowed[table]?.includes(field)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { error } = await admin.from(table).update({ [field]: value }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

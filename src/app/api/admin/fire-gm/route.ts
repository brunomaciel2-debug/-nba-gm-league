import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { user_id, team_id } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    // 1. Apagar perfil GM
    const { error: profileErr } = await supabaseAdmin
      .from('gm_profiles')
      .delete()
      .eq('id', user_id)

    if (profileErr) {
      return NextResponse.json({ error: 'Profile error: ' + profileErr.message }, { status: 500 })
    }

    // 2. Apagar utilizador do Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (authErr) {
      return NextResponse.json({ error: 'Auth error: ' + authErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

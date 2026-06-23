import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { application_id, email, password, full_name, team_id } = await req.json()

    if (!application_id || !email || !password || !full_name || !team_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Criar utilizador no Supabase Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authErr) {
      return NextResponse.json({ error: 'Auth error: ' + authErr.message }, { status: 500 })
    }

    const userId = authData.user.id

    // 2. Criar perfil GM
    const { error: profileErr } = await supabaseAdmin
      .from('gm_profiles')
      .insert({ id: userId, team_id, display_name: full_name, role: 'gm' })

    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Profile error: ' + profileErr.message }, { status: 500 })
    }

    // 3. Actualizar status da candidatura
    await supabaseAdmin
      .from('job_applications')
      .update({ status: 'approved' })
      .eq('id', application_id)

    return NextResponse.json({ success: true, user_id: userId })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

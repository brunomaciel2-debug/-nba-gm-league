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

    // 1. Apagar mensagens de DM do team_id (canais que contêm o team_id)
    if (team_id) {
      const { data: dmMessages } = await supabaseAdmin
        .from('chat_messages')
        .select('id, channel')
        .like('channel', `%${team_id}%`)
        .neq('channel', 'general')

      if (dmMessages && dmMessages.length > 0) {
        const ids = dmMessages.map((m: any) => m.id)
        await supabaseAdmin.from('chat_messages').delete().in('id', ids)
      }

      // Apagar chat_reads do utilizador
      await supabaseAdmin.from('chat_reads').delete().eq('user_id', user_id)
    }

    // 1b. Fechar o mandato aberto — para o próximo GM desta equipa (se
    // houver) começar com uma folha em branco na Satisfação do GM.
    if (team_id) {
      const { data: seasonCfg } = await supabaseAdmin.from('season_config').select('current_week').eq('id', 1).single()
      await supabaseAdmin.from('gm_tenure_log')
        .update({ ended_week: seasonCfg?.current_week || null, ended_at: new Date().toISOString() })
        .eq('team_id', team_id).is('ended_week', null)
    }

    // 1c. Trade Block guarda quem adicionou cada jogador (added_by) sem
    // cascade — apagar a conta com essa referência ainda por limpar viola
    // a foreign key e falha (aconteceu de verdade: "Database error deleting
    // user" / trade_block_added_by_fkey). As entradas em si continuam
    // válidas para a equipa, só deixam de saber quem as pôs lá.
    await supabaseAdmin.from('trade_block').update({ added_by: null }).eq('added_by', user_id)

    // 2. Apagar perfil GM
    const { error: profileErr } = await supabaseAdmin
      .from('gm_profiles')
      .delete()
      .eq('id', user_id)

    if (profileErr) {
      return NextResponse.json({ error: 'Profile error: ' + profileErr.message }, { status: 500 })
    }

    // 3. Apagar utilizador do Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (authErr) {
      return NextResponse.json({ error: 'Auth error: ' + authErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

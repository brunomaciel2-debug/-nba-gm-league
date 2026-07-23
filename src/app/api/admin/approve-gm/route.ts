import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getTeamLang, notifWelcome } from '@/lib/notifications-helpers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'NBA GM League', email: 'brunomaciel2@gmail.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  return res.ok
}

export async function POST(req: NextRequest) {
  try {
    const { application_id, email, password, full_name, team_id, action } = await req.json()

    // REJEIÇÃO
    if (action === 'reject') {
      if (!application_id || !email || !full_name) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      await supabaseAdmin
        .from('job_applications')
        .update({ status: 'rejected' })
        .eq('id', application_id)

      await sendEmail(
        email,
        'Your NBA GM League Application',
        `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1512;">🏀 NBA GM League</h2>
          <p>Hi <strong>${full_name}</strong>,</p>
          <p>Thank you for your interest in managing an NBA franchise.</p>
          <p>After careful consideration, the Commissioner has decided not to move forward with your application at this time.</p>
          <p>You are welcome to apply again in the future when new vacancies open up.</p>
          <br/>
          <p style="color: #8a8279; font-size: 12px;">NBA GM League · nba-gm-league-mu.vercel.app</p>
        </div>
        `
      )
      return NextResponse.json({ success: true })
    }

    // APROVAÇÃO
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

    // 2b. Abrir um novo mandato — para a Satisfação do GM avaliar só este
    // GM a partir de agora, não herdar o histórico de quem lá esteve antes.
    const { data: seasonCfg } = await supabaseAdmin.from('season_config').select('season,current_week').eq('id', 1).single()
    await supabaseAdmin.from('gm_tenure_log').insert({
      team_id, gm_user_id: userId, gm_name: full_name,
      season: seasonCfg?.season || '2025-26', started_week: seasonCfg?.current_week || 1,
    })

    // 3. Actualizar status da candidatura
    await supabaseAdmin
      .from('job_applications')
      .update({ status: 'approved' })
      .eq('id', application_id)

    // 4. Buscar nome da equipa
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('name')
      .eq('id', team_id)
      .single()

    // 4b. Limpar a inbox da equipa (mensagens de quem lá esteve antes / da
    // vaga) e dar as boas-vindas ao novo GM com uma única mensagem — ver
    // pedido do Bruno: "quando um GM entra no jogo deve ter a inbox limpa".
    await supabaseAdmin.from('inbox_messages').delete().eq('to_team_id', team_id)
    const lang = await getTeamLang(team_id)
    const welcome = notifWelcome(lang, team?.name || team_id)
    await supabaseAdmin.from('inbox_messages').insert({
      to_team_id: team_id,
      type: 'welcome',
      subject: welcome.subject,
      body: welcome.body,
      read: false,
      metadata: {},
    })

    // 5. Enviar email de aprovação
    await sendEmail(
      email,
      'Welcome to NBA GM League! 🏀',
      `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1512;">🏀 NBA GM League</h2>
        <p>Hi <strong>${full_name}</strong>,</p>
        <p>Congratulations! Your application to manage the <strong>${team?.name || team_id}</strong> has been <strong style="color: #15803d;">approved</strong>!</p>
        <p>You can now log in to the platform with your credentials:</p>
        <div style="background: #f5f1eb; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 4px 0;"><strong>Password:</strong> ${password}</p>
        </div>
        <a href="https://nba-gm-league-mu.vercel.app/login"
           style="display: inline-block; background: #c8102e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
          Login Now →
        </a>
        <br/><br/>
        <p style="color: #8a8279; font-size: 12px;">NBA GM League · nba-gm-league-mu.vercel.app</p>
      </div>
      `
    )

    return NextResponse.json({ success: true, user_id: userId })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

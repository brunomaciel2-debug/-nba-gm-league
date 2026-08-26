import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { seedNBAPlayoffBracket } from '@/lib/playoff-resolver'
import { notify } from '@/lib/notifications'
import { getTeamLang, notifPlayoffsBegin } from '@/lib/notifications-helpers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Manual fallback/override — the bracket is now also seeded automatically
// the moment the regular season actually ends (see run.ts), but this stays
// available for the Commissioner to force a re-seed (e.g. after a manual
// standings correction) without waiting for the next simulate call.
export async function POST() {
  try {
    const result = await seedNBAPlayoffBracket()
    if (!result.success) return NextResponse.json({ error: result.error }, { status:500 })

    const { data: teams } = await supabaseAdmin.from('teams').select('id').not('id','in','(ALL,RVS,ROO,SOP)')
    const { data: playInEvent } = await supabaseAdmin.from('season_events')
      .select('start_date').eq('season','2025-26').eq('event_key','play_in').maybeSingle()
    for (const t of (teams || [])) {
      const lang = await getTeamLang(t.id)
      const notif = notifPlayoffsBegin(lang, playInEvent?.start_date || null)
      await notify(t.id, 'playoffs_begin', notif.subject, notif.body, {})
    }

    return NextResponse.json({ success:true, created:result.created })
  } catch(e:any) {
    return NextResponse.json({ error: e.message }, { status:500 })
  }
}

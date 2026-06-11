import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Mon sim = 3 recovery days (since Thu) | Thu sim = 2 recovery days (since Mon)
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { day_of_week } = await req.json()
  const recoveryDays = day_of_week === 'Monday' ? 3 : 2

  const [{ data: players }, { data: sc }] = await Promise.all([
    supabaseAdmin.from('players').select('id,health,moral,durability,team_id').eq('status','active'),
    supabaseAdmin.from('season_config').select('current_week').eq('id',1).single(),
  ])
  if (!players) return NextResponse.json({ error: 'No players' })

  const { data: orders } = await supabaseAdmin
    .from('gm_orders').select('team_id,training_intensity,pace').eq('week_number', sc?.current_week||1)
  const ordMap: Record<string,any> = {}
  ;(orders||[]).forEach((o:any) => ordMap[o.team_id] = o)

  const INTENSITY_MOD: Record<string,number> = {
    rest: 1.50, light: 1.25, normal: 1.00, intense: 0.50, very_intense: 0.25
  }

  let updated = 0
  for (const p of players) {
    const ord = ordMap[p.team_id] || {}
    const mod = INTENSITY_MOD[ord.training_intensity||'normal'] || 1.0
    const durBonus = ((p.durability||75) - 75) / 100 * 0.5
    const healthGain = 3 * recoveryDays * mod * (1 + durBonus)
    const moralGain  = (p.moral||80) < 50 ? 0 : 0.5 * recoveryDays
    const newHealth = Math.min(100, Math.round((p.health||100) + healthGain))
    const newMoral  = Math.min(100, Math.round((p.moral||80)  + moralGain))
    if (newHealth !== (p.health||100) || newMoral !== (p.moral||80)) {
      await supabaseAdmin.from('players').update({ health: newHealth, moral: newMoral }).eq('id', p.id)
      updated++
    }
  }
  return NextResponse.json({ success: true, updated, recovery_days: recoveryDays })
}

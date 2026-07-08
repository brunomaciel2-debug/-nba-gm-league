import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SLOT_ECONOMICS, SLOT_VARIANT_KEYS, SLOT_VARIANT_MAX } from '@/lib/audience-segments'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm?.team_id) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })
  const teamId = gm.team_id

  const { variantKey } = await req.json()
  const slotId = Object.keys(SLOT_VARIANT_KEYS).find(id => SLOT_VARIANT_KEYS[id].includes(variantKey))
  if (!slotId) return NextResponse.json({ error: 'Invalid concession variant' }, { status: 400 })
  const econ = SLOT_ECONOMICS[slotId]

  const { data: concessions } = await admin.from('arena_concessions').select('*').eq('team_id', teamId).single()
  if (!concessions) return NextResponse.json({ error: 'No arena concessions found' }, { status: 404 })

const variantMax = SLOT_VARIANT_MAX[variantKey] ?? 1
  if ((concessions[variantKey] || 0) >= variantMax) return NextResponse.json({ error: 'Already at maximum for this location' }, { status: 400 })

  const { data: fin } = await admin.from('franchise_finances').select('balance').eq('team_id', teamId).single()
  if (!fin || (fin.balance || 0) < econ.cost) return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 })

  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()

  await admin.from('franchise_finances').update({ balance: fin.balance - econ.cost }).eq('team_id', teamId)
  await admin.from('franchise_transactions').insert({
    team_id: teamId, type: 'expense', category: 'construction', amount: econ.cost,
    description: `Concession built — ${variantKey}`, season: '2025-26', week_number: cfg?.current_week || 0,
  })
  const current = concessions[variantKey] || 0
  await admin.from('arena_concessions').update({
    [variantKey]: current + 1, monthly_maintenance: (concessions.monthly_maintenance || 0) + econ.monthly,
  }).eq('id', concessions.id)

  return NextResponse.json({ success: true, cost: econ.cost })
}

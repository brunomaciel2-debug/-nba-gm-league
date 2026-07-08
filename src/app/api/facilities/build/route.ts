import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Costs/durations recomputed server-side from the same constants
// FacilitiesTab.tsx shows — never trust a client-supplied cost, or a
// tampered request could build anything for free.
const UPGRADES: Record<string, { cost: number, weeks: number, next: string }> = {
  F: { cost: 5000000, weeks: 4, next: 'E' },
  E: { cost: 12000000, weeks: 6, next: 'D' },
  D: { cost: 25000000, weeks: 8, next: 'C' },
  C: { cost: 50000000, weeks: 10, next: 'B' },
  B: { cost: 100000000, weeks: 12, next: 'A' },
}
const EXTRAS: Record<string, { cost: number, monthly: number }> = {
  has_pool: { cost: 8000000, monthly: 80000 },
  has_sauna: { cost: 2000000, monthly: 20000 },
  has_shooting_machine: { cost: 5000000, monthly: 100000 },
  has_film_room: { cost: 3000000, monthly: 50000 },
  has_sports_lab: { cost: 15000000, monthly: 200000 },
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm?.team_id) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })
  const teamId = gm.team_id

  const { action, extraKey } = await req.json()
  if (action !== 'upgrade_gym' && action !== 'build_extra') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const { data: facility } = await admin.from('practice_facilities').select('*').eq('team_id', teamId).single()
  if (!facility) return NextResponse.json({ error: 'No practice facility found' }, { status: 404 })

  const { data: fin } = await admin.from('franchise_finances').select('balance').eq('team_id', teamId).single()
  if (!fin) return NextResponse.json({ error: 'No franchise finances found' }, { status: 404 })
  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  const currentWeek = cfg?.current_week || 0

  if (action === 'upgrade_gym') {
    if (facility.gym_under_construction) return NextResponse.json({ error: 'Already under construction' }, { status: 400 })
    const upg = UPGRADES[facility.gym_grade]
    if (!upg) return NextResponse.json({ error: 'Already at maximum grade' }, { status: 400 })
    if ((fin.balance || 0) < upg.cost) return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 })

    const ends = new Date(); ends.setDate(ends.getDate() + upg.weeks * 7)
    const endsStr = ends.toISOString().split('T')[0]

    await admin.from('franchise_finances').update({ balance: fin.balance - upg.cost }).eq('team_id', teamId)
    await admin.from('franchise_transactions').insert({
      team_id: teamId, type: 'expense', category: 'construction', amount: upg.cost,
      description: `Practice facility upgrade ${facility.gym_grade} → ${upg.next}`, season: '2025-26', week_number: currentWeek,
    })
    await admin.from('practice_facilities').update({ gym_under_construction: true, gym_upgrade_ends_at: endsStr }).eq('id', facility.id)
    await admin.from('construction_queue').insert({
      team_id: teamId, construction_type: 'practice_facility', reference_id: facility.id,
      name: `Gym ${facility.gym_grade} → ${upg.next}`, cost: upg.cost, duration_weeks: upg.weeks,
      started_at: new Date().toISOString().split('T')[0], ends_at: endsStr, status: 'in_progress',
    })
    return NextResponse.json({ success: true, cost: upg.cost, endsAt: endsStr })
  }

  // build_extra
  const extra = EXTRAS[extraKey]
  if (!extra) return NextResponse.json({ error: 'Invalid facility extra' }, { status: 400 })
  if ((facility as any)[extraKey]) return NextResponse.json({ error: 'Already built' }, { status: 400 })
  if ((fin.balance || 0) < extra.cost) return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 })

  await admin.from('franchise_finances').update({ balance: fin.balance - extra.cost }).eq('team_id', teamId)
  await admin.from('franchise_transactions').insert({
    team_id: teamId, type: 'expense', category: 'construction', amount: extra.cost,
    description: `Practice facility extra — ${extraKey}`, season: '2025-26', week_number: currentWeek,
  })
  await admin.from('practice_facilities').update({ [extraKey]: true, monthly_cost: (facility.monthly_cost || 0) + extra.monthly }).eq('id', facility.id)
  return NextResponse.json({ success: true, cost: extra.cost })
}

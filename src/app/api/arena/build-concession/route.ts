import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SLOT_ECONOMICS, SLOT_VARIANT_KEYS, SLOT_VARIANT_MAX, CONCESSION_IS_PURCHASED } from '@/lib/audience-segments'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Roughly $1M of build cost per week, same order of magnitude as arena
// sections (BUILD_COST $8M/12wk, UPGRADE_COST $12M/8wk in build-section) —
// floored at 1 week (nothing is ever instant) and capped at 8 so the
// cheapest items (vending, mascot) don't feel punitive while the biggest
// (Courtside Lounge, $8M) still takes a real, felt commitment.
function durationWeeks(cost: number): number {
  return Math.max(1, Math.min(8, Math.round(cost / 1_000_000)))
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

  const { variantKey } = await req.json()
  const slotId = Object.keys(SLOT_VARIANT_KEYS).find(id => SLOT_VARIANT_KEYS[id].includes(variantKey))
  if (!slotId) return NextResponse.json({ error: 'Invalid concession variant' }, { status: 400 })
  const econ = SLOT_ECONOMICS[slotId]

  const { data: concessions } = await admin.from('arena_concessions').select('*').eq('team_id', teamId).single()
  if (!concessions) return NextResponse.json({ error: 'No arena concessions found' }, { status: 404 })

  // Count both what's already built AND what's already queued for this
  // exact variant — otherwise a GM could queue past a location's real cap
  // by clicking Build again before the first one finishes.
  const { data: pendingForVariant } = await admin.from('construction_queue')
    .select('id').eq('team_id', teamId).eq('construction_type', 'concession').eq('name', variantKey).eq('status', 'in_progress')
  const variantMax = SLOT_VARIANT_MAX[variantKey] ?? 1
  const alreadySpokenFor = (concessions[variantKey] || 0) + (pendingForVariant?.length || 0)
  if (alreadySpokenFor >= variantMax) return NextResponse.json({ error: 'Already at maximum for this location' }, { status: 400 })

  const { data: fin } = await admin.from('franchise_finances').select('balance').eq('team_id', teamId).single()
  if (!fin || (fin.balance || 0) < econ.cost) return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 })

  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  await admin.from('franchise_finances').update({ balance: fin.balance - econ.cost }).eq('team_id', teamId)

  // Bruno's split: a standalone unit that's simply bought already-made
  // (food kiosk, vending machine, mascot) has nothing to build — it's
  // ready the moment it's paid for. Only something that physically
  // attaches to the arena's own structure goes through real construction.
  if (CONCESSION_IS_PURCHASED[slotId]) {
    await admin.from('franchise_transactions').insert({
      team_id: teamId, type: 'expense', category: 'construction', amount: econ.cost,
      description: `Concession purchased — ${variantKey}`, season: '2025-26', week_number: cfg?.current_week || 0,
    })
    const current = concessions[variantKey] || 0
    await admin.from('arena_concessions').update({
      [variantKey]: current + 1, monthly_maintenance: (concessions.monthly_maintenance || 0) + econ.monthly,
    }).eq('id', concessions.id)
    return NextResponse.json({ success: true, cost: econ.cost, purchased: true })
  }

  const weeks = durationWeeks(econ.cost)
  const ends = new Date(); ends.setDate(ends.getDate() + weeks * 7)
  const endsStr = ends.toISOString().split('T')[0]

  await admin.from('franchise_transactions').insert({
    team_id: teamId, type: 'expense', category: 'construction', amount: econ.cost,
    description: `Concession under construction — ${variantKey}`, season: '2025-26', week_number: cfg?.current_week || 0,
  })
  // Not applied to arena_concessions yet — the weekly construction-queue
  // resolver in notifications.ts increments the count and monthly
  // maintenance once `ends_at` actually passes, same as arena sections and
  // the practice facility gym upgrade.
  await admin.from('construction_queue').insert({
    team_id: teamId, construction_type: 'concession', reference_id: concessions.id,
    name: variantKey, cost: econ.cost, duration_weeks: weeks,
    started_at: new Date().toISOString().split('T')[0], ends_at: endsStr, status: 'in_progress',
  })

  return NextResponse.json({ success: true, cost: econ.cost, endsAt: endsStr })
}

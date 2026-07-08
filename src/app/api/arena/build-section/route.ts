import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Same real costs ArenaView.tsx shows — recomputed server-side, never
// trusted from the client.
const BUILT_SECTIONS = ['N1', 'N2', 'N3', 'S1', 'S2', 'S3', 'W1', 'E1']
const UPGRADE_COST = 12000000
const BUILD_COST = 8000000
const UPGRADE_WEEKS = 8
const BUILD_WEEKS = 12

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm?.team_id) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })
  const teamId = gm.team_id

  const { section } = await req.json()
  if (!section) return NextResponse.json({ error: 'Missing section' }, { status: 400 })

  const { data: sectionRow } = await admin.from('arena_sections').select('*').eq('team_id', teamId).eq('section', section).single()
  if (!sectionRow) return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  if (sectionRow.under_construction) return NextResponse.json({ error: 'Already under construction' }, { status: 400 })

  const isBuilt = BUILT_SECTIONS.includes(section)
  const cost = isBuilt ? UPGRADE_COST : BUILD_COST
  const weeks = isBuilt ? UPGRADE_WEEKS : BUILD_WEEKS

  const { data: fin } = await admin.from('franchise_finances').select('balance').eq('team_id', teamId).single()
  if (!fin || (fin.balance || 0) < cost) return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 })

  const ends = new Date(); ends.setDate(ends.getDate() + weeks * 7)
  const endsStr = ends.toISOString().split('T')[0]
  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()

  await admin.from('franchise_finances').update({ balance: fin.balance - cost }).eq('team_id', teamId)
  await admin.from('franchise_transactions').insert({
    team_id: teamId, type: 'expense', category: 'construction', amount: cost,
    description: `Arena section ${isBuilt ? 'upgrade' : 'build'} — ${section}`, season: '2025-26', week_number: cfg?.current_week || 0,
  })
  await admin.from('arena_sections').update({ under_construction: true, construction_ends_at: endsStr }).eq('id', sectionRow.id)
  await admin.from('construction_queue').insert({
    team_id: teamId, construction_type: 'arena_section', reference_id: sectionRow.id,
    name: section, cost, duration_weeks: weeks,
    started_at: new Date().toISOString().split('T')[0], ends_at: endsStr, status: 'in_progress',
  })

  return NextResponse.json({ success: true, cost, endsAt: endsStr })
}

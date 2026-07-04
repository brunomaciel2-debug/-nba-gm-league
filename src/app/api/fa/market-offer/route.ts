import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStatusForWeek } from '@/lib/season-week-helper'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const CAP_LIMIT = 180_000_000
const MAX_ROSTER = 15
const MIN_SALARY = 1_000_000
const MAX_SALARY = 50_000_000
const MIN_YEARS = 1
const MAX_YEARS = 5

// Real, GM-picked contract offers during Free Agency week (season week 1) —
// distinct from the flat $650K/1yr deals in /api/fa/offer, which are only
// for the ongoing pickup pool once Free Agency week has ended.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')

  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('team_id').eq('id', user.id).single()
  if (!gm?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  const { playerId, salary, years } = await req.json()
  if (!playerId || !salary || !years) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  const nextWeek = (cfg?.current_week || 0) + 1
  const phase = getStatusForWeek(nextWeek)
  if (phase !== 'free-agency') {
    return NextResponse.json({ error: 'Market offers are only accepted during Free Agency week.' }, { status: 400 })
  }

  if (years < MIN_YEARS || years > MAX_YEARS) {
    return NextResponse.json({ error: `Years must be between ${MIN_YEARS} and ${MAX_YEARS}` }, { status: 400 })
  }
  if (salary < MIN_SALARY || salary > MAX_SALARY) {
    return NextResponse.json({ error: `Salary must be between $${MIN_SALARY/1_000_000}M and $${MAX_SALARY/1_000_000}M` }, { status: 400 })
  }

  const { data: player } = await admin.from('players').select('id,team_id,on_gleague_assignment').eq('id', playerId).single()
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  if (player.team_id) return NextResponse.json({ error: 'Player already on a team' }, { status: 400 })
  if (player.on_gleague_assignment) return NextResponse.json({ error: 'Player is on NBA assignment - cannot be signed' }, { status: 400 })

  const { data: roster } = await admin.from('players').select('id,salary').eq('team_id', gm.team_id).eq('status', 'active')
  const used = (roster || []).reduce((s: number, p: any) => s + (p.salary || 0), 0)
  if (used + salary > CAP_LIMIT) return NextResponse.json({ error: 'Insufficient cap space' }, { status: 400 })
  if ((roster || []).length >= MAX_ROSTER) return NextResponse.json({ error: 'Roster full' }, { status: 400 })

  // Upsert without touching created_at — a revised bid shouldn't reset this
  // player's decision-window clock for the OTHER teams bidding on him.
  const { error } = await admin.from('fa_market_offers').upsert(
    { player_id: playerId, team_id: gm.team_id, offered_by: user.id, salary, years },
    { onConflict: 'player_id,team_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, message: 'Offer submitted. The player will decide within 1-2 days.' })
}

export async function DELETE(req: NextRequest) {
  const { playerId } = await req.json()
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  const { data: gm } = await admin.from('gm_profiles').select('team_id').eq('id', user.id).single()
  if (!gm?.team_id) return NextResponse.json({ error: 'No team' }, { status: 403 })
  await admin.from('fa_market_offers').delete().eq('player_id', playerId).eq('team_id', gm.team_id).eq('status', 'pending')
  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStatusForWeek } from '@/lib/season-week-helper'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { playerId } = await req.json()
  if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 })

  // Auth check
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get GM team
  const { data: profile } = await admin.from('gm_profiles').select('team_id').eq('id', user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })

  // This flat $650K deal only exists outside Free Agency week (real, GM-picked
  // offers happen there instead) and stops entirely 2 weeks before the playoffs.
  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  const nextWeek = (cfg?.current_week || 0) + 1
  const phase = getStatusForWeek(nextWeek)
  if (phase === 'free-agency') {
    return NextResponse.json({ error: 'This is Free Agency week — submit a full contract offer instead of the quick $650K deal. See the negotiation panel on the player page.' }, { status: 400 })
  }
  if (nextWeek >= 39) {
    return NextResponse.json({ error: 'Free agent signings are closed — the roster freeze starts 2 weeks before the play-in.' }, { status: 400 })
  }

  // Get player
  const { data: player } = await admin.from('players').select('id, name, team_id, gleague_team_id, on_gleague_assignment, rookie_draft_season').eq('id', playerId).single()
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  if (player.team_id) return NextResponse.json({ error: 'Player already on a team' }, { status: 400 })
  if (player.on_gleague_assignment) return NextResponse.json({ error: 'Player is on NBA assignment - cannot be signed' }, { status: 400 })
  // rookie_draft_season only blocks signing if that class hasn't actually
  // been drafted yet — a past class (already drafted, now a genuine FA) is
  // fine, only the upcoming class in draft_config.next_draft_season isn't.
  const { data: draftCfg } = await admin.from('draft_config').select('next_draft_season').eq('id', 1).maybeSingle()
  if (player.rookie_draft_season && draftCfg?.next_draft_season && player.rookie_draft_season >= draftCfg.next_draft_season) {
    return NextResponse.json({ error: 'This player is a future draft prospect, not yet drafted — cannot be signed' }, { status: 400 })
  }

  // Check cap room - $650k for 1 year
  const OFFER_SALARY = 650000
  const { data: roster } = await admin.from('players').select('salary').eq('team_id', profile.team_id).eq('status', 'active')
  const used = (roster || []).reduce((s: number, p: any) => s + (p.salary || 0), 0)
  const CAP = 180_000_000 // matches teams.salary_cap and the cap used everywhere else in the app
  if (used + OFFER_SALARY > CAP) return NextResponse.json({ error: 'Insufficient cap space' }, { status: 400 })

  // Insert or ignore duplicate offer
  const { error } = await admin.from('fa_offers').upsert({ player_id: playerId, team_id: profile.team_id }, { onConflict: 'player_id,team_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, message: 'Offer submitted. Resolution at midnight.' })
}

export async function DELETE(req: NextRequest) {
  const { playerId } = await req.json()
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await admin.from('gm_profiles').select('team_id').eq('id', user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: 'No team' }, { status: 403 })
  await admin.from('fa_offers').delete().eq('player_id', playerId).eq('team_id', profile.team_id)
  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSpecialistEligible, SPECIALIST_COST_BY_SEVERITY, SPECIALIST_BOOST_MULTIPLIER_BY_SEVERITY } from '@/lib/injury-constants'
import { getTeamLang } from '@/lib/notifications-helpers'
import { notify } from '@/lib/notifications'
import { notifSpecialistUsed } from '@/lib/notifications-helpers'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// "See a Specialist" — pay to send an injured player to an outside, generic
// medical specialist (not a hired staff member). This does NOT instantly
// heal the player — it speeds up their normal weekly recovery (on top of
// whatever the Physio already contributes) for as long as the injury stays
// open. Cost and speedup both scale with the injury's severity; usable once
// per injury.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })

  const { playerId } = await req.json()
  const { data: player } = await admin.from('players').select('id,name,team_id,health,status').eq('id', playerId).single()
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const isOwner = gm.team_id === player.team_id
  const isCommissioner = gm.role === 'commissioner'
  if (!isOwner && !isCommissioner) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { data: injuries } = await admin.from('injury_log').select('id,severity,specialist_used')
    .eq('player_id', playerId).eq('status', 'active').order('created_at', { ascending: false }).limit(1)
  const injury = injuries?.[0]
  if (!injury) return NextResponse.json({ error: 'No active injury for this player' }, { status: 400 })
  if (injury.specialist_used) return NextResponse.json({ error: 'Specialist already consulted for this injury' }, { status: 400 })
  if (!isSpecialistEligible(injury.severity)) return NextResponse.json({ error: 'This injury is not severe enough to need a specialist' }, { status: 400 })

  const cost = SPECIALIST_COST_BY_SEVERITY[injury.severity]!
  const boost = SPECIALIST_BOOST_MULTIPLIER_BY_SEVERITY[injury.severity]!

  const { data: fin } = await admin.from('franchise_finances').select('balance').eq('team_id', player.team_id).single()
  if (!fin || (fin.balance || 0) < cost) return NextResponse.json({ error: 'Not enough balance to cover the specialist fee' }, { status: 400 })

  // Marks the injury as boosted — the weekly recovery step (cron/simulate)
  // picks this up and applies the multiplier on top of the normal regen and
  // any Physio bonus, every week, until the player naturally crosses back
  // above 50 health. No instant health change here.
  await admin.from('injury_log').update({ specialist_used: true }).eq('id', injury.id)

  const { data: sc } = await admin.from('season_config').select('current_week').eq('id', 1).single()

  await admin.from('franchise_finances').update({ balance: (fin.balance || 0) - cost }).eq('team_id', player.team_id)
  await admin.from('franchise_transactions').insert({
    team_id: player.team_id, type: 'expense', category: 'specialist', amount: cost,
    description: `Specialist consultation — ${player.name}`, season: '2025-26', week_number: sc?.current_week,
  })

  const lang = await getTeamLang(player.team_id)
  const notif = notifSpecialistUsed(lang, player.name, cost, boost)
  await notify(player.team_id, 'injury', notif.subject, notif.body, { player_id: playerId })

  return NextResponse.json({ success: true, boost, cost })
}

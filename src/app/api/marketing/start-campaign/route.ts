import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Small/Medium/Large ad-campaign budget tiers, same "tiered choice"
// pattern as the Practice Facility grades — this buys ads/promo using the
// player's image to sell more jerseys FOR ONE MONTH (a real sales boost %
// on top of whatever he'd normally sell), never a change to his hidden
// fame. See resolveMonthlyMerchandising() in src/lib/merchandising.ts,
// which resolves this into a real sales bump or a wasted-money backfire
// depending on whether the player is actually still performing that month.
const BUDGET_TIERS: Record<string, { cost: number, boost: number }> = {
  small:  { cost: 250000,  boost: 25 },
  medium: { cost: 750000,  boost: 50 },
  large:  { cost: 2000000, boost: 90 },
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

  const { playerId, tier } = await req.json()
  const tierConfig = BUDGET_TIERS[tier]
  if (!playerId || !tierConfig) return NextResponse.json({ error: 'Invalid player or tier' }, { status: 400 })

  const { data: player } = await admin.from('players').select('id,name,team_id').eq('id', playerId).single()
  if (!player || player.team_id !== teamId) return NextResponse.json({ error: 'Player is not on your roster' }, { status: 400 })

  const { data: existing } = await admin.from('marketing_campaigns').select('id').eq('player_id', playerId).eq('status', 'active').maybeSingle()
  if (existing) return NextResponse.json({ error: 'This player already has an active campaign' }, { status: 400 })

  const { data: fin } = await admin.from('franchise_finances').select('balance').eq('team_id', teamId).single()
  if (!fin || (fin.balance || 0) < tierConfig.cost) return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 })

  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  const startWeek = (cfg?.current_week || 0) + 1

  await admin.from('franchise_finances').update({ balance: fin.balance - tierConfig.cost }).eq('team_id', teamId)
  await admin.from('franchise_transactions').insert({
    team_id: teamId, type: 'expense', category: 'marketing', amount: tierConfig.cost,
    description: `Marketing campaign — ${player.name}`, season: '2025-26', week_number: startWeek,
  })
  const { data: campaign, error } = await admin.from('marketing_campaigns').insert({
    team_id: teamId, player_id: playerId, budget: tierConfig.cost,
    sales_boost_pct: tierConfig.boost, start_week: startWeek, status: 'active',
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, campaign })
}

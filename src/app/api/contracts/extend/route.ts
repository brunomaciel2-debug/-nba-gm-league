import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CAP_LIMIT = 180_000_000
const MAX_SALARY = 50_000_000
const MAX_INCREASE_PCT = 0.40
const MIN_YEARS = 2
const MAX_YEARS = 5
const ELIGIBLE_YEARS_LEFT = 2

function fairValueForOvr(ovr: number) {
  return Math.min(MAX_SALARY, Math.max(1_000_000, Math.round((ovr - 60) * 1_200_000)))
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await supabaseAdmin.from('gm_profiles').select('team_id').eq('id', user.id).single()
  if (!gm?.team_id) return NextResponse.json({ error: 'No team found' }, { status: 403 })

  const { playerId, offeredSalary, offeredYears } = await req.json()

  if (!playerId || !offeredSalary || !offeredYears) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (offeredYears < MIN_YEARS || offeredYears > MAX_YEARS) {
    return NextResponse.json({ error: `Years must be between ${MIN_YEARS} and ${MAX_YEARS}` }, { status: 400 })
  }

  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id,name,team_id,age,real_ovr,salary,contract_years,moral')
    .eq('id', playerId)
    .single()

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  if (player.team_id !== gm.team_id) return NextResponse.json({ error: 'Player is not on your team' }, { status: 403 })
  if (player.contract_years > ELIGIBLE_YEARS_LEFT) {
    return NextResponse.json({ error: `Player has ${player.contract_years} years left — not eligible for extension yet` }, { status: 400 })
  }

  // Check one offer per season
  const { data: existing } = await supabaseAdmin
    .from('contract_extension_offers')
    .select('id')
    .eq('player_id', playerId)
    .eq('season', '2025-26')
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'An offer has already been made this season' }, { status: 400 })

  // Validate salary against max allowed
  const capMaxRaise = Math.round(player.salary * (1 + MAX_INCREASE_PCT))
  const { data: team } = await supabaseAdmin.from('teams').select('cap_used').eq('id', gm.team_id).single()
  const capSpace = (CAP_LIMIT - (team?.cap_used || 0)) + player.salary
  const maxAllowed = Math.min(MAX_SALARY, capMaxRaise, capSpace)

  if (offeredSalary > maxAllowed) {
    return NextResponse.json({ error: `Offer exceeds maximum allowed salary of $${(maxAllowed/1_000_000).toFixed(1)}M` }, { status: 400 })
  }
  if (offeredSalary < 1_000_000) {
    return NextResponse.json({ error: 'Minimum salary is $1M' }, { status: 400 })
  }

  // Cap check: new cap_used after replacing old salary with new one
  const newCapUsed = (team?.cap_used || 0) - player.salary + offeredSalary
  if (newCapUsed > CAP_LIMIT) {
    return NextResponse.json({ error: 'This offer would exceed your salary cap' }, { status: 400 })
  }

  // ── Decision logic ──────────────────────────────────────
  const fairValue = fairValueForOvr(player.real_ovr)
  const fairnessRatio = offeredSalary / fairValue // >1 = generous, <1 = lowball

  // Base acceptance probability factors
  let acceptScore = 0

  // Fairness — heavily weighted
  if (fairnessRatio >= 1.0) acceptScore += 50
  else if (fairnessRatio >= 0.85) acceptScore += 35
  else if (fairnessRatio >= 0.70) acceptScore += 15
  else acceptScore += 0 // lowball offers rarely accepted

  // Moral — happier players are easier to re-sign
  const moral = player.moral ?? 70
  acceptScore += (moral / 100) * 25

  // Age — veterans value security more than young stars testing the market
  if (player.age >= 32) acceptScore += 20
  else if (player.age >= 28) acceptScore += 12
  else if (player.age <= 24 && player.real_ovr >= 85) acceptScore -= 10 // young stars want to test FA
  else acceptScore += 5

  // Contract length bonus — longer security slightly favoured by vets, slightly disfavoured by young risers
  if (offeredYears >= 4 && player.age >= 30) acceptScore += 5
  if (offeredYears <= 2 && player.age <= 24) acceptScore += 5

  const accepted = acceptScore >= 55

  let rejectionReason = ''
  if (!accepted) {
    if (fairnessRatio < 0.70) rejectionReason = `"That's well below my market value. I expect closer to $${(fairValue/1_000_000).toFixed(0)}M."`
    else if (moral < 50) rejectionReason = `"I'm not happy here right now — I need more than money to commit long-term."`
    else if (player.age <= 24 && player.real_ovr >= 85) rejectionReason = `"I want to see what's out there before I commit my prime years."`
    else rejectionReason = `"It's close, but not quite enough for me to sign right now."`
  }

  // ── Save offer ──────────────────────────────────────────
  const { data: offer } = await supabaseAdmin.from('contract_extension_offers').insert({
    player_id: playerId,
    team_id: gm.team_id,
    season: '2025-26',
    offered_salary: offeredSalary,
    offered_years: offeredYears,
    status: accepted ? 'accepted' : 'rejected',
    fair_value: fairValue,
    current_salary: player.salary,
    rejection_reason: accepted ? null : rejectionReason,
    resolved_at: new Date().toISOString(),
  }).select().single()

  // If accepted, update player contract
  if (accepted) {
    await supabaseAdmin.from('players').update({
      salary: offeredSalary,
      contract_years: offeredYears,
    }).eq('id', playerId)

    await supabaseAdmin.from('teams').update({
      cap_used: newCapUsed,
    }).eq('id', gm.team_id)

    // Notify
    await supabaseAdmin.from('inbox_messages').insert({
      to_team_id: gm.team_id,
      type: 'contract',
      subject: `✅ ${player.name} signed an extension!`,
      body: `${player.name} has agreed to a ${offeredYears}-year extension worth $${(offeredSalary/1_000_000).toFixed(1)}M per year.\n\nNew contract: $${(offeredSalary/1_000_000).toFixed(1)}M/yr × ${offeredYears} years.`,
      read: false,
      metadata: { player_id: playerId, salary: offeredSalary, years: offeredYears },
    })
  } else {
    await supabaseAdmin.from('inbox_messages').insert({
      to_team_id: gm.team_id,
      type: 'contract',
      subject: `❌ ${player.name} rejected your extension offer`,
      body: `${player.name} turned down your offer of $${(offeredSalary/1_000_000).toFixed(1)}M/yr × ${offeredYears} years.\n\n${rejectionReason}\n\nYou won't be able to make another offer this season — they'll be a free agent if not re-signed before their contract expires.`,
      read: false,
      metadata: { player_id: playerId, offered_salary: offeredSalary },
    })
  }

  return NextResponse.json({ accepted, reason: rejectionReason, offer })
}

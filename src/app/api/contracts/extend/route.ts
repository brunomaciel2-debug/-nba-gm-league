import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CAP_LIMIT = 180_000_000
const MAX_SALARY = 50_000_000
const MAX_INCREASE_PCT = 0.40
const MIN_YEARS = 1
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

  const { data: gm } = await supabaseAdmin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })

  const { playerId, offeredSalary, offeredYears } = await req.json()

  if (!playerId || !offeredSalary || !offeredYears) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (offeredYears < MIN_YEARS || offeredYears > MAX_YEARS) {
    return NextResponse.json({ error: `Years must be between ${MIN_YEARS} and ${MAX_YEARS}` }, { status: 400 })
  }

  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id,name,team_id,age,real_ovr,salary,contract_years,moral,ambition,greediness,loyalty')
    .eq('id', playerId)
    .single()

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const isOwner = gm.team_id === player.team_id
  const isCommissioner = gm.role === 'commissioner'
  if (!isOwner && !isCommissioner) {
    return NextResponse.json({ error: 'Not authorized to extend this player' }, { status: 403 })
  }

  // The acting team is always the player's actual team (handles commissioner case)
  const actingTeamId = player.team_id
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
  const { data: team } = await supabaseAdmin.from('teams').select('cap_used').eq('id', actingTeamId).single()
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

  const moral = player.moral ?? 70
  const ambition = player.ambition ?? 50
  const greediness = player.greediness ?? 50
  const loyalty = player.loyalty ?? 50

  // Base acceptance probability factors
  let acceptScore = 0

  // Fairness — heavily weighted, more so for greedy players
  const greedFactor = 1 + (greediness - 50) / 100 // 0.5 to 1.5
  if (fairnessRatio >= 1.0) acceptScore += 45 * greedFactor
  else if (fairnessRatio >= 0.85) acceptScore += 32 * greedFactor
  else if (fairnessRatio >= 0.70) acceptScore += 14 * greedFactor
  else acceptScore -= 5 * greedFactor // greedy players actively penalise lowball offers harder

  // Moral — happier players are easier to re-sign
  acceptScore += (moral / 100) * 18

  // Loyalty — loyal players give a "hometown discount" tolerance, accepting fairer offers more readily
  acceptScore += (loyalty / 100) * 15
  if (loyalty >= 70 && fairnessRatio >= 0.80) acceptScore += 8 // loyal players forgive slightly below-market offers

  // Ambition — ambitious players want to test free agency unless the offer is excellent
  if (ambition >= 70) {
    if (fairnessRatio >= 1.05) acceptScore += 5 // only a great offer overcomes ambition
    else acceptScore -= 15
  } else if (ambition <= 30) {
    acceptScore += 10 // low-ambition players are easier to satisfy and re-sign
  }

  // Age — veterans value security more than young stars testing the market
  if (player.age >= 32) acceptScore += 15
  else if (player.age >= 28) acceptScore += 8
  else if (player.age <= 24 && player.real_ovr >= 85) acceptScore -= 8 // young stars want to test FA

  // Contract length — interacts with ambition and loyalty
  if (offeredYears === 1) {
    // Prove-it deals: ambitious players like the quick re-entry to FA, loyal players are lukewarm
    if (ambition >= 60) acceptScore += 6
    if (loyalty >= 60) acceptScore -= 4
  } else if (offeredYears >= 4) {
    // Long-term security: loyal and older players love it, ambitious young players resist
    if (loyalty >= 60 || player.age >= 30) acceptScore += 6
    if (ambition >= 70 && player.age <= 26) acceptScore -= 8
  }

  const accepted = acceptScore >= 55

  let rejectionReason = ''
  if (!accepted) {
    if (fairnessRatio < 0.70) rejectionReason = `"That's well below my market value. I expect closer to $${(fairValue/1_000_000).toFixed(0)}M."`
    else if (ambition >= 70 && fairnessRatio < 1.05) rejectionReason = `"I appreciate it, but I want to see what I'm worth on the open market."`
    else if (moral < 50) rejectionReason = `"I'm not happy here right now — I need more than money to commit long-term."`
    else if (player.age <= 24 && player.real_ovr >= 85) rejectionReason = `"I want to see what's out there before I commit my prime years."`
    else rejectionReason = `"It's close, but not quite enough for me to sign right now."`
  }

  // ── Save offer ──────────────────────────────────────────
  const { data: offer } = await supabaseAdmin.from('contract_extension_offers').insert({
    player_id: playerId,
    team_id: actingTeamId,
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
    }).eq('id', actingTeamId)

    try {
      const { data: team } = await supabaseAdmin.from('teams').select('name').eq('id', actingTeamId).single()
      const { data: cfg } = await supabaseAdmin.from('season_config').select('current_week').eq('id', 1).single()
      await supabaseAdmin.from('transactions').insert({
        type: 'extension', category: 'player',
        description: `${player.name} signs a ${offeredYears}-year extension worth $${(offeredSalary/1_000_000).toFixed(1)}M/yr with ${team?.name || actingTeamId}`,
        teams: [actingTeamId], players: [player.name], status: 'completed',
        week_number: (cfg?.current_week || 0) + 1,
      })
    } catch (txErr) { console.warn('Failed to record extension transaction history', txErr) }

    // Notify
    await supabaseAdmin.from('inbox_messages').insert({
      to_team_id: actingTeamId,
      type: 'contract',
      subject: `✅ ${player.name} signed an extension!`,
      body: `${player.name} has agreed to a ${offeredYears}-year extension worth $${(offeredSalary/1_000_000).toFixed(1)}M per year.\n\nNew contract: $${(offeredSalary/1_000_000).toFixed(1)}M/yr × ${offeredYears} years.`,
      read: false,
      metadata: { player_id: playerId, salary: offeredSalary, years: offeredYears },
    })
  } else {
    await supabaseAdmin.from('inbox_messages').insert({
      to_team_id: actingTeamId,
      type: 'contract',
      subject: `❌ ${player.name} rejected your extension offer`,
      body: `${player.name} turned down your offer of $${(offeredSalary/1_000_000).toFixed(1)}M/yr × ${offeredYears} years.\n\n${rejectionReason}\n\nYou won't be able to make another offer this season — they'll be a free agent if not re-signed before their contract expires.`,
      read: false,
      metadata: { player_id: playerId, offered_salary: offeredSalary },
    })
  }

  return NextResponse.json({ accepted, reason: rejectionReason, offer })
}

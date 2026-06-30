import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CAP_LIMIT = 180_000_000
const MAX_SALARY = 50_000_000
const MAX_INCREASE_PCT = 0.40

function fairValueForOvr(ovr: number) {
  return Math.min(MAX_SALARY, Math.max(1_000_000, Math.round((ovr - 60) * 1_200_000)))
}

function estimateAcceptChance(
  fairnessRatio: number, years: number,
  moral: number, ambition: number, greediness: number, loyalty: number, age: number, ovr: number
) {
  let score = 0
  const greedFactor = 1 + (greediness - 50) / 100
  if (fairnessRatio >= 1.0) score += 45 * greedFactor
  else if (fairnessRatio >= 0.85) score += 32 * greedFactor
  else if (fairnessRatio >= 0.70) score += 14 * greedFactor
  else score -= 5 * greedFactor

  score += (moral / 100) * 18
  score += (loyalty / 100) * 15
  if (loyalty >= 70 && fairnessRatio >= 0.80) score += 8

  if (ambition >= 70) {
    if (fairnessRatio >= 1.05) score += 5
    else score -= 15
  } else if (ambition <= 30) {
    score += 10
  }

  if (age >= 32) score += 15
  else if (age >= 28) score += 8
  else if (age <= 24 && ovr >= 85) score -= 8

  if (years === 1) {
    if (ambition >= 60) score += 6
    if (loyalty >= 60) score -= 4
  } else if (years >= 4) {
    if (loyalty >= 60 || age >= 30) score += 6
    if (ambition >= 70 && age <= 26) score -= 8
  }

  // Convert score (roughly -30 to 100) to a rough percentage estimate
  return Math.max(2, Math.min(97, Math.round(score)))
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await supabaseAdmin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })

  const { playerId } = await req.json()
  if (!playerId) return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })

  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id,name,team_id,age,real_ovr,salary,contract_years,moral,ambition,greediness,loyalty')
    .eq('id', playerId)
    .single()

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const isOwner = gm.team_id === player.team_id
  const isCommissioner = gm.role === 'commissioner'
  if (!isOwner && !isCommissioner) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { data: team } = await supabaseAdmin.from('teams').select('cap_used').eq('id', player.team_id).single()
  const capMaxRaise = Math.round(player.salary * (1 + MAX_INCREASE_PCT))
  const capSpace = (CAP_LIMIT - (team?.cap_used || 0)) + player.salary
  const maxAllowed = Math.min(MAX_SALARY, capMaxRaise, capSpace)
  const fairValue = Math.min(maxAllowed, fairValueForOvr(player.real_ovr))

  const moral = player.moral ?? 70
  const ambition = player.ambition ?? 50
  const greediness = player.greediness ?? 50
  const loyalty = player.loyalty ?? 50
  const age = player.age ?? 27
  const ovr = player.real_ovr ?? 75

  // Suggested years based on age/ambition profile
  const suggestedYears = age >= 32 ? 2 : ambition >= 70 && age <= 26 ? 2 : loyalty >= 65 ? 4 : 3

  const tiers = [
    {
      label: 'Minimum Offer',
      salary: Math.round(Math.max(1_000_000, fairValue * 0.65) / 100_000) * 100_000,
      years: Math.max(1, suggestedYears - 1),
    },
    {
      label: 'Fair Offer',
      salary: Math.round(fairValue / 100_000) * 100_000,
      years: suggestedYears,
    },
    {
      label: 'Maximum Offer',
      salary: Math.round(maxAllowed / 100_000) * 100_000,
      years: Math.min(5, suggestedYears + 1),
    },
  ]

  const suggestions = tiers.map(tier => {
    const fairnessRatio = tier.salary / fairValue
    const acceptChance = estimateAcceptChance(fairnessRatio, tier.years, moral, ambition, greediness, loyalty, age, ovr)

    let risk: string
    let riskNote: string
    if (acceptChance >= 70) {
      risk = 'Low Risk'
      riskNote = 'Likely to be accepted, but you may be overpaying relative to the fair market estimate.'
    } else if (acceptChance >= 40) {
      risk = 'Moderate Risk'
      riskNote = 'A balanced offer — reasonable chance of acceptance without overcommitting cap space.'
    } else {
      risk = 'High Risk'
      riskNote = `${player.name} is likely to reject this — ${ambition >= 70 ? 'their ambition makes them want to test the market' : greediness >= 65 ? 'their demands likely exceed this offer' : 'the offer is below what they consider fair'}.`
    }

    return {
      ...tier,
      acceptChance,
      risk,
      riskNote,
    }
  })

  // Personality summary for context
  const traits: string[] = []
  if (ambition >= 70) traits.push('highly ambitious — wants to prove themselves on a bigger stage or test free agency')
  else if (ambition <= 30) traits.push('low ambition — values stability over chasing a bigger role')
  if (greediness >= 65) traits.push('financially driven — will push hard for top dollar')
  else if (greediness <= 35) traits.push('not money-motivated — fair treatment matters more than max salary')
  if (loyalty >= 65) traits.push('loyal — willing to take a slight discount to stay with the team')
  else if (loyalty <= 35) traits.push('low loyalty — won\'t hesitate to leave for a better deal elsewhere')

  return NextResponse.json({
    player: { name: player.name, age, real_ovr: ovr, moral, ambition, greediness, loyalty },
    fairValue,
    maxAllowed,
    suggestions,
    personalitySummary: traits.length ? traits.join('; ') : 'Balanced personality profile — no strong tendencies either way.',
  })
}

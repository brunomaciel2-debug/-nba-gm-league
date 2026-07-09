import { supabaseAdmin } from '@/lib/supabase'
import { notify } from '@/lib/notifications'
import { getTeamLang } from '@/lib/notifications-helpers'
import { computeRosterQuality, normalizeRosterQuality, computeWinNowIndex, winNowLabel, computeTop5AvgAge, countHighPotential, WinNowLabel } from '@/lib/roster-quality'

const SEASON = '2025-26'
const CAP_LIMIT = 180_000_000 // mirrors notifications.ts CAP_LIMIT

function clamp(v: number, lo = 0, hi = 100): number { return Math.min(hi, Math.max(lo, v)) }

// ── PURE FORMULAS ─────────────────────────────────────────────────
// Every score below is 0-100. `wni` (Win-Now Index, from roster-quality.ts)
// is the 0 (rebuild) to 1 (contender) team-situation score every
// expectation is calibrated against.

// A rebuild team is expected to win ~25%, a true contender ~75% — the
// midpoint (50%) is what an average, situationally-neutral team should win.
export function expectedWinPct(wni: number): number {
  return 0.5 + (wni - 0.5) * 0.5
}

// How the team's ACTUAL win% compares to what its situation says it should
// be — this is the "performance vs expectation" gap, not a raw win% score.
export function computeResultsScore(actualWinPct: number, wni: number): number {
  const gap = actualWinPct - expectedWinPct(wni)
  return clamp(50 + gap * 150)
}

// "Exciting young team with real potential" — the thing a rebuilding team's
// fans actually want, per Bruno's own framing. avgYoungRealOvrDelta is a
// usage-weighted proxy for "how much has our under-25 talent visibly
// improved this season" (see resolver below for exact derivation from
// attribute_development).
export function computeYouthExcitement(avgYoungRealOvrDelta: number, highPotentialCount: number): number {
  const youthDevScore = clamp(50 + avgYoungRealOvrDelta * 10)
  const prospectHypeScore = clamp(highPotentialCount * 15)
  return 0.6 * youthDevScore + 0.4 * prospectHypeScore
}

// "Clubhouse culture" — real roster morale plus a penalty for unresolved
// player discontent (open trade-demand-type Player Interactions).
export function computeCultureScore(avgRosterMoral: number, openInteractionCount: number): number {
  const openInteractionPenalty = Math.min(100, openInteractionCount * 15)
  return clamp(0.6 * avgRosterMoral + 0.4 * (100 - openInteractionPenalty))
}

export type FansInputs = {
  actualWinPct: number, wni: number, avgYoungRealOvrDelta: number, highPotentialCount: number,
  popularity: number, avgRosterMoral: number, openInteractionCount: number,
}

// A rebuilding team's fans are judged mostly on the development story (15%
// results / 50% youth excitement); a contender's fans are judged almost
// entirely on results (65% results / 0% youth excitement) — the direct
// operationalization of "não é suposto uma equipa em rebuild ter fãs
// furiosos por não ganhar o campeonato."
export function computeFansScore(inputs: FansInputs): { score: number, breakdown: Record<string, number> } {
  const resultsScore = computeResultsScore(inputs.actualWinPct, inputs.wni)
  const youthExcitement = computeYouthExcitement(inputs.avgYoungRealOvrDelta, inputs.highPotentialCount)
  const cultureScore = computeCultureScore(inputs.avgRosterMoral, inputs.openInteractionCount)
  const imageScore = inputs.popularity

  const wResults = 0.15 + 0.50 * inputs.wni
  const wDev = 0.50 - 0.50 * inputs.wni

  const score = clamp(wResults * resultsScore + wDev * youthExcitement + 0.20 * imageScore + 0.15 * cultureScore)
  return { score, breakdown: { resultsScore, youthExcitement, imageScore, cultureScore, wResults, wDev } }
}

// Rewards fielding more talent than the cap spend alone implies, and
// banking extra draft capital — real asset-management signals, not just
// "did you win."
export function computeManagementScore(rosterQualityNorm: number, capUtilizationPct: number, extraPicks: number): number {
  return clamp(50 + (rosterQualityNorm * 100 - capUtilizationPct) * 0.6 + Math.min(extraPicks * 5, 15))
}

const FACILITY_SCORE_BY_GRADE: Record<string, number> = { F: 10, E: 30, D: 50, C: 65, B: 80, A: 100 }
export function facilityScoreFromGrade(grade: string | null | undefined): number {
  return FACILITY_SCORE_BY_GRADE[grade || 'F'] ?? 10
}

// arenaScoreNorm is a league-wide min-max normalization (0-100) of total
// arena capacity, computed once per resolution pass across all 30 teams —
// see resolver below.
export function computePatrimonioScore(gymGrade: string | null | undefined, arenaScoreNorm: number, balance: number): number {
  const facilityScore = facilityScoreFromGrade(gymGrade)
  const balanceHealthScore = clamp(50 + (balance / 20_000_000) * 50)
  return clamp(0.45 * facilityScore + 0.30 * arenaScoreNorm + 0.25 * balanceHealthScore)
}

// Week-over-week follower/popularity movement plus a flat bonus for
// cumulative completed facility investment this season — "is the club
// trending up," not a repeat of the raw popularity level already scored
// inside Fans' imageScore.
export function computeGrowthScore(followerGrowthPct: number, popularityDelta: number, completedConstructionsThisSeason: number): number {
  return clamp(50 + followerGrowthPct * 300 + popularityDelta * 2 + Math.min(completedConstructionsThisSeason * 3, 15))
}

export type OwnersInputs = {
  actualWinPct: number, wni: number, last10WinPct: number,
  rosterQualityNorm: number, capUtilizationPct: number, extraPicks: number,
  gymGrade: string | null | undefined, arenaScoreNorm: number, balance: number,
  followerGrowthPct: number, popularityDelta: number, completedConstructionsThisSeason: number,
}

export function computeOwnersScore(inputs: OwnersInputs): { score: number, breakdown: Record<string, number> } {
  const resultsScore = computeResultsScore(inputs.actualWinPct, inputs.wni)
  const trendScore = clamp(50 + (inputs.last10WinPct - inputs.actualWinPct) * 150)
  const sportingPerformanceScore = 0.7 * resultsScore + 0.3 * trendScore
  const managementScore = computeManagementScore(inputs.rosterQualityNorm, inputs.capUtilizationPct, inputs.extraPicks)
  const patrimonioScore = computePatrimonioScore(inputs.gymGrade, inputs.arenaScoreNorm, inputs.balance)
  const growthScore = computeGrowthScore(inputs.followerGrowthPct, inputs.popularityDelta, inputs.completedConstructionsThisSeason)

  const score = clamp(0.40 * sportingPerformanceScore + 0.20 * managementScore + 0.20 * patrimonioScore + 0.20 * growthScore)
  return { score, breakdown: { sportingPerformanceScore, managementScore, patrimonioScore, growthScore, resultsScore, trendScore } }
}

// Literally "número de objetivos atingidos por cada sponsor" — a team with
// no active sponsor engagement this season gets a mild penalty (40), not a
// neutral 50, since disengaging from the sponsor system is itself a choice.
export function computeSponsorsScore(totalAchieved: number, totalEvaluable: number): number {
  if (totalEvaluable <= 0) return 40
  return clamp(100 * totalAchieved / totalEvaluable)
}

export function computeCompositeScore(fansScore: number, ownersScore: number, sponsorsScore: number): number {
  return clamp(0.40 * fansScore + 0.40 * ownersScore + 0.20 * sponsorsScore)
}

const OWNERS_HOT_SEAT_THRESHOLD = 30
const OWNERS_HOT_SEAT_STREAK_WEEKS = 8

// ── WEEKLY RESOLUTION ─────────────────────────────────────────────
export async function resolveWeeklyGmSatisfaction(week: number): Promise<{ teamsProcessed: number }> {
  const { data: teams } = await supabaseAdmin.from('teams')
    .select('id,wins,losses,popularity,cap_used,social_media_followers')
    .not('id', 'in', '(ALL,RVS,ROO,SOP)')
  if (!teams?.length) return { teamsProcessed: 0 }

  const teamIds = teams.map((t: any) => t.id)
  const currentSeasonYear = parseInt(SEASON.split('-')[0], 10)

  const [
    { data: allPlayers },
    { data: draftPicks },
    { data: finances },
    { data: facilities },
    { data: arenaSections },
    { data: constructions },
    { data: interactions },
    { data: attrDev },
    { data: recentGames },
    { data: sponsorContracts },
    { data: prevSnapshots },
    { data: openTenures },
  ] = await Promise.all([
    supabaseAdmin.from('players').select('id,team_id,real_ovr,usage,age,potential_grade,moral').eq('status', 'active').not('team_id', 'is', null),
    supabaseAdmin.from('draft_picks').select('team_id,original_team_id,season').eq('status', 'owned'),
    supabaseAdmin.from('franchise_finances').select('team_id,balance').in('team_id', teamIds),
    supabaseAdmin.from('practice_facilities').select('team_id,gym_grade').in('team_id', teamIds),
    supabaseAdmin.from('arena_sections').select('team_id,capacity').in('team_id', teamIds),
    supabaseAdmin.from('construction_queue').select('team_id,status').eq('status', 'completed').in('team_id', teamIds),
    supabaseAdmin.from('player_interactions').select('team_id,status').in('status', ['pending_response', 'monitoring']).in('team_id', teamIds),
    supabaseAdmin.from('attribute_development').select('player_id,change').eq('season', SEASON),
    supabaseAdmin.from('games').select('home_team,away_team,home_score,away_score,played_at').eq('status', 'final').or(`home_team.in.(${teamIds.join(',')}),away_team.in.(${teamIds.join(',')})`).order('played_at', { ascending: false }),
    supabaseAdmin.from('sponsor_contracts').select('id,team_id,status').eq('season', SEASON).in('team_id', teamIds),
    supabaseAdmin.from('gm_satisfaction_snapshots').select('team_id,owners_score,owners_breakdown').eq('season', SEASON).eq('week_number', week - 1).in('team_id', teamIds),
    supabaseAdmin.from('gm_tenure_log').select('team_id,started_week').is('ended_week', null).in('team_id', teamIds),
  ])

  // Current GM's tenure start per team — the hot-seat streak below must
  // never reach back across a GM change (a new GM inheriting a slumping
  // team gets a clean slate, per Bruno's explicit requirement).
  const tenureStartWeekByTeam: Record<string, number> = {}
  ;(openTenures || []).forEach((t: any) => { tenureStartWeekByTeam[t.team_id] = t.started_week })

  const rosterByTeam: Record<string, any[]> = {}
  ;(allPlayers || []).forEach((p: any) => { (rosterByTeam[p.team_id] ||= []).push(p) })

  const extraPicksByTeam: Record<string, number> = {}
  ;(draftPicks || []).forEach((pk: any) => {
    if (pk.team_id === pk.original_team_id) return
    const pickYear = parseInt(String(pk.season), 10)
    if (!isNaN(pickYear) && pickYear > currentSeasonYear) extraPicksByTeam[pk.team_id] = (extraPicksByTeam[pk.team_id] || 0) + 1
  })

  const balanceByTeam: Record<string, number> = {}
  ;(finances || []).forEach((f: any) => { balanceByTeam[f.team_id] = f.balance || 0 })

  const gymGradeByTeam: Record<string, string> = {}
  ;(facilities || []).forEach((f: any) => { gymGradeByTeam[f.team_id] = f.gym_grade })

  const arenaCapacityByTeam: Record<string, number> = {}
  ;(arenaSections || []).forEach((s: any) => { arenaCapacityByTeam[s.team_id] = (arenaCapacityByTeam[s.team_id] || 0) + (s.capacity || 0) })
  const capacities = teamIds.map((id: string) => arenaCapacityByTeam[id] || 0)
  const minCap = Math.min(...capacities), maxCap = Math.max(...capacities)
  const arenaScoreNormByTeam: Record<string, number> = {}
  teamIds.forEach((id: string) => {
    const cap = arenaCapacityByTeam[id] || 0
    arenaScoreNormByTeam[id] = maxCap > minCap ? clamp(((cap - minCap) / (maxCap - minCap)) * 100) : 50
  })

  const completedConstructionsByTeam: Record<string, number> = {}
  ;(constructions || []).forEach((c: any) => { completedConstructionsByTeam[c.team_id] = (completedConstructionsByTeam[c.team_id] || 0) + 1 })

  const openInteractionsByTeam: Record<string, number> = {}
  ;(interactions || []).forEach((i: any) => { openInteractionsByTeam[i.team_id] = (openInteractionsByTeam[i.team_id] || 0) + 1 })

  const devByPlayer: Record<string, number> = {}
  ;(attrDev || []).forEach((d: any) => { devByPlayer[d.player_id] = (devByPlayer[d.player_id] || 0) + (d.change || 0) })

  // Last-10-games win% per team, from the shared recentGames fetch (one
  // query for all 30 teams, same pattern as runPostSimNotifications' streak
  // check in notifications.ts).
  const last10ByTeam: Record<string, { w: number, total: number }> = {}
  for (const g of (recentGames || [])) {
    for (const teamId of [g.home_team, g.away_team]) {
      if (!teamIds.includes(teamId)) continue
      const entry = (last10ByTeam[teamId] ||= { w: 0, total: 0 })
      if (entry.total >= 10) continue
      const won = (g.home_team === teamId && g.home_score > g.away_score) || (g.away_team === teamId && g.away_score > g.home_score)
      entry.total++
      if (won) entry.w++
    }
  }

  const sponsorContractIdsByTeam: Record<string, string[]> = {}
  ;(sponsorContracts || []).forEach((c: any) => { (sponsorContractIdsByTeam[c.team_id] ||= []).push(c.id) })
  const contractStatusById: Record<string, string> = {}
  ;(sponsorContracts || []).forEach((c: any) => { contractStatusById[c.id] = c.status })

  const allContractIds = (sponsorContracts || []).map((c: any) => c.id)
  const { data: tracking } = allContractIds.length
    ? await supabaseAdmin.from('sponsor_objective_tracking').select('contract_id,achieved').in('contract_id', allContractIds)
    : { data: [] as any[] }

  const prevByTeam: Record<string, any> = {}
  ;(prevSnapshots || []).forEach((s: any) => { prevByTeam[s.team_id] = s })

  let teamsProcessed = 0
  for (const team of teams) {
    teamsProcessed++
    const roster = rosterByTeam[team.id] || []
    const extraPicks = extraPicksByTeam[team.id] || 0
    const wni = computeWinNowIndex(roster, extraPicks)
    const label = winNowLabel(wni)

    const played = (team.wins || 0) + (team.losses || 0)
    const actualWinPct = played > 0 ? (team.wins || 0) / played : 0.5
    const last10 = last10ByTeam[team.id]
    const last10WinPct = last10 && last10.total > 0 ? last10.w / last10.total : actualWinPct

    const youngRoster = roster.filter((p: any) => (p.age || 25) <= 24)
    const youngUsageTotal = youngRoster.reduce((s: number, p: any) => s + (p.usage || 50), 0) || 1
    const avgYoungRealOvrDelta = youngRoster.length
      ? youngRoster.reduce((s: number, p: any) => s + (devByPlayer[p.id] || 0) * (p.usage || 50), 0) / youngUsageTotal
      : 0
    const highPotentialCount = countHighPotential(roster)
    const avgRosterMoral = roster.length ? roster.reduce((s: number, p: any) => s + (p.moral ?? 70), 0) / roster.length : 70

    const fans = computeFansScore({
      actualWinPct, wni, avgYoungRealOvrDelta, highPotentialCount,
      popularity: team.popularity ?? 50, avgRosterMoral, openInteractionCount: openInteractionsByTeam[team.id] || 0,
    })

    const rosterQualityNorm = normalizeRosterQuality(computeRosterQuality(roster))
    const capUtilizationPct = ((team.cap_used || 0) / CAP_LIMIT) * 100
    const balance = balanceByTeam[team.id] || 0
    const prev = prevByTeam[team.id]
    const prevFollowers = prev?.owners_breakdown?.rawFollowers
    const prevPopularity = prev?.owners_breakdown?.rawPopularity
    const currentFollowers = team.social_media_followers || 0
    const followerGrowthPct = prevFollowers && prevFollowers > 0 ? (currentFollowers - prevFollowers) / prevFollowers : 0
    const popularityDelta = prevPopularity != null ? (team.popularity ?? 50) - prevPopularity : 0

    const owners = computeOwnersScore({
      actualWinPct, wni, last10WinPct, rosterQualityNorm, capUtilizationPct, extraPicks,
      gymGrade: gymGradeByTeam[team.id], arenaScoreNorm: arenaScoreNormByTeam[team.id] ?? 50, balance,
      followerGrowthPct, popularityDelta, completedConstructionsThisSeason: completedConstructionsByTeam[team.id] || 0,
    })
    owners.breakdown.rawFollowers = currentFollowers
    owners.breakdown.rawPopularity = team.popularity ?? 50

    const contractIds = sponsorContractIdsByTeam[team.id] || []
    const teamTracking = (tracking || []).filter((t: any) => contractIds.includes(t.contract_id))
    const totalAchieved = teamTracking.filter((t: any) => t.achieved).length
    // "evaluable" = achieved, OR the objective belongs to an expired
    // contract (relationship concluded — a not-yet-achieved objective under
    // a STILL-ACTIVE contract isn't a failure yet, there's still time).
    const totalEvaluable = teamTracking.filter((t: any) => t.achieved || contractStatusById[t.contract_id] === 'expired').length
    const sponsorsScore = computeSponsorsScore(totalAchieved, totalEvaluable)

    const performanceScore = computeCompositeScore(fans.score, owners.score, sponsorsScore)

    await supabaseAdmin.from('gm_satisfaction_snapshots').upsert({
      team_id: team.id, season: SEASON, week_number: week,
      win_now_index: wni, win_now_label: label,
      fans_score: fans.score, fans_breakdown: fans.breakdown,
      owners_score: owners.score, owners_breakdown: owners.breakdown,
      sponsors_score: sponsorsScore, sponsors_breakdown: { totalAchieved, totalEvaluable },
      performance_score: performanceScore,
    }, { onConflict: 'team_id,season,week_number' })

    // Hot-seat narrative warning — only, per Bruno's choice (no economic
    // consequence). Fires once per streak (checks the prior week wasn't
    // ALSO already below threshold for 8+ weeks, so a GM isn't spammed
    // every single week once they cross the line).
    if (owners.score < OWNERS_HOT_SEAT_THRESHOLD) {
      const tenureStartWeek = tenureStartWeekByTeam[team.id] ?? 1
      const { data: recentOwnersSnaps } = await supabaseAdmin.from('gm_satisfaction_snapshots')
        .select('owners_score,week_number').eq('team_id', team.id).eq('season', SEASON)
        .gte('week_number', tenureStartWeek)
        .order('week_number', { ascending: false }).limit(OWNERS_HOT_SEAT_STREAK_WEEKS)
      const streak = recentOwnersSnaps?.every((s: any) => (s.owners_score ?? 100) < OWNERS_HOT_SEAT_THRESHOLD)
      const alreadyLongerStreak = (recentOwnersSnaps?.length || 0) >= OWNERS_HOT_SEAT_STREAK_WEEKS
        && recentOwnersSnaps!.slice(1).every((s: any) => (s.owners_score ?? 100) < OWNERS_HOT_SEAT_THRESHOLD)
      if (streak && recentOwnersSnaps!.length >= OWNERS_HOT_SEAT_STREAK_WEEKS && !alreadyLongerStreak) {
        const lang = await getTeamLang(team.id)
        const subject = lang === 'pt' ? '⚠️ A administração está a perder a paciência' : '⚠️ Ownership is losing patience'
        const body = lang === 'pt'
          ? `A avaliação do board sobre a tua gestão está muito baixa há ${OWNERS_HOT_SEAT_STREAK_WEEKS} semanas seguidas. Consulta a aba Satisfação para veres o que está a pesar mais na decisão.`
          : `Ownership's evaluation of your management has been critically low for ${OWNERS_HOT_SEAT_STREAK_WEEKS} straight weeks. Check the Satisfaction tab to see what's weighing the decision down most.`
        await notify(team.id, 'ownership', subject, body, { ownersScore: owners.score, streakWeeks: OWNERS_HOT_SEAT_STREAK_WEEKS })
      }
    }
  }

  return { teamsProcessed }
}

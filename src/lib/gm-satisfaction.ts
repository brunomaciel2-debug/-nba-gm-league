import { supabaseAdmin } from '@/lib/supabase'
import { notify } from '@/lib/notifications'
import { getTeamLang } from '@/lib/notifications-helpers'
import { computeRosterQuality, normalizeRosterQuality, computeWinNowIndex, winNowLabel, computeTop5AvgAge, countHighPotential, WinNowLabel } from '@/lib/roster-quality'
import { getStatusForWeek } from '@/lib/season-week-helper'

const SEASON = '2025-26'
const CAP_LIMIT = 180_000_000 // mirrors notifications.ts CAP_LIMIT
// Expectations lock right after Free Agency ends (week 1 is 'free-agency',
// week 2 is 'summer-league' — see season-week-helper.ts), not at the start
// of the regular season. The roster a GM builds in Free Agency is what
// really sets the tone for the season; holding the lock open through
// summer league/offseason/pre-season would let further roster moves keep
// gaming the baseline right up to opening night, defeating the whole
// point of a FIXED, start-of-season expectation.
const FREE_AGENCY_END_WEEK = 2
// Locking is only meaningful while there's a real season ahead — don't
// lock (or re-lock) for a GM who took over during the tail end of a
// season with nothing left to hold expectations against; that waits for
// the next season's Free Agency to close instead.
const LOCK_ELIGIBLE_STATUSES = new Set(['summer-league', 'offseason', 'pre-season', 'regular-season'])
const TOTAL_SEASON_GAMES = 82 // real NBA-style schedule length (schedule-generator.ts)

// Short PT labels for the lock notification only — the richer situation
// sentences (with full framing per audience) live in SatisfactionTab.tsx's
// SITUATION_INFO, this is just for a compact notification line.
const WIN_NOW_LABEL_PT: Record<string, string> = {
  rebuild: 'Reconstrução', retool: 'Reconstrução Avançada', playoff_push: 'A Lutar pelos Playoffs',
  playoff_team: 'Equipa de Playoffs', rising_contender: 'Quer ser Contender', contender: 'Contender',
}

function clamp(v: number, lo = 0, hi = 100): number { return Math.min(hi, Math.max(lo, v)) }
function clamp01(v: number, lo = 0, hi = 1): number { return Math.min(hi, Math.max(lo, v)) }

// ── PURE FORMULAS ─────────────────────────────────────────────────
// Every score below is 0-100. `wni` (Win-Now Index, from roster-quality.ts)
// is the 0 (rebuild) to 1 (contender) team-situation score every
// expectation is calibrated against.

// A rebuild team is expected to win ~25%, a true contender ~75% — the
// midpoint (50%) is what an average, situationally-neutral team should win.
export function expectedWinPct(wni: number): number {
  return 0.5 + (wni - 0.5) * 0.5
}

// Owners are a stricter grader on wins than Fans at both ends — a rebuild
// still owes the board a real floor of competitiveness (.30 vs Fans' .25),
// and a stacked roster owes real results, not just excitement (~.825
// natural ceiling vs Fans' .75). The .85 clamp is a safety rail that never
// actually engages at wni∈[0,1] — the real ceiling is the unclamped ~.825.
export function ownersExpectedWinPct(wni: number): number {
  return clamp01(0.5 + (wni - 0.5) * 0.65, 0.30, 0.85)
}

// How a team's ACTUAL win% compares to whatever expectation curve applies —
// this is the "performance vs expectation" gap, not a raw win% score.
// Takes the expectation value directly so Fans and Owners can each supply
// their own curve without duplicating this formula.
export function computeResultsScoreFromExpectation(actualWinPct: number, expectedWinPctValue: number): number {
  const gap = actualWinPct - expectedWinPctValue
  return clamp(50 + gap * 150)
}

export function computeResultsScore(actualWinPct: number, wni: number): number {
  return computeResultsScoreFromExpectation(actualWinPct, expectedWinPct(wni))
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
export function computeFansScore(inputs: FansInputs): { score: number, breakdown: Record<string, any> } {
  const resultsScore = computeResultsScore(inputs.actualWinPct, inputs.wni)
  const youthExcitement = computeYouthExcitement(inputs.avgYoungRealOvrDelta, inputs.highPotentialCount)
  const cultureScore = computeCultureScore(inputs.avgRosterMoral, inputs.openInteractionCount)
  const imageScore = inputs.popularity

  const wResults = 0.15 + 0.50 * inputs.wni
  const wDev = 0.50 - 0.50 * inputs.wni

  const score = clamp(wResults * resultsScore + wDev * youthExcitement + 0.20 * imageScore + 0.15 * cultureScore)
  return { score, breakdown: {
    resultsScore, youthExcitement, imageScore, cultureScore, wResults, wDev,
    actualWinPct: inputs.actualWinPct, expectedWinPct: expectedWinPct(inputs.wni),
  } }
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

// Real financial stewardship — did the GM grow or shrink the team's net
// worth SINCE taking over, not "how much cash do they happen to have right
// now" (which could just be inherited wealth from a predecessor and say
// nothing about this GM's own management). Normalized against a fixed $20M
// unit (same denominator convention used elsewhere in this file), NOT the
// team's own starting balance — normalizing against their own balance would
// make identical stewardship swings score wildly differently for a rich
// team vs a poor one, rewarding/punishing inherited wealth instead of skill.
export function computeStewardshipScore(netIncomeSinceLock: number): number {
  return clamp(50 + (netIncomeSinceLock / 20_000_000) * 50)
}

// arenaScoreNorm is a league-wide min-max normalization (0-100) of total
// arena capacity, computed once per resolution pass across all 30 teams —
// see resolver below.
export function computePatrimonioScore(gymGrade: string | null | undefined, arenaScoreNorm: number, netIncomeSinceLock: number): number {
  const facilityScore = facilityScoreFromGrade(gymGrade)
  const stewardshipScore = computeStewardshipScore(netIncomeSinceLock)
  return clamp(0.45 * facilityScore + 0.30 * arenaScoreNorm + 0.25 * stewardshipScore)
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
  gymGrade: string | null | undefined, arenaScoreNorm: number, netIncomeSinceLock: number,
  followerGrowthPct: number, popularityDelta: number, completedConstructionsThisSeason: number,
}

export function computeOwnersScore(inputs: OwnersInputs): { score: number, breakdown: Record<string, any> } {
  // Owners use their own, stricter win-expectation curve — see
  // ownersExpectedWinPct's comment for why it's not the same as Fans'.
  const resultsScore = computeResultsScoreFromExpectation(inputs.actualWinPct, ownersExpectedWinPct(inputs.wni))
  const trendScore = clamp(50 + (inputs.last10WinPct - inputs.actualWinPct) * 150)
  const sportingPerformanceScore = 0.7 * resultsScore + 0.3 * trendScore
  const managementScore = computeManagementScore(inputs.rosterQualityNorm, inputs.capUtilizationPct, inputs.extraPicks)
  const patrimonioScore = computePatrimonioScore(inputs.gymGrade, inputs.arenaScoreNorm, inputs.netIncomeSinceLock)
  const growthScore = computeGrowthScore(inputs.followerGrowthPct, inputs.popularityDelta, inputs.completedConstructionsThisSeason)

  const score = clamp(0.40 * sportingPerformanceScore + 0.20 * managementScore + 0.20 * patrimonioScore + 0.20 * growthScore)
  return { score, breakdown: {
    sportingPerformanceScore, managementScore, patrimonioScore, growthScore, resultsScore, trendScore,
    actualWinPct: inputs.actualWinPct, expectedWinPct: ownersExpectedWinPct(inputs.wni),
    netIncomeSinceLock: inputs.netIncomeSinceLock,
  } }
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

// ── FRANCHISE STORYLINES ───────────────────────────────────────────
// Real, team-specific facts (not a generic sentence per Win-Now band) —
// answers Bruno's exact ask: "sometimes an objective is keeping our star,
// or finding a second star to play alongside X." Every check below
// references an actual roster player by name and an actual real data
// point (contract years remaining, age, injury count, All-Star status,
// extension offer outcome) — two teams in the same situation band can
// (and usually will) show completely different storylines here.
export type FranchiseStoryline = { severity: 'urgent' | 'watch' | 'good', textPT: string, textEN: string }
export type StorylinePlayer = { id: number, name: string, real_ovr: number, age: number, contract_years: number | null }

const STAR_OVR_THRESHOLD = 78
const SECOND_STAR_OVR_THRESHOLD = 82
const NO_PARTNER_OVR_THRESHOLD = 76
const TITLE_WINDOW_OVR_THRESHOLD = 84
const TITLE_WINDOW_MAX_AVG_AGE = 29
const FRAGILE_INJURY_COUNT = 2
const MAX_STORYLINES_SHOWN = 4

export function computeFranchiseStorylines(inputs: {
  topPlayers: StorylinePlayer[], // roster sorted desc by real_ovr — only need the top 2
  injuryCountByPlayer: Record<number, number>,
  awardPlayerIds: Set<number>,
  extensionStatusByPlayer: Record<number, { status: string, rejectionReason: string | null }>,
}): FranchiseStoryline[] {
  const results: FranchiseStoryline[] = []
  const star = inputs.topPlayers[0]
  if (!star) return results // barren roster — nothing real to say yet

  const starIsReal = star.real_ovr >= STAR_OVR_THRESHOLD
  const second = inputs.topPlayers[1]
  const starExtension = inputs.extensionStatusByPlayer[star.id]

  if (starIsReal && (star.contract_years ?? 99) <= 1 && starExtension?.status !== 'accepted') {
    results.push({
      severity: 'urgent',
      textPT: `O contrato de **${star.name}** expira em breve (resta ${star.contract_years ?? 0} ano(s)) — ainda sem extensão garantida.`,
      textEN: `**${star.name}**'s contract expires soon (${star.contract_years ?? 0} year(s) left) — no extension locked in yet.`,
    })
  }

  if (starIsReal && starExtension?.status === 'rejected') {
    const reason = starExtension.rejectionReason
    results.push({
      severity: 'urgent',
      textPT: `**${star.name}** recusou a tua proposta de renovação${reason ? ` — ${reason}` : ''}.`,
      textEN: `**${star.name}** turned down your extension offer${reason ? ` — ${reason}` : ''}.`,
    })
  }

  if (starIsReal && star.age >= 32 && (star.contract_years ?? 99) <= 2) {
    results.push({
      severity: 'watch',
      textPT: `**${star.name}** está a envelhecer (${star.age} anos) com o contrato quase a acabar — a janela pode estar a fechar.`,
      textEN: `**${star.name}** is aging (${star.age}) with the contract almost up — the window may be closing.`,
    })
  }

  if (star.real_ovr >= SECOND_STAR_OVR_THRESHOLD && (!second || second.real_ovr < NO_PARTNER_OVR_THRESHOLD)) {
    results.push({
      severity: 'watch',
      textPT: second
        ? `**${star.name}** não tem um verdadeiro parceiro de nível — o 2º melhor jogador (**${second.name}**) está bem abaixo (OVR ${Math.round(second.real_ovr)}).`
        : `**${star.name}** está praticamente sozinho no plantel — não há um segundo jogador de nível.`,
      textEN: second
        ? `**${star.name}** doesn't have a real running mate — your 2nd-best player (**${second.name}**) is far behind (OVR ${Math.round(second.real_ovr)}).`
        : `**${star.name}** is basically alone on this roster — there's no real second option.`,
    })
  }

  const starInjuries = inputs.injuryCountByPlayer[star.id] || 0
  if (starIsReal && starInjuries >= FRAGILE_INJURY_COUNT) {
    results.push({
      severity: 'watch',
      textPT: `**${star.name}** já teve ${starInjuries} lesões esta época — a saúde dele é um risco real para o plantel.`,
      textEN: `**${star.name}** has already been injured ${starInjuries} times this season — his health is a real risk to the roster.`,
    })
  }

  if (starIsReal && inputs.awardPlayerIds.has(star.id) && (!second || second.real_ovr < NO_PARTNER_OVR_THRESHOLD)) {
    results.push({
      severity: 'watch',
      textPT: `**${star.name}**, All-Star esta época, está praticamente a jogar sozinho — o resto do plantel fica muito atrás.`,
      textEN: `**${star.name}**, an All-Star this season, is playing almost alone out there — the rest of the roster is far behind.`,
    })
  }

  if (second && star.real_ovr >= TITLE_WINDOW_OVR_THRESHOLD && second.real_ovr >= TITLE_WINDOW_OVR_THRESHOLD
    && (star.age + second.age) / 2 <= TITLE_WINDOW_MAX_AVG_AGE && (star.contract_years ?? 0) >= 2 && (second.contract_years ?? 0) >= 2) {
    results.push({
      severity: 'good',
      textPT: `**${star.name}** e **${second.name}** estão no auge e sob contrato — a janela de título está bem aberta.`,
      textEN: `**${star.name}** and **${second.name}** are both in their prime and locked up — the title window is wide open.`,
    })
  }

  if (starIsReal && starExtension?.status === 'accepted') {
    results.push({
      severity: 'good',
      textPT: `Garantiste **${star.name}** a longo prazo esta época — a base do plantel está protegida.`,
      textEN: `You locked **${star.name}** in long-term this season — the core of the roster is secure.`,
    })
  }

  const severityOrder: Record<string, number> = { urgent: 0, watch: 1, good: 2 }
  results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  return results.slice(0, MAX_STORYLINES_SHOWN)
}

// ── SEASON TARGETS: FRANCHISE-SPECIFIC CRITERIA ────────────────────
// Bruno's exact ask: two teams in the same Win-Now band were showing the
// exact same 3 checklist criterion TYPES, just different numbers. Real
// fanbases/ownership groups don't all want the same things — a real
// rivalry, a beloved star's expiring contract, weak facilities, a real
// shot at the playoffs. Selected once, at the same moment win targets are
// locked (so WHAT is being measured is also fixed all season, never WHO's
// most competitive number, just re-derived from a post-trade roster), and
// re-checked live every week after.
export type SeasonCriterion =
  | { type: 'wins' }
  | { type: 'netIncome' }
  | { type: 'culture' }
  | { type: 'noOpenConflicts' }
  | { type: 'capEfficiency' }
  | { type: 'youthDevelopment' }
  | { type: 'starRetention', playerId: number, playerName: string }
  | { type: 'rivalryWin', rivalTeamId: string, rivalName: string }
  | { type: 'facilityInvestment' }
  | { type: 'playoffAppearance' }

const STAR_RETENTION_OVR_THRESHOLD = 78
const STAR_RETENTION_CONTRACT_MAX = 2
const YOUTH_DEV_WNI_THRESHOLD = 0.48
const PLAYOFF_WNI_THRESHOLD = 0.48
const WEAK_FACILITY_GRADES = new Set(['F', 'E', 'D'])

function starRetentionCriterion(star: StorylinePlayer | undefined): SeasonCriterion | null {
  if (star && star.real_ovr >= STAR_RETENTION_OVR_THRESHOLD && (star.contract_years ?? 99) <= STAR_RETENTION_CONTRACT_MAX) {
    return { type: 'starRetention', playerId: star.id, playerName: star.name }
  }
  return null
}

// `wins` is always included; up to 3 more slots are filled by whichever
// real, team-specific conditions actually apply, in priority order —
// `culture`/`noOpenConflicts` are always-eligible fallbacks that only end
// up shown when there's nothing more specific to say about this team.
export function selectFansCriteria(inputs: {
  star: StorylinePlayer | undefined, rival: { teamId: string, name: string } | null, wni: number,
}): SeasonCriterion[] {
  const conditional: SeasonCriterion[] = []
  const star = starRetentionCriterion(inputs.star)
  if (star) conditional.push(star)
  if (inputs.rival) conditional.push({ type: 'rivalryWin', rivalTeamId: inputs.rival.teamId, rivalName: inputs.rival.name })
  if (inputs.wni < YOUTH_DEV_WNI_THRESHOLD) conditional.push({ type: 'youthDevelopment' })
  conditional.push({ type: 'culture' })
  conditional.push({ type: 'noOpenConflicts' })
  return [{ type: 'wins' }, ...conditional.slice(0, 3)]
}

// `wins` and `netIncome` always included; up to 2 more slots, same
// priority-fill logic (`capEfficiency` is the fallback).
export function selectOwnersCriteria(inputs: {
  star: StorylinePlayer | undefined, gymGrade: string | null | undefined, wni: number,
}): SeasonCriterion[] {
  const conditional: SeasonCriterion[] = []
  const star = starRetentionCriterion(inputs.star)
  if (star) conditional.push(star)
  if (WEAK_FACILITY_GRADES.has(inputs.gymGrade || 'F')) conditional.push({ type: 'facilityInvestment' })
  if (inputs.wni >= PLAYOFF_WNI_THRESHOLD) conditional.push({ type: 'playoffAppearance' })
  conditional.push({ type: 'capEfficiency' })
  return [{ type: 'wins' }, { type: 'netIncome' }, ...conditional.slice(0, 2)]
}

export type CriterionEvalContext = {
  currentWins: number, targetWins: number | null,
  netIncomeSinceLock: number, avgRosterMoral: number, openInteractionCount: number,
  managementScore: number, avgYoungRealOvrDelta: number,
  extensionAcceptedForPlayer: (playerId: number) => boolean,
  beatRivalThisSeason: (rivalTeamId: string) => boolean,
  conferenceRank: number | null,
  completedConstructionsSinceLock: number,
}

export type CriterionCheckResult = { achieved: boolean, currentValue: number | null, threshold: number | null }

// Evaluates one LOCKED criterion against THIS week's live data — the
// criterion set never changes mid-season, only the live progress against
// it does.
export function checkCriterion(criterion: SeasonCriterion, ctx: CriterionEvalContext): CriterionCheckResult {
  switch (criterion.type) {
    case 'wins':
      return { achieved: ctx.targetWins != null && ctx.currentWins >= ctx.targetWins, currentValue: ctx.currentWins, threshold: ctx.targetWins }
    case 'netIncome':
      return { achieved: ctx.netIncomeSinceLock >= 0, currentValue: ctx.netIncomeSinceLock, threshold: 0 }
    case 'culture':
      return { achieved: ctx.avgRosterMoral >= 60, currentValue: ctx.avgRosterMoral, threshold: 60 }
    case 'noOpenConflicts':
      return { achieved: ctx.openInteractionCount === 0, currentValue: ctx.openInteractionCount, threshold: 0 }
    case 'capEfficiency':
      return { achieved: ctx.managementScore >= 50, currentValue: ctx.managementScore, threshold: 50 }
    case 'youthDevelopment':
      return { achieved: ctx.avgYoungRealOvrDelta > 0, currentValue: ctx.avgYoungRealOvrDelta, threshold: 0 }
    case 'starRetention':
      return { achieved: ctx.extensionAcceptedForPlayer(criterion.playerId), currentValue: null, threshold: null }
    case 'rivalryWin':
      return { achieved: ctx.beatRivalThisSeason(criterion.rivalTeamId), currentValue: null, threshold: null }
    case 'facilityInvestment':
      return { achieved: ctx.completedConstructionsSinceLock >= 1, currentValue: ctx.completedConstructionsSinceLock, threshold: 1 }
    case 'playoffAppearance':
      return { achieved: ctx.conferenceRank != null && ctx.conferenceRank <= 8, currentValue: ctx.conferenceRank, threshold: 8 }
  }
}

const OWNERS_HOT_SEAT_THRESHOLD = 30
const OWNERS_HOT_SEAT_STREAK_WEEKS = 8

// ── WEEKLY RESOLUTION ─────────────────────────────────────────────
export async function resolveWeeklyGmSatisfaction(week: number): Promise<{ teamsProcessed: number }> {
  const { data: teams } = await supabaseAdmin.from('teams')
    .select('id,name,wins,losses,conference,rival_team_id,popularity,cap_used,social_media_followers')
    .not('id', 'in', '(ALL,RVS,ROO,SOP)')
  if (!teams?.length) return { teamsProcessed: 0 }

  const teamIds = teams.map((t: any) => t.id)
  const currentSeasonYear = parseInt(SEASON.split('-')[0], 10)

  const [
    { data: allPlayers },
    { data: draftPicks },
    { data: facilities },
    { data: arenaSections },
    { data: constructions },
    { data: interactions },
    { data: attrDev },
    { data: recentGames },
    { data: sponsorContracts },
    { data: prevSnapshots },
    { data: openTenures },
    { data: injuryLog },
    { data: awards },
    { data: extensionOffers },
    { data: existingTargets },
    { data: allTransactions },
  ] = await Promise.all([
    supabaseAdmin.from('players').select('id,name,team_id,real_ovr,usage,age,contract_years,potential_grade,moral').eq('status', 'active').not('team_id', 'is', null),
    supabaseAdmin.from('draft_picks').select('team_id,original_team_id,season').eq('status', 'owned'),
    supabaseAdmin.from('practice_facilities').select('team_id,gym_grade').in('team_id', teamIds),
    supabaseAdmin.from('arena_sections').select('team_id,capacity').in('team_id', teamIds),
    supabaseAdmin.from('construction_queue').select('team_id,status,ends_at').eq('status', 'completed').in('team_id', teamIds),
    supabaseAdmin.from('player_interactions').select('team_id,status').in('status', ['pending_response', 'monitoring']).in('team_id', teamIds),
    supabaseAdmin.from('attribute_development').select('player_id,change').eq('season', SEASON),
    supabaseAdmin.from('games').select('home_team,away_team,home_score,away_score,played_at').eq('status', 'final').or(`home_team.in.(${teamIds.join(',')}),away_team.in.(${teamIds.join(',')})`).order('played_at', { ascending: false }),
    supabaseAdmin.from('sponsor_contracts').select('id,team_id,status').eq('season', SEASON).in('team_id', teamIds),
    supabaseAdmin.from('gm_satisfaction_snapshots').select('team_id,owners_score,owners_breakdown').eq('season', SEASON).eq('week_number', week - 1).in('team_id', teamIds),
    supabaseAdmin.from('gm_tenure_log').select('team_id,started_week').is('ended_week', null).in('team_id', teamIds),
    supabaseAdmin.from('injury_log').select('player_id').eq('season', SEASON),
    supabaseAdmin.from('awards').select('player_id,award_type').eq('season', SEASON).in('award_type', ['all_star_east', 'all_star_west', 'mvp']),
    supabaseAdmin.from('contract_extension_offers').select('player_id,status,rejection_reason').eq('season', SEASON),
    supabaseAdmin.from('gm_season_targets').select('*').eq('season', SEASON).in('team_id', teamIds),
    supabaseAdmin.from('franchise_transactions').select('team_id,type,amount,week_number').eq('season', SEASON),
  ])

  // Current GM's tenure start per team — the hot-seat streak below must
  // never reach back across a GM change (a new GM inheriting a slumping
  // team gets a clean slate, per Bruno's explicit requirement).
  const tenureStartWeekByTeam: Record<string, number> = {}
  ;(openTenures || []).forEach((t: any) => { tenureStartWeekByTeam[t.team_id] = t.started_week })

  // Locked season targets — one row per (team, season, tenure). Only the
  // row matching THIS tenure's started_week is relevant; a previous GM's
  // locked targets (a different started_week) must never leak into the
  // current GM's evaluation.
  const lockedTargetByTeam: Record<string, any> = {}
  ;(existingTargets || []).forEach((t: any) => {
    if (t.tenure_started_week === (tenureStartWeekByTeam[t.team_id] ?? 1)) lockedTargetByTeam[t.team_id] = t
  })

  const transactionsByTeam: Record<string, { type: string, amount: number, week_number: number }[]> = {}
  ;(allTransactions || []).forEach((t: any) => { (transactionsByTeam[t.team_id] ||= []).push(t) })

  function netIncomeSince(teamId: string, sinceWeek: number, uptoWeek: number): number {
    const rows = transactionsByTeam[teamId] || []
    let net = 0
    for (const r of rows) {
      if (r.week_number < sinceWeek || r.week_number > uptoWeek) continue
      net += r.type === 'revenue' ? (r.amount || 0) : -(r.amount || 0)
    }
    return net
  }

  const rosterByTeam: Record<string, any[]> = {}
  ;(allPlayers || []).forEach((p: any) => { (rosterByTeam[p.team_id] ||= []).push(p) })

  // Franchise Storylines' real-data inputs — league-wide, grouped per
  // player, so the per-team loop below just looks up its own star(s).
  const injuryCountByPlayer: Record<number, number> = {}
  ;(injuryLog || []).forEach((i: any) => { injuryCountByPlayer[i.player_id] = (injuryCountByPlayer[i.player_id] || 0) + 1 })

  const awardPlayerIds = new Set<number>((awards || []).map((a: any) => a.player_id))

  const extensionStatusByPlayer: Record<number, { status: string, rejectionReason: string | null }> = {}
  ;(extensionOffers || []).forEach((e: any) => { extensionStatusByPlayer[e.player_id] = { status: e.status, rejectionReason: e.rejection_reason || null } })

  const extraPicksByTeam: Record<string, number> = {}
  ;(draftPicks || []).forEach((pk: any) => {
    if (pk.team_id === pk.original_team_id) return
    const pickYear = parseInt(String(pk.season), 10)
    if (!isNaN(pickYear) && pickYear > currentSeasonYear) extraPicksByTeam[pk.team_id] = (extraPicksByTeam[pk.team_id] || 0) + 1
  })

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

  function completedConstructionsSince(teamId: string, sinceIso: string | null | undefined): number {
    if (!sinceIso) return 0
    return (constructions || []).filter((c: any) => c.team_id === teamId && c.ends_at && new Date(c.ends_at) >= new Date(sinceIso)).length
  }

  // Season Targets criteria inputs — real team name lookup (for rivalry
  // criterion text), who-beat-whom this season (from the same full-season
  // recentGames fetch already used for last10ByTeam, just unbounded per
  // team here instead of capped at 10), and real conference standings rank
  // (same computation shape as notifications.ts's playoff-position check).
  const teamNameById: Record<string, string> = {}
  teams.forEach((t: any) => { teamNameById[t.id] = t.name })

  const beatOpponentByTeam: Record<string, Set<string>> = {}
  ;(recentGames || []).forEach((g: any) => {
    if (g.home_score > g.away_score) (beatOpponentByTeam[g.home_team] ||= new Set()).add(g.away_team)
    else if (g.away_score > g.home_score) (beatOpponentByTeam[g.away_team] ||= new Set()).add(g.home_team)
  })

  const teamsByConference: Record<string, any[]> = {}
  teams.forEach((t: any) => { (teamsByConference[t.conference] ||= []).push(t) })
  const conferenceRankByTeam: Record<string, number> = {}
  Object.values(teamsByConference).forEach((list: any[]) => {
    const sorted = [...list].sort((a, b) => {
      const aPct = (a.wins || 0) / Math.max(1, (a.wins || 0) + (a.losses || 0))
      const bPct = (b.wins || 0) / Math.max(1, (b.wins || 0) + (b.losses || 0))
      return bPct - aPct
    })
    sorted.forEach((t: any, i: number) => { conferenceRankByTeam[t.id] = i + 1 })
  })

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
    let wni = computeWinNowIndex(roster, extraPicks)
    let label = winNowLabel(wni)

    const topPlayers: StorylinePlayer[] = [...roster]
      .sort((a: any, b: any) => (b.real_ovr || 0) - (a.real_ovr || 0))
      .slice(0, 2)
      .map((p: any) => ({ id: p.id, name: p.name, real_ovr: p.real_ovr || 0, age: p.age || 25, contract_years: p.contract_years ?? null }))
    const rivalInfo = team.rival_team_id ? { teamId: team.rival_team_id, name: teamNameById[team.rival_team_id] || team.rival_team_id } : null

    // Lock the expectation baseline ONCE per GM tenure — a mid-season trade
    // that suddenly makes this team look like a contender or a rebuild must
    // NOT change what Fans/Owners already expect this season (Bruno's
    // explicit requirement). Locks at the later of "Free Agency just ended"
    // or "this GM's tenure started," using whatever roster exists at that
    // exact moment — the roster right after Free Agency is what really
    // defines the season, not whatever it drifts into by opening night. If
    // a tenure starts outside any of the eligible phases (e.g. hired during
    // playoffs), locking is deferred — there's no real season left to hold
    // expectations against until the next one's Free Agency closes.
    const tenureStartWeek = tenureStartWeekByTeam[team.id] ?? 1
    let lockedTarget = lockedTargetByTeam[team.id]
    if (!lockedTarget) {
      const lockWeek = Math.max(FREE_AGENCY_END_WEEK, tenureStartWeek)
      if (week >= lockWeek && LOCK_ELIGIBLE_STATUSES.has(getStatusForWeek(week))) {
        const fansTargetWins = Math.round(expectedWinPct(wni) * TOTAL_SEASON_GAMES)
        const ownersTargetWins = Math.round(ownersExpectedWinPct(wni) * TOTAL_SEASON_GAMES)
        const fansCriteria = selectFansCriteria({ star: topPlayers[0], rival: rivalInfo, wni })
        const ownersCriteria = selectOwnersCriteria({ star: topPlayers[0], gymGrade: gymGradeByTeam[team.id], wni })
        const { data: inserted } = await supabaseAdmin.from('gm_season_targets').insert({
          team_id: team.id, season: SEASON, tenure_started_week: tenureStartWeek,
          locked_week: week, locked_wni: wni, locked_win_now_label: label,
          fans_target_wins: fansTargetWins, owners_target_wins: ownersTargetWins,
          fans_criteria: fansCriteria, owners_criteria: ownersCriteria,
        }).select().single()
        lockedTarget = inserted
        if (lockedTarget) {
          const lang = await getTeamLang(team.id)
          const situationLabelPT = WIN_NOW_LABEL_PT[label as WinNowLabel] || label
          const situationLabelEN = label.replace(/_/g, ' ')
          const subject = lang === 'pt' ? '🎯 As expetativas da época foram definidas' : '🎯 Season expectations are locked in'
          const body = lang === 'pt'
            ? `A tua situação foi avaliada como "${situationLabelPT}". Os Fãs esperam pelo menos ${fansTargetWins} vitórias e a Administração pelo menos ${ownersTargetWins} — fixo até ao fim da época, mesmo que a equipa mude de rumo. Consulta a aba Satisfação para veres a lista completa de critérios.`
            : `Your situation was assessed as "${situationLabelEN}". Fans expect at least ${fansTargetWins} wins and Ownership at least ${ownersTargetWins} — fixed for the rest of the season, even if the team's direction changes. Check the Satisfaction tab for the full criteria checklist.`
          await notify(team.id, 'ownership', subject, body, { lockedWeek: week, fansTargetWins, ownersTargetWins, winNowLabel: label })
        }
      }
    }
    // Back-lock the criteria SET for rows created before this feature
    // shipped (they locked win targets but have no criteria stored yet) —
    // a one-time catch-up using the current roster, not a recurring
    // recompute (the set still stays fixed for the rest of the season
    // from this point on).
    if (lockedTarget && !(lockedTarget.fans_criteria?.length) && !(lockedTarget.owners_criteria?.length)) {
      const backfillFans = selectFansCriteria({ star: topPlayers[0], rival: rivalInfo, wni: lockedTarget.locked_wni })
      const backfillOwners = selectOwnersCriteria({ star: topPlayers[0], gymGrade: gymGradeByTeam[team.id], wni: lockedTarget.locked_wni })
      await supabaseAdmin.from('gm_season_targets').update({ fans_criteria: backfillFans, owners_criteria: backfillOwners }).eq('id', lockedTarget.id)
      lockedTarget.fans_criteria = backfillFans
      lockedTarget.owners_criteria = backfillOwners
    }
    if (lockedTarget) {
      wni = lockedTarget.locked_wni
      label = lockedTarget.locked_win_now_label
    }
    const netIncomeSinceLock = lockedTarget ? netIncomeSince(team.id, lockedTarget.locked_week, week) : 0

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
    const prev = prevByTeam[team.id]
    const prevFollowers = prev?.owners_breakdown?.rawFollowers
    const prevPopularity = prev?.owners_breakdown?.rawPopularity
    const currentFollowers = team.social_media_followers || 0
    const followerGrowthPct = prevFollowers && prevFollowers > 0 ? (currentFollowers - prevFollowers) / prevFollowers : 0
    const popularityDelta = prevPopularity != null ? (team.popularity ?? 50) - prevPopularity : 0

    const owners = computeOwnersScore({
      actualWinPct, wni, last10WinPct, rosterQualityNorm, capUtilizationPct, extraPicks,
      gymGrade: gymGradeByTeam[team.id], arenaScoreNorm: arenaScoreNormByTeam[team.id] ?? 50, netIncomeSinceLock,
      followerGrowthPct, popularityDelta, completedConstructionsThisSeason: completedConstructionsByTeam[team.id] || 0,
    })
    owners.breakdown.rawFollowers = currentFollowers
    owners.breakdown.rawPopularity = team.popularity ?? 50

    // Concrete, objectively-checkable, FRANCHISE-SPECIFIC Season Targets
    // (per Bruno's ask: "são objetivamente avaliáveis?" and "não reflete o
    // que cada fanbase e ownership privilegia") — the criterion SET was
    // locked once (above), real current progress is read live every week.
    const criterionCtx = {
      currentWins: team.wins ?? 0, netIncomeSinceLock, avgRosterMoral,
      openInteractionCount: openInteractionsByTeam[team.id] || 0,
      managementScore: owners.breakdown.managementScore, avgYoungRealOvrDelta,
      extensionAcceptedForPlayer: (playerId: number) => extensionStatusByPlayer[playerId]?.status === 'accepted',
      beatRivalThisSeason: (rivalTeamId: string) => !!beatOpponentByTeam[team.id]?.has(rivalTeamId),
      conferenceRank: conferenceRankByTeam[team.id] ?? null,
      completedConstructionsSinceLock: completedConstructionsSince(team.id, lockedTarget?.created_at ?? null),
    }
    const fansCriteria: SeasonCriterion[] = lockedTarget?.fans_criteria || []
    const ownersCriteria: SeasonCriterion[] = lockedTarget?.owners_criteria || []
    fans.breakdown.criteria = fansCriteria.map(c => ({ ...c, ...checkCriterion(c, { ...criterionCtx, targetWins: lockedTarget?.fans_target_wins ?? null }) }))
    owners.breakdown.criteria = ownersCriteria.map(c => ({ ...c, ...checkCriterion(c, { ...criterionCtx, targetWins: lockedTarget?.owners_target_wins ?? null }) }))

    const franchiseStorylines = computeFranchiseStorylines({
      topPlayers, injuryCountByPlayer, awardPlayerIds, extensionStatusByPlayer,
    })

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
      franchise_storylines: franchiseStorylines,
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

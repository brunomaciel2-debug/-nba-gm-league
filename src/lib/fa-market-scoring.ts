// Scoring engine for the Free Agency negotiation week (season week 1).
// Pure functions only — no DB access — so the math can be checked in
// isolation before being wired into the resolution cron.
//
// A free agent judges every competing offer on 4 weighted factors:
//   50% salary offered (relative to the best offer this player received)
//   20% personal ambition (wants to be the roster's best player, vs. wants
//       to join a team that's more likely to win)
//   15% franchise popularity (teams.popularity)
//   15% coaching staff quality + already having a star-caliber teammate

export const WEIGHT_SALARY = 0.50
export const WEIGHT_AMBITION = 0.20
export const WEIGHT_POPULARITY = 0.15
export const WEIGHT_STAFF = 0.15

export const STAR_OVR_THRESHOLD = 88
export const NO_BRAINER_MARGIN = 15 // score-point gap between #1 and #2 offer

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export function salaryScore(offerSalary: number, maxSalaryAmongOffers: number): number {
  if (maxSalaryAmongOffers <= 0) return 0
  return clamp((offerSalary / maxSalaryAmongOffers) * 100, 0, 100)
}

// Would this player be the roster's #1, #2, #3... best player if he signs?
// currentRosterOvrs = the destination team's existing active roster, NOT
// including the candidate himself.
export function faceOfFranchiseScore(candidateOvr: number, currentRosterOvrs: number[]): number {
  const rank = currentRosterOvrs.filter(o => o > candidateOvr).length + 1
  const table = [100, 80, 60, 40, 20]
  return table[rank - 1] ?? 0
}

// Team win-likelihood, derived from Elo (default Elo is ~1500 -> 50/100 neutral).
export function winLikelihoodScore(teamElo: number): number {
  return clamp((teamElo - 1200) / 6, 0, 100)
}

export function ambitionScore(ambition: number | null | undefined, candidateOvr: number, currentRosterOvrs: number[], teamElo: number): number {
  const face = faceOfFranchiseScore(candidateOvr, currentRosterOvrs)
  const win = winLikelihoodScore(teamElo)
  const w = (ambition ?? 50) / 100
  return w * face + (1 - w) * win
}

export function popularityScore(teamPopularity: number | null | undefined): number {
  return teamPopularity ?? 50
}

export type CoachAttrs = {
  off_adjustment?: number, def_adjustment?: number,
  off_development?: number, def_development?: number, tactical_dev?: number,
}

// Same 5-attribute average already used by staffRating() in free-agents/page.tsx.
function coachRating(c: CoachAttrs | null | undefined): number {
  if (!c) return 50
  return ((c.off_adjustment || 0) + (c.def_adjustment || 0) + (c.off_development || 0) + (c.def_development || 0) + (c.tactical_dev || 0)) / 5
}

export function staffQualityScore(headCoach: CoachAttrs | null | undefined, assistantCoach: CoachAttrs | null | undefined, currentRosterOvrs: number[]): number {
  const rating = coachRating(headCoach) * 0.7 + coachRating(assistantCoach) * 0.3
  const hasStar = currentRosterOvrs.some(o => o >= STAR_OVR_THRESHOLD)
  return clamp(rating * 0.7 + (hasStar ? 100 : 0) * 0.3, 0, 100)
}

export function weightedOfferScore(components: { salaryScore: number, ambitionScore: number, popularityScore: number, staffQualityScore: number }): number {
  return components.salaryScore * WEIGHT_SALARY
    + components.ambitionScore * WEIGHT_AMBITION
    + components.popularityScore * WEIGHT_POPULARITY
    + components.staffQualityScore * WEIGHT_STAFF
}

// 1 day if there's no real competition (single offer, or a blowout win);
// 2 days if it's a genuinely close call.
export function decisionDays(sortedScoresDesc: number[]): 1 | 2 {
  if (sortedScoresDesc.length <= 1) return 1
  const margin = sortedScoresDesc[0] - sortedScoresDesc[1]
  return margin >= NO_BRAINER_MARGIN ? 1 : 2
}

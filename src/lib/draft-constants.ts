// Shared constants for the real Draft execution engine.
// Rookie contract $ tables are three INDEPENDENT fixed schedules — none of
// them is ever derived from another via a percentage (no "current salary
// * 1.2", ever) since escalating-% contracts would break the hard salary
// cap this game is built around. Every number here is a flat, pre-decided
// dollar figure looked up by pick number, nothing computed at signing time.

// Fallback default only — the real, current value lives in the
// `draft_config` table (see getNextDraftSeason()/setNextDraftSeason() in
// draft-lottery.ts) and updates automatically every time a new Draft Class
// is uploaded through /admin/draft-class, no code change ever needed.
export const DEFAULT_DRAFT_SEASON = '2027'

function linearScale(highPick1: number, lowPick30: number): number[] {
  const arr: number[] = []
  for (let pick = 1; pick <= 30; pick++) {
    const t = (pick - 1) / 29 // 0 at pick 1, 1 at pick 30
    const raw = highPick1 - t * (highPick1 - lowPick30)
    arr.push(Math.round(raw / 10_000) * 10_000) // round to nearest $10K
  }
  return arr
}

// Round 1 — indexed [pick - 1], pick 1..30
export const ROOKIE_TIER_R1 = {
  year1: linearScale(10_000_000, 2_000_000),   // 2 guaranteed years at this flat salary
  y3Option: linearScale(12_000_000, 2_400_000), // independent fixed table, not year1 * 1.2
  y4Option: linearScale(14_000_000, 2_800_000), // independent fixed table, not y3Option * 1.17
}

// Round 2 (picks 31-60) — flat, identical for every pick, no tiering at all
export const ROOKIE_TIER_R2_FLAT = {
  year1: 1_200_000,
  y3Option: 1_400_000,
  y4Option: 1_600_000,
}

export function rookieYear1Salary(round: 1 | 2, pickNumber: number): number {
  if (round === 1) return ROOKIE_TIER_R1.year1[pickNumber - 1] ?? ROOKIE_TIER_R1.year1[29]
  return ROOKIE_TIER_R2_FLAT.year1
}

export function rookieOptionSalary(round: 1 | 2, pickNumber: number, stage: 'y3' | 'y4'): number {
  if (round === 1) {
    const table = stage === 'y3' ? ROOKIE_TIER_R1.y3Option : ROOKIE_TIER_R1.y4Option
    return table[pickNumber - 1] ?? table[29]
  }
  return stage === 'y3' ? ROOKIE_TIER_R2_FLAT.y3Option : ROOKIE_TIER_R2_FLAT.y4Option
}

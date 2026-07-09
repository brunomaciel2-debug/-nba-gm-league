// Shared "on-paper roster talent" formula — top-8 usage-weighted average
// real_ovr. Originally built for Power Rankings (early-season signal, before
// wins/last-5/Elo can tell teams apart), reused by Coach of the Year to
// compute an "expected win%" baseline. Kept in one place so the two features
// can never drift out of sync with each other.
export function computeRosterQuality(roster: { real_ovr?: number, usage?: number }[]): number {
  const top8ByUsage = [...roster].sort((a, b) => (b.usage || 0) - (a.usage || 0)).slice(0, 8)
  const totalW = top8ByUsage.reduce((s, p) => s + (p.usage || 50), 0) || 1
  return top8ByUsage.reduce((s, p) => s + (p.real_ovr || 70) * (p.usage || 50), 0) / totalW
}

// Same normalization Power Rankings already uses — bounds (73-85) calibrated
// from this season's actual top-8 weighted real_ovr spread across all 30 teams.
export function normalizeRosterQuality(rosterQuality: number): number {
  return Math.min(1, Math.max(0, (rosterQuality - 73) / 12))
}

function clamp01(v: number): number { return Math.min(1, Math.max(0, v)) }

// Average age of the top-5 usage players — the "how old is the actual
// rotation" signal, shared by Power Rankings' narrative text and the
// Win-Now Index below.
export function computeTop5AvgAge(roster: { usage?: number, age?: number }[]): number {
  const top5ByUsage = [...roster].sort((a, b) => (b.usage || 0) - (a.usage || 0)).slice(0, 5)
  return top5ByUsage.length ? top5ByUsage.reduce((s, p) => s + (p.age || 25), 0) / top5ByUsage.length : 25
}

// Count of roster players graded A or B potential — the "how much upside is
// still on this roster" signal.
export function countHighPotential(roster: { potential_grade?: string }[]): number {
  return roster.filter(p => p.potential_grade === 'A' || p.potential_grade === 'B').length
}

// Win-Now Index (WNI) — continuous 0 (full rebuild) to 1 (true contender)
// team-situation score, built from roster STRUCTURE (talent/age/prospects/
// banked picks), deliberately NOT from this season's win/loss record — a
// team's rebuild-vs-contend phase is what the GM built, not a byproduct of
// this year's results (otherwise "fans should be forgiving because we're
// rebuilding" would circularly depend on "we're rebuilding because we're
// losing"). Talent dominates (55%) since normalizeRosterQuality is the
// best-calibrated existing signal; age/banked-picks/prospect-count are 15%
// modifiers each — an older, thinner-on-picks-and-prospects but otherwise
// average-talent team still reads as more "win-now" than a young, pick-rich,
// prospect-heavy one at the same talent level.
export function computeWinNowIndex(roster: { real_ovr?: number, usage?: number, age?: number, potential_grade?: string }[], extraPicks: number): number {
  const rosterQualityNorm = normalizeRosterQuality(computeRosterQuality(roster))
  const avgAge = computeTop5AvgAge(roster)
  const highPotentialCount = countHighPotential(roster)

  const ageFactor = clamp01((avgAge - 24) / 6)
  const picksFactor = clamp01(extraPicks / 3)
  const potentialFactor = clamp01(highPotentialCount / 6)

  return clamp01(
    0.55 * rosterQualityNorm
    + 0.15 * ageFactor
    + 0.15 * (1 - picksFactor)
    + 0.15 * (1 - potentialFactor)
  )
}

export type WinNowLabel = 'rebuild' | 'retool' | 'competitive' | 'contender'

export function winNowLabel(wni: number): WinNowLabel {
  if (wni < 0.35) return 'rebuild'
  if (wni < 0.65) return 'retool'
  if (wni < 0.85) return 'competitive'
  return 'contender'
}

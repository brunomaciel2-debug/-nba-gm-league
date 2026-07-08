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

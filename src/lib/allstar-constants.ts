// Pure constants/formulas shared between the client-side voting page and the
// server-side resolver (src/lib/allstar-resolver.ts) — kept dependency-free
// (no supabaseAdmin) so this is safe to import from a 'use client' page.

// Real regular season runs weeks 17-40 (see season-week-helper.ts) — All-Star
// Weekend sits at roughly the season's 2/3 mark, same real-world timing as
// the NBA's actual mid-February break.
export const REGULAR_SEASON_START_WEEK = 17
export const REGULAR_SEASON_END_WEEK = 40
export const REGULAR_SEASON_LENGTH = REGULAR_SEASON_END_WEEK - REGULAR_SEASON_START_WEEK + 1 // 24 weeks
export const VOTING_OPENS_WEEK = 28
export const VOTING_CLOSES_WEEK = 30
export const ANNOUNCE_WEEK = 31
export const ALLSTAR_WEEK = 32

export function expectedGamesByWeek(week: number): number {
  const weeksElapsed = Math.max(0, Math.min(week, REGULAR_SEASON_END_WEEK) - (REGULAR_SEASON_START_WEEK - 1))
  return Math.max(1, Math.round((weeksElapsed / REGULAR_SEASON_LENGTH) * 82))
}
export function minGamesByWeek(week: number): number {
  return week < REGULAR_SEASON_START_WEEK ? 0 : Math.floor(expectedGamesByWeek(week) * 0.75)
}

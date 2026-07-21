// Pure constants/formulas shared between the client-side voting page and the
// server-side resolver (src/lib/allstar-resolver.ts) — kept dependency-free
// (no supabaseAdmin) so this is safe to import from a 'use client' page.

// Real regular season runs weeks 17-40 (see season-week-helper.ts) — All-Star
// Weekend sits at roughly the season's 2/3 mark, same real-world timing as
// the NBA's actual mid-February break.
export const REGULAR_SEASON_START_WEEK = 17
export const REGULAR_SEASON_END_WEEK = 40
export const REGULAR_SEASON_LENGTH = REGULAR_SEASON_END_WEEK - REGULAR_SEASON_START_WEEK + 1 // 24 weeks
// Shifted +1 week from the original 28/30/31/32 — those didn't line up with
// the season_events calendar row for "NBA All-Star Weekend" (Feb 13-15,
// 2026), which getWeekDates()/getHalfWeekDates() show is actually HALF 1
// (days 0-2) of week 33, not week 32 (Feb 6-12). Shifting the whole voting
// timeline to match keeps the same relative spacing (opens 4 weeks out,
// closes 2 weeks out, announced 1 week out).
export const VOTING_OPENS_WEEK = 29
export const VOTING_CLOSES_WEEK = 31
export const ANNOUNCE_WEEK = 32
export const ALLSTAR_WEEK = 33
// Which half of ALLSTAR_WEEK is the actual dedicated no-other-games block —
// half 1 (days 0-2, see getHalfWeekDates()) covers exactly Feb 13-15, the
// 3-day window the season_events row describes. Half 2 of the same week
// still carries a normal (lighter) slate of regular games.
export const ALLSTAR_HALF = 1 as const

export function expectedGamesByWeek(week: number): number {
  const weeksElapsed = Math.max(0, Math.min(week, REGULAR_SEASON_END_WEEK) - (REGULAR_SEASON_START_WEEK - 1))
  return Math.max(1, Math.round((weeksElapsed / REGULAR_SEASON_LENGTH) * 82))
}
export function minGamesByWeek(week: number): number {
  return week < REGULAR_SEASON_START_WEEK ? 0 : Math.floor(expectedGamesByWeek(week) * 0.75)
}

// src/lib/season-week-helper.ts
// Maps week numbers to season status and dates
// Season starts Week 1 = Jul 4, 2025 (always treated as Monday)

export const SEASON_WEEK_START = new Date('2025-07-04T00:00:00')

export function getWeekDates(week: number): { start: Date; end: Date } {
  const start = new Date(SEASON_WEEK_START)
  start.setDate(start.getDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { start, end }
}

// Reverse of getWeekDates() — which week number a real calendar date falls
// into. Accepts a 'YYYY-MM-DD' string (matching how scheduled_date is
// stored) so callers never have to worry about timezone drift from
// constructing a Date directly.
export function getWeekForDate(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.round((d.getTime() - SEASON_WEEK_START.getTime()) / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

// Splits a week's date range into the same two halves the simulator now
// runs in — days 0-2 (3 days) and days 3-6 (4 days) — matching the 4
// rounds of games per week (offsets 0,2,4,6 in schedule-generator.ts):
// rounds 0-1 fall in half 1, rounds 2-3 fall in half 2.
export function getHalfWeekDates(week: number, half: 1 | 2): { start: Date; end: Date } {
  const { start: weekStart, end: weekEnd } = getWeekDates(week)
  if (half === 1) {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 2)
    return { start: weekStart, end }
  }
  const start = new Date(weekStart)
  start.setDate(start.getDate() + 3)
  return { start, end: weekEnd }
}

export function getStatusForWeek(week: number): string {
  if (week <= 0)              return 'pre-season'
  if (week === 1)             return 'free-agency'      // Jul 4-10
  if (week <= 3)              return 'summer-league'    // Jul 11-24
  if (week <= 13)             return 'offseason'        // Jul 25 - Oct 1
  if (week <= 16)             return 'pre-season'       // Oct 2-20
  if (week <= 40)             return 'regular-season'   // Oct 21 - Apr 12
  if (week === 41)            return 'play-in'          // Apr 13-19
  if (week <= 49)             return 'playoffs'         // Apr 20 - Jun 14
  if (week === 50)            return 'draft-submission-r1' // Round 1 pick-order deadline week
  if (week === 51)            return 'draft-round1'     // Round 1 draft day (contains Jun 23) + Round 2 submission window
  if (week === 52)            return 'draft-round2'     // Round 2 draft day
  return 'offseason'                                    // Jun 15+ (Reset)
}

// Round 1's pick-order submission window spans weeks 49-50 (opens 2 weeks
// before draft day, closes the week before) — it overlaps the tail end of
// the 'playoffs' phase (week 49), so it's checked independently rather
// than folded into getStatusForWeek()'s single phase label.
export function isDraftSubmissionOpen(round: 1 | 2, week: number): boolean {
  if (round === 1) return week === 49 || week === 50
  return week === 51 // Round 2: opens right after Round 1 resolves, closes before week 52
}

export function isPlayableWeek(week: number): boolean {
  const status = getStatusForWeek(week)
  return ['regular-season', 'play-in', 'playoffs', 'pre-season', 'summer-league'].includes(status)
}

export function getSimDate(week: number): Date {
  if (week <= 0) return new Date('2025-10-01T00:00:00')
  const { start } = getWeekDates(week)
  return start
}

export function formatSimDate(week: number, locale: string = 'en-US'): string {
  const d = getSimDate(week)
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

// "Week 36" on its own means nothing to Bruno — he wants the real simulated
// calendar range it maps to instead (e.g. "Mar 13–19"), everywhere a raw
// week number would otherwise be shown as a label.
export function formatWeekRange(week: number, locale: string = 'en-US'): string {
  const { start, end } = getWeekDates(week)
  const fmt = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  return `${fmt(start)}–${fmt(end)}`
}

// Same idea for a half-week block (see getHalfWeekDates) — used wherever a
// "Week X (days 1-3)" label used to appear.
export function formatHalfWeekRange(week: number, half: 1 | 2, locale: string = 'en-US'): string {
  const { start, end } = getHalfWeekDates(week, half)
  const fmt = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  return `${fmt(start)}–${fmt(end)}`
}

// "Month 8" means nothing either — a simulated month is 4 simulated weeks
// (see merchandising.ts), credited to whichever real calendar month its
// last week actually finishes in (same convention FinancesTab's
// weekMonthKey already uses for "Current Month" bucketing).
export function formatSimMonthName(monthNum: number, locale: string = 'en-US'): string {
  const monthEndWeek = monthNum * 4
  const { end } = getWeekDates(monthEndWeek)
  return end.toLocaleDateString(locale, { month: 'long' })
}

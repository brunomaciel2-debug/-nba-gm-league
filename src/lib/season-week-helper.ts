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

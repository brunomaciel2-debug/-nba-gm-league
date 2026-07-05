import { getWeekDates } from '@/lib/season-week-helper'

// Real, traditionally marquee NBA calendar dates — nationally televised,
// consistently packed arenas. Dates computed on the same virtual calendar
// (SEASON_WEEK_START epoch) already used throughout this app for Summer
// League/referee scheduling, not real wall-clock time.
//
// games rows have no literal calendar date for scheduled (unplayed) games —
// only week_number (day_of_week turned out unreliable, confirmed while
// building the referee system: a whole week's games can share one label).
// So the honest, schema-respecting choice is to flag the entire week whose
// date range contains the holiday, not a hand-picked subset of games.
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const d = new Date(year, month, 1)
  let count = 0
  while (true) {
    if (d.getDay() === weekday) {
      count++
      if (count === n) return new Date(d)
    }
    d.setDate(d.getDate() + 1)
  }
}

function isMarqueeDate(d: Date): string | null {
  const year = d.getFullYear(), month = d.getMonth(), date = d.getDate()
  if (month === 11 && date === 25) return 'Christmas Day'
  if (month === 10 && d.getTime() === nthWeekdayOfMonth(year, 10, 4, 4).getTime()) return 'Thanksgiving'
  if (month === 0 && d.getTime() === nthWeekdayOfMonth(year, 0, 1, 3).getTime()) return 'MLK Day'
  if (month === 1 && d.getTime() === nthWeekdayOfMonth(year, 1, 1, 3).getTime()) return "Presidents' Day"
  if (month === 11 && d.getTime() === nthWeekdayOfMonth(year, 11, 2, 2).getTime()) return 'NBA Cup Championship'
  return null
}

export function getMarqueeWeekInfo(week: number): { marquee: boolean, label?: string } {
  // Opening Night is structural (the first regular-season week), not a fixed
  // calendar date — see season-week-helper.ts's phase table.
  if (week === 17) return { marquee: true, label: 'Opening Night' }

  const { start, end } = getWeekDates(week)
  const d = new Date(start)
  while (d <= end) {
    const label = isMarqueeDate(d)
    if (label) return { marquee: true, label }
    d.setDate(d.getDate() + 1)
  }
  return { marquee: false }
}

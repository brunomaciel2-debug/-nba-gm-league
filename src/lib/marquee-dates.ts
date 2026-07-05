import { getWeekDates } from '@/lib/season-week-helper'

// Real, traditionally marquee NBA calendar dates — nationally televised,
// consistently packed arenas. Dates computed on the same virtual calendar
// (SEASON_WEEK_START epoch) already used throughout this app for Summer
// League/referee scheduling, not real wall-clock time.
//
// getMarqueeWeekInfo() below is a week-level check, kept as a fallback for
// any game row without a real scheduled_date. Regular-season games now do
// carry a real per-game scheduled_date (see schedule-generator.ts) — use
// getMarqueeInfoForDate() for those, so only the game actually on the
// holiday gets flagged, not every game in that whole week.
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

// Per-game version — now that regular-season games carry a real
// `scheduled_date` (see schedule-generator.ts), marquee status can be
// checked against the ONE date a specific game is actually played on,
// instead of flagging every game in a whole week. Opening Night is the
// literal first calendar day of the regular season (week 17's start date),
// so only the handful of games actually scheduled that day get the badge —
// not all ~4 games a team plays across the whole of week 17.
export function getMarqueeInfoForDate(date: Date | string, week?: number): { marquee: boolean, label?: string } {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  if (week === 17) {
    const open = getWeekDates(17).start
    if (d.getFullYear() === open.getFullYear() && d.getMonth() === open.getMonth() && d.getDate() === open.getDate()) {
      return { marquee: true, label: 'Opening Night' }
    }
  }
  const label = isMarqueeDate(d)
  return label ? { marquee: true, label } : { marquee: false }
}

// `label` above is a stable English key (also used to look up an icon in the
// UI) — this translates it for display without changing that key.
const MARQUEE_LABEL_PT: Record<string, string> = {
  'Christmas Day': 'Semana de Natal',
  'Thanksgiving': 'Semana de Ação de Graças',
  'MLK Day': 'Semana do MLK Day',
  "Presidents' Day": 'Semana do Presidents\' Day',
  'NBA Cup Championship': 'Final da NBA Cup',
  'Opening Night': 'Noite de Abertura',
}

export function getMarqueeLabelText(label: string, isPT: boolean): string {
  if (!isPT) return label
  return MARQUEE_LABEL_PT[label] || label
}

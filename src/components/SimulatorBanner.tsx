'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from './I18nProvider'
import { getStatusForWeek, getHalfWeekDates, formatSimDate, formatWeekRange, getSimDate, SEASON_STATUS_COLORS, SEASON_STATUS_LABELS } from '@/lib/season-week-helper'
import GlobalSearch from './GlobalSearch'

export default function SimulatorBanner() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [config, setConfig] = useState<any>(null)
  const [nextEvent, setNextEvent] = useState<any>(null)

  useEffect(() => {
    supabase.from('season_config').select('*').eq('id', 1).single().then(({ data: cfg }) => {
      setConfig(cfg)
      // season_events rows are dated within the SIMULATED season calendar
      // (Jul 2025 - Jun 2026) — comparing against real wall-clock "today"
      // (as this used to) drifts further wrong every real day that passes
      // without a matching sim day, until eventually every event silently
      // reads as already past and "Next:" just stops showing anything. The
      // simulated "today" (this week's start date) is the correct anchor.
      const simToday = getSimDate(cfg?.current_week || 1)
      const simTodayStr = `${simToday.getFullYear()}-${String(simToday.getMonth() + 1).padStart(2, '0')}-${String(simToday.getDate()).padStart(2, '0')}`
      // Most single-day milestones (draft, trade deadline, playoffs-begin,
      // etc.) store no end_date at all — a plain .gte('end_date', ...)
      // silently drops every one of them (NULL fails any comparison). This
      // treats a NULL end_date as "ends the day it starts" instead.
      supabase.from('season_events')
        .select('*').eq('season', '2025-26')
        .or(`end_date.gte.${simTodayStr},and(end_date.is.null,start_date.gte.${simTodayStr})`)
        .order('start_date').limit(1).single()
        .then(({ data: ev }) => setNextEvent(ev))
    })
  }, [])

  if (!config) return null

  const week = config.current_week || 0
  const nextWeek = week + 1
  // The badge/label describes the week we're actually IN right now (the last
  // one simulated), not the upcoming one — those can differ right at a phase
  // boundary (e.g. the week Pre-Season ends and Regular Season begins), and
  // showing the wrong one here is exactly what made "Week 14" read as "we're
  // in week 14" when it actually meant "week 14 hasn't been simulated yet".
  const status = getStatusForWeek(week)
  const nextStatus = getStatusForWeek(nextWeek)
  const locale = isPT ? 'pt-PT' : 'en-US'

  // Week date range — every week is now simulated in 2 halves (days 1-3,
  // then days 4-7), consistently across every phase, so always show
  // whichever half is coming up next instead of the full 7-day span.
  const nextHalf: 1 | 2 = config.next_sim_half === 2 ? 2 : 1
  const { start: weekStart, end: weekEnd } = nextWeek > 0
    ? getHalfWeekDates(nextWeek, nextHalf)
    : { start: new Date('2025-10-01'), end: new Date('2025-10-07') }
  const halfMarker = isPT ? ` (dias ${nextHalf === 1 ? '1-3' : '4-7'})` : ` (days ${nextHalf === 1 ? '1-3' : '4-7'})`

  const fmtDate = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  const fmtEventDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' })

  const sc = SEASON_STATUS_COLORS[status] || SEASON_STATUS_COLORS['offseason']

  const label = SEASON_STATUS_LABELS[status]
    ? (isPT ? SEASON_STATUS_LABELS[status].pt : SEASON_STATUS_LABELS[status].en)
    : status
  const nextLabel = SEASON_STATUS_LABELS[nextStatus]
    ? (isPT ? SEASON_STATUS_LABELS[nextStatus].pt : SEASON_STATUS_LABELS[nextStatus].en)
    : nextStatus

  const SIM_DAY_PT: Record<string, string> = {
    Monday: 'Segunda', Tuesday: 'Terça', Wednesday: 'Quarta',
    Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sábado', Sunday: 'Domingo',
  }
  const simDay = (d: string) => isPT ? (SIM_DAY_PT[d] ?? d) : d
  const isActive = ['regular-season', 'playoffs', 'play-in', 'pre-season', 'summer-league', 'free-agency'].includes(status)

  // A major event (All-Star Weekend, etc.) 2 sim-weeks out or closer gets its
  // own loud, colored, pulsing badge next to the status pill — not just
  // buried in the small muted "Next:" text on the right, which is easy to
  // miss and says nothing beyond "some event is coming eventually". This is
  // the actual "an event of this magnitude is approaching" notice Bruno
  // asked for, distinct from the routine week-by-week sim info.
  const eventSoon = (() => {
    if (!nextEvent) return false
    const simToday = getSimDate(week || 1)
    const evStart = new Date(nextEvent.start_date + 'T00:00:00')
    const daysUntil = Math.round((evStart.getTime() - simToday.getTime()) / 86400000)
    return daysUntil <= 14
  })()

  return (
    <div style={{ background: '#0a0f1a', borderBottom: '1px solid #1f2937', padding: '6px 0' }}>
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between flex-wrap gap-2">
        {/* Left: status badge + week info */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: sc.bg, color: sc.text }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: sc.dot, display: 'inline-block',
              boxShadow: `0 0 6px ${sc.dot}`,
              animation: isActive ? 'pulse 2s infinite' : 'none',
            }} />
            {label}{week > 0 ? `: ${formatWeekRange(week, locale)}` : ''}
          </span>
          {eventSoon && nextEvent && (
            <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: nextEvent.color || '#b45309', color: '#fff', animation: 'pulse 2s infinite' }}>
              {nextEvent.icon} {nextEvent.event_name} · {fmtEventDate(nextEvent.start_date)}
            </span>
          )}
          {nextWeek > 0 ? (
            <span className="text-xs" style={{ color: '#8a8279' }}>
              {isPT ? 'Próxima simulação:' : 'Next sim:'}{' '}
              <span style={{ color: '#d4cdc5' }}>
                {nextStatus !== status ? `${nextLabel} · ` : ''}
                {fmtDate(weekStart)} – {fmtDate(weekEnd)}{halfMarker}
              </span>
            </span>
          ) : (
            <span className="text-xs" style={{ color: '#8a8279' }}>
              {isPT ? 'Data SIM: ' : 'SIM date: '}
              <span style={{ color: '#d4cdc5' }}>
                {formatSimDate(nextWeek, locale)}
              </span>
            </span>
          )}
        </div>

        {/* Middle: global search — moved here from the top nav bar, which got
            too cramped once it also carried the menus + account controls */}
        <div className="hidden md:block flex-shrink-0" style={{ width: 280 }}>
          <GlobalSearch compact />
        </div>

        {/* Right: next event + sim days */}
        <div className="flex items-center gap-4">
          {nextEvent && (
            <span className="text-xs" style={{ color: '#8a8279' }}>
              {isPT ? 'Próximo:' : 'Next:'}{' '}
              <span style={{ color: '#d4cdc5', fontWeight: 600 }}>
                {nextEvent.icon} {nextEvent.event_name}
              </span>
              {' · '}
              <span style={{ color: '#8a8279' }}>{fmtEventDate(nextEvent.start_date)}</span>
            </span>
          )}
          <span className="text-xs" style={{ color: '#8a8279' }}>
            Sim:{' '}
            <span style={{ color: '#d4cdc5' }}>
              {simDay(config.sim_day_1)} & {simDay(config.sim_day_2)}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTranslation } from './I18nProvider'
import { getStatusForWeek, getWeekDates, getHalfWeekDates, formatSimDate, SEASON_STATUS_COLORS, SEASON_STATUS_LABELS } from '@/lib/season-week-helper'
import GlobalSearch from './GlobalSearch'

export default function SimulatorBanner() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  // Lives in Navbar, which is part of the root layout — Next.js keeps it
  // mounted across client-side navigations, so a mount-only fetch goes
  // stale the moment a simulation runs on another page (e.g. admin/simulate)
  // and never updates again until a hard reload. Re-fetching on every
  // pathname change means arriving at any new page picks up the latest state.
  const pathname = usePathname()
  const [config, setConfig] = useState<any>(null)
  const [nextEvent, setNextEvent] = useState<any>(null)
  // The exact real day the simulation is currently sitting on — not just the
  // week/half range. Bruno's rule: whenever a block/day is simulated, "today"
  // becomes the LAST day actually simulated. This used to be GUESSED from
  // the games table (earliest still-scheduled game in the upcoming half,
  // minus a day), which only worked for the regular season — pre-season
  // friendlies have no scheduled_date of their own in that table, so once
  // "Simulate 1 Day" started correctly stopping after a single day instead
  // of the whole block, this guess had no way to reflect that a day had
  // actually been processed until the WHOLE block finished. Now read
  // directly from season_config.last_sim_day, written by the simulator
  // itself every time it processes a day — no more guessing.
  const [currentDay, setCurrentDay] = useState<Date | null>(null)

  useEffect(() => {
    const load = () => {
      supabase.from('season_config').select('*').eq('id', 1).single().then(async ({ data: cfg }) => {
        setConfig(cfg)
        const week = cfg?.current_week || 0
        const nextWeek = week + 1
        let lastSimDay: Date
        if (cfg?.last_sim_day) {
          lastSimDay = new Date(cfg.last_sim_day + 'T12:00:00')
        } else {
          // Fallback for a state predating this column (or before any
          // simulation has ever run) — same guess as before.
          const nextHalf: 1 | 2 = cfg?.next_sim_half === 2 ? 2 : 1
          const { start: blockStart, end: blockEnd } = nextWeek > 0
            ? getHalfWeekDates(nextWeek, nextHalf)
            : { start: new Date('2025-10-01'), end: new Date('2025-10-07') }
          const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          const { data: nextGame } = await supabase.from('games').select('scheduled_date')
            .eq('week_number', nextWeek).eq('status', 'scheduled')
            .gte('scheduled_date', ymd(blockStart)).lte('scheduled_date', ymd(blockEnd))
            .order('scheduled_date').limit(1).maybeSingle()
          const nextDayDate = nextGame?.scheduled_date ? new Date(nextGame.scheduled_date + 'T12:00:00') : blockStart
          lastSimDay = new Date(nextDayDate)
          lastSimDay.setDate(lastSimDay.getDate() - 1)
        }
        setCurrentDay(lastSimDay)

        // season_events rows are dated within the SIMULATED season calendar
        // (Jul 2025 - Jun 2026) — comparing against real wall-clock "today"
        // (as this used to) drifts further wrong every real day that passes
        // without a matching sim day, until eventually every event silently
        // reads as already past and "Next event" just stops showing anything.
        // Anchored to the same precise lastSimDay as the day badge above.
        // Only genuinely upcoming events (start_date strictly after today) —
        // the CURRENT phase (Pre-Season, Regular Season, etc.) and when it
        // ends is already shown separately, in the "Now:" pill, so an
        // already-started event like "Pre-Season Games" shouldn't also show
        // up here as if it were still ahead of us.
        const simTodayStr = `${lastSimDay.getFullYear()}-${String(lastSimDay.getMonth() + 1).padStart(2, '0')}-${String(lastSimDay.getDate()).padStart(2, '0')}`
        supabase.from('season_events')
          .select('*').eq('season', '2025-26')
          .gt('start_date', simTodayStr)
          .order('start_date').limit(1).single()
          .then(({ data: ev }) => setNextEvent(ev))
      })
    }
    load()
    // Covers the case where the GM never navigates away from the page that
    // triggered the simulation (e.g. clicking "Simulate" repeatedly on
    // admin/simulate) — the pathname alone wouldn't change there.
    window.addEventListener('sim-updated', load)
    return () => window.removeEventListener('sim-updated', load)
  }, [pathname])

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

  // When does the CURRENT phase (Pre-Season, Regular Season, etc.) actually
  // end? Walk forward week by week until the status changes, then take that
  // last matching week's end date — same status-boundary logic
  // getStatusForWeek already encodes, just run forward instead of guessing
  // a fixed range.
  const phaseEndWeek = (() => {
    let w = week
    while (getStatusForWeek(w + 1) === status) w++
    return w
  })()
  const phaseEnd = getWeekDates(phaseEndWeek).end

  const SIM_DAY_PT: Record<string, string> = {
    Monday: 'Segunda', Tuesday: 'Terça', Wednesday: 'Quarta',
    Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sábado', Sunday: 'Domingo',
  }
  const simDay = (d: string) => isPT ? (SIM_DAY_PT[d] ?? d) : d
  const isActive = ['regular-season', 'playoffs', 'play-in', 'pre-season', 'summer-league', 'free-agency'].includes(status)

  // The next event is always strictly upcoming now (see the .gt('start_date',
  // ...) query above) — no more "already ongoing" case to word differently.
  // It still gets a louder, pulsing treatment once it's close, so a
  // genuinely imminent milestone still stands out from routine info.
  const eventSoon = (() => {
    if (!nextEvent || !currentDay) return false
    const evStart = new Date(nextEvent.start_date + 'T00:00:00')
    const daysUntil = Math.round((evStart.getTime() - currentDay.getTime()) / 86400000)
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
            {isPT ? 'Agora' : 'Now'}{week > 0 && currentDay ? `: ${fmtDate(currentDay)}` : ''}
            {week > 0 && (
              <span style={{ fontWeight: 400, opacity: 0.85 }}>
                {' '}({isPT ? `a decorrer: ${label.toLowerCase()} até ${fmtDate(phaseEnd)}` : `ongoing ${label.toLowerCase()} until ${fmtDate(phaseEnd)}`})
              </span>
            )}
          </span>
          {/* The next event — a GM should always be able to see this (Free
              Agency, Trade Deadline, All-Star, etc.), not just when it's
              imminent, so this is not gated behind eventSoon. It only gets
              the loud pulsing treatment once it's actually close —
              otherwise it stays calm/muted so it doesn't compete with the
              status pill for attention. */}
          {nextEvent && (
            <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
              style={eventSoon
                ? { background: nextEvent.color || '#b45309', color: '#fff', animation: 'pulse 2s infinite' }
                : { background: 'transparent', color: '#8a8279', border: '1px solid #2a3441' }}>
              {nextEvent.icon} {isPT ? 'Próximo evento' : 'Next event'}: {nextEvent.event_name} · {fmtEventDate(nextEvent.start_date)}
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

        {/* Right: sim days — the event itself is already shown once, as the
            pulsing badge on the left, so it isn't repeated here too. */}
        <div className="flex items-center gap-4">
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

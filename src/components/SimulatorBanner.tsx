'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from './I18nProvider'
import { getStatusForWeek, getWeekDates, formatSimDate } from '@/lib/season-week-helper'

export default function SimulatorBanner() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [config, setConfig] = useState<any>(null)
  const [nextEvent, setNextEvent] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('season_config').select('*').eq('id', 1).single(),
      supabase.from('season_events')
        .select('*').eq('season', '2025-26')
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('start_date').limit(1).single(),
    ]).then(([{ data: cfg }, { data: ev }]) => {
      setConfig(cfg)
      setNextEvent(ev)
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

  // Week date range
  const { start: weekStart, end: weekEnd } = nextWeek > 0
    ? getWeekDates(nextWeek)
    : { start: new Date('2025-10-01'), end: new Date('2025-10-07') }

  const fmtDate = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  const fmtEventDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' })

  const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
    'free-agency':    { bg: '#1a2a3a', text: '#93c5fd', dot: '#93c5fd' },
    'summer-league':  { bg: '#1a3a2a', text: '#6ee7b7', dot: '#6ee7b7' },
    'pre-season':     { bg: '#1e3a2f', text: '#4ade80', dot: '#4ade80' },
    'regular-season': { bg: '#1e2a3a', text: '#60a5fa', dot: '#60a5fa' },
    'play-in':        { bg: '#3a2a1a', text: '#fbbf24', dot: '#fbbf24' },
    'playoffs':       { bg: '#3a1e1e', text: '#f87171', dot: '#f87171' },
    'offseason':      { bg: '#2a2218', text: '#d4cdc5', dot: '#8a8279' },
  }
  const sc = statusColors[status] || statusColors['offseason']

  const STATUS_LABEL: Record<string, { en: string; pt: string }> = {
    'free-agency':    { en: 'Free Agency',     pt: 'Agência Livre' },
    'summer-league':  { en: 'Summer League',   pt: 'Summer League' },
    'pre-season':     { en: 'Pre-Season',      pt: 'Pré-Época' },
    'regular-season': { en: 'Regular Season',  pt: 'Época Regular' },
    'play-in':        { en: 'Play-In',         pt: 'Play-In' },
    'playoffs':       { en: 'Playoffs',        pt: 'Playoffs' },
    'offseason':      { en: 'Off-Season',      pt: 'Fora de Época' },
  }
  const label = STATUS_LABEL[status]
    ? (isPT ? STATUS_LABEL[status].pt : STATUS_LABEL[status].en)
    : status
  const nextLabel = STATUS_LABEL[nextStatus]
    ? (isPT ? STATUS_LABEL[nextStatus].pt : STATUS_LABEL[nextStatus].en)
    : nextStatus

  const SIM_DAY_PT: Record<string, string> = {
    Monday: 'Segunda', Tuesday: 'Terça', Wednesday: 'Quarta',
    Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sábado', Sunday: 'Domingo',
  }
  const simDay = (d: string) => isPT ? (SIM_DAY_PT[d] ?? d) : d
  const isActive = ['regular-season', 'playoffs', 'play-in', 'pre-season', 'summer-league', 'free-agency'].includes(status)

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
            {label}{week > 0 ? `: ${isPT ? 'Semana' : 'Week'} ${week}` : ''}
          </span>
          {nextWeek > 0 ? (
            <span className="text-xs" style={{ color: '#8a8279' }}>
              {isPT ? 'Próxima simulação:' : 'Next sim:'}{' '}
              <span style={{ color: '#d4cdc5' }}>
                {nextStatus !== status ? `${nextLabel} · ` : ''}
                {isPT ? 'Semana' : 'Week'} {nextWeek} · {fmtDate(weekStart)} – {fmtDate(weekEnd)}
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
          <span className="text-xs" style={{ color: '#506070' }}>
            Sim:{' '}
            <span style={{ color: '#8a8279' }}>
              {simDay(config.sim_day_1)} & {simDay(config.sim_day_2)}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SimulatorBanner() {
  const [config, setConfig] = useState<any>(null)
  const [nextEvent, setNextEvent] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('season_config').select('*').eq('id', 1).single(),
      supabase.from('season_events')
        .select('*')
        .eq('season', '2025-26')
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('start_date')
        .limit(1)
        .single(),
    ]).then(([{ data: cfg }, { data: ev }]) => {
      setConfig(cfg)
      setNextEvent(ev)
    })
  }, [])

  if (!config) return null

  const SEASON_START = new Date('2025-10-21T00:00:00')
  const week = config.current_week || 0

  // Calculate week date range
  const weekStart = new Date(SEASON_START)
  weekStart.setDate(weekStart.getDate() + (week * 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const fmtEventDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const statusColors: Record<string, {bg: string, text: string, dot: string}> = {
    'pre-season':    { bg: '#1e3a2f', text: '#4ade80', dot: '#4ade80' },
    'regular-season':{ bg: '#1e2a3a', text: '#60a5fa', dot: '#60a5fa' },
    'playoffs':      { bg: '#3a1e1e', text: '#f87171', dot: '#f87171' },
    'offseason':     { bg: '#2a2218', text: '#d4cdc5', dot: '#8a8279' },
  }
  const sc = statusColors[config.status] || statusColors['offseason']

  const statusLabel: Record<string, string> = {
    'pre-season': 'Pre-Season',
    'regular-season': 'Regular Season',
    'playoffs': 'Playoffs',
    'offseason': 'Off-Season',
  }

  return (
    <div style={{
      background: '#0a0f1a',
      borderBottom: '1px solid #1f2937',
      padding: '6px 0',
    }}>
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between flex-wrap gap-2">

        {/* Left: Season phase + week */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: sc.bg, color: sc.text }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: sc.dot, display: 'inline-block',
              boxShadow: `0 0 6px ${sc.dot}`,
              animation: config.status !== 'offseason' ? 'pulse 2s infinite' : 'none',
            }}></span>
            {statusLabel[config.status] || config.status}
          </span>

          {week > 0 ? (
            <span className="text-xs" style={{ color: '#8a8279' }}>
              Week {week} ·{' '}
              <span style={{ color: '#d4cdc5' }}>
                {fmtDate(weekStart)} – {fmtDate(weekEnd)}
              </span>
            </span>
          ) : (
            <span className="text-xs" style={{ color: '#8a8279' }}>
              Season starts{' '}
              <span style={{ color: '#d4cdc5' }}>Oct 21, 2025</span>
            </span>
          )}
        </div>

        {/* Right: Next event + sim days */}
        <div className="flex items-center gap-4">
          {nextEvent && (
            <span className="text-xs" style={{ color: '#8a8279' }}>
              Next:{' '}
              <span style={{ color: '#d4cdc5', fontWeight: 600 }}>
                {nextEvent.icon} {nextEvent.event_name}
              </span>
              {' '}·{' '}
              <span style={{ color: '#8a8279' }}>
                {fmtEventDate(nextEvent.start_date)}
              </span>
            </span>
          )}
          <span className="text-xs" style={{ color: '#506070' }}>
            Sim: <span style={{ color: '#8a8279' }}>{config.sim_day_1} & {config.sim_day_2}</span>
          </span>
        </div>

      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getStatusForWeek, getWeekDates } from '@/lib/season-week-helper'

const TYPE_COLORS: Record<string, string> = {
  milestone: '#c8102e',
  event: '#1d4ed8',
  transaction: '#15803d',
}

export default function SeasonSidebar() {
  const [events, setEvents] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('season_events').select('*').eq('season','2025-26').order('start_date'),
      supabase.from('season_config').select('*').eq('id',1).single(),
    ]).then(([{data: evs}, {data: cfg}]) => {
      setEvents(evs || [])
      setConfig(cfg)
    })
  }, [])

  const today = new Date()

  const fmt = (d: string) => {
    const date = new Date(d + 'T12:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getStatus = (ev: any) => {
    const start = new Date(ev.start_date + 'T00:00:00')
    const end = ev.end_date ? new Date(ev.end_date + 'T23:59:59') : start
    if (today > end) return 'past'
    if (today >= start) return 'active'
    return 'upcoming'
  }

  // Calculate current simulator week/phase — mirrors SimulatorBanner.tsx exactly,
  // so both widgets always agree (they used to use incompatible week-numbering schemes)
  const currentWeek = config?.current_week || 0
  const nextWeek = currentWeek + 1
  const phase = getStatusForWeek(nextWeek)
  const { start: simDate, end: simDateEnd } = getWeekDates(nextWeek)

  const simDateStr = simDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const simDateEndStr = simDateEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const statusLabel: Record<string, string> = {
    'free-agency': 'Free Agency',
    'summer-league': 'Summer League',
    'pre-season': 'Pre-Season',
    'regular-season': 'Regular Season',
    'play-in': 'Play-In',
    'playoffs': 'Playoffs',
    'offseason': 'Off-Season',
  }

  // Show active + next 4 upcoming events
  const active = events.filter(e => getStatus(e) === 'active')
  const upcoming = events.filter(e => getStatus(e) === 'upcoming').slice(0, active.length > 0 ? 3 : 4)
  const toShow = [...active, ...upcoming]

  return (
    <div className="flex flex-col gap-3">

      {/* Current simulator status */}
      <div className="rounded-xl p-4" style={{background:'#1a1512',border:'1px solid #3a3228'}}>
        <div className="text-xs font-bold uppercase tracking-widest mb-3"
             style={{color:'#8a8279',letterSpacing:'1.5px'}}>
          📅 Simulator Status
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{color:'#8a8279'}}>Season</span>
          <span className="text-xs font-bold" style={{color:'#f5f1eb'}}>2025-26</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{color:'#8a8279'}}>Phase</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded"
                style={{background:'#c8102e22',color:'#c8102e'}}>
            {statusLabel[phase] || phase}
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{color:'#8a8279'}}>Week</span>
          <span className="text-xs font-bold" style={{color:'#f5f1eb'}}>
            Week {nextWeek} · {simDateStr}–{simDateEndStr}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{color:'#8a8279'}}>Sim days</span>
          <span className="text-xs" style={{color:'#8a8279'}}>
            {config?.sim_day_1} & {config?.sim_day_2}
          </span>
        </div>
      </div>

      {/* Upcoming events */}
      {toShow.length > 0 && (
        <div className="rounded-xl p-4" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <div className="text-xs font-bold uppercase tracking-widest mb-3"
               style={{color:'#5c554e',letterSpacing:'1.5px'}}>
            📆 Season Events
          </div>
          <div className="flex flex-col gap-2">
            {toShow.map(ev => {
              const status = getStatus(ev)
              const color = TYPE_COLORS[ev.event_type] || '#5c554e'
              const isActive = status === 'active'
              const dateStr = ev.end_date
                ? `${fmt(ev.start_date)} – ${fmt(ev.end_date)}`
                : fmt(ev.start_date)

              return (
                <div key={ev.id}
                     className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                     style={{
                       background: isActive ? color + '12' : '#f5f1eb',
                       border: `1px solid ${isActive ? color + '44' : '#e2dcd5'}`,
                       borderLeft: `3px solid ${color}`,
                     }}>
                  <span style={{fontSize:13,flexShrink:0}}>{ev.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold truncate" style={{color:'#1a1512'}}>
                        {ev.event_name}
                      </span>
                      {isActive && (
                        <span className="text-xs font-bold px-1 py-0.5 rounded flex-shrink-0"
                              style={{background:color,color:'#fff',fontSize:8}}>
                          NOW
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{color: isActive ? color : '#8a8279', fontWeight: isActive ? 600 : 400}}>
                      {dateStr}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

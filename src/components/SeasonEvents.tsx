'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TYPE_COLORS: Record<string, string> = {
  milestone: '#c8102e',
  event: '#1d4ed8',
  transaction: '#15803d',
}

export default function SeasonEvents() {
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    supabase.from('season_events')
      .select('*')
      .eq('season', '2025-26')
      .order('start_date')
      .then(({ data }) => setEvents(data || []))
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

  // Show: current active + next 3 upcoming
  const active = events.filter(e => getStatus(e) === 'active')
  const upcoming = events.filter(e => getStatus(e) === 'upcoming').slice(0, active.length > 0 ? 2 : 3)
  const toShow = [...active, ...upcoming]

  if (toShow.length === 0) return null

  return (
    <div className="rounded-xl p-4" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
      <h3 className="text-xs font-bold uppercase tracking-widest mb-3"
          style={{color:'#5c554e',letterSpacing:'1px'}}>
        📅 Season Events
      </h3>
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
                 className="flex items-center gap-2 px-3 py-2 rounded-lg"
                 style={{
                   background: isActive ? color + '12' : '#f0ece5',
                   border: `1px solid ${isActive ? color + '44' : '#e2dcd5'}`,
                   borderLeft: `3px solid ${color}`,
                 }}>
              <span style={{fontSize:14}}>{ev.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold truncate" style={{color:'#1a1512'}}>
                    {ev.event_name}
                  </span>
                  {isActive && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{background:color,color:'#fff',fontSize:9}}>
                      NOW
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs flex-shrink-0"
                    style={{color: isActive ? color : '#8a8279', fontWeight: isActive ? 700 : 400}}>
                {dateStr}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

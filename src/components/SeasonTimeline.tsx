'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TYPE_COLORS: Record<string, string> = {
  milestone: '#c8102e',
  event: '#1d4ed8',
  transaction: '#15803d',
}

export default function SeasonTimeline() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('season_events')
      .select('*')
      .eq('season', '2025-26')
      .order('start_date')
      .then(({ data }) => {
        setEvents(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return null

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

  const upcoming = events.filter(e => getStatus(e) !== 'past').slice(0, 6)

  return (
    <div className="mb-8">
      <div className="section-header mb-5">
        <span className="section-title">📅 Season Calendar</span>
      </div>
      <div className="grid gap-2">
        {upcoming.map((ev, i) => {
          const status = getStatus(ev)
          const color = TYPE_COLORS[ev.event_type] || '#5c554e'
          const isActive = status === 'active'
          const dateStr = ev.end_date
            ? `${fmt(ev.start_date)} – ${fmt(ev.end_date)}`
            : fmt(ev.start_date)

          return (
            <div key={ev.id}
                 className="flex items-center gap-4 px-4 py-3 rounded-xl"
                 style={{
                   background: isActive ? color + '14' : '#faf8f5',
                   border: `1px solid ${isActive ? color + '44' : '#d4cdc5'}`,
                   borderLeft: `4px solid ${isActive ? color : color + '66'}`,
                 }}>
              <div className="text-xl flex-shrink-0">{ev.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm" style={{ color: '#1a1512' }}>
                    {ev.event_name}
                  </span>
                  {isActive && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: color, color: '#fff' }}>
                      NOW
                    </span>
                  )}
                </div>
                {ev.description && (
                  <div className="text-xs mt-0.5 truncate" style={{ color: '#8a8279' }}>
                    {ev.description}
                  </div>
                )}
              </div>
              <div className="text-xs font-semibold flex-shrink-0"
                   style={{ color: isActive ? color : '#8a8279' }}>
                {dateStr}
              </div>
            </div>
          )
        })}
      </div>
      {events.filter(e => getStatus(e) === 'upcoming').length > 6 && (
        <div className="text-center mt-3 text-xs" style={{ color: '#8a8279' }}>
          +{events.filter(e => getStatus(e) === 'upcoming').length - 6} more events
        </div>
      )}
    </div>
  )
}

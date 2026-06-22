'use client'
import { useState } from 'react'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'

type Filter = 'all' | 'home' | 'away' | 'played' | 'upcoming'

export default function TeamSchedule({
  games, teamId, teams
}: {
  games: any[], teamId: string, teams: Record<string,any>
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const filters: {key:Filter, label:string}[] = [
    {key:'all',      label:'All'},
    {key:'upcoming', label:'Upcoming'},
    {key:'played',   label:'Played'},
    {key:'home',     label:'Home'},
    {key:'away',     label:'Away'},
  ]

  const filtered = games.filter(g => {
    if (filter === 'played')   return g.status === 'final'
    if (filter === 'upcoming') return g.status !== 'final'
    if (filter === 'home')     return g.home_team === teamId
    if (filter === 'away')     return g.away_team === teamId
    return true
  })

  // Group by month
  const byMonth: Record<string, any[]> = {}
  for (const g of filtered) {
    const d = g.played_at ? new Date(g.played_at) : null
    const key = d
      ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'TBD'
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(g)
  }

  // Sort months chronologically
  const sortedMonths = Object.keys(byMonth).sort((a, b) => {
    if (a === 'TBD') return 1
    if (b === 'TBD') return -1
    return new Date(a).getTime() - new Date(b).getTime()
  })

  const played   = games.filter(g => g.status === 'final').length
  const upcoming = games.filter(g => g.status !== 'final').length

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Lisbon' })
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="flex gap-4 mb-4 text-sm flex-wrap">
        <span style={{color:'#6b5f4e'}}>{played} played</span>
        <span style={{color:'#6b5f4e'}}>·</span>
        <span style={{color:'#6b5f4e'}}>{upcoming} remaining</span>
        <span style={{color:'#6b5f4e'}}>·</span>
        <span style={{color:'#6b5f4e'}}>{games.length} total</span>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: filter === f.key ? '#1a1512' : '#e8e2d6',
              color:       filter === f.key ? '#f5f1eb' : '#5c554e',
              border:      '1px solid ' + (filter === f.key ? '#1a1512' : '#d4cdc5'),
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 rounded-xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <p className="text-sm" style={{color:'#8a8279'}}>No games found.</p>
        </div>
      )}

      {/* Games grouped by month */}
      {sortedMonths.map(month => (
        <div key={month} className="mb-6">
          {/* Month header */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-widest"
                  style={{color:'#b45309',letterSpacing:'1.5px'}}>
              {month}
            </span>
            <div className="flex-1 h-px" style={{background:'#d4cdc5'}}></div>
            <span className="text-xs" style={{color:'#8a8279'}}>
              {byMonth[month].length} game{byMonth[month].length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Games list */}
          <div className="flex flex-col gap-1.5">
            {byMonth[month]
              .sort((a,b) => new Date(a.played_at||0).getTime() - new Date(b.played_at||0).getTime())
              .map((g, i) => {
                const isHome   = g.home_team === teamId
                const opp      = isHome ? g.away_team : g.home_team
                const oppTeam  = teams[opp]
                const oppColor = oppTeam ? readableTeamColor(oppTeam.color) : '#5c554e'
                const isPlayed = g.status === 'final'
                const myScore  = isHome ? g.home_score : g.away_score
                const oppScore = isHome ? g.away_score : g.home_score
                const won      = isPlayed && myScore > oppScore

                return (
                  <div key={g.id}
                       className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                       style={{
                         background: i % 2 === 0 ? '#faf8f5' : '#f5f1eb',
                         border: '1px solid #e2dcd5',
                       }}>

                    {/* Date */}
                    <div className="w-24 flex-shrink-0">
                      <div className="text-xs font-bold" style={{color:'#1a1512'}}>
                        {g.played_at ? fmtDate(g.played_at) : 'TBD'}
                      </div>
                      {g.played_at && !isPlayed && (
                        <div className="text-xs" style={{color:'#8a8279'}}>
                          {fmtTime(g.played_at)}
                        </div>
                      )}
                    </div>

                    {/* Home/Away badge */}
                    <div className="w-8 flex-shrink-0 text-center">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{
                              background: isHome ? '#dbeafe' : '#f0ece5',
                              color:       isHome ? '#1d4ed8' : '#6b5f4e',
                            }}>
                        {isHome ? 'H' : 'A'}
                      </span>
                    </div>

                    {/* Opponent */}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      {oppTeam?.logo_url && (
                        <img src={oppTeam.logo_url} alt={opp}
                             className="w-5 h-5 object-contain flex-shrink-0" />
                      )}
                      <Link href={`/team/${opp}`}
                            className="text-sm font-semibold hover:underline truncate"
                            style={{color: oppColor}}>
                        {oppTeam?.name || opp}
                      </Link>
                    </div>

                    {/* Score or status */}
                    <div className="flex-shrink-0 text-right">
                      {isPlayed ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black px-2 py-0.5 rounded"
                                style={{
                                  background: won ? '#dcfce7' : '#fee2e2',
                                  color:       won ? '#15803d' : '#dc2626',
                                }}>
                            {won ? 'W' : 'L'}
                          </span>
                          <span className="text-sm font-bold" style={{color:'#1a1512'}}>
                            {myScore}-{oppScore}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded"
                              style={{background:'#f0ece5',color:'#8a8279'}}>
                          Scheduled
                        </span>
                      )}
                    </div>

                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
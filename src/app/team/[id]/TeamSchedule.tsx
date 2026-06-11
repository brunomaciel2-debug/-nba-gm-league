'use client'
import { useState } from 'react'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'

type Filter = 'all' | 'home' | 'away' | 'played' | 'upcoming'

function AttendanceBar({ value, max=20000 }: { value:number, max?:number }) {
  const pct = Math.min(100, Math.round(value/max*100))
  const color = pct>=90?'#ffd040':pct>=70?'#40e080':'#3a8adf'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{background:'#3a3228'}}>
        <div className="h-full rounded-full" style={{width:pct+'%',background:color}}></div>
      </div>
      <span className="text-xs" style={{color:'#8a7a6a'}}>{value.toLocaleString()}</span>
    </div>
  )
}

export default function TeamSchedule({
  games, teamId, teams
}: {
  games: any[], teamId: string, teams: Record<string,any>
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = games.filter(g => {
    if (filter==='home')     return g.home_team===teamId
    if (filter==='away')     return g.away_team===teamId
    if (filter==='played')   return g.status==='final'
    if (filter==='upcoming') return g.status==='scheduled'
    return true
  })

  const FILTERS: {key:Filter,label:string}[] = [
    {key:'all',label:'All'},
    {key:'played',label:'Played'},
    {key:'upcoming',label:'Upcoming'},
    {key:'home',label:'Home'},
    {key:'away',label:'Away'},
  ]

  // Group by week
  const byWeek: Record<number,any[]> = {}
  filtered.forEach(g => {
    if (!byWeek[g.week_number]) byWeek[g.week_number]=[]
    byWeek[g.week_number].push(g)
  })

  const W = (label: string) => (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{background:'#0a2a10',color:'#40e080'}}>{label}</span>
    </div>
  )
  const L = (label: string) => (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{background:'#2a0a0a',color:'#e04040'}}>{label}</span>
    </div>
  )

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {FILTERS.map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{background:filter===f.key?'#3a3228':'transparent',
                    color:filter===f.key?'#f0ebe0':'#8a7a6a',
                    border:'1px solid '+(filter===f.key?'#5a4a3a':'#3a3228')}}>
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs self-center" style={{color:'#6a5a4a'}}>
          {filtered.length} games
        </span>
      </div>

      {/* Games by week */}
      {Object.entries(byWeek).sort((a,b)=>+a[0]-+b[0]).map(([week,wgames])=>{
        const isAllStar = +week===14
        return (
          <div key={week} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-widest"
                    style={{color:isAllStar?'#ffd040':'#6a5a4a'}}>
                {isAllStar ? '⭐ ALL-STAR WEEKEND' : `Week ${week}`}
              </span>
              {isAllStar && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{background:'#2a2000',color:'#ffd040'}}>February</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {wgames.map((g:any)=>{
                const isHome = g.home_team===teamId
                const final  = g.status==='final'
                const us     = isHome?g.home_score:g.away_score
                const them   = isHome?g.away_score:g.home_score
                const oppId  = isHome?g.away_team:g.home_team
                const opp    = teams[oppId]
                const win    = final && us>them
                const loss   = final && us<them
                const tc     = readableTeamColor(opp?.color||'555555')
                const isAllStarGame = g.game_type==='allstar_game'
                const isRookieGame  = g.game_type==='allstar_rookie'

                if (isAllStarGame || isRookieGame) {
                  return (
                    <div key={g.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                         style={{background:'#2a2000',border:'1px solid #5a4a00'}}>
                      <span className="text-lg">⭐</span>
                      <div className="flex-1">
                        <div className="font-bold text-sm" style={{color:'#ffd040'}}>
                          {isRookieGame?'Rookies vs Sophomores':'All-Star Game: East vs West'}
                        </div>
                        <div className="text-xs" style={{color:'#8a6a00'}}>
                          {isRookieGame?'Saturday':'Sunday'} · All-Star Weekend
                        </div>
                      </div>
                      {final && g.home_score!=null && (
                        <span className="font-bold text-sm" style={{color:'#ffd040'}}>
                          {g.home_score}–{g.away_score}
                        </span>
                      )}
                      {final && (
                        <Link href={`/game/${g.id}`} className="no-underline text-xs px-2 py-1 rounded"
                              style={{background:'#3a3228',color:'#f0ebe0'}}>Box →</Link>
                      )}
                    </div>
                  )
                }

                return (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                       style={{background:'#241f18',border:'1px solid #3a3228'}}>
                    {/* Home/Away badge */}
                    <span className="text-xs font-bold w-8 text-center flex-shrink-0"
                          style={{color:isHome?'#60a0ff':'#8a7a6a'}}>
                      {isHome?'HOME':'AWAY'}
                    </span>

                    {/* Day */}
                    <span className="text-xs w-6 flex-shrink-0" style={{color:'#6a5a4a'}}>
                      {g.day_of_week==='Monday'?'MON':'THU'}
                    </span>

                    {/* Opponent logo + name */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0"
                           style={{background:tc+'22'}}>
                        {opp?.logo_url
                          ?<img src={opp.logo_url} alt="" className="w-full h-full object-contain p-0.5"/>
                          :<div className="w-full h-full flex items-center justify-center text-xs font-black"
                                style={{color:tc,fontSize:8}}>{oppId?.slice(0,2)}</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate" style={{color:'#f0ebe0'}}>
                          {isHome?'vs':'@'} {opp?.name||oppId}
                        </div>
                        {opp?.arena && isHome && (
                          <div className="text-xs truncate" style={{color:'#6a5a4a'}}>{opp.arena}</div>
                        )}
                      </div>
                    </div>

                    {/* Score or status */}
                    {final ? (
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{background:win?'#0a2a10':'#2a0a0a',
                                      color:win?'#40e080':'#e04040'}}>
                          {win?'W':'L'}
                        </span>
                        <span className="text-sm font-bold w-12 text-center"
                              style={{color:win?'#40e080':'#e04040'}}>
                          {us}–{them}
                        </span>
                        {g.attendance>0 && (
                          <AttendanceBar value={g.attendance} />
                        )}
                        <Link href={`/game/${g.id}`} className="no-underline text-xs px-2 py-1 rounded flex-shrink-0"
                              style={{background:'#3a3228',color:'#60a0ff'}}>
                          Box →
                        </Link>
                      </div>
                    ) : (
                      <span className="text-xs flex-shrink-0" style={{color:'#5a4a3a'}}>Scheduled</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {filtered.length===0 && (
        <div className="rounded-xl p-6 text-center" style={{background:'#241f18',border:'1px solid #3a3228'}}>
          <p className="text-sm" style={{color:'#6a5a4a'}}>No games to show.</p>
        </div>
      )}
    </div>
  )
}

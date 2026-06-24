'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'

type Tab = 'teams'|'standings'|'schedule'|'leaders'

export default function GLeaguePage() {
  const [tab, setTab]         = useState<Tab>('teams')
  const [teams, setTeams]     = useState<any[]>([])
  const [games, setGames]     = useState<any[]>([])
  const [leaders, setLeaders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [week, setWeek]       = useState<number|null>(null)
  const [filterTeam, setFilterTeam] = useState<string>('ALL')

  useEffect(() => {
    Promise.all([
      supabase.from('gleague_teams')
        .select('*, nba:teams!gleague_teams_nba_affiliate_fkey(id,name,logo_url,color)')
        .order('conference').order('wins',{ascending:false}),
      supabase.from('gleague_games')
        .select('*, home:gleague_teams!gleague_games_home_team_fkey(id,name,color,logo_url), away:gleague_teams!gleague_games_away_team_fkey(id,name,color,logo_url)')
        .eq('season','2025-26').gt('week_number',0).order('played_at',{ascending:true}),
      supabase.from('gleague_player_stats')
        .select('*, player:players(id,name,pos,age), team:gleague_teams(id,name,color)')
        .eq('season','2025-26').gte('games',5),
    ]).then(([{data:t},{data:g},{data:l}])=>{
      setTeams(t||[])
      setGames(g||[])
      setLeaders(l||[])
      // Default to current/next week
      const now = new Date()
      const allWeeks = [...new Set((g||[]).map((x:any)=>x.week_number))].sort((a,b)=>a-b)
      const upcomingGame = (g||[]).find((x:any) => new Date(x.played_at) >= now)
      const currentWeek = upcomingGame?.week_number || allWeeks[allWeeks.length-1] || 1
      setWeek(currentWeek)
      setLoading(false)
    })
  },[])

  const east = teams.filter(t=>t.conference==='Eastern').sort((a:any,b:any)=>b.wins-a.wins||a.losses-b.losses)
  const west = teams.filter(t=>t.conference==='Western').sort((a:any,b:any)=>b.wins-a.wins||a.losses-b.losses)

  const allWeeks = [...new Set(games.map((x:any)=>x.week_number))].sort((a,b)=>a-b)
  const minWeek = allWeeks[0] || 1
  const maxWeek = allWeeks[allWeeks.length-1] || 1

  const weekGames = games.filter((g:any) => {
    const matchWeek = week === null || g.week_number === week
    const matchTeam = filterTeam === 'ALL' || g.home_team === filterTeam || g.away_team === filterTeam
    return matchWeek && matchTeam
  })

  const finalGames = weekGames.filter((g:any) => g.status === 'final')
  const scheduledGames = weekGames.filter((g:any) => g.status === 'scheduled')

  const calcGB = (leader:any, team:any) => {
    if (!leader||(leader.wins===team.wins&&leader.losses===team.losses)) return '—'
    const gb=((leader.wins-team.wins)+(team.losses-leader.losses))/2
    return gb===0?'—':gb.toFixed(1)
  }

  const TABS = [
    {key:'teams',    label:'Teams',          icon:'ti-users'},
    {key:'standings',label:'Standings',      icon:'ti-list-numbers'},
    {key:'schedule', label:'Schedule',       icon:'ti-calendar'},
    {key:'leaders',  label:'League Leaders', icon:'ti-trophy'},
  ] as const

  // Week date range label
  const weekLabel = (w: number) => {
    const wGames = games.filter((g:any) => g.week_number === w)
    if (!wGames.length) return `Week ${w}`
    const dates = wGames.map((g:any) => new Date(g.played_at)).sort((a,b)=>a.getTime()-b.getTime())
    const first = dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})
    const last  = dates[dates.length-1].toLocaleDateString('en-US',{month:'short',day:'numeric'})
    return first === last ? `${first}` : `${first} – ${last}`
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-4">
        <span className="sec-title">
          <i className="ti ti-ball-basketball" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          NBA G League — 2025-26
        </span>
        <span className="text-xs" style={{color:'#8a8279'}}>Dec 27 – Mar 28 · Playoffs Apr 1-11</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b" style={{borderColor:'#d4cdc5'}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className="flex items-center gap-1.5 px-5 py-3 text-sm font-semibold transition-all"
            style={{color:tab===t.key?'#1a1512':'#5c554e',background:'transparent',border:'none',cursor:'pointer',
                    borderBottom:tab===t.key?'3px solid #c8102e':'3px solid transparent',marginBottom:-1}}>
            <i className={`ti ${t.icon}`} style={{fontSize:15}}></i>{t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-12" style={{color:'#8a8279'}}>Loading...</div> : <>

      {/* TEAMS */}
      {tab==='teams' && (
        <>
          {['Eastern','Western'].map(conf=>(
            <div key={conf} className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{color:'#5c554e',letterSpacing:'1.5px'}}>{conf} Conference</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teams.filter(t=>t.conference===conf).map((t:any)=>{
                  const tc = readableTeamColor(t.color||'#1d4ed8')
                  const gp = t.wins+t.losses
                  return (
                    <Link key={t.id} href={`/gleague/${t.id}`} className="no-underline group">
                      <div className="rounded-xl p-4 transition-all group-hover:brightness-95"
                           style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderLeft:`4px solid ${tc}`}}>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                               style={{background:tc+'18'}}>
                            {(t.logo_url||t.nba?.logo_url)
                              ?<img src={t.logo_url||t.nba?.logo_url} alt="" className="w-full h-full object-contain p-1"/>
                              :<span className="text-sm font-black" style={{color:tc}}>{t.id}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate" style={{color:'#1a1512'}}>{t.name}</div>
                            <div className="text-xs" style={{color:'#8a8279'}}>{t.city}</div>
                            <div className="text-xs mt-0.5" style={{color:tc}}>
                              {t.nba?.name ? `↑ ${t.nba.name}` : ''}
                            </div>
                          </div>
                          <div className="text-center flex-shrink-0">
                            <div className="text-sm font-black" style={{color:'#1a1512'}}>{t.wins}-{t.losses}</div>
                            <div className="text-xs" style={{color:'#8a8279'}}>
                              {gp>0?(t.wins/gp).toFixed(3).replace(/^0/,''):'.000'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* STANDINGS */}
      {tab==='standings' && (
        <div className="grid md:grid-cols-2 gap-6">
          {[['Eastern',east],['Western',west]].map(([conf,ranked]:any)=>(
            <div key={conf} className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
              <div className="px-4 py-3 flex items-center justify-between"
                   style={{background:conf==='Eastern'?'#1e3a5f':'#7c2d12'}}>
                <span className="text-sm font-bold" style={{color:'#fff'}}>{conf}</span>
                <div className="flex gap-4 text-xs font-bold" style={{color:'rgba(255,255,255,0.6)'}}>
                  <span className="w-6 text-center">W</span>
                  <span className="w-6 text-center">L</span>
                  <span className="w-12 text-center">PCT</span>
                  <span className="w-10 text-center">GB</span>
                </div>
              </div>
              {ranked.map((t:any,i:number)=>{
                const gp=t.wins+t.losses
                const pct=gp>0?(t.wins/gp).toFixed(3).replace(/^0/,''):'.000'
                const tc=readableTeamColor(t.color||'#1d4ed8')
                return (
                  <Link key={t.id} href={`/gleague/${t.id}`} className="no-underline group">
                    <div className="flex items-center gap-3 px-4 py-2.5 group-hover:brightness-95 transition-all"
                         style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5',
                                 borderLeft:`3px solid ${i<8?'#15803d':'transparent'}`}}>
                      <span className="text-xs font-bold w-5 text-right flex-shrink-0"
                            style={{color:i<8?'#15803d':'#9c9088'}}>{i+1}</span>
                      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
                           style={{background:tc+'18'}}>
                        {(t.logo_url||t.nba?.logo_url)
                          ?<img src={t.logo_url||t.nba?.logo_url} alt="" className="w-full h-full object-contain p-0.5"/>
                          :<div className="w-full h-full flex items-center justify-center" style={{fontSize:8,fontWeight:900,color:tc}}>{t.id}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{color:'#1a1512'}}>{t.name}</div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="w-6 text-center text-sm font-bold" style={{color:'#15803d'}}>{t.wins}</span>
                        <span className="w-6 text-center text-sm font-bold" style={{color:'#dc2626'}}>{t.losses}</span>
                        <span className="w-12 text-center text-sm font-semibold" style={{color:'#1a1512'}}>{pct}</span>
                        <span className="w-10 text-center text-sm" style={{color:'#5c554e'}}>{calcGB(ranked[0],t)}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
              <div className="px-4 py-2 text-xs" style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5',color:'#8a8279'}}>
                Top 8 qualify for playoffs
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SCHEDULE */}
      {tab==='schedule' && (
        <div>
          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-center mb-5 p-3 rounded-xl"
               style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>

            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <button onClick={()=>setWeek(w=>Math.max(minWeek,(w||minWeek)-1))}
                disabled={week===minWeek}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                style={{background:'#f0ece5',color:week===minWeek?'#d4cdc5':'#1a1512',border:'1px solid #d4cdc5',cursor:week===minWeek?'not-allowed':'pointer'}}>
                ‹
              </button>
              <div className="text-center min-w-[120px]">
                <div className="text-xs font-bold" style={{color:'#1a1512'}}>Week {week}</div>
                <div className="text-xs" style={{color:'#8a8279'}}>{week ? weekLabel(week) : ''}</div>
              </div>
              <button onClick={()=>setWeek(w=>Math.min(maxWeek,(w||maxWeek)+1))}
                disabled={week===maxWeek}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                style={{background:'#f0ece5',color:week===maxWeek?'#d4cdc5':'#1a1512',border:'1px solid #d4cdc5',cursor:week===maxWeek?'not-allowed':'pointer'}}>
                ›
              </button>
            </div>

            {/* Team filter */}
            <select value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg flex-1 min-w-[160px]"
              style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
              <option value="ALL">All Teams</option>
              {teams.map((t:any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {/* All weeks button */}
            <button onClick={()=>setWeek(null)}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{background:week===null?'#1a1512':'#f0ece5',color:week===null?'#fff':'#5c554e',border:'1px solid #d4cdc5'}}>
              All Weeks
            </button>

            <span className="text-xs" style={{color:'#8a8279'}}>{weekGames.length} games</span>
          </div>

          {/* Results */}
          {finalGames.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{color:'#5c554e',letterSpacing:'1.5px'}}>Results</h3>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
                {finalGames.map((g:any,i:number)=>{
                  const hWon=(g.home_score||0)>(g.away_score||0)
                  const htc=readableTeamColor(g.home?.color||'#1d4ed8')
                  const atc=readableTeamColor(g.away?.color||'#c8102e')
                  return (
                    <div key={g.id} className="flex items-center gap-3 px-4 py-3"
                         style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <div className="text-xs w-16 flex-shrink-0" style={{color:'#8a8279'}}>
                        {g.played_at?new Date(g.played_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—'}
                      </div>
                      {/* Home */}
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className="text-sm font-semibold" style={{color:hWon?htc:'#5c554e'}}>{g.home?.name}</span>
                        {g.home?.logo_url && <img src={g.home.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}
                      </div>
                      {/* Score */}
                      <div className="flex items-center gap-2 flex-shrink-0 px-2">
                        <span className="text-base font-black w-8 text-right" style={{color:hWon?'#15803d':'#dc2626'}}>{g.home_score}</span>
                        <span className="text-xs" style={{color:'#d4cdc5'}}>–</span>
                        <span className="text-base font-black w-8" style={{color:!hWon?'#15803d':'#dc2626'}}>{g.away_score}</span>
                      </div>
                      {/* Away */}
                      <div className="flex items-center gap-2 flex-1">
                        {g.away?.logo_url && <img src={g.away.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}
                        <span className="text-sm font-semibold" style={{color:!hWon?atc:'#5c554e'}}>{g.away?.name}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {scheduledGames.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{color:'#5c554e',letterSpacing:'1.5px'}}>Upcoming</h3>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
                {scheduledGames.map((g:any,i:number)=>{
                  const htc=readableTeamColor(g.home?.color||'#1d4ed8')
                  const atc=readableTeamColor(g.away?.color||'#c8102e')
                  const dt = g.played_at ? new Date(g.played_at) : null
                  return (
                    <div key={g.id} className="flex items-center gap-3 px-4 py-3"
                         style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <div className="text-xs w-16 flex-shrink-0" style={{color:'#8a8279'}}>
                        {dt ? dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'TBD'}
                      </div>
                      {/* Home */}
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className="text-sm font-semibold" style={{color:htc}}>{g.home?.name}</span>
                        {g.home?.logo_url && <img src={g.home.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}
                      </div>
                      {/* vs */}
                      <div className="flex items-center justify-center w-12 flex-shrink-0">
                        <span className="text-xs font-bold px-2 py-1 rounded"
                              style={{background:'#f0ece5',color:'#8a8279'}}>vs</span>
                      </div>
                      {/* Away */}
                      <div className="flex items-center gap-2 flex-1">
                        {g.away?.logo_url && <img src={g.away.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}
                        <span className="text-sm font-semibold" style={{color:atc}}>{g.away?.name}</span>
                      </div>
                      <span className="text-xs flex-shrink-0" style={{color:'#b0a89e'}}>
                        {dt ? dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {weekGames.length===0 && (
            <div className="text-center py-12 rounded-xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5',color:'#8a8279'}}>
              No games for this selection.
            </div>
          )}
        </div>
      )}

      {/* LEAGUE LEADERS */}
      {tab==='leaders' && (
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {label:'Points',   key:'pts',  color:'#b45309', unit:'PPG'},
            {label:'Rebounds', key:'reb',  color:'#15803d', unit:'RPG'},
            {label:'Assists',  key:'ast',  color:'#1d4ed8', unit:'APG'},
            {label:'Steals',   key:'stl',  color:'#6d28d9', unit:'SPG'},
            {label:'Blocks',   key:'blk',  color:'#c2410c', unit:'BPG'},
          ].map(cat=>{
            const sorted = [...leaders]
              .filter((l:any)=>(l[cat.key]||0)>0 && l.games>=5)
              .sort((a:any,b:any)=>(b[cat.key]/b.games)-(a[cat.key]/a.games))
              .slice(0,10)
            return (
              <div key={cat.key} className="rounded-xl overflow-hidden"
                   style={{border:'1px solid #d4cdc5',borderTop:`3px solid ${cat.color}`}}>
                <div className="px-4 py-3 flex items-center justify-between"
                     style={{background:'#f5f1eb',borderBottom:'1px solid #d4cdc5'}}>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{color:cat.color,letterSpacing:'1px'}}>{cat.label}</span>
                  <span className="text-xs font-bold" style={{color:'#8a8279'}}>{cat.unit}</span>
                </div>
                {sorted.length===0 ? (
                  <div className="px-4 py-4 text-xs text-center" style={{color:'#8a8279'}}>Available after games are played</div>
                ) : sorted.map((l:any,i:number)=>{
                  const avg = (l[cat.key]/l.games).toFixed(1)
                  const tc = l.team ? readableTeamColor(l.team.color) : '#5c554e'
                  return (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-2.5"
                         style={{borderBottom:'1px solid #e2dcd5',background:i%2===0?'#faf8f5':'#f5f1eb'}}>
                      <span className="text-xs font-black w-4" style={{color:cat.color}}>{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <Link href={`/player/${l.player?.id}`} className="no-underline hover:underline text-sm font-semibold"
                              style={{color:'#1a1512'}}>{l.player?.name}</Link>
                        <div className="text-xs" style={{color:tc}}>{l.team?.name}</div>
                      </div>
                      <span className="font-black text-sm" style={{color:cat.color}}>{avg}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      </>}
    </div>
  )
}

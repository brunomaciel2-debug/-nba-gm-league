'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

type Tab = 'teams'|'standings'|'schedule'|'leaders'

export default function GLeaguePage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [tab,setTab]=useState<Tab>('teams')
  const [teams,setTeams]=useState<any[]>([])
  const [games,setGames]=useState<any[]>([])
  const [leaders,setLeaders]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [week,setWeek]=useState<number|null>(null)
  const [filterTeam,setFilterTeam]=useState<string>('ALL')

  useEffect(()=>{
    Promise.all([
      supabase.from('gleague_teams').select('*, nba:teams!gleague_teams_nba_affiliate_fkey(id,name,logo_url,color)').order('conference').order('wins',{ascending:false}),
      supabase.from('gleague_games').select('*, home:gleague_teams!gleague_games_home_team_fkey(id,name,color,logo_url), away:gleague_teams!gleague_games_away_team_fkey(id,name,color,logo_url)').eq('season','2025-26').gt('week_number',0).order('played_at',{ascending:true}),
      // Was gte('games',5) — a real incident: the G-League season had only
// just started (max 3 games played by anyone), so every player got
// filtered out at the query level before the page even had a chance to
// show partial-season leaders, making the whole tab look broken/empty
// for weeks. 2 games (same minimum used elsewhere in this app for a
// "real enough to rank" sample, e.g. Player of the Week) still fetched
// at the per-category filter below.
supabase.from('gleague_player_stats').select('*, player:players(id,name,pos,age,photo_url), team:gleague_teams(id,name,color)').eq('season','2025-26').gt('games',0),
    ]).then(([{data:t},{data:g},{data:l}])=>{
      setTeams(t||[]); setGames(g||[]); setLeaders(l||[])
      const now=new Date(); const weekSet:Record<number,boolean>={}
      ;(g||[]).forEach((x:any)=>{weekSet[x.week_number]=true})
      const allWeeks=Object.keys(weekSet).map(Number).sort((a,b)=>a-b)
      const upcomingGame=(g||[]).find((x:any)=>new Date(x.played_at)>=now)
      setWeek(upcomingGame?.week_number||allWeeks[0]||1)
      setLoading(false)
    })
  },[])

  const east=teams.filter(t=>t.conference==='Eastern').sort((a:any,b:any)=>b.wins-a.wins||a.losses-b.losses)
  const west=teams.filter(t=>t.conference==='Western').sort((a:any,b:any)=>b.wins-a.wins||a.losses-b.losses)
  const weekSet:Record<number,boolean>={}; games.forEach((x:any)=>{weekSet[x.week_number]=true})
  const allWeeks=Object.keys(weekSet).map(Number).sort((a,b)=>a-b)
  const minWeek=allWeeks[0]||1; const maxWeek=allWeeks[allWeeks.length-1]||1
  const weekGames=games.filter((g:any)=>{const mW=week===null||g.week_number===week;const mT=filterTeam==='ALL'||g.home_team===filterTeam||g.away_team===filterTeam;return mW&&mT})
  const finalGames=weekGames.filter((g:any)=>g.status==='final')
  const scheduledGames=weekGames.filter((g:any)=>g.status==='scheduled')
  const calcGB=(leader:any,team:any)=>{if(!leader||(leader.wins===team.wins&&leader.losses===team.losses))return'—';const gb=((leader.wins-team.wins)+(team.losses-leader.losses))/2;return gb===0?'—':gb.toFixed(1)}

  const TABS=[
    {key:'teams',    labelEN:'Teams',         labelPT:'Equipas',       icon:'ti-users'},
    {key:'standings',labelEN:'Standings',     labelPT:'Classificação', icon:'ti-list-numbers'},
    {key:'schedule', labelEN:'Schedule',      labelPT:'Calendário',    icon:'ti-calendar'},
    {key:'leaders',  labelEN:'League Leaders',labelPT:'Líderes',       icon:'ti-trophy'},
  ] as const

  const weekLabel=(w:number)=>{
    const wGames=games.filter((g:any)=>g.week_number===w); if(!wGames.length)return`${isPT?'Semana':'Week'} ${w}`
    const dates=wGames.map((g:any)=>new Date(g.played_at)).sort((a,b)=>a.getTime()-b.getTime())
    const locale=isPT?'pt-PT':'en-US'
    const first=dates[0].toLocaleDateString(locale,{month:'short',day:'numeric'})
    const last=dates[dates.length-1].toLocaleDateString(locale,{month:'short',day:'numeric'})
    return first===last?first:`${first} – ${last}`
  }

  const confLabel=(conf:string)=>isPT?(conf==='Eastern'?'Conferência Este':'Conferência Oeste'):conf

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-4">
        <span className="sec-title"><i className="ti ti-ball-basketball" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          NBA G League — 2025-26
        </span>
        <span className="text-xs" style={{color:'#8a8279'}}>Dec 27 – Mar 28 · Playoffs Apr 1-11</span>
      </div>

      <div className="flex gap-0 mb-6 border-b" style={{borderColor:'#d4cdc5'}}>
        {TABS.map(tb=>(
          <button key={tb.key} onClick={()=>setTab(tb.key)}
            className="flex items-center gap-1.5 px-5 py-3 text-sm font-semibold transition-all"
            style={{color:tab===tb.key?'#1a1512':'#5c554e',background:'transparent',border:'none',cursor:'pointer',
                    borderBottom:tab===tb.key?'3px solid #c8102e':'3px solid transparent',marginBottom:-1}}>
            <i className={`ti ${tb.icon}`} style={{fontSize:15}}></i>
            {isPT?tb.labelPT:tb.labelEN}
          </button>
        ))}
      </div>

      {loading?<div className="text-center py-12" style={{color:'#8a8279'}}>{t('common.loading')}</div>:<>

      {tab==='teams'&&(
        <>
          {['Eastern','Western'].map(conf=>(
            <div key={conf} className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e',letterSpacing:'1.5px'}}>{confLabel(conf)}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teams.filter(t=>t.conference===conf).map((t:any)=>{
                  const tc=readableTeamColor(t.color||'#1d4ed8'); const gp=t.wins+t.losses
                  return(
                    <Link key={t.id} href={`/gleague/${t.id}`} className="no-underline group">
                      <div className="rounded-xl p-4 transition-all group-hover:brightness-95" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderLeft:`4px solid ${tc}`}}>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:tc+'18'}}>
                            {(t.logo_url||t.nba?.logo_url)?<img src={t.logo_url||t.nba?.logo_url} alt="" className="w-full h-full object-contain p-1"/>:<span className="text-sm font-black" style={{color:tc}}>{t.id}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate" style={{color:'#1a1512'}}>{t.name}</div>
                            <div className="text-xs" style={{color:'#8a8279'}}>{t.city}</div>
                            <div className="text-xs mt-0.5" style={{color:tc}}>{t.nba?.name?`↑ ${t.nba.name}`:''}</div>
                          </div>
                          <div className="text-center flex-shrink-0">
                            <div className="text-sm font-black" style={{color:'#1a1512'}}>{t.wins}-{t.losses}</div>
                            <div className="text-xs" style={{color:'#8a8279'}}>{gp>0?(t.wins/gp).toFixed(3).replace(/^0/,''):'.000'}</div>
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

      {tab==='standings'&&(
        <div className="grid md:grid-cols-2 gap-6">
          {[['Eastern',east],['Western',west]].map(([conf,ranked]:any)=>(
            <div key={conf} className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
              <div className="px-4 py-3 flex items-center justify-between" style={{background:conf==='Eastern'?'#1e3a5f':'#7c2d12'}}>
                <span className="text-sm font-bold" style={{color:'#fff'}}>{confLabel(conf)}</span>
                <div className="flex gap-4 text-xs font-bold" style={{color:'rgba(255,255,255,0.6)'}}>
                  <span className="w-6 text-center">W</span><span className="w-6 text-center">L</span>
                  <span className="w-12 text-center">PCT</span><span className="w-10 text-center">GB</span>
                </div>
              </div>
              {ranked.map((t:any,i:number)=>{
                const gp=t.wins+t.losses; const pct=gp>0?(t.wins/gp).toFixed(3).replace(/^0/,''):'.000'
                const tc=readableTeamColor(t.color||'#1d4ed8')
                return(
                  <Link key={t.id} href={`/gleague/${t.id}`} className="no-underline group">
                    <div className="flex items-center gap-3 px-4 py-2.5 group-hover:brightness-95 transition-all"
                         style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5',borderLeft:`3px solid ${i<8?'#15803d':'transparent'}`}}>
                      <span className="text-xs font-bold w-5 text-right flex-shrink-0" style={{color:i<8?'#15803d':'#9c9088'}}>{i+1}</span>
                      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{background:tc+'18'}}>
                        {(t.logo_url||t.nba?.logo_url)?<img src={t.logo_url||t.nba?.logo_url} alt="" className="w-full h-full object-contain p-0.5"/>:<div className="w-full h-full flex items-center justify-center" style={{fontSize:8,fontWeight:900,color:tc}}>{t.id}</div>}
                      </div>
                      <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate" style={{color:'#1a1512'}}>{t.name}</div></div>
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
                {isPT?'Top 8 qualificam-se para os playoffs':'Top 8 qualify for playoffs'}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='schedule'&&(
        <div>
          <div className="flex flex-wrap gap-3 items-center mb-5 p-3 rounded-xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
            <div className="flex items-center gap-2">
              <button onClick={()=>setWeek(w=>Math.max(minWeek,(w||minWeek)-1))} disabled={week===minWeek}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                style={{background:'#f0ece5',color:week===minWeek?'#d4cdc5':'#1a1512',border:'1px solid #d4cdc5',cursor:week===minWeek?'not-allowed':'pointer'}}>‹</button>
              <div className="text-center min-w-[120px]">
                <div className="text-xs font-bold" style={{color:'#1a1512'}}>{isPT?'Semana':'Week'} {week}</div>
                <div className="text-xs" style={{color:'#8a8279'}}>{week?weekLabel(week):''}</div>
              </div>
              <button onClick={()=>setWeek(w=>Math.min(maxWeek,(w||maxWeek)+1))} disabled={week===maxWeek}
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                style={{background:'#f0ece5',color:week===maxWeek?'#d4cdc5':'#1a1512',border:'1px solid #d4cdc5',cursor:week===maxWeek?'not-allowed':'pointer'}}>›</button>
            </div>
            <select value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg flex-1 min-w-[160px]"
              style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
              <option value="ALL">{isPT?'Todas as Equipas':'All Teams'}</option>
              {teams.map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={()=>setWeek(null)} className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{background:week===null?'#1a1512':'#f0ece5',color:week===null?'#fff':'#5c554e',border:'1px solid #d4cdc5'}}>
              {isPT?'Todas as Semanas':'All Weeks'}
            </button>
            <span className="text-xs" style={{color:'#8a8279'}}>{weekGames.length} {isPT?'jogos':'games'}</span>
          </div>

          {finalGames.length>0&&(
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e',letterSpacing:'1.5px'}}>{isPT?'Resultados':'Results'}</h3>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
                {finalGames.map((g:any,i:number)=>{
                  const hWon=(g.home_score||0)>(g.away_score||0); const htc=readableTeamColor(g.home?.color||'#1d4ed8'); const atc=readableTeamColor(g.away?.color||'#c8102e')
                  return(
                    <div key={g.id} className="flex items-center gap-3 px-4 py-3" style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <div className="text-xs w-16 flex-shrink-0" style={{color:'#8a8279'}}>{g.played_at?new Date(g.played_at).toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric'}):'—'}</div>
                      <div className="flex items-center gap-2 flex-1 justify-end"><span className="text-sm font-semibold" style={{color:hWon?htc:'#5c554e'}}>{g.home?.name}</span>{g.home?.logo_url&&<img src={g.home.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}</div>
                      <div className="flex items-center gap-2 flex-shrink-0 px-2">
                        <span className="text-base font-black w-8 text-right" style={{color:hWon?'#15803d':'#dc2626'}}>{g.home_score}</span>
                        <span className="text-xs" style={{color:'#d4cdc5'}}>–</span>
                        <span className="text-base font-black w-8" style={{color:!hWon?'#15803d':'#dc2626'}}>{g.away_score}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1">{g.away?.logo_url&&<img src={g.away.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}<span className="text-sm font-semibold" style={{color:!hWon?atc:'#5c554e'}}>{g.away?.name}</span></div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {scheduledGames.length>0&&(
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e',letterSpacing:'1.5px'}}>{isPT?'Próximos Jogos':'Upcoming'}</h3>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
                {scheduledGames.map((g:any,i:number)=>{
                  const htc=readableTeamColor(g.home?.color||'#1d4ed8'); const atc=readableTeamColor(g.away?.color||'#c8102e')
                  const dt=g.played_at?new Date(g.played_at):null
                  return(
                    <div key={g.id} className="flex items-center gap-3 px-4 py-3" style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <div className="text-xs w-16 flex-shrink-0" style={{color:'#8a8279'}}>{dt?dt.toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric'}):'TBD'}</div>
                      <div className="flex items-center gap-2 flex-1 justify-end"><span className="text-sm font-semibold" style={{color:htc}}>{g.home?.name}</span>{g.home?.logo_url&&<img src={g.home.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}</div>
                      <div className="flex items-center justify-center w-12 flex-shrink-0"><span className="text-xs font-bold px-2 py-1 rounded" style={{background:'#f0ece5',color:'#8a8279'}}>vs</span></div>
                      <div className="flex items-center gap-2 flex-1">{g.away?.logo_url&&<img src={g.away.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}<span className="text-sm font-semibold" style={{color:atc}}>{g.away?.name}</span></div>
                      <span className="text-xs flex-shrink-0" style={{color:'#b0a89e'}}>{dt?dt.toLocaleTimeString(isPT?'pt-PT':'en-US',{hour:'numeric',minute:'2-digit'}):''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {weekGames.length===0&&<div className="text-center py-12 rounded-xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5',color:'#8a8279'}}>{isPT?'Nenhum jogo para esta seleção.':'No games for this selection.'}</div>}
        </div>
      )}

      {tab==='leaders'&&(
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {labelEN:'Points',  labelPT:'Pontos',    key:'pts',color:'#b45309',unit:'PPG',type:'avg' as const},
            {labelEN:'Rebounds',labelPT:'Ressaltos', key:'reb',color:'#15803d',unit:'RPG',type:'avg' as const},
            {labelEN:'Assists', labelPT:'Assistências',key:'ast',color:'#1d4ed8',unit:'APG',type:'avg' as const},
            {labelEN:'Steals',  labelPT:'Roubos',    key:'stl',color:'#6d28d9',unit:'SPG',type:'avg' as const},
            {labelEN:'Blocks',  labelPT:'Bloqueios', key:'blk',color:'#c2410c',unit:'BPG',type:'avg' as const},
            {labelEN:'Turnovers',labelPT:'Perdas de Bola',key:'turnovers',color:'#dc2626',unit:'TOPG',type:'avg' as const},
            // Field goal/3PT % — same NBA convention of needing real volume
            // (not per-game average, and not just "1-for-1"), a fixed makes
            // minimum rather than the NBA's full games-played-scaled rule
            // since a G-League season is much shorter and simpler.
            {labelEN:'FG%',     labelPT:'FG%',       key:'fg', m:'fgm',a:'fga',color:'#0e7490',unit:'FG%',type:'pct' as const},
            {labelEN:'3-Point %',labelPT:'% 3 Pontos',key:'tp',m:'tpm',a:'tpa',color:'#b45309',unit:'3P%',type:'pct' as const},
          ].map(cat=>{
            const sorted = cat.type==='pct'
              ? [...leaders].filter((l:any)=>(l[cat.a!]||0)>=10).sort((a:any,b:any)=>(b[cat.m!]/b[cat.a!])-(a[cat.m!]/a[cat.a!])).slice(0,10)
              : [...leaders].filter((l:any)=>(l[cat.key]||0)>0&&l.games>=2).sort((a:any,b:any)=>(b[cat.key]/b.games)-(a[cat.key]/a.games)).slice(0,10)
            return(
              <div key={cat.key} className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5',borderTop:`3px solid ${cat.color}`}}>
                <div className="px-4 py-3 flex items-center justify-between" style={{background:'#f5f1eb',borderBottom:'1px solid #d4cdc5'}}>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{color:cat.color,letterSpacing:'1px'}}>{isPT?cat.labelPT:cat.labelEN}</span>
                  <span className="text-xs font-bold" style={{color:'#8a8279'}}>{cat.unit}</span>
                </div>
                {sorted.length===0?<div className="px-4 py-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Disponível após jogos serem realizados':'Available after games are played'}</div>
                  :sorted.map((l:any,i:number)=>{
                    const avg = cat.type==='pct' ? (l[cat.m!]/l[cat.a!]*100).toFixed(1)+'%' : (l[cat.key]/l.games).toFixed(1)
                    const tc=l.team?readableTeamColor(l.team.color):'#5c554e'
                    return(
                      <Link key={l.id} href={`/player/${l.player?.id}`} className="no-underline flex items-center gap-3 px-4 py-2.5 hover:brightness-110 transition-all" style={{borderBottom:'1px solid #e2dcd5',background:i%2===0?'#faf8f5':'#f5f1eb'}}>
                        <span className="text-xs font-black w-4 flex-shrink-0" style={{color:cat.color}}>{i+1}</span>
                        <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0" style={{background:tc+'22',border:`2px solid ${tc}44`}}>
                          {l.player?.photo_url
                            ?<img src={l.player.photo_url} alt="" className="w-full h-full object-cover"/>
                            :<div className="w-full h-full flex items-center justify-center text-sm font-black" style={{color:tc}}>
                               {l.player?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                             </div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold hover:underline" style={{color:'#1a1512'}}>{l.player?.name}</div>
                          <div className="text-xs" style={{color:tc}}>{l.team?.name}</div>
                        </div>
                        <span className="font-black text-sm flex-shrink-0" style={{color:cat.color}}>{avg}</span>
                      </Link>
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

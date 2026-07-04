'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

export default function SchedulePage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [games,setGames]=useState<any[]>([])
  const [teamMap,setTeamMap]=useState<Record<string,any>>({})
  const [worldTeamIds,setWorldTeamIds]=useState<Set<string>>(new Set())
  const [loading,setLoading]=useState(true)

  const GAME_TYPE_LABEL_EN: Record<string,{label:string,bg:string,color:string}> = {
    preseason: {label:'Pre-Season',    bg:'#f0f9ff',color:'#0369a1'},
    regular:   {label:'Regular Season',bg:'#f0fdf4',color:'#15803d'},
    playoff:   {label:'Playoffs',      bg:'#fef2f2',color:'#dc2626'},
    allstar:   {label:'All-Star',      bg:'#fef9c3',color:'#b45309'},
  }
  const GAME_TYPE_LABEL_PT: Record<string,{label:string,bg:string,color:string}> = {
    preseason: {label:'Pré-Época',     bg:'#f0f9ff',color:'#0369a1'},
    regular:   {label:'Época Regular', bg:'#f0fdf4',color:'#15803d'},
    playoff:   {label:'Playoffs',      bg:'#fef2f2',color:'#dc2626'},
    allstar:   {label:'All-Star',      bg:'#fef9c3',color:'#b45309'},
  }
  const GAME_TYPE_LABEL = isPT ? GAME_TYPE_LABEL_PT : GAME_TYPE_LABEL_EN

  useEffect(()=>{
    Promise.all([
      supabase.from('games').select('*').order('played_at').order('game_number').range(0,699),
      supabase.from('games').select('*').order('played_at').order('game_number').range(700,1299),
      supabase.from('teams').select('id,name,color,logo_url'),
      supabase.from('preseason_games').select('*').eq('season','2025-26'),
    ]).then(([{data:g1},{data:g2},{data:teams}, {data:preseason}])=>{
      const normalizedPreseason = (preseason||[])
        .filter((g:any)=>['scheduled','accepted','final'].includes(g.status))
        .map((g:any)=>({
          id: g.game_id || g.id,
          week_number: 0, game_number: 0,
          home_team: g.home_team, away_team: g.away_team,
          home_score: g.home_score || null, away_score: g.away_score || null,
          status: g.status==='final' ? 'final' : 'scheduled',
          played_at: g.scheduled_date ? g.scheduled_date+'T12:00:00' : null,
          game_type: 'preseason',
        }))
      setGames([...(g1||[]),...(g2||[]),...normalizedPreseason])
      setTeamMap(Object.fromEntries((teams||[]).map((t:any)=>[t.id,t])))

      const missingIds = Array.from(new Set(normalizedPreseason.flatMap((g:any)=>[g.home_team,g.away_team])
        .filter((id:string)=>id && !(teams||[]).some((t:any)=>t.id===id))))
      if (missingIds.length>0) {
        supabase.from('world_teams').select('id,name,color,logo_url').in('id',missingIds).then(({data:wt})=>{
          setTeamMap(prev=>({...prev, ...Object.fromEntries((wt||[]).map((t:any)=>[t.id,t]))}))
          setWorldTeamIds(new Set(missingIds))
        })
      }
      setLoading(false)
    })
  },[])

  const byMonth: Record<string,any[]> = {}
  games.forEach(g=>{
    const d=g.played_at?new Date(g.played_at):null
    const key=d?d.toLocaleDateString(isPT?'pt-PT':'en-US',{month:'long',year:'numeric'}):'TBD'
    if(!byMonth[key])byMonth[key]=[]
    byMonth[key].push(g)
  })
  const sortedMonths=Object.keys(byMonth).sort((a,b)=>{if(a==='TBD')return 1;if(b==='TBD')return -1;return new Date(a).getTime()-new Date(b).getTime()})
  const played=games.filter(g=>g.status==='final').length

  const fmtDate=(iso:string)=>new Date(iso).toLocaleDateString(isPT?'pt-PT':'en-US',{weekday:'short',month:'short',day:'numeric'})

  if(loading) return <div className="max-w-5xl mx-auto px-4 py-12 text-center" style={{color:'#8a8279'}}>{t('common.loading')}</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{color:'#1a1512'}}>📅 {isPT?'Calendário & Resultados':'Schedule & Results'} — 2025-26</h1>
          <p className="text-sm" style={{color:'#8a8279'}}>
            {played} {isPT?'jogados':'played'} · {games.length-played} {isPT?'restantes':'remaining'} · {games.length} {isPT?'total':'total'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(GAME_TYPE_LABEL).map(([key,val])=>(
            <span key={key} className="text-xs font-semibold px-2 py-0.5 rounded" style={{background:val.bg,color:val.color}}>{val.label}</span>
          ))}
        </div>
      </div>

      {sortedMonths.length===0?(
        <div className="rounded-xl p-8 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <p style={{color:'#6b5f4e'}}>{isPT?'O calendário aparecerá aqui quando a época começar.':'Schedule will appear here once the season begins.'}</p>
        </div>
      ):sortedMonths.map(month=>(
        <div key={month} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{color:'#b45309',letterSpacing:'1.5px'}}>{month}</span>
            <div className="flex-1 h-px" style={{background:'#d4cdc5'}}/>
            <span className="text-xs" style={{color:'#8a8279'}}>{byMonth[month].length} {isPT?`jogo${byMonth[month].length!==1?'s':''}`:`game${byMonth[month].length!==1?'s':''}`}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {byMonth[month].map((g:any)=>{
              const home=teamMap[g.home_team]; const away=teamMap[g.away_team]
              const isFinal=g.status==='final'
              const winner=isFinal?((g.home_score||0)>(g.away_score||0)?'home':'away'):null
              const homeColor=home?readableTeamColor(home.color):'#5c554e'
              const awayColor=away?readableTeamColor(away.color):'#5c554e'
              const typeInfo=GAME_TYPE_LABEL[g.game_type||'regular']||GAME_TYPE_LABEL.regular
              return(
                <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{background:'#faf8f5',border:'1px solid #e2dcd5'}}>
                  <div className="w-36 flex-shrink-0">
                    <div className="text-xs font-bold" style={{color:'#1a1512'}}>{g.played_at?fmtDate(g.played_at):'TBD'}</div>
                    {g.week_number>0&&<div className="text-xs" style={{color:'#8a8279'}}>{isPT?'Sem':'Wk'} {g.week_number}</div>}
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{background:typeInfo.bg,color:typeInfo.color,fontSize:10}}>{typeInfo.label}</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
                    {home?.logo_url&&<img src={home.logo_url} alt="" className="w-5 h-5 object-contain flex-shrink-0"/>}
                    <Link href={worldTeamIds.has(g.home_team)?`/world/${g.home_team}`:`/team/${g.home_team}`} className="text-sm font-semibold no-underline hover:underline" style={{color:winner==='away'?'#8a8279':homeColor}}>{home?.name||g.home_team}</Link>
                    {isFinal?<span className="font-black text-sm mx-1" style={{color:'#1a1512'}}>{g.home_score}–{g.away_score}</span>:<span className="text-xs mx-1" style={{color:'#8a8279'}}>vs</span>}
                    {away?.logo_url&&<img src={away.logo_url} alt="" className="w-5 h-5 object-contain flex-shrink-0"/>}
                    <Link href={worldTeamIds.has(g.away_team)?`/world/${g.away_team}`:`/team/${g.away_team}`} className="text-sm font-semibold no-underline hover:underline" style={{color:winner==='home'?'#8a8279':awayColor}}>{away?.name||g.away_team}</Link>
                  </div>
                  {isFinal
                    ?<Link href={`/game/${g.id}`} className="text-xs no-underline px-2 py-1 rounded flex-shrink-0" style={{background:'#e8e2d6',color:'#1d4ed8'}}>{isPT?'Box Score →':'Box Score →'}</Link>
                    :<span className="text-xs flex-shrink-0" style={{color:'#8a8279'}}>{isPT?'Agendado':'Scheduled'}</span>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

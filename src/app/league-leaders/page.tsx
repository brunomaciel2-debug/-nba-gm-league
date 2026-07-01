'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

export default function LeagueLeadersPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [rows,setRows] = useState<any[]>([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    supabase.from('player_stats').select('*, players(id,name,pos,team_id,photo_url,teams(color,logo_url))').eq('season','2025-26').gt('games',0).order('pts',{ascending:false}).limit(300)
      .then(({data:stats})=>{
        setRows((stats||[]).map((s:any)=>({
          ...s, pid:s.players?.id, name:s.players?.name||'—', pos:s.players?.pos||'—',
          team:s.players?.team_id||'—', photo:s.players?.photo_url, teamColor:s.players?.teams?.color,
          ppg:s.games>0?(s.pts/s.games).toFixed(1):'—', rpg:s.games>0?(s.reb/s.games).toFixed(1):'—',
          apg:s.games>0?(s.ast/s.games).toFixed(1):'—', spg:s.games>0?(s.stl/s.games).toFixed(1):'—',
          bpg:s.games>0?(s.blk/s.games).toFixed(1):'—',
          fgpct:s.fga>0?(s.fgm/s.fga*100).toFixed(1)+'%':'—',
          tppct:s.tpa>0?(s.tpm/s.tpa*100).toFixed(1)+'%':'—',
        })))
        setLoading(false)
      })
  },[])

  const cats = isPT ? [
    {label:'Pontos por Jogo',    key:'ppg',  color:'#c2410c'},
    {label:'Ressaltos por Jogo', key:'rpg',  color:'#166534'},
    {label:'Assistências p/ Jogo',key:'apg', color:'#1e40af'},
    {label:'Roubos por Jogo',    key:'spg',  color:'#7c3aed'},
    {label:'Bloqueios por Jogo', key:'bpg',  color:'#ff6040'},
    {label:'FG%',                key:'fgpct',color:'#0e7490'},
    {label:'% 3 Pontos',         key:'tppct',color:'#b45309'},
  ] : [
    {label:'Points Per Game',   key:'ppg',  color:'#c2410c'},
    {label:'Rebounds Per Game', key:'rpg',  color:'#166534'},
    {label:'Assists Per Game',  key:'apg',  color:'#1e40af'},
    {label:'Steals Per Game',   key:'spg',  color:'#7c3aed'},
    {label:'Blocks Per Game',   key:'bpg',  color:'#ff6040'},
    {label:'FG%',               key:'fgpct',color:'#0e7490'},
    {label:'3-Point %',         key:'tppct',color:'#b45309'},
  ]

  if(loading) return <div className="max-w-6xl mx-auto px-4 py-12 text-center" style={{color:'#8a8279'}}>{t('common.loading')}</div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6" style={{color:'#1a1512'}}>📊 {isPT?'Líderes da Liga':'League Leaders'} — 2025-26</h1>
      {rows.length===0?(
        <div className="rounded-xl p-8 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <p style={{color:'#6b5f4e'}}>{isPT?'As estatísticas aparecerão aqui quando a época começar.':'Stats will appear here once the season begins.'}</p>
        </div>
      ):(
        <div className="grid md:grid-cols-2 gap-6">
          {cats.map(cat=>{
            const sorted=[...rows].sort((a:any,b:any)=>(parseFloat(b[cat.key])||0)-(parseFloat(a[cat.key])||0)).slice(0,10)
            return(
              <div key={cat.key} className="rounded-xl overflow-hidden" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="px-4 py-3" style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
                  <h3 className="font-bold text-sm" style={{color:cat.color}}>{cat.label}</h3>
                </div>
                <div>
                  {sorted.map((p:any,i:number)=>{
                    const tc=readableTeamColor(p.teamColor||'555')
                    return(
                      <Link key={p.id} href={`/player/${p.pid}`} className="no-underline">
                        <div className="flex items-center gap-3 px-3 py-2.5 hover:brightness-110 transition-all" style={{background:i%2===0?'#ece7dd':'#e8e2d6',borderBottom:'1px solid #16120d'}}>
                          <span className="text-xs font-bold w-5 text-right flex-shrink-0" style={{color:i===0?cat.color:'#9c8e7a'}}>{i+1}</span>
                          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0" style={{background:tc+'22'}}>
                            {p.photo?<img src={p.photo} alt="" className="w-full h-full object-cover"/>
                              :<div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:tc}}>{p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate" style={{color:'#1a1512'}}>{p.name}</div>
                            <div className="text-xs" style={{color:'#6b5f4e'}}>{p.team} · {p.pos}</div>
                          </div>
                          <span className="text-sm font-black flex-shrink-0" style={{color:i===0?cat.color:'#1a1512'}}>{p[cat.key]}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

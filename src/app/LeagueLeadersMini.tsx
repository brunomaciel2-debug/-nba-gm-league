'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

const CATS_EN = [
  { key:'pts', label:'Points',    unit:'PPG', color:'#d97706', icon:'ti-ball-basketball' },
  { key:'ast', label:'Assists',   unit:'APG', color:'#0e7490', icon:'ti-arrows-exchange' },
  { key:'reb', label:'Rebounds',  unit:'RPG', color:'#1d4ed8', icon:'ti-arrow-bounce'    },
]
const CATS_PT = [
  { key:'pts', label:'Pontos',      unit:'PPG', color:'#d97706', icon:'ti-ball-basketball' },
  { key:'ast', label:'Assistências',unit:'APG', color:'#0e7490', icon:'ti-arrows-exchange' },
  { key:'reb', label:'Ressaltos',   unit:'RPG', color:'#1d4ed8', icon:'ti-arrow-bounce'    },
]

export default function LeagueLeadersMini() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const CATS = isPT ? CATS_PT : CATS_EN

  const [leaders, setLeaders] = useState<any[][]>([[], [], []])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Same source query as the full /league-leaders page — one season-scoped
    // fetch of every player with at least 1 game played, ranked client-side
    // per category. player_stats has one row per season per player, so this
    // MUST be scoped by season or it silently mixes in prior years' totals.
    supabase.from('player_stats')
      .select('player_id, games, pts, ast, reb, players(id, name, pos, photo_url, team_id, teams:teams!players_team_id_fkey(id, name, color))')
      .eq('season', '2025-26').gt('games', 0)
      .then(({ data }) => {
        const rows = (data || []).map((s: any) => ({
          ...s.players, gp: s.games,
          pts: s.games > 0 ? s.pts / s.games : 0,
          ast: s.games > 0 ? s.ast / s.games : 0,
          reb: s.games > 0 ? s.reb / s.games : 0,
        }))
        setLeaders(['pts', 'ast', 'reb'].map(stat =>
          [...rows].sort((a, b) => b[stat] - a[stat]).slice(0, 5)
            .map(p => ({ ...p, statValue: p[stat].toFixed(1) }))
        ))
        setLoading(false)
      })
  }, [])

  if (loading) return null

  return (
    <div className="mb-8">
      <div className="section-header mb-5">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{color:'#1a1612',letterSpacing:'1.5px'}}>
          <i className="ti ti-chart-bar" style={{fontSize:14,marginRight:6,color:'#b45309'}}></i>
          {isPT ? 'Líderes da Liga' : 'League Leaders'}
        </span>
        <Link href="/league-leaders" className="text-xs no-underline font-semibold" style={{color:'#b45309'}}>
          {isPT ? 'Ver Todos →' : 'Full Leaders →'}
        </Link>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {CATS.map((cat, ci) => {
          const list = leaders[ci]
          const leader = list[0]
          const tc = leader?.teams ? readableTeamColor((leader.teams as any).color) : '#5c554e'
          return (
            <div key={cat.key} className="rounded-2xl overflow-hidden"
              style={{background:'#e8e2d6',border:'1px solid #d4cec3',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderTop:'3px solid '+cat.color}}>
              <div className="px-5 py-3 flex items-center justify-between" style={{borderBottom:'1px solid #d4cec3'}}>
                <span className="text-xs font-bold uppercase tracking-widest" style={{color:cat.color}}>
                  <i className={`ti ${cat.icon}`} style={{fontSize:14,marginRight:6}}></i>
                  {cat.label} Leaders
                </span>
                <span className="text-xs font-bold" style={{color:cat.color}}>{cat.unit}</span>
              </div>
              {list.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm" style={{color:'#9c8e7a'}}>
                    {isPT ? 'Disponível após os primeiros jogos' : 'Available after games are played'}
                  </p>
                </div>
              ) : (
                <div>
                  {leader && (
                    <Link href={`/player/${leader.id}`} className="no-underline group">
                      <div className="p-5 flex items-center gap-4 transition-all group-hover:brightness-110"
                        style={{borderBottom:'1px solid #ddd8ce'}}>
                        <div className="relative flex-shrink-0">
                          <div className="w-24 h-24 rounded-full overflow-hidden"
                            style={{background:tc+'22',border:'2px solid '+tc+'55'}}>
                            {leader.photo_url
                              ? <img src={leader.photo_url} alt="" className="w-full h-full object-cover"/>
                              : <div className="w-full h-full flex items-center justify-center font-black text-2xl" style={{color:tc}}>
                                  {leader.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                </div>}
                          </div>
                          <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                            style={{background:cat.color,color:'#e8e2d9'}}>1</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-base truncate" style={{color:'#1a1612'}}>{leader.name}</div>
                          <div className="text-xs" style={{color:tc}}>{leader.pos} · {(leader.teams as any)?.name}</div>
                          <div className="text-xs mt-0.5" style={{color:'#9c8e7a'}}>{leader.gp} GP</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-3xl font-black" style={{color:cat.color}}>{leader.statValue}</div>
                          <div className="text-xs" style={{color:'#9c8e7a'}}>{cat.unit}</div>
                        </div>
                      </div>
                    </Link>
                  )}
                  {list.slice(1).map((p, i) => {
                    const ptc = p?.teams ? readableTeamColor((p.teams as any).color) : '#5c554e'
                    return (
                      <Link key={p.id} href={`/player/${p.id}`} className="no-underline group">
                        <div className="flex items-center gap-3 px-5 py-2.5 transition-all group-hover:brightness-125"
                          style={{borderBottom: i < 3 ? '1px solid #1e1a14' : 'none'}}>
                          <span className="text-sm font-bold w-4 flex-shrink-0" style={{color:'#b8ae9e'}}>{i+2}</span>
                          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0" style={{background:ptc+'22'}}>
                            {p.photo_url
                              ? <img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                              : <div className="w-full h-full flex items-center justify-center text-sm font-black" style={{color:ptc}}>
                                  {p.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                </div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate" style={{color:'#2d2723'}}>{p.name}</div>
                            <div className="text-xs" style={{color:'#9c8e7a'}}>{(p.teams as any)?.id}</div>
                          </div>
                          <div className="font-bold text-sm flex-shrink-0" style={{color:cat.color}}>{p.statValue}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

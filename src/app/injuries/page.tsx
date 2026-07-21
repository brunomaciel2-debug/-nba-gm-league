'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'
import { medicalCostAfterInsurance, InjurySeverity } from '@/lib/injury-constants'

function fmtCost(n: number) { return '$' + (n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K' : n) }

const SEVERITY_STYLE: Record<string, { color: string, bg: string, labelEN: string, labelPT: string }> = {
  minor:              { color: '#b45309', bg: '#fdf1e0', labelEN: 'Minor',       labelPT: 'Ligeira' },
  moderate:           { color: '#c2410c', bg: '#fde7db', labelEN: 'Moderate',    labelPT: 'Moderada' },
  serious:            { color: '#ff6040', bg: '#ffe3da', labelEN: 'Serious',     labelPT: 'Séria' },
  severe:             { color: '#dc2626', bg: '#fee2e2', labelEN: 'Severe',      labelPT: 'Severa' },
  career_threatening: { color: '#ff2040', bg: '#ffd9df', labelEN: 'Career Risk', labelPT: 'Risco de Carreira' },
}

const PLAY_STATUS = (health: number, isPT: boolean) => {
  if (health < 50) return { text: isPT ? 'FORA' : 'OUT',             color: '#dc2626', bg: '#fee2e2' }
  if (health < 60) return { text: isPT ? 'GAME-TIME' : 'GAME-TIME', color: '#c2410c', bg: '#fde7db' }
  if (health < 75) return { text: isPT ? 'LIMITADO' : 'LIMITED',    color: '#b45309', bg: '#fdf1e0' }
  return                  { text: isPT ? 'DISPONÍVEL' : 'AVAILABLE', color: '#166534', bg: '#dcfce7' }
}

export default function InjuriesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [teams, setTeams] = useState<any[]>([])
  const [injuries, setInjuries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('id,name,color,logo_url,conference,division')
        .not('id', 'in', '(ALL,RVS,ROO,SOP)').order('name'),
      supabase.from('injury_log').select('*, players(id,name,pos,photo_url,team_id,health)')
        .eq('season', '2025-26').eq('status', 'active').order('created_at', { ascending: false }),
    ]).then(([{ data: ts }, { data: inj }]) => {
      setTeams(ts || []); setInjuries(inj || []); setLoading(false)
    })
  }, [])

  const toggle = (teamId: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(teamId)) next.delete(teamId); else next.add(teamId)
    return next
  })

  const totalInjured = injuries.length

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-12 text-center" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1512' }}>🏥 {isPT ? 'Centro de Lesões' : 'Injury Center'}</h1>
          <p className="text-sm" style={{ color: '#6b5f4e' }}>
            {isPT ? 'Todas as equipas, todas as lesões ativas de momento.' : 'Every team, every currently active injury.'}
          </p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>
          {totalInjured} {isPT ? `jogador${totalInjured !== 1 ? 'es' : ''} lesionado${totalInjured !== 1 ? 's' : ''} na liga` : `player${totalInjured !== 1 ? 's' : ''} injured league-wide`}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map(tm => {
          const tc = readableTeamColor(tm.color)
          const teamInjuries = injuries.filter((i: any) => i.players?.team_id === tm.id)
          const isOpen = expanded.has(tm.id)
          return (
            <div key={tm.id} className="rounded-xl overflow-hidden"
                 style={{ border: '1px solid ' + (teamInjuries.length > 0 ? tc + '55' : '#e2dcd5'), opacity: teamInjuries.length === 0 ? 0.6 : 1 }}>
              <div className="flex items-center gap-2 px-4 py-3 cursor-pointer"
                   style={{ background: teamInjuries.length > 0 ? '#ede8de' : '#f5f2ee', borderBottom: (isOpen && teamInjuries.length > 0) ? '1px solid #e2dcd5' : 'none' }}
                   onClick={() => teamInjuries.length > 0 && toggle(tm.id)}>
                {tm.logo_url ? <img src={tm.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0" /> : <div className="w-7 h-7 flex-shrink-0" />}
                <Link href={`/team/${tm.id}`} onClick={e => e.stopPropagation()} className="no-underline flex-1 min-w-0">
                  <span className="font-bold text-sm truncate block hover:underline" style={{ color: teamInjuries.length > 0 ? '#1a1512' : '#9a9088' }}>{tm.name}</span>
                </Link>
                {teamInjuries.length > 0
                  ? <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#fee2e2', color: '#dc2626' }}>
                      {teamInjuries.length} {isPT ? 'lesionado(s)' : 'injured'}
                    </span>
                  : <span className="text-xs flex-shrink-0" style={{ color: '#b0a89e' }}>✅</span>}
              </div>
              {isOpen && teamInjuries.length > 0 && (
                <div style={{ background: '#faf8f5' }}>
                  {teamInjuries.map((inj: any) => {
                    const p = inj.players
                    const health = p?.health ?? 100
                    const sev = SEVERITY_STYLE[inj.severity] || SEVERITY_STYLE.minor
                    const ps = PLAY_STATUS(health, isPT)
                    const cost = medicalCostAfterInsurance(inj.severity as InjurySeverity)
                    return (
                      <Link key={inj.id} href={`/player/${inj.player_id}`} className="no-underline">
                        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #e8e2d8' }}
                             onMouseEnter={e => (e.currentTarget.style.background = '#f0ece5')}
                             onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {p?.photo_url
                            ? <img src={p.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid ' + tc + '44' }} />
                            : <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black" style={{ background: tc + '22', color: tc }}>
                                {p?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </div>}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate" style={{ color: '#1a1512' }}>{p?.name}</div>
                            <div className="text-xs truncate" style={{ color: '#6b5f4e' }}>{p?.pos} · {inj.injury_type}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className="flex gap-1">
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: sev.bg, color: sev.color }}>{isPT ? sev.labelPT : sev.labelEN}</span>
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: ps.bg, color: ps.color }}>{ps.text}</span>
                            </div>
                            <span className="text-xs font-semibold" style={{ color: '#c2410c' }}>{fmtCost(cost)}</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                  <div className="px-4 py-2" style={{ borderTop: '1px solid #e2dcd5', background: '#f5f1eb' }}>
                    <Link href={`/team/${tm.id}?tab=injuries`} className="block text-center text-xs font-semibold py-1 no-underline" style={{ color: tc }}>
                      {isPT ? 'Ver relatório completo →' : 'View full report →'}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

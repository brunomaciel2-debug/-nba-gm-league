'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

export default function JobVacanciesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [teams, setTeams] = useState<any[]>([])
  const [takenTeams, setTakenTeams] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('*').not('id','in','(ALL,RVS,ROO,SOP)').order('conference').order('name'),
      supabase.from('gm_profiles').select('team_id').eq('role','gm').not('team_id','is',null),
    ]).then(([{data: t}, {data: profiles}]) => {
      setTeams(t||[])
      setTakenTeams(new Set((profiles||[]).map((p:any) => p.team_id)))
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-center py-12" style={{color:'#8a8279'}}>{t('common.loading')}</div>

  const eastern = teams.filter((t:any) => t.conference === 'Eastern')
  const western = teams.filter((t:any) => t.conference === 'Western')
  const totalTeams = teams.length
  const openCount = teams.filter((t:any) => !takenTeams.has(t.id)).length
  const filledCount = totalTeams - openCount

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🏀</div>
        <h1 className="text-3xl font-black mb-2" style={{color:'#1a1612'}}>Beyond the Court</h1>
        <h2 className="text-xl font-bold mb-3" style={{color:'#b45309'}}>{isPT ? 'Vagas de GM' : 'General Manager Vacancies'}</h2>
        <p className="text-sm max-w-lg mx-auto" style={{color:'#6b5f4e'}}>
          {isPT
            ? 'Assume o controlo de uma franquia da NBA. Gere trocas, escolhas de draft, staff técnico, e leva a tua equipa ao título.'
            : 'Take control of an NBA franchise. Manage trades, draft picks, staff, and lead your team to a championship.'}
        </p>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="text-center">
            <div className="text-2xl font-black" style={{color:'#166534'}}>{openCount}</div>
            <div className="text-xs" style={{color:'#6b5f4e'}}>{isPT ? 'Vagas Abertas' : 'Open Positions'}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black" style={{color:'#dc2626'}}>{filledCount}</div>
            <div className="text-xs" style={{color:'#6b5f4e'}}>{isPT ? 'Preenchidas' : 'Filled'}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black" style={{color:'#1e40af'}}>{totalTeams}</div>
            <div className="text-xs" style={{color:'#6b5f4e'}}>{isPT ? 'Franquias no Total' : 'Total Franchises'}</div>
          </div>
        </div>
      </div>

      {/* Conferences */}
      {[{label:isPT?'Conferência Este':'Eastern Conference', teams:eastern, color:'#e05050'},
        {label:isPT?'Conferência Oeste':'Western Conference', teams:western, color:'#5090d0'}].map(conf => (
        <div key={conf.label} className="mb-10">
          <h3 className="text-sm font-bold uppercase tracking-widest mb-4"
              style={{color:conf.color}}>{conf.label}</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {conf.teams.map((t:any) => {
              const isOpen = !takenTeams.has(t.id)
              const tc = readableTeamColor(t.color)
              return (
                <Link key={t.id} href={`/jobs/${t.id}`} className="no-underline group">
                  <div className="rounded-xl p-4 h-full transition-all group-hover:brightness-125"
                       style={{background:'#e8e2d6',
                               border:'1px solid '+(isOpen?'#1a5a20':'#5a1a1a'),
                               borderTop:'3px solid '+(isOpen?'#15803d':'#dc2626')}}>
                    <div className="w-12 h-12 rounded-xl overflow-hidden mx-auto mb-3 flex items-center justify-center"
                         style={{background:tc+'22'}}>
                      {t.logo_url
                        ?<img src={t.logo_url} alt="" className="w-full h-full object-contain p-1.5"/>
                        :<span className="text-lg font-black" style={{color:tc}}>{t.id}</span>}
                    </div>
                    <div className="text-sm font-bold text-center mb-1 leading-tight" style={{color:'#1a1612'}}>
                      {t.name}
                    </div>
                    <div className="text-xs text-center mb-2" style={{color:'#6b5f4e'}}>{t.city}</div>
                    <div className="text-center">
                      <span className="text-xs font-bold px-2 py-1 rounded-full"
                            style={{background:isOpen?'#0a2a10':'#2a0a0a',
                                    color:isOpen?'#15803d':'#dc2626'}}>
                        {isOpen ? (isPT?'✅ Aberta':'✅ Open') : (isPT?'❌ Preenchida':'❌ Filled')}
                      </span>
                    </div>
                    <div className="flex justify-center gap-2 mt-2 text-xs" style={{color:'#9c8e7a'}}>
                      <span>{t.wins}{isPT?'V':'W'}</span><span>·</span><span>{t.losses}{isPT?'D':'L'}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

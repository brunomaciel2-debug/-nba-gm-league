'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslation } from '@/components/I18nProvider'

function StaffOfferPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const { user, profile } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const coachId = searchParams.get('coach')

  const [coach, setCoach] = useState<any>(null)
  const [salary, setSalary] = useState(0)
  const [years, setYears] = useState(2)
  const [role, setRole] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!coachId) return
    supabase.from('coaches').select('*').eq('id',coachId).single()
      .then(({data}) => {
        if (data) {
          setCoach(data)
          setRole(data.role)
          // AI salary suggestion
          const avg = data.role==='physio'?data.rehab_speed:
            data.role==='trainer'?Math.round((data.conditioning+data.recovery_boost+data.injury_prevent)/3):
            Math.round((data.off_adjustment+data.def_adjustment+data.off_development+data.def_development+data.tactical_dev)/5)
          const base = data.role==='head_coach'?12000000:data.role==='assistant_coach'?3000000:
            data.role==='trainer'?900000:700000
          setSalary(Math.round(avg/100*base/100000)*100000)
        }
      })
  }, [coachId])

  const submitOffer = async () => {
    if (!user||!profile?.team_id||!coach) return
    setSubmitting(true)
    const expiresAt = new Date()
    expiresAt.setHours(24,0,0,0) // midnight tonight

    await supabase.from('staff_offers').insert({
      coach_id: coach.id, team_id: profile.team_id,
      offered_by: user.id, salary, years, role,
      status: 'pending', expires_at: expiresAt.toISOString()
    })
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) return (
    <div className="max-w-md mx-auto px-4 py-12 text-center">
      <div className="text-5xl mb-4">📋</div>
      <h2 className="text-xl font-bold mb-2" style={{color:'#1a1612'}}>{isPT?'Proposta Enviada!':'Offer Submitted!'}</h2>
      <p className="mb-2" style={{color:'#6b5f4e'}}>
        {isPT
          ? <>{coach?.name} vai decidir à meia-noite de hoje. Vais receber uma notificação com a decisão.</>
          : <>{coach?.name} will decide at midnight tonight. You'll receive a notification with their decision.</>}
      </p>
      <p className="text-xs mb-6" style={{color:'#9c8e7a'}}>
        {isPT
          ? 'Se várias equipas fizerem propostas, o treinador escolhe com base no prestígio, salário e projeto.'
          : 'If multiple teams make offers, the coach will choose based on prestige, salary, and project.'}
      </p>
      <a href="/trade-center" className="px-4 py-2 rounded-lg text-sm font-bold no-underline"
         style={{background:'#1d4ed8',color:'#e8e2d6'}}>{isPT?'Voltar ao Centro de Trocas':'Back to Trade Center'}</a>
    </div>
  )

  if (!coach) return <div className="p-8 text-center" style={{color:'#6b5f4e'}}>{t('common.loading')}</div>

  const ROLE_OPTIONS = [
    {value:'head_coach',label:isPT?'Treinador Principal':'Head Coach'},
    {value:'assistant_coach',label:isPT?'Treinador Assistente':'Assistant Coach'},
    {value:'trainer',label:isPT?'Preparador Físico':'Trainer'},
    {value:'physio',label:isPT?'Fisioterapeuta':'Physio'},
  ]
  const capFmt = (n:number) => '$'+(n/1000000).toFixed(2)+'M'
  const isNaturalRole = role === coach.natural_role
  const penaltyNote = !isNaturalRole ? (isPT?'⚠️ A contratar fora da função natural — penalização de 30% na eficácia':'⚠️ Hiring outside natural role — 30% effectiveness penalty') : ''

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <a href="/trade-center" className="text-xs no-underline mb-4 block" style={{color:'#6b5f4e'}}>← {isPT?'Centro de Trocas':'Trade Center'}</a>
      <h1 className="text-xl font-bold mb-6" style={{color:'#1a1612'}}>{isPT?'Fazer Proposta de Staff':'Make Staff Offer'} — {coach.name}</h1>

      <div className="rounded-xl p-4 mb-6" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
        <div className="font-bold text-lg mb-1" style={{color:'#1a1612'}}>{coach.name}</div>
        <div className="text-xs" style={{color:'#6b5f4e'}}>
          {isPT?'Função natural':'Natural role'}: <strong style={{color:'#c2410c'}}>{coach.natural_role.replace(/_/g,' ')}</strong> ·
          {isPT?'Idade':'Age'} {coach.age} · {coach.nationality}
        </div>
      </div>

      {/* Estimated Contract */}
      <div className="rounded-xl p-4 mb-4" style={{background:'#ede8de',border:'1px solid #d4cec3',borderLeft:'3px solid #b45309'}}>
        <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#b45309'}}>
          {isPT?'Contrato Estimado':'Estimated Contract'}
        </div>
        <div className="flex items-end gap-3">
          <div>
            <div className="text-2xl font-black" style={{color:'#1a1612'}}>${(salary/1000000).toFixed(2)}M<span className="text-sm font-normal" style={{color:'#6b5f4e'}}>/{isPT?'ano':'yr'}</span></div>
            <div className="text-xs mt-0.5" style={{color:'#6b5f4e'}}>
              {isPT
                ? <>Baseado no valor de mercado de {coach?.natural_role?.replace(/_/g,' ')} × atributos</>
                : <>Based on {coach?.natural_role?.replace(/_/g,' ')} market rate × attributes</>}
            </div>
          </div>
          <div className="text-xs px-2 py-1 rounded-lg ml-auto" style={{background:'#fef3c7',color:'#c2410c'}}>
            {years} {isPT?'ano'+(years>1?'s':''):'year'+(years>1?'s':'')} · ${Math.round(salary*years/1000000).toFixed(1)}M {isPT?'total':'total'}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>{isPT?'Função na tua equipa':'Role in your team'}</label>
        <select value={role} onChange={e=>setRole(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}}>
          {ROLE_OPTIONS.map(r=>(
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {penaltyNote && (
          <p className="text-xs mt-1" style={{color:'#c2410c'}}>{penaltyNote}</p>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>
          {isPT?'Salário Anual':'Annual Salary'} — {capFmt(salary)}
        </label>
        <input type="range" min={200000} max={15000000} step={100000}
          value={salary} onChange={e=>setSalary(+e.target.value)} className="w-full" />
        <div className="flex justify-between text-xs mt-0.5" style={{color:'#9c8e7a'}}>
          <span>$200K</span><span>$15M</span>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>{isPT?'Duração do Contrato':'Contract Length'} — {years} {isPT?'ano'+(years>1?'s':''):'year'+(years>1?'s':'')}</label>
        <input type="range" min={1} max={5} step={1} value={years}
          onChange={e=>setYears(+e.target.value)} className="w-full" />
        <div className="flex justify-between text-xs mt-0.5" style={{color:'#9c8e7a'}}>
          <span>1{isPT?'ano':'yr'}</span><span>5{isPT?'anos':'yr'}</span>
        </div>
      </div>

      <div className="rounded-xl p-4 mb-4" style={{background:'#fef3c7',border:'1px solid #5a4a00'}}>
        <div className="text-xs font-semibold mb-1" style={{color:'#b45309'}}>⏰ {isPT?'A proposta expira à meia-noite de hoje':'Offer expires at midnight tonight'}</div>
        <div className="text-xs" style={{color:'#8a6a00'}}>
          {isPT
            ? 'Se várias equipas propuserem, o treinador escolhe com base em: prestígio da franquia · qualidade do plantel · salário oferecido · trajetória do projeto. Uma proposta recusada pode ser renegociada por um valor mais alto.'
            : 'If multiple teams bid, the coach chooses based on: franchise prestige · roster quality · salary offered · project trajectory. A rejected offer can be renegotiated at a higher value.'}
        </div>
      </div>

      <button onClick={submitOffer} disabled={!user||submitting||!profile?.team_id}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
        style={{background:'#15803d',color:'#eee8df'}}>
        {submitting?(isPT?'A enviar...':'Submitting...'):(isPT?'Enviar Proposta 👔':'Submit Offer 👔')}
      </button>
    </div>
  )
}

import { Suspense } from 'react'
export default function StaffOfferPageWrapper() {
  const { t } = useTranslation()
  return <Suspense fallback={<div className="p-8 text-center" style={{color:'#6b5f4e'}}>{t('common.loading')}</div>}><StaffOfferPage /></Suspense>
}

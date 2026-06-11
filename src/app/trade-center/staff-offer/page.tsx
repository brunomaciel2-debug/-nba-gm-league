'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'

export default function StaffOfferPage() {
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
      <h2 className="text-xl font-bold mb-2" style={{color:'#f0ebe0'}}>Offer Submitted!</h2>
      <p className="mb-2" style={{color:'#8a7a6a'}}>
        {coach?.name} will decide at midnight tonight. You'll receive a notification with their decision.
      </p>
      <p className="text-xs mb-6" style={{color:'#5a4a3a'}}>
        If multiple teams make offers, the coach will choose based on prestige, salary, and project.
      </p>
      <a href="/trade-center" className="px-4 py-2 rounded-lg text-sm font-bold no-underline"
         style={{background:'#3a8adf',color:'#fff'}}>Back to Trade Center</a>
    </div>
  )

  if (!coach) return <div className="p-8 text-center" style={{color:'#8a7a6a'}}>Loading...</div>

  const ROLE_OPTIONS = [
    {value:'head_coach',label:'Head Coach'},
    {value:'assistant_coach',label:'Assistant Coach'},
    {value:'trainer',label:'Trainer'},
    {value:'physio',label:'Physio'},
  ]
  const capFmt = (n:number) => '$'+(n/1000000).toFixed(2)+'M'
  const isNaturalRole = role === coach.natural_role
  const penaltyNote = !isNaturalRole ? '⚠️ Hiring outside natural role — 30% effectiveness penalty' : ''

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <a href="/trade-center" className="text-xs no-underline mb-4 block" style={{color:'#8a7a6a'}}>← Trade Center</a>
      <h1 className="text-xl font-bold mb-6" style={{color:'#f0ebe0'}}>Make Staff Offer — {coach.name}</h1>

      <div className="rounded-xl p-4 mb-6" style={{background:'#241f18',border:'1px solid #3a3228'}}>
        <div className="font-bold text-lg mb-1" style={{color:'#f0ebe0'}}>{coach.name}</div>
        <div className="text-xs" style={{color:'#8a7a6a'}}>
          Natural role: <strong style={{color:'#ffa040'}}>{coach.natural_role.replace(/_/g,' ')}</strong> ·
          Age {coach.age} · {coach.nationality}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>Role in your team</label>
        <select value={role} onChange={e=>setRole(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{background:'#1a1610',border:'1px solid #3a3228',color:'#f0ebe0'}}>
          {ROLE_OPTIONS.map(r=>(
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {penaltyNote && (
          <p className="text-xs mt-1" style={{color:'#ffa040'}}>{penaltyNote}</p>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>
          Annual Salary — {capFmt(salary)}
        </label>
        <input type="range" min={200000} max={15000000} step={100000}
          value={salary} onChange={e=>setSalary(+e.target.value)} className="w-full" />
        <div className="flex justify-between text-xs mt-0.5" style={{color:'#5a4a3a'}}>
          <span>$200K</span><span>$15M</span>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>Contract Length — {years} year{years>1?'s':''}</label>
        <input type="range" min={1} max={5} step={1} value={years}
          onChange={e=>setYears(+e.target.value)} className="w-full" />
        <div className="flex justify-between text-xs mt-0.5" style={{color:'#5a4a3a'}}>
          <span>1yr</span><span>5yr</span>
        </div>
      </div>

      <div className="rounded-xl p-4 mb-4" style={{background:'#2a2000',border:'1px solid #5a4a00'}}>
        <div className="text-xs font-semibold mb-1" style={{color:'#ffd040'}}>⏰ Offer expires at midnight tonight</div>
        <div className="text-xs" style={{color:'#8a6a00'}}>
          If multiple teams bid, the coach chooses based on: franchise prestige · roster quality · salary offered · project trajectory.
          A rejected offer can be renegotiated at a higher value.
        </div>
      </div>

      <button onClick={submitOffer} disabled={!user||submitting||!profile?.team_id}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
        style={{background:'#40e080',color:'#1a1610'}}>
        {submitting?'Submitting...':'Submit Offer 👔'}
      </button>
    </div>
  )
}

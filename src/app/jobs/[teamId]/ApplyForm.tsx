'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ApplyForm({ teamId, teamName }: { teamId: string, teamName: string }) {
  const [step, setStep] = useState<'intro'|'form'|'submitted'>('intro')
  const [form, setForm] = useState({
    full_name: '', age: '', city: '', country: '',
    email: '', username: '', password: '', motivation: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({...f, [k]: v}))

  const submit = async () => {
    if (!form.full_name || !form.email || !form.password || !form.username) {
      setError('Please fill in all required fields.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setSubmitting(true); setError('')
    try {
      // Insert application (user account created by commissioner on approval)
      const { error: err } = await supabase.from('job_applications').insert({
        team_id: teamId,
        full_name: form.full_name,
        age: form.age ? parseInt(form.age) : null,
        city: form.city,
        country: form.country,
        email: form.email,
        username: form.username,
        motivation: form.motivation,
        status: 'pending',
      })
      if (err) throw err
      setStep('submitted')
    } catch(e: any) {
      setError(e.message || 'Something went wrong.')
    }
    setSubmitting(false)
  }

  if (step === 'intro') return (
    <div className="rounded-xl p-6" style={{background:'#dcfce7',border:'1px solid #1a5a20'}}>
      <h3 className="text-lg font-bold mb-2" style={{color:'#166534'}}>
        🏀 Apply for GM — {teamName}
      </h3>
      <p className="text-sm mb-4" style={{color:'#5a8a5a'}}>
        You're about to apply to manage this franchise. As GM you'll control trades, depth charts,
        training intensity, staff decisions and weekly orders. The Commissioner will review your application.
      </p>
      <div className="flex gap-3">
        <button onClick={() => setStep('form')}
          className="px-6 py-2.5 rounded-xl font-bold text-sm"
          style={{background:'#40e080',color:'#0a2a10'}}>
          Apply for the Job →
        </button>
        <Link href="/jobs"
          className="px-6 py-2.5 rounded-xl font-bold text-sm no-underline"
          style={{background:'#3a3228',color:'#6b5f4e'}}>
          Not Interested
        </Link>
      </div>
    </div>
  )

  if (step === 'submitted') return (
    <div className="rounded-xl p-8 text-center" style={{background:'#dcfce7',border:'1px solid #1a5a20'}}>
      <div className="text-5xl mb-4">📋</div>
      <h3 className="text-xl font-bold mb-2" style={{color:'#166534'}}>Application Submitted!</h3>
      <p className="text-sm mb-2" style={{color:'#5a8a5a'}}>
        Your application to manage the <strong style={{color:'#1a1612'}}>{teamName}</strong> has been sent to the Commissioner.
      </p>
      <p className="text-sm mb-6" style={{color:'#5a8a5a'}}>
        You'll receive an email once your application is reviewed. If approved, you'll get your login credentials.
      </p>
      <Link href="/jobs" className="text-sm font-bold px-4 py-2 rounded-lg no-underline"
            style={{background:'#3a8adf',color:'#e8e2d6'}}>
        Browse Other Vacancies
      </Link>
    </div>
  )

  return (
    <div className="rounded-xl p-6" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
      <h3 className="text-lg font-bold mb-4" style={{color:'#1a1612'}}>
        📋 Application — {teamName}
      </h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{background:'#fee2e2',color:'#dc2626'}}>{error}</div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        {[
          {key:'full_name', label:'Full Name *',    type:'text',     placeholder:'John Smith'},
          {key:'email',     label:'Email *',         type:'email',    placeholder:'john@email.com'},
          {key:'username',  label:'Username *',      type:'text',     placeholder:'johngm'},
          {key:'password',  label:'Password *',      type:'password', placeholder:'Min. 6 characters'},
          {key:'age',       label:'Age',             type:'number',   placeholder:'30'},
          {key:'city',      label:'City',            type:'text',     placeholder:'Lisbon'},
          {key:'country',   label:'Country',         type:'text',     placeholder:'Portugal'},
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-semibold mb-1" style={{color:'#6b5f4e'}}>{f.label}</label>
            <input type={f.type} value={(form as any)[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}} />
          </div>
        ))}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1" style={{color:'#6b5f4e'}}>
          Why do you want to manage this franchise? (optional)
        </label>
        <textarea value={form.motivation} onChange={e => set('motivation', e.target.value)}
          rows={3} placeholder="Tell the Commissioner why you'd be a great GM for this team..."
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
          style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}} />
      </div>

      <p className="text-xs mb-4" style={{color:'#9c8e7a'}}>
        * Your account will be created by the Commissioner upon approval. Your password will be set as submitted.
      </p>

      <div className="flex gap-3">
        <button onClick={submit} disabled={submitting}
          className="px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
          style={{background:'#ffd040',color:'#1a1610'}}>
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
        <button onClick={() => setStep('intro')}
          className="px-6 py-2.5 rounded-xl font-bold text-sm"
          style={{background:'#3a3228',color:'#6b5f4e'}}>
          Back
        </button>
      </div>
    </div>
  )
}

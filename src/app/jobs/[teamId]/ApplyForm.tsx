'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

export default function ApplyForm({ teamId, teamName }: { teamId: string, teamName: string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
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
      setError(isPT ? 'Preenche todos os campos obrigatórios.' : 'Please fill in all required fields.')
      return
    }
    if (form.password.length < 6) {
      setError(isPT ? 'A palavra-passe deve ter pelo menos 6 caracteres.' : 'Password must be at least 6 characters.')
      return
    }
    setSubmitting(true); setError('')
    try {
      // Insert application
      const { data: app, error: err } = await supabase.from('job_applications').insert({
        team_id: teamId,
        full_name: form.full_name,
        age: form.age ? parseInt(form.age) : null,
        city: form.city,
        country: form.country,
        email: form.email,
        username: form.username,
        motivation: form.motivation,
        status: 'pending',
      }).select().single()
      if (err) throw err

      // Send notification to Commissioner inbox
      await supabase.from('inbox_messages').insert({
        to_team_id: 'commissioner',
        subject: `📋 New GM Application — ${teamName}`,
        body: `${form.full_name} (${form.email}) has applied to manage the ${teamName}. ${form.motivation ? `Motivation: "${form.motivation}"` : ''} Review at /admin/applications.`,
        type: 'application',
        metadata: { application_id: app?.id, team_id: teamId, email: form.email, full_name: form.full_name, password: form.password },
      })

      setStep('submitted')
    } catch(e: any) {
      setError(e.message || (isPT ? 'Algo correu mal.' : 'Something went wrong.'))
    }
    setSubmitting(false)
  }

  if (step === 'intro') return (
    <div className="rounded-xl p-6" style={{background:'#dcfce7',border:'1px solid #1a5a20'}}>
      <h3 className="text-lg font-bold mb-2" style={{color:'#166534'}}>
        🏀 {isPT ? `Candidatar a GM — ${teamName}` : `Apply for GM — ${teamName}`}
      </h3>
      <p className="text-sm mb-4" style={{color:'#5a8a5a'}}>
        {isPT
          ? 'Estás prestes a candidatar-te para gerir esta franquia. Como GM vais controlar trocas, esquemas tácticos, intensidade de treino, decisões de staff e ordens semanais. O Comissário vai rever a tua candidatura.'
          : "You're about to apply to manage this franchise. As GM you'll control trades, depth charts, training intensity, staff decisions and weekly orders. The Commissioner will review your application."}
      </p>
      <div className="flex gap-3">
        <button onClick={() => setStep('form')}
          className="px-6 py-2.5 rounded-xl font-bold text-sm"
          style={{background:'#15803d',color:'#0a2a10'}}>
          {isPT ? 'Candidatar-me à Vaga →' : 'Apply for the Job →'}
        </button>
        <Link href="/jobs"
          className="px-6 py-2.5 rounded-xl font-bold text-sm no-underline"
          style={{background:'#d4cdc5',color:'#6b5f4e'}}>
          {isPT ? 'Não Interessado' : 'Not Interested'}
        </Link>
      </div>
    </div>
  )

  if (step === 'submitted') return (
    <div className="rounded-xl p-8 text-center" style={{background:'#dcfce7',border:'1px solid #1a5a20'}}>
      <div className="text-5xl mb-4">📋</div>
      <h3 className="text-xl font-bold mb-2" style={{color:'#166534'}}>{isPT ? 'Candidatura Enviada!' : 'Application Submitted!'}</h3>
      <p className="text-sm mb-2" style={{color:'#5a8a5a'}}>
        {isPT ? <>A tua candidatura para gerir os <strong style={{color:'#1a1612'}}>{teamName}</strong> foi enviada ao Comissário.</>
             : <>Your application to manage the <strong style={{color:'#1a1612'}}>{teamName}</strong> has been sent to the Commissioner.</>}
      </p>
      <p className="text-sm mb-6" style={{color:'#5a8a5a'}}>
        {isPT
          ? 'O Comissário foi notificado. Se for aprovada, a tua conta será activada e vais poder entrar.'
          : "The Commissioner has been notified. If approved, your account will be activated and you'll be able to log in."}
      </p>
      <Link href="/jobs" className="text-sm font-bold px-4 py-2 rounded-lg no-underline"
            style={{background:'#1d4ed8',color:'#e8e2d6'}}>
        {isPT ? 'Ver Outras Vagas' : 'Browse Other Vacancies'}
      </Link>
    </div>
  )

  const FIELDS = [
    {key:'full_name', label:isPT?'Nome Completo *':'Full Name *',    type:'text',     placeholder:'John Smith'},
    {key:'email',     label:isPT?'Email *':'Email *',         type:'email',    placeholder:'john@email.com'},
    {key:'username',  label:isPT?'Nome de Utilizador *':'Username *',      type:'text',     placeholder:'johngm'},
    {key:'password',  label:isPT?'Palavra-passe *':'Password *',      type:'password', placeholder:isPT?'Mín. 6 caracteres':'Min. 6 characters'},
    {key:'age',       label:isPT?'Idade':'Age',             type:'number',   placeholder:'30'},
    {key:'city',      label:isPT?'Cidade':'City',            type:'text',     placeholder:'Lisboa'},
    {key:'country',   label:isPT?'País':'Country',         type:'text',     placeholder:'Portugal'},
  ]

  return (
    <div className="rounded-xl p-6" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
      <h3 className="text-lg font-bold mb-4" style={{color:'#1a1612'}}>
        📋 {isPT ? `Candidatura — ${teamName}` : `Application — ${teamName}`}
      </h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{background:'#fee2e2',color:'#dc2626'}}>{error}</div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        {FIELDS.map(f => (
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
          {isPT ? 'Porque queres gerir esta franquia? (opcional)' : 'Why do you want to manage this franchise? (optional)'}
        </label>
        <textarea value={form.motivation} onChange={e => set('motivation', e.target.value)}
          rows={3} placeholder={isPT ? 'Conta ao Comissário porque serias um óptimo GM para esta equipa...' : "Tell the Commissioner why you'd be a great GM for this team..."}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
          style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}} />
      </div>

      <p className="text-xs mb-4" style={{color:'#9c8e7a'}}>
        {isPT ? '* A tua conta será criada pelo Comissário após aprovação.' : '* Your account will be created by the Commissioner upon approval.'}
      </p>

      <div className="flex gap-3">
        <button onClick={submit} disabled={submitting}
          className="px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
          style={{background:'#b45309',color:'#eee8df'}}>
          {submitting ? (isPT?'A enviar...':'Submitting...') : (isPT?'Enviar Candidatura':'Submit Application')}
        </button>
        <button onClick={() => setStep('intro')}
          className="px-6 py-2.5 rounded-xl font-bold text-sm"
          style={{background:'#d4cdc5',color:'#6b5f4e'}}>
          {isPT ? 'Voltar' : 'Back'}
        </button>
      </div>
    </div>
  )
}

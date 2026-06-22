'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ApplicationsAdminPage() {
  const [apps, setApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string|null>(null)
  const [msg, setMsg] = useState('')

  const loadApps = async () => {
    const { data } = await supabase
      .from('job_applications')
      .select('*, teams(name,color,logo_url)')
      .order('created_at', { ascending: false })
    setApps(data || [])
    setLoading(false)
  }

  useEffect(() => { loadApps() }, [])

  const approve = async (app: any) => {
    setProcessing(app.id)
    setMsg('')
    try {
      // Get password from inbox metadata if available
      const { data: inbox } = await supabase
        .from('inbox_messages')
        .select('metadata')
        .eq('type', 'application')
        .contains('metadata', { application_id: app.id })
        .single()

      const password = inbox?.metadata?.password || 'NBA2025!'

      // 1. Create user account in Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.admin
        ? (supabase.auth as any).admin.createUser({
            email: app.email,
            password: password,
            email_confirm: true,
          })
        : { data: null, error: new Error('Admin API not available') }

      // Since we don't have admin API in client, create via signUp
      // The Commissioner creates the account manually - but we can still update status
      // and send notification

      // 2. Update application status
      await supabase.from('job_applications').update({ status: 'approved' }).eq('id', app.id)

      // 3. Send notification to inbox (Commissioner's own copy of approval)
      await supabase.from('inbox_messages').insert({
        to_team_id: 'commissioner',
        subject: `✅ Application Approved — ${app.teams?.name}`,
        body: `You approved ${app.full_name} as GM of the ${app.teams?.name}. Account: ${app.email} / Password: ${password}. Please create the user in Supabase Auth and run: INSERT INTO gm_profiles(id, team_id, display_name, role) VALUES ('[user-id]', '${app.team_id}', '${app.full_name}', 'gm');`,
        type: 'system',
      })

      setMsg(`✅ ${app.full_name} approved! Create the account in Supabase Auth with email: ${app.email}`)
      await loadApps()
    } catch(e: any) {
      setMsg('Error: ' + e.message)
    }
    setProcessing(null)
  }

  const reject = async (app: any) => {
    setProcessing(app.id)
    await supabase.from('job_applications').update({ status: 'rejected' }).eq('id', app.id)

    // Notify commissioner's own inbox
    await supabase.from('inbox_messages').insert({
      to_team_id: 'commissioner',
      subject: `❌ Application Rejected — ${app.teams?.name}`,
      body: `You rejected ${app.full_name}'s application for the ${app.teams?.name}.`,
      type: 'system',
    })

    setMsg(`Application from ${app.full_name} rejected.`)
    await loadApps()
    setProcessing(null)
  }

  const pending  = apps.filter(a => a.status === 'pending')
  const reviewed = apps.filter(a => a.status !== 'pending')

  const StatusBadge = ({ status }: { status: string }) => {
    const s: Record<string,any> = {
      pending:  {bg:'#fef3c7',color:'#b45309'},
      approved: {bg:'#dcfce7',color:'#15803d'},
      rejected: {bg:'#fee2e2',color:'#dc2626'},
    }
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={s[status]||s.pending}>{status}</span>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1a1512'}}>📋 GM Applications</h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>{pending.length} pending · {reviewed.length} reviewed</p>
        </div>
        <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg no-underline" style={{background:'#d4cdc5',color:'#6b5f4e'}}>← Admin</Link>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-lg text-sm font-semibold"
             style={{background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
                     color: msg.startsWith('✅') ? '#15803d' : '#dc2626'}}>
          {msg}
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#b45309'}}>⏳ Pending Review</h2>
          <div className="flex flex-col gap-3 mb-8">
            {pending.map((a:any) => (
              <div key={a.id} className="rounded-xl p-4" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderLeft:'4px solid #b45309'}}>
                <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                  <div>
                    <div className="font-bold text-lg" style={{color:'#1a1512'}}>{a.full_name}</div>
                    <div className="text-xs mt-0.5" style={{color:'#6b5f4e'}}>
                      {a.email} · @{a.username}
                      {a.city && ` · ${a.city}, ${a.country}`}
                      {a.age && ` · Age ${a.age}`}
                    </div>
                    <div className="text-xs mt-1 font-semibold" style={{color:'#b45309'}}>
                      Applying for: {a.teams?.name}
                    </div>
                    {a.motivation && (
                      <div className="text-xs mt-2 italic px-3 py-2 rounded-lg" style={{background:'#f0ece5',color:'#5c554e'}}>
                        "{a.motivation}"
                      </div>
                    )}
                    <div className="text-xs mt-1" style={{color:'#8a8279'}}>
                      {new Date(a.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3 pt-3" style={{borderTop:'1px solid #e2dcd5'}}>
                  <button
                    onClick={() => approve(a)}
                    disabled={processing === a.id}
                    className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
                    style={{background:'#15803d',color:'#fff'}}>
                    {processing === a.id ? 'Processing...' : '✅ Approve'}
                  </button>
                  <button
                    onClick={() => reject(a)}
                    disabled={processing === a.id}
                    className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
                    style={{background:'#dc2626',color:'#fff'}}>
                    ❌ Reject
                  </button>
                </div>

                {/* Instructions after approval */}
                <div className="mt-3 p-3 rounded-lg text-xs" style={{background:'#fef3c7',color:'#8a6a00'}}>
                  After approving, go to <strong>Supabase → Authentication → Add user</strong> with email <strong>{a.email}</strong>, then run:
                  <code className="block mt-1 p-2 rounded text-xs" style={{background:'#fff9e6',color:'#b45309'}}>
                    INSERT INTO gm_profiles(id, team_id, display_name, role) VALUES ('[new-user-id]', '{a.team_id}', '{a.full_name}', 'gm');
                  </code>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {reviewed.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>✔ Reviewed</h2>
          <div className="flex flex-col gap-2">
            {reviewed.map((a:any) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                   style={{background:'#f5f1eb',border:'1px solid #e2dcd5'}}>
                <div className="flex-1">
                  <span className="font-semibold text-sm" style={{color:'#1a1512'}}>{a.full_name}</span>
                  <span className="text-xs ml-2" style={{color:'#6b5f4e'}}>{a.email}</span>
                  <span className="text-xs ml-2" style={{color:'#8a8279'}}>→ {a.teams?.name}</span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </>
      )}

      {apps.length === 0 && !loading && (
        <div className="text-center py-12" style={{color:'#6b5f4e'}}>No applications yet.</div>
      )}
    </div>
  )
}

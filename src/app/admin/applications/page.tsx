import { supabase } from '@/lib/supabase'
import Link from 'next/link'
export const revalidate = 30

export default async function ApplicationsAdminPage() {
  const { data: apps } = await supabase
    .from('job_applications')
    .select('*, teams(name,color,logo_url)')
    .order('created_at', { ascending: false })

  const pending   = (apps||[]).filter((a:any) => a.status === 'pending')
  const reviewed  = (apps||[]).filter((a:any) => a.status !== 'pending')

  const StatusBadge = ({ status }: { status: string }) => {
    const s = { pending:{bg:'#2a2000',color:'#ffd040'}, approved:{bg:'#0a2a10',color:'#40e080'}, rejected:{bg:'#2a0a0a',color:'#e04040'} }
    const st = (s as any)[status] || s.pending
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={st}>{status}</span>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#f0ebe0'}}>📋 GM Applications</h1>
          <p className="text-sm" style={{color:'#8a7a6a'}}>{pending.length} pending · {reviewed.length} reviewed</p>
        </div>
        <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg no-underline" style={{background:'#3a3228',color:'#8a7a6a'}}>← Admin</Link>
      </div>

      {pending.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#ffd040'}}>⏳ Pending Review</h2>
          <div className="flex flex-col gap-3 mb-8">
            {pending.map((a:any) => (
              <div key={a.id} className="rounded-xl p-4" style={{background:'#241f18',border:'1px solid #5a4a00'}}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-bold" style={{color:'#f0ebe0'}}>{a.full_name}</div>
                    <div className="text-xs mt-0.5" style={{color:'#8a7a6a'}}>{a.email} · @{a.username} · {a.city}, {a.country}{a.age?` · Age ${a.age}`:''}</div>
                    <div className="text-xs mt-1" style={{color:'#ffd040'}}>Applying for: {a.teams?.name}</div>
                    {a.motivation && <div className="text-xs mt-2 italic" style={{color:'#6a5a4a'}}>"{a.motivation}"</div>}
                    <div className="text-xs mt-1" style={{color:'#4a3a2a'}}>{new Date(a.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <StatusBadge status={a.status} />
                  </div>
                </div>
                <div className="mt-3 p-3 rounded-lg text-xs" style={{background:'#2a2000',color:'#8a6a00'}}>
                  ⚠️ To approve: Go to Supabase → Authentication → Add user with email <strong>{a.email}</strong>, then run:
                  <code className="block mt-1 text-xs" style={{color:'#ffd040'}}>
                    INSERT INTO gm_profiles(id, team_id, display_name, role) VALUES ('[new-user-id]', '{a.team_id}', '{a.full_name}', 'gm');
                  </code>
                  Then update: <code style={{color:'#ffd040'}}>UPDATE job_applications SET status='approved' WHERE id='{a.id}';</code>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {reviewed.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6a5a4a'}}>✓ Reviewed</h2>
          <div className="flex flex-col gap-2">
            {reviewed.map((a:any) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                   style={{background:'#1a1610',border:'1px solid #2a2218'}}>
                <div className="flex-1">
                  <span className="font-semibold text-sm" style={{color:'#f0ebe0'}}>{a.full_name}</span>
                  <span className="text-xs ml-2" style={{color:'#6a5a4a'}}>{a.teams?.name}</span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </>
      )}

      {(apps||[]).length === 0 && (
        <div className="text-center py-12" style={{color:'#6a5a4a'}}>No applications yet.</div>
      )}
    </div>
  )
}

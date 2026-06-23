'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ManageGMsPage() {
  const [gms, setGms] = useState<any[]>([])
  const [vacancies, setVacancies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string|null>(null)
  const [msg, setMsg] = useState('')

  const load = async () => {
    // GMs activos
    const { data: profiles } = await supabase
      .from('gm_profiles')
      .select('*, teams(id, name, logo_url, color, conference)')
      .eq('role', 'gm')
      .order('created_at', { ascending: false })

    // Todas as equipas reais (excluir especiais)
    const { data: allTeams } = await supabase
      .from('teams')
      .select('id, name, logo_url, color, conference')
      .order('name')

    const specialIds = ['ALL', 'RVS', 'ROO', 'SOP']
    const realTeams = (allTeams || []).filter((t: any) => !specialIds.includes(t.id))
    const assignedTeamIds = (profiles || []).map((p: any) => p.team_id)
    const vacant = realTeams.filter((t: any) => !assignedTeamIds.includes(t.id))

    setGms(profiles || [])
    setVacancies(vacant)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const fireGM = async (gm: any) => {
    if (!confirm(`Fire ${gm.display_name} from ${gm.teams?.name}?`)) return
    setProcessing(gm.id)
    setMsg('')
    try {
      const res = await fetch('/api/admin/fire-gm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: gm.id, team_id: gm.team_id }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Unknown error')
      setMsg(`✅ ${gm.display_name} despedido com sucesso.`)
      await load()
    } catch (e: any) {
      setMsg(`❌ Erro: ${e.message}`)
    }
    setProcessing(null)
  }

  if (loading) return <div className="p-8 text-center" style={{color:'#5c554e'}}>Loading...</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1a1512'}}>👥 Manage GMs</h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>
            {gms.length} GMs activos · {vacancies.length} equipas vagas
          </p>
        </div>
        <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg no-underline"
              style={{background:'#d4cdc5',color:'#6b5f4e'}}>← Admin</Link>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-lg text-sm font-semibold"
             style={{background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
                     color: msg.startsWith('✅') ? '#15803d' : '#dc2626'}}>
          {msg}
        </div>
      )}

      {/* GMs Activos */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#b45309'}}>
        🟢 GMs Activos ({gms.length})
      </h2>

      {gms.length === 0 ? (
        <div className="text-center py-8 rounded-xl mb-8" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <p className="text-sm" style={{color:'#8a8279'}}>Nenhum GM activo.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-8">
          {gms.map((gm: any) => (
            <div key={gm.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                 style={{background:'#faf8f5', border:'1px solid #d4cdc5', borderLeft:'4px solid #15803d'}}>
              <div className="flex-shrink-0">
                {gm.teams?.logo_url
                  ? <img src={gm.teams.logo_url} alt="" className="w-10 h-10 object-contain" />
                  : <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black"
                         style={{background:'#e8e2d6', color:'#1a1512'}}>{gm.teams?.id?.slice(0,3)}</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{color:'#1a1512'}}>{gm.display_name}</div>
                <div className="text-xs" style={{color:'#6b5f4e'}}>
                  {gm.teams?.name} · {gm.teams?.conference} Conference
                </div>
              </div>
              <div className="text-xs flex-shrink-0" style={{color:'#8a8279'}}>
                {gm.last_seen
                  ? `Last seen ${new Date(gm.last_seen).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
                  : 'Never logged in'}
              </div>
              <button
                onClick={() => fireGM(gm)}
                disabled={processing === gm.id}
                className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 flex-shrink-0"
                style={{background:'#dc2626', color:'#fff'}}>
                {processing === gm.id ? '⏳...' : '🔥 Fire'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Equipas Vagas */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>
        🔴 Equipas Vagas ({vacancies.length})
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {vacancies.map((t: any) => (
          <Link key={t.id} href={`/jobs/${t.id}`} className="no-underline">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                 style={{background:'#f5f1eb', border:'1px solid #e2dcd5'}}>
              {t.logo_url
                ? <img src={t.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                : <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-black flex-shrink-0"
                       style={{background:'#e8e2d6'}}>{t.id?.slice(0,3)}</div>
              }
              <span className="text-xs font-semibold truncate" style={{color:'#1a1512'}}>{t.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

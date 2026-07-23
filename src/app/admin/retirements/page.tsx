'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

export default function RetirementsAdminPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [decisions, setDecisions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [currentWeek, setCurrentWeek] = useState(0)

  const load = async () => {
    const [{ data: dec }, { data: cfg }] = await Promise.all([
      supabase.from('retirement_decisions')
        .select('*, players(name,age,pos,photo_url,real_ovr,salary,nba_experience), teams(name,color,logo_url)')
        .order('created_at', { ascending: false }),
      supabase.from('season_config').select('current_week').eq('id', 1).single(),
    ])
    setDecisions(dec || [])
    setCurrentWeek((cfg?.current_week || 0) + 1)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // A GM never sees that this was the Commissioner's call — every message
  // reads like a natural roster event (a player deciding for himself), same
  // spirit as the retirement_warning heads-up sent earlier in the season.
  const stay = async (d: any) => {
    setProcessing(d.id); setMsg('')
    try {
      await supabase.from('players').update({ contract_years: 1 }).eq('id', d.player_id)
      await supabase.from('retirement_decisions').update({
        status: 'decided', decision: 'stay', decided_at: new Date().toISOString(),
      }).eq('id', d.id)
      await supabase.from('transactions').insert({
        type: 'extension', category: 'player',
        description: `${d.players?.name} returns for one more season with ${d.teams?.name || d.team_id}`,
        teams: [d.team_id], players: [d.players?.name], player_ids: [d.player_id], status: 'completed', week_number: currentWeek,
      })
      await supabase.from('inbox_messages').insert({
        to_team_id: d.team_id, type: 'contract',
        subject: `🏀 ${d.players?.name} is returning for one more season!`,
        body: `${d.players?.name} has decided to continue his career for at least one more year with your team.`,
        read: false, metadata: { player_id: d.player_id },
      })
      setMsg(isPT ? `✅ ${d.players?.name} continua na equipa.` : `✅ ${d.players?.name} stays with the team.`)
      await load()
    } catch (e: any) { setMsg(`${isPT ? 'Erro' : 'Error'}: ` + e.message) }
    setProcessing(null)
  }

  const retire = async (d: any) => {
    setProcessing(d.id); setMsg('')
    try {
      await supabase.from('players').update({ status: 'retired', team_id: null, contract_years: 0 }).eq('id', d.player_id)
      await supabase.from('retirement_decisions').update({
        status: 'decided', decision: 'retire', decided_at: new Date().toISOString(),
      }).eq('id', d.id)
      await supabase.from('transactions').insert({
        type: 'retirement', category: 'player',
        description: `${d.players?.name} announces his retirement after ${d.players?.nba_experience ?? '?'} season${d.players?.nba_experience === 1 ? '' : 's'} in the league`,
        teams: [d.team_id], players: [d.players?.name], player_ids: [d.player_id], status: 'completed', week_number: currentWeek,
      })
      await supabase.from('inbox_messages').insert({
        to_team_id: d.team_id, type: 'contract',
        subject: `👋 ${d.players?.name} has retired`,
        body: `${d.players?.name} has announced his retirement from professional basketball. Thank you for the memories.`,
        read: false, metadata: { player_id: d.player_id },
      })
      setMsg(isPT ? `${d.players?.name} retirou-se.` : `${d.players?.name} has retired.`)
      await load()
    } catch (e: any) { setMsg(`${isPT ? 'Erro' : 'Error'}: ` + e.message) }
    setProcessing(null)
  }

  const pending = decisions.filter(d => d.status === 'pending')
  const decided = decisions.filter(d => d.status !== 'pending')

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-12 text-center" style={{ color: '#6b5f4e' }}>{t('common.loading')}</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1512' }}>
            🏀 {isPT ? 'Decisões de Retirada' : 'Retirement Decisions'}
          </h1>
          <p className="text-sm" style={{ color: '#6b5f4e' }}>
            {pending.length} {isPT ? 'pendentes' : 'pending'} · {decided.length} {isPT ? 'decididas' : 'decided'}
          </p>
        </div>
        <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg no-underline" style={{ background: '#d4cdc5', color: '#6b5f4e' }}>← Admin</Link>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-lg text-sm font-semibold" style={{ background: '#dcfce7', color: '#15803d' }}>{msg}</div>
      )}

      {pending.length === 0 && decided.length === 0 && (
        <div className="text-center py-12" style={{ color: '#6b5f4e' }}>
          {isPT ? 'Nenhuma decisão de retirada ainda — aparecem aqui no fim da época regular.' : 'No retirement decisions yet — these appear here at the end of the regular season.'}
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#b45309' }}>
            ⏳ {isPT ? 'Por Decidir' : 'Pending'}
          </h2>
          <div className="flex flex-col gap-3 mb-8">
            {pending.map((d: any) => {
              const tc = readableTeamColor(d.teams?.color || '555')
              const p = d.players
              return (
                <div key={d.id} className="rounded-xl p-4" style={{ background: '#faf8f5', border: '1px solid #d4cdc5', borderLeft: '4px solid #b45309' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0" style={{ background: tc + '22', border: `2px solid ${tc}44` }}>
                      {p?.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-sm font-black" style={{ color: tc }}>{p?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-lg" style={{ color: '#1a1512' }}>{p?.name}</div>
                      <div className="text-xs" style={{ color: '#6b5f4e' }}>
                        {p?.pos} · {isPT ? 'Idade' : 'Age'} {p?.age} · OVR {p?.real_ovr} · {d.teams?.name || d.team_id}
                        {p?.nba_experience != null && ` · ${p.nba_experience} ${isPT ? 'época(s) na liga' : 'season(s) in the league'}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid #e2dcd5' }}>
                    <button onClick={() => stay(d)} disabled={processing === d.id}
                      className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40" style={{ background: '#15803d', color: '#fff' }}>
                      {processing === d.id ? (isPT ? 'A processar...' : 'Processing...') : `🏀 ${isPT ? 'Fica +1 Ano' : 'Stays +1 Year'}`}
                    </button>
                    <button onClick={() => retire(d)} disabled={processing === d.id}
                      className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40" style={{ background: '#b45309', color: '#fff' }}>
                      👋 {isPT ? 'Retira-se Definitivamente' : 'Retires for Good'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {decided.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#6b5f4e' }}>
            ✔ {isPT ? 'Decididas' : 'Decided'}
          </h2>
          <div className="flex flex-col gap-2">
            {decided.map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#f5f1eb', border: '1px solid #e2dcd5' }}>
                <div className="flex-1">
                  <span className="font-semibold text-sm" style={{ color: '#1a1512' }}>{d.players?.name}</span>
                  <span className="text-xs ml-2" style={{ color: '#8a8279' }}>{d.teams?.name || d.team_id}</span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                  background: d.decision === 'stay' ? '#dcfce7' : '#fef3c7',
                  color: d.decision === 'stay' ? '#15803d' : '#b45309',
                }}>
                  {d.decision === 'stay' ? (isPT ? 'Ficou' : 'Stayed') : (isPT ? 'Retirou-se' : 'Retired')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

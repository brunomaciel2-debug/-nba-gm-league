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

  const load = async () => {
    // retirement_decisions.team_id has no real foreign-key constraint to
    // teams.id (it's just a plain text column that happens to hold a team
    // abbreviation), so PostgREST can't embed teams(...) directly — asking
    // for it fails the WHOLE query with a PGRST200 error, silently leaving
    // this page's list empty even though the rows genuinely exist. Fetch
    // teams separately and join in JS instead (same pattern already used
    // on the Transactions page for the same reason).
    const [{ data: dec, error: decErr }, { data: teams }] = await Promise.all([
      supabase.from('retirement_decisions')
        .select('*, players(name,age,pos,photo_url,real_ovr,salary,nba_experience,contract_years)')
        .order('created_at', { ascending: false }),
      supabase.from('teams').select('id,name,color,logo_url'),
    ])
    if (decErr) console.error('Failed to load retirement decisions:', decErr)
    const teamMap: Record<string, any> = {}
    ;(teams || []).forEach((tm: any) => { teamMap[tm.id] = tm })
    setDecisions((dec || []).map((d: any) => ({ ...d, teams: teamMap[d.team_id] })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // The Commissioner can decide any time, but the actual roster change
  // (player leaves for free agency, or retires outright) only takes effect
  // once the season is truly over — playoffs finished, champion crowned.
  // A player queued to leave is still needed on his team's playoff roster
  // until then, so this just records the decision; executeDecidedRetirements
  // (in retirement-resolver.ts) applies it later, right when the NBA
  // Finals resolve. The GM only sees the real notification at that point,
  // never a hint that the Commissioner decided this ahead of time.
  const stay = async (d: any) => {
    setProcessing(d.id); setMsg('')
    try {
      await supabase.from('retirement_decisions').update({
        status: 'decided', decision: 'stay', decided_at: new Date().toISOString(),
      }).eq('id', d.id)
      setMsg(isPT
        ? `✅ Decisão registada — ${d.players?.name} vai continuar a jogar. Efetiva-se no fim da época.`
        : `✅ Decision recorded — ${d.players?.name} will keep playing. Takes effect at season's end.`)
      await load()
    } catch (e: any) { setMsg(`${isPT ? 'Erro' : 'Error'}: ` + e.message) }
    setProcessing(null)
  }

  const retire = async (d: any) => {
    setProcessing(d.id); setMsg('')
    try {
      await supabase.from('retirement_decisions').update({
        status: 'decided', decision: 'retire', decided_at: new Date().toISOString(),
      }).eq('id', d.id)
      setMsg(isPT
        ? `Decisão registada — ${d.players?.name} vai reformar-se. Efetiva-se no fim da época.`
        : `Decision recorded — ${d.players?.name} will retire. Takes effect at season's end.`)
      await load()
    } catch (e: any) { setMsg(`${isPT ? 'Erro' : 'Error'}: ` + e.message) }
    setProcessing(null)
  }

  const pending = decisions.filter(d => d.status === 'pending')
  const decidedAwaiting = decisions.filter(d => d.status === 'decided')
  const decided = decisions.filter(d => d.status === 'executed')

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-12 text-center" style={{ color: '#6b5f4e' }}>{t('common.loading')}</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1512' }}>
            🏀 {isPT ? 'Decisões de Retirada' : 'Retirement Decisions'}
          </h1>
          <p className="text-sm" style={{ color: '#6b5f4e' }}>
            {pending.length} {isPT ? 'pendentes' : 'pending'} · {decidedAwaiting.length} {isPT ? 'decididas (aguardam fim da época)' : 'decided (awaiting season end)'} · {decided.length} {isPT ? 'efetivadas' : 'finalized'}
          </p>
        </div>
        <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg no-underline" style={{ background: '#d4cdc5', color: '#6b5f4e' }}>← Admin</Link>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-lg text-sm font-semibold" style={{ background: '#dcfce7', color: '#15803d' }}>{msg}</div>
      )}

      {pending.length === 0 && decidedAwaiting.length === 0 && decided.length === 0 && (
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
              const contractEnded = (p?.contract_years ?? 1) <= 1
              return (
                <div key={d.id} className="rounded-xl p-4" style={{ background: '#faf8f5', border: '1px solid #d4cdc5', borderLeft: '4px solid #b45309' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0" style={{ background: tc + '22', border: `2px solid ${tc}44` }}>
                      {p?.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-sm font-black" style={{ color: tc }}>{p?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-lg" style={{ color: '#1a1512' }}>{p?.name}</div>
                        {contractEnded && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#b45309' }}>
                            {isPT ? 'Contrato termina esta época' : 'Contract ends this season'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: '#6b5f4e' }}>
                        {p?.pos} · {isPT ? 'Idade' : 'Age'} {p?.age} · OVR {p?.real_ovr} · {d.teams?.name || d.team_id}
                        {p?.nba_experience != null && ` · ${p.nba_experience} ${isPT ? 'época(s) na liga' : 'season(s) in the league'}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid #e2dcd5' }}>
                    <button onClick={() => stay(d)} disabled={processing === d.id}
                      className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40" style={{ background: '#15803d', color: '#fff' }}>
                      {processing === d.id
                        ? (isPT ? 'A processar...' : 'Processing...')
                        : contractEnded
                          ? `🏀 ${isPT ? 'Continua a Jogar (Free Agent)' : 'Keeps Playing (Free Agent)'}`
                          : `🏀 ${isPT ? 'Fica +1 Ano' : 'Stays +1 Year'}`}
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

      {decidedAwaiting.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#0e7490' }}>
            ⏱ {isPT ? 'Decididas — Aguardam Fim da Época' : 'Decided — Awaiting Season End'}
          </h2>
          <p className="text-xs mb-3" style={{ color: '#8a8279' }}>
            {isPT
              ? 'A decisão foi tomada, mas só produz efeito (saída para free agency ou reforma) quando a época terminar — para não tirar jogadores dos plantéis a meio dos playoffs.'
              : "The decision is made, but it only takes effect (free agency or retirement) once the season ends — so no one gets pulled from a roster mid-playoffs."}
          </p>
          <div className="flex flex-col gap-2 mb-8">
            {decidedAwaiting.map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#ecfeff', border: '1px solid #a5f3fc' }}>
                <div className="flex-1">
                  <span className="font-semibold text-sm" style={{ color: '#1a1512' }}>{d.players?.name}</span>
                  <span className="text-xs ml-2" style={{ color: '#8a8279' }}>{d.teams?.name || d.team_id}</span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                  background: d.decision === 'stay' ? '#dcfce7' : '#fef3c7',
                  color: d.decision === 'stay' ? '#15803d' : '#b45309',
                }}>
                  {d.decision === 'stay' ? (isPT ? 'Vai Continuar' : 'Will Stay') : (isPT ? 'Vai Retirar-se' : 'Will Retire')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {decided.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#6b5f4e' }}>
            ✔ {isPT ? 'Efetivadas' : 'Finalized'}
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

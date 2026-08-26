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
    // retirement_decisions.team_id has no real foreign-key constraint to
    // teams.id (it's just a plain text column that happens to hold a team
    // abbreviation), so PostgREST can't embed teams(...) directly — asking
    // for it fails the WHOLE query with a PGRST200 error, silently leaving
    // this page's list empty even though the rows genuinely exist. Fetch
    // teams separately and join in JS instead (same pattern already used
    // on the Transactions page for the same reason).
    const [{ data: dec, error: decErr }, { data: cfg }, { data: teams }] = await Promise.all([
      supabase.from('retirement_decisions')
        .select('*, players(name,age,pos,photo_url,real_ovr,salary,nba_experience,contract_years)')
        .order('created_at', { ascending: false }),
      supabase.from('season_config').select('current_week').eq('id', 1).single(),
      supabase.from('teams').select('id,name,color,logo_url'),
    ])
    if (decErr) console.error('Failed to load retirement decisions:', decErr)
    const teamMap: Record<string, any> = {}
    ;(teams || []).forEach((tm: any) => { teamMap[tm.id] = tm })
    setDecisions((dec || []).map((d: any) => ({ ...d, teams: teamMap[d.team_id] })))
    setCurrentWeek((cfg?.current_week || 0) + 1)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // A GM never sees that this was the Commissioner's call — every message
  // reads like a natural roster event (a player deciding for himself), same
  // spirit as the retirement_warning heads-up sent earlier in the season.
  //
  // "Stay" only means he isn't retiring — it says nothing about WHERE he
  // plays next. A player with 1 (or 0) contract_years left is finishing the
  // last season of his deal; nothing obligates him to re-sign with this
  // team, so he walks into free agency instead of being auto-extended here.
  // Unlike a cut, this is a natural expiry: no dead cap, and the team's
  // cap space actually opens back up.
  const stay = async (d: any) => {
    setProcessing(d.id); setMsg('')
    try {
      const contractEnded = (d.players?.contract_years ?? 1) <= 1
      if (contractEnded) {
        const { data: team } = await supabase.from('teams').select('cap_used').eq('id', d.team_id).single()
        await supabase.from('players').update({
          team_id: null, contract_years: 0, previous_team_id: d.team_id, dead_cap_amount: 0,
        }).eq('id', d.player_id)
        if (team) {
          await supabase.from('teams').update({
            cap_used: Math.max(0, (team.cap_used || 0) - (d.players?.salary || 0)),
          }).eq('id', d.team_id)
        }
      } else {
        // Still has years left on his deal — nothing changes, he was never leaving.
      }
      await supabase.from('retirement_decisions').update({
        status: 'decided', decision: 'stay', decided_at: new Date().toISOString(),
      }).eq('id', d.id)
      await supabase.from('transactions').insert({
        type: contractEnded ? 'waiver' : 'extension', category: 'player',
        description: contractEnded
          ? `${d.players?.name}'s contract with ${d.teams?.name || d.team_id} expires; he decides to keep playing and becomes a free agent`
          : `${d.players?.name} returns for one more season with ${d.teams?.name || d.team_id}`,
        teams: [d.team_id], players: [d.players?.name], player_ids: [d.player_id], status: 'completed', week_number: currentWeek,
      })
      await supabase.from('inbox_messages').insert({
        to_team_id: d.team_id, type: 'contract',
        subject: isPT ? `🏀 ${d.players?.name} vai continuar!` : `🏀 ${d.players?.name} is coming back!`,
        body: contractEnded
          ? (isPT
              ? `Após ponderação, ${d.players?.name} decidiu que ainda não é altura de pendurar as botas. Como o contrato com ${d.teams?.name || d.team_id} chegou ao fim, vai entrar no mercado como agente livre.`
              : `After careful consideration, ${d.players?.name} has decided it isn't time to hang up his sneakers just yet. With his contract with ${d.teams?.name || d.team_id} up, he'll enter free agency looking for his next team.`)
          : (isPT
              ? `Após ponderação, ${d.players?.name} decidiu que ainda não é altura de pendurar as botas — vai continuar a vestir as cores de ${d.teams?.name || d.team_id} por mais uma época.`
              : `After careful consideration, ${d.players?.name} has decided it isn't time to hang up his sneakers just yet — he'll suit up for ${d.teams?.name || d.team_id} for at least one more season.`),
        read: false, metadata: { player_id: d.player_id },
      })
      setMsg(contractEnded
        ? (isPT ? `✅ ${d.players?.name} continua a jogar, agora como agente livre.` : `✅ ${d.players?.name} keeps playing, now a free agent.`)
        : (isPT ? `✅ ${d.players?.name} continua na equipa.` : `✅ ${d.players?.name} stays with the team.`))
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
        subject: isPT ? `👋 ${d.players?.name} anuncia a reforma` : `👋 ${d.players?.name} has retired`,
        body: isPT
          ? `Após ponderação, ${d.players?.name} decidiu que chegou a altura de pendurar as botas e encerrar a carreira profissional. Obrigado pelas memórias.`
          : `After careful consideration, ${d.players?.name} has decided it's time to hang up his sneakers and step away from professional basketball. Thank you for the memories.`,
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

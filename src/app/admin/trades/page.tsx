'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import { PlayerPreviewCard, PickChip, capFmt } from '@/app/trade-center/PendingTradesPanel'

// Every commissioner-facing "must decide on behalf of a team" workflow
// (GM Applications, Free Agency, Draft, Staff Offers...) lives under
// /admin — trade responses are no different, and especially matter here
// since a team with no active GM otherwise has no one who could ever
// accept or reject a trade sent to it. The API (/api/trade/respond)
// already supported the Commissioner acting for any team; this page is
// the missing UI for it — the Admin Panel already linked here, the page
// just never existed.
export default function AdminTradesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [proposals, setProposals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string|null>(null)
  const [msg, setMsg] = useState('')

  const loadProposals = async () => {
    setLoading(true)
    const { data: pending } = await supabase.from('trade_proposals').select('*').eq('status','pending').order('created_at',{ascending:false})

    const enriched = await Promise.all((pending||[]).map(async (proposal: any) => {
      const { data: rows } = await supabase.from('trade_proposal_teams').select('*').eq('proposal_id', proposal.id)
      const allRows = rows || []

      const { data: teamRecords } = await supabase.from('teams').select('id,name,logo_url,color')
        .in('id', allRows.map((r: any) => r.team_id))
      const teamInfoMap: Record<string, any> = {}
      for (const tm of (teamRecords || [])) teamInfoMap[tm.id] = tm

      const allPlayerIds = Array.from(new Set(allRows.flatMap((r: any) => [...(r.players_out||[]), ...(r.players_in||[])])))
      const allPickIds = Array.from(new Set(allRows.flatMap((r: any) => [...(r.picks_out||[]), ...(r.picks_in||[])])))

      const { data: playersData } = allPlayerIds.length
        ? await supabase.from('players').select('id,name,pos,real_ovr,age,salary,photo_url,contract_years').in('id', allPlayerIds)
        : { data: [] as any[] }
      const playerMap: Record<string, any> = {}
      for (const p of (playersData || [])) playerMap[p.id] = p

      const { data: picksData } = allPickIds.length
        ? await supabase.from('draft_picks').select('id,season,round,protection,original_team_id').in('id', allPickIds)
        : { data: [] as any[] }
      const pickMap: Record<string, any> = {}
      for (const pk of (picksData || [])) pickMap[pk.id] = pk

      return { proposal, rows: allRows, teamInfoMap, playerMap, pickMap }
    }))

    setProposals(enriched)
    setLoading(false)
  }

  useEffect(() => { loadProposals() }, [])

  const respond = async (proposalId: string, teamId: string, action: 'accept'|'reject') => {
    setResponding(proposalId+teamId)
    setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT?'Não autenticado':'Not authenticated'); setResponding(null); return }

    const res = await fetch('/api/trade/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+session.access_token },
      body: JSON.stringify({ proposalId, action, teamId }),
    })
    const json = await res.json()
    if (res.ok) {
      setMsg(action==='accept' ? (isPT?'✅ Troca aceite em nome da equipa!':'✅ Trade accepted on behalf of the team!') : (isPT?'✓ Troca recusada em nome da equipa':'✓ Trade rejected on behalf of the team'))
      await loadProposals()
    } else {
      setMsg(`❌ ${json.error}`)
    }
    setResponding(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1a1512'}}>
            🤝 {isPT?'Aprovação de Trades':'Trade Approvals'}
          </h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>
            {isPT
              ? `${proposals.length} troca(s) pendente(s) — aceita ou recusa em nome de qualquer equipa, especialmente as sem GM ativo.`
              : `${proposals.length} pending trade(s) — accept or reject on behalf of any team, especially ones with no active GM.`}
          </p>
        </div>
        <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg no-underline" style={{background:'#d4cdc5',color:'#6b5f4e'}}>← Admin</Link>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-lg text-sm font-semibold"
             style={{background:msg.startsWith('❌')?'#fee2e2':'#dcfce7', color:msg.startsWith('❌')?'#f87171':'#4ade80'}}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{color:'#6b5f4e'}}>{t('common.loading')}</div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5',color:'#8a8279'}}>
          {isPT?'Sem propostas de troca pendentes.':'No pending trade proposals.'}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {proposals.map(({ proposal, rows, teamInfoMap, playerMap, pickMap }) => (
            <div key={proposal.id} className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
              <div className="px-4 py-3" style={{background:'#faf8f5',borderBottom:'1px solid #e2dcd5'}}>
                <div className="text-sm font-bold" style={{color:'#1a1512'}}>
                  {isPT?'Proposta de':'Proposal from'} {teamInfoMap[proposal.initiator_team]?.name || proposal.initiator_team}
                  {rows.length > 2 && <span className="ml-2 text-xs font-semibold" style={{color:'#b45309'}}>🔀 {isPT?`troca a ${rows.length} equipas`:`${rows.length}-team trade`}</span>}
                </div>
                <div className="text-xs mt-0.5" style={{color:'#8a8279'}}>
                  {new Date(proposal.created_at).toLocaleDateString(isPT?'pt-PT':'en-US',{month:'long',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                  {proposal.proposed_by_commissioner && <span className="ml-2">({isPT?'proposta pelo Comissário':'proposed by Commissioner'})</span>}
                </div>
                {proposal.notes && (
                  <div className="mt-2 text-xs italic px-3 py-2 rounded-lg" style={{background:'#f0ece5',color:'#5c554e'}}>
                    "{proposal.notes}"
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col gap-3">
                {rows.map((row: any) => {
                  const team = teamInfoMap[row.team_id]
                  const playersOut = (row.players_out||[]).map((id: any) => playerMap[id]).filter(Boolean)
                  const playersIn = (row.players_in||[]).map((id: any) => playerMap[id]).filter(Boolean)
                  const picksOut = (row.picks_out||[]).map((id: any) => pickMap[id]).filter(Boolean)
                  const picksIn = (row.picks_in||[]).map((id: any) => pickMap[id]).filter(Boolean)
                  const isInitiator = row.team_id === proposal.initiator_team
                  const key = proposal.id+row.team_id
                  return (
                    <div key={row.team_id} className="rounded-lg overflow-hidden" style={{border:'1px solid #e2dcd5'}}>
                      <div className="flex items-center gap-2 px-3 py-2" style={{background:'#f5f1eb'}}>
                        {team?.logo_url && <img src={team.logo_url} alt="" className="w-5 h-5 object-contain"/>}
                        <Link href={`/team/${row.team_id}`} className="hover:underline text-sm font-bold flex-1" style={{color:'#1a1512'}}>
                          {team?.name || row.team_id}
                        </Link>
                        {isInitiator && <span className="text-xs font-semibold" style={{color:'#8a8279'}}>({isPT?'proponente':'initiator'})</span>}
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={row.status==='accepted'?{background:'#0a2a10',color:'#4ade80'}:row.status==='rejected'?{background:'#2a0a0a',color:'#f87171'}:{background:'#fef3c7',color:'#b45309'}}>
                          {row.status==='accepted'?(isPT?'✅ Aceite':'✅ Accepted'):row.status==='rejected'?(isPT?'❌ Recusada':'❌ Rejected'):(isPT?'⏳ Pendente':'⏳ Pending')}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 px-3 py-2.5">
                        <div>
                          <div className="text-xs font-bold mb-1 uppercase" style={{color:'#dc2626'}}>{isPT?'Enviou':'Sent'}</div>
                          {playersOut.length===0 && picksOut.length===0 ? <div className="text-xs" style={{color:'#b0a89e'}}>{isPT?'Nada':'Nothing'}</div> : (
                            <div className="flex flex-col gap-0.5">
                              {playersOut.map((p: any) => <PlayerPreviewCard key={p.id} p={p} isPT={isPT} />)}
                              {picksOut.length>0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {picksOut.map((pk: any) => <PickChip key={pk.id} pk={pk} teamId={row.team_id} isPT={isPT} originalTeamName={teamInfoMap[pk.original_team_id]?.name} />)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold mb-1 uppercase" style={{color:'#15803d'}}>{isPT?'Recebeu':'Received'}</div>
                          {playersIn.length===0 && picksIn.length===0 ? <div className="text-xs" style={{color:'#b0a89e'}}>{isPT?'Nada':'Nothing'}</div> : (
                            <div className="flex flex-col gap-0.5">
                              {playersIn.map((p: any) => <PlayerPreviewCard key={p.id} p={p} isPT={isPT} />)}
                              {picksIn.length>0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {picksIn.map((pk: any) => <PickChip key={pk.id} pk={pk} teamId={row.team_id} isPT={isPT} originalTeamName={teamInfoMap[pk.original_team_id]?.name} />)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {!isInitiator && row.status==='pending' && (
                        <div className="flex gap-2 px-3 pb-3">
                          <button onClick={()=>respond(proposal.id, row.team_id, 'accept')} disabled={responding===key}
                            className="flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-40" style={{background:'#15803d',color:'#fff'}}>
                            {responding===key?(isPT?'A processar...':'Processing...'):`✅ ${isPT?'Aceitar por esta equipa':'Accept for this team'}`}
                          </button>
                          <button onClick={()=>respond(proposal.id, row.team_id, 'reject')} disabled={responding===key}
                            className="flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-40" style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5'}}>
                            ❌ {isPT?'Recusar por esta equipa':'Reject for this team'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

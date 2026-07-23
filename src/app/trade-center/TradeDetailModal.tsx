'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PlayerPreviewCard, PickChip, capFmt } from './PendingTradesPanel'

const STATUS_LABEL: Record<string, { pt: string, en: string, color: string, bg: string }> = {
  pending:  { pt: '⏳ Pendente', en: '⏳ Pending', color: '#b45309', bg: '#fef3c7' },
  accepted: { pt: '✅ Aceite', en: '✅ Accepted', color: '#15803d', bg: '#dcfce7' },
  rejected: { pt: '❌ Recusada', en: '❌ Rejected', color: '#dc2626', bg: '#fee2e2' },
}

// Full neutral ledger of a single trade proposal, by id, regardless of
// status or which team is viewing — used by the inbox's "Review Trade"
// link, which previously just sent every trade notification (including
// already-resolved ones) to the generic Trade Center browse page with no
// way to see what that specific trade actually contained.
export default function TradeDetailModal({ proposalId, isPT, onClose }: { proposalId: string, isPT: boolean, onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [proposal, setProposal] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [teamInfoMap, setTeamInfoMap] = useState<Record<string, any>>({})
  const [playerMap, setPlayerMap] = useState<Record<string, any>>({})
  const [pickMap, setPickMap] = useState<Record<string, any>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      const { data: prop } = await supabase.from('trade_proposals').select('*').eq('id', proposalId).single()
      if (!prop) { if (!cancelled) { setError(isPT ? 'Troca não encontrada.' : 'Trade not found.'); setLoading(false) } return }

      const { data: teamRows } = await supabase.from('trade_proposal_teams').select('*').eq('proposal_id', proposalId)
      const allRows = teamRows || []

      const { data: teamRecords } = await supabase.from('teams').select('id,name,logo_url,color')
        .in('id', allRows.map((t: any) => t.team_id))
      const tMap: Record<string, any> = {}
      for (const t of (teamRecords || [])) tMap[t.id] = t

      const allPlayerIds = Array.from(new Set(allRows.flatMap((t: any) => [...(t.players_out || []), ...(t.players_in || [])])))
      const allPickIds = Array.from(new Set(allRows.flatMap((t: any) => [...(t.picks_out || []), ...(t.picks_in || [])])))

      const { data: playersData } = allPlayerIds.length
        ? await supabase.from('players').select('id,name,pos,real_ovr,age,salary,photo_url,contract_years').in('id', allPlayerIds)
        : { data: [] }
      const pMap: Record<string, any> = {}
      for (const p of (playersData || [])) pMap[p.id] = p

      const { data: picksData } = allPickIds.length
        ? await supabase.from('draft_picks').select('id,season,round,protection,original_team_id').in('id', allPickIds)
        : { data: [] }
      const pkMap: Record<string, any> = {}
      for (const pk of (picksData || [])) pkMap[pk.id] = pk

      if (!cancelled) {
        setProposal(prop)
        setRows(allRows)
        setTeamInfoMap(tMap)
        setPlayerMap(pMap)
        setPickMap(pkMap)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [proposalId])

  const statusInfo = proposal ? (STATUS_LABEL[proposal.status] || STATUS_LABEL.pending) : null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,12,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fdfcfb', borderRadius: 14, maxWidth: 640, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #e2dcd5' }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: '#1a1512' }}>
            {isPT ? 'Detalhes da Troca' : 'Trade Details'}
          </div>
          {statusInfo && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: statusInfo.bg, color: statusInfo.color }}>
              {isPT ? statusInfo.pt : statusInfo.en}
            </span>
          )}
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 18, color: '#8a8279', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '16px 18px' }}>
          {loading && <div style={{ color: '#8a8279', fontSize: 13 }}>{isPT ? 'A carregar...' : 'Loading...'}</div>}
          {error && <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>}

          {!loading && !error && proposal && (
            <>
              {rows.length > 2 && (
                <div style={{ marginBottom: 14, padding: '6px 10px', borderRadius: 8, background: '#fef3c7', border: '1px solid #fcd34d', fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                  🔀 {isPT ? `Troca a ${rows.length} equipas` : `${rows.length}-team trade`}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {rows.map((row: any) => {
                  const team = teamInfoMap[row.team_id]
                  const playersOut = (row.players_out || []).map((id: any) => playerMap[id]).filter(Boolean)
                  const playersIn = (row.players_in || []).map((id: any) => playerMap[id]).filter(Boolean)
                  const picksOut = (row.picks_out || []).map((id: any) => pickMap[id]).filter(Boolean)
                  const picksIn = (row.picks_in || []).map((id: any) => pickMap[id]).filter(Boolean)
                  return (
                    <div key={row.team_id} style={{ border: '1px solid #e2dcd5', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f5f1eb' }}>
                        {team?.logo_url && <img src={team.logo_url} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
                        {team ? (
                          <Link href={`/team/${row.team_id}`} className="hover:underline" style={{ fontSize: 13, fontWeight: 700, color: '#1a1512' }}>{team.name}</Link>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1512' }}>{row.team_id}</span>
                        )}
                        {row.team_id === proposal.initiator_team && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#8a8279' }}>({isPT ? 'proponente' : 'initiator'})</span>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '10px 12px' }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', marginBottom: 4, textTransform: 'uppercase' }}>{isPT ? 'Enviou' : 'Sent'}</div>
                          {playersOut.length === 0 && picksOut.length === 0 ? <div style={{ fontSize: 11, color: '#b0a89e' }}>{isPT ? 'Nada' : 'Nothing'}</div> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {playersOut.map((p: any) => <PlayerPreviewCard key={p.id} p={p} isPT={isPT} />)}
                              {picksOut.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: playersOut.length ? 6 : 0 }}>
                                  {picksOut.map((pk: any) => <PickChip key={pk.id} pk={pk} teamId={row.team_id} isPT={isPT} originalTeamName={teamInfoMap[pk.original_team_id]?.name} />)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#15803d', marginBottom: 4, textTransform: 'uppercase' }}>{isPT ? 'Recebeu' : 'Received'}</div>
                          {playersIn.length === 0 && picksIn.length === 0 ? <div style={{ fontSize: 11, color: '#b0a89e' }}>{isPT ? 'Nada' : 'Nothing'}</div> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {playersIn.map((p: any) => <PlayerPreviewCard key={p.id} p={p} isPT={isPT} />)}
                              {picksIn.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: playersIn.length ? 6 : 0 }}>
                                  {picksIn.map((pk: any) => <PickChip key={pk.id} pk={pk} teamId={row.team_id} isPT={isPT} originalTeamName={teamInfoMap[pk.original_team_id]?.name} />)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ padding: '0 12px 8px', fontSize: 10, color: '#8a8279' }}>
                        {isPT ? 'Salário enviado' : 'Salary sent'}: {capFmt(row.salary_out)} · {isPT ? 'Salário recebido' : 'Salary received'}: {capFmt(row.salary_in)}
                      </div>
                    </div>
                  )
                })}
              </div>

              {proposal.notes && (
                <div style={{ marginTop: 14, padding: '8px 12px', background: '#f0ece5', borderRadius: 8, fontSize: 12, color: '#5c554e' }}>
                  "{proposal.notes}"
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

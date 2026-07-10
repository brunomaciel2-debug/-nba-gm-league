'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

function capFmt(n: number) { return n ? '$' + (n / 1000000).toFixed(2) + 'M' : '$0' }
function ovrColor(ovr: number) { return ovr>=85?'#b45309':ovr>=75?'#15803d':ovr>=65?'#1d4ed8':'#5c554e' }
function ovrBg(ovr: number) { return ovr>=85?'#fef3c7':ovr>=75?'#dcfce7':ovr>=65?'#dbeafe':'#f0ece5' }

function PlayerPreviewCard({ p, isPT }: { p: any, isPT: boolean }) {
  const ovr = p.real_ovr
  return (
    <a href={`/player/${p.id}`} className="no-underline" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderRadius: 8 }}>
      {p.photo_url
        ? <img src={p.photo_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #d4cdc5' }} />
        : <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: '#f0ece5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#8a8279' }}>
            {p.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1512', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ fontSize: 10, color: '#8a8279' }}>{p.pos}{p.age ? ` · ${p.age} ${isPT?'anos':'yo'}` : ''} · {capFmt(p.salary)}</div>
      </div>
      {ovr && (
        <div style={{ flexShrink: 0, textAlign: 'center', padding: '2px 6px', borderRadius: 6, background: ovrBg(ovr), border: `1px solid ${ovrColor(ovr)}44` }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: ovrColor(ovr), lineHeight: 1 }}>{ovr}</div>
          <div style={{ fontSize: 7, color: ovrColor(ovr) }}>OVR</div>
        </div>
      )}
    </a>
  )
}

function PickChip({ pk, teamId, isPT }: { pk: any, teamId: string, isPT: boolean }) {
  const isOwn = pk.original_team_id === teamId
  return (
    <div style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: '#f0ece5', border: '1px solid #d4cdc5', color: '#5c554e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {pk.season} R{pk.round}
      {!isOwn && <span style={{ color: '#b45309' }}>({isPT?'via':'via'} {pk.original_team_id})</span>}
      {pk.protection && pk.protection !== 'unprotected' && <span style={{ color: '#dc2626' }}>({pk.protection})</span>}
    </div>
  )
}

export default function PendingTradesPanel({ teamId }: { teamId: string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [proposals, setProposals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [responding, setResponding] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [msg, setMsg] = useState('')

  const loadProposals = async () => {
    setLoading(true)
    const { data: teamEntries } = await supabase
      .from('trade_proposal_teams')
      .select('*, trade_proposals(*)')
      .eq('team_id', teamId)

    const pending = (teamEntries || [])
      .filter((e: any) => e.trade_proposals?.status === 'pending' && e.trade_proposals?.initiator_team !== teamId)

    // Enrich with player names and other team info
    const enriched = await Promise.all(pending.map(async (entry: any) => {
      const proposal = entry.trade_proposals
      const { data: allTeams } = await supabase
        .from('trade_proposal_teams')
        .select('*')
        .eq('proposal_id', proposal.id)

      const initiatorEntry = allTeams?.find((t: any) => t.team_id === proposal.initiator_team)
      const { data: initiatorTeam } = await supabase.from('teams').select('name,logo_url,color').eq('id', proposal.initiator_team).single()

      const playersOutIds = entry.players_out || []
      const playersInIds = entry.players_in || []
      const picksOutIds = entry.picks_out || []
      const picksInIds = entry.picks_in || []
      const playerFields = 'id,name,pos,real_ovr,age,salary,photo_url'
      const { data: playersOut } = playersOutIds.length
        ? await supabase.from('players').select(playerFields).in('id', playersOutIds)
        : { data: [] }
      const { data: playersIn } = playersInIds.length
        ? await supabase.from('players').select(playerFields).in('id', playersInIds)
        : { data: [] }
      const pickFields = 'id,season,round,protection,original_team_id'
      const { data: picksOut } = picksOutIds.length
        ? await supabase.from('draft_picks').select(pickFields).in('id', picksOutIds)
        : { data: [] }
      const { data: picksIn } = picksInIds.length
        ? await supabase.from('draft_picks').select(pickFields).in('id', picksInIds)
        : { data: [] }

      return {
        ...entry,
        proposal,
        initiatorTeam,
        playersOut: playersOut || [],
        playersIn: playersIn || [],
        picksOut: picksOut || [],
        picksIn: picksIn || [],
      }
    }))

    setProposals(enriched)
    setLoading(false)
  }

  useEffect(() => { loadProposals() }, [teamId])

  const respond = async (proposalId: string, action: 'accept' | 'reject') => {
    setResponding(proposalId)
    setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT?'Não autenticado':'Not logged in'); setResponding(null); return }

    const res = await fetch('/api/trade/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ proposalId, action, reason: action === 'reject' ? rejectReason : undefined }),
    })
    const json = await res.json()
    if (res.ok) {
      setMsg(action === 'accept' ? (isPT?'✅ Troca aceite!':'✅ Trade accepted!') : (isPT?'✓ Troca recusada':'✓ Trade rejected'))
      await loadProposals()
    } else {
      setMsg(`❌ ${json.error}`)
    }
    setResponding(null)
    setRejectReason('')
  }

  if (loading) return <div style={{ padding: 20, color: '#8a8279', fontSize: 13 }}>{isPT?'A carregar trocas pendentes...':'Loading pending trades...'}</div>

  if (proposals.length === 0) return (
    <div style={{ padding: 20, textAlign: 'center', color: '#8a8279', fontSize: 13, background: '#faf8f5', border: '1px solid #d4cdc5', borderRadius: 12 }}>
      {isPT?'Sem propostas de troca pendentes.':'No pending trade proposals.'}
    </div>
  )

  return (
    <div>
      {msg && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: msg.startsWith('❌') ? '#fee2e2' : '#dcfce7', color: msg.startsWith('❌') ? '#dc2626' : '#15803d' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {proposals.map((entry: any) => {
          const proposal = entry.proposal
          const isExpanded = expanded === proposal.id
          return (
            <div key={proposal.id} style={{ borderRadius: 12, border: '1px solid #d4cdc5', overflow: 'hidden' }}>
              <div onClick={() => setExpanded(isExpanded ? null : proposal.id)}
                   style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#faf8f5', cursor: 'pointer' }}>
                {entry.initiatorTeam?.logo_url && <img src={entry.initiatorTeam.logo_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1512' }}>
                    {isPT ? `Proposta de troca de ${entry.initiatorTeam?.name || 'Equipa Desconhecida'}` : `Trade proposal from ${entry.initiatorTeam?.name || 'Unknown Team'}`}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a8279' }}>
                    {isPT
                      ? `Envias ${entry.playersOut.length} jogador${entry.playersOut.length !== 1 ? 'es' : ''}${entry.picksOut.length ? ` + ${entry.picksOut.length} escolha${entry.picksOut.length !== 1 ? 's' : ''}` : ''} · recebes ${entry.playersIn.length} jogador${entry.playersIn.length !== 1 ? 'es' : ''}${entry.picksIn.length ? ` + ${entry.picksIn.length} escolha${entry.picksIn.length !== 1 ? 's' : ''}` : ''}`
                      : `You send ${entry.playersOut.length} player${entry.playersOut.length !== 1 ? 's' : ''}${entry.picksOut.length ? ` + ${entry.picksOut.length} pick${entry.picksOut.length !== 1 ? 's' : ''}` : ''} · receive ${entry.playersIn.length} player${entry.playersIn.length !== 1 ? 's' : ''}${entry.picksIn.length ? ` + ${entry.picksIn.length} pick${entry.picksIn.length !== 1 ? 's' : ''}` : ''}`}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#8a8279' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {isExpanded && (
                <div style={{ padding: '14px 16px', background: '#fff', borderTop: '1px solid #e2dcd5' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase' }}>{isPT?'Envias':'You send'}</div>
                      {entry.playersOut.length === 0 && entry.picksOut.length === 0 ? <div style={{ fontSize: 12, color: '#b0a89e' }}>{isPT?'Nada':'Nothing'}</div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {entry.playersOut.map((p: any) => <PlayerPreviewCard key={p.id} p={p} isPT={isPT} />)}
                          {entry.picksOut.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: entry.playersOut.length ? 6 : 0 }}>
                              {entry.picksOut.map((pk: any) => <PickChip key={pk.id} pk={pk} teamId={teamId} isPT={isPT} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', marginBottom: 6, textTransform: 'uppercase' }}>{isPT?'Recebes':'You receive'}</div>
                      {entry.playersIn.length === 0 && entry.picksIn.length === 0 ? <div style={{ fontSize: 12, color: '#b0a89e' }}>{isPT?'Nada':'Nothing'}</div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {entry.playersIn.map((p: any) => <PlayerPreviewCard key={p.id} p={p} isPT={isPT} />)}
                          {entry.picksIn.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: entry.playersIn.length ? 6 : 0 }}>
                              {entry.picksIn.map((pk: any) => <PickChip key={pk.id} pk={pk} teamId={proposal.initiator_team} isPT={isPT} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {proposal.notes && (
                    <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f0ece5', borderRadius: 8, fontSize: 12, color: '#5c554e' }}>
                      "{proposal.notes}"
                    </div>
                  )}

                  <textarea
                    value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    placeholder={isPT?'Opcional: motivo para recusar...':'Optional: reason for rejecting...'}
                    rows={2}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12, border: '1px solid #d4cdc5', background: '#f5f1eb', color: '#1a1512', outline: 'none', marginBottom: 10, resize: 'none' }}
                  />

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => respond(proposal.id, 'accept')} disabled={responding === proposal.id}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#15803d', color: '#fff', border: 'none', cursor: 'pointer', opacity: responding === proposal.id ? 0.6 : 1 }}>
                      {responding === proposal.id ? (isPT?'A processar...':'Processing...') : (isPT?'✅ Aceitar Troca':'✅ Accept Trade')}
                    </button>
                    <button onClick={() => respond(proposal.id, 'reject')} disabled={responding === proposal.id}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer', opacity: responding === proposal.id ? 0.6 : 1 }}>
                      {isPT?'❌ Recusar':'❌ Reject'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

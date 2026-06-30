'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function capFmt(n: number) { return n ? '$' + (n / 1000000).toFixed(2) + 'M' : '$0' }

export default function PendingTradesPanel({ teamId }: { teamId: string }) {
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
      const { data: playersOut } = playersOutIds.length
        ? await supabase.from('players').select('id,name,salary').in('id', playersOutIds)
        : { data: [] }
      const { data: playersIn } = playersInIds.length
        ? await supabase.from('players').select('id,name,salary').in('id', playersInIds)
        : { data: [] }

      return {
        ...entry,
        proposal,
        initiatorTeam,
        playersOut: playersOut || [],
        playersIn: playersIn || [],
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
    if (!session) { setMsg('Not logged in'); setResponding(null); return }

    const res = await fetch('/api/trade/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ proposalId, action, reason: action === 'reject' ? rejectReason : undefined }),
    })
    const json = await res.json()
    if (res.ok) {
      setMsg(action === 'accept' ? '✅ Trade accepted!' : '✓ Trade rejected')
      await loadProposals()
    } else {
      setMsg(`❌ ${json.error}`)
    }
    setResponding(null)
    setRejectReason('')
  }

  if (loading) return <div style={{ padding: 20, color: '#8a8279', fontSize: 13 }}>Loading pending trades...</div>

  if (proposals.length === 0) return (
    <div style={{ padding: 20, textAlign: 'center', color: '#8a8279', fontSize: 13, background: '#faf8f5', border: '1px solid #d4cdc5', borderRadius: 12 }}>
      No pending trade proposals.
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
                    Trade proposal from {entry.initiatorTeam?.name || 'Unknown Team'}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a8279' }}>
                    You send {entry.playersOut.length} player{entry.playersOut.length !== 1 ? 's' : ''} · receive {entry.playersIn.length} player{entry.playersIn.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#8a8279' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {isExpanded && (
                <div style={{ padding: '14px 16px', background: '#fff', borderTop: '1px solid #e2dcd5' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase' }}>You send</div>
                      {entry.playersOut.length === 0 ? <div style={{ fontSize: 12, color: '#b0a89e' }}>No players</div> :
                        entry.playersOut.map((p: any) => (
                          <div key={p.id} style={{ fontSize: 12, color: '#1a1512', marginBottom: 3 }}>{p.name} <span style={{ color: '#8a8279' }}>({capFmt(p.salary)})</span></div>
                        ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', marginBottom: 6, textTransform: 'uppercase' }}>You receive</div>
                      {entry.playersIn.length === 0 ? <div style={{ fontSize: 12, color: '#b0a89e' }}>No players</div> :
                        entry.playersIn.map((p: any) => (
                          <div key={p.id} style={{ fontSize: 12, color: '#1a1512', marginBottom: 3 }}>{p.name} <span style={{ color: '#8a8279' }}>({capFmt(p.salary)})</span></div>
                        ))}
                    </div>
                  </div>

                  {proposal.notes && (
                    <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f0ece5', borderRadius: 8, fontSize: 12, color: '#5c554e' }}>
                      "{proposal.notes}"
                    </div>
                  )}

                  <textarea
                    value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    placeholder="Optional: reason for rejecting..."
                    rows={2}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12, border: '1px solid #d4cdc5', background: '#f5f1eb', color: '#1a1512', outline: 'none', marginBottom: 10, resize: 'none' }}
                  />

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => respond(proposal.id, 'accept')} disabled={responding === proposal.id}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#15803d', color: '#fff', border: 'none', cursor: 'pointer', opacity: responding === proposal.id ? 0.6 : 1 }}>
                      {responding === proposal.id ? 'Processing...' : '✅ Accept Trade'}
                    </button>
                    <button onClick={() => respond(proposal.id, 'reject')} disabled={responding === proposal.id}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer', opacity: responding === proposal.id ? 0.6 : 1 }}>
                      ❌ Reject
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

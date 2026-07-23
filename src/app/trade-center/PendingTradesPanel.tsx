'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import { MIN_ROSTER, MAX_ROSTER, isFreeAgencyWindow } from '@/lib/roster-limits'

const CAP_LIMIT = 180_000_000

export function capFmt(n: number) { return n ? '$' + (n / 1000000).toFixed(2) + 'M' : '$0' }
function ovrColor(ovr: number) { return ovr>=85?'#b45309':ovr>=75?'#15803d':ovr>=65?'#1d4ed8':'#5c554e' }
function ovrBg(ovr: number) { return ovr>=85?'#fef3c7':ovr>=75?'#dcfce7':ovr>=65?'#dbeafe':'#f0ece5' }

export function PlayerPreviewCard({ p, isPT, fromLabel, fromTeamId }: { p: any, isPT: boolean, fromLabel?: string, fromTeamId?: string }) {
  const ovr = p.real_ovr
  return (
    <div>
      {fromLabel && (
        <div style={{ fontSize: 9, fontWeight: 700, color: '#b45309', marginLeft: 42, marginBottom: -2 }}>
          {isPT?'de':'from'} {fromTeamId ? <Link href={`/team/${fromTeamId}`} className="hover:underline" style={{color:'inherit'}}>{fromLabel}</Link> : fromLabel}
        </div>
      )}
      <a href={`/player/${p.id}`} className="no-underline" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderRadius: 8 }}>
        {p.photo_url
          ? <img src={p.photo_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #d4cdc5' }} />
          : <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: '#f0ece5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#8a8279' }}>
              {p.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
            </div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1512', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
          <div style={{ fontSize: 10, color: '#8a8279' }}>
            {p.pos}{p.age ? ` · ${p.age} ${isPT?'anos':'yo'}` : ''} · {capFmt(p.salary)}
            {p.contract_years != null && ` · ${p.contract_years} ${isPT ? (p.contract_years===1?'ano restante':'anos restantes') : (p.contract_years===1?'yr left':'yrs left')}`}
          </div>
        </div>
        {ovr && (
          <div style={{ flexShrink: 0, textAlign: 'center', padding: '2px 6px', borderRadius: 6, background: ovrBg(ovr), border: `1px solid ${ovrColor(ovr)}44` }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: ovrColor(ovr), lineHeight: 1 }}>{ovr}</div>
            <div style={{ fontSize: 7, color: ovrColor(ovr) }}>OVR</div>
          </div>
        )}
      </a>
    </div>
  )
}

export function PickChip({ pk, teamId, isPT, fromLabel, fromTeamId, originalTeamName }: { pk: any, teamId: string, isPT: boolean, fromLabel?: string, fromTeamId?: string, originalTeamName?: string }) {
  const isOwn = pk.original_team_id === teamId
  return (
    <div>
      {fromLabel && (
        <div style={{ fontSize: 9, fontWeight: 700, color: '#b45309', marginBottom: 2 }}>
          {isPT?'de':'from'} {fromTeamId ? <Link href={`/team/${fromTeamId}`} className="hover:underline" style={{color:'inherit'}}>{fromLabel}</Link> : fromLabel}
        </div>
      )}
      <div style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: '#f0ece5', border: '1px solid #d4cdc5', color: '#5c554e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {pk.season} R{pk.round}
        {!isOwn && (
          <span style={{ color: '#b45309' }}>
            ({isPT?'via':'via'} <Link href={`/team/${pk.original_team_id}`} className="hover:underline" style={{color:'inherit'}}>{originalTeamName || pk.original_team_id}</Link>)
          </span>
        )}
        {pk.protection && pk.protection !== 'unprotected' && <span style={{ color: '#dc2626' }}>({pk.protection})</span>}
      </div>
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

    // My own current cap/roster state, to preview the real impact of accepting.
    const { data: myTeamRow } = await supabase.from('teams').select('cap_used').eq('id', teamId).single()
    const { count: myRosterCount } = await supabase.from('players').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'active')
    const fAWindow = await isFreeAgencyWindow(supabase)

    // Enrich with player names and other team info
    const enriched = await Promise.all(pending.map(async (entry: any) => {
      const proposal = entry.trade_proposals
      const { data: allTeamRows } = await supabase
        .from('trade_proposal_teams')
        .select('*')
        .eq('proposal_id', proposal.id)
      const isMultiTeam = (allTeamRows?.length || 0) > 2

      const { data: teamRecords } = await supabase.from('teams').select('id,name,logo_url,color')
        .in('id', (allTeamRows || []).map((t: any) => t.team_id))
      const teamInfoMap: Record<string, any> = {}
      for (const t of (teamRecords || [])) teamInfoMap[t.id] = t
      const initiatorTeam = teamInfoMap[proposal.initiator_team]

      // Per-team consensus (3+ team trades stay overall "pending" until every
      // non-initiator team has accepted) — figure out who's still holding it up.
      const waitingOnTeams = (allTeamRows || [])
        .filter((t: any) => t.team_id !== teamId && t.status === 'pending')
        .map((t: any) => ({ id: t.team_id, name: teamInfoMap[t.team_id]?.name || t.team_id }))

      // For a 3+ team trade, figure out which OTHER team each of my incoming
      // assets actually came from — not necessarily the initiator.
      const sourceOf = (assetId: string, key: 'players_out' | 'picks_out') =>
        (allTeamRows || []).find((t: any) => t.team_id !== teamId && (t[key] || []).includes(assetId))?.team_id

      const playersOutIds = entry.players_out || []
      const playersInIds = entry.players_in || []
      const picksOutIds = entry.picks_out || []
      const picksInIds = entry.picks_in || []
      const playerFields = 'id,name,pos,real_ovr,age,salary,photo_url,contract_years'
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

      const capAfter = (myTeamRow?.cap_used || 0) - (entry.salary_out || 0) + (entry.salary_in || 0)
      const rosterAfter = (myRosterCount || 0) - playersOutIds.length + playersInIds.length

      return {
        ...entry,
        proposal,
        initiatorTeam,
        teamInfoMap,
        isMultiTeam,
        playersOut: (playersOut || []).map((p: any) => ({ ...p, fromLabel: undefined })),
        playersIn: (playersIn || []).map((p: any) => {
          const srcId = sourceOf(String(p.id), 'players_out')
          return { ...p, fromLabel: isMultiTeam ? teamInfoMap[srcId]?.name : undefined, fromTeamId: srcId || proposal.initiator_team }
        }),
        picksOut: (picksOut || []).map((pk: any) => ({ ...pk, fromLabel: undefined })),
        picksIn: (picksIn || []).map((pk: any) => {
          const srcId = sourceOf(String(pk.id), 'picks_out')
          return { ...pk, fromLabel: isMultiTeam ? teamInfoMap[srcId]?.name : undefined, sourceTeamId: srcId || proposal.initiator_team }
        }),
        capAfter,
        rosterAfter,
        capOver: capAfter > CAP_LIMIT,
        rosterBad: rosterAfter > MAX_ROSTER || rosterAfter < MIN_ROSTER,
        myStatus: entry.status || 'pending',
        waitingOnTeams,
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
                    {entry.initiatorTeam ? (
                      <>
                        {isPT ? 'Proposta de troca de ' : 'Trade proposal from '}
                        <Link href={`/team/${proposal.initiator_team}`} className="hover:underline" style={{color:'inherit'}} onClick={e => e.stopPropagation()}>{entry.initiatorTeam.name}</Link>
                      </>
                    ) : (
                      isPT ? 'Proposta de troca de Equipa Desconhecida' : 'Trade proposal from Unknown Team'
                    )}
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
                  {entry.isMultiTeam && (
                    <div style={{ marginBottom: 12, padding: '6px 10px', borderRadius: 8, background: '#fef3c7', border: '1px solid #fcd34d', fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                      🔀 {isPT ? 'Troca a 3 equipas — as peças abaixo mostram de que equipa vêm exatamente.' : '3-team trade — pieces below show exactly which team they come from.'}
                    </div>
                  )}

                  {entry.myStatus === 'accepted' && entry.waitingOnTeams.length > 0 && (
                    <div style={{ marginBottom: 12, padding: '6px 10px', borderRadius: 8, background: '#dbeafe', border: '1px solid #93c5fd', fontSize: 11, color: '#1d4ed8', fontWeight: 600 }}>
                      ⏳ {isPT ? 'Já aceitaste. Esta troca só se realiza quando todas as equipas aceitarem — ainda à espera de: ' : "You've already accepted. This trade only goes through once every team involved accepts — still waiting on: "}
                      {entry.waitingOnTeams.map((wt: any, i: number) => (
                        <span key={wt.id}>
                          {i > 0 && ', '}
                          <Link href={`/team/${wt.id}`} className="hover:underline" style={{color:'inherit'}}>{wt.name}</Link>
                        </span>
                      ))}.
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase' }}>{isPT?'Envias':'You send'}</div>
                      {entry.playersOut.length === 0 && entry.picksOut.length === 0 ? <div style={{ fontSize: 12, color: '#b0a89e' }}>{isPT?'Nada':'Nothing'}</div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {entry.playersOut.map((p: any) => <PlayerPreviewCard key={p.id} p={p} isPT={isPT} />)}
                          {entry.picksOut.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: entry.playersOut.length ? 6 : 0 }}>
                              {entry.picksOut.map((pk: any) => <PickChip key={pk.id} pk={pk} teamId={teamId} isPT={isPT} originalTeamName={entry.teamInfoMap[pk.original_team_id]?.name} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', marginBottom: 6, textTransform: 'uppercase' }}>{isPT?'Recebes':'You receive'}</div>
                      {entry.playersIn.length === 0 && entry.picksIn.length === 0 ? <div style={{ fontSize: 12, color: '#b0a89e' }}>{isPT?'Nada':'Nothing'}</div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {entry.playersIn.map((p: any) => <PlayerPreviewCard key={p.id} p={p} isPT={isPT} fromLabel={p.fromLabel} fromTeamId={p.fromTeamId} />)}
                          {entry.picksIn.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: entry.playersIn.length ? 6 : 0 }}>
                              {entry.picksIn.map((pk: any) => <PickChip key={pk.id} pk={pk} teamId={proposal.initiator_team} isPT={isPT} fromLabel={pk.fromLabel} fromTeamId={pk.sourceTeamId} originalTeamName={entry.teamInfoMap[pk.original_team_id]?.name} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div style={{ padding: '8px 10px', borderRadius: 8, background: entry.capOver ? '#fee2e2' : '#f0ece5', border: `1px solid ${entry.capOver ? '#fca5a5' : '#d4cdc5'}` }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#8a8279', textTransform: 'uppercase' }}>{isPT?'O teu tecto depois de aceitar':'Your cap after accepting'}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: entry.capOver ? '#dc2626' : '#1a1512' }}>{capFmt(entry.capAfter)} {entry.capOver ? (isPT?'❌ acima do tecto!':'❌ over the cap!') : '✓'}</div>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: 8, background: entry.rosterBad ? '#fee2e2' : '#f0ece5', border: `1px solid ${entry.rosterBad ? '#fca5a5' : '#d4cdc5'}` }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#8a8279', textTransform: 'uppercase' }}>{isPT?'O teu plantel depois de aceitar':'Your roster after accepting'}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: entry.rosterBad ? '#dc2626' : '#1a1512' }}>{entry.rosterAfter} {isPT?'jogadores':'players'} {entry.rosterBad ? (isPT?`❌ fora de ${MIN_ROSTER}-${MAX_ROSTER}`:`❌ outside ${MIN_ROSTER}-${MAX_ROSTER}`) : '✓'}</div>
                    </div>
                  </div>

                  {proposal.notes && (
                    <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f0ece5', borderRadius: 8, fontSize: 12, color: '#5c554e' }}>
                      "{proposal.notes}"
                    </div>
                  )}

                  {entry.myStatus === 'pending' ? (
                    <>
                      <textarea
                        value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder={isPT?'Opcional: motivo para recusar...':'Optional: reason for rejecting...'}
                        rows={2}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12, border: '1px solid #d4cdc5', background: '#f5f1eb', color: '#1a1512', outline: 'none', marginBottom: 10, resize: 'none' }}
                      />

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => respond(proposal.id, 'accept')} disabled={responding === proposal.id || entry.capOver || entry.rosterBad}
                          title={entry.capOver || entry.rosterBad ? (isPT?'Não podes aceitar — violaria o tecto ou o limite de plantel':'Cannot accept — would violate the cap or roster limit') : undefined}
                          style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, background: (entry.capOver || entry.rosterBad) ? '#e2dcd5' : '#15803d', color: (entry.capOver || entry.rosterBad) ? '#8a8279' : '#fff', border: 'none', cursor: (entry.capOver || entry.rosterBad) ? 'not-allowed' : 'pointer', opacity: responding === proposal.id ? 0.6 : 1 }}>
                          {responding === proposal.id ? (isPT?'A processar...':'Processing...') : (entry.capOver || entry.rosterBad) ? (isPT?'🚫 Não pode ser aceite':'🚫 Cannot be accepted') : (isPT?'✅ Aceitar Troca':'✅ Accept Trade')}
                        </button>
                        <button onClick={() => respond(proposal.id, 'reject')} disabled={responding === proposal.id}
                          style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer', opacity: responding === proposal.id ? 0.6 : 1 }}>
                          {isPT?'❌ Recusar':'❌ Reject'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '9px 0', textAlign: 'center', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#f0ece5', color: '#5c554e' }}>
                      {isPT?'✅ Já respondeste a esta troca.':'✅ You already responded to this trade.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

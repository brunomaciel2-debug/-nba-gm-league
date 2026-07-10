'use client'
import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/I18nProvider'
import { getStatusForWeek } from '@/lib/season-week-helper'
import { MIN_ROSTER, MAX_ROSTER } from '@/lib/roster-limits'
import { buildTradeTeamRows, TradeAssetSend, TradeTeamRow } from '@/lib/trade-builder'

const CAP_LIMIT = 180_000_000

function toggleAsset(
  ids: string[], setIds: (fn: (p: string[]) => string[]) => void,
  setDest: (fn: (p: Record<string, string>) => Record<string, string>) => void,
  id: string, defaultDest: string
) {
  if (ids.includes(id)) {
    setIds(p => p.filter(x => x !== id))
    setDest(p => { const n = { ...p }; delete n[id]; return n })
  } else {
    setIds(p => [...p, id])
    setDest(p => ({ ...p, [id]: defaultDest }))
  }
}
const capFmt = (n: number) => n >= 1000000 ? '$' + (n / 1000000).toFixed(2) + 'M' : n ? '$' + n.toLocaleString() : '$0'

function PlayerPickPanel({
  label, teamInfo, players, picks, allTeams,
  selPlayers, selPicks, onTogglePlayer, onTogglePick,
  isMyTeam = false, onSelectTeam, capAfter, isPT
}: {
  label: string, teamInfo: any, players: any[], picks: any[], allTeams: any[],
  selPlayers: string[], selPicks: string[], onTogglePlayer: (id: string) => void,
  onTogglePick: (id: string) => void, isMyTeam?: boolean, onSelectTeam?: (id: string) => void,
  capAfter?: number, isPT: boolean
}) {
  const tc = teamInfo ? readableTeamColor(teamInfo.color) : '#5c554e'
  const totalSalary = players.filter(p => selPlayers.includes(p.id)).reduce((s, p) => s + (p.salary || 0), 0)
  const overCap = capAfter !== undefined && capAfter > CAP_LIMIT

  return (
    <div className="rounded-xl overflow-hidden flex flex-col"
         style={{ border: '1px solid ' + (overCap ? '#fca5a5' : teamInfo ? tc + '44' : '#d4cdc5'), borderTop: '3px solid ' + (overCap ? '#dc2626' : teamInfo ? tc : '#d4cdc5') }}>
      <div className="px-4 py-3" style={{ background: '#ddd7ca', borderBottom: '1px solid #3a3228' }}>
        {isMyTeam ? (
          <div className="flex items-center gap-2">
            {teamInfo?.logo_url && <img src={teamInfo.logo_url} alt="" className="w-6 h-6 object-contain" />}
            <span className="font-bold" style={{ color: tc }}>{teamInfo?.name || (isPT ? 'A Tua Equipa' : 'Your Team')}</span>
            <span className="text-xs ml-2" style={{ color: '#5c554e' }}>{isPT ? 'envia →' : 'sends →'}</span>
          </div>
        ) : (
          <div>
            <div className="text-xs mb-2" style={{ color: '#5c554e' }}>{label} — {isPT ? 'escolhe a equipa:' : 'select team:'}</div>
            <select onChange={e => onSelectTeam?.(e.target.value)} value={teamInfo?.id || ''}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: '#ede8de', border: '1px solid #3a3228', color: '#1a1612' }}>
              <option value="">{isPT ? '— Escolhe uma equipa —' : '— Choose team —'}</option>
              {allTeams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        {/* Cap after trade indicator */}
        {teamInfo && capAfter !== undefined && (
          <div style={{
            marginTop:6, fontSize:11, fontWeight:600,
            color: overCap ? '#dc2626' : '#15803d',
          }}>
            {isPT ? 'Cap após a troca' : 'Cap after trade'}: {capFmt(capAfter)} {overCap ? (isPT ? '❌ Acima do cap!' : '❌ Over cap!') : '✓'}
          </div>
        )}
      </div>

      {teamInfo && (
        <div className="flex-1 overflow-y-auto p-3" style={{ background: '#ede8de', maxHeight: 420 }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#5c554e' }}>{isPT ? 'Jogadores' : 'Players'}</div>
          {players.length === 0 && <p className="text-xs mb-3" style={{ color: '#a89f97' }}>{isPT ? 'Nenhum jogador encontrado.' : 'No players found.'}</p>}
          {players.map((p: any) => {
            const isSel = selPlayers.includes(p.id)
            return (
              <button key={p.id} onClick={() => onTogglePlayer(p.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-1 text-left transition-all"
                style={{ background: isSel ? tc + '22' : '#faf8f5', border: '1px solid ' + (isSel ? tc + '66' : '#d4cdc5') }}>
                <span className="text-xs w-7 flex-shrink-0" style={{ color: '#5c554e' }}>{p.pos}</span>
                <span className="text-sm flex-1 font-semibold" style={{ color: isSel ? '#e8e2d6' : '#2d2722' }}>{p.name}</span>
                <span className="text-xs font-semibold" style={{ color: isSel ? tc : '#5c554e' }}>{capFmt(p.salary)}</span>
                {isSel && <span className="text-sm flex-shrink-0" style={{ color: tc }}>✓</span>}
              </button>
            )
          })}
          <div className="text-xs font-semibold uppercase tracking-wider mb-2 mt-4" style={{ color: '#5c554e' }}>{isPT ? 'Escolhas de Draft' : 'Draft Picks'}</div>
          {picks.length === 0 && <p className="text-xs" style={{ color: '#a89f97' }}>{isPT ? 'Nenhuma escolha disponível.' : 'No picks available.'}</p>}
          <div className="flex flex-wrap gap-2">
            {picks.map((pk: any) => {
              const isSel = selPicks.includes(pk.id)
              const isOwn = pk.original_team_id === teamInfo?.id
              return (
                <button key={pk.id} onClick={() => onTogglePick(pk.id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                  style={{ background: isSel ? tc + '33' : '#faf8f5', border: '1px solid ' + (isSel ? tc : '#d4cdc5'), color: isSel ? tc : '#5c554e' }}>
                  {pk.season} R{pk.round}
                  {!isOwn && <span className="ml-1" style={{ color: '#b45309' }}>({isPT ? 'via' : 'via'} {pk.original_team_id})</span>}
                  {pk.protection !== 'unprotected' && <span className="ml-1" style={{ color: '#dc2626' }}>({pk.protection})</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {teamInfo && (
        <div className="px-4 py-2.5 flex items-center justify-between"
             style={{ background: '#ddd7ca', borderTop: '1px solid #3a3228' }}>
          <span className="text-xs" style={{ color: '#5c554e' }}>
            {selPlayers.length} {isPT ? 'jogador'+(selPlayers.length !== 1 ? 'es' : '') : 'player'+(selPlayers.length !== 1 ? 's' : '')} · {selPicks.length} {isPT ? 'escolha'+(selPicks.length !== 1 ? 's' : '') : 'pick'+(selPicks.length !== 1 ? 's' : '')}
          </span>
          <span className="font-bold text-sm" style={{ color: tc }}>{capFmt(totalSalary)}</span>
        </div>
      )}
    </div>
  )
}

function ProposeTradePage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const { user, profile } = useAuth()
  const router = useRouter()

  const [allTeams,    setAllTeams]    = useState<any[]>([])
  const [myPlayers,   setMyPlayers]   = useState<any[]>([])
  const [myPicks,     setMyPicks]     = useState<any[]>([])
  const [myTeam,      setMyTeam]      = useState<any>(null)
  const [team2Id,     setTeam2Id]     = useState('')
  const [team2,       setTeam2]       = useState<any>(null)
  const [t2Players,   setT2Players]   = useState<any[]>([])
  const [t2Picks,     setT2Picks]     = useState<any[]>([])
  const [show3,       setShow3]       = useState(false)
  const [team3Id,     setTeam3Id]     = useState('')
  const [team3,       setTeam3]       = useState<any>(null)
  const [t3Players,   setT3Players]   = useState<any[]>([])
  const [t3Picks,     setT3Picks]     = useState<any[]>([])
  const [mySend,      setMySend]      = useState<string[]>([])
  const [myPicksSend, setMyPicksSend] = useState<string[]>([])
  const [t2Recv,      setT2Recv]      = useState<string[]>([])
  const [t2PicksRecv, setT2PicksRecv] = useState<string[]>([])
  const [t3Recv,      setT3Recv]      = useState<string[]>([])
  const [t3PicksRecv, setT3PicksRecv] = useState<string[]>([])
  // Destination team for each selected asset — only meaningful with a 3rd
  // team in the trade. Defaults preserve the old 2-team routing (mine -> team2,
  // team2's/team3's -> me) so nothing changes unless the GM explicitly redirects.
  const [mySendDest,  setMySendDest]  = useState<Record<string,string>>({})
  const [t2SendDest,  setT2SendDest]  = useState<Record<string,string>>({})
  const [t3SendDest,  setT3SendDest]  = useState<Record<string,string>>({})
  const [notes,       setNotes]       = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [commTeamId,  setCommTeamId]  = useState('')
  const [isFAWindow,  setIsFAWindow]  = useState(false)

  useEffect(() => {
    supabase.from('season_config').select('current_week').eq('id', 1).single()
      .then(({ data: cfg }) => setIsFAWindow(getStatusForWeek((cfg?.current_week || 0) + 1) === 'free-agency'))
  }, [])

  const myTeamId = profile?.team_id
  const isCommissioner = profile?.role === 'commissioner'
  const effectiveTeamId = myTeamId || (isCommissioner ? commTeamId : '')

  useEffect(() => {
    supabase.from('teams').select('*').not('id','in','(ALL,RVS)').order('name')
      .then(({data}) => { if(data) setAllTeams(data) })
  }, [])

  useEffect(() => {
    if (!effectiveTeamId) return
    Promise.all([
      supabase.from('players').select('id,name,pos,salary,usage').eq('team_id', effectiveTeamId).eq('status', 'active').order('usage', { ascending: false }),
      supabase.from('draft_picks').select('*').eq('team_id', effectiveTeamId).order('season').order('round'),
      supabase.from('teams').select('*').eq('id', effectiveTeamId).single(),
    ]).then(([{ data: ps }, { data: picks }, { data: mt }]) => {
      setMyPlayers(ps || [])
      setMyPicks(picks || [])
      setMyTeam(mt)
    })
  }, [effectiveTeamId])

  useEffect(() => {
    if (!team2Id) return
    Promise.all([
      supabase.from('players').select('id,name,pos,salary,usage').eq('team_id', team2Id).eq('status', 'active').order('usage', { ascending: false }),
      supabase.from('draft_picks').select('*').eq('team_id', team2Id).order('season').order('round'),
      supabase.from('teams').select('*').eq('id', team2Id).single(),
    ]).then(([{ data: ps }, { data: picks }, { data: t }]) => {
      setT2Players(ps || []); setT2Picks(picks || []); setTeam2(t)
      setT2Recv([]); setT2PicksRecv([])
    })
  }, [team2Id])

  useEffect(() => {
    if (!team3Id) return
    Promise.all([
      supabase.from('players').select('id,name,pos,salary,usage').eq('team_id', team3Id).eq('status', 'active').order('usage', { ascending: false }),
      supabase.from('draft_picks').select('*').eq('team_id', team3Id).order('season').order('round'),
      supabase.from('teams').select('*').eq('id', team3Id).single(),
    ]).then(([{ data: ps }, { data: picks }, { data: t }]) => {
      setT3Players(ps || []); setT3Picks(picks || []); setTeam3(t)
      setT3Recv([]); setT3PicksRecv([])
    })
  }, [team3Id])

  // ── Trade routing: who sends what, and where each piece goes ──────────
  // buildTradeTeamRows generalizes 2-team and 3-team trades the same way —
  // every asset just has a destination team, defaulting to the old 2-team
  // routing unless explicitly redirected via the Routing section below.
  const sends: TradeAssetSend[] = [
    { fromTeam: effectiveTeamId, players: mySend, picks: myPicksSend,
      playerSalaries: Object.fromEntries(myPlayers.map(p => [p.id, p.salary || 0])),
      destinations: mySendDest, defaultDest: team2Id },
    { fromTeam: team2Id, players: t2Recv, picks: t2PicksRecv,
      playerSalaries: Object.fromEntries(t2Players.map(p => [p.id, p.salary || 0])),
      destinations: t2SendDest, defaultDest: effectiveTeamId },
  ]
  if (team3Id) sends.push({
    fromTeam: team3Id, players: t3Recv, picks: t3PicksRecv,
    playerSalaries: Object.fromEntries(t3Players.map(p => [p.id, p.salary || 0])),
    destinations: t3SendDest, defaultDest: effectiveTeamId,
  })
  const tradeRows: TradeTeamRow[] = buildTradeTeamRows(sends)
  const rowFor = (teamId: string) => tradeRows.find(r => r.team_id === teamId)

  const myRow = rowFor(effectiveTeamId)
  const mySalarySent = myRow?.salary_out || 0

  const myCapUsed = myPlayers.reduce((s, p) => s + (p.salary || 0), 0)
  const t2CapUsed = t2Players.reduce((s, p) => s + (p.salary || 0), 0)
  const t3CapUsed = t3Players.reduce((s, p) => s + (p.salary || 0), 0)
  const capAfterFor = (teamId: string, capUsed: number) => {
    const row = rowFor(teamId)
    return capUsed - (row?.salary_out || 0) + (row?.salary_in || 0)
  }
  const myCapAfter = capAfterFor(effectiveTeamId, myCapUsed)
  const t2CapAfter = team2 ? capAfterFor(team2Id, t2CapUsed) : undefined
  const t3CapAfter = team3 ? capAfterFor(team3Id, t3CapUsed) : undefined

  const myOverCap = myCapAfter > CAP_LIMIT
  const t2OverCap = !!team2 && !!t2CapAfter && t2CapAfter > CAP_LIMIT
  const t3OverCap = !!team3 && !!t3CapAfter && t3CapAfter > CAP_LIMIT

  const rosterAfterFor = (teamId: string, currentCount: number) => {
    const row = rowFor(teamId)
    return currentCount - (row?.players_out.length || 0) + (row?.players_in.length || 0)
  }
  const myRosterAfter = rosterAfterFor(effectiveTeamId, myPlayers.length)
  const t2RosterAfter = team2 ? rosterAfterFor(team2Id, t2Players.length) : undefined
  const t3RosterAfter = team3 ? rosterAfterFor(team3Id, t3Players.length) : undefined
  const rosterBad = (after?: number) => after !== undefined && (after > MAX_ROSTER || (after < MIN_ROSTER && !isFAWindow))
  const myRosterBad = rosterBad(myRosterAfter)
  const t2RosterBad = rosterBad(t2RosterAfter)
  const t3RosterBad = rosterBad(t3RosterAfter)

  const totalIn = myRow?.salary_in || 0
  const totalOut = mySalarySent
  const diff     = Math.abs(totalOut - totalIn)
  const maxDiff  = Math.max(totalOut, totalIn) * 0.15 + 1000000
  const hasPlayers = (mySend.length + myPicksSend.length > 0) && (t2Recv.length + t2PicksRecv.length > 0 || t3Recv.length + t3PicksRecv.length > 0)
  const salaryValid = totalOut === 0 && totalIn === 0 ? true : diff <= maxDiff
  const capValid = !myOverCap && !t2OverCap && !t3OverCap
  const rosterValid = !myRosterBad && !t2RosterBad && !t3RosterBad
  const isValid = hasPlayers && salaryValid && capValid && rosterValid

  const submitTrade = async () => {
    if (!user || !effectiveTeamId || !team2Id || !isValid) return
    setSubmitting(true)
    setSubmitError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSubmitting(false); setSubmitError('Not logged in'); return }

    const res = await fetch('/api/trade/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ initiatorTeamId: effectiveTeamId, notes, teams: tradeRows }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (res.ok) { setSubmitted(true) } else { setSubmitError(json.error || 'Failed to submit trade proposal') }
  }

  if (!user) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <p className="mb-4" style={{ color: '#5c554e' }}>{isPT ? 'Inicia sessão para propores uma troca.' : 'Sign in to propose a trade.'}</p>
      <a href="/login" className="px-4 py-2 rounded-lg text-sm font-bold no-underline" style={{ background: '#1d4ed8', color: '#e8e2d6' }}>{isPT ? 'Iniciar Sessão' : 'Sign In'}</a>
    </div>
  )

  if (isCommissioner && !commTeamId) return (
    <div className="max-w-md mx-auto px-4 py-12">
      <a href="/trade-center" className="text-xs no-underline mb-4 block" style={{color:'#6b5f4e'}}>← {isPT ? 'Centro de Trocas' : 'Trade Center'}</a>
      <h2 className="text-lg font-bold mb-4" style={{color:'#1a1612'}}>{isPT ? 'Comissário — Escolhe a Equipa para Propor Como' : 'Commissioner — Select Team to Propose As'}</h2>
      <select onChange={e=>setCommTeamId(e.target.value)} defaultValue=""
        className="w-full text-sm px-3 py-3 rounded-xl outline-none"
        style={{background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1612'}}>
        <option value="">{isPT ? '— Escolhe uma equipa —' : '— Choose a team —'}</option>
        {allTeams.map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
  )

  if (submitted) return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#1a1612' }}>{isPT ? 'Proposta de Troca Enviada!' : 'Trade Proposal Sent!'}</h2>
      <p className="mb-6" style={{ color: '#5c554e' }}>{isPT ? 'O(s) GM(s) receberam uma notificação e podem aceitar, recusar ou fazer contraproposta.' : 'The GM(s) received a notification and can accept, reject or counter.'}</p>
      <a href="/trade-center" className="px-4 py-2 rounded-lg text-sm font-bold no-underline" style={{ background: '#1d4ed8', color: '#e8e2d6' }}>← {isPT ? 'Voltar' : 'Back'}</a>
    </div>
  )

  const tc2 = team2 ? readableTeamColor(team2.color) : '#5c554e'

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <a href="/trade-center" className="text-xs no-underline" style={{ color: '#5c554e' }}>← {isPT ? 'Centro de Trocas' : 'Trade Center'}</a>
        <h1 className="text-xl font-bold" style={{ color: '#1a1612' }}>🔄 {isPT ? 'Propor Troca' : 'Propose Trade'}</h1>
      </div>

      <div className={`grid gap-4 mb-6 ${show3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <PlayerPickPanel
          label={isPT ? 'A Tua Equipa' : 'Your Team'} teamInfo={myTeam} players={myPlayers} picks={myPicks}
          allTeams={allTeams} selPlayers={mySend} selPicks={myPicksSend}
          onTogglePlayer={id => toggleAsset(mySend, setMySend, setMySendDest, id, team2Id)}
          onTogglePick={id => toggleAsset(myPicksSend, setMyPicksSend, setMySendDest, id, team2Id)}
          isMyTeam isPT={isPT}
          capAfter={myCapAfter}/>

        <PlayerPickPanel
          label={isPT ? 'Equipa 2' : 'Team 2'} teamInfo={team2} players={t2Players} picks={t2Picks}
          allTeams={allTeams.filter(t => t.id !== team3Id)} selPlayers={t2Recv} selPicks={t2PicksRecv}
          onTogglePlayer={id => toggleAsset(t2Recv, setT2Recv, setT2SendDest, id, effectiveTeamId)}
          onTogglePick={id => toggleAsset(t2PicksRecv, setT2PicksRecv, setT2SendDest, id, effectiveTeamId)}
          onSelectTeam={setTeam2Id} isPT={isPT}
          capAfter={team2 ? t2CapAfter : undefined}/>

        {show3 && (
          <PlayerPickPanel
            label={isPT ? 'Equipa 3' : 'Team 3'} teamInfo={team3} players={t3Players} picks={t3Picks}
            allTeams={allTeams.filter(t => t.id !== team2Id)} selPlayers={t3Recv} selPicks={t3PicksRecv}
            onTogglePlayer={id => toggleAsset(t3Recv, setT3Recv, setT3SendDest, id, effectiveTeamId)}
            onTogglePick={id => toggleAsset(t3PicksRecv, setT3PicksRecv, setT3SendDest, id, effectiveTeamId)}
            onSelectTeam={setTeam3Id} isPT={isPT}
            capAfter={team3 ? t3CapAfter : undefined}/>
        )}
      </div>

      <div className="flex justify-center mb-6">
        <button onClick={() => { setShow3(!show3); if (show3) { setTeam3Id(''); setTeam3(null); setT3Recv([]); setT3PicksRecv([]); setT3SendDest({}) } }}
          className="text-xs px-4 py-2 rounded-lg font-semibold"
          style={{ background: show3 ? '#2a0a0a' : '#1e3a5f', color: show3 ? '#dc2626' : '#1d4ed8', border: '1px solid ' + (show3 ? '#5a1a1a' : '#1e3a5f') }}>
          {show3 ? (isPT ? '✕ Remover 3ª Equipa' : '✕ Remove 3rd Team') : (isPT ? '+ Adicionar 3ª Equipa (troca a 3)' : '+ Add 3rd Team (3-way trade)')}
        </button>
      </div>

      {show3 && team2 && team3 && (
        <div className="rounded-xl p-4 mb-6" style={{ background: '#ddd7ca', border: '1px solid #3a3228' }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#5c554e' }}>🔀 {isPT ? 'Rota de Cada Peça' : 'Routing — Who Gets What'}</div>
          <div className="text-xs mb-3" style={{ color: '#8a8279' }}>{isPT ? 'Numa troca a 3, cada peça selecionada pode ir para qualquer uma das outras duas equipas — escolhe o destino de cada uma.' : 'In a 3-way trade, each selected piece can go to either of the other two teams — choose the destination for each one.'}</div>
          <div className="flex flex-col gap-2">
            {[
              { fromLabel: myTeam?.name || (isPT?'A Tua Equipa':'Your Team'), fromColor: myTeam ? readableTeamColor(myTeam.color) : '#5c554e',
                players: mySend, picks: myPicksSend, playerList: myPlayers, pickList: myPicks, dest: mySendDest, setDest: setMySendDest,
                options: [{id:team2Id,name:team2?.name},{id:team3Id,name:team3?.name}] },
              { fromLabel: team2?.name, fromColor: tc2,
                players: t2Recv, picks: t2PicksRecv, playerList: t2Players, pickList: t2Picks, dest: t2SendDest, setDest: setT2SendDest,
                options: [{id:effectiveTeamId,name:myTeam?.name},{id:team3Id,name:team3?.name}] },
              { fromLabel: team3?.name, fromColor: readableTeamColor(team3.color),
                players: t3Recv, picks: t3PicksRecv, playerList: t3Players, pickList: t3Picks, dest: t3SendDest, setDest: setT3SendDest,
                options: [{id:effectiveTeamId,name:myTeam?.name},{id:team2Id,name:team2?.name}] },
            ].flatMap((row, ri) => [
              ...row.players.map(id => ({ ri, id, name: row.playerList.find((p:any)=>p.id===id)?.name || id, isPick: false, ...row })),
              ...row.picks.map(id => { const pk = row.pickList.find((p:any)=>p.id===id); return { ri, id, name: pk ? `${pk.season} R${pk.round}` : id, isPick: true, ...row } }),
            ]).map(item => (
              <div key={item.ri + ':' + item.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#ede8de' }}>
                <span className="text-xs font-semibold" style={{ color: item.fromColor }}>{item.fromLabel}: <span style={{ color: '#1a1612', fontWeight: 400 }}>{item.name}</span></span>
                <div className="flex gap-1">
                  {item.options.map((opt: any) => (
                    <button key={opt.id} onClick={() => item.setDest((p: Record<string,string>) => ({ ...p, [item.id]: opt.id }))}
                      className="text-xs px-2.5 py-1 rounded-md font-semibold"
                      style={{
                        background: (item.dest[item.id] || (item.ri===0?team2Id:effectiveTeamId)) === opt.id ? '#1d4ed8' : '#faf8f5',
                        color: (item.dest[item.id] || (item.ri===0?team2Id:effectiveTeamId)) === opt.id ? '#e8e2d6' : '#5c554e',
                        border: '1px solid #d4cdc5',
                      }}>
                      → {opt.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade calculator */}
      <div className="rounded-xl p-4 mb-4" style={{ background: '#ddd7ca', border: '1px solid #3a3228' }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#5c554e' }}>🧮 {isPT ? 'Calculadora de Troca' : 'Trade Calculator'}</div>
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="rounded-lg p-3 text-center" style={{ background: '#ede8de' }}>
            <div className="text-xs mb-1" style={{ color: '#5c554e' }}>{isPT ? 'Envias' : 'You send'}</div>
            <div className="text-xl font-black" style={{ color: myTeam ? readableTeamColor(myTeam.color) : '#5c554e' }}>{capFmt(mySalarySent)}</div>
            <div className="text-xs mt-0.5" style={{ color: '#5c554e' }}>{mySend.length} {isPT?'jogador'+(mySend.length!==1?'es':''):'player'+(mySend.length!==1?'s':'')} · {myPicksSend.length} {isPT?'escolha'+(myPicksSend.length!==1?'s':''):'pick'+(myPicksSend.length!==1?'s':'')}</div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: '#ede8de' }}>
            <div className="text-xs mb-1" style={{ color: '#5c554e' }}>{isPT ? 'Diferença salarial' : 'Salary diff'}</div>
            <div className="text-xl font-black" style={{ color: salaryValid ? '#15803d' : '#dc2626' }}>{capFmt(diff)}</div>
            <div className="text-xs mt-0.5" style={{ color: '#5c554e' }}>{isPT?'Máx':'Max'}: {capFmt(maxDiff)}</div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: '#ede8de' }}>
            <div className="text-xs mb-1" style={{ color: '#5c554e' }}>{isPT ? 'Recebes' : 'You receive'}</div>
            <div className="text-xl font-black" style={{ color: tc2 }}>{capFmt(totalIn)}</div>
            <div className="text-xs mt-0.5" style={{ color: '#5c554e' }}>{(myRow?.players_in.length||0)} {isPT?'jogador'+((myRow?.players_in.length||0)!==1?'es':''):'player'+((myRow?.players_in.length||0)!==1?'s':'')} · {(myRow?.picks_in.length||0)} {isPT?'escolha'+((myRow?.picks_in.length||0)!==1?'s':''):'pick'+((myRow?.picks_in.length||0)!==1?'s':'')}</div>
          </div>
        </div>

        {/* Cap check row */}
        {(myOverCap || t2OverCap || t3OverCap) && (
          <div className="rounded-lg px-4 py-2.5 mb-3 flex items-center gap-2"
               style={{ background: '#2a0a0a', border: '1px solid #5a1a1a' }}>
            <span>🚫</span>
            <span className="text-sm font-bold" style={{ color: '#dc2626' }}>
              {isPT ? 'Violação do cap' : 'Cap violation'}: {[
                myOverCap && (isPT ? `${myTeam?.name} ultrapassaria o cap de $180M` : `${myTeam?.name} would exceed $180M cap`),
                t2OverCap && (isPT ? `${team2?.name} ultrapassaria o cap de $180M` : `${team2?.name} would exceed $180M cap`),
                t3OverCap && (isPT ? `${team3?.name} ultrapassaria o cap de $180M` : `${team3?.name} would exceed $180M cap`),
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}

        {/* Roster size check row */}
        {(myRosterBad || t2RosterBad || t3RosterBad) && (
          <div className="rounded-lg px-4 py-2.5 mb-3 flex items-center gap-2"
               style={{ background: '#2a0a0a', border: '1px solid #5a1a1a' }}>
            <span>🚫</span>
            <span className="text-sm font-bold" style={{ color: '#dc2626' }}>
              {isPT ? 'Violação de plantel' : 'Roster size violation'}: {[
                myRosterBad && (isPT ? `${myTeam?.name} ficaria com ${myRosterAfter} jogadores` : `${myTeam?.name} would end up with ${myRosterAfter} players`),
                t2RosterBad && (isPT ? `${team2?.name} ficaria com ${t2RosterAfter} jogadores` : `${team2?.name} would end up with ${t2RosterAfter} players`),
                t3RosterBad && (isPT ? `${team3?.name} ficaria com ${t3RosterAfter} jogadores` : `${team3?.name} would end up with ${t3RosterAfter} players`),
              ].filter(Boolean).join(' · ')} ({isPT?`limite: ${MIN_ROSTER}-${MAX_ROSTER}`:`limit: ${MIN_ROSTER}-${MAX_ROSTER}`})
            </span>
          </div>
        )}

        <div className="rounded-lg px-4 py-2.5 flex items-center gap-3"
             style={{ background: isValid ? '#0a2a10' : '#2a0a0a', border: '1px solid ' + (isValid ? '#1a5a20' : '#5a1a1a') }}>
          <span className="text-lg">{isValid ? '✅' : '❌'}</span>
          <div>
            <span className="font-bold text-sm" style={{ color: isValid ? '#15803d' : '#dc2626' }}>
              {isValid ? (isPT ? 'Troca válida' : 'Trade is valid') : (isPT ? 'Troca inválida' : 'Trade is invalid')}
            </span>
            <div className="text-xs mt-0.5" style={{ color: '#5c554e' }}>
              {!hasPlayers && (isPT ? 'Seleciona pelo menos 1 jogador ou escolha em cada lado · ' : 'Select at least 1 player or pick on each side · ')}
              {!salaryValid && (isPT ? 'Diferença salarial excede o limite (±15% + $1M) · ' : `Salary difference exceeds limit (±15% + $1M) · `)}
              {!capValid && (isPT ? 'Uma das equipas ultrapassaria o cap de $180M · ' : `One of the teams would exceed the $180M cap · `)}
              {!rosterValid && (isPT ? `Uma das equipas ficaria fora do limite de ${MIN_ROSTER}-${MAX_ROSTER} jogadores · ` : `One of the teams would fall outside the ${MIN_ROSTER}-${MAX_ROSTER} player limit · `)}
              {!team2Id && (isPT ? 'Seleciona uma equipa para trocar · ' : 'Select a team to trade with · ')}
              {isValid && (isPT ? 'Todas as verificações passaram. Pronto para enviar.' : 'All checks passed. Ready to send.')}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#5c554e' }}>{isPT ? 'Mensagem (opcional)' : 'Message (optional)'}</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
          style={{ background: '#ede8de', border: '1px solid #3a3228', color: '#1a1612' }}
          placeholder={isPT ? 'Explica a tua oferta...' : 'Explain your offer...'} />
      </div>

      {submitError && (
        <div className="mb-3 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
          ❌ {submitError}
        </div>
      )}

      <button onClick={submitTrade} disabled={!isValid || submitting}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-all"
        style={{ background: isValid ? '#b45309' : '#f0ece5', color: isValid ? '#eee8df' : '#d4cdc5' }}>
        {submitting ? (isPT?'A enviar...':'Sending...') : (isPT?'Enviar Proposta de Troca 🔄':'Send Trade Proposal 🔄')}
      </button>
    </div>
  )
}

export default function ProposeTradePageWrapper() {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<div className="p-8 text-center" style={{ color: '#5c554e' }}>{t('common.loading')}</div>}>
      <ProposeTradePage />
    </Suspense>
  )
}

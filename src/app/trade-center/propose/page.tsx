'use client'
import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useRouter } from 'next/navigation'

// ── helpers ──────────────────────────────────────────────
const capFmt = (n: number) => n >= 1000000 ? '$' + (n / 1000000).toFixed(2) + 'M' : n ? '$' + n.toLocaleString() : '$0'

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]
}

// ── PlayerPickPanel ───────────────────────────────────────
function PlayerPickPanel({
  label, teamInfo, players, picks, allTeams,
  selPlayers, selPicks, onTogglePlayer, onTogglePick,
  isMyTeam = false, onSelectTeam
}: {
  label: string
  teamInfo: any
  players: any[]
  picks: any[]
  allTeams: any[]
  selPlayers: string[]
  selPicks: string[]
  onTogglePlayer: (id: string) => void
  onTogglePick: (id: string) => void
  isMyTeam?: boolean
  onSelectTeam?: (id: string) => void
}) {
  const tc = teamInfo ? readableTeamColor(teamInfo.color) : '#5c554e'
  const totalSalary = players.filter(p => selPlayers.includes(p.id)).reduce((s, p) => s + (p.salary || 0), 0)

  return (
    <div className="rounded-xl overflow-hidden flex flex-col"
         style={{ border: '1px solid ' + (teamInfo ? tc + '44' : '#d4cdc5'), borderTop: '3px solid ' + (teamInfo ? tc : '#d4cdc5') }}>
      {/* Header */}
      <div className="px-4 py-3" style={{ background: '#ddd7ca', borderBottom: '1px solid #3a3228' }}>
        {isMyTeam ? (
          <div className="flex items-center gap-2">
            {teamInfo?.logo_url && <img src={teamInfo.logo_url} alt="" className="w-6 h-6 object-contain" />}
            <span className="font-bold" style={{ color: tc }}>{teamInfo?.name || 'Your Team'}</span>
            <span className="text-xs ml-2" style={{ color: '#5c554e' }}>sends →</span>
          </div>
        ) : (
          <div>
            <div className="text-xs mb-2" style={{ color: '#5c554e' }}>{label} — select team:</div>
            <select onChange={e => onSelectTeam?.(e.target.value)}
              value={teamInfo?.id || ''}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: '#ede8de', border: '1px solid #3a3228', color: '#1a1612' }}>
              <option value="">— Choose team —</option>
              {allTeams.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {teamInfo && (
        <div className="flex-1 overflow-y-auto p-3" style={{ background: '#ede8de', maxHeight: 420 }}>
          {/* Players */}
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#5c554e' }}>Players</div>
          {players.length === 0 && <p className="text-xs mb-3" style={{ color: '#a89f97' }}>No players found.</p>}
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

          {/* Draft Picks */}
          <div className="text-xs font-semibold uppercase tracking-wider mb-2 mt-4" style={{ color: '#5c554e' }}>Draft Picks</div>
          {picks.length === 0 && <p className="text-xs" style={{ color: '#a89f97' }}>No picks available.</p>}
          <div className="flex flex-wrap gap-2">
            {picks.map((pk: any) => {
              const isSel = selPicks.includes(pk.id)
              const isOwn = pk.original_team_id === teamInfo?.id
              return (
                <button key={pk.id} onClick={() => onTogglePick(pk.id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                  style={{ background: isSel ? tc + '33' : '#faf8f5', border: '1px solid ' + (isSel ? tc : '#d4cdc5'), color: isSel ? tc : '#5c554e' }}>
                  {pk.season} R{pk.round}
                  {!isOwn && <span className="ml-1" style={{ color: '#b45309' }}>(via {pk.original_team_id})</span>}
                  {pk.protection !== 'unprotected' && <span className="ml-1" style={{ color: '#dc2626' }}>({pk.protection})</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Salary total */}
      {teamInfo && (
        <div className="px-4 py-2.5 flex items-center justify-between"
             style={{ background: '#ddd7ca', borderTop: '1px solid #3a3228' }}>
          <span className="text-xs" style={{ color: '#5c554e' }}>
            {selPlayers.length} player{selPlayers.length !== 1 ? 's' : ''} · {selPicks.length} pick{selPicks.length !== 1 ? 's' : ''}
          </span>
          <span className="font-bold text-sm" style={{ color: tc }}>{capFmt(totalSalary)}</span>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────
function ProposeTradePage() {
  const { user, profile } = useAuth()
  const router = useRouter()

  const [allTeams,    setAllTeams]    = useState<any[]>([])
  const [myPlayers,   setMyPlayers]   = useState<any[]>([])
  const [myPicks,     setMyPicks]     = useState<any[]>([])
  const [myTeam,      setMyTeam]      = useState<any>(null)

  // Team 2
  const [team2Id,     setTeam2Id]     = useState('')
  const [team2,       setTeam2]       = useState<any>(null)
  const [t2Players,   setT2Players]   = useState<any[]>([])
  const [t2Picks,     setT2Picks]     = useState<any[]>([])

  // Team 3 (optional)
  const [show3,       setShow3]       = useState(false)
  const [team3Id,     setTeam3Id]     = useState('')
  const [team3,       setTeam3]       = useState<any>(null)
  const [t3Players,   setT3Players]   = useState<any[]>([])
  const [t3Picks,     setT3Picks]     = useState<any[]>([])

  // Selections
  const [mySend,      setMySend]      = useState<string[]>([])
  const [myPicksSend, setMyPicksSend] = useState<string[]>([])
  const [t2Recv,      setT2Recv]      = useState<string[]>([])
  const [t2PicksRecv, setT2PicksRecv] = useState<string[]>([])
  const [t3Recv,      setT3Recv]      = useState<string[]>([])
  const [t3PicksRecv, setT3PicksRecv] = useState<string[]>([])

  const [notes,       setNotes]       = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [commTeamId,  setCommTeamId]  = useState('')

  const myTeamId = profile?.team_id
  const isCommissioner = profile?.role === 'commissioner'
  const effectiveTeamId = myTeamId || (isCommissioner ? commTeamId : '')

  // Load all teams immediately on mount
  useEffect(() => {
    supabase.from('teams').select('*').not('id','in','(ALL,RVS)').order('name')
      .then(({data}) => { if(data) setAllTeams(data) })
  }, [])

  // Load my team data
  useEffect(() => {
    if (!effectiveTeamId) return
    Promise.all([
      supabase.from('teams').select('id').eq('id', effectiveTeamId),  // dummy to keep Promise.all structure
      supabase.from('players').select('id,name,pos,salary,usage').eq('team_id', effectiveTeamId).eq('status', 'active').order('usage', { ascending: false }),
      supabase.from('draft_picks').select('*').eq('team_id', effectiveTeamId).order('season').order('round'),
      supabase.from('teams').select('*').eq('id', effectiveTeamId).single(),
    ]).then(([{ data: ts }, { data: ps }, { data: picks }, { data: mt }]) => {
      setMyPlayers(ps || [])
      setMyPicks(picks || [])
      setMyTeam(mt)
    })
  }, [effectiveTeamId])

  // Load team 2 data
  useEffect(() => {
    if (!team2Id) return
    Promise.all([
      supabase.from('players').select('id,name,pos,salary,usage').eq('team_id', team2Id).eq('status', 'active').order('usage', { ascending: false }),
      supabase.from('draft_picks').select('*').eq('team_id', team2Id).order('season').order('round'),
      supabase.from('teams').select('*').eq('id', team2Id).single(),
    ]).then(([{ data: ps }, { data: picks }, { data: t }]) => {
      setT2Players(ps || [])
      setT2Picks(picks || [])
      setTeam2(t)
      setT2Recv([]); setT2PicksRecv([])
    })
  }, [team2Id])

  // Load team 3 data
  useEffect(() => {
    if (!team3Id) return
    Promise.all([
      supabase.from('players').select('id,name,pos,salary,usage').eq('team_id', team3Id).eq('status', 'active').order('usage', { ascending: false }),
      supabase.from('draft_picks').select('*').eq('team_id', team3Id).order('season').order('round'),
      supabase.from('teams').select('*').eq('id', team3Id).single(),
    ]).then(([{ data: ps }, { data: picks }, { data: t }]) => {
      setT3Players(ps || [])
      setT3Picks(picks || [])
      setTeam3(t)
      setT3Recv([]); setT3PicksRecv([])
    })
  }, [team3Id])

  // ── Salary calculations ─────────────────────────────────
  const mySalarySent = myPlayers.filter(p => mySend.includes(p.id)).reduce((s, p) => s + (p.salary || 0), 0)
  const t2SalarySent = t2Players.filter(p => t2Recv.includes(p.id)).reduce((s, p) => s + (p.salary || 0), 0)
  const t3SalarySent = t3Players.filter(p => t3Recv.includes(p.id)).reduce((s, p) => s + (p.salary || 0), 0)

  // In a 2-team trade: my sends ≈ t2 sends (±15% + $1M)
  const totalOut = mySalarySent
  const totalIn  = t2SalarySent + t3SalarySent
  const diff     = Math.abs(totalOut - totalIn)
  const maxDiff  = Math.max(totalOut, totalIn) * 0.15 + 1000000
  const hasPlayers = (mySend.length + myPicksSend.length > 0) && (t2Recv.length + t2PicksRecv.length > 0 || t3Recv.length + t3PicksRecv.length > 0)
  const salaryValid = totalOut === 0 && totalIn === 0 ? true : diff <= maxDiff
  const isValid = hasPlayers && salaryValid

  const submitTrade = async () => {
    if (!user || !effectiveTeamId || !team2Id || !isValid) return
    setSubmitting(true)

    const { data: proposal } = await supabase.from('trade_proposals').insert({
      initiator_team: effectiveTeamId, status: 'pending', notes
    }).select().single()
    if (!proposal) { setSubmitting(false); return }

    const teams: any[] = [
      { team_id: effectiveTeamId,  players_out: mySend,  picks_out: myPicksSend, players_in: [...t2Recv, ...t3Recv], picks_in: [...t2PicksRecv, ...t3PicksRecv], salary_out: mySalarySent, salary_in: totalIn },
      { team_id: team2Id,   players_out: t2Recv,  picks_out: t2PicksRecv, players_in: mySend, picks_in: myPicksSend, salary_out: t2SalarySent, salary_in: mySalarySent },
    ]
    if (team3Id) teams.push({ team_id: team3Id, players_out: t3Recv, picks_out: t3PicksRecv, players_in: [], picks_in: [], salary_out: t3SalarySent, salary_in: 0 })

    await supabase.from('trade_proposal_teams').insert(teams.map(t => ({ ...t, proposal_id: proposal.id })))

    // Notify GMs
    for (const tid of [team2Id, team3Id].filter(Boolean)) {
      const { data: gm } = await supabase.from('gm_profiles').select('id').eq('team_id', tid).single()
      if (gm) {
        const sendNames = myPlayers.filter(p => mySend.includes(p.id)).map(p => p.name).join(', ')
        const t2Names   = t2Players.filter(p => t2Recv.includes(p.id)).map(p => p.name).join(', ')
        await supabase.from('messages').insert({
          from_user: user.id, to_user: gm.id,
          subject: `Trade Proposal from ${myTeam?.name}`,
          body: `${myTeam?.name} proposes a trade:\n→ Sends: ${sendNames || 'picks only'}\n← Receives: ${t2Names || 'picks only'}\n\n${notes}`,
          type: 'trade_proposal', ref_id: proposal.id
        })
      }
    }
    setSubmitting(false); setSubmitted(true)
  }

  if (!user) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <p className="mb-4" style={{ color: '#5c554e' }}>Sign in to propose a trade.</p>
      <a href="/login" className="px-4 py-2 rounded-lg text-sm font-bold no-underline" style={{ background: '#1d4ed8', color: '#e8e2d6' }}>Sign In</a>
    </div>
  )

  // Commissioner team selector
  if (isCommissioner && !commTeamId) return (
    <div className="max-w-md mx-auto px-4 py-12">
      <a href="/trade-center" className="text-xs no-underline mb-4 block" style={{color:'#6b5f4e'}}>← Trade Center</a>
      <h2 className="text-lg font-bold mb-4" style={{color:'#1a1612'}}>Commissioner — Select Team to Propose As</h2>
      <select onChange={e=>setCommTeamId(e.target.value)} defaultValue=""
        className="w-full text-sm px-3 py-3 rounded-xl outline-none"
        style={{background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1612'}}>
        <option value="">— Choose a team —</option>
        {allTeams.map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
  )

  if (submitted) return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#1a1612' }}>Trade Proposal Sent!</h2>
      <p className="mb-6" style={{ color: '#5c554e' }}>The GM(s) received a notification and can accept, reject or counter.</p>
      <a href="/trade-center" className="px-4 py-2 rounded-lg text-sm font-bold no-underline" style={{ background: '#1d4ed8', color: '#e8e2d6' }}>← Back</a>
    </div>
  )

  const tc2 = team2 ? readableTeamColor(team2.color) : '#5c554e'
  const tc3 = team3 ? readableTeamColor(team3.color) : '#5c554e'

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <a href="/trade-center" className="text-xs no-underline" style={{ color: '#5c554e' }}>← Trade Center</a>
        <h1 className="text-xl font-bold" style={{ color: '#1a1612' }}>🔄 Propose Trade</h1>
      </div>

      {/* Teams grid */}
      <div className={`grid gap-4 mb-6 ${show3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {/* My team */}
        <PlayerPickPanel
          label="Your Team" teamInfo={myTeam} players={myPlayers} picks={myPicks}
          allTeams={allTeams} selPlayers={mySend} selPicks={myPicksSend}
          onTogglePlayer={id => setMySend(p => toggle(p, id))}
          onTogglePick={id => setMyPicksSend(p => toggle(p, id))}
          isMyTeam />

        {/* Team 2 */}
        <PlayerPickPanel
          label="Team 2" teamInfo={team2} players={t2Players} picks={t2Picks}
          allTeams={allTeams.filter(t => t.id !== team3Id)} selPlayers={t2Recv} selPicks={t2PicksRecv}
          onTogglePlayer={id => setT2Recv(p => toggle(p, id))}
          onTogglePick={id => setT2PicksRecv(p => toggle(p, id))}
          onSelectTeam={setTeam2Id} />

        {/* Team 3 */}
        {show3 && (
          <PlayerPickPanel
            label="Team 3" teamInfo={team3} players={t3Players} picks={t3Picks}
            allTeams={allTeams.filter(t => t.id !== team2Id)} selPlayers={t3Recv} selPicks={t3PicksRecv}
            onTogglePlayer={id => setT3Recv(p => toggle(p, id))}
            onTogglePick={id => setT3PicksRecv(p => toggle(p, id))}
            onSelectTeam={setTeam3Id} />
        )}
      </div>

      {/* Add/remove 3rd team */}
      <div className="flex justify-center mb-6">
        <button onClick={() => { setShow3(!show3); if (show3) { setTeam3Id(''); setTeam3(null); setT3Recv([]); setT3PicksRecv([]) } }}
          className="text-xs px-4 py-2 rounded-lg font-semibold"
          style={{ background: show3 ? '#2a0a0a' : '#1e3a5f', color: show3 ? '#dc2626' : '#1d4ed8', border: '1px solid ' + (show3 ? '#5a1a1a' : '#1e3a5f') }}>
          {show3 ? '✕ Remove 3rd Team' : '+ Add 3rd Team (3-way trade)'}
        </button>
      </div>

      {/* Trade calculator */}
      <div className="rounded-xl p-4 mb-4" style={{ background: '#ddd7ca', border: '1px solid #3a3228' }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#5c554e' }}>🧮 Trade Calculator</div>
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="rounded-lg p-3 text-center" style={{ background: '#ede8de' }}>
            <div className="text-xs mb-1" style={{ color: '#5c554e' }}>You send</div>
            <div className="text-xl font-black" style={{ color: myTeam ? readableTeamColor(myTeam.color) : '#5c554e' }}>{capFmt(mySalarySent)}</div>
            <div className="text-xs mt-0.5" style={{ color: '#5c554e' }}>{mySend.length} players · {myPicksSend.length} picks</div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: '#ede8de' }}>
            <div className="text-xs mb-1" style={{ color: '#5c554e' }}>Difference</div>
            <div className="text-xl font-black" style={{ color: salaryValid ? '#15803d' : '#dc2626' }}>{capFmt(diff)}</div>
            <div className="text-xs mt-0.5" style={{ color: '#5c554e' }}>Max allowed: {capFmt(maxDiff)}</div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: '#ede8de' }}>
            <div className="text-xs mb-1" style={{ color: '#5c554e' }}>You receive</div>
            <div className="text-xl font-black" style={{ color: tc2 }}>{capFmt(totalIn)}</div>
            <div className="text-xs mt-0.5" style={{ color: '#5c554e' }}>{t2Recv.length + t3Recv.length} players · {t2PicksRecv.length + t3PicksRecv.length} picks</div>
          </div>
        </div>
        {/* Validation message */}
        <div className="rounded-lg px-4 py-2.5 flex items-center gap-3"
             style={{ background: isValid ? '#0a2a10' : '#2a0a0a', border: '1px solid ' + (isValid ? '#1a5a20' : '#5a1a1a') }}>
          <span className="text-lg">{isValid ? '✅' : '❌'}</span>
          <div>
            <span className="font-bold text-sm" style={{ color: isValid ? '#15803d' : '#dc2626' }}>
              {isValid ? 'Trade is valid' : 'Trade is invalid'}
            </span>
            <div className="text-xs mt-0.5" style={{ color: '#5c554e' }}>
              {!hasPlayers && 'Select at least 1 player or pick on each side · '}
              {!salaryValid && `Salary difference $${(diff / 1000000).toFixed(2)}M exceeds limit of $${(maxDiff / 1000000).toFixed(2)}M (±15% + $1M) · `}
              {!team2Id && 'Select a team to trade with · '}
              {isValid && 'Salaries match within NBA rules. Ready to send.'}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#5c554e' }}>Message to other GM (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
          style={{ background: '#ede8de', border: '1px solid #3a3228', color: '#1a1612' }}
          placeholder="Explain your offer..." />
      </div>

      <button onClick={submitTrade} disabled={!isValid || submitting}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-all"
        style={{ background: isValid ? '#b45309' : '#f0ece5', color: isValid ? '#eee8df' : '#d4cdc5' }}>
        {submitting ? 'Sending...' : 'Send Trade Proposal 🔄'}
      </button>
    </div>
  )
}

export default function ProposeTradePageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center" style={{ color: '#5c554e' }}>Loading...</div>}>
      <ProposeTradePage />
    </Suspense>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useSearchParams, useRouter } from 'next/navigation'

export default function ProposeTradePage() {
  const { user, profile } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const toTeamId = searchParams.get('to')

  const [myPlayers,    setMyPlayers]    = useState<any[]>([])
  const [theirPlayers, setTheirPlayers] = useState<any[]>([])
  const [myPicks,      setMyPicks]      = useState<any[]>([])
  const [theirPicks,   setTheirPicks]   = useState<any[]>([])
  const [theirTeam,    setTheirTeam]    = useState<any>(null)
  const [myTeam,       setMyTeam]       = useState<any>(null)
  const [extraTeams,   setExtraTeams]   = useState<string[]>([])

  // Selected items
  const [sendPlayers,  setSendPlayers]  = useState<string[]>([])
  const [recvPlayers,  setRecvPlayers]  = useState<string[]>([])
  const [sendPicks,    setSendPicks]    = useState<string[]>([])
  const [recvPicks,    setRecvPicks]    = useState<string[]>([])
  const [notes,        setNotes]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitted,    setSubmitted]    = useState(false)

  const myTeamId = profile?.team_id

  useEffect(() => {
    if (!myTeamId || !toTeamId) return
    Promise.all([
      supabase.from('players').select('id,name,pos,salary').eq('team_id',myTeamId).eq('status','active').order('usage',{ascending:false}),
      supabase.from('players').select('id,name,pos,salary').eq('team_id',toTeamId).eq('status','active').order('usage',{ascending:false}),
      supabase.from('draft_picks').select('*').eq('team_id',myTeamId),
      supabase.from('draft_picks').select('*').eq('team_id',toTeamId),
      supabase.from('teams').select('*').eq('id',toTeamId).single(),
      supabase.from('teams').select('*').eq('id',myTeamId).single(),
    ]).then(([{data:mp},{data:tp},{data:mpick},{data:tpick},{data:tt},{data:mt}])=>{
      setMyPlayers(mp||[])
      setTheirPlayers(tp||[])
      setMyPicks(mpick||[])
      setTheirPicks(tpick||[])
      setTheirTeam(tt)
      setMyTeam(mt)
    })
  }, [myTeamId, toTeamId])

  const capFmt = (n:number) => n>=1000000?'$'+(n/1000000).toFixed(1)+'M':'$'+n?.toLocaleString()

  const sendSalary = myPlayers.filter(p=>sendPlayers.includes(p.id)).reduce((s,p)=>s+p.salary,0)
  const recvSalary = theirPlayers.filter(p=>recvPlayers.includes(p.id)).reduce((s,p)=>s+p.salary,0)
  const diff = Math.abs(sendSalary - recvSalary)
  const maxDiff = Math.max(sendSalary, recvSalary) * 0.15
  const isValid = sendSalary > 0 && recvSalary > 0 && diff <= maxDiff + 1000000

  const toggle = (arr: string[], setArr: (a:string[])=>void, id: string) => {
    setArr(arr.includes(id) ? arr.filter(x=>x!==id) : [...arr, id])
  }

  const submitTrade = async () => {
    if (!user || !myTeamId || !toTeamId || !isValid) return
    setSubmitting(true)

    // Create proposal
    const { data: proposal } = await supabase.from('trade_proposals').insert({
      initiator_team: myTeamId, status: 'pending', notes
    }).select().single()

    if (!proposal) { setSubmitting(false); return }

    // Create team entries
    await supabase.from('trade_proposal_teams').insert([
      { proposal_id: proposal.id, team_id: myTeamId,
        players_out: sendPlayers, players_in: recvPlayers,
        picks_out: sendPicks, picks_in: recvPicks,
        salary_out: sendSalary, salary_in: recvSalary },
      { proposal_id: proposal.id, team_id: toTeamId,
        players_out: recvPlayers, players_in: sendPlayers,
        picks_out: recvPicks, picks_in: sendPicks,
        salary_out: recvSalary, salary_in: sendSalary },
    ])

    // Find target GM and send message
    const { data: targetProfile } = await supabase.from('gm_profiles').select('id').eq('team_id',toTeamId).single()
    if (targetProfile) {
      const sendNames = myPlayers.filter(p=>sendPlayers.includes(p.id)).map(p=>p.name).join(', ')
      const recvNames = theirPlayers.filter(p=>recvPlayers.includes(p.id)).map(p=>p.name).join(', ')
      await supabase.from('messages').insert({
        from_user: user.id, to_user: targetProfile.id,
        subject: `Trade Proposal from ${myTeam?.name}`,
        body: `${myTeam?.name} proposes: Send ${sendNames || 'picks'} → Receive ${recvNames || 'picks'}.\n\n${notes||''}`,
        type: 'trade_proposal', ref_id: proposal.id
      })
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  if (!user) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <p className="mb-4" style={{color:'#8a7a6a'}}>You must be signed in to propose a trade.</p>
      <a href="/login" className="px-4 py-2 rounded-lg text-sm font-bold no-underline"
         style={{background:'#3a8adf',color:'#fff'}}>Sign In</a>
    </div>
  )

  if (submitted) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-xl font-bold mb-2" style={{color:'#f0ebe0'}}>Trade Proposal Sent!</h2>
      <p className="mb-6" style={{color:'#8a7a6a'}}>
        The GM of {theirTeam?.name} will receive a notification and can accept, reject or counter.
      </p>
      <a href="/trade-center" className="px-4 py-2 rounded-lg text-sm font-bold no-underline"
         style={{background:'#3a8adf',color:'#fff'}}>Back to Trade Center</a>
    </div>
  )

  const myColor   = readableTeamColor(myTeam?.color||'555')
  const theirColor = readableTeamColor(theirTeam?.color||'555')

  const PlayerList = ({ players, selected, onToggle, color }: any) => (
    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
      {players.map((p:any) => {
        const isSel = selected.includes(p.id)
        return (
          <button key={p.id} onClick={()=>onToggle(p.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all"
            style={{background:isSel?color+'22':'#1a1610',border:'1px solid '+(isSel?color:'#3a3228')}}>
            <span className="text-xs w-7" style={{color:'#6a5a4a'}}>{p.pos}</span>
            <span className="text-sm flex-1 font-semibold" style={{color:isSel?'#fff':'#c0b8a8'}}>{p.name}</span>
            <span className="text-xs" style={{color:'#6a5a4a'}}>{capFmt(p.salary)}</span>
            {isSel && <span className="text-sm">✓</span>}
          </button>
        )
      })}
    </div>
  )

  const PickList = ({ picks, selected, onToggle, color }: any) => (
    <div className="flex flex-wrap gap-2 mt-2">
      {picks.map((pk:any) => {
        const isSel = selected.includes(pk.id)
        return (
          <button key={pk.id} onClick={()=>onToggle(pk.id)}
            className="text-xs px-2 py-1 rounded font-semibold"
            style={{background:isSel?color+'33':'#1a1610',border:'1px solid '+(isSel?color:'#3a3228'),
                    color:isSel?color:'#8a7a6a'}}>
            {pk.season} R{pk.round}
            {pk.protection!=='unprotected'&&` (${pk.protection})`}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <a href="/trade-center" className="text-xs no-underline" style={{color:'#8a7a6a'}}>← Trade Center</a>
        <h1 className="text-xl font-bold" style={{color:'#f0ebe0'}}>
          Propose Trade: {myTeam?.name} ↔ {theirTeam?.name}
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* My team — sending */}
        <div className="rounded-xl p-4" style={{background:'#241f18',border:'1px solid '+myColor+'44',borderTop:'3px solid '+myColor}}>
          <div className="flex items-center gap-2 mb-3">
            {myTeam?.logo_url&&<img src={myTeam.logo_url} alt="" className="w-6 h-6 object-contain"/>}
            <span className="font-bold" style={{color:myColor}}>{myTeam?.name} sends</span>
          </div>
          <p className="text-xs mb-2" style={{color:'#6a5a4a'}}>Select players to send:</p>
          <PlayerList players={myPlayers} selected={sendPlayers}
            onToggle={(id:string)=>toggle(sendPlayers,setSendPlayers,id)} color={myColor} />
          <p className="text-xs mt-3 mb-1" style={{color:'#6a5a4a'}}>Draft picks to send:</p>
          <PickList picks={myPicks} selected={sendPicks}
            onToggle={(id:string)=>toggle(sendPicks,setSendPicks,id)} color={myColor} />
          <div className="mt-3 text-sm font-bold" style={{color:myColor}}>
            Total salary out: {capFmt(sendSalary)}
          </div>
        </div>

        {/* Their team — receiving */}
        <div className="rounded-xl p-4" style={{background:'#241f18',border:'1px solid '+theirColor+'44',borderTop:'3px solid '+theirColor}}>
          <div className="flex items-center gap-2 mb-3">
            {theirTeam?.logo_url&&<img src={theirTeam.logo_url} alt="" className="w-6 h-6 object-contain"/>}
            <span className="font-bold" style={{color:theirColor}}>{theirTeam?.name} sends</span>
          </div>
          <p className="text-xs mb-2" style={{color:'#6a5a4a'}}>Select players to receive:</p>
          <PlayerList players={theirPlayers} selected={recvPlayers}
            onToggle={(id:string)=>toggle(recvPlayers,setRecvPlayers,id)} color={theirColor} />
          <p className="text-xs mt-3 mb-1" style={{color:'#6a5a4a'}}>Draft picks to receive:</p>
          <PickList picks={theirPicks} selected={recvPicks}
            onToggle={(id:string)=>toggle(recvPicks,setRecvPicks,id)} color={theirColor} />
          <div className="mt-3 text-sm font-bold" style={{color:theirColor}}>
            Total salary in: {capFmt(recvSalary)}
          </div>
        </div>
      </div>

      {/* Validation */}
      <div className="rounded-xl p-4 mb-4" style={{background:isValid?'#0a2a10':'#2a0a0a',
           border:'1px solid '+(isValid?'#1a5a20':'#5a1a1a')}}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold" style={{color:isValid?'#40e080':'#e04040'}}>
            {isValid?'✅ Trade is valid':'❌ Trade invalid'}
          </span>
          <span className="text-xs" style={{color:'#8a7a6a'}}>
            Salary difference: {capFmt(diff)} (max allowed: {capFmt(maxDiff + 1000000)} = 15% + $1M)
          </span>
          {sendSalary === 0 && <span className="text-xs" style={{color:'#e04040'}}>Select at least 1 player or pick to send</span>}
          {recvSalary === 0 && <span className="text-xs" style={{color:'#e04040'}}>Select at least 1 player or pick to receive</span>}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>Message to other GM (optional)</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
          style={{background:'#1a1610',border:'1px solid #3a3228',color:'#f0ebe0'}}
          placeholder="Explain your trade offer..." />
      </div>

      <button onClick={submitTrade} disabled={!isValid||submitting}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
        style={{background:'#ffd040',color:'#1a1610'}}>
        {submitting?'Sending...':'Send Trade Proposal 🔄'}
      </button>
    </div>
  )
}

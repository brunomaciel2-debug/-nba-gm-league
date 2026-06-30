'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const MAX_SALARY = 50_000_000
const MAX_INCREASE_PCT = 0.40
const MIN_YEARS = 2
const MAX_YEARS = 5
const ELIGIBLE_YEARS_LEFT = 2

function fmt(n: number) {
  return '$' + (n / 1_000_000).toFixed(1) + 'M'
}

function fairValueForOvr(ovr: number) {
  return Math.min(MAX_SALARY, Math.max(1_000_000, Math.round((ovr - 60) * 1_200_000)))
}

export default function ContractExtensionPanel({ playerId }: { playerId: number }) {
  const [gmTeamId, setGmTeamId]   = useState<string | null>(null)
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [player, setPlayer]     = useState<any>(null)
  const [team, setTeam]         = useState<any>(null)
  const [existingOffer, setExistingOffer] = useState<any>(null)
  const [years, setYears]       = useState(3)
  const [offerSalary, setOfferSalary] = useState(0)
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: gm } = await supabase.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
      if (!gm) return
      setGmTeamId(gm.team_id)
      setIsCommissioner(gm.role === 'commissioner')

      const [{ data: p }, { data: offer }] = await Promise.all([
        supabase.from('players').select('id,name,team_id,age,real_ovr,salary,contract_years').eq('id', playerId).single(),
        supabase.from('contract_extension_offers').select('*').eq('player_id', playerId).eq('season', '2025-26').maybeSingle(),
      ])

      setPlayer(p)
      setExistingOffer(offer)
      if (p) setOfferSalary(p.salary)

      // Load cap info for the player's actual team (not necessarily the GM's)
      if (p?.team_id) {
        const { data: t } = await supabase.from('teams').select('id,cap_used').eq('id', p.team_id).single()
        setTeam(t)
      }
    })
  }, [playerId])

  if (!player) return null
  const isOwner = gmTeamId === player.team_id
  const authorized = isOwner || isCommissioner
  if (!authorized) return null

  const isEligible = player.contract_years <= ELIGIBLE_YEARS_LEFT
  if (!isEligible) {
    return (
      <div style={{marginTop:16,padding:'12px 16px',background:'#f0ece5',border:'1px solid #d4cdc5',borderRadius:8,fontSize:12,color:'#8a8279'}}>
        🔒 Not eligible for extension yet — {player.name} has {player.contract_years} years remaining. Extensions only open up with {ELIGIBLE_YEARS_LEFT} years or fewer left on contract.
      </div>
    )
  }

  if (existingOffer) {
    const statusColor = existingOffer.status === 'accepted' ? '#15803d' : existingOffer.status === 'rejected' ? '#dc2626' : '#b45309'
    const statusLabel = existingOffer.status === 'accepted' ? '✓ Accepted' : existingOffer.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'
    return (
      <div style={{marginTop:16,padding:'14px 16px',background:'#faf8f5',border:`1px solid ${statusColor}44`,borderRadius:10}}>
        <div style={{fontSize:13,fontWeight:700,color:statusColor,marginBottom:4}}>{statusLabel} — Extension Offer</div>
        <div style={{fontSize:12,color:'#5c554e'}}>
          {fmt(existingOffer.offered_salary)}/yr × {existingOffer.offered_years} years
        </div>
        {existingOffer.status === 'rejected' && existingOffer.rejection_reason && (
          <div style={{fontSize:11,color:'#8a8279',marginTop:6,fontStyle:'italic'}}>
            "{existingOffer.rejection_reason}"
          </div>
        )}
        {existingOffer.status === 'rejected' && (
          <div style={{fontSize:11,color:'#8a8279',marginTop:6}}>
            One offer per season — try again next year, or risk losing them to free agency.
          </div>
        )}
      </div>
    )
  }

  // Calculate max allowed salary: min of (cap max, +40% current, cap space available)
  const capMaxRaise = Math.round(player.salary * (1 + MAX_INCREASE_PCT))
  const capSpace = (180_000_000 - (team?.cap_used || 0)) + player.salary // current salary is "freed" since it's the same player being re-signed
  const maxAllowed = Math.min(MAX_SALARY, capMaxRaise, capSpace)
  const fairValue = fairValueForOvr(player.real_ovr)

  const submitOffer = async () => {
    setLoading(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg('Not logged in'); setLoading(false); return }

    const res = await fetch('/api/contracts/extend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ playerId, offeredSalary: offerSalary, offeredYears: years }),
    })
    const json = await res.json()
    if (res.ok) {
      setMsg(json.accepted ? `✅ ${player.name} accepted the extension!` : `❌ ${player.name} rejected the offer. ${json.reason || ''}`)
      setExistingOffer(json.offer)
    } else {
      setMsg(json.error || 'Error submitting offer')
    }
    setLoading(false)
  }

  return (
    <div style={{marginTop:16,padding:'16px',background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:10}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1a1512'}}>📝 Contract Extension</div>
        <a href="/rules/contracts" target="_blank" style={{fontSize:11,color:'#1d4ed8',textDecoration:'none',fontWeight:600}}>
          View rules →
        </a>
      </div>

      {/* Max salary info — the key requested feature */}
      <div style={{
        marginBottom:12, padding:'10px 14px', borderRadius:8,
        background:'#dbeafe', border:'1px solid #93c5fd',
      }}>
        <div style={{fontSize:11,color:'#1d4ed8',fontWeight:600}}>
          Maximum annual salary you can offer {player.name}:
        </div>
        <div style={{fontSize:20,fontWeight:900,color:'#1d4ed8',marginTop:2}}>
          {fmt(maxAllowed)}
        </div>
        <div style={{fontSize:10,color:'#1d4ed8',marginTop:4,lineHeight:1.5}}>
          Limited by the lowest of: league max ({fmt(MAX_SALARY)}) · +40% raise cap ({fmt(capMaxRaise)}) · your available cap space ({fmt(capSpace)})
        </div>
      </div>

      {/* Fair value reference */}
      <div style={{marginBottom:14,fontSize:11,color:'#8a8279'}}>
        Estimated fair value for a {player.real_ovr} OVR player: <strong style={{color:'#5c554e'}}>{fmt(fairValue)}</strong>/yr — offers far below this risk rejection.
      </div>

      {/* Salary input */}
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,fontWeight:600,color:'#5c554e',display:'block',marginBottom:4}}>
          Annual Salary
        </label>
        <input
          type="range"
          min={1_000_000}
          max={maxAllowed}
          step={100_000}
          value={Math.min(offerSalary, maxAllowed)}
          onChange={e => setOfferSalary(Number(e.target.value))}
          style={{width:'100%'}}
        />
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8a8279',marginTop:2}}>
          <span>$1.0M</span>
          <span style={{fontWeight:700,color:'#1a1512',fontSize:14}}>{fmt(offerSalary)}</span>
          <span>{fmt(maxAllowed)}</span>
        </div>
      </div>

      {/* Years selector */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:11,fontWeight:600,color:'#5c554e',display:'block',marginBottom:4}}>
          Contract Length
        </label>
        <div style={{display:'flex',gap:6}}>
          {[2,3,4,5].map(y => (
            <button key={y} onClick={() => setYears(y)}
              style={{
                flex:1, padding:'8px 0', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer',
                border:`1px solid ${years===y?'#1a1512':'#d4cdc5'}`,
                background: years===y?'#1a1512':'#f0ece5',
                color: years===y?'#fff':'#5c554e',
              }}>
              {y}yr
            </button>
          ))}
        </div>
      </div>

      <button onClick={submitOffer} disabled={loading || offerSalary < 1_000_000}
        style={{
          width:'100%', padding:'10px 0', borderRadius:8, fontSize:14, fontWeight:700,
          background:'#1a1512', color:'#faf8f5', border:'none',
          cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
        }}>
        {loading ? 'Submitting...' : `Offer Extension — ${fmt(offerSalary)}/yr × ${years}yr`}
      </button>

      {msg && (
        <div style={{marginTop:10,fontSize:12,fontWeight:600,color: msg.startsWith('✅') ? '#15803d' : '#dc2626'}}>
          {msg}
        </div>
      )}
    </div>
  )
}

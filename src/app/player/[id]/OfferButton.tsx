'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import FAMarketOfferPanel from './FAMarketOfferPanel'

const CAP = 180_000_000
const MIN_ROSTER = 12
const MAX_ROSTER = 15
const OFFER_SALARY = 650_000 // every FA signing is this flat 1-year deal, see /api/fa/offer
const CAP_WARNING_THRESHOLD = 5_000_000 // warn if cap space < $5M after signing

function fmt(n: number) {
  return '$' + (n / 1_000_000).toFixed(2) + 'M'
}

export default function OfferButton({ playerId, isAssigned, phase, faClosed }: { playerId: number, isAssigned: boolean, phase?: string, faClosed?: boolean }) {
  const [gmTeamId, setGmTeamId]   = useState<string|null>(null)
  const [offered, setOffered]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [msg, setMsg]             = useState('')
  const [capInfo, setCapInfo]     = useState<{
    capUsed: number
    rosterSize: number
    playerSalary: number
    capSpace: number
    canSign: boolean
    warning: string
  } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: gm } = await supabase.from('gm_profiles').select('team_id').eq('id', user.id).single()
      if (!gm?.team_id) return
      setGmTeamId(gm.team_id)

      // Check existing offer
      const { data: offer } = await supabase.from('fa_offers').select('id').eq('player_id', playerId).eq('team_id', gm.team_id).maybeSingle()
      if (offer) setOffered(true)

      // Load cap & roster info
      const [{ data: team }, { data: players }] = await Promise.all([
        supabase.from('teams').select('cap_used,salary_cap').eq('id', gm.team_id).single(),
        supabase.from('players').select('id,salary').eq('team_id', gm.team_id).eq('status', 'active'),
      ])

      if (!team) return

      const capUsed = players?.reduce((s, p) => s + (p.salary || 0), 0) || 0
      const rosterSize = players?.length || 0
      // Every FA signing is a flat $650K/1yr deal (see /api/fa/offer) — the
      // player's own "salary" field reflects their market value, not what
      // they'll actually be signed for, so it's never used in this math.
      const playerSalary = OFFER_SALARY
      const newCapUsed = capUsed + playerSalary
      const capSpace = CAP - capUsed
      const canSign = newCapUsed <= CAP && rosterSize < MAX_ROSTER

      // Build warning message
      let warning = ''
      if (rosterSize >= MAX_ROSTER) {
        warning = `❌ Roster full (${rosterSize}/${MAX_ROSTER}). Cut a player before signing.`
      } else if (newCapUsed > CAP) {
        warning = `❌ Signing exceeds cap by ${fmt(newCapUsed - CAP)}. Not allowed.`
      } else {
        const spaceAfter = CAP - newCapUsed
        const spotsLeft = MAX_ROSTER - rosterSize - 1 // after signing this player
        if (spotsLeft > 0 && spaceAfter < spotsLeft * OFFER_SALARY) {
          warning = `⚠️ After signing, you'll have ${fmt(spaceAfter)} cap space for ${spotsLeft} more slot${spotsLeft > 1 ? 's' : ''}. You may not be able to reach the ${MIN_ROSTER}-player minimum.`
        } else if (spaceAfter < CAP_WARNING_THRESHOLD) {
          warning = `⚠️ Only ${fmt(spaceAfter)} cap space remaining after this signing.`
        }
      }

      setCapInfo({ capUsed, rosterSize, playerSalary, capSpace, canSign, warning })
    })
  }, [playerId])

  if (!gmTeamId) return null

  if (isAssigned) return (
    <div style={{marginTop:16,padding:'10px 16px',background:'#f0ece5',border:'1px solid #d4cdc5',borderRadius:8,fontSize:13,color:'#8a8279'}}>
      On NBA assignment — cannot be signed by other teams
    </div>
  )

  // During Free Agency week, GMs negotiate a real contract instead of the flat $650K deal.
  if (phase === 'free-agency') return <FAMarketOfferPanel playerId={playerId} />

  if (faClosed) return (
    <div style={{marginTop:16,padding:'10px 16px',background:'#f0ece5',border:'1px solid #d4cdc5',borderRadius:8,fontSize:13,color:'#8a8279'}}>
      🔒 Free agent signings are closed — the roster freeze starts 2 weeks before the play-in.
    </div>
  )

  const call = async (method: string) => {
    setLoading(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg('Not logged in'); setLoading(false); return }
    const res = await fetch('/api/fa/offer', {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ playerId })
    })
    const json = await res.json()
    if (res.ok) {
      setOffered(method === 'POST')
      setMsg(method === 'POST' ? 'Offer submitted! Resolution at midnight.' : '')
    } else {
      setMsg(json.error || 'Error')
    }
    setLoading(false)
  }

  return (
    <div style={{marginTop:16,marginBottom:16}}>
      {/* Cap info bar */}
      {capInfo && (
        <div style={{
          marginBottom:12, padding:'12px 16px', borderRadius:10,
          background:'#faf8f5', border:'1px solid #d4cdc5',
          display:'flex', gap:20, flexWrap:'wrap', alignItems:'center',
        }}>
          {[
            { label:'Cap Used', val:fmt(capInfo.capUsed), color: capInfo.capUsed / CAP > 0.95 ? '#dc2626' : '#1a1512' },
            { label:'Cap Space', val:fmt(capInfo.capSpace), color: capInfo.capSpace < 5_000_000 ? '#b45309' : '#15803d' },
            { label:'Player Salary', val:fmt(capInfo.playerSalary), color:'#1d4ed8' },
            { label:'Roster', val:`${capInfo.rosterSize}/${MAX_ROSTER}`, color: capInfo.rosterSize >= MAX_ROSTER ? '#dc2626' : '#1a1512' },
          ].map(item => (
            <div key={item.label}>
              <div style={{fontSize:10,color:'#8a8279'}}>{item.label}</div>
              <div style={{fontSize:14,fontWeight:700,color:item.color}}>{item.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Warning */}
      {capInfo?.warning && (
        <div style={{
          marginBottom:12, padding:'10px 14px', borderRadius:8, fontSize:12, lineHeight:1.5,
          background: capInfo.warning.startsWith('❌') ? '#fee2e2' : '#fef3c7',
          border: `1px solid ${capInfo.warning.startsWith('❌') ? '#fca5a5' : '#fcd34d'}`,
          color: capInfo.warning.startsWith('❌') ? '#dc2626' : '#b45309',
          fontWeight: 500,
        }}>
          {capInfo.warning}
        </div>
      )}

      {offered ? (
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <div style={{padding:'8px 14px',background:'#1a3a2a',color:'#4ade80',borderRadius:8,fontSize:13,fontWeight:600}}>
            ✓ Offer submitted — resolution at midnight
          </div>
          <button onClick={() => call('DELETE')} disabled={loading}
            style={{padding:'8px 12px',background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:8,fontSize:12,cursor:'pointer'}}>
            Withdraw offer
          </button>
        </div>
      ) : (
        <button
          onClick={() => capInfo?.canSign ? call('POST') : null}
          disabled={loading || (capInfo ? !capInfo.canSign : false)}
          style={{
            padding:'10px 20px',
            background: !capInfo ? '#e2dcd5' : capInfo.canSign ? '#1a1512' : '#e2dcd5',
            color: !capInfo ? '#8a8279' : capInfo.canSign ? '#faf8f5' : '#8a8279',
            border:'none', borderRadius:8, fontSize:14, fontWeight:700,
            cursor: capInfo?.canSign ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.7 : 1,
          }}>
          {loading ? 'Submitting...' : capInfo ? `Make Offer — ${fmt(capInfo.playerSalary)} / 1yr` : 'Loading...'}
        </button>
      )}

      {msg && (
        <div style={{marginTop:8,fontSize:12,color:msg.includes('rror')||msg.includes('❌')?'#dc2626':'#15803d',fontWeight:500}}>
          {msg}
        </div>
      )}
    </div>
  )
}

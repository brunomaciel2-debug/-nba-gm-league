'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function OfferButton({ playerId, isAssigned }: { playerId: number, isAssigned: boolean }) {
  const [gmTeamId, setGmTeamId] = useState<string|null>(null)
  const [offered, setOffered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('gm_profiles').select('team_id').eq('id', user.id).single()
        .then(({ data }) => {
          if (!data?.team_id) return
          setGmTeamId(data.team_id)
          supabase.from('fa_offers').select('id').eq('player_id', playerId).eq('team_id', data.team_id).maybeSingle()
            .then(({ data: offer }) => { if (offer) setOffered(true) })
        })
    })
  }, [playerId])

  if (!gmTeamId) return null

  if (isAssigned) return (
    <div style={{marginTop:16,padding:'10px 16px',background:'#f0ece5',border:'1px solid #d4cdc5',borderRadius:8,fontSize:13,color:'#8a8279'}}>
      On NBA assignment - cannot be signed by other teams
    </div>
  )

  const call = async (method: string) => {
    setLoading(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg('Not logged in'); setLoading(false); return }
    const res = await fetch('/api/fa/offer', {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+session.access_token },
      body: JSON.stringify({ playerId })
    })
    const json = await res.json()
    if (res.ok) { setOffered(method==='POST'); setMsg(method==='POST' ? 'Offer submitted! Resolution at midnight.' : '') }
    else setMsg(json.error || 'Error')
    setLoading(false)
  }

  return (
    <div style={{marginTop:16}}>
      {offered ? (
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <div style={{padding:'8px 14px',background:'#1a3a2a',color:'#4ade80',borderRadius:8,fontSize:13,fontWeight:600}}>
            Offer submitted - resolution at midnight
          </div>
          <button onClick={()=>call('DELETE')} disabled={loading}
            style={{padding:'8px 12px',background:'#3a1a1a',color:'#f87171',border:'none',borderRadius:8,fontSize:12,cursor:'pointer'}}>
            Withdraw offer
          </button>
        </div>
      ) : (
        <button onClick={()=>call('POST')} disabled={loading}
          style={{padding:'10px 20px',background:'#1a1512',color:'#faf8f5',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:loading?'wait':'pointer',opacity:loading?0.7:1}}>
          {loading ? 'Submitting...' : 'Make Offer - $650k / 1yr'}
        </button>
      )}
      {msg && <div style={{marginTop:8,fontSize:12,color:msg.includes('rror')?'#f87171':'#4ade80'}}>{msg}</div>}
    </div>
  )
}

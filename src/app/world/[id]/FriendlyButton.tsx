'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function FriendlyButton({ worldTeamId, worldTeamName }: {
  worldTeamId: string, worldTeamName: string
}) {
  const [user, setUser]         = useState<any>(null)
  const [myTeam, setMyTeam]     = useState<any>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [date, setDate]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase.from('profiles').select('team_id, teams(id,name,color,logo_url)')
          .eq('id', data.user.id).single()
          .then(({ data: p }) => setMyTeam(p?.teams||null))
      }
    })
  }, [])

  const propose = async () => {
    if (!date || !myTeam) return
    setError('')
    setSaving(true)

    const d = new Date(date)
    const dayBefore = new Date(d); dayBefore.setDate(d.getDate()-1)
    const dayAfter  = new Date(d); dayAfter.setDate(d.getDate()+1)

    // Check world team not already booked on this day or adjacent
    const { data: conflicts } = await supabase
      .from('friendly_requests')
      .select('scheduled_date')
      .eq('world_team_id', worldTeamId)
      .in('status', ['pending','confirmed'])
      .gte('scheduled_date', dayBefore.toISOString().slice(0,10))
      .lte('scheduled_date', dayAfter.toISOString().slice(0,10))

    if (conflicts && conflicts.length > 0) {
      setError(`${worldTeamName} is already booked on or near that date (they need a rest day before and after each game).`)
      setSaving(false)
      return
    }

    // Check NBA team not already booked
    const { data: nbaConflicts } = await supabase
      .from('friendly_requests')
      .select('scheduled_date')
      .eq('nba_team_id', myTeam.id)
      .in('status', ['pending','confirmed'])
      .gte('scheduled_date', dayBefore.toISOString().slice(0,10))
      .lte('scheduled_date', dayAfter.toISOString().slice(0,10))

    if (nbaConflicts && nbaConflicts.length > 0) {
      setError(`Your team already has a friendly on or near that date.`)
      setSaving(false)
      return
    }

    const { error: err } = await supabase.from('friendly_requests').insert({
      nba_team_id: myTeam.id,
      world_team_id: worldTeamId,
      scheduled_date: date,
      status: 'confirmed',
    })

    if (err) { setError('Failed to schedule. Try again.'); setSaving(false); return }
    setSaving(false)
    setDone(true)
    setShowPicker(false)
  }

  if (!user) return (
    <div style={{padding:'12px 20px',borderRadius:10,background:'#f0ece5',border:'1px solid #d4cdc5',
                 textAlign:'center',fontSize:12,color:'#8a8279'}}>
      <Link href="/login" style={{color:'#c8102e',fontWeight:600,textDecoration:'none'}}>Sign in</Link> to propose a friendly
    </div>
  )

  if (!myTeam) return (
    <div style={{padding:'12px 20px',borderRadius:10,background:'#f0ece5',border:'1px solid #d4cdc5',
                 textAlign:'center',fontSize:12,color:'#8a8279'}}>
      You need to manage an NBA team to propose a friendly.
    </div>
  )

  if (done) return (
    <div style={{padding:'12px 20px',borderRadius:10,background:'#dcfce7',border:'1px solid #15803d',
                 textAlign:'center',fontSize:13,fontWeight:600,color:'#15803d'}}>
      ✓ Friendly confirmed! Check your team's schedule.
    </div>
  )

  return (
    <div style={{flexShrink:0}}>
      {!showPicker ? (
        <button onClick={() => setShowPicker(true)}
          style={{padding:'12px 24px',borderRadius:10,background:'#c8102e',color:'#fff',
                  border:'none',cursor:'pointer',fontSize:14,fontWeight:700}}>
          📅 Propose Friendly
        </button>
      ) : (
        <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:16,minWidth:280}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1a1512',marginBottom:8}}>
            Schedule friendly vs {worldTeamName}
          </div>
          <div style={{fontSize:11,color:'#5c554e',marginBottom:12}}>
            Select a pre-season date. The team needs rest on the day before and after.
          </div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            min="2025-09-01" max="2025-10-20"
            style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #d4cdc5',
                    background:'#f0ece5',color:'#1a1512',fontSize:13,marginBottom:8,
                    boxSizing:'border-box' as any,outline:'none'}}/>
          {error && (
            <div style={{fontSize:11,color:'#dc2626',marginBottom:8,lineHeight:1.4}}>{error}</div>
          )}
          <div style={{display:'flex',gap:8}}>
            <button onClick={propose} disabled={!date||saving}
              style={{flex:1,padding:'8px',borderRadius:8,background:saving?'#8a8279':'#c8102e',
                      color:'#fff',border:'none',cursor:saving?'default':'pointer',
                      fontSize:13,fontWeight:700}}>
              {saving ? 'Saving...' : 'Confirm'}
            </button>
            <button onClick={() => { setShowPicker(false); setError('') }}
              style={{padding:'8px 16px',borderRadius:8,background:'#f0ece5',
                      color:'#5c554e',border:'1px solid #d4cdc5',cursor:'pointer',fontSize:13}}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Need Link import
import Link from 'next/link'

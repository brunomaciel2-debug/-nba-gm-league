'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

type Slot = {
  id: string
  slot_type: string
  fill_pct: number
  credits_available: number
  locked: boolean
}

type Player = {
  id: number
  name: string
  pos: string
  photo_url?: string
  [key: string]: any
}

const SLOT_CONFIG: Record<string, {
  label: string, icon: string, color: string, bg: string,
  attrs: { key: string, label: string }[]
}> = {
  offense: {
    label: 'Offense', icon: '🏀', color: '#b45309', bg: '#fef3c7',
    attrs: [
      {key:'three',label:'3PT'},{key:'layup',label:'Layup'},{key:'dunk',label:'Dunk'},
      {key:'mid',label:'Mid-Range'},{key:'ft',label:'Free Throw'},
      {key:'siq',label:'Shot IQ'},{key:'draw_foul',label:'Draw Foul'},
    ]
  },
  defense: {
    label: 'Defense', icon: '🛡️', color: '#15803d', bg: '#dcfce7',
    attrs: [
      {key:'blk',label:'Block'},{key:'stl',label:'Steal'},
      {key:'idef',label:'Interior Def'},{key:'pdef',label:'Perimeter Def'},
    ]
  },
  physical: {
    label: 'Physical', icon: '💪', color: '#6d28d9', bg: '#ede9fe',
    attrs: [
      {key:'stamina',label:'Stamina'},{key:'durability',label:'Durability'},
      {key:'def_reb',label:'Def Reb'},{key:'off_reb',label:'Off Reb'},
    ]
  },
  playmaking: {
    label: 'Playmaking', icon: '🎯', color: '#1d4ed8', bg: '#dbeafe',
    attrs: [
      {key:'ball_hdl',label:'Ball Handle'},{key:'pass_vis',label:'Pass Vision'},
      {key:'pass_iq',label:'Pass IQ'},{key:'assist_role',label:'Assist Role'},
    ]
  },
  mental: {
    label: 'Mental', icon: '🧠', color: '#0e7490', bg: '#cffafe',
    attrs: [
      {key:'pressure',label:'Clutch'},{key:'consistency',label:'Consistency'},
      {key:'crowd_effect',label:'Crowd Effect'},{key:'streaky',label:'Streaky'},
    ]
  },
  recovery: {
    label: 'Recovery', icon: '🏊', color: '#dc2626', bg: '#fee2e2',
    attrs: [
      {key:'stamina',label:'Stamina'},{key:'durability',label:'Durability'},
    ]
  },
  shooting: {
    label: 'Shooting Lab', icon: '🎯', color: '#c2410c', bg: '#ffedd5',
    attrs: [
      {key:'three',label:'3PT'},{key:'ft',label:'Free Throw'},{key:'mid',label:'Mid-Range'},
    ]
  },
  analytics: {
    label: 'Analytics', icon: '📊', color: '#4338ca', bg: '#e0e7ff',
    attrs: [
      {key:'siq',label:'Shot IQ'},{key:'pass_iq',label:'Pass IQ'},
      {key:'pressure',label:'Clutch'},{key:'consistency',label:'Consistency'},
    ]
  },
}

const UNLOCK_REQ: Record<string, string> = {
  playmaking: 'Grade C Gym required',
  mental: 'Mental Coach required',
  recovery: 'Pool or Sauna required',
  shooting: 'Shooting Lab required',
  analytics: 'Grade A Gym required',
}

function SlotCard({ slot, onSelect, selected }: {
  slot: Slot, onSelect: (s: Slot) => void, selected: boolean
}) {
  const cfg = SLOT_CONFIG[slot.slot_type]
  if (!cfg) return null

  const pct = Math.min(100, Math.max(0, slot.fill_pct))
  const isFull = pct >= 100
  const hasCredits = slot.credits_available > 0

  return (
    <div
      onClick={() => !slot.locked && onSelect(slot)}
      style={{
        background: slot.locked ? '#f5f2ee' : selected ? cfg.bg : '#faf8f5',
        border: `1px solid ${selected ? cfg.color : slot.locked ? '#e2dcd5' : '#d4cdc5'}`,
        borderTop: selected ? `3px solid ${cfg.color}` : '1px solid transparent',
        borderRadius: 12,
        padding: 16,
        cursor: slot.locked ? 'not-allowed' : 'pointer',
        opacity: slot.locked ? 0.6 : 1,
        transition: 'all 0.15s',
      }}
    >
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
        <span style={{fontSize:18}}>{slot.locked ? '🔒' : cfg.icon}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:slot.locked?'#8a8279':cfg.color}}>{cfg.label}</div>
          {slot.locked && (
            <div style={{fontSize:10,color:'#b0a89e'}}>{UNLOCK_REQ[slot.slot_type]}</div>
          )}
        </div>
        {hasCredits && (
          <div style={{
            background: cfg.color, color: '#fff',
            fontSize: 11, fontWeight: 700,
            padding: '2px 8px', borderRadius: 20,
          }}>
            {slot.credits_available} credits
          </div>
        )}
      </div>

      {!slot.locked && (
        <>
          {/* Progress bar */}
          <div style={{height:8,background:'#e2dcd5',borderRadius:4,overflow:'hidden',marginBottom:6}}>
            <div style={{
              height:'100%',
              width: pct + '%',
              background: isFull ? cfg.color : cfg.color + '88',
              borderRadius: 4,
              transition: 'width 0.3s',
            }}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11}}>
            <span style={{color:'#8a8279'}}>{Math.round(pct)}% filled</span>
            <span style={{color: isFull ? cfg.color : '#8a8279', fontWeight: isFull ? 700 : 400}}>
              {isFull ? '✓ Ready to spend!' : `${(100-pct).toFixed(0)}% to go`}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export default function TrainingTab({ teamId, teamColor, players }: {
  teamId: string
  teamColor: string
  players: Player[]
}) {
  const { profile } = useAuth()
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [allocation, setAllocation] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('training_slots').select('*').eq('team_id', teamId)
      .order('locked').then(({ data }) => {
        setSlots(data || [])
        setLoading(false)
      })
  }, [teamId])

  const cfg = selectedSlot ? SLOT_CONFIG[selectedSlot.slot_type] : null
  const creditsLeft = selectedSlot ? selectedSlot.credits_available - Object.values(allocation).reduce((a,b) => a+b, 0) : 0
  const totalAllocated = Object.values(allocation).reduce((a,b) => a+b, 0)

  const handleSpend = async () => {
    if (!selectedSlot || !selectedPlayer || totalAllocated === 0) return
    setSaving(true)
    setMsg('')

    const updates: any[] = []
    for (const [attr, pts] of Object.entries(allocation)) {
      if (pts > 0) {
        const current = selectedPlayer[attr] || 0
        updates.push({ attr, pts, newVal: Math.min(99, current + pts) })
      }
    }

    // Update player attributes
    const playerUpdate: Record<string, number> = {}
    for (const u of updates) playerUpdate[u.attr] = u.newVal
    await supabase.from('players').update(playerUpdate).eq('id', selectedPlayer.id)

    // Deduct credits and reset slot
    const newCredits = selectedSlot.credits_available - totalAllocated
    const resetSlot = newCredits <= 0
    await supabase.from('training_slots').update({
      credits_available: Math.max(0, newCredits),
      fill_pct: resetSlot ? 0 : selectedSlot.fill_pct,
    }).eq('id', selectedSlot.id)

    // Log
    for (const u of updates) {
      await supabase.from('training_log').insert({
        team_id: teamId,
        player_id: selectedPlayer.id,
        slot_type: selectedSlot.slot_type,
        attribute: u.attr,
        points_added: u.pts,
        credits_used: u.pts,
        season: '2025-26',
      })
    }

    // Update local state
    setSlots(prev => prev.map(s => s.id === selectedSlot.id
      ? { ...s, credits_available: Math.max(0, newCredits), fill_pct: resetSlot ? 0 : s.fill_pct }
      : s
    ))
    setSelectedSlot(prev => prev ? { ...prev, credits_available: Math.max(0, newCredits), fill_pct: resetSlot ? 0 : prev.fill_pct } : null)
    setAllocation({})
    setSelectedPlayer(null)
    setMsg('Training applied! Player attributes updated.')
    setSaving(false)
  }

  if (loading) return <div className="text-center py-8" style={{color:'#8a8279'}}>Loading training data...</div>

  const unlockedSlots = slots.filter(s => !s.locked)
  const lockedSlots   = slots.filter(s => s.locked)
  const readySlots    = unlockedSlots.filter(s => s.credits_available > 0)

  return (
    <div>
      {/* Summary bar */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          { label: 'Active slots', val: unlockedSlots.length },
          { label: 'Ready to spend', val: readySlots.length, highlight: readySlots.length > 0 },
          { label: 'Locked slots', val: lockedSlots.length },
          { label: 'Total credits', val: unlockedSlots.reduce((a,s) => a+s.credits_available, 0) },
        ].map(item => (
          <div key={item.label} style={{
            background: item.highlight ? teamColor + '18' : '#f0ece5',
            border: `1px solid ${item.highlight ? teamColor : '#d4cdc5'}`,
            borderRadius: 8, padding: '8px 14px',
          }}>
            <div style={{fontSize:10,color:'#8a8279'}}>{item.label}</div>
            <div style={{fontSize:18,fontWeight:700,color: item.highlight ? teamColor : '#1a1512'}}>{item.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:20,alignItems:'flex-start'}}>
        {/* SLOTS GRID */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',
                       color:'#8a8279',marginBottom:8}}>Training Slots</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
            {unlockedSlots.map(slot => (
              <SlotCard key={slot.id} slot={slot}
                selected={selectedSlot?.id === slot.id}
                onSelect={setSelectedSlot}/>
            ))}
          </div>

          {lockedSlots.length > 0 && (
            <>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',
                           color:'#b0a89e',marginBottom:8}}>Locked Slots</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {lockedSlots.map(slot => (
                  <SlotCard key={slot.id} slot={slot}
                    selected={false} onSelect={() => {}}/>
                ))}
              </div>
            </>
          )}
        </div>

        {/* SPEND PANEL */}
        <div style={{width:240,flexShrink:0,background:'#faf8f5',
                     border:'1px solid #d4cdc5',borderRadius:12,padding:16}}>
          {!selectedSlot ? (
            <p style={{fontSize:13,color:'var(--color-text-tertiary)',lineHeight:1.5}}>
              Select a slot to spend training credits on your players.
            </p>
          ) : selectedSlot.credits_available === 0 ? (
            <>
              <div style={{fontSize:13,fontWeight:600,color:cfg?.color,marginBottom:4}}>
                {cfg?.icon} {cfg?.label}
              </div>
              <p style={{fontSize:12,color:'#8a8279',lineHeight:1.5}}>
                This slot is filling up. Come back when it reaches 100% to spend credits.
              </p>
              <div style={{marginTop:12,fontSize:12}}>
                <div style={{height:6,background:'#e2dcd5',borderRadius:3,overflow:'hidden',marginBottom:4}}>
                  <div style={{height:'100%',width:selectedSlot.fill_pct+'%',background:cfg?.color+'88',borderRadius:3}}/>
                </div>
                <span style={{color:'#8a8279'}}>{Math.round(selectedSlot.fill_pct)}% filled</span>
              </div>
            </>
          ) : (
            <>
              <div style={{fontSize:13,fontWeight:600,color:cfg?.color,marginBottom:2}}>
                {cfg?.icon} {cfg?.label}
              </div>
              <div style={{fontSize:11,color:'#8a8279',marginBottom:12}}>
                {selectedSlot.credits_available} credits available
              </div>

              {/* Player selector */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:'#5c554e',marginBottom:6}}>Select player</div>
                <div style={{maxHeight:140,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                  {players.map(p => (
                    <div key={p.id} onClick={() => { setSelectedPlayer(p); setAllocation({}) }}
                      style={{
                        display:'flex',alignItems:'center',gap:8,padding:'6px 8px',
                        borderRadius:6,cursor:'pointer',
                        background: selectedPlayer?.id===p.id ? teamColor+'18' : 'transparent',
                        border: `1px solid ${selectedPlayer?.id===p.id ? teamColor : 'transparent'}`,
                      }}>
                      <div style={{width:24,height:24,borderRadius:'50%',overflow:'hidden',flexShrink:0,
                                   background:'#e8e2d6',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {p.photo_url
                          ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          : <span style={{fontSize:8,fontWeight:700,color:'#5c554e'}}>
                              {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                            </span>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:500,color:'#1a1512',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                        <div style={{fontSize:10,color:'#8a8279'}}>{p.pos}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attribute allocation */}
              {selectedPlayer && (
                <>
                  <div style={{fontSize:11,fontWeight:600,color:'#5c554e',marginBottom:6}}>
                    Allocate credits <span style={{color:creditsLeft>0?cfg?.color:'#dc2626'}}>({creditsLeft} left)</span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                    {cfg?.attrs.map(attr => {
                      const current = selectedPlayer[attr.key] || 0
                      const added = allocation[attr.key] || 0
                      return (
                        <div key={attr.key} style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{flex:1,fontSize:11,color:'#5c554e'}}>{attr.label}</div>
                          <span style={{fontSize:10,color:'#8a8279',minWidth:20}}>{current}</span>
                          <div style={{display:'flex',alignItems:'center',gap:3}}>
                            <button onClick={() => setAllocation(prev => ({...prev,[attr.key]:Math.max(0,(prev[attr.key]||0)-1)}))}
                              disabled={!added}
                              style={{width:18,height:18,borderRadius:4,border:'1px solid #d4cdc5',
                                      background:'#f0ece5',cursor:added?'pointer':'not-allowed',
                                      fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',color:'#5c554e'}}>−</button>
                            <span style={{fontSize:11,fontWeight:600,color:cfg?.color,minWidth:14,textAlign:'center'}}>{added}</span>
                            <button onClick={() => {
                              if (creditsLeft > 0 && (allocation[attr.key]||0) < 3 && current + (allocation[attr.key]||0) < 99)
                                setAllocation(prev => ({...prev,[attr.key]:(prev[attr.key]||0)+1}))
                            }}
                              disabled={creditsLeft<=0||(allocation[attr.key]||0)>=3||current>=99}
                              style={{width:18,height:18,borderRadius:4,border:'1px solid #d4cdc5',
                                      background:creditsLeft>0?cfg?.color+'22':'#f0ece5',
                                      cursor:creditsLeft>0?'pointer':'not-allowed',
                                      fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',color:cfg?.color}}>+</button>
                          </div>
                          {added > 0 && (
                            <span style={{fontSize:10,color:cfg?.color,fontWeight:600}}>→{current+added}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {isGM && (
                    <button onClick={handleSpend}
                      disabled={totalAllocated===0||saving}
                      style={{width:'100%',padding:'8px',fontSize:12,fontWeight:500,
                              border:'none',borderRadius:8,
                              background:totalAllocated>0?cfg?.color:'#e2dcd5',
                              color:totalAllocated>0?'#fff':'#8a8279',
                              cursor:totalAllocated>0?'pointer':'not-allowed'}}>
                      {saving ? 'Applying...' : `Apply ${totalAllocated} credit${totalAllocated!==1?'s':''}`}
                    </button>
                  )}
                  {!isGM && <p style={{fontSize:11,color:'#8a8279',marginTop:8}}>Only the GM can spend credits.</p>}
                  {msg && <p style={{fontSize:11,color:'#15803d',marginTop:6}}>{msg}</p>}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info footer */}
      <div style={{marginTop:16,padding:'10px 14px',background:'#f0ece5',borderRadius:8,fontSize:11,color:'#6b5f4e',lineHeight:1.6}}>
        Slots fill automatically each week based on your coaching staff and facility quality.
        A full slot gives 5 credits to spend on player attributes.
        Max 3 credits per player per cycle. Unlock advanced slots by upgrading your facilities.
      </div>
    </div>
  )
}

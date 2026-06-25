'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

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
  offense:    { label:'Offense',      icon:'🏀', color:'#b45309', bg:'#fef3c7', attrs:[{key:'three',label:'3PT'},{key:'layup',label:'Layup'},{key:'dunk',label:'Dunk'},{key:'mid',label:'Mid-Range'},{key:'ft',label:'Free Throw'},{key:'siq',label:'Shot IQ'},{key:'draw_foul',label:'Draw Foul'}] },
  defense:    { label:'Defense',      icon:'🛡️', color:'#15803d', bg:'#dcfce7', attrs:[{key:'blk',label:'Block'},{key:'stl',label:'Steal'},{key:'idef',label:'Interior Def'},{key:'pdef',label:'Perimeter Def'}] },
  physical:   { label:'Physical',     icon:'💪', color:'#6d28d9', bg:'#ede9fe', attrs:[{key:'stamina',label:'Stamina'},{key:'durability',label:'Durability'},{key:'def_reb',label:'Def Reb'},{key:'off_reb',label:'Off Reb'}] },
  playmaking: { label:'Playmaking',   icon:'🎯', color:'#1d4ed8', bg:'#dbeafe', attrs:[{key:'ball_hdl',label:'Ball Handle'},{key:'pass_vis',label:'Pass Vision'},{key:'pass_iq',label:'Pass IQ'},{key:'assist_role',label:'Assist Role'}] },
  mental:     { label:'Mental',       icon:'🧠', color:'#0e7490', bg:'#cffafe', attrs:[{key:'pressure',label:'Clutch'},{key:'consistency',label:'Consistency'},{key:'crowd_effect',label:'Crowd Effect'},{key:'streaky',label:'Streaky'}] },
  recovery:   { label:'Recovery',     icon:'🏊', color:'#dc2626', bg:'#fee2e2', attrs:[{key:'stamina',label:'Stamina'},{key:'durability',label:'Durability'}] },
  shooting:   { label:'Shooting Lab', icon:'🎯', color:'#c2410c', bg:'#ffedd5', attrs:[{key:'three',label:'3PT'},{key:'ft',label:'Free Throw'},{key:'mid',label:'Mid-Range'}] },
  analytics:  { label:'Analytics',    icon:'📊', color:'#4338ca', bg:'#e0e7ff', attrs:[{key:'siq',label:'Shot IQ'},{key:'pass_iq',label:'Pass IQ'},{key:'pressure',label:'Clutch'},{key:'consistency',label:'Consistency'}] },
}

const UNLOCK_REQ: Record<string, string> = {
  playmaking: 'Upgrade to Grade D Gym',
  mental:     'Mental Coach required',
  recovery:   'Build Pool or Sauna',
  shooting:   'Build Shooting Machine',
  analytics:  'Upgrade to Grade A Gym',
}

function SlotCard({ slot, onSelect, selected, weeklySpeed }: {
  slot: Slot, onSelect: (s: Slot) => void, selected: boolean, weeklySpeed?: number
}) {
  const cfg = SLOT_CONFIG[slot.slot_type]
  if (!cfg) return null

  const pct = Math.min(100, Math.max(0, slot.fill_pct))
  const isFull = pct >= 100
  const hasCredits = slot.credits_available > 0
  const weeksToFull = weeklySpeed && weeklySpeed > 0 && !isFull ? Math.ceil((100 - pct) / weeklySpeed) : null

  return (
    <div onClick={() => !slot.locked && onSelect(slot)}
      style={{
        background: slot.locked ? '#f5f2ee' : selected ? cfg.bg : '#faf8f5',
        border: `1px solid ${selected ? cfg.color : slot.locked ? '#e2dcd5' : '#d4cdc5'}`,
        borderTop: `3px solid ${selected ? cfg.color : slot.locked ? '#e2dcd5' : isFull ? cfg.color : '#d4cdc5'}`,
        borderRadius: 12, padding: 16,
        cursor: slot.locked ? 'not-allowed' : 'pointer',
        opacity: slot.locked ? 0.55 : 1,
        transition: 'all 0.15s',
        position: 'relative' as const,
      }}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <span style={{fontSize:20}}>{slot.locked ? '🔒' : cfg.icon}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:slot.locked?'#9a8a78':cfg.color}}>{cfg.label}</div>
          {slot.locked
            ? <div style={{fontSize:10,color:'#b0a89e',marginTop:1}}>{UNLOCK_REQ[slot.slot_type]}</div>
            : <div style={{fontSize:10,color:'#8a8279',marginTop:1}}>
                {weeklySpeed ? `+${weeklySpeed}%/week` : 'Speed depends on staff & gym'}
              </div>
          }
        </div>
        {hasCredits && (
          <div style={{background:cfg.color,color:'#fff',fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,flexShrink:0}}>
            {slot.credits_available} {slot.credits_available===1?'credit':'credits'}
          </div>
        )}
      </div>

      {!slot.locked && (
        <>
          {/* Big progress bar */}
          <div style={{position:'relative',marginBottom:6}}>
            <div style={{height:14,background:'#e2dcd5',borderRadius:7,overflow:'hidden'}}>
              <div style={{
                height:'100%',
                width: pct + '%',
                background: isFull
                  ? `linear-gradient(90deg, ${cfg.color}, ${cfg.color}cc)`
                  : `linear-gradient(90deg, ${cfg.color}66, ${cfg.color}99)`,
                borderRadius: 7,
                transition: 'width 0.4s ease',
                position: 'relative' as const,
              }}>
                {isFull && (
                  <div style={{
                    position:'absolute',top:0,left:0,right:0,bottom:0,
                    background:'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,0.15) 4px,rgba(255,255,255,0.15) 8px)',
                  }}/>
                )}
              </div>
            </div>
            {/* Percentage label inside/outside bar */}
            <div style={{
              position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',
              fontSize:10,fontWeight:700,
              color: pct > 60 ? '#fff' : cfg.color,
            }}>
              {Math.round(pct)}%
            </div>
          </div>

          {/* Status row */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11}}>
            {isFull ? (
              <span style={{color:cfg.color,fontWeight:700,fontSize:12}}>✓ Ready to spend!</span>
            ) : (
              <span style={{color:'#8a8279'}}>
                {weeksToFull ? `~${weeksToFull} week${weeksToFull===1?'':'s'} to full` : `${(100-pct).toFixed(0)}% remaining`}
              </span>
            )}
            {!isFull && !hasCredits && (
              <span style={{fontSize:10,color:'#b0a89e'}}>Filling...</span>
            )}
          </div>

          {/* Segment markers */}
          <div style={{display:'flex',gap:2,marginTop:8}}>
            {[25,50,75,100].map(mark => (
              <div key={mark} style={{
                flex:1,height:3,borderRadius:2,
                background: pct >= mark ? cfg.color : '#e2dcd5',
                transition:'background 0.3s',
              }}/>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#b0a89e',marginTop:2}}>
            <span>25%</span><span>50%</span><span>75%</span><span>Full</span>
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
    const playerUpdate: Record<string, number> = {}
    const logs: any[] = []
    for (const [attr, pts] of Object.entries(allocation)) {
      if (pts > 0) {
        playerUpdate[attr] = Math.min(99, (selectedPlayer[attr] || 0) + pts)
        logs.push({ team_id:teamId, player_id:selectedPlayer.id, slot_type:selectedSlot.slot_type, attribute:attr, points_added:pts, credits_used:pts, season:'2025-26' })
      }
    }
    await supabase.from('players').update(playerUpdate).eq('id', selectedPlayer.id)
    const newCredits = selectedSlot.credits_available - totalAllocated
    const resetSlot = newCredits <= 0
    await supabase.from('training_slots').update({ credits_available: Math.max(0,newCredits), fill_pct: resetSlot?0:selectedSlot.fill_pct }).eq('id', selectedSlot.id)
    if (logs.length) await supabase.from('training_log').insert(logs)
    setSlots(prev => prev.map(s => s.id===selectedSlot.id ? {...s, credits_available:Math.max(0,newCredits), fill_pct:resetSlot?0:s.fill_pct} : s))
    setSelectedSlot(prev => prev ? {...prev, credits_available:Math.max(0,newCredits), fill_pct:resetSlot?0:prev.fill_pct} : null)
    setAllocation({})
    setSelectedPlayer(null)
    setMsg('Training applied! Attributes updated.')
    setSaving(false)
  }

  if (loading) return <div className="text-center py-8" style={{color:'#8a8279'}}>Loading training data...</div>

  const unlockedSlots = slots.filter(s => !s.locked)
  const lockedSlots   = slots.filter(s => s.locked)
  const readySlots    = unlockedSlots.filter(s => s.credits_available > 0)
  const totalCredits  = unlockedSlots.reduce((a,s) => a+s.credits_available, 0)

  return (
    <div>
      {/* Summary bar */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          { label:'Active slots',    val:unlockedSlots.length, highlight:false },
          { label:'Ready to spend',  val:readySlots.length,   highlight:readySlots.length>0 },
          { label:'Total credits',   val:totalCredits,         highlight:totalCredits>0 },
          { label:'Locked slots',    val:lockedSlots.length,  highlight:false },
        ].map(item => (
          <div key={item.label} style={{
            background: item.highlight ? teamColor+'18' : '#f0ece5',
            border:`1px solid ${item.highlight ? teamColor : '#d4cdc5'}`,
            borderRadius:8, padding:'8px 14px',
          }}>
            <div style={{fontSize:10,color:'#8a8279'}}>{item.label}</div>
            <div style={{fontSize:18,fontWeight:700,color:item.highlight?teamColor:'#1a1512'}}>{item.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:20,alignItems:'flex-start'}}>

        {/* SLOTS */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:8}}>
            Active Slots
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            {unlockedSlots.map(slot => (
              <SlotCard key={slot.id} slot={slot}
                selected={selectedSlot?.id===slot.id}
                onSelect={setSelectedSlot}
                weeklySpeed={12}/>
            ))}
          </div>

          {lockedSlots.length > 0 && (
            <>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#b0a89e',marginBottom:8}}>
                Locked Slots
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
                {lockedSlots.map(slot => (
                  <SlotCard key={slot.id} slot={slot} selected={false} onSelect={()=>{}}/>
                ))}
              </div>
            </>
          )}
        </div>

        {/* SPEND PANEL */}
        <div style={{width:240,flexShrink:0,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:16}}>
          {!selectedSlot ? (
            <p style={{fontSize:13,color:'#8a8279',lineHeight:1.6}}>
              Select an active slot to spend training credits on your players.
            </p>
          ) : selectedSlot.credits_available === 0 ? (
            <>
              <div style={{fontSize:13,fontWeight:700,color:cfg?.color,marginBottom:8}}>
                {cfg?.icon} {cfg?.label}
              </div>
              <div style={{height:8,background:'#e2dcd5',borderRadius:4,overflow:'hidden',marginBottom:8}}>
                <div style={{height:'100%',width:selectedSlot.fill_pct+'%',background:cfg?.color+'88',borderRadius:4}}/>
              </div>
              <p style={{fontSize:12,color:'#8a8279',lineHeight:1.5,marginBottom:4}}>
                {Math.round(selectedSlot.fill_pct)}% full — keep filling to earn 5 credits.
              </p>
              <div style={{fontSize:11,color:'#b0a89e'}}>
                Slots fill automatically each week based on your gym grade and staff.
              </div>
            </>
          ) : (
            <>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                <span style={{fontSize:16}}>{cfg?.icon}</span>
                <span style={{fontSize:13,fontWeight:700,color:cfg?.color}}>{cfg?.label}</span>
              </div>
              <div style={{fontSize:11,color:'#8a8279',marginBottom:12}}>
                {selectedSlot.credits_available} credits available · max 3 per player
              </div>

              {/* Player selector */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:'#5c554e',marginBottom:6}}>Select player</div>
                <div style={{maxHeight:150,overflowY:'auto',display:'flex',flexDirection:'column',gap:3}}>
                  {players.map(p => (
                    <div key={p.id} onClick={() => { setSelectedPlayer(p); setAllocation({}) }}
                      style={{
                        display:'flex',alignItems:'center',gap:8,padding:'6px 8px',
                        borderRadius:6,cursor:'pointer',
                        background:selectedPlayer?.id===p.id?teamColor+'18':'transparent',
                        border:`1px solid ${selectedPlayer?.id===p.id?teamColor:'transparent'}`,
                      }}>
                      <div style={{width:26,height:26,borderRadius:'50%',overflow:'hidden',flexShrink:0,
                                   background:'#e8e2d6',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {p.photo_url
                          ?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          :<span style={{fontSize:8,fontWeight:700,color:'#5c554e'}}>{p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</span>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:500,color:'#1a1512',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                        <div style={{fontSize:9,color:'#8a8279'}}>{p.pos}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attribute allocation */}
              {selectedPlayer && (
                <>
                  <div style={{fontSize:11,fontWeight:600,color:'#5c554e',marginBottom:6}}>
                    Allocate credits{' '}
                    <span style={{color:creditsLeft>0?cfg?.color:'#dc2626',fontWeight:700}}>
                      ({creditsLeft} left)
                    </span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:12}}>
                    {cfg?.attrs.map(attr => {
                      const current = selectedPlayer[attr.key] || 0
                      const added = allocation[attr.key] || 0
                      return (
                        <div key={attr.key} style={{display:'flex',alignItems:'center',gap:5}}>
                          <div style={{flex:1,fontSize:11,color:'#5c554e'}}>{attr.label}</div>
                          <span style={{fontSize:10,color:'#8a8279',minWidth:22,textAlign:'right'}}>{current}</span>
                          <div style={{display:'flex',alignItems:'center',gap:2}}>
                            <button onClick={() => setAllocation(prev=>({...prev,[attr.key]:Math.max(0,(prev[attr.key]||0)-1)}))}
                              disabled={!added}
                              style={{width:20,height:20,borderRadius:4,border:'1px solid #d4cdc5',background:'#f0ece5',
                                      cursor:added?'pointer':'not-allowed',fontSize:13,lineHeight:1,color:'#5c554e'}}>−</button>
                            <span style={{fontSize:11,fontWeight:700,color:cfg?.color,minWidth:16,textAlign:'center'}}>{added}</span>
                            <button onClick={() => {
                              if (creditsLeft>0 && (allocation[attr.key]||0)<3 && current+(allocation[attr.key]||0)<99)
                                setAllocation(prev=>({...prev,[attr.key]:(prev[attr.key]||0)+1}))
                            }}
                              disabled={creditsLeft<=0||(allocation[attr.key]||0)>=3||current>=99}
                              style={{width:20,height:20,borderRadius:4,border:'1px solid #d4cdc5',
                                      background:creditsLeft>0?cfg?.color+'22':'#f0ece5',
                                      cursor:creditsLeft>0?'pointer':'not-allowed',fontSize:13,lineHeight:1,color:cfg?.color}}>+</button>
                          </div>
                          {added>0 && <span style={{fontSize:10,color:cfg?.color,fontWeight:700,minWidth:28}}>→{current+added}</span>}
                        </div>
                      )
                    })}
                  </div>

                  {isGM && (
                    <button onClick={handleSpend} disabled={totalAllocated===0||saving}
                      style={{width:'100%',padding:'9px',fontSize:12,fontWeight:600,border:'none',borderRadius:8,
                              background:totalAllocated>0?cfg?.color:'#e2dcd5',
                              color:totalAllocated>0?'#fff':'#8a8279',
                              cursor:totalAllocated>0?'pointer':'not-allowed'}}>
                      {saving?'Applying...':`Apply ${totalAllocated} credit${totalAllocated!==1?'s':''}`}
                    </button>
                  )}
                  {!isGM && <p style={{fontSize:11,color:'#8a8279',marginTop:8}}>Only the GM can spend credits.</p>}
                  {msg && <p style={{fontSize:11,color:'#15803d',fontWeight:600,marginTop:6}}>✓ {msg}</p>}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{marginTop:16,padding:'10px 14px',background:'#f0ece5',borderRadius:8,fontSize:11,color:'#6b5f4e',lineHeight:1.6}}>
        Slots fill automatically each week · Speed depends on gym grade + staff attributes · Full slot = 5 credits · Max 3 credits per player per cycle · Unlock advanced slots by upgrading facilities
      </div>
    </div>
  )
}

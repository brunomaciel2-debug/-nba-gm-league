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
  attrs: { key: string, label: string, potKey: string }[]
}> = {
  offense:    { label:'Offense',      icon:'🏀', color:'#b45309', bg:'#fef3c7', attrs:[
    {key:'three',label:'3PT',potKey:'pot_three'},{key:'layup',label:'Layup',potKey:'pot_layup'},
    {key:'dunk',label:'Dunk',potKey:'pot_dunk'},{key:'mid',label:'Mid-Range',potKey:'pot_mid'},
    {key:'ft',label:'Free Throw',potKey:'pot_ft'},{key:'siq',label:'Shot IQ',potKey:'pot_siq'},
    {key:'draw_foul',label:'Draw Foul',potKey:'pot_draw_foul'},
  ]},
  defense:    { label:'Defense',      icon:'🛡️', color:'#15803d', bg:'#dcfce7', attrs:[
    {key:'blk',label:'Block',potKey:'pot_blk'},{key:'stl',label:'Steal',potKey:'pot_stl'},
    {key:'idef',label:'Interior Def',potKey:'pot_idef'},{key:'pdef',label:'Perimeter Def',potKey:'pot_pdef'},
  ]},
  physical:   { label:'Physical',     icon:'💪', color:'#6d28d9', bg:'#ede9fe', attrs:[
    {key:'stamina',label:'Stamina',potKey:'pot_stamina'},{key:'durability',label:'Durability',potKey:'pot_durability'},
    {key:'def_reb',label:'Def Reb',potKey:'pot_def_reb'},{key:'off_reb',label:'Off Reb',potKey:'pot_off_reb'},
  ]},
  playmaking: { label:'Playmaking',   icon:'🎯', color:'#1d4ed8', bg:'#dbeafe', attrs:[
    {key:'ball_hdl',label:'Ball Handle',potKey:'pot_ball_hdl'},{key:'pass_vis',label:'Pass Vision',potKey:'pot_pass_vis'},
    {key:'pass_iq',label:'Pass IQ',potKey:'pot_pass_iq'},{key:'assist_role',label:'Assist Role',potKey:'pot_assist_role'},
  ]},
  mental:     { label:'Mental',       icon:'🧠', color:'#0e7490', bg:'#cffafe', attrs:[
    {key:'pressure',label:'Clutch',potKey:'pot_pressure'},{key:'consistency',label:'Consistency',potKey:'pot_consistency'},
    {key:'crowd_effect',label:'Crowd Effect',potKey:'pot_consistency'},{key:'streaky',label:'Streaky',potKey:'pot_consistency'},
  ]},
  recovery:   { label:'Recovery',     icon:'🏊', color:'#dc2626', bg:'#fee2e2', attrs:[
    {key:'stamina',label:'Stamina',potKey:'pot_stamina'},{key:'durability',label:'Durability',potKey:'pot_durability'},
  ]},
  shooting:   { label:'Shooting Lab', icon:'🎯', color:'#c2410c', bg:'#ffedd5', attrs:[
    {key:'three',label:'3PT',potKey:'pot_three'},{key:'ft',label:'Free Throw',potKey:'pot_ft'},
    {key:'mid',label:'Mid-Range',potKey:'pot_mid'},
  ]},
  analytics:  { label:'Analytics',    icon:'📊', color:'#4338ca', bg:'#e0e7ff', attrs:[
    {key:'siq',label:'Shot IQ',potKey:'pot_siq'},{key:'pass_iq',label:'Pass IQ',potKey:'pot_pass_iq'},
    {key:'pressure',label:'Clutch',potKey:'pot_pressure'},{key:'consistency',label:'Consistency',potKey:'pot_consistency'},
  ]},
}

const UNLOCK_REQ: Record<string, string> = {
  playmaking: 'Upgrade to Grade D Gym',
  mental:     'Mental Coach required',
  recovery:   'Build Pool or Sauna',
  shooting:   'Build Shooting Machine',
  analytics:  'Upgrade to Grade A Gym',
}

// Cost to improve an attribute by 1 point
function creditCost(current: number): number {
  if (current <= 60) return 0.5  // 1 credit = +2 points → 0.5 credits per point
  if (current <= 75) return 1
  if (current <= 90) return 2
  return 3
}

// Max points you can add with N credits given current value
function pointsForCredits(current: number, credits: number): number {
  if (current <= 60) return credits * 2
  if (current <= 75) return credits
  if (current <= 90) return Math.floor(credits / 2)
  return Math.floor(credits / 3)
}

// Credits needed to add 1 point
function costForOnePoint(current: number): number {
  if (current <= 60) return 0.5
  if (current <= 75) return 1
  if (current <= 90) return 2
  return 3
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
      }}>
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
            {slot.credits_available} credits
          </div>
        )}
      </div>

      {!slot.locked && (
        <>
          <div style={{position:'relative',marginBottom:6}}>
            <div style={{height:14,background:'#e2dcd5',borderRadius:7,overflow:'hidden'}}>
              <div style={{
                height:'100%', width:pct+'%',
                background: isFull
                  ? `linear-gradient(90deg,${cfg.color},${cfg.color}cc)`
                  : `linear-gradient(90deg,${cfg.color}66,${cfg.color}99)`,
                borderRadius:7, transition:'width 0.4s ease', position:'relative' as const,
              }}>
                {isFull && <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,0.15) 4px,rgba(255,255,255,0.15) 8px)'}}/>}
              </div>
            </div>
            <div style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontSize:10,fontWeight:700,color:pct>60?'#fff':cfg.color}}>
              {Math.round(pct)}%
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:6}}>
            {isFull
              ? <span style={{color:cfg.color,fontWeight:700}}>✓ Ready to spend!</span>
              : <span style={{color:'#8a8279'}}>{weeksToFull?`~${weeksToFull}wk to full`:`${(100-pct).toFixed(0)}% remaining`}</span>
            }
          </div>
          <div style={{display:'flex',gap:2}}>
            {[25,50,75,100].map(mark=>(
              <div key={mark} style={{flex:1,height:3,borderRadius:2,background:pct>=mark?cfg.color:'#e2dcd5',transition:'background 0.3s'}}/>
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
  teamId: string, teamColor: string, players: Player[]
}) {
  const { profile } = useAuth()
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [allocation, setAllocation] = useState<Record<string, number>>({})  // attr -> points to add
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('training_slots').select('*').eq('team_id', teamId)
      .order('locked').then(({ data }) => { setSlots(data||[]); setLoading(false) })
  }, [teamId])

  const cfg = selectedSlot ? SLOT_CONFIG[selectedSlot.slot_type] : null

  // Total credits spent so far in this allocation
  const creditsSpent = selectedPlayer && cfg ? cfg.attrs.reduce((total, attr) => {
    const pts = allocation[attr.key] || 0
    if (pts === 0) return total
    const current = selectedPlayer[attr.key] || 0
    // cost depends on current value range
    return total + pts * costForOnePoint(current)
  }, 0) : 0

  const creditsLeft = selectedSlot ? selectedSlot.credits_available - creditsSpent : 0
  const totalPtsAllocated = Object.values(allocation).reduce((a,b) => a+b, 0)

  // Check if player has reached max 3 credits spent
  const playerCreditsSpent = selectedPlayer && cfg ? cfg.attrs.reduce((total, attr) => {
    const pts = allocation[attr.key] || 0
    if (pts === 0) return total
    const current = selectedPlayer[attr.key] || 0
    return total + pts * costForOnePoint(current)
  }, 0) : 0

  const playerAtMax = playerCreditsSpent >= 3

  const handleAddPoint = (attrKey: string, potKey: string) => {
    if (!selectedPlayer || !selectedSlot) return
    const current = (selectedPlayer[attrKey] || 0) + (allocation[attrKey] || 0)
    const potential = selectedPlayer[potKey] || 99
    if (current >= potential) return  // at potential cap
    if (current >= 99) return
    const cost = costForOnePoint(current)
    if (creditsLeft < cost) return  // not enough credits
    if (playerCreditsSpent + cost > 3) return  // player max reached
    setAllocation(prev => ({...prev, [attrKey]: (prev[attrKey]||0) + 1}))
  }

  const handleRemovePoint = (attrKey: string) => {
    const current = allocation[attrKey] || 0
    if (current <= 0) return
    setAllocation(prev => ({...prev, [attrKey]: current - 1}))
  }

  const handleSpend = async () => {
    if (!selectedSlot || !selectedPlayer || totalPtsAllocated === 0) return
    setSaving(true)
    setMsg('')
    const playerUpdate: Record<string, number> = {}
    const logs: any[] = []
    for (const [attr, pts] of Object.entries(allocation)) {
      if (pts > 0) {
        const newVal = Math.min(99, (selectedPlayer[attr] || 0) + pts)
        playerUpdate[attr] = newVal
        const cost = pts * costForOnePoint(selectedPlayer[attr] || 0)
        logs.push({ team_id:teamId, player_id:selectedPlayer.id, slot_type:selectedSlot.slot_type, attribute:attr, points_added:pts, credits_used:cost, season:'2025-26' })
      }
    }
    await supabase.from('players').update(playerUpdate).eq('id', selectedPlayer.id)
    const newCredits = Math.max(0, selectedSlot.credits_available - creditsSpent)
    const resetSlot = newCredits <= 0
    await supabase.from('training_slots').update({ credits_available: newCredits, fill_pct: resetSlot?0:selectedSlot.fill_pct }).eq('id', selectedSlot.id)
    if (logs.length) await supabase.from('training_log').insert(logs)
    setSlots(prev => prev.map(s => s.id===selectedSlot.id ? {...s, credits_available:newCredits, fill_pct:resetSlot?0:s.fill_pct} : s))
    setSelectedSlot(prev => prev ? {...prev, credits_available:newCredits, fill_pct:resetSlot?0:prev.fill_pct} : null)
    setAllocation({})
    setSelectedPlayer(null)
    setMsg('Training applied!')
    setSaving(false)
  }

  if (loading) return <div className="text-center py-8" style={{color:'#8a8279'}}>Loading...</div>

  const unlockedSlots = slots.filter(s => !s.locked)
  const lockedSlots   = slots.filter(s => s.locked)
  const readySlots    = unlockedSlots.filter(s => s.credits_available > 0)
  const totalCredits  = unlockedSlots.reduce((a,s) => a+s.credits_available, 0)

  return (
    <div>
      {/* Summary */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          {label:'Active slots',   val:unlockedSlots.length, hi:false},
          {label:'Ready to spend', val:readySlots.length,    hi:readySlots.length>0},
          {label:'Total credits',  val:totalCredits,          hi:totalCredits>0},
          {label:'Locked slots',   val:lockedSlots.length,   hi:false},
        ].map(item => (
          <div key={item.label} style={{background:item.hi?teamColor+'18':'#f0ece5',border:`1px solid ${item.hi?teamColor:'#d4cdc5'}`,borderRadius:8,padding:'8px 14px'}}>
            <div style={{fontSize:10,color:'#8a8279'}}>{item.label}</div>
            <div style={{fontSize:18,fontWeight:700,color:item.hi?teamColor:'#1a1512'}}>{item.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:20,alignItems:'flex-start'}}>
        {/* SLOTS GRID */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:8}}>Active Slots</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            {unlockedSlots.map(slot => (
              <SlotCard key={slot.id} slot={slot} selected={selectedSlot?.id===slot.id} onSelect={setSelectedSlot} weeklySpeed={12}/>
            ))}
          </div>
          {lockedSlots.length > 0 && (
            <>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#b0a89e',marginBottom:8}}>Locked Slots</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
                {lockedSlots.map(slot => (
                  <SlotCard key={slot.id} slot={slot} selected={false} onSelect={()=>{}}/>
                ))}
              </div>
            </>
          )}
        </div>

        {/* SPEND PANEL */}
        <div style={{width:250,flexShrink:0,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:16}}>
          {!selectedSlot ? (
            <p style={{fontSize:13,color:'#8a8279',lineHeight:1.6}}>Select an active slot to spend training credits.</p>
          ) : selectedSlot.credits_available === 0 ? (
            <>
              <div style={{fontSize:13,fontWeight:700,color:cfg?.color,marginBottom:8}}>{cfg?.icon} {cfg?.label}</div>
              <div style={{height:8,background:'#e2dcd5',borderRadius:4,overflow:'hidden',marginBottom:8}}>
                <div style={{height:'100%',width:selectedSlot.fill_pct+'%',background:cfg?.color+'88',borderRadius:4}}/>
              </div>
              <p style={{fontSize:12,color:'#8a8279',lineHeight:1.5}}>
                {Math.round(selectedSlot.fill_pct)}% full — needs to reach 100% to earn 10 credits.
              </p>
            </>
          ) : (
            <>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                <span style={{fontSize:16}}>{cfg?.icon}</span>
                <span style={{fontSize:13,fontWeight:700,color:cfg?.color}}>{cfg?.label}</span>
              </div>
              <div style={{fontSize:11,color:'#8a8279',marginBottom:4}}>
                {selectedSlot.credits_available} credits available
              </div>

              {/* Credit scale legend */}
              <div style={{background:'#f0ece5',borderRadius:6,padding:'6px 8px',marginBottom:12,fontSize:10,color:'#5c554e',lineHeight:1.6}}>
                <strong>Credit cost:</strong><br/>
                0-60 → 0.5cr/pt (+2pts per credit)<br/>
                61-75 → 1cr/pt · 76-90 → 2cr/pt · 91-99 → 3cr/pt<br/>
                Max 3 credits per player per cycle
              </div>

              {/* Player selector */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:'#5c554e',marginBottom:6}}>Select player</div>
                <div style={{maxHeight:130,overflowY:'auto',display:'flex',flexDirection:'column',gap:3}}>
                  {players.map(p => (
                    <div key={p.id} onClick={() => { setSelectedPlayer(p); setAllocation({}) }}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,cursor:'pointer',
                              background:selectedPlayer?.id===p.id?teamColor+'18':'transparent',
                              border:`1px solid ${selectedPlayer?.id===p.id?teamColor:'transparent'}`}}>
                      <div style={{width:24,height:24,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'#e8e2d6',display:'flex',alignItems:'center',justifyContent:'center'}}>
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
                  <div style={{fontSize:11,fontWeight:600,color:'#5c554e',marginBottom:4}}>
                    Allocate credits
                    <span style={{marginLeft:6,color:creditsLeft>0?cfg?.color:'#dc2626',fontWeight:700}}>
                      ({creditsLeft.toFixed(1)} left)
                    </span>
                    {playerAtMax && <span style={{marginLeft:4,color:'#dc2626',fontSize:10}}> · player max reached</span>}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:12}}>
                    {cfg?.attrs.map(attr => {
                      const current = selectedPlayer[attr.key] || 0
                      const potential = selectedPlayer[attr.potKey] || 99
                      const added = allocation[attr.key] || 0
                      const currentWithAdded = current + added
                      const atCap = currentWithAdded >= potential
                      const cost = costForOnePoint(current)
                      const canAdd = !atCap && creditsLeft >= cost && !playerAtMax && currentWithAdded < 99

                      return (
                        <div key={attr.key} style={{display:'flex',alignItems:'center',gap:4}}>
                          <div style={{flex:1,fontSize:11,color:atCap&&!added?'#b0a89e':'#5c554e'}}>{attr.label}</div>
                          <span style={{fontSize:10,color:'#8a8279',minWidth:20,textAlign:'right'}}>{current}</span>
                          {atCap && !added ? (
                            <span style={{fontSize:9,color:'#b0a89e',padding:'1px 4px',background:'#f0ece5',borderRadius:3}}>cap</span>
                          ) : (
                            <div style={{display:'flex',alignItems:'center',gap:2}}>
                              <button onClick={()=>handleRemovePoint(attr.key)} disabled={!added}
                                style={{width:20,height:20,borderRadius:4,border:'1px solid #d4cdc5',background:'#f0ece5',
                                        cursor:added?'pointer':'not-allowed',fontSize:13,color:'#5c554e',lineHeight:1}}>−</button>
                              <span style={{fontSize:11,fontWeight:700,color:cfg?.color,minWidth:16,textAlign:'center'}}>{added}</span>
                              <button onClick={()=>handleAddPoint(attr.key, attr.potKey)} disabled={!canAdd}
                                style={{width:20,height:20,borderRadius:4,border:'1px solid #d4cdc5',
                                        background:canAdd?cfg?.color+'22':'#f0ece5',
                                        cursor:canAdd?'pointer':'not-allowed',fontSize:13,color:cfg?.color,lineHeight:1}}>+</button>
                            </div>
                          )}
                          <div style={{minWidth:40,textAlign:'right'}}>
                            {added>0 && <span style={{fontSize:10,color:cfg?.color,fontWeight:700}}>→{currentWithAdded}</span>}
                            {!added && !atCap && <span style={{fontSize:9,color:'#b0a89e'}}>{cost}cr/pt</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {isGM && (
                    <button onClick={handleSpend} disabled={totalPtsAllocated===0||saving}
                      style={{width:'100%',padding:'9px',fontSize:12,fontWeight:600,border:'none',borderRadius:8,
                              background:totalPtsAllocated>0?cfg?.color:'#e2dcd5',
                              color:totalPtsAllocated>0?'#fff':'#8a8279',
                              cursor:totalPtsAllocated>0?'pointer':'not-allowed'}}>
                      {saving?'Applying...':`Apply training (${creditsSpent.toFixed(1)} credits)`}
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

      <div style={{marginTop:16,padding:'10px 14px',background:'#f0ece5',borderRadius:8,fontSize:11,color:'#6b5f4e',lineHeight:1.6}}>
        Slots fill automatically each week · Full slot = 10 credits · Max 3 credits per player per cycle · Attributes capped at individual potential
      </div>
    </div>
  )
}

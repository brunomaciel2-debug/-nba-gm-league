'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Slot = { id:string, slot_type:string, fill_pct:number, credits_available:number, locked:boolean }
type Player = { id:number, name:string, pos:string, photo_url?:string, [key:string]:any }

const SLOT_CONFIG: Record<string,{label:string,icon:string,color:string,bg:string,attrs:{key:string,label:string,potKey:string}[]}> = {
  offense:    {label:'Offense',     icon:'🏀',color:'#b45309',bg:'#fef3c7',attrs:[{key:'three',label:'3PT',potKey:'pot_three'},{key:'layup',label:'Layup',potKey:'pot_layup'},{key:'dunk',label:'Dunk',potKey:'pot_dunk'},{key:'mid',label:'Mid',potKey:'pot_mid'},{key:'ft',label:'FT',potKey:'pot_ft'},{key:'siq',label:'SIQ',potKey:'pot_siq'},{key:'draw_foul',label:'DF',potKey:'pot_draw_foul'}]},
  defense:    {label:'Defense',     icon:'🛡️',color:'#15803d',bg:'#dcfce7',attrs:[{key:'blk',label:'BLK',potKey:'pot_blk'},{key:'stl',label:'STL',potKey:'pot_stl'},{key:'idef',label:'IDEF',potKey:'pot_idef'},{key:'pdef',label:'PDEF',potKey:'pot_pdef'}]},
  physical:   {label:'Physical',    icon:'💪',color:'#6d28d9',bg:'#ede9fe',attrs:[{key:'stamina',label:'STA',potKey:'pot_stamina'},{key:'durability',label:'DUR',potKey:'pot_durability'},{key:'def_reb',label:'DREB',potKey:'pot_def_reb'},{key:'off_reb',label:'OREB',potKey:'pot_off_reb'}]},
  playmaking: {label:'Playmaking',  icon:'🎯',color:'#1d4ed8',bg:'#dbeafe',attrs:[{key:'ball_hdl',label:'BH',potKey:'pot_ball_hdl'},{key:'pass_vis',label:'PV',potKey:'pot_pass_vis'},{key:'pass_iq',label:'PIQ',potKey:'pot_pass_iq'},{key:'assist_role',label:'AR',potKey:'pot_assist_role'}]},
  mental:     {label:'Mental',      icon:'🧠',color:'#0e7490',bg:'#cffafe',attrs:[{key:'pressure',label:'CLU',potKey:'pot_pressure'},{key:'consistency',label:'CON',potKey:'pot_consistency'},{key:'crowd_effect',label:'CE',potKey:'pot_consistency'},{key:'streaky',label:'STR',potKey:'pot_consistency'}]},
  recovery:   {label:'Recovery',    icon:'🏊',color:'#dc2626',bg:'#fee2e2',attrs:[{key:'stamina',label:'STA',potKey:'pot_stamina'},{key:'durability',label:'DUR',potKey:'pot_durability'}]},
  shooting:   {label:'Shooting Lab',icon:'🎯',color:'#c2410c',bg:'#ffedd5',attrs:[{key:'three',label:'3PT',potKey:'pot_three'},{key:'ft',label:'FT',potKey:'pot_ft'},{key:'mid',label:'MID',potKey:'pot_mid'}]},
  analytics:  {label:'Analytics',  icon:'📊',color:'#4338ca',bg:'#e0e7ff',attrs:[{key:'siq',label:'SIQ',potKey:'pot_siq'},{key:'pass_iq',label:'PIQ',potKey:'pot_pass_iq'},{key:'pressure',label:'CLU',potKey:'pot_pressure'},{key:'consistency',label:'CON',potKey:'pot_consistency'}]},
}

const UNLOCK_REQ: Record<string,string> = {
  playmaking:'Grade D Gym', mental:'Mental Coach', recovery:'Pool or Sauna', shooting:'Shooting Machine', analytics:'Grade A Gym',
}

function costForOnePoint(v:number):number { if(v<=60)return 0.5; if(v<=75)return 1; if(v<=90)return 2; return 3 }
function attrColor(v:number):string { if(v>=85)return'#b45309'; if(v>=75)return'#15803d'; if(v>=65)return'#1d4ed8'; return'#8a8279' }

export default function TrainingTab({teamId,teamColor,players}:{teamId:string,teamColor:string,players:Player[]}) {
  const {profile} = useAuth()
  const isGM = (profile as any)?.team_id===teamId || profile?.role==='commissioner'

  const [slots,setSlots]             = useState<Slot[]>([])
  const [selectedSlot,setSelectedSlot] = useState<Slot|null>(null)
  const [hoveredSlot,setHoveredSlot]   = useState<Slot|null>(null)
  const [selectedPlayer,setSelectedPlayer] = useState<Player|null>(null)
  const [allocation,setAllocation]     = useState<Record<string,number>>({})
  const [loading,setLoading]           = useState(true)
  const [saving,setSaving]             = useState(false)
  const [msg,setMsg]                   = useState('')

  useEffect(()=>{
    supabase.from('training_slots').select('*').eq('team_id',teamId).order('locked')
      .then(({data})=>{setSlots(data||[]);setLoading(false)})
  },[teamId])

  const activeCfg = selectedSlot ? SLOT_CONFIG[selectedSlot.slot_type] : hoveredSlot ? SLOT_CONFIG[hoveredSlot.slot_type] : null
  const activeAttrs = activeCfg?.attrs.map(a=>a.key) || []

  const creditsSpent = selectedPlayer && selectedSlot ? SLOT_CONFIG[selectedSlot.slot_type]?.attrs.reduce((t,a)=>{
    const pts=allocation[a.key]||0; if(!pts)return t; return t+pts*costForOnePoint(selectedPlayer[a.key]||0)
  },0)||0 : 0
  const creditsLeft = selectedSlot ? selectedSlot.credits_available - creditsSpent : 0
  const totalPts = Object.values(allocation).reduce((a,b)=>a+b,0)
  const playerAtMax = creditsSpent >= 3

  const handleAdd = (key:string,potKey:string)=>{
    if(!selectedPlayer||!selectedSlot)return
    const cur=(selectedPlayer[key]||0)+(allocation[key]||0)
    const pot=selectedPlayer[potKey]||99
    if(cur>=pot||cur>=99)return
    const cost=costForOnePoint(cur)
    if(creditsLeft<cost||creditsSpent+cost>3)return
    setAllocation(p=>({...p,[key]:(p[key]||0)+1}))
  }
  const handleRemove=(key:string)=>{
    if(!(allocation[key]||0))return
    setAllocation(p=>({...p,[key]:(p[key]||0)-1}))
  }

  const handleSpend=async()=>{
    if(!selectedSlot||!selectedPlayer||!totalPts)return
    setSaving(true); setMsg('')
    const upd:Record<string,number>={}, logs:any[]=[]
    for(const[k,pts] of Object.entries(allocation)){
      if(pts>0){
        upd[k]=Math.min(99,(selectedPlayer[k]||0)+pts)
        logs.push({team_id:teamId,player_id:selectedPlayer.id,slot_type:selectedSlot.slot_type,attribute:k,points_added:pts,credits_used:pts*costForOnePoint(selectedPlayer[k]||0),season:'2025-26'})
      }
    }
    await supabase.from('players').update(upd).eq('id',selectedPlayer.id)
    const newCr=Math.max(0,selectedSlot.credits_available-creditsSpent)
    const reset=newCr<=0
    await supabase.from('training_slots').update({credits_available:newCr,fill_pct:reset?0:selectedSlot.fill_pct}).eq('id',selectedSlot.id)
    if(logs.length)await supabase.from('training_log').insert(logs)
    setSlots(p=>p.map(s=>s.id===selectedSlot.id?{...s,credits_available:newCr,fill_pct:reset?0:s.fill_pct}:s))
    setSelectedSlot(p=>p?{...p,credits_available:newCr,fill_pct:reset?0:p.fill_pct}:null)
    setAllocation({}); setSelectedPlayer(null); setMsg('Training applied!'); setSaving(false)
  }

  if(loading)return <div className="text-center py-8" style={{color:'#8a8279'}}>Loading...</div>

  const unlockedSlots=slots.filter(s=>!s.locked)
  const lockedSlots=slots.filter(s=>s.locked)
  const readySlots=unlockedSlots.filter(s=>s.credits_available>0)
  const totalCredits=unlockedSlots.reduce((a,s)=>a+s.credits_available,0)

  return (
    <div>
      {/* Summary bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {[
          {label:'Active slots',   val:unlockedSlots.length, hi:false},
          {label:'Ready to spend', val:readySlots.length,    hi:readySlots.length>0},
          {label:'Total credits',  val:totalCredits,          hi:totalCredits>0},
          {label:'Locked slots',   val:lockedSlots.length,   hi:false},
        ].map(item=>(
          <div key={item.label} style={{background:item.hi?teamColor+'18':'#f0ece5',border:`1px solid ${item.hi?teamColor:'#d4cdc5'}`,borderRadius:8,padding:'6px 12px'}}>
            <div style={{fontSize:10,color:'#8a8279'}}>{item.label}</div>
            <div style={{fontSize:16,fontWeight:700,color:item.hi?teamColor:'#1a1512'}}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Slots row — compact */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:8}}>
        {unlockedSlots.map(slot=>{
          const c=SLOT_CONFIG[slot.slot_type]
          const pct=Math.min(100,Math.max(0,slot.fill_pct))
          const isFull=pct>=100
          const isSelected=selectedSlot?.id===slot.id
          const isHovered=hoveredSlot?.id===slot.id
          return (
            <div key={slot.id}
              onClick={()=>setSelectedSlot(isSelected?null:slot)}
              onMouseEnter={()=>setHoveredSlot(slot)}
              onMouseLeave={()=>setHoveredSlot(null)}
              style={{
                background:isSelected?c.bg:'#faf8f5',
                border:`1px solid ${isSelected?c.color:'#d4cdc5'}`,
                borderTop:`3px solid ${isSelected||isFull?c.color:'#d4cdc5'}`,
                borderRadius:10,padding:'10px 12px',cursor:'pointer',transition:'all 0.15s',
              }}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                <span style={{fontSize:16}}>{c.icon}</span>
                <span style={{fontSize:12,fontWeight:700,color:c.color,flex:1}}>{c.label}</span>
                {slot.credits_available>0 && (
                  <span style={{background:c.color,color:'#fff',fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:10}}>
                    {slot.credits_available}cr
                  </span>
                )}
              </div>
              {/* Progress bar */}
              <div style={{height:6,background:'#e2dcd5',borderRadius:3,overflow:'hidden',marginBottom:4}}>
                <div style={{height:'100%',width:pct+'%',background:isFull?c.color:c.color+'77',borderRadius:3,transition:'width 0.3s'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#8a8279'}}>
                <span>{isFull?'✓ Ready':'Filling...'}</span>
                <span style={{fontWeight:600,color:isFull?c.color:'#8a8279'}}>{Math.round(pct)}%</span>
              </div>
            </div>
          )
        })}
        {lockedSlots.map(slot=>{
          const c=SLOT_CONFIG[slot.slot_type]
          return (
            <div key={slot.id} style={{background:'#f5f2ee',border:'1px solid #e2dcd5',borderTop:'3px solid #e2dcd5',borderRadius:10,padding:'10px 12px',opacity:0.55}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                <span style={{fontSize:14}}>🔒</span>
                <span style={{fontSize:12,fontWeight:600,color:'#9a8a78',flex:1}}>{c?.label}</span>
              </div>
              <div style={{fontSize:9,color:'#b0a89e'}}>{UNLOCK_REQ[slot.slot_type]}</div>
            </div>
          )
        })}
      </div>

      {/* Attr tags hint */}
      {activeCfg && (
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12,padding:'6px 10px',background:activeCfg.bg,borderRadius:8,border:`1px solid ${activeCfg.color}33`}}>
          <span style={{fontSize:11,fontWeight:600,color:activeCfg.color}}>{activeCfg.icon} {activeCfg.label} trains:</span>
          {activeCfg.attrs.map(a=>(
            <span key={a.key} style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:activeCfg.color+'22',color:activeCfg.color,fontWeight:600}}>{a.label}</span>
          ))}
        </div>
      )}

      {/* Main area: roster + spend panel */}
      <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>

        {/* Roster table */}
        <div style={{flex:1,minWidth:0,borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead>
              <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                <th style={{padding:'8px 12px',textAlign:'left',fontWeight:700,color:'#5c554e'}}>Player</th>
                <th style={{padding:'8px 6px',textAlign:'center',fontWeight:700,color:'#5c554e',fontSize:10}}>POS</th>
                {activeAttrs.length>0
                  ? activeAttrs.map(key=>{
                      const a=activeCfg?.attrs.find(x=>x.key===key)
                      return <th key={key} style={{padding:'8px 6px',textAlign:'center',fontWeight:700,color:activeCfg?.color,fontSize:10,whiteSpace:'nowrap'}}>{a?.label||key}</th>
                    })
                  : <th style={{padding:'8px 6px',textAlign:'center',fontWeight:400,color:'#b0a89e',fontSize:10}}>← Select a slot</th>
                }
              </tr>
            </thead>
            <tbody>
              {players.map((p,i)=>(
                <tr key={p.id}
                  onClick={()=>selectedSlot&&selectedSlot.credits_available>0&&(setSelectedPlayer(prev=>prev?.id===p.id?null:p),setAllocation({}))}
                  style={{
                    background:selectedPlayer?.id===p.id?teamColor+'0d':i%2===0?'#faf8f5':'#f5f1eb',
                    borderBottom:'1px solid #e2dcd5',
                    cursor:selectedSlot&&selectedSlot.credits_available>0?'pointer':'default',
                    outline:selectedPlayer?.id===p.id?`2px solid ${teamColor}`:'none',
                  }}>
                  <td style={{padding:'8px 12px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:26,height:26,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'#e8e2d6',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {p.photo_url
                          ?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          :<span style={{fontSize:8,fontWeight:700,color:'#5c554e'}}>{p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</span>}
                      </div>
                      <span style={{fontWeight:600,color:'#1a1512',fontSize:12}}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{padding:'6px',textAlign:'center'}}>
                    <span style={{background:'#e8e2d8',color:'#3d3731',fontSize:10,fontWeight:600,padding:'1px 5px',borderRadius:4}}>{p.pos}</span>
                  </td>
                  {activeAttrs.length>0
                    ? activeAttrs.map(key=>{
                        const a=activeCfg?.attrs.find(x=>x.key===key)
                        const val=p[key]||0
                        const pot=a?p[a.potKey]||99:99
                        const atCap=val>=pot
                        return (
                          <td key={key} style={{padding:'6px',textAlign:'center'}}>
                            <span style={{fontWeight:700,fontSize:12,color:atCap?'#b0a89e':attrColor(val)}}>{val}</span>
                            {atCap && isGM && <span title="At potential cap" style={{marginLeft:2,fontSize:10,color:'#b45309'}}>⚠</span>}
                          </td>
                        )
                      })
                    : <td style={{padding:'6px',textAlign:'center',color:'#d4cdc5'}}>—</td>
                  }
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Spend panel */}
        <div style={{width:220,flexShrink:0,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:14}}>
          {!selectedSlot?(
            <p style={{fontSize:12,color:'#8a8279',lineHeight:1.6}}>Select a slot above, then click a player to train.</p>
          ):selectedSlot.credits_available===0?(
            <>
              <div style={{fontSize:13,fontWeight:700,color:activeCfg?.color,marginBottom:6}}>{activeCfg?.icon} {activeCfg?.label}</div>
              <div style={{height:6,background:'#e2dcd5',borderRadius:3,overflow:'hidden',marginBottom:6}}>
                <div style={{height:'100%',width:selectedSlot.fill_pct+'%',background:activeCfg?.color+'88',borderRadius:3}}/>
              </div>
              <p style={{fontSize:11,color:'#8a8279',lineHeight:1.5}}>{Math.round(selectedSlot.fill_pct)}% — needs 100% to earn 10 credits.</p>
            </>
          ):!selectedPlayer?(
            <>
              <div style={{fontSize:13,fontWeight:700,color:activeCfg?.color,marginBottom:6}}>{activeCfg?.icon} {activeCfg?.label}</div>
              <div style={{fontSize:11,color:'#8a8279',marginBottom:8}}>{selectedSlot.credits_available} credits · max 3/player</div>
              <div style={{background:'#f0ece5',borderRadius:6,padding:'5px 8px',fontSize:10,color:'#5c554e',lineHeight:1.6}}>
                0-60: 0.5cr/pt · 61-75: 1cr/pt<br/>76-90: 2cr/pt · 91-99: 3cr/pt
              </div>
              <p style={{fontSize:11,color:'#8a8279',marginTop:8}}>Click a player in the roster to train.</p>
            </>
          ):(
            <>
              <div style={{fontSize:13,fontWeight:700,color:activeCfg?.color,marginBottom:2}}>{activeCfg?.icon} {activeCfg?.label}</div>
              <div style={{fontSize:11,color:'#8a8279',marginBottom:8}}>
                {selectedSlot.credits_available}cr available ·
                <span style={{color:creditsLeft>0?activeCfg?.color:'#dc2626',fontWeight:700}}> {creditsLeft.toFixed(1)} left</span>
              </div>
              <div style={{fontSize:12,fontWeight:600,color:'#1a1512',marginBottom:8,padding:'4px 8px',background:teamColor+'18',borderRadius:6}}>
                {selectedPlayer.name}
              </div>
              {playerAtMax && <div style={{fontSize:10,color:'#dc2626',marginBottom:6}}>Max 3 credits reached for this player</div>}
              <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:10}}>
                {activeCfg?.attrs.map(attr=>{
                  const cur=selectedPlayer[attr.key]||0
                  const pot=selectedPlayer[attr.potKey]||99
                  const added=allocation[attr.key]||0
                  const curWithAdded=cur+added
                  const atCap=curWithAdded>=pot
                  const cost=costForOnePoint(cur)
                  const canAdd=!atCap&&creditsLeft>=cost&&!playerAtMax&&curWithAdded<99
                  return (
                    <div key={attr.key} style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{flex:1,fontSize:11,color:atCap&&!added?'#b0a89e':'#5c554e'}}>{attr.label}</span>
                      <span style={{fontSize:10,color:'#8a8279',minWidth:18,textAlign:'right'}}>{cur}</span>
                      {atCap&&!added
                        ? <span style={{fontSize:9,color:'#b0a89e',padding:'1px 4px',background:'#f0ece5',borderRadius:3}}>cap</span>
                        : <div style={{display:'flex',alignItems:'center',gap:2}}>
                            <button onClick={()=>handleRemove(attr.key)} disabled={!added}
                              style={{width:18,height:18,borderRadius:3,border:'1px solid #d4cdc5',background:'#f0ece5',cursor:added?'pointer':'not-allowed',fontSize:12,color:'#5c554e',lineHeight:1}}>−</button>
                            <span style={{fontSize:11,fontWeight:700,color:activeCfg?.color,minWidth:12,textAlign:'center'}}>{added}</span>
                            <button onClick={()=>handleAdd(attr.key,attr.potKey)} disabled={!canAdd}
                              style={{width:18,height:18,borderRadius:3,border:'1px solid #d4cdc5',background:canAdd?activeCfg?.color+'22':'#f0ece5',cursor:canAdd?'pointer':'not-allowed',fontSize:12,color:activeCfg?.color,lineHeight:1}}>+</button>
                          </div>
                      }
                      {added>0&&<span style={{fontSize:9,color:activeCfg?.color,fontWeight:700,minWidth:28}}>→{curWithAdded}</span>}
                      {!added&&!atCap&&<span style={{fontSize:9,color:'#b0a89e',minWidth:28,textAlign:'right'}}>{cost}cr</span>}
                    </div>
                  )
                })}
              </div>
              {isGM&&(
                <button onClick={handleSpend} disabled={!totalPts||saving}
                  style={{width:'100%',padding:'8px',fontSize:12,fontWeight:600,border:'none',borderRadius:8,
                          background:totalPts?activeCfg?.color:'#e2dcd5',color:totalPts?'#fff':'#8a8279',cursor:totalPts?'pointer':'not-allowed'}}>
                  {saving?'Applying...':`Apply (${creditsSpent.toFixed(1)}cr)`}
                </button>
              )}
              {!isGM&&<p style={{fontSize:11,color:'#8a8279',marginTop:6}}>Only the GM can spend credits.</p>}
              {msg&&<p style={{fontSize:11,color:'#15803d',fontWeight:600,marginTop:6}}>✓ {msg}</p>}
            </>
          )}
        </div>
      </div>

      <div style={{marginTop:12,padding:'8px 12px',background:'#f0ece5',borderRadius:8,fontSize:10,color:'#6b5f4e',lineHeight:1.5}}>
        Slots fill automatically each week · Full slot = 10 credits · Max 3 credits per player per cycle · Attributes capped at individual potential
      </div>
    </div>
  )
}

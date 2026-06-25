'use client'
import { useState } from 'react'

type Concessions = {
  id: string
  food_stall_basic_north: number
  food_stall_basic_south: number
  food_stall_basic_east: number
  food_stall_basic_west: number
  food_stall_premium_north: number
  food_stall_premium_south: number
  bar_east: number
  bar_west: number
  vending_north: number
  vending_south: number
  vending_east: number
  vending_west: number
  restaurant_vip: number
  franchise_store: number
  corporate_suites: number
  club_seats: number
  courtside_lounge: number
  jumbotron: number
  fan_zone: number
  mascot: number
  monthly_maintenance: number
}

// Zone definitions
type Zone = 'north' | 'south' | 'east' | 'west' | 'upper_north' | 'south_entrance' | 'court'

type SlotVariant = {
  key: keyof Omit<Concessions,'id'|'monthly_maintenance'>
  zone: Zone
  zoneLabel: string
  max: number
}

type SlotDef = {
  id: string
  label: string
  icon: string
  cost: number
  monthly: number
  category: 'food' | 'premium' | 'entertainment'
  adoption_rate: number
  avg_spend: number
  fixed_per_game?: number
  variants: SlotVariant[]
  synergies: string[]
  penalties: string[]
  fan_xp: string
  tooltip_detail: string
}

const SLOTS: SlotDef[] = [
  {
    id: 'food_stall_basic',
    label: 'Food Stall', icon: '🍟',
    cost: 500000, monthly: 5000,
    category: 'food', adoption_rate: 25, avg_spend: 8,
    variants: [
      {key:'food_stall_basic_north', zone:'north',  zoneLabel:'North concourse', max:2},
      {key:'food_stall_basic_south', zone:'south',  zoneLabel:'South concourse', max:2},
      {key:'food_stall_basic_east',  zone:'east',   zoneLabel:'East corridor',   max:1},
      {key:'food_stall_basic_west',  zone:'west',   zoneLabel:'West corridor',   max:1},
    ],
    synergies:[
      '3 stalls in different corridors → +4% adoption (variety)',
      'Jumbotron → +5% all food adoption',
      'Win streak 5+ → +8% adoption',
    ],
    penalties:[
      '2 stalls same corridor → second loses -10% adoption',
      'Premium Food same corridor → Basic loses -8% adoption',
      'Loss streak 5+ → -10% adoption',
    ],
    fan_xp: 'Contributes to Fan Satisfaction. More variety = higher score.',
    tooltip_detail: '25% of fans stop by · avg $8 spend · placing in multiple corridors avoids penalty',
  },
  {
    id: 'food_stall_premium',
    label: 'Premium Food', icon: '🍔',
    cost: 1500000, monthly: 12000,
    category: 'food', adoption_rate: 18, avg_spend: 18,
    variants: [
      {key:'food_stall_premium_north', zone:'north', zoneLabel:'North concourse', max:1},
      {key:'food_stall_premium_south', zone:'south', zoneLabel:'South concourse', max:1},
    ],
    synergies:[
      'Executive Chef staff → +8% adoption',
      'VIP Restaurant nearby → +5% (premium cluster)',
      'Playoffs → +15% adoption',
    ],
    penalties:[
      'Basic Food Stall same corridor → basic loses -8% (you dominate it)',
      'Ticket price >$150 → -5% (fans already spent a lot)',
    ],
    fan_xp: 'Upgrades perceived arena quality. +3pts Fan Satisfaction/game.',
    tooltip_detail: '18% of fans · avg $18 · place in north for suite holders, south for general entry',
  },
  {
    id: 'bar',
    label: 'Bar', icon: '🍺',
    cost: 800000, monthly: 8000,
    category: 'food', adoption_rate: 15, avg_spend: 14,
    variants: [
      {key:'bar_east', zone:'east', zoneLabel:'East corridor', max:1},
      {key:'bar_west', zone:'west', zoneLabel:'West corridor', max:1},
    ],
    synergies:[
      'Specialist Bartender staff → +6% adoption',
      'Historic rivalry game → +10% adoption',
      'Club Seats nearby → +5% (club holders spend more at bar)',
    ],
    penalties:[
      'Both bars in operation → each loses -3% (split audience)',
      'Family game night → -6% adoption',
    ],
    fan_xp: 'High satisfaction driver for adult fans. +2pts Fan Satisfaction/game.',
    tooltip_detail: '15% of fans · avg $14 · east bar near courtside lounge is a premium combo',
  },
  {
    id: 'vending',
    label: 'Vending', icon: '🥤',
    cost: 200000, monthly: 1000,
    category: 'food', adoption_rate: 20, avg_spend: 4,
    variants: [
      {key:'vending_north', zone:'north', zoneLabel:'North concourse', max:2},
      {key:'vending_south', zone:'south', zoneLabel:'South concourse', max:2},
      {key:'vending_east',  zone:'east',  zoneLabel:'East corridor',   max:1},
      {key:'vending_west',  zone:'west',  zoneLabel:'West corridor',   max:1},
    ],
    synergies:[
      'Placed in every corridor → +3% all concessions (no queues)',
      'Jumbotron → +5% all food adoption',
    ],
    penalties:[
      'Many food options → drops to 12% adoption (fallback item)',
    ],
    fan_xp: 'Reduces queue frustration. Prevents early departures. +1pt satisfaction.',
    tooltip_detail: 'Cheapest option · best coverage per dollar · place everywhere to fill gaps',
  },
  {
    id: 'restaurant_vip',
    label: 'VIP Restaurant', icon: '🍽️',
    cost: 3000000, monthly: 20000,
    category: 'food', adoption_rate: 4, avg_spend: 65,
    variants: [{key:'restaurant_vip', zone:'upper_north', zoneLabel:'Upper North level', max:1}],
    synergies:[
      'Courtside Lounge → +10% VIP adoption (premium cluster)',
      'Corporate Suites → +6% (suite holders dine here)',
      'Executive Chef staff → +8% adoption',
    ],
    penalties:[
      'No Courtside Lounge or Suites → -6% (insufficient VIP clientele)',
      'Bad team record → -4% (VIPs avoid losing teams)',
    ],
    fan_xp: 'Prestige element. Attracts corporate sponsors. +5pts satisfaction.',
    tooltip_detail: 'Only 4% of fans · avg $65 · unlocks corporate sponsor tiers · fixed upper north',
  },
  {
    id: 'franchise_store',
    label: 'Franchise Store', icon: '👕',
    cost: 2000000, monthly: 10000,
    category: 'entertainment', adoption_rate: 12, avg_spend: 35,
    variants: [{key:'franchise_store', zone:'south_entrance', zoneLabel:'South main entrance', max:1}],
    synergies:[
      'Mascot nearby → +5% adoption (mascot drives fans to store)',
      'Win streak → +10% (fans want merch)',
      'Playoffs → +20% adoption',
    ],
    penalties:[
      'Loss streak 5+ → -8% (fans less likely to buy merch)',
    ],
    fan_xp: '+2% attendance next game (fans wearing merch = free marketing). +3pts satisfaction.',
    tooltip_detail: '12% of fans · avg $35 · south entrance = maximum foot traffic on entry/exit',
  },
  {
    id: 'corporate_suites',
    label: 'Corp. Suites', icon: '🏢',
    cost: 5000000, monthly: 30000,
    category: 'premium', adoption_rate: 100, avg_spend: 0, fixed_per_game: 8000,
    variants: [{key:'corporate_suites', zone:'upper_north', zoneLabel:'Upper North level', max:3}],
    synergies:[
      'VIP Restaurant → suite holders dine there (+6% VIP)',
      'Courtside Lounge → premium package deal +15% suite revenue',
      '3 suites → unlocks Platinum Sponsor tier',
    ],
    penalties:[
      'No VIP amenities → suite renewal rate drops',
      'Bad team record → -10% suite renewal next season',
    ],
    fan_xp: 'Prestige signal. Attracts top-tier sponsors. +4pts satisfaction.',
    tooltip_detail: '$8K fixed per suite per game · 3 suites = $24K/game · guaranteed revenue',
  },
  {
    id: 'club_seats',
    label: 'Club Seats', icon: '💺',
    cost: 3000000, monthly: 15000,
    category: 'premium', adoption_rate: 100, avg_spend: 0, fixed_per_game: 40000,
    variants: [{key:'club_seats', zone:'west', zoneLabel:'West sideline', max:1}],
    synergies:[
      'Bar West → club holders spend 30% more at bar',
      'Premium Food north → club holders walk through north concourse',
    ],
    penalties:[
      'No lounge access → -15% renewal rate next season',
    ],
    fan_xp: 'Creates loyal premium fanbase. These fans attend 90%+ of games. +3pts satisfaction.',
    tooltip_detail: '$40K fixed per game · 100 seats · most loyal fans in the building',
  },
  {
    id: 'courtside_lounge',
    label: 'Courtside Lounge', icon: '⭐',
    cost: 8000000, monthly: 50000,
    category: 'premium', adoption_rate: 100, avg_spend: 0, fixed_per_game: 120000,
    variants: [{key:'courtside_lounge', zone:'east', zoneLabel:'East sideline', max:1}],
    synergies:[
      'VIP Restaurant → package deal +10% lounge revenue',
      'Bar East → lounge members use east bar (+8% bar adoption)',
      'Corporate Suites → combined premium tier attracts top sponsors',
    ],
    penalties:[
      'No VIP Restaurant → -10% revenue (members expect full service)',
      'Losing season → membership cancellations',
    ],
    fan_xp: 'Highest prestige element. Unlocks Celebrity & Media sponsor tiers. +6pts satisfaction.',
    tooltip_detail: '$120K fixed per game · biggest single revenue item · east sideline for court proximity',
  },
  {
    id: 'jumbotron',
    label: 'Jumbotron', icon: '📺',
    cost: 4000000, monthly: 20000,
    category: 'entertainment', adoption_rate: 0, avg_spend: 0, fixed_per_game: 15000,
    variants: [{key:'jumbotron', zone:'court', zoneLabel:'Court centre (ceiling)', max:1}],
    synergies:[
      '+5% adoption on ALL food/drink concessions',
      '+3% attendance next 3 games',
      'Fan Zone combo → +8% adoption boost',
      '$15K/game advertising revenue base',
    ],
    penalties:[
      'No other entertainment → only +2% effect (needs context)',
    ],
    fan_xp: '+5pts Fan Satisfaction/game · reduces early departures by 12% · essential for modern arena',
    tooltip_detail: 'No per-person revenue · multiplier on all concessions · fixed court centre position',
  },
  {
    id: 'fan_zone',
    label: 'Fan Zone', icon: '🎉',
    cost: 2500000, monthly: 12000,
    category: 'entertainment', adoption_rate: 10, avg_spend: 20,
    variants: [{key:'fan_zone', zone:'south_entrance', zoneLabel:'South main entrance', max:1}],
    synergies:[
      'Jumbotron → +8% fan zone adoption',
      'Mascot → +6% adoption (mascot performs here)',
      'Family games → +12% adoption',
    ],
    penalties:[
      'Corporate/luxury focus → -4% adoption (less family attendance)',
    ],
    fan_xp: '+5% attendance following week · social media posts increase 40% · +5pts satisfaction.',
    tooltip_detail: '10% of fans · avg $20 · main driver of repeat attendance among families',
  },
  {
    id: 'mascot',
    label: 'Mascot', icon: '🎭',
    cost: 500000, monthly: 3000,
    category: 'entertainment', adoption_rate: 0, avg_spend: 0, fixed_per_game: 5000,
    variants: [{key:'mascot', zone:'south_entrance', zoneLabel:'South entrance & tunnel', max:1}],
    synergies:[
      'Franchise Store → +5% store adoption',
      'Fan Zone → +6% fan zone adoption',
      'Family nights → +8% overall attendance',
    ],
    penalties:[
      'Corporate/luxury focus → -2pts satisfaction for VIP segment',
    ],
    fan_xp: '+2% attendance (families) · increases kid/family segment by 15% · +2pts satisfaction.',
    tooltip_detail: 'Cheapest entertainment · best ROI for family audience · $5K/game · drives store & fan zone traffic',
  },
]

const CAT_COLORS = {
  food:          {bg:'#dcfce7', border:'#16a34a', text:'#15803d'},
  premium:       {bg:'#dbeafe', border:'#3b82f6', text:'#1d4ed8'},
  entertainment: {bg:'#ede9fe', border:'#7c3aed', text:'#5b21b6'},
}

const ZONE_POSITIONS: Record<Zone, {label:string}> = {
  north:         {label:'North concourse'},
  south:         {label:'South concourse'},
  east:          {label:'East corridor'},
  west:          {label:'West corridor'},
  upper_north:   {label:'Upper North'},
  south_entrance:{label:'South entrance'},
  court:         {label:'Court (ceiling)'},
}

function fmtM(n:number){ return '$'+(n>=1000000?(n/1e6).toFixed(1)+'M':(n/1000).toFixed(0)+'K') }
function fmtD(n:number){ return '$'+n.toLocaleString() }

function TooltipPanel({slot, concessions, teamColor}:{slot:SlotDef, concessions:Concessions, teamColor:string}) {
  const cat = CAT_COLORS[slot.category]
  const totalQty = slot.variants.reduce((t,v)=>(t+(concessions as any)[v.key]||0),0)
  const revenuePerGame = slot.fixed_per_game
    ? slot.fixed_per_game * totalQty
    : Math.round(13000*(slot.adoption_rate/100)*slot.avg_spend*Math.max(1,totalQty))

  return (
    <div style={{
      position:'absolute', zIndex:200, bottom:'calc(100% + 10px)', left:'50%',
      transform:'translateX(-50%)', width:300,
      background:'#1a1512', borderRadius:12, padding:14,
      border:`1px solid ${cat.border}55`,
      boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
      pointerEvents:'none',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,paddingBottom:8,borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
        <span style={{fontSize:22}}>{slot.icon}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:'#f5f1eb'}}>{slot.label}</div>
          <div style={{fontSize:10,color:cat.border}}>Build: {fmtM(slot.cost)} · Maint: {fmtM(slot.monthly)}/mo</div>
        </div>
        {totalQty>0 && <div style={{textAlign:'right'}}>
          <div style={{fontSize:10,color:'#8a8279'}}>Est. revenue</div>
          <div style={{fontSize:13,fontWeight:700,color:'#4ade80'}}>{fmtD(revenuePerGame)}/game</div>
        </div>}
      </div>

      <div style={{fontSize:11,color:'#d4cdc5',marginBottom:10,lineHeight:1.5}}>{slot.tooltip_detail}</div>

      {/* Zones available */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:700,color:'#8a8279',marginBottom:4}}>📍 AVAILABLE LOCATIONS</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
          {slot.variants.map(v=>{
            const qty=(concessions as any)[v.key]||0
            const full=qty>=v.max
            return (
              <span key={v.key} style={{
                fontSize:10,padding:'2px 8px',borderRadius:4,
                background:full?'rgba(74,222,128,0.15)':qty>0?`${cat.border}22`:'rgba(255,255,255,0.05)',
                color:full?'#4ade80':qty>0?cat.border:'#8a8279',
                border:`1px solid ${full?'#4ade8044':qty>0?cat.border+'44':'rgba(255,255,255,0.1)'}`,
              }}>
                {v.zoneLabel} {qty}/{v.max}
              </span>
            )
          })}
        </div>
      </div>

      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:700,color:'#4ade80',marginBottom:3}}>✓ SYNERGIES</div>
        {slot.synergies.map((s,i)=>(
          <div key={i} style={{fontSize:10,color:'#86efac',marginBottom:2}}>· {s}</div>
        ))}
      </div>

      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:700,color:'#f87171',marginBottom:3}}>⚠ WATCH OUT</div>
        {slot.penalties.map((p,i)=>(
          <div key={i} style={{fontSize:10,color:'#fca5a5',marginBottom:2}}>· {p}</div>
        ))}
      </div>

      <div style={{borderTop:'1px solid rgba(255,255,255,0.1)',paddingTop:8}}>
        <div style={{fontSize:10,fontWeight:700,color:'#a78bfa',marginBottom:3}}>🌟 FAN EXPERIENCE</div>
        <div style={{fontSize:10,color:'#c4b5fd'}}>{slot.fan_xp}</div>
      </div>

      {/* Tooltip arrow */}
      <div style={{
        position:'absolute',bottom:-7,left:'50%',
        width:12,height:12,background:'#1a1512',
        borderRight:`1px solid ${cat.border}55`,borderBottom:`1px solid ${cat.border}55`,
        transform:'translateX(-50%) rotate(45deg)',
      }}/>
    </div>
  )
}

function SlotCard({slot, concessions, isGM, teamColor, cash, onBuild}:{
  slot:SlotDef, concessions:Concessions, isGM:boolean,
  teamColor:string, cash:number, onBuild:(key:string,cost:number,monthly:number)=>void
}) {
  const [hover,setHover] = useState(false)
  const [selectingZone,setSelectingZone] = useState(false)
  const cat = CAT_COLORS[slot.category]
  const totalQty = slot.variants.reduce((t,v)=>t+((concessions as any)[v.key]||0),0)
  const totalMax = slot.variants.reduce((t,v)=>t+v.max,0)
  const atMax = totalQty >= totalMax
  const canAfford = cash >= slot.cost

  const availableVariants = slot.variants.filter(v=>((concessions as any)[v.key]||0)<v.max)

  return (
    <div style={{position:'relative'}}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>{setHover(false);setSelectingZone(false)}}>

      {hover && <TooltipPanel slot={slot} concessions={concessions} teamColor={teamColor}/>}

      <div style={{
        background:totalQty>0?cat.bg:'#faf8f5',
        border:`1.5px solid ${totalQty>0?cat.border:'#d4cdc5'}`,
        borderRadius:10, padding:'10px 12px',
        transition:'all 0.15s',
        boxShadow:hover?`0 2px 8px ${cat.border}22`:'none',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <span style={{fontSize:18}}>{slot.icon}</span>
          <span style={{fontSize:12,fontWeight:700,color:totalQty>0?cat.text:'#5c554e',flex:1}}>{slot.label}</span>
          <span style={{fontSize:10,fontWeight:600,color:atMax?'#15803d':totalQty>0?cat.text:'#8a8279'}}>
            {totalQty}/{totalMax}
          </span>
        </div>

        {/* Per-zone breakdown */}
        {slot.variants.length > 1 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>
            {slot.variants.map(v=>{
              const qty=(concessions as any)[v.key]||0
              return (
                <span key={v.key} style={{
                  fontSize:9,padding:'1px 6px',borderRadius:3,
                  background:qty>0?cat.border+'22':'#f0ece5',
                  color:qty>0?cat.text:'#8a8279',
                  border:`1px solid ${qty>0?cat.border+'44':'#d4cdc5'}`,
                }}>
                  {v.zoneLabel.split(' ')[0]} {qty}/{v.max}
                </span>
              )
            })}
          </div>
        )}

        {/* Slot bars */}
        <div style={{display:'flex',gap:2,marginBottom:isGM&&!atMax?6:0}}>
          {Array.from({length:totalMax}).map((_,i)=>(
            <div key={i} style={{
              flex:1,minWidth:0,height:5,borderRadius:3,
              background:i<totalQty?cat.border:'#e2dcd5',
            }}/>
          ))}
        </div>

        {/* Build button / zone selector */}
        {isGM && !atMax && (
          <>
            {!selectingZone ? (
              <button onClick={()=>slot.variants.length===1?onBuild(slot.variants[0].key,slot.cost,slot.monthly):setSelectingZone(true)}
                disabled={!canAfford}
                style={{
                  width:'100%',padding:'4px 0',fontSize:10,fontWeight:600,
                  border:'none',borderRadius:6,
                  background:canAfford?cat.border:'#e2dcd5',
                  color:canAfford?'#fff':'#8a8279',
                  cursor:canAfford?'pointer':'not-allowed',
                }}>
                {slot.variants.length===1
                  ? `Build · ${fmtM(slot.cost)}`
                  : `Choose location · ${fmtM(slot.cost)}`
                }
              </button>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <div style={{fontSize:9,color:'#8a8279',marginBottom:2}}>Select location:</div>
                {availableVariants.map(v=>(
                  <button key={v.key}
                    onClick={()=>{onBuild(v.key,slot.cost,slot.monthly);setSelectingZone(false)}}
                    style={{
                      padding:'4px 8px',fontSize:10,fontWeight:600,
                      border:`1px solid ${cat.border}`,borderRadius:6,
                      background:cat.bg,color:cat.text,cursor:'pointer',textAlign:'left',
                    }}>
                    📍 {v.zoneLabel}
                  </button>
                ))}
                <button onClick={()=>setSelectingZone(false)}
                  style={{padding:'2px',fontSize:9,border:'none',background:'transparent',color:'#8a8279',cursor:'pointer'}}>
                  Cancel
                </button>
              </div>
            )}
          </>
        )}

        {atMax && (
          <div style={{fontSize:9,color:cat.text,fontWeight:600,marginTop:2}}>✓ All slots filled</div>
        )}
      </div>
    </div>
  )
}

export default function ArenaBlueprint({concessions, isGM, teamColor, cash, onBuild}:{
  concessions:Concessions, isGM:boolean, teamColor:string, cash:number,
  onBuild:(key:string,cost:number,monthly:number)=>void
}) {
  const totalRev = SLOTS.reduce((t,s)=>{
    const qty = s.variants.reduce((q,v)=>q+((concessions as any)[v.key]||0),0)
    if(!qty) return t
    if(s.fixed_per_game) return t+s.fixed_per_game*qty
    return t+Math.round(13000*(s.adoption_rate/100)*s.avg_spend*qty)
  },0)

  const byCategory = (cat:string) => SLOTS.filter(s=>s.category===cat)

  return (
    <div>
      {isGM && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                     marginBottom:14,padding:'8px 14px',background:'#f0ece5',borderRadius:8,fontSize:12}}>
          <span style={{color:'#5c554e'}}>Est. concession revenue/game</span>
          <strong style={{color:'#15803d',fontSize:14}}>{fmtD(totalRev)}</strong>
        </div>
      )}

      {/* Blueprint SVG */}
      <div style={{position:'relative',marginBottom:16}}>
        <svg viewBox="0 0 960 560" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',display:'block'}}>
          <defs>
            <pattern id="bp2-dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="9" cy="9" r="0.7" fill="#b0a898" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="960" height="560" fill="#f5f1eb"/>
          <rect width="960" height="560" fill="url(#bp2-dots)"/>
          <rect x="20" y="20" width="920" height="520" rx="12" fill="#ede8e0" stroke="#c0b8ae" stroke-width="1.5"/>

          {/* Zone dividers */}
          <line x1="160" y1="20" x2="160" y2="540" stroke="#c8c0b4" stroke-width="0.8" stroke-dasharray="4,4"/>
          <line x1="800" y1="20" x2="800" y2="540" stroke="#c8c0b4" stroke-width="0.8" stroke-dasharray="4,4"/>
          <line x1="20" y1="130" x2="940" y2="130" stroke="#c8c0b4" stroke-width="0.8" stroke-dasharray="4,4"/>
          <line x1="20" y1="430" x2="940" y2="430" stroke="#c8c0b4" stroke-width="0.8" stroke-dasharray="4,4"/>

          {/* Zone labels */}
          <text x="480" y="38" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="#8a8279" letterSpacing="3">NORTH CONCOURSE</text>
          <text x="480" y="552" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="#8a8279" letterSpacing="3">SOUTH CONCOURSE</text>
          <text x="90" y="285" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="#8a8279" letterSpacing="2" transform="rotate(-90 90 285)">WEST</text>
          <text x="870" y="285" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="#8a8279" letterSpacing="2" transform="rotate(90 870 285)">EAST</text>

          {/* Basketball court */}
          <g transform="translate(160,130)">
            <rect x="0" y="0" width="640" height="300" fill="#e8a030" stroke="#c07820" stroke-width="2"/>
            <rect x="8" y="8" width="624" height="284" fill="none" stroke="#fff" stroke-width="1.5"/>
            <line x1="320" y1="8" x2="320" y2="292" stroke="#fff" stroke-width="1.5"/>
            <circle cx="320" cy="150" r="42" fill="none" stroke="#fff" stroke-width="1.5"/>
            <circle cx="320" cy="150" r="5" fill="#d44020"/>
            {/* Left paint */}
            <rect x="8" y="95" width="105" height="110" fill="#d44020" stroke="#fff" stroke-width="1.5"/>
            <path d="M 113 95 A 46 46 0 0 1 113 205" fill="none" stroke="#fff" stroke-width="1.5"/>
            <path d="M 113 95 A 46 46 0 0 0 113 205" fill="none" stroke="#fff" stroke-width="1.5" strokeDasharray="5,4"/>
            <line x1="8" y1="132" x2="8" y2="168" stroke="#fff" stroke-width="3"/>
            <circle cx="38" cy="150" r="9" fill="none" stroke="#fff" stroke-width="1.5"/>
            <line x1="8" y1="36" x2="113" y2="36" stroke="#fff" stroke-width="1.5"/>
            <line x1="8" y1="264" x2="113" y2="264" stroke="#fff" stroke-width="1.5"/>
            <path d="M 113 36 A 142 142 0 0 1 113 264" fill="none" stroke="#fff" stroke-width="1.5"/>
            {/* Right paint */}
            <rect x="527" y="95" width="105" height="110" fill="#d44020" stroke="#fff" stroke-width="1.5"/>
            <path d="M 527 95 A 46 46 0 0 0 527 205" fill="none" stroke="#fff" stroke-width="1.5"/>
            <path d="M 527 95 A 46 46 0 0 1 527 205" fill="none" stroke="#fff" stroke-width="1.5" strokeDasharray="5,4"/>
            <line x1="632" y1="132" x2="632" y2="168" stroke="#fff" stroke-width="3"/>
            <circle cx="602" cy="150" r="9" fill="none" stroke="#fff" stroke-width="1.5"/>
            <line x1="632" y1="36" x2="527" y2="36" stroke="#fff" stroke-width="1.5"/>
            <line x1="632" y1="264" x2="527" y2="264" stroke="#fff" stroke-width="1.5"/>
            <path d="M 527 36 A 142 142 0 0 0 527 264" fill="none" stroke="#fff" stroke-width="1.5"/>
          </g>
        </svg>

        {/* ── HTML SLOT OVERLAYS ── */}

        {/* NORTH UPPER — Suites + VIP Restaurant */}
        <div style={{position:'absolute',top:'3%',left:'3%',right:'3%',display:'flex',gap:8,alignItems:'flex-start',zIndex:10}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',whiteSpace:'nowrap',paddingTop:10}}>UPPER N</div>
          {['corporate_suites','restaurant_vip'].map(id=>{
            const s=SLOTS.find(x=>x.id===id)!
            return <SlotCard key={id} slot={s} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
          })}
        </div>

        {/* NORTH LOWER — Food + Vending */}
        <div style={{position:'absolute',top:'18%',left:'17%',right:'17%',display:'flex',gap:8,alignItems:'flex-start',zIndex:10}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',whiteSpace:'nowrap',paddingTop:10}}>NORTH</div>
          {['food_stall_basic','food_stall_premium','vending'].map(id=>{
            const s=SLOTS.find(x=>x.id===id)!
            return <SlotCard key={id} slot={s} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
          })}
        </div>

        {/* COURT — Jumbotron */}
        <div style={{position:'absolute',top:'38%',left:'50%',transform:'translateX(-50%)',zIndex:10}}>
          <SlotCard slot={SLOTS.find(x=>x.id==='jumbotron')!} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
        </div>

        {/* WEST — Bar + Club Seats */}
        <div style={{position:'absolute',top:'32%',left:'1%',display:'flex',flexDirection:'column',gap:8,zIndex:10}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279'}}>WEST</div>
          {['bar','club_seats'].map(id=>{
            const s=SLOTS.find(x=>x.id===id)!
            return <SlotCard key={id} slot={s} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
          })}
        </div>

        {/* EAST — Bar + Courtside Lounge */}
        <div style={{position:'absolute',top:'32%',right:'1%',display:'flex',flexDirection:'column',gap:8,zIndex:10}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',textAlign:'right'}}>EAST</div>
          <SlotCard slot={SLOTS.find(x=>x.id==='courtside_lounge')!} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
        </div>

        {/* SOUTH — Store + Fan Zone + Mascot + Food + Vending */}
        <div style={{position:'absolute',bottom:'3%',left:'17%',right:'17%',display:'flex',gap:8,alignItems:'flex-start',zIndex:10}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',whiteSpace:'nowrap',paddingTop:10}}>SOUTH</div>
          {['franchise_store','fan_zone','mascot'].map(id=>{
            const s=SLOTS.find(x=>x.id===id)!
            return <SlotCard key={id} slot={s} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
          })}
        </div>

      </div>

      {/* Category legend */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',padding:'8px 12px',background:'#f0ece5',borderRadius:8,fontSize:11}}>
        {Object.entries(CAT_COLORS).map(([cat,c])=>(
          <div key={cat} style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:12,height:12,borderRadius:2,background:c.bg,border:`1px solid ${c.border}`}}/>
            <span style={{color:'#5c554e',textTransform:'capitalize'}}>{cat}</span>
          </div>
        ))}
        <span style={{color:'#8a8279',marginLeft:'auto',fontSize:10}}>Hover any slot for strategy details</span>
      </div>
    </div>
  )
}

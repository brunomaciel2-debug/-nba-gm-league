'use client'
import { useState } from 'react'

type Concessions = {
  food_stall_basic: number
  food_stall_premium: number
  bar: number
  restaurant_vip: number
  franchise_store: number
  vending_machines: number
  corporate_suites: number
  club_seats: number
  courtside_lounge: number
  jumbotron: number
  fan_zone: number
  mascot: number
  monthly_maintenance: number
}

type SlotDef = {
  key: keyof Omit<Concessions, 'monthly_maintenance'>
  label: string
  icon: string
  max: number
  cost: number
  monthly: number
  category: 'food' | 'premium' | 'entertainment'
  adoption_rate: number
  avg_spend: number
  fixed_per_game?: number
  synergies: string[]
  penalties: string[]
  fan_xp: string
  tooltip_detail: string
}

const SLOTS: SlotDef[] = [
  {
    key: 'food_stall_basic',
    label: 'Food Stall',
    icon: '🍟',
    max: 3, cost: 500000, monthly: 5000,
    category: 'food',
    adoption_rate: 25, avg_spend: 8,
    synergies: [
      '3 stalls together → +4% adoption',
      'Jumbotron nearby → +5% all food',
      'Win streak 5+ → +8% adoption',
    ],
    penalties: [
      'Premium Food same corridor → -8% adoption',
      'Loss streak 5+ → -10% adoption',
      'Arena >95% full → -5% (queues)',
    ],
    fan_xp: 'Contributes to Fan Satisfaction score. More variety = higher score.',
    tooltip_detail: '25% of fans stop by · avg $8 spend · Revenue = attendance × 25% × $8',
  },
  {
    key: 'food_stall_premium',
    label: 'Premium Food',
    icon: '🍔',
    max: 2, cost: 1500000, monthly: 12000,
    category: 'food',
    adoption_rate: 18, avg_spend: 18,
    synergies: [
      'Executive Chef staff → +8% adoption',
      'VIP Restaurant nearby → +5% (premium cluster)',
      'Playoffs → +15% adoption',
    ],
    penalties: [
      'Basic Food Stall same corridor → dominates it (-8% basic)',
      'Ticket price >$150 → -5% (fans already spent a lot)',
    ],
    fan_xp: 'Upgrades perceived arena quality. Boosts Fan Satisfaction +3pts/game.',
    tooltip_detail: '18% of fans stop by · avg $18 spend · Higher margin than basic stall',
  },
  {
    key: 'bar',
    label: 'Bar',
    icon: '🍺',
    max: 2, cost: 800000, monthly: 8000,
    category: 'food',
    adoption_rate: 15, avg_spend: 14,
    synergies: [
      'Specialist Bartender staff → +6% adoption',
      'Historic rivalry game → +10% adoption',
      'Win streak → +8% adoption',
    ],
    penalties: [
      '2 bars → second bar gets -5% (split audience)',
      'Family game night → -6% adoption',
    ],
    fan_xp: 'High satisfaction driver for adult fans. +2pts Fan Satisfaction/game.',
    tooltip_detail: '15% of fans stop by · avg $14 spend · Max 35% total bar adoption cap',
  },
  {
    key: 'restaurant_vip',
    label: 'VIP Restaurant',
    icon: '🍽️',
    max: 1, cost: 3000000, monthly: 20000,
    category: 'food',
    adoption_rate: 4, avg_spend: 65,
    synergies: [
      'Courtside Lounge → +10% VIP adoption (premium cluster)',
      'Executive Chef → +8% adoption',
      'Corporate Suites nearby → +6% (suite holders dine here)',
    ],
    penalties: [
      'No Courtside Lounge or Suites → -6% (insufficient VIP clientele)',
      'Low team standing → -4% (VIPs avoid losing teams)',
    ],
    fan_xp: 'Prestige element. Attracts corporate sponsors. +5pts Fan Satisfaction/game.',
    tooltip_detail: 'Only 4% of fans · but avg $65 spend · Unlocks corporate sponsor tiers',
  },
  {
    key: 'franchise_store',
    label: 'Franchise Store',
    icon: '👕',
    max: 1, cost: 2000000, monthly: 10000,
    category: 'entertainment',
    adoption_rate: 12, avg_spend: 35,
    synergies: [
      'Mascot nearby → +5% adoption (mascot drives fans to store)',
      'Win streak → +10% (fans want merch)',
      'Playoffs → +20% adoption',
    ],
    penalties: [
      'Loss streak 5+ → -8% (fans less likely to buy merch)',
      'No Mascot → -3% (less foot traffic)',
    ],
    fan_xp: '+2% attendance next game (fans wearing merch = free marketing). +3pts satisfaction.',
    tooltip_detail: '12% of fans · avg $35 spend · Increases brand loyalty over time',
  },
  {
    key: 'vending_machines',
    label: 'Vending',
    icon: '🥤',
    max: 5, cost: 200000, monthly: 1000,
    category: 'food',
    adoption_rate: 20, avg_spend: 4,
    synergies: [
      'Placed in every corridor → no queues, +3% all concessions adoption',
      'Jumbotron → +5% all food adoption',
    ],
    penalties: [
      'Many food options available → adoption drops to 12% (vending is fallback)',
    ],
    fan_xp: 'Reduces queue frustration. Prevents fans from leaving early. +1pt satisfaction.',
    tooltip_detail: '20% adoption when few options · drops to 12% with full concessions · Low cost, high coverage',
  },
  {
    key: 'corporate_suites',
    label: 'Corp. Suites',
    icon: '🏢',
    max: 3, cost: 5000000, monthly: 30000,
    category: 'premium',
    adoption_rate: 100, avg_spend: 0,
    fixed_per_game: 8000,
    synergies: [
      'VIP Restaurant → suite holders dine there (+6% VIP restaurant)',
      'Courtside Lounge → premium package deal +15% suite revenue',
      '3 suites → unlocks Platinum Sponsor tier',
    ],
    penalties: [
      'No VIP amenities nearby → suite renewal rate drops',
      'Bad team record → -10% suite renewal next season',
    ],
    fan_xp: 'Prestige signal. Attracts top-tier sponsors. +4pts satisfaction from premium presence.',
    tooltip_detail: '$8.000 fixed per suite per game · 3 suites = $24.000/game · Guaranteed revenue regardless of performance',
  },
  {
    key: 'club_seats',
    label: 'Club Seats',
    icon: '💺',
    max: 1, cost: 3000000, monthly: 15000,
    category: 'premium',
    adoption_rate: 100, avg_spend: 0,
    fixed_per_game: 40000,
    synergies: [
      'Bar nearby → club seat holders spend 30% more at bar',
      'Premium Food → club holders are primary target (+12% premium adoption)',
    ],
    penalties: [
      'No lounge access → -15% renewal rate next season',
    ],
    fan_xp: 'Creates loyal premium fanbase. These fans attend 90%+ of games. +3pts satisfaction.',
    tooltip_detail: '$40.000 fixed per game · 100 seats · Most loyal fans in the building',
  },
  {
    key: 'courtside_lounge',
    label: 'Courtside Lounge',
    icon: '⭐',
    max: 1, cost: 8000000, monthly: 50000,
    category: 'premium',
    adoption_rate: 100, avg_spend: 0,
    fixed_per_game: 120000,
    synergies: [
      'VIP Restaurant → package deal, +10% lounge revenue',
      'Corporate Suites → combined premium tier, attracts top sponsors',
      'Win streak → +20% lounge premium pricing possible',
    ],
    penalties: [
      'Losing season → lounge membership cancellations',
      'No VIP Restaurant → -10% revenue (members expect full service)',
    ],
    fan_xp: 'Highest prestige element. Unlocks Celebrity & Media sponsor tiers. +6pts satisfaction.',
    tooltip_detail: '$120.000 fixed per game · VIP members · Biggest single revenue item',
  },
  {
    key: 'jumbotron',
    label: 'Jumbotron',
    icon: '📺',
    max: 1, cost: 4000000, monthly: 20000,
    category: 'entertainment',
    adoption_rate: 0, avg_spend: 0,
    fixed_per_game: 15000,
    synergies: [
      '+5% adoption on ALL food/drink concessions',
      '+3% attendance next 3 games',
      'Fan Zone combo → +8% adoption boost',
      'Advertising revenue $15K/game base',
    ],
    penalties: [
      'No other entertainment → jumbotron alone only +2% (needs context)',
    ],
    fan_xp: '+5pts Fan Satisfaction/game · People stay longer · Reduces early departures by 12%',
    tooltip_detail: 'No per-person revenue · Multiplier effect on all other concessions · Essential for modern arena experience',
  },
  {
    key: 'fan_zone',
    label: 'Fan Zone',
    icon: '🎉',
    max: 1, cost: 2500000, monthly: 12000,
    category: 'entertainment',
    adoption_rate: 10, avg_spend: 20,
    synergies: [
      'Jumbotron → +8% fan zone adoption',
      'Mascot → +6% adoption (mascot performs here)',
      'Family games → +12% adoption',
    ],
    penalties: [
      'Adult/corporate crowd → -4% adoption (less family attendance)',
    ],
    fan_xp: '+5% attendance following week · +5pts satisfaction · Social media posts increase 40%',
    tooltip_detail: '10% of fans · avg $20 · Main driver of repeat attendance among families',
  },
  {
    key: 'mascot',
    label: 'Mascot',
    icon: '🎭',
    max: 1, cost: 500000, monthly: 3000,
    category: 'entertainment',
    adoption_rate: 0, avg_spend: 0,
    fixed_per_game: 5000,
    synergies: [
      'Franchise Store → +5% store adoption',
      'Fan Zone → +6% fan zone adoption',
      'Family nights → +8% overall attendance',
    ],
    penalties: [
      'Corporate/luxury focus → mascot feels out of place (-2pts satisfaction for VIP)',
    ],
    fan_xp: '+2% attendance (families) · +2pts satisfaction · Increases kid/family segment by 15%',
    tooltip_detail: 'Cheapest entertainment investment · Best ROI for family audience · $5K/game · Drives store & fan zone traffic',
  },
]

const CATEGORY_COLORS = {
  food:          { bg:'#dcfce7', border:'#16a34a', text:'#15803d', label:'Food & Drink' },
  premium:       { bg:'#dbeafe', border:'#3b82f6', text:'#1d4ed8', label:'Premium' },
  entertainment: { bg:'#ede9fe', border:'#7c3aed', text:'#5b21b6', label:'Entertainment' },
}

function fmtM(n: number) { return '$' + (n >= 1000000 ? (n/1e6).toFixed(1)+'M' : (n/1000).toFixed(0)+'K') }
function fmtD(n: number) { return '$' + n.toLocaleString() }

function Tooltip({ slot, qty, teamColor }: { slot: SlotDef, qty: number, teamColor: string }) {
  const cat = CATEGORY_COLORS[slot.category]
  const revenuePerGame = slot.fixed_per_game
    ? slot.fixed_per_game * qty
    : Math.round(13000 * (slot.adoption_rate / 100) * slot.avg_spend)

  return (
    <div style={{
      position:'absolute', zIndex:100, bottom:'calc(100% + 8px)', left:'50%',
      transform:'translateX(-50%)', width:280,
      background:'#1a1512', borderRadius:10, padding:14,
      border:`1px solid ${cat.border}44`,
      boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
      pointerEvents:'none',
    }}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
        <span style={{fontSize:20}}>{slot.icon}</span>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:'#f5f1eb'}}>{slot.label}</div>
          <div style={{fontSize:10,color:cat.border}}>{cat.label} · max {slot.max}</div>
        </div>
        <div style={{marginLeft:'auto',textAlign:'right'}}>
          <div style={{fontSize:10,color:'#8a8279'}}>Build cost</div>
          <div style={{fontSize:12,fontWeight:700,color:'#f5f1eb'}}>{fmtM(slot.cost)}</div>
        </div>
      </div>

      {/* Revenue */}
      <div style={{background:'rgba(255,255,255,0.05)',borderRadius:6,padding:'8px 10px',marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:600,color:'#8a8279',marginBottom:4}}>REVENUE MODEL</div>
        <div style={{fontSize:11,color:'#e8c96a'}}>{slot.tooltip_detail}</div>
        {qty > 0 && (
          <div style={{marginTop:4,fontSize:11,fontWeight:700,color:'#4ade80'}}>
            Current: ~{fmtD(revenuePerGame)}/game with {qty} built
          </div>
        )}
      </div>

      {/* Synergies */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:600,color:'#4ade80',marginBottom:3}}>✓ SYNERGIES</div>
        {slot.synergies.map((s,i) => (
          <div key={i} style={{fontSize:10,color:'#a0e0a0',marginBottom:2}}>· {s}</div>
        ))}
      </div>

      {/* Penalties */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:600,color:'#f87171',marginBottom:3}}>⚠ WATCH OUT</div>
        {slot.penalties.map((p,i) => (
          <div key={i} style={{fontSize:10,color:'#fca5a5',marginBottom:2}}>· {p}</div>
        ))}
      </div>

      {/* Fan XP */}
      <div style={{borderTop:'1px solid rgba(255,255,255,0.1)',paddingTop:8}}>
        <div style={{fontSize:10,fontWeight:600,color:'#a78bfa',marginBottom:3}}>🌟 FAN EXPERIENCE</div>
        <div style={{fontSize:10,color:'#c4b5fd'}}>{slot.fan_xp}</div>
      </div>

      {/* Maintenance */}
      <div style={{marginTop:8,fontSize:10,color:'#6b7280'}}>
        Monthly maintenance: {fmtM(slot.monthly)}/mo per unit
      </div>

      {/* Arrow */}
      <div style={{
        position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)',
        width:12, height:12, background:'#1a1512',
        borderRight:`1px solid ${cat.border}44`, borderBottom:`1px solid ${cat.border}44`,
        transform:'translateX(-50%) rotate(45deg)',
      }}/>
    </div>
  )
}

function SlotPill({ slot, qty, isGM, teamColor, onBuild, cash }: {
  slot: SlotDef, qty: number, isGM: boolean, teamColor: string,
  onBuild: (key: string) => void, cash: number
}) {
  const [hover, setHover] = useState(false)
  const cat = CATEGORY_COLORS[slot.category]
  const atMax = qty >= slot.max
  const canAfford = cash >= slot.cost

  return (
    <div style={{position:'relative',display:'inline-block'}}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}>
      <div style={{
        background: qty > 0 ? cat.bg : '#f5f1eb',
        border: `1.5px solid ${qty > 0 ? cat.border : '#c8c0b4'}`,
        borderRadius: 8, padding: '6px 10px',
        cursor: 'default', transition: 'all 0.15s',
        boxShadow: hover ? `0 2px 8px ${cat.border}33` : 'none',
        minWidth: 90,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
          <span style={{fontSize:16}}>{slot.icon}</span>
          <span style={{fontSize:11,fontWeight:700,color: qty > 0 ? cat.text : '#5c554e'}}>{slot.label}</span>
        </div>
        {/* Slot bars */}
        <div style={{display:'flex',gap:2,marginBottom:isGM?4:0}}>
          {Array.from({length:slot.max}).map((_,i) => (
            <div key={i} style={{
              flex:1, height:4, borderRadius:2,
              background: i < qty ? cat.border : '#d4cdc5',
            }}/>
          ))}
        </div>
        {isGM && !atMax && (
          <button onClick={() => onBuild(slot.key)}
            disabled={!canAfford}
            style={{
              width:'100%', padding:'2px 0', fontSize:10, fontWeight:600,
              border:'none', borderRadius:4, marginTop:2,
              background: canAfford ? cat.border : '#e2dcd5',
              color: canAfford ? '#fff' : '#8a8279',
              cursor: canAfford ? 'pointer' : 'not-allowed',
            }}>
            +1 · {fmtM(slot.cost)}
          </button>
        )}
        {atMax && (
          <div style={{fontSize:9,color:cat.text,fontWeight:600,marginTop:2}}>✓ Max</div>
        )}
      </div>
      {hover && <Tooltip slot={slot} qty={qty} teamColor={teamColor}/>}
    </div>
  )
}

export default function ArenaBlueprint({ concessions, isGM, teamColor, cash, onBuild }: {
  concessions: Concessions
  isGM: boolean
  teamColor: string
  cash: number
  onBuild: (key: string, cost: number, monthly: number) => void
}) {
  const handleBuild = (key: string) => {
    const slot = SLOTS.find(s => s.key === key)
    if (slot) onBuild(key, slot.cost, slot.monthly)
  }

  const getQty = (key: string) => (concessions as any)[key] || 0

  // Revenue estimate
  const totalRev = SLOTS.reduce((t, s) => {
    const qty = getQty(s.key)
    if (!qty) return t
    if (s.fixed_per_game) return t + s.fixed_per_game * qty
    return t + Math.round(13000 * (s.adoption_rate/100) * s.avg_spend)
  }, 0)

  const slotsByZone = {
    north_upper: SLOTS.filter(s => ['corporate_suites','restaurant_vip'].includes(s.key)),
    north_lower: SLOTS.filter(s => ['food_stall_basic','food_stall_premium','vending_machines'].includes(s.key)),
    south:       SLOTS.filter(s => ['franchise_store','fan_zone','mascot'].includes(s.key)),
    west:        SLOTS.filter(s => ['bar','club_seats'].includes(s.key)),
    east:        SLOTS.filter(s => ['courtside_lounge'].includes(s.key)),
    court:       SLOTS.filter(s => ['jumbotron'].includes(s.key)),
  }

  return (
    <div style={{position:'relative',userSelect:'none'}}>
      {isGM && (
        <div style={{
          display:'flex',justifyContent:'space-between',alignItems:'center',
          marginBottom:12,padding:'8px 14px',
          background:'#f0ece5',borderRadius:8,fontSize:12,
        }}>
          <span style={{color:'#5c554e'}}>Estimated concession revenue/game</span>
          <strong style={{color:'#15803d',fontSize:14}}>{fmtD(totalRev)}</strong>
        </div>
      )}

      <svg viewBox="0 0 960 620" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',display:'block'}}>
        <defs>
          <pattern id="bp-dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="9" cy="9" r="0.7" fill="#b0a898" opacity="0.3"/>
          </pattern>
        </defs>

        {/* Background */}
        <rect width="960" height="620" fill="#f5f1eb"/>
        <rect width="960" height="620" fill="url(#bp-dots)"/>
        <rect x="20" y="20" width="920" height="580" rx="14" fill="#ede8e0" stroke="#c0b8ae" stroke-width="1.5"/>

        {/* Corridor dividers */}
        <line x1="170" y1="20" x2="170" y2="600" stroke="#c8c0b4" stroke-width="0.8" stroke-dasharray="4,4"/>
        <line x1="790" y1="20" x2="790" y2="600" stroke="#c8c0b4" stroke-width="0.8" stroke-dasharray="4,4"/>
        <line x1="20" y1="155" x2="940" y2="155" stroke="#c8c0b4" stroke-width="0.8" stroke-dasharray="4,4"/>
        <line x1="20" y1="480" x2="940" y2="480" stroke="#c8c0b4" stroke-width="0.8" stroke-dasharray="4,4"/>

        {/* Zone labels */}
        <text x="480" y="42" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="#8a8279" letterSpacing="3">NORTH CONCOURSE</text>
        <text x="480" y="610" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="#8a8279" letterSpacing="3">SOUTH CONCOURSE</text>
        <text x="95" y="320" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="#8a8279" letterSpacing="2" transform="rotate(-90 95 320)">WEST</text>
        <text x="865" y="320" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="#8a8279" letterSpacing="2" transform="rotate(90 865 320)">EAST</text>

        {/* Basketball court */}
        <g transform="translate(170,155)">
          <rect x="0" y="0" width="620" height="325" fill="#e8a030" stroke="#c07820" stroke-width="2"/>
          <rect x="8" y="8" width="604" height="309" fill="none" stroke="#fff" stroke-width="1.5"/>
          <line x1="310" y1="8" x2="310" y2="317" stroke="#fff" stroke-width="1.5"/>
          <circle cx="310" cy="162" r="44" fill="none" stroke="#fff" stroke-width="1.5"/>
          <circle cx="310" cy="162" r="5" fill="#d44020"/>
          {/* Left paint */}
          <rect x="8" y="107" width="118" height="110" fill="#d44020" stroke="#fff" stroke-width="1.5"/>
          <path d="M 126 107 A 50 50 0 0 1 126 217" fill="none" stroke="#fff" stroke-width="1.5"/>
          <path d="M 126 107 A 50 50 0 0 0 126 217" fill="none" stroke="#fff" stroke-width="1.5" strokeDasharray="5,4"/>
          <line x1="8" y1="148" x2="8" y2="178" stroke="#fff" stroke-width="3"/>
          <circle cx="40" cy="162" r="9" fill="none" stroke="#fff" stroke-width="1.5"/>
          <line x1="8" y1="40" x2="126" y2="40" stroke="#fff" stroke-width="1.5"/>
          <line x1="8" y1="284" x2="126" y2="284" stroke="#fff" stroke-width="1.5"/>
          <path d="M 126 40 A 152 152 0 0 1 126 284" fill="none" stroke="#fff" stroke-width="1.5"/>
          {/* Right paint */}
          <rect x="494" y="107" width="118" height="110" fill="#d44020" stroke="#fff" stroke-width="1.5"/>
          <path d="M 494 107 A 50 50 0 0 0 494 217" fill="none" stroke="#fff" stroke-width="1.5"/>
          <path d="M 494 107 A 50 50 0 0 1 494 217" fill="none" stroke="#fff" stroke-width="1.5" strokeDasharray="5,4"/>
          <line x1="612" y1="148" x2="612" y2="178" stroke="#fff" stroke-width="3"/>
          <circle cx="580" cy="162" r="9" fill="none" stroke="#fff" stroke-width="1.5"/>
          <line x1="612" y1="40" x2="494" y2="40" stroke="#fff" stroke-width="1.5"/>
          <line x1="612" y1="284" x2="494" y2="284" stroke="#fff" stroke-width="1.5"/>
          <path d="M 494 40 A 152 152 0 0 0 494 284" fill="none" stroke="#fff" stroke-width="1.5"/>
        </g>
      </svg>

      {/* ── SLOT OVERLAYS (HTML positioned over SVG) ── */}
      <div style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}>

        {/* NORTH UPPER — Suites + VIP Restaurant */}
        <div style={{position:'absolute',top:'6%',left:'3%',right:'3%',display:'flex',gap:6,alignItems:'flex-start',pointerEvents:'all'}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',whiteSpace:'nowrap',paddingTop:8,marginRight:4}}>UPPER NORTH</div>
          {slotsByZone.north_upper.map(s => (
            <SlotPill key={s.key} slot={s} qty={getQty(s.key)} isGM={isGM} teamColor={teamColor} onBuild={handleBuild} cash={cash}/>
          ))}
        </div>

        {/* NORTH LOWER — Food + Vending */}
        <div style={{position:'absolute',top:'20%',left:'18%',right:'18%',display:'flex',gap:6,alignItems:'flex-start',pointerEvents:'all'}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',whiteSpace:'nowrap',paddingTop:8,marginRight:4}}>NORTH</div>
          {slotsByZone.north_lower.map(s => (
            <SlotPill key={s.key} slot={s} qty={getQty(s.key)} isGM={isGM} teamColor={teamColor} onBuild={handleBuild} cash={cash}/>
          ))}
        </div>

        {/* COURT — Jumbotron */}
        <div style={{position:'absolute',top:'42%',left:'44%',transform:'translateX(-50%)',pointerEvents:'all'}}>
          {slotsByZone.court.map(s => (
            <SlotPill key={s.key} slot={s} qty={getQty(s.key)} isGM={isGM} teamColor={teamColor} onBuild={handleBuild} cash={cash}/>
          ))}
        </div>

        {/* WEST — Bar + Club Seats */}
        <div style={{position:'absolute',top:'35%',left:'1%',display:'flex',flexDirection:'column',gap:6,pointerEvents:'all'}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',marginBottom:2}}>WEST</div>
          {slotsByZone.west.map(s => (
            <SlotPill key={s.key} slot={s} qty={getQty(s.key)} isGM={isGM} teamColor={teamColor} onBuild={handleBuild} cash={cash}/>
          ))}
        </div>

        {/* EAST — Courtside Lounge */}
        <div style={{position:'absolute',top:'35%',right:'1%',display:'flex',flexDirection:'column',gap:6,pointerEvents:'all'}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',marginBottom:2,textAlign:'right'}}>EAST</div>
          {slotsByZone.east.map(s => (
            <SlotPill key={s.key} slot={s} qty={getQty(s.key)} isGM={isGM} teamColor={teamColor} onBuild={handleBuild} cash={cash}/>
          ))}
        </div>

        {/* SOUTH — Store + Fan Zone + Mascot */}
        <div style={{position:'absolute',bottom:'6%',left:'18%',right:'18%',display:'flex',gap:6,alignItems:'flex-start',pointerEvents:'all'}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',whiteSpace:'nowrap',paddingTop:8,marginRight:4}}>SOUTH</div>
          {slotsByZone.south.map(s => (
            <SlotPill key={s.key} slot={s} qty={getQty(s.key)} isGM={isGM} teamColor={teamColor} onBuild={handleBuild} cash={cash}/>
          ))}
        </div>

      </div>
    </div>
  )
}

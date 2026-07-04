'use client'
import { useState } from 'react'
import { useTranslation } from '@/components/I18nProvider'

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

type Zone = 'north'|'south'|'east'|'west'|'upper_north'|'south_entrance'|'court'

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
  category: 'food'|'premium'|'entertainment'
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
    id:'food_stall_basic', label:'Food Stall', icon:'🍟',
    cost:500000, monthly:5000, category:'food', adoption_rate:25, avg_spend:8,
    variants:[
      {key:'food_stall_basic_north',zone:'north',zoneLabel:'North concourse',max:2},
      {key:'food_stall_basic_south',zone:'south',zoneLabel:'South concourse',max:2},
      {key:'food_stall_basic_east', zone:'east', zoneLabel:'East corridor',  max:1},
      {key:'food_stall_basic_west', zone:'west', zoneLabel:'West corridor',  max:1},
    ],
    synergies:['3 stalls in different corridors → +4% adoption','Jumbotron → +5% all food','Win streak 5+ → +8%'],
    penalties:['2 stalls same corridor → second loses -10%','Premium Food same corridor → -8%','Loss streak 5+ → -10%'],
    fan_xp:'More variety = higher Fan Satisfaction score.',
    tooltip_detail:'25% of fans stop by · avg $8 · spread across corridors to avoid penalty',
  },
  {
    id:'food_stall_premium', label:'Premium Food', icon:'🍔',
    cost:1500000, monthly:12000, category:'food', adoption_rate:18, avg_spend:18,
    variants:[
      {key:'food_stall_premium_north',zone:'north',zoneLabel:'North concourse',max:1},
      {key:'food_stall_premium_south',zone:'south',zoneLabel:'South concourse',max:1},
    ],
    synergies:['Executive Chef staff → +8%','VIP Restaurant nearby → +5%','Playoffs → +15%'],
    penalties:['Basic Food Stall same corridor → basic loses -8%','Ticket >$150 → -5%'],
    fan_xp:'+3pts Fan Satisfaction/game.',
    tooltip_detail:'18% of fans · avg $18 · north for suite holders, south for general entry',
  },
  {
    id:'bar', label:'Bar', icon:'🍺',
    cost:800000, monthly:8000, category:'food', adoption_rate:15, avg_spend:14,
    variants:[
      {key:'bar_east',zone:'east',zoneLabel:'East corridor',max:1},
      {key:'bar_west',zone:'west',zoneLabel:'West corridor',max:1},
    ],
    synergies:['Specialist Bartender → +6%','Rivalry game → +10%','Club Seats nearby → +5%'],
    penalties:['Both bars active → each -3% (split audience)','Family night → -6%'],
    fan_xp:'+2pts Fan Satisfaction/game.',
    tooltip_detail:'15% of fans · avg $14 · east bar near courtside lounge is a premium combo',
  },
  {
    id:'vending', label:'Vending', icon:'🥤',
    cost:200000, monthly:1000, category:'food', adoption_rate:20, avg_spend:4,
    variants:[
      {key:'vending_north',zone:'north',zoneLabel:'North concourse',max:2},
      {key:'vending_south',zone:'south',zoneLabel:'South concourse',max:2},
      {key:'vending_east', zone:'east', zoneLabel:'East corridor',  max:1},
      {key:'vending_west', zone:'west', zoneLabel:'West corridor',  max:1},
    ],
    synergies:['All corridors covered → +3% all concessions (no queues)','Jumbotron → +5% all food'],
    penalties:['Many food options → drops to 12% adoption (fallback)'],
    fan_xp:'Reduces queue frustration. +1pt satisfaction.',
    tooltip_detail:'Cheapest option · best coverage per dollar · fill gaps everywhere',
  },
  {
    id:'restaurant_vip', label:'VIP Restaurant', icon:'🍽️',
    cost:3000000, monthly:20000, category:'food', adoption_rate:4, avg_spend:65,
    variants:[{key:'restaurant_vip',zone:'upper_north',zoneLabel:'Upper North level',max:1}],
    synergies:['Courtside Lounge → +10% VIP adoption','Corporate Suites → +6%','Executive Chef → +8%'],
    penalties:['No Courtside or Suites → -6%','Bad record → -4%'],
    fan_xp:'Prestige element. Unlocks corporate sponsor tiers. +5pts.',
    tooltip_detail:'Only 4% of fans · avg $65 · unlocks corporate sponsor tiers',
  },
  {
    id:'franchise_store', label:'Franchise Store', icon:'👕',
    cost:2000000, monthly:10000, category:'entertainment', adoption_rate:12, avg_spend:35,
    variants:[{key:'franchise_store',zone:'south_entrance',zoneLabel:'South main entrance',max:1}],
    synergies:['Mascot nearby → +5%','Win streak → +10%','Playoffs → +20%'],
    penalties:['Loss streak 5+ → -8%'],
    fan_xp:'+2% attendance next game. +3pts satisfaction.',
    tooltip_detail:'12% of fans · avg $35 · south entrance = maximum foot traffic',
  },
  {
    id:'corporate_suites', label:'Corp. Suites', icon:'🏢',
    cost:5000000, monthly:30000, category:'premium', adoption_rate:100, avg_spend:0, fixed_per_game:8000,
    variants:[{key:'corporate_suites',zone:'upper_north',zoneLabel:'Upper North level',max:3}],
    synergies:['VIP Restaurant → suite holders dine there','3 suites → unlocks Platinum Sponsor tier','Courtside Lounge → +15% suite revenue'],
    penalties:['No VIP amenities → suite renewal drops','Bad record → -10% renewal next season'],
    fan_xp:'Prestige signal. Attracts top-tier sponsors. +4pts.',
    tooltip_detail:'$8K fixed per suite per game · 3 suites = $24K/game · guaranteed revenue',
  },
  {
    id:'club_seats', label:'Club Seats', icon:'💺',
    cost:3000000, monthly:15000, category:'premium', adoption_rate:100, avg_spend:0, fixed_per_game:40000,
    variants:[{key:'club_seats',zone:'west',zoneLabel:'West sideline',max:1}],
    synergies:['Bar West → club holders spend 30% more','Premium Food north → club holders walk through'],
    penalties:['No lounge access → -15% renewal next season'],
    fan_xp:'Most loyal fans attend 90%+ of games. +3pts.',
    tooltip_detail:'$40K fixed per game · most loyal fans in the building',
  },
  {
    id:'courtside_lounge', label:'Courtside Lounge', icon:'⭐',
    cost:8000000, monthly:50000, category:'premium', adoption_rate:100, avg_spend:0, fixed_per_game:120000,
    variants:[{key:'courtside_lounge',zone:'east',zoneLabel:'East sideline',max:1}],
    synergies:['VIP Restaurant → package deal +10%','Bar East → lounge members use east bar','3 Suites → combined premium tier'],
    penalties:['No VIP Restaurant → -10% revenue','Losing season → membership cancellations'],
    fan_xp:'Unlocks Celebrity & Media sponsor tiers. +6pts.',
    tooltip_detail:'$120K fixed per game · biggest single revenue item',
  },
  {
    id:'jumbotron', label:'Jumbotron', icon:'📺',
    cost:4000000, monthly:20000, category:'entertainment', adoption_rate:0, avg_spend:0, fixed_per_game:15000,
    variants:[{key:'jumbotron',zone:'court',zoneLabel:'Court centre (ceiling)',max:1}],
    synergies:['+5% adoption on ALL food/drink','+3% attendance next 3 games','Fan Zone combo → +8% boost','$15K/game advertising'],
    penalties:['No other entertainment → only +2% effect'],
    fan_xp:'+5pts Fan Satisfaction · reduces early departures 12%.',
    tooltip_detail:'Multiplier on all concessions · essential for modern arena experience',
  },
  {
    id:'fan_zone', label:'Fan Zone', icon:'🎉',
    cost:2500000, monthly:12000, category:'entertainment', adoption_rate:10, avg_spend:20,
    variants:[{key:'fan_zone',zone:'south_entrance',zoneLabel:'South main entrance',max:1}],
    synergies:['Jumbotron → +8%','Mascot → +6%','Family games → +12%'],
    penalties:['Corporate crowd → -4% adoption'],
    fan_xp:'+5% attendance following week. Social media +40%. +5pts.',
    tooltip_detail:'10% of fans · avg $20 · main driver of repeat attendance',
  },
  {
    id:'mascot', label:'Mascot', icon:'🎭',
    cost:500000, monthly:3000, category:'entertainment', adoption_rate:0, avg_spend:0, fixed_per_game:5000,
    variants:[{key:'mascot',zone:'south_entrance',zoneLabel:'South entrance & tunnel',max:1}],
    synergies:['Franchise Store → +5%','Fan Zone → +6%','Family nights → +8% attendance'],
    penalties:['Corporate/luxury focus → -2pts VIP satisfaction'],
    fan_xp:'+2% attendance (families). Kid/family segment +15%. +2pts.',
    tooltip_detail:'Cheapest entertainment · best ROI for family audience · $5K/game',
  },
]

const SLOT_LABEL_PT: Record<string,string> = {
  food_stall_basic: 'Banca de Comida', food_stall_premium: 'Comida Premium', bar: 'Bar',
  vending: 'Vending', restaurant_vip: 'Restaurante VIP', franchise_store: 'Loja da Equipa',
  corporate_suites: 'Camarotes Corp.', club_seats: 'Lugares Clube', courtside_lounge: 'Lounge Courtside',
  jumbotron: 'Jumbotron', fan_zone: 'Zona de Adeptos', mascot: 'Mascote',
}

const CAT = {
  food:          {bg:'#dcfce7',border:'#16a34a',text:'#15803d'},
  premium:       {bg:'#dbeafe',border:'#3b82f6',text:'#1d4ed8'},
  entertainment: {bg:'#ede9fe',border:'#7c3aed',text:'#5b21b6'},
}

function fmtM(n:number){ return '$'+(n>=1000000?(n/1e6).toFixed(1)+'M':(n/1000).toFixed(0)+'K') }
function fmtD(n:number){ return '$'+n.toLocaleString() }

function SlotCard({slot,concessions,isGM,teamColor,cash,onBuild}:{
  slot:SlotDef, concessions:Concessions, isGM:boolean,
  teamColor:string, cash:number, onBuild:(key:string,cost:number,monthly:number)=>void
}) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [hover,setHover] = useState(false)
  const [picking,setPicking] = useState(false)
  const c = CAT[slot.category]
  const totalQty = slot.variants.reduce((t,v)=>t+((concessions as any)[v.key]||0),0)
  const totalMax = slot.variants.reduce((t,v)=>t+v.max,0)
  const atMax = totalQty>=totalMax
  const canAfford = cash>=slot.cost
  const available = slot.variants.filter(v=>((concessions as any)[v.key]||0)<v.max)

  return (
    <div style={{position:'relative'}}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>{setHover(false);setPicking(false)}}>

      {/* Tooltip */}
      {hover && !picking && (
        <div style={{
          position:'absolute',zIndex:300,bottom:'calc(100% + 8px)',left:'50%',
          transform:'translateX(-50%)',width:280,
          background:'#1a1512',borderRadius:10,padding:12,
          border:`1px solid ${c.border}55`,
          boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
          pointerEvents:'none',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,paddingBottom:8,borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
            <span style={{fontSize:18}}>{slot.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'#f5f1eb'}}>{isPT?SLOT_LABEL_PT[slot.id]:slot.label}</div>
              <div style={{fontSize:10,color:c.border}}>{isPT?'Construir':'Build'}: {fmtM(slot.cost)} · {isPT?'Manutenção':'Maint'}: {fmtM(slot.monthly)}/mo</div>
            </div>
          </div>
          <div style={{fontSize:10,color:'#d4cdc5',marginBottom:8,lineHeight:1.5}}>{slot.tooltip_detail}</div>
          {/* Zones */}
          {slot.variants.length>1 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:'#8a8279',marginBottom:3}}>📍 {isPT?'LOCALIZAÇÕES':'LOCATIONS'}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                {slot.variants.map(v=>{
                  const q=(concessions as any)[v.key]||0
                  return <span key={v.key} style={{fontSize:9,padding:'1px 6px',borderRadius:3,
                    background:q>=v.max?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.05)',
                    color:q>=v.max?'#4ade80':'#8a8279',border:'1px solid rgba(255,255,255,0.1)'}}>
                    {v.zoneLabel} {q}/{v.max}
                  </span>
                })}
              </div>
            </div>
          )}
          <div style={{marginBottom:6}}>
            <div style={{fontSize:9,fontWeight:700,color:'#4ade80',marginBottom:2}}>✓ {isPT?'SINERGIAS':'SYNERGIES'}</div>
            {slot.synergies.map((s,i)=><div key={i} style={{fontSize:9,color:'#86efac',marginBottom:1}}>· {s}</div>)}
          </div>
          <div style={{marginBottom:6}}>
            <div style={{fontSize:9,fontWeight:700,color:'#f87171',marginBottom:2}}>⚠ {isPT?'ATENÇÃO':'WATCH OUT'}</div>
            {slot.penalties.map((p,i)=><div key={i} style={{fontSize:9,color:'#fca5a5',marginBottom:1}}>· {p}</div>)}
          </div>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:'#a78bfa',marginBottom:2}}>🌟 {isPT?'EXPERIÊNCIA DO ADEPTO':'FAN XP'}</div>
            <div style={{fontSize:9,color:'#c4b5fd'}}>{slot.fan_xp}</div>
          </div>
          <div style={{position:'absolute',bottom:-6,left:'50%',width:10,height:10,background:'#1a1512',
            borderRight:`1px solid ${c.border}55`,borderBottom:`1px solid ${c.border}55`,
            transform:'translateX(-50%) rotate(45deg)'}}/>
        </div>
      )}

      <div style={{
        background:totalQty>0?c.bg:'#faf8f5',
        border:`1.5px solid ${totalQty>0?c.border:'#d4cdc5'}`,
        borderRadius:8,padding:'8px 10px',minWidth:110,
        boxShadow:hover?`0 2px 6px ${c.border}22`:'none',
        transition:'all 0.1s',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
          <span style={{fontSize:16}}>{slot.icon}</span>
          <span style={{fontSize:11,fontWeight:700,color:totalQty>0?c.text:'#5c554e',flex:1,lineHeight:1.2}}>{isPT?SLOT_LABEL_PT[slot.id]:slot.label}</span>
          <span style={{fontSize:10,fontWeight:600,color:atMax?'#15803d':totalQty>0?c.text:'#8a8279'}}>{totalQty}/{totalMax}</span>
        </div>

        {/* Zone pills for multi-location slots */}
        {slot.variants.length>1 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:2,marginBottom:5}}>
            {slot.variants.map(v=>{
              const q=(concessions as any)[v.key]||0
              return <span key={v.key} style={{fontSize:8,padding:'1px 5px',borderRadius:3,
                background:q>0?c.border+'22':'#f0ece5',color:q>0?c.text:'#8a8279',
                border:`1px solid ${q>0?c.border+'44':'#e2dcd5'}`}}>
                {v.zoneLabel.split(' ')[0]} {q}/{v.max}
              </span>
            })}
          </div>
        )}

        {/* Progress bars */}
        <div style={{display:'flex',gap:2,marginBottom:isGM&&!atMax?5:0}}>
          {Array.from({length:totalMax}).map((_,i)=>(
            <div key={i} style={{flex:1,minWidth:0,height:4,borderRadius:2,
              background:i<totalQty?c.border:'#e2dcd5'}}/>
          ))}
        </div>

        {isGM && !atMax && !picking && (
          <button onClick={()=>available.length===1?onBuild(available[0].key,slot.cost,slot.monthly):setPicking(true)}
            disabled={!canAfford}
            style={{width:'100%',padding:'3px 0',fontSize:10,fontWeight:600,border:'none',borderRadius:5,
              background:canAfford?c.border:'#e2dcd5',color:canAfford?'#fff':'#8a8279',
              cursor:canAfford?'pointer':'not-allowed',marginTop:2}}>
            {available.length===1?`${isPT?'Construir':'Build'} · ${fmtM(slot.cost)}`:`${isPT?'Escolher localização':'Choose location'} · ${fmtM(slot.cost)}`}
          </button>
        )}

        {picking && (
          <div style={{display:'flex',flexDirection:'column',gap:3,marginTop:4}}>
            <div style={{fontSize:9,color:'#8a8279'}}>{isPT?'Escolhe localização:':'Pick location:'}</div>
            {available.map(v=>(
              <button key={v.key} onClick={()=>{onBuild(v.key,slot.cost,slot.monthly);setPicking(false)}}
                style={{padding:'3px 6px',fontSize:10,fontWeight:600,textAlign:'left',
                  border:`1px solid ${c.border}`,borderRadius:5,background:c.bg,color:c.text,cursor:'pointer'}}>
                📍 {v.zoneLabel}
              </button>
            ))}
            <button onClick={()=>setPicking(false)}
              style={{padding:'2px',fontSize:9,border:'none',background:'transparent',color:'#8a8279',cursor:'pointer'}}>{isPT?'Cancelar':'Cancel'}</button>
          </div>
        )}

        {atMax && <div style={{fontSize:9,color:c.text,fontWeight:600,marginTop:3}}>✓ {isPT?'Máximo construído':'Max built'}</div>}
      </div>
    </div>
  )
}

const CAT_LABEL_PT: Record<string,string> = { food:'Comida', premium:'Premium', entertainment:'Entretenimento' }

export default function ArenaBlueprint({concessions,isGM,teamColor,cash,onBuild}:{
  concessions:Concessions, isGM:boolean, teamColor:string, cash:number,
  onBuild:(key:string,cost:number,monthly:number)=>void
}) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const totalRev = SLOTS.reduce((t,s)=>{
    const qty=s.variants.reduce((q,v)=>q+((concessions as any)[v.key]||0),0)
    if(!qty)return t
    if(s.fixed_per_game)return t+s.fixed_per_game*qty
    return t+Math.round(13000*(s.adoption_rate/100)*s.avg_spend*qty)
  },0)

  const slot=(id:string)=>SLOTS.find(s=>s.id===id)!

  return (
    <div style={{userSelect:'none'}}>
      {isGM && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
          marginBottom:12,padding:'8px 14px',background:'#f0ece5',borderRadius:8,fontSize:12}}>
          <span style={{color:'#5c554e'}}>{isPT?'Receita de bares/lojas est. por jogo':'Est. concession revenue/game'}</span>
          <strong style={{color:'#15803d',fontSize:14}}>{fmtD(totalRev)}</strong>
        </div>
      )}

      {/* ── LAYOUT: 3 rows × 3 cols ── */}
      <div style={{display:'grid',gridTemplateColumns:'180px 1fr 180px',gridTemplateRows:'auto 1fr auto',gap:10}}>

        {/* TOP LEFT — upper north slots */}
        <div style={{gridColumn:'1/3',gridRow:'1',display:'flex',gap:8,alignItems:'flex-start',padding:'8px 10px',
          background:'#f0ece5',borderRadius:8,border:'1px solid #d4cdc5'}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',whiteSpace:'nowrap',paddingTop:10,minWidth:50}}>{isPT?'SUP. NORTE':'UPPER N'}</div>
          {['corporate_suites','restaurant_vip'].map(id=>(
            <SlotCard key={id} slot={slot(id)} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
          ))}
        </div>

        {/* TOP RIGHT — empty */}
        <div style={{gridColumn:'3',gridRow:'1'}}/>

        {/* MIDDLE LEFT — west slots */}
        <div style={{gridColumn:'1',gridRow:'2',display:'flex',flexDirection:'column',gap:8,padding:'8px',
          background:'#f0ece5',borderRadius:8,border:'1px solid #d4cdc5',justifyContent:'center'}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',marginBottom:2}}>{isPT?'OESTE':'WEST'}</div>
          {['bar','club_seats'].map(id=>(
            <SlotCard key={id} slot={slot(id)} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
          ))}
        </div>

        {/* MIDDLE CENTRE — court + north/south food rows */}
        <div style={{gridColumn:'2',gridRow:'2',display:'flex',flexDirection:'column',gap:8}}>
          {/* North food row */}
          <div style={{display:'flex',gap:8,padding:'6px 8px',background:'#f0ece5',borderRadius:8,border:'1px solid #d4cdc5'}}>
            <div style={{fontSize:9,fontWeight:700,color:'#8a8279',whiteSpace:'nowrap',paddingTop:8,minWidth:36}}>{isPT?'NORTE':'NORTH'}</div>
            {['food_stall_basic','food_stall_premium','vending'].map(id=>(
              <SlotCard key={id} slot={slot(id)} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
            ))}
          </div>

          {/* Court SVG */}
          <div style={{flex:1,position:'relative',borderRadius:8,overflow:'hidden',minHeight:220}}>
            <svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',display:'block'}}>
              <rect x="0" y="0" width="640" height="300" fill="#e8a030" stroke="#c07820" strokeWidth="2"/>
              <rect x="8" y="8" width="624" height="284" fill="none" stroke="#fff" strokeWidth="1.5"/>
              <line x1="320" y1="8" x2="320" y2="292" stroke="#fff" strokeWidth="1.5"/>
              <circle cx="320" cy="150" r="42" fill="none" stroke="#fff" strokeWidth="1.5"/>
              <circle cx="320" cy="150" r="5" fill="#d44020"/>
              {/* Left paint */}
              <rect x="8" y="95" width="105" height="110" fill="#d44020" stroke="#fff" strokeWidth="1.5"/>
              <path d="M 113 95 A 46 46 0 0 1 113 205" fill="none" stroke="#fff" strokeWidth="1.5"/>
              <path d="M 113 95 A 46 46 0 0 0 113 205" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="5,4"/>
              <line x1="8" y1="132" x2="8" y2="168" stroke="#fff" strokeWidth="3"/>
              <circle cx="38" cy="150" r="9" fill="none" stroke="#fff" strokeWidth="1.5"/>
              <line x1="8" y1="36" x2="113" y2="36" stroke="#fff" strokeWidth="1.5"/>
              <line x1="8" y1="264" x2="113" y2="264" stroke="#fff" strokeWidth="1.5"/>
              <path d="M 113 36 A 142 142 0 0 1 113 264" fill="none" stroke="#fff" strokeWidth="1.5"/>
              {/* Right paint */}
              <rect x="527" y="95" width="105" height="110" fill="#d44020" stroke="#fff" strokeWidth="1.5"/>
              <path d="M 527 95 A 46 46 0 0 0 527 205" fill="none" stroke="#fff" strokeWidth="1.5"/>
              <path d="M 527 95 A 46 46 0 0 1 527 205" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="5,4"/>
              <line x1="632" y1="132" x2="632" y2="168" stroke="#fff" strokeWidth="3"/>
              <circle cx="602" cy="150" r="9" fill="none" stroke="#fff" strokeWidth="1.5"/>
              <line x1="632" y1="36" x2="527" y2="36" stroke="#fff" strokeWidth="1.5"/>
              <line x1="632" y1="264" x2="527" y2="264" stroke="#fff" strokeWidth="1.5"/>
              <path d="M 527 36 A 142 142 0 0 0 527 264" fill="none" stroke="#fff" strokeWidth="1.5"/>
            </svg>
            {/* Jumbotron centrado sobre o campo */}
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)'}}>
              <SlotCard slot={slot('jumbotron')} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
            </div>
          </div>

          {/* South food row */}
          <div style={{display:'flex',gap:8,padding:'6px 8px',background:'#f0ece5',borderRadius:8,border:'1px solid #d4cdc5'}}>
            <div style={{fontSize:9,fontWeight:700,color:'#8a8279',whiteSpace:'nowrap',paddingTop:8,minWidth:36}}>{isPT?'SUL':'SOUTH'}</div>
            {['franchise_store','fan_zone','mascot'].map(id=>(
              <SlotCard key={id} slot={slot(id)} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
            ))}
          </div>
        </div>

        {/* MIDDLE RIGHT — east slots */}
        <div style={{gridColumn:'3',gridRow:'2',display:'flex',flexDirection:'column',gap:8,padding:'8px',
          background:'#f0ece5',borderRadius:8,border:'1px solid #d4cdc5',justifyContent:'center'}}>
          <div style={{fontSize:9,fontWeight:700,color:'#8a8279',marginBottom:2,textAlign:'right'}}>{isPT?'ESTE':'EAST'}</div>
          <SlotCard slot={slot('courtside_lounge')} concessions={concessions} isGM={isGM} teamColor={teamColor} cash={cash} onBuild={onBuild}/>
        </div>

        {/* BOTTOM — legend */}
        <div style={{gridColumn:'1/4',gridRow:'3',display:'flex',gap:12,flexWrap:'wrap',
          padding:'8px 12px',background:'#f0ece5',borderRadius:8,fontSize:11,alignItems:'center'}}>
          {Object.entries(CAT).map(([cat,c])=>(
            <div key={cat} style={{display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:12,height:12,borderRadius:2,background:c.bg,border:`1px solid ${c.border}`}}/>
              <span style={{color:'#5c554e',textTransform:'capitalize'}}>{isPT?CAT_LABEL_PT[cat]:cat}</span>
            </div>
          ))}
          <span style={{color:'#8a8279',marginLeft:'auto',fontSize:10}}>{isPT?'Passa o rato sobre um espaço para ver detalhes de estratégia':'Hover any slot for strategy details'}</span>
        </div>
      </div>
    </div>
  )
}

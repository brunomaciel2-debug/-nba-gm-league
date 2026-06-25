'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Section = { id:string, section:string, level:number, capacity:number, under_construction:boolean, construction_ends_at:string|null }
type Config = { id:string, ticket_lower:number, ticket_upper:number, ticket_courtside:number, ticket_suite:number }
type Concessions = {
  id:string
  food_stall_basic:number, food_stall_premium:number, bar:number,
  restaurant_vip:number, franchise_store:number, vending_machines:number,
  corporate_suites:number, club_seats:number, courtside_lounge:number,
  jumbotron:number, fan_zone:number, mascot:number,
  monthly_maintenance:number
}

const BUILT_SECTIONS = ['N1','N2','N3','S1','S2','S3','W1','E1']
const FUTURE_SECTIONS = ['N1A','N2A','N3A','S1A','S2A','S3A','W_upper','W_mid','E_upper','E_mid']
const UPGRADE_COST = 12000000
const BUILD_COST   = 8000000
const UPGRADE_WEEKS = 8
const BUILD_WEEKS   = 12
const EXPANSION_RATE = 0.6

// Concession definitions with zones (which SVG zone IDs they light up)
const CONCESSIONS = [
  {
    key:'food_stall_basic', label:'Food Stall', icon:'🌭', max:3,
    cost:500000, monthly:5000, per_capita:3,
    category:'Concessions',
    zones:['zone-north-concourse','zone-south-concourse'],
    zoneLabel:'North & South concourses',
    desc:'Basic food stand in main concourse',
  },
  {
    key:'food_stall_premium', label:'Premium Food', icon:'🍔', max:2,
    cost:1500000, monthly:12000, per_capita:8,
    category:'Concessions',
    zones:['zone-north-concourse','zone-east-concourse'],
    zoneLabel:'North & East concourses',
    desc:'Premium food options in upper concourse',
  },
  {
    key:'bar', label:'Bar', icon:'🍺', max:2,
    cost:800000, monthly:8000, per_capita:5,
    category:'Concessions',
    zones:['zone-west-concourse','zone-east-concourse'],
    zoneLabel:'West & East sideline areas',
    desc:'Full bar service at sideline entrances',
  },
  {
    key:'restaurant_vip', label:'VIP Restaurant', icon:'🍽️', max:1,
    cost:3000000, monthly:20000, per_capita:15,
    category:'Concessions',
    zones:['zone-upper-north'],
    zoneLabel:'Upper North level',
    desc:'Fine dining with court views',
  },
  {
    key:'franchise_store', label:'Franchise Store', icon:'👕', max:1,
    cost:2000000, monthly:10000, per_capita:10,
    category:'Concessions',
    zones:['zone-main-entrance'],
    zoneLabel:'Main entrance (South)',
    desc:'Merchandise & apparel at main gate',
  },
  {
    key:'vending_machines', label:'Vending Machines', icon:'🎰', max:5,
    cost:200000, monthly:1000, per_capita:1,
    category:'Concessions',
    zones:['zone-north-concourse','zone-south-concourse','zone-west-concourse','zone-east-concourse'],
    zoneLabel:'All concourses',
    desc:'Automated vending throughout arena',
  },
  {
    key:'corporate_suites', label:'Corporate Suites', icon:'🏢', max:3,
    cost:5000000, monthly:30000, fixed_per_game:80000,
    category:'Premium',
    zones:['zone-upper-north','zone-upper-south'],
    zoneLabel:'Upper North & South levels',
    desc:'Private luxury suites with full service',
  },
  {
    key:'club_seats', label:'Club Seats', icon:'💺', max:1,
    cost:3000000, monthly:15000, fixed_per_game:40000,
    category:'Premium',
    zones:['zone-lower-west','zone-lower-east'],
    zoneLabel:'Lower West & East sidelines',
    desc:'Premium club-level seating with lounge access',
  },
  {
    key:'courtside_lounge', label:'Courtside Lounge', icon:'⭐', max:1,
    cost:8000000, monthly:50000, fixed_per_game:120000,
    category:'Premium',
    zones:['zone-courtside-east'],
    zoneLabel:'East courtside',
    desc:'VIP courtside hospitality lounge',
  },
  {
    key:'jumbotron', label:'LED Jumbotron', icon:'📺', max:1,
    cost:4000000, monthly:20000, fixed_per_game:15000,
    category:'Entertainment',
    zones:['zone-ceiling'],
    zoneLabel:'Ceiling centre',
    desc:'Central scoreboard & advertising display',
  },
  {
    key:'fan_zone', label:'Fan Experience Zone', icon:'🎉', max:1,
    cost:2500000, monthly:12000, per_capita:7,
    category:'Entertainment',
    zones:['zone-main-entrance'],
    zoneLabel:'Main entrance atrium',
    desc:'Interactive fan experience at main entry',
  },
  {
    key:'mascot', label:'Mascot & Events', icon:'🎭', max:1,
    cost:500000, monthly:3000, fixed_per_game:5000,
    category:'Entertainment',
    zones:['zone-court-floor'],
    zoneLabel:'Court floor & tunnel',
    desc:'Live entertainment and mascot appearances',
  },
]

const ZONE_COLORS: Record<string,string> = {
  'zone-north-concourse':  '#f59e0b',
  'zone-south-concourse':  '#f59e0b',
  'zone-west-concourse':   '#3b82f6',
  'zone-east-concourse':   '#3b82f6',
  'zone-upper-north':      '#8b5cf6',
  'zone-upper-south':      '#8b5cf6',
  'zone-lower-west':       '#10b981',
  'zone-lower-east':       '#10b981',
  'zone-courtside-east':   '#ef4444',
  'zone-main-entrance':    '#f97316',
  'zone-ceiling':          '#6366f1',
  'zone-court-floor':      '#14b8a6',
}

function fmt(n:number|null|undefined){ return (n??0).toLocaleString() }
function fmtM(n:number|null|undefined){ return '$'+((n??0)>=1000000?((n??0)/1e6).toFixed(0)+'M':((n??0)/1000).toFixed(0)+'K') }
function fmtD(n:number){ return '$'+n.toLocaleString() }

export default function ArenaView({teamId,teamColor,arenaName,arenaCapacity,cash=25000000}:{
  teamId:string, teamColor:string, arenaName:string, arenaCapacity:number, cash?:number
}) {
  const {profile} = useAuth()
  const isGM = (profile as any)?.team_id===teamId || profile?.role==='commissioner'

  const [sections,setSections]       = useState<Record<string,Section>>({})
  const [config,setConfig]           = useState<Config|null>(null)
  const [concessions,setConcessions] = useState<Concessions|null>(null)
  const [selected,setSelected]       = useState<string|null>(null)
  const [hoveredConcession,setHoveredConcession] = useState<string|null>(null)
  const [loading,setLoading]         = useState(true)
  const [building,setBuilding]       = useState(false)
  const [saving,setSaving]           = useState(false)
  const [msg,setMsg]                 = useState('')
  const [editTickets,setEditTickets] = useState(false)
  const [ticketDraft,setTicketDraft] = useState<Partial<Config>>({})
  const [tab,setTab]                 = useState<'sections'|'concessions'|'tickets'>('sections')

  useEffect(()=>{
    Promise.all([
      supabase.from('arena_sections').select('*').eq('team_id',teamId),
      supabase.from('franchise_config').select('*').eq('team_id',teamId).single(),
      supabase.from('arena_concessions').select('*').eq('team_id',teamId).single(),
    ]).then(([{data:s},{data:c},{data:co}])=>{
      const map:Record<string,Section>={}
      for(const sec of (s||[])) map[sec.section]=sec
      setSections(map)
      setConfig(c)
      setTicketDraft(c||{})
      setConcessions(co)
      setLoading(false)
    })
  },[teamId])

  const totalCurrent = BUILT_SECTIONS.reduce((s,k)=>s+(sections[k]?.capacity||0),0)
  const attendancePct = 0.65
  const attendance = Math.round(totalCurrent * attendancePct)

  const ticketRevenue = config ? (
    Math.round(totalCurrent*0.50)*attendancePct*config.ticket_lower +
    Math.round(totalCurrent*0.35)*attendancePct*config.ticket_upper +
    Math.round(totalCurrent*0.02)*attendancePct*config.ticket_courtside
  ) : 0

  const concessionRevPerCap = concessions ? CONCESSIONS.reduce((t,c)=>{
    const qty = (concessions as any)[c.key] || 0
    return t + (qty * ((c as any).per_capita || 0))
  }, 0) : 0
  const concessionRev = attendance * concessionRevPerCap
  const fixedRev = concessions ? CONCESSIONS.reduce((t,c)=>{
    const qty = (concessions as any)[c.key] || 0
    return t + (qty * ((c as any).fixed_per_game || 0))
  }, 0) : 0
  const totalRevPerGame = Math.round(ticketRevenue + concessionRev + fixedRev)

  const sel = selected ? sections[selected] : null
  const isBuilt = selected ? BUILT_SECTIONS.includes(selected) : false
  const isUnderConst = sel?.under_construction || false
  const cost = isBuilt ? UPGRADE_COST : BUILD_COST
  const weeks = isBuilt ? UPGRADE_WEEKS : BUILD_WEEKS
  const expansionSeats = sel && isBuilt ? Math.round((sections[selected!]?.capacity||0)*EXPANSION_RATE) : Math.round(3000*EXPANSION_RATE)
  const canAfford = cash >= cost

  // Active zones to highlight
  const activeZones = hoveredConcession
    ? CONCESSIONS.find(c=>c.key===hoveredConcession)?.zones || []
    : []

  const secFill=(sec:string)=>{
    if(!sections[sec])return'#e8e2d6'
    if(sections[sec].under_construction)return'#378ADD'
    if(BUILT_SECTIONS.includes(sec))return'#8B6914'
    return'none'
  }
  const secStroke=(sec:string)=>selected===sec?teamColor:BUILT_SECTIONS.includes(sec)?'#6b5010':'#b0a898'
  const secOp=(sec:string)=>sections[sec]?.under_construction?0.7:1

  const zoneHighlight=(zone:string)=>activeZones.includes(zone)?ZONE_COLORS[zone]||'#f59e0b':null

  const handleBuildUpgrade=async()=>{
    if(!selected||!isGM)return
    setBuilding(true); setMsg('')
    const ends=new Date(); ends.setDate(ends.getDate()+weeks*7)
    await supabase.from('arena_sections').update({under_construction:true,construction_ends_at:ends.toISOString().split('T')[0]}).eq('id',sections[selected].id)
    setSections(p=>({...p,[selected]:{...p[selected],under_construction:true,construction_ends_at:ends.toISOString().split('T')[0]}}))
    setMsg(isBuilt?'Upgrade started!':'Construction started!')
    setBuilding(false)
  }

  const handleSaveTickets=async()=>{
    if(!config||!isGM)return
    setSaving(true)
    await supabase.from('franchise_config').update(ticketDraft).eq('id',config.id)
    setConfig(p=>p?{...p,...ticketDraft}:p)
    setEditTickets(false); setSaving(false); setMsg('Ticket prices updated!')
  }

  const handleBuildConcession=async(key:string, unitCost:number, unitMonthly:number)=>{
    if(!concessions||!isGM||cash<unitCost)return
    const current = (concessions as any)[key] || 0
    const maxQ = CONCESSIONS.find(c=>c.key===key)?.max || 1
    if(current>=maxQ)return
    const newMonthly = (concessions.monthly_maintenance||0) + unitMonthly
    await supabase.from('arena_concessions').update({[key]:current+1, monthly_maintenance:newMonthly}).eq('id',concessions.id)
    setConcessions(p=>p?{...p,[key]:current+1, monthly_maintenance:newMonthly}:p)
    setMsg('Built successfully!')
  }

  if(loading)return <div className="text-center py-8" style={{color:'#8a8279'}}>Loading arena...</div>

  const categories = ['Concessions','Premium','Entertainment']

  return (
    <div>
      {msg && <div style={{marginBottom:12,padding:'8px 12px',background:'#dcfce7',color:'#15803d',borderRadius:8,fontSize:12,fontWeight:600,border:'1px solid #bbf7d0'}}>✓ {msg}</div>}

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:'#1a1512',margin:0}}>{arenaName}</h3>
          <p style={{fontSize:11,color:'#8a8279',margin:0}}>
            Capacity: <strong>{fmt(totalCurrent)}</strong> · Est. attendance: <strong>{fmt(attendance)}</strong> ({Math.round(attendancePct*100)}%)
          </p>
        </div>
        {isGM && <div style={{fontSize:11,padding:'4px 10px',borderRadius:6,background:'#dcfce7',color:'#15803d',fontWeight:600}}>Funds: {fmtM(cash)}</div>}
      </div>

      {/* Tab nav */}
      <div style={{display:'flex',gap:6,marginBottom:14,borderBottom:'2px solid #e2dcd5',paddingBottom:0}}>
        {[{k:'sections',l:'🏟️ Sections'},{k:'concessions',l:'🍔 Concessions'},{k:'tickets',l:'🎟️ Tickets'}].map((t:any)=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{padding:'6px 14px',fontSize:12,fontWeight:600,border:'none',borderBottom:`3px solid ${tab===t.k?teamColor:'transparent'}`,
                    background:'transparent',color:tab===t.k?teamColor:'#8a8279',cursor:'pointer',marginBottom:-2}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── SECTIONS TAB ── */}
      {tab==='sections' && (
        <>
          <svg viewBox="0 0 700 480" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',marginBottom:0}}>
            <rect x="2" y="2" width="696" height="476" rx="16" fill="#ccc5ba" stroke="#aaa098" strokeWidth="1"/>
            {['N1A','N2A','N3A'].map((sec,i)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec===selected?null:sec)}>
                <rect x={120+i*130} y="8" width="115" height="50" rx="8" fill={sections[sec]?.under_construction?'#378ADD':'url(#hatch)'} fillOpacity={sections[sec]?.capacity>0?0.9:0.4} stroke={selected===sec?teamColor:'#b0a898'} strokeDasharray={selected===sec?'0':'6,3'} strokeWidth={selected===sec?2:0.8}/>
                <text x={120+i*130+57} y="29" textAnchor="middle" fontSize="11" fontWeight="500" fill="#6b5f4e" fontFamily="sans-serif">{sec}</text>
                <text x={120+i*130+57} y="47" textAnchor="middle" fontSize="9" fill="#9a8a78" fontFamily="sans-serif">{sections[sec]?.capacity>0?fmt(sections[sec].capacity):'(future)'}</text>
              </g>
            ))}
            <rect x="100" y="62" width="500" height="16" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="350" y="74" textAnchor="middle" fontSize="9" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif">NORTH STAND</text>
            {[['N1',100,82,155],['N2',272,82,156],['N3',445,82,155]].map(([sec,x,y,w]:any)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec===selected?null:sec)}>
                <rect x={x} y={y} width={w} height="52" rx="6" fill={secFill(sec)} fillOpacity={secOp(sec)} stroke={secStroke(sec)} strokeWidth={selected===sec?2:1}/>
                <text x={x+w/2} y={y+18} textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">{sec}</text>
                <text x={x+w/2} y={y+36} textAnchor="middle" fontSize="9" fill="#e8c96a" fontFamily="sans-serif">{sections[sec]?.under_construction?'building':fmt(sections[sec]?.capacity||0)}</text>
              </g>
            ))}
            <rect x="6" y="148" width="16" height="184" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="14" y="253" textAnchor="middle" fontSize="8" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif" transform="rotate(-90,14,253)">WEST STAND</text>
            <g style={{cursor:'pointer'}} onClick={()=>setSelected('W1'===selected?null:'W1')}>
              <rect x="24" y="148" width="68" height="184" rx="6" fill={secFill('W1')} fillOpacity={secOp('W1')} stroke={secStroke('W1')} strokeWidth={selected==='W1'?2:1}/>
              <text x="58" y="234" textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">W1</text>
              <text x="58" y="250" textAnchor="middle" fontSize="8" fill="#e8c96a" fontFamily="sans-serif">{sections['W1']?.under_construction?'building':fmt(sections['W1']?.capacity||0)}</text>
            </g>
            {[148,210,270].map((y,i)=>(
              <g key={i} style={{cursor:'pointer'}} onClick={()=>setSelected((i===0?'W_upper':'W_mid')===selected?null:(i===0?'W_upper':'W_mid'))}>
                <rect x="4" y={y} width="18" height="60" rx="4" fill="url(#hatch)" fillOpacity="0.4" stroke="#b0a898" strokeDasharray="5,3" strokeWidth="0.8"/>
              </g>
            ))}
            <rect x="678" y="148" width="16" height="184" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="686" y="253" textAnchor="middle" fontSize="8" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif" transform="rotate(90,686,253)">EAST STAND</text>
            <g style={{cursor:'pointer'}} onClick={()=>setSelected('E1'===selected?null:'E1')}>
              <rect x="608" y="148" width="68" height="184" rx="6" fill={secFill('E1')} fillOpacity={secOp('E1')} stroke={secStroke('E1')} strokeWidth={selected==='E1'?2:1}/>
              <text x="642" y="234" textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">E1</text>
              <text x="642" y="250" textAnchor="middle" fontSize="8" fill="#e8c96a" fontFamily="sans-serif">{sections['E1']?.under_construction?'building':fmt(sections['E1']?.capacity||0)}</text>
            </g>
            {[148,210,270].map((y,i)=>(
              <g key={i} style={{cursor:'pointer'}} onClick={()=>setSelected((i===0?'E_upper':'E_mid')===selected?null:(i===0?'E_upper':'E_mid'))}>
                <rect x="678" y={y} width="18" height="60" rx="4" fill="url(#hatch)" fillOpacity="0.4" stroke="#b0a898" strokeDasharray="5,3" strokeWidth="0.8"/>
              </g>
            ))}
            {[['S1',100,346,155],['S2',272,346,156],['S3',445,346,155]].map(([sec,x,y,w]:any)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec===selected?null:sec)}>
                <rect x={x} y={y} width={w} height="52" rx="6" fill={secFill(sec)} fillOpacity={secOp(sec)} stroke={secStroke(sec)} strokeWidth={selected===sec?2:1}/>
                <text x={x+w/2} y={y+18} textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">{sec}</text>
                <text x={x+w/2} y={y+36} textAnchor="middle" fontSize="9" fill="#e8c96a" fontFamily="sans-serif">{sections[sec]?.under_construction?'building':fmt(sections[sec]?.capacity||0)}</text>
              </g>
            ))}
            <rect x="100" y="400" width="500" height="16" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="350" y="412" textAnchor="middle" fontSize="9" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif">SOUTH STAND</text>
            {['S1A','S2A','S3A'].map((sec,i)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec===selected?null:sec)}>
                <rect x={120+i*130} y="420" width="115" height="50" rx="8" fill={sections[sec]?.capacity>0?'#d4a055':'url(#hatch)'} fillOpacity={sections[sec]?.capacity>0?0.9:0.4} stroke={selected===sec?teamColor:'#b0a898'} strokeDasharray={selected===sec?'0':'6,3'} strokeWidth={selected===sec?2:0.8}/>
                <text x={120+i*130+57} y="441" textAnchor="middle" fontSize="11" fontWeight="500" fill="#6b5f4e" fontFamily="sans-serif">{sec}</text>
                <text x={120+i*130+57} y="459" textAnchor="middle" fontSize="9" fill="#9a8a78" fontFamily="sans-serif">{sections[sec]?.capacity>0?fmt(sections[sec].capacity):'(future)'}</text>
              </g>
            ))}
            <rect x="100" y="138" width="500" height="204" rx="4" fill="#c8964a" stroke="#9a7030" strokeWidth="2"/>
            <rect x="112" y="148" width="476" height="184" rx="2" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <line x1="350" y1="148" x2="350" y2="332" stroke="#fff" strokeWidth="1.5"/>
            <circle cx="350" cy="240" r="30" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <circle cx="350" cy="240" r="3" fill="#fff"/>
            <line x1="112" y1="168" x2="150" y2="168" stroke="#fff" strokeWidth="1.5"/>
            <line x1="112" y1="312" x2="150" y2="312" stroke="#fff" strokeWidth="1.5"/>
            <path d="M150,168 Q214,240 150,312" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <rect x="112" y="208" width="70" height="64" fill="rgba(0,0,0,0.1)" stroke="#fff" strokeWidth="1.5"/>
            <path d="M182,208 A32,32 0 0 1 182,272" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <path d="M182,208 A32,32 0 0 0 182,272" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="5,3"/>
            <line x1="118" y1="224" x2="118" y2="256" stroke="#fff" strokeWidth="2.5"/>
            <circle cx="130" cy="240" r="7" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <line x1="588" y1="168" x2="550" y2="168" stroke="#fff" strokeWidth="1.5"/>
            <line x1="588" y1="312" x2="550" y2="312" stroke="#fff" strokeWidth="1.5"/>
            <path d="M550,168 Q486,240 550,312" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <rect x="518" y="208" width="70" height="64" fill="rgba(0,0,0,0.1)" stroke="#fff" strokeWidth="1.5"/>
            <path d="M518,208 A32,32 0 0 0 518,272" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <path d="M518,208 A32,32 0 0 1 518,272" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="5,3"/>
            <line x1="582" y1="224" x2="582" y2="256" stroke="#fff" strokeWidth="2.5"/>
            <circle cx="570" cy="240" r="7" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <defs>
              <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#b0a898" strokeWidth="0.8" opacity="0.6"/>
              </pattern>
            </defs>
          </svg>

          {/* Section popover */}
          {selected && (
            <div style={{margin:'8px 0 16px',padding:'10px 14px',background:'#faf8f5',border:`1px solid ${teamColor}44`,borderLeft:`3px solid ${teamColor}`,borderRadius:10,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <div>
                <div style={{display:'inline-block',fontSize:10,padding:'2px 6px',borderRadius:4,marginBottom:2,
                  background:isUnderConst?'#dbeafe':isBuilt?'#dcfce7':'#fef3c7',
                  color:isUnderConst?'#1d4ed8':isBuilt?'#15803d':'#b45309'}}>
                  {isUnderConst?'Under construction':isBuilt?'Built':'Not built'}
                </div>
                <div style={{fontSize:15,fontWeight:700,color:'#1a1512'}}>{selected}</div>
              </div>
              {[
                isBuilt&&['Seats',fmt(sel?.capacity||0)],
                isBuilt&&['Upgrade adds','+'+fmt(expansionSeats)+' seats'],
                !isBuilt&&['New seats','+'+fmt(expansionSeats)],
                isGM&&['Cost',fmtM(cost)],
                isGM&&['Offline',weeks+' weeks'],
              ].filter(Boolean).map((r:any)=>(
                <div key={r[0]} style={{textAlign:'center',padding:'5px 10px',background:'#f0ece5',borderRadius:8}}>
                  <div style={{fontSize:9,color:'#8a8279'}}>{r[0]}</div>
                  <div style={{fontSize:13,fontWeight:700,color:'#1a1512'}}>{r[1]}</div>
                </div>
              ))}
              <div style={{flex:1}}/>
              {isGM && !isUnderConst && (
                <button onClick={handleBuildUpgrade} disabled={!canAfford||building}
                  style={{padding:'7px 14px',fontSize:12,fontWeight:600,border:'none',borderRadius:8,
                    background:canAfford?'#b45309':'#e2dcd5',color:canAfford?'#fef3c7':'#8a8279',cursor:canAfford?'pointer':'not-allowed'}}>
                  {building?'...':(isBuilt?'Upgrade — ':'Build — ')+fmtM(cost)}
                </button>
              )}
              {!canAfford&&isGM&&<span style={{fontSize:10,color:'#dc2626'}}>Insufficient funds</span>}
              <button onClick={()=>setSelected(null)} style={{padding:'5px 9px',fontSize:11,borderRadius:6,border:'1px solid #d4cdc5',background:'#f0ece5',color:'#5c554e',cursor:'pointer'}}>✕</button>
            </div>
          )}
        </>
      )}

      {/* ── CONCESSIONS TAB ── */}
      {tab==='concessions' && (
        <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>

          {/* Blueprint SVG */}
          <div style={{flex:1,minWidth:0}}>
            <svg viewBox="0 0 700 480" xmlns="http://www.w3.org/2000/svg" style={{width:'100%'}}>
              {/* Arena shell */}
              <rect x="2" y="2" width="696" height="476" rx="16" fill="#1a1a2e" stroke="#2d2d4e" strokeWidth="1"/>

              {/* Zone: North concourse */}
              <rect id="zone-north-concourse" x="100" y="62" width="500" height="76" rx="4"
                fill={zoneHighlight('zone-north-concourse')||'#2d2d4e'} opacity={activeZones.includes('zone-north-concourse')?0.9:0.4}/>
              <text x="350" y="104" textAnchor="middle" fontSize="10" fill={activeZones.includes('zone-north-concourse')?'#fff':'#6b6b8a'} fontFamily="sans-serif">NORTH CONCOURSE</text>

              {/* Zone: South concourse */}
              <rect id="zone-south-concourse" x="100" y="342" width="500" height="76" rx="4"
                fill={zoneHighlight('zone-south-concourse')||'#2d2d4e'} opacity={activeZones.includes('zone-south-concourse')?0.9:0.4}/>
              <text x="350" y="384" textAnchor="middle" fontSize="10" fill={activeZones.includes('zone-south-concourse')?'#fff':'#6b6b8a'} fontFamily="sans-serif">SOUTH CONCOURSE</text>

              {/* Zone: West concourse */}
              <rect id="zone-west-concourse" x="4" y="140" width="94" height="200" rx="4"
                fill={zoneHighlight('zone-west-concourse')||'#2d2d4e'} opacity={activeZones.includes('zone-west-concourse')?0.9:0.4}/>
              <text x="51" y="244" textAnchor="middle" fontSize="9" fill={activeZones.includes('zone-west-concourse')?'#fff':'#6b6b8a'} fontFamily="sans-serif" transform="rotate(-90,51,244)">WEST CONCOURSE</text>

              {/* Zone: East concourse */}
              <rect id="zone-east-concourse" x="602" y="140" width="94" height="200" rx="4"
                fill={zoneHighlight('zone-east-concourse')||'#2d2d4e'} opacity={activeZones.includes('zone-east-concourse')?0.9:0.4}/>
              <text x="649" y="244" textAnchor="middle" fontSize="9" fill={activeZones.includes('zone-east-concourse')?'#fff':'#6b6b8a'} fontFamily="sans-serif" transform="rotate(90,649,244)">EAST CONCOURSE</text>

              {/* Zone: Upper North */}
              <rect id="zone-upper-north" x="120" y="8" width="460" height="52" rx="6"
                fill={zoneHighlight('zone-upper-north')||'#1e1e3a'} opacity={activeZones.includes('zone-upper-north')?0.9:0.5}
                strokeDasharray="6,3" stroke={activeZones.includes('zone-upper-north')?ZONE_COLORS['zone-upper-north']:'#3d3d6b'} strokeWidth="1"/>
              <text x="350" y="39" textAnchor="middle" fontSize="9" fill={activeZones.includes('zone-upper-north')?'#fff':'#5a5a7a'} fontFamily="sans-serif">UPPER NORTH — Suites / VIP Restaurant</text>

              {/* Zone: Upper South */}
              <rect id="zone-upper-south" x="120" y="420" width="460" height="52" rx="6"
                fill={zoneHighlight('zone-upper-south')||'#1e1e3a'} opacity={activeZones.includes('zone-upper-south')?0.9:0.5}
                strokeDasharray="6,3" stroke={activeZones.includes('zone-upper-south')?ZONE_COLORS['zone-upper-south']:'#3d3d6b'} strokeWidth="1"/>
              <text x="350" y="451" textAnchor="middle" fontSize="9" fill={activeZones.includes('zone-upper-south')?'#fff':'#5a5a7a'} fontFamily="sans-serif">UPPER SOUTH — Suites</text>

              {/* Zone: Main entrance */}
              <rect id="zone-main-entrance" x="250" y="418" width="200" height="54" rx="6"
                fill={zoneHighlight('zone-main-entrance')||'#251a0a'} opacity={activeZones.includes('zone-main-entrance')?0.9:0.6}
                stroke={activeZones.includes('zone-main-entrance')?ZONE_COLORS['zone-main-entrance']:'#4a3010'} strokeWidth="1"/>
              <text x="350" y="450" textAnchor="middle" fontSize="9" fill={activeZones.includes('zone-main-entrance')?'#fff':'#7a5a30'} fontFamily="sans-serif">MAIN ENTRANCE</text>

              {/* Zone: Lower West */}
              <rect id="zone-lower-west" x="24" y="170" width="74" height="140" rx="4"
                fill={zoneHighlight('zone-lower-west')||'#0a2a1a'} opacity={activeZones.includes('zone-lower-west')?0.9:0.5}
                stroke={activeZones.includes('zone-lower-west')?ZONE_COLORS['zone-lower-west']:'#1a4a2a'} strokeWidth="1"/>
              <text x="61" y="244" textAnchor="middle" fontSize="8" fill={activeZones.includes('zone-lower-west')?'#fff':'#3a7a4a'} fontFamily="sans-serif" transform="rotate(-90,61,244)">CLUB SEATS</text>

              {/* Zone: Lower East */}
              <rect id="zone-lower-east" x="602" y="170" width="74" height="140" rx="4"
                fill={zoneHighlight('zone-lower-east')||'#0a2a1a'} opacity={activeZones.includes('zone-lower-east')?0.9:0.5}
                stroke={activeZones.includes('zone-lower-east')?ZONE_COLORS['zone-lower-east']:'#1a4a2a'} strokeWidth="1"/>
              <text x="639" y="244" textAnchor="middle" fontSize="8" fill={activeZones.includes('zone-lower-east')?'#fff':'#3a7a4a'} fontFamily="sans-serif" transform="rotate(90,639,244)">CLUB SEATS</text>

              {/* Zone: Courtside East */}
              <rect id="zone-courtside-east" x="540" y="180" width="60" height="120" rx="4"
                fill={zoneHighlight('zone-courtside-east')||'#2a0a0a'} opacity={activeZones.includes('zone-courtside-east')?0.9:0.5}
                stroke={activeZones.includes('zone-courtside-east')?ZONE_COLORS['zone-courtside-east']:'#4a1a1a'} strokeWidth="1"/>
              <text x="570" y="244" textAnchor="middle" fontSize="8" fill={activeZones.includes('zone-courtside-east')?'#fff':'#7a3a3a'} fontFamily="sans-serif" transform="rotate(90,570,244)">COURTSIDE</text>

              {/* Zone: Ceiling */}
              <ellipse id="zone-ceiling" cx="350" cy="240" rx="60" ry="40"
                fill={zoneHighlight('zone-ceiling')||'#1a1a3a'} opacity={activeZones.includes('zone-ceiling')?0.9:0.5}
                stroke={activeZones.includes('zone-ceiling')?ZONE_COLORS['zone-ceiling']:'#3a3a6a'} strokeWidth="1" strokeDasharray="4,3"/>
              <text x="350" y="244" textAnchor="middle" fontSize="8" fill={activeZones.includes('zone-ceiling')?'#fff':'#5a5a9a'} fontFamily="sans-serif">JUMBOTRON</text>

              {/* Zone: Court floor */}
              <rect id="zone-court-floor" x="140" y="220" width="80" height="40" rx="4"
                fill={zoneHighlight('zone-court-floor')||'#0a2a2a'} opacity={activeZones.includes('zone-court-floor')?0.9:0.5}
                stroke={activeZones.includes('zone-court-floor')?ZONE_COLORS['zone-court-floor']:'#1a4a4a'} strokeWidth="1"/>
              <text x="180" y="244" textAnchor="middle" fontSize="7" fill={activeZones.includes('zone-court-floor')?'#fff':'#3a7a7a'} fontFamily="sans-serif">MASCOT TUNNEL</text>

              {/* Court outline */}
              <rect x="100" y="138" width="500" height="204" rx="4" fill="none" stroke="#c8964a" strokeWidth="1.5" opacity="0.4"/>
              <rect x="112" y="148" width="476" height="184" rx="2" fill="none" stroke="#c8964a" strokeWidth="1" opacity="0.3"/>
              <text x="350" y="244" textAnchor="middle" fontSize="10" fill="#c8964a" fontFamily="sans-serif" opacity="0.4">COURT</text>
            </svg>

            {/* Zone legend */}
            {hoveredConcession && (
              <div style={{marginTop:6,padding:'6px 10px',background:'#1a1a2e',borderRadius:8,fontSize:11,color:'#fff',display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:10,height:10,borderRadius:2,background:ZONE_COLORS[activeZones[0]]||teamColor}}/>
                <span>{CONCESSIONS.find(c=>c.key===hoveredConcession)?.zoneLabel}</span>
              </div>
            )}
          </div>

          {/* Concessions list */}
          <div style={{width:260,flexShrink:0}}>
            {isGM && (
              <div style={{marginBottom:10,padding:'6px 10px',background:'#f0ece5',borderRadius:8,fontSize:11,color:'#5c554e'}}>
                💰 Revenue/game: <strong style={{color:'#15803d'}}>{fmtD(totalRevPerGame)}</strong>
              </div>
            )}
            {categories.map(cat=>(
              <div key={cat} style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:6}}>{cat}</div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {CONCESSIONS.filter(c=>c.category===cat).map(c=>{
                    const qty = concessions ? (concessions as any)[c.key] || 0 : 0
                    return (
                      <div key={c.key}
                        onMouseEnter={()=>setHoveredConcession(c.key)}
                        onMouseLeave={()=>setHoveredConcession(null)}
                        style={{
                          background:hoveredConcession===c.key?'#f0ece5':'#faf8f5',
                          border:`1px solid ${hoveredConcession===c.key?teamColor:'#d4cdc5'}`,
                          borderRadius:8,padding:'8px 10px',cursor:'pointer',transition:'all 0.1s',
                        }}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                          <span style={{fontSize:14}}>{c.icon}</span>
                          <span style={{fontSize:11,fontWeight:600,color:'#1a1512',flex:1}}>{c.label}</span>
                          <span style={{fontSize:10,fontWeight:600,color:qty>0?'#15803d':'#8a8279'}}>{qty}/{c.max}</span>
                        </div>
                        {/* Tooltip on hover */}
                        {hoveredConcession===c.key && isGM && qty < c.max && (
                          <div style={{marginBottom:6,padding:'5px 8px',borderRadius:6,background:'#1a1512',color:'#fef3c7',fontSize:10,lineHeight:1.5}}>
                            <strong>+1 {c.label}</strong> adds per game:<br/>
                            {(c as any).per_capita
                              ? `+$${(c as any).per_capita} × attendance (~${fmtD(Math.round((c as any).per_capita * attendance))})`
                              : `+${fmtD((c as any).fixed_per_game||0)} fixed`
                            }<br/>
                            <span style={{color:'#e8c96a'}}>📍 {c.zoneLabel}</span>
                          </div>
                        )}
                        {/* Slots visual — nowrap */}
                        <div style={{display:'flex',gap:3,flexWrap:'nowrap',marginBottom:isGM?4:0}}>
                          {Array.from({length:c.max}).map((_,i)=>(
                            <div key={i} style={{
                              flex:1,minWidth:0,height:6,borderRadius:3,
                              background: i<qty ? teamColor : '#e2dcd5',
                              border:`1px solid ${i<qty?teamColor:'#d4cdc5'}`,
                            }}/>
                          ))}
                        </div>
                        {isGM && qty < c.max && (
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                            <div style={{fontSize:9,color:'#8a8279'}}>
                              <span title="One-time build cost" style={{cursor:'help',textDecoration:'underline dotted'}}>Build: {fmtM(c.cost)}</span>
                              {' · '}
                              <span title="Monthly maintenance" style={{cursor:'help',textDecoration:'underline dotted'}}>Maint: {fmtM(c.monthly)}/mo</span>
                            </div>
                            <button onClick={()=>handleBuildConcession(c.key,c.cost,c.monthly)}
                              disabled={cash<c.cost}
                              style={{padding:'2px 8px',fontSize:10,fontWeight:600,borderRadius:5,border:'none',
                                background:cash>=c.cost?teamColor:'#e2dcd5',color:cash>=c.cost?'#fff':'#8a8279',cursor:cash>=c.cost?'pointer':'not-allowed'}}>
                              +1
                            </button>
                          </div>
                        )}
                        {isGM && qty >= c.max && (
                          <div style={{fontSize:9,color:'#15803d',fontWeight:600}}>✓ Maximum reached ({c.max}/{c.max})</div>
                        )}
                        {!isGM && qty > 0 && (
                          <div style={{fontSize:9,color:'#15803d'}}>{qty}/{c.max} built</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TICKETS TAB ── */}
      {tab==='tickets' && (
        isGM ? (
          <div style={{maxWidth:400}}>
            {isGM && (
              <div style={{marginBottom:12,padding:'8px 12px',background:'#f0ece5',borderRadius:8,fontSize:11,color:'#5c554e',display:'flex',justifyContent:'space-between'}}>
                <span>Est. ticket revenue/game</span>
                <strong style={{color:'#15803d'}}>{fmtD(Math.round(ticketRevenue))}</strong>
              </div>
            )}
            <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279'}}>Ticket Prices</div>
                {!editTickets && <button onClick={()=>setEditTickets(true)} style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid #d4cdc5',background:'#f0ece5',color:'#5c554e',cursor:'pointer'}}>Edit</button>}
              </div>
              {[
                {key:'ticket_lower',    label:'Lower Bowl',   icon:'🟡', pct:'~50% of seats', note:'Main seating level'},
                {key:'ticket_upper',    label:'Upper Bowl',   icon:'🔵', pct:'~35% of seats', note:'Upper deck'},
                {key:'ticket_courtside',label:'Courtside',    icon:'⭐', pct:'~2% of seats',  note:'Premium floor seats'},
                {key:'ticket_suite',    label:'Suite (each)', icon:'🏢', pct:'Per suite/game', note:'Full suite rental'},
              ].map(t=>(
                <div key={t.key} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #e2dcd5'}}>
                  <span style={{fontSize:16}}>{t.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#1a1512'}}>{t.label}</div>
                    <div style={{fontSize:10,color:'#8a8279'}}>{t.pct} · {t.note}</div>
                  </div>
                  {editTickets ? (
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontSize:11,color:'#8a8279'}}>$</span>
                      <input type="number" value={(ticketDraft as any)[t.key]||0}
                        onChange={e=>setTicketDraft(p=>({...p,[t.key]:Number(e.target.value)}))}
                        style={{width:64,padding:'3px 6px',fontSize:12,borderRadius:4,border:'1px solid #d4cdc5',textAlign:'right'}}/>
                    </div>
                  ) : (
                    <span style={{fontSize:14,fontWeight:700,color:'#1a1512'}}>${(config as any)?.[t.key]||0}</span>
                  )}
                </div>
              ))}
              {editTickets && (
                <div style={{display:'flex',gap:6,marginTop:12}}>
                  <button onClick={handleSaveTickets} disabled={saving}
                    style={{flex:1,padding:'7px',fontSize:12,fontWeight:600,border:'none',borderRadius:8,background:teamColor,color:'#fff',cursor:'pointer'}}>
                    {saving?'Saving...':'Save prices'}
                  </button>
                  <button onClick={()=>setEditTickets(false)}
                    style={{padding:'7px 12px',fontSize:12,borderRadius:8,border:'1px solid #d4cdc5',background:'#f0ece5',color:'#5c554e',cursor:'pointer'}}>
                    Cancel
                  </button>
                </div>
              )}
              <div style={{marginTop:10,fontSize:10,color:'#8a8279',lineHeight:1.5}}>
                ⚠️ Higher prices reduce attendance. Monitor the balance between revenue and fan turnout.
              </div>
            </div>
          </div>
        ) : (
          <div style={{padding:32,textAlign:'center',color:'#b0a89e',fontSize:13}}>
            🔒 Ticket pricing is private to the franchise GM.
          </div>
        )
      )}
    </div>
  )
}

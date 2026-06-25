'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Section = { id:string, section:string, level:number, capacity:number, under_construction:boolean, construction_ends_at:string|null }
type Config = { id:string, ticket_lower:number, ticket_upper:number, ticket_courtside:number, ticket_suite:number }
type Concessions = {
  id:string, has_food_stall_basic:boolean, has_food_stall_premium:boolean, has_bar:boolean,
  has_restaurant_vip:boolean, has_franchise_store:boolean, has_vending_machines:boolean,
  has_corporate_suites:boolean, has_club_seats:boolean, has_courtside_lounge:boolean,
  has_jumbotron:boolean, has_fan_zone:boolean, has_mascot:boolean, monthly_maintenance:number
}

const BUILT_SECTIONS = ['N1','N2','N3','S1','S2','S3','W1','E1']
const FUTURE_SECTIONS = ['N1A','N2A','N3A','S1A','S2A','S3A','W_upper','W_mid','E_upper','E_mid']
const UPGRADE_COST = 12000000
const BUILD_COST   = 8000000
const UPGRADE_WEEKS = 8
const BUILD_WEEKS   = 12
const EXPANSION_RATE = 0.6

const CONCESSION_CONFIG = [
  {key:'has_food_stall_basic',    label:'Food Stall (Basic)',    icon:'🌭', cost:500000,   monthly:5000,   per_capita:3,  desc:'Basic concession stand'},
  {key:'has_food_stall_premium',  label:'Food Stall (Premium)',  icon:'🍔', cost:1500000,  monthly:12000,  per_capita:8,  desc:'Premium food options'},
  {key:'has_bar',                 label:'Bar',                   icon:'🍺', cost:800000,   monthly:8000,   per_capita:5,  desc:'Full bar service'},
  {key:'has_restaurant_vip',      label:'VIP Restaurant',        icon:'🍽️', cost:3000000,  monthly:20000,  per_capita:15, desc:'Fine dining experience'},
  {key:'has_franchise_store',     label:'Franchise Store',       icon:'👕', cost:2000000,  monthly:10000,  per_capita:10, desc:'Merchandise & apparel'},
  {key:'has_vending_machines',    label:'Vending Machines',      icon:'🎰', cost:200000,   monthly:1000,   per_capita:1,  desc:'10 vending machines'},
  {key:'has_corporate_suites',    label:'Corporate Suites',      icon:'🏢', cost:5000000,  monthly:30000,  fixed_per_game:80000, desc:'10 premium suites'},
  {key:'has_club_seats',          label:'Club Seats',            icon:'💺', cost:3000000,  monthly:15000,  fixed_per_game:40000, desc:'100 premium club seats'},
  {key:'has_courtside_lounge',    label:'Courtside Lounge',      icon:'⭐', cost:8000000,  monthly:50000,  fixed_per_game:120000,desc:'VIP courtside experience'},
  {key:'has_jumbotron',           label:'LED Jumbotron',         icon:'📺', cost:4000000,  monthly:20000,  fixed_per_game:15000, desc:'Advertising revenue'},
  {key:'has_fan_zone',            label:'Fan Experience Zone',   icon:'🎉', cost:2500000,  monthly:12000,  per_capita:7,  desc:'Interactive fan area'},
  {key:'has_mascot',              label:'Mascot & Events',       icon:'🎭', cost:500000,   monthly:3000,   fixed_per_game:5000,  desc:'Event entertainment'},
]

function fmt(n:number|null|undefined){ return (n??0).toLocaleString() }
function fmtM(n:number|null|undefined){ return '$'+((n??0)>=1000000?((n??0)/1e6).toFixed(0)+'M':((n??0)/1000).toFixed(0)+'K') }
function fmtD(n:number){ return '$'+n.toLocaleString() }

export default function ArenaView({teamId,teamColor,arenaName,arenaCapacity,cash=25000000}:{
  teamId:string, teamColor:string, arenaName:string, arenaCapacity:number, cash?:number
}) {
  const {profile} = useAuth()
  const isGM = (profile as any)?.team_id===teamId || profile?.role==='commissioner'

  const [sections,setSections]     = useState<Record<string,Section>>({})
  const [config,setConfig]         = useState<Config|null>(null)
  const [concessions,setConcessions] = useState<Concessions|null>(null)
  const [selected,setSelected]     = useState<string|null>(null)
  const [loading,setLoading]       = useState(true)
  const [building,setBuilding]     = useState(false)
  const [saving,setSaving]         = useState(false)
  const [msg,setMsg]               = useState('')
  const [editTickets,setEditTickets] = useState(false)
  const [ticketDraft,setTicketDraft] = useState<Partial<Config>>({})

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

  // Attendance estimate (base 65%)
  const attendancePct = 0.65
  const attendance = Math.round(totalCurrent * attendancePct)

  // Revenue estimate per home game
  const lowerSeats   = Math.round(totalCurrent * 0.50)
  const upperSeats   = Math.round(totalCurrent * 0.35)
  const courtsideSeats = Math.round(totalCurrent * 0.02)

  const ticketRevenue = config ? (
    lowerSeats * attendancePct * config.ticket_lower +
    upperSeats * attendancePct * config.ticket_upper +
    courtsideSeats * attendancePct * config.ticket_courtside
  ) : 0

  const concessionRevPerCap = concessions ? CONCESSION_CONFIG.reduce((t,c)=>{
    if((concessions as any)[c.key] && c.per_capita) return t+c.per_capita
    return t
  },0) : 0
  const concessionRev = attendance * concessionRevPerCap

  const fixedRev = concessions ? CONCESSION_CONFIG.reduce((t,c)=>{
    if((concessions as any)[c.key] && (c as any).fixed_per_game) return t+(c as any).fixed_per_game
    return t
  },0) : 0

  const totalRevPerGame = Math.round(ticketRevenue + concessionRev + fixedRev)
  const totalRevPerMonth = Math.round(totalRevPerGame * 20.5) // ~41 home games / 2 months estimation
  const totalRevPerSeason = totalRevPerGame * 41

  const sel = selected ? sections[selected] : null
  const isBuilt = selected ? BUILT_SECTIONS.includes(selected) : false
  const isUnderConst = sel?.under_construction || false
  const cost = isBuilt ? UPGRADE_COST : BUILD_COST
  const weeks = isBuilt ? UPGRADE_WEEKS : BUILD_WEEKS
  const expansionSeats = sel && isBuilt ? Math.round((sections[selected!]?.capacity||0)*EXPANSION_RATE) : Math.round(3000*EXPANSION_RATE)
  const canAfford = cash >= cost

  const secFill=(sec:string)=>{
    if(!sections[sec])return'#e8e2d6'
    if(sections[sec].under_construction)return'#378ADD'
    if(BUILT_SECTIONS.includes(sec))return'#8B6914'
    return'none'
  }
  const secStroke=(sec:string)=>selected===sec?teamColor:BUILT_SECTIONS.includes(sec)?'#6b5010':'#b0a898'
  const secOp=(sec:string)=>sections[sec]?.under_construction?0.7:1

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

  const handleBuildConcession=async(key:string,cost:number,monthly:number)=>{
    if(!concessions||!isGM||cash<cost)return
    await supabase.from('arena_concessions').update({[key]:true,monthly_maintenance:(concessions.monthly_maintenance||0)+monthly}).eq('id',concessions.id)
    setConcessions(p=>p?{...p,[key]:true,monthly_maintenance:(p.monthly_maintenance||0)+monthly}:p)
    setMsg('Built successfully!')
  }

  if(loading)return <div className="text-center py-8" style={{color:'#8a8279'}}>Loading arena...</div>

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

      {/* SVG + section panel side by side */}
      <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:16}}>
        <div style={{flex:1,minWidth:0}}>
          <svg viewBox="0 0 700 480" xmlns="http://www.w3.org/2000/svg" style={{width:'100%'}}>
            <rect x="2" y="2" width="696" height="476" rx="16" fill="#ccc5ba" stroke="#aaa098" strokeWidth="1"/>
            {['N1A','N2A','N3A'].map((sec,i)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec)}>
                <rect x={120+i*130} y="8" width="115" height="50" rx="8" fill={sections[sec]?.under_construction?'#378ADD':'url(#hatch)'} fillOpacity={sections[sec]?.capacity>0?0.9:0.4} stroke={selected===sec?teamColor:'#b0a898'} strokeDasharray={selected===sec?'0':'6,3'} strokeWidth={selected===sec?2:0.8}/>
                <text x={120+i*130+57} y="29" textAnchor="middle" fontSize="11" fontWeight="500" fill="#6b5f4e" fontFamily="sans-serif">{sec}</text>
                <text x={120+i*130+57} y="47" textAnchor="middle" fontSize="9" fill="#9a8a78" fontFamily="sans-serif">{sections[sec]?.capacity>0?fmt(sections[sec].capacity):'(future)'}</text>
              </g>
            ))}
            <rect x="100" y="62" width="500" height="16" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="350" y="74" textAnchor="middle" fontSize="9" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif">NORTH STAND</text>
            {[['N1',100,82,155],['N2',272,82,156],['N3',445,82,155]].map(([sec,x,y,w]:any)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec)}>
                <rect x={x} y={y} width={w} height="52" rx="6" fill={secFill(sec)} fillOpacity={secOp(sec)} stroke={secStroke(sec)} strokeWidth={selected===sec?2:1}/>
                <text x={x+w/2} y={y+18} textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">{sec}</text>
                <text x={x+w/2} y={y+36} textAnchor="middle" fontSize="9" fill="#e8c96a" fontFamily="sans-serif">{sections[sec]?.under_construction?'building':fmt(sections[sec]?.capacity||0)}</text>
              </g>
            ))}
            <rect x="6" y="148" width="16" height="184" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="14" y="253" textAnchor="middle" fontSize="8" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif" transform="rotate(-90,14,253)">WEST STAND</text>
            <g style={{cursor:'pointer'}} onClick={()=>setSelected('W1')}>
              <rect x="24" y="148" width="68" height="184" rx="6" fill={secFill('W1')} fillOpacity={secOp('W1')} stroke={secStroke('W1')} strokeWidth={selected==='W1'?2:1}/>
              <text x="58" y="234" textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">W1</text>
              <text x="58" y="250" textAnchor="middle" fontSize="8" fill="#e8c96a" fontFamily="sans-serif">{sections['W1']?.under_construction?'building':fmt(sections['W1']?.capacity||0)}</text>
            </g>
            {[148,210,270].map((y,i)=>(
              <g key={i} style={{cursor:'pointer'}} onClick={()=>setSelected(i===0?'W_upper':'W_mid')}>
                <rect x="4" y={y} width="18" height="60" rx="4" fill="url(#hatch)" fillOpacity="0.4" stroke="#b0a898" strokeDasharray="5,3" strokeWidth="0.8"/>
              </g>
            ))}
            <rect x="678" y="148" width="16" height="184" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="686" y="253" textAnchor="middle" fontSize="8" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif" transform="rotate(90,686,253)">EAST STAND</text>
            <g style={{cursor:'pointer'}} onClick={()=>setSelected('E1')}>
              <rect x="608" y="148" width="68" height="184" rx="6" fill={secFill('E1')} fillOpacity={secOp('E1')} stroke={secStroke('E1')} strokeWidth={selected==='E1'?2:1}/>
              <text x="642" y="234" textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">E1</text>
              <text x="642" y="250" textAnchor="middle" fontSize="8" fill="#e8c96a" fontFamily="sans-serif">{sections['E1']?.under_construction?'building':fmt(sections['E1']?.capacity||0)}</text>
            </g>
            {[148,210,270].map((y,i)=>(
              <g key={i} style={{cursor:'pointer'}} onClick={()=>setSelected(i===0?'E_upper':'E_mid')}>
                <rect x="678" y={y} width="18" height="60" rx="4" fill="url(#hatch)" fillOpacity="0.4" stroke="#b0a898" strokeDasharray="5,3" strokeWidth="0.8"/>
              </g>
            ))}
            {[['S1',100,346,155],['S2',272,346,156],['S3',445,346,155]].map(([sec,x,y,w]:any)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec)}>
                <rect x={x} y={y} width={w} height="52" rx="6" fill={secFill(sec)} fillOpacity={secOp(sec)} stroke={secStroke(sec)} strokeWidth={selected===sec?2:1}/>
                <text x={x+w/2} y={y+18} textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">{sec}</text>
                <text x={x+w/2} y={y+36} textAnchor="middle" fontSize="9" fill="#e8c96a" fontFamily="sans-serif">{sections[sec]?.under_construction?'building':fmt(sections[sec]?.capacity||0)}</text>
              </g>
            ))}
            <rect x="100" y="400" width="500" height="16" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="350" y="412" textAnchor="middle" fontSize="9" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif">SOUTH STAND</text>
            {['S1A','S2A','S3A'].map((sec,i)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec)}>
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
        </div>

        {/* Section panel */}
        <div style={{width:200,flexShrink:0,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:14,minHeight:160}}>
          {!selected ? (
            <p style={{fontSize:12,color:'#8a8279',lineHeight:1.5}}>Click a section to view details and build/upgrade options.</p>
          ) : (
            <>
              <div style={{display:'inline-block',fontSize:10,padding:'2px 6px',borderRadius:4,marginBottom:8,
                background:isUnderConst?'#dbeafe':isBuilt?'#dcfce7':'#fef3c7',
                color:isUnderConst?'#1d4ed8':isBuilt?'#15803d':'#b45309'}}>
                {isUnderConst?'Under construction':isBuilt?'Built':'Not built'}
              </div>
              <div style={{fontSize:14,fontWeight:700,color:'#1a1512',marginBottom:8}}>{selected}</div>
              {[
                isBuilt&&['Seats',fmt(sel?.capacity||0)],
                isBuilt&&['Upgrade adds','+'+fmt(expansionSeats)+' seats'],
                !isBuilt&&['New seats','+'+fmt(expansionSeats)],
                ['Cost',fmtM(cost)],
                ['Offline',weeks+' weeks'],
              ].filter(Boolean).map((r:any)=>(
                <div key={r[0]} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #e2dcd5',fontSize:11}}>
                  <span style={{color:'#8a8279'}}>{r[0]}</span>
                  <span style={{color:'#1a1512',fontWeight:600}}>{r[1]}</span>
                </div>
              ))}
              {isGM && !isUnderConst && (
                <button onClick={handleBuildUpgrade} disabled={!canAfford||building}
                  style={{width:'100%',marginTop:10,padding:'7px',fontSize:12,fontWeight:600,border:'none',borderRadius:8,
                    background:canAfford&&!building?'#b45309':'#e2dcd5',
                    color:canAfford&&!building?'#fef3c7':'#8a8279',
                    cursor:canAfford&&!building?'pointer':'not-allowed'}}>
                  {building?'...':(isBuilt?'Upgrade — ':'Build — ')+fmtM(cost)}
                </button>
              )}
              {!canAfford&&isGM&&<p style={{fontSize:10,color:'#dc2626',marginTop:4}}>Insufficient funds</p>}
              {msg&&<p style={{fontSize:10,color:'#15803d',marginTop:4}}>✓ {msg}</p>}
            </>
          )}
        </div>
      </div>

      {/* Revenue estimate bar */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16,padding:12,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:10}}>
        <div>
          <div style={{fontSize:10,color:'#8a8279'}}>Est. attendance</div>
          <div style={{fontSize:14,fontWeight:700,color:'#1a1512'}}>{Math.round(attendancePct*100)}% · {fmt(attendance)}</div>
        </div>
        <div>
          <div style={{fontSize:10,color:'#8a8279'}}>Tickets/game</div>
          <div style={{fontSize:14,fontWeight:700,color:'#15803d'}}>{fmtD(Math.round(ticketRevenue))}</div>
        </div>
        <div>
          <div style={{fontSize:10,color:'#8a8279'}}>Concessions/game</div>
          <div style={{fontSize:14,fontWeight:700,color:'#15803d'}}>{fmtD(Math.round(concessionRev+fixedRev))}</div>
        </div>
        <div>
          <div style={{fontSize:10,color:'#8a8279'}}>Total/game</div>
          <div style={{fontSize:15,fontWeight:700,color:teamColor}}>{fmtD(totalRevPerGame)}</div>
        </div>
      </div>

      {/* Two columns: ticket prices + concessions */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

        {/* Ticket prices */}
        <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279'}}>Ticket Prices</div>
            {isGM && !editTickets && (
              <button onClick={()=>setEditTickets(true)} style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid #d4cdc5',background:'#f0ece5',color:'#5c554e',cursor:'pointer'}}>Edit</button>
            )}
          </div>
          {[
            {key:'ticket_lower',    label:'Lower Bowl',  icon:'🟡', pct:'50%'},
            {key:'ticket_upper',    label:'Upper Bowl',  icon:'🔵', pct:'35%'},
            {key:'ticket_courtside',label:'Courtside',   icon:'⭐', pct:'2%'},
            {key:'ticket_suite',    label:'Suite (each)',icon:'🏢', pct:'—'},
          ].map(t=>(
            <div key={t.key} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #e2dcd5'}}>
              <span style={{fontSize:14}}>{t.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:'#1a1512'}}>{t.label}</div>
                <div style={{fontSize:10,color:'#8a8279'}}>{t.pct} of arena</div>
              </div>
              {editTickets ? (
                <input type="number" value={(ticketDraft as any)[t.key]||0}
                  onChange={e=>setTicketDraft(p=>({...p,[t.key]:Number(e.target.value)}))}
                  style={{width:60,padding:'2px 6px',fontSize:12,borderRadius:4,border:'1px solid #d4cdc5',textAlign:'right'}}/>
              ) : (
                <span style={{fontSize:13,fontWeight:700,color:'#1a1512'}}>${(config as any)?.[t.key]||0}</span>
              )}
            </div>
          ))}
          {editTickets && isGM && (
            <div style={{display:'flex',gap:6,marginTop:10}}>
              <button onClick={handleSaveTickets} disabled={saving}
                style={{flex:1,padding:'6px',fontSize:12,fontWeight:600,border:'none',borderRadius:8,background:teamColor,color:'#fff',cursor:'pointer'}}>
                {saving?'Saving...':'Save'}
              </button>
              <button onClick={()=>setEditTickets(false)}
                style={{padding:'6px 10px',fontSize:12,borderRadius:8,border:'1px solid #d4cdc5',background:'#f0ece5',color:'#5c554e',cursor:'pointer'}}>
                Cancel
              </button>
            </div>
          )}
          <div style={{marginTop:10,fontSize:10,color:'#8a8279',lineHeight:1.5}}>
            Higher prices = more revenue but lower attendance. Find the sweet spot.
          </div>
        </div>

        {/* Concessions */}
        <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:14}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:12}}>
            Concessions & Amenities
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:340,overflowY:'auto'}}>
            {CONCESSION_CONFIG.map(c=>{
              const built = concessions ? (concessions as any)[c.key] : false
              return (
                <div key={c.key} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 6px',borderRadius:6,
                  background:built?'#f0fdf4':'transparent',border:`1px solid ${built?'#bbf7d0':'transparent'}`}}>
                  <span style={{fontSize:14,flexShrink:0}}>{c.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#1a1512'}}>{c.label}</div>
                    <div style={{fontSize:9,color:'#8a8279'}}>
                      {built
                        ? (c.per_capita ? `+$${c.per_capita}/person` : `+${fmtD((c as any).fixed_per_game||0)}/game`)
                        : `${fmtM(c.cost)} · ${fmtM(c.monthly)}/mo`
                      }
                    </div>
                  </div>
                  {built
                    ? <span style={{fontSize:10,color:'#15803d',fontWeight:600,flexShrink:0}}>✓</span>
                    : isGM && (
                      <button onClick={()=>handleBuildConcession(c.key,c.cost,c.monthly)}
                        disabled={cash<c.cost}
                        style={{padding:'3px 8px',fontSize:10,fontWeight:600,borderRadius:6,border:'none',flexShrink:0,
                          background:cash>=c.cost?teamColor:'#e2dcd5',color:cash>=c.cost?'#fff':'#8a8279',cursor:cash>=c.cost?'pointer':'not-allowed'}}>
                        Build
                      </button>
                    )
                  }
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

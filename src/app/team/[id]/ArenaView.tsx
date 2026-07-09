'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import ArenaBlueprint from './ArenaBlueprint'
import { getTeamSegmentMix, SEGMENTS } from '@/lib/audience-segments'

type Section = { id:string, section:string, level:number, capacity:number, under_construction:boolean, construction_ends_at:string|null }
type Config = { id:string, ticket_lower:number, ticket_upper:number, ticket_courtside:number, ticket_suite:number }
type Concessions = {
  id:string
  food_stall_basic_north:number, food_stall_basic_south:number,
  food_stall_basic_east:number, food_stall_basic_west:number,
  food_stall_premium_north:number, food_stall_premium_south:number,
  bar_east:number, bar_west:number,
  vending_north:number, vending_south:number, vending_east:number, vending_west:number,
  restaurant_vip:number, franchise_store:number, corporate_suites:number,
  club_seats:number, courtside_lounge:number, jumbotron:number,
  fan_zone:number, mascot:number, monthly_maintenance:number
}

const BUILT_SECTIONS = ['N1','N2','N3','S1','S2','S3','W1','E1']
const FUTURE_SECTIONS = ['N1A','N2A','N3A','S1A','S2A','S3A','W_upper','W_mid','E_upper','E_mid']
const UPGRADE_COST = 12000000
const BUILD_COST   = 8000000
const UPGRADE_WEEKS = 8
const BUILD_WEEKS   = 12
const EXPANSION_RATE = 0.6

function fmt(n:number|null|undefined){ return (n??0).toLocaleString() }
function fmtM(n:number|null|undefined){ return '$'+((n??0)>=1000000?((n??0)/1e6).toFixed(0)+'M':((n??0)/1000).toFixed(0)+'K') }
function fmtD(n:number){ return '$'+n.toLocaleString() }

export default function ArenaView({teamId,teamColor,arenaName,arenaCapacity,cash=25000000}:{
  teamId:string, teamColor:string, arenaName:string, arenaCapacity:number, cash?:number
}) {
  const {profile} = useAuth()
  const isGM = (profile as any)?.team_id===teamId || profile?.role==='commissioner'
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [sections,setSections]       = useState<Record<string,Section>>({})
  const [config,setConfig]           = useState<Config|null>(null)
  const [concessions,setConcessions] = useState<Concessions|null>(null)
  const [selected,setSelected]       = useState<string|null>(null)
  const [loading,setLoading]         = useState(true)
  const [building,setBuilding]       = useState(false)
  const [saving,setSaving]           = useState(false)
  const [msg,setMsg]                 = useState('')
  const [editTickets,setEditTickets] = useState(false)
  const [ticketDraft,setTicketDraft] = useState<Partial<Config>>({})
  const [tab,setTab]                 = useState<'sections'|'concessions'|'tickets'>('sections')
  const [teamInfo,setTeamInfo]       = useState<{popularity:number,social_media_followers?:number}|null>(null)

  useEffect(()=>{
    Promise.all([
      supabase.from('arena_sections').select('*').eq('team_id',teamId),
      supabase.from('franchise_config').select('*').eq('team_id',teamId).single(),
      supabase.from('arena_concessions').select('*').eq('team_id',teamId).single(),
      supabase.from('teams').select('popularity,social_media_followers').eq('id',teamId).single(),
    ]).then(([{data:s},{data:c},{data:co},{data:tm}])=>{
      const map:Record<string,Section>={}
      for(const sec of (s||[])) map[sec.section]=sec
      setSections(map)
      setConfig(c)
      setTicketDraft(c||{})
      setConcessions(co)
      setTeamInfo(tm)
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
    const { data: { session } } = await supabase.auth.getSession()
    if(!session){ setMsg(isPT?'Não estás autenticado':'Not logged in'); setBuilding(false); return }
    const res = await fetch('/api/arena/build-section', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
      body: JSON.stringify({ section:selected }),
    })
    const json = await res.json()
    if(!res.ok){ setMsg(json.error||(isPT?'Erro':'Error')); setBuilding(false); return }
    setSections(p=>({...p,[selected]:{...p[selected],under_construction:true,construction_ends_at:json.endsAt}}))
    setMsg(isBuilt?(isPT?'Melhoria iniciada!':'Upgrade started!'):(isPT?'Construção iniciada!':'Construction started!'))
    setBuilding(false)
  }

  const handleSaveTickets=async()=>{
    if(!config||!isGM)return
    setSaving(true)
    await supabase.from('franchise_config').update(ticketDraft).eq('id',config.id)
    setConfig(p=>p?{...p,...ticketDraft}:p)
    setEditTickets(false); setSaving(false); setMsg(isPT?'Preços dos bilhetes actualizados!':'Ticket prices updated!')
  }

  const handleBuildConcession=async(key:string, unitCost:number, unitMonthly:number)=>{
    if(!concessions||!isGM||cash<unitCost)return
    const { data: { session } } = await supabase.auth.getSession()
    if(!session){ setMsg(isPT?'Não estás autenticado':'Not logged in'); return }
    const res = await fetch('/api/arena/build-concession', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
      body: JSON.stringify({ variantKey:key }),
    })
    const json = await res.json()
    if(!res.ok){ setMsg(json.error||(isPT?'Erro':'Error')); return }
    const current = (concessions as any)[key] || 0
    const newMonthly = (concessions.monthly_maintenance||0) + unitMonthly
    setConcessions(p=>p?{...p,[key]:current+1, monthly_maintenance:newMonthly}:p)
    setMsg(isPT?'Construído com sucesso!':'Built successfully!')
  }

  if(loading)return <div className="text-center py-8" style={{color:'#8a8279'}}>{t('common.loading')}</div>

  return (
    <div>
      {msg && <div style={{marginBottom:12,padding:'8px 12px',background:'#dcfce7',color:'#15803d',borderRadius:8,fontSize:12,fontWeight:600,border:'1px solid #bbf7d0'}}>✓ {msg}</div>}

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:'#1a1512',margin:0}}>{arenaName}</h3>
          <p style={{fontSize:11,color:'#8a8279',margin:0}}>
            {isPT?'Capacidade':'Capacity'}: <strong>{fmt(totalCurrent)}</strong> · {isPT?'Assistência est.':'Est. attendance'}: <strong>{fmt(attendance)}</strong> ({Math.round(attendancePct*100)}%)
            {teamInfo?.social_media_followers!=null && <> · 📱 <strong>{fmt(teamInfo.social_media_followers)}</strong> {isPT?'seguidores':'followers'}</>}
          </p>
        </div>
        {isGM && <div style={{fontSize:11,padding:'4px 10px',borderRadius:6,background:'#dcfce7',color:'#15803d',fontWeight:600}}>{isPT?'Fundos':'Funds'}: {fmtM(cash)}</div>}
      </div>

      {/* Tab nav */}
      <div style={{display:'flex',gap:6,marginBottom:14,borderBottom:'2px solid #e2dcd5'}}>
        {[{k:'sections',l:isPT?'🏟️ Secções':'🏟️ Sections'},{k:'concessions',l:isPT?'🍔 Bares':'🍔 Concessions'},{k:'tickets',l:isPT?'🎟️ Bilhetes':'🎟️ Tickets'}].map((t:any)=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{padding:'6px 14px',fontSize:12,fontWeight:600,border:'none',
                    borderBottom:`3px solid ${tab===t.k?teamColor:'transparent'}`,
                    background:'transparent',color:tab===t.k?teamColor:'#8a8279',
                    cursor:'pointer',marginBottom:-2}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── SECTIONS TAB ── */}
      {tab==='sections' && (
        <>
          <svg viewBox="0 0 700 480" xmlns="http://www.w3.org/2000/svg" style={{width:'100%'}}>
            <rect x="2" y="2" width="696" height="476" rx="16" fill="#ccc5ba" stroke="#aaa098" strokeWidth="1"/>
            {['N1A','N2A','N3A'].map((sec,i)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec===selected?null:sec)}>
                <rect x={120+i*130} y="8" width="115" height="50" rx="8" fill={sections[sec]?.under_construction?'#378ADD':'url(#hatch)'} fillOpacity={sections[sec]?.capacity>0?0.9:0.4} stroke={selected===sec?teamColor:'#b0a898'} strokeDasharray={selected===sec?'0':'6,3'} strokeWidth={selected===sec?2:0.8}/>
                <text x={120+i*130+57} y="29" textAnchor="middle" fontSize="11" fontWeight="500" fill="#6b5f4e" fontFamily="sans-serif">{sec}</text>
                <text x={120+i*130+57} y="47" textAnchor="middle" fontSize="9" fill="#9a8a78" fontFamily="sans-serif">{sections[sec]?.capacity>0?fmt(sections[sec].capacity):(isPT?'(futuro)':'(future)')}</text>
              </g>
            ))}
            <rect x="100" y="62" width="500" height="16" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="350" y="74" textAnchor="middle" fontSize="9" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif">{isPT?'BANCADA NORTE':'NORTH STAND'}</text>
            {[['N1',100,82,155],['N2',272,82,156],['N3',445,82,155]].map(([sec,x,y,w]:any)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec===selected?null:sec)}>
                <rect x={x} y={y} width={w} height="52" rx="6" fill={secFill(sec)} fillOpacity={secOp(sec)} stroke={secStroke(sec)} strokeWidth={selected===sec?2:1}/>
                <text x={x+w/2} y={y+18} textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">{sec}</text>
                <text x={x+w/2} y={y+36} textAnchor="middle" fontSize="9" fill="#e8c96a" fontFamily="sans-serif">{sections[sec]?.under_construction?(isPT?'em obras':'building'):fmt(sections[sec]?.capacity||0)}</text>
              </g>
            ))}
            <rect x="6" y="148" width="16" height="184" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="14" y="253" textAnchor="middle" fontSize="8" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif" transform="rotate(-90,14,253)">{isPT?'BANCADA OESTE':'WEST STAND'}</text>
            <g style={{cursor:'pointer'}} onClick={()=>setSelected('W1'===selected?null:'W1')}>
              <rect x="24" y="148" width="68" height="184" rx="6" fill={secFill('W1')} fillOpacity={secOp('W1')} stroke={secStroke('W1')} strokeWidth={selected==='W1'?2:1}/>
              <text x="58" y="234" textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">W1</text>
              <text x="58" y="250" textAnchor="middle" fontSize="8" fill="#e8c96a" fontFamily="sans-serif">{sections['W1']?.under_construction?(isPT?'em obras':'building'):fmt(sections['W1']?.capacity||0)}</text>
            </g>
            {[148,210,270].map((y,i)=>(
              <g key={i} style={{cursor:'pointer'}} onClick={()=>setSelected((i===0?'W_upper':'W_mid')===selected?null:(i===0?'W_upper':'W_mid'))}>
                <rect x="4" y={y} width="18" height="60" rx="4" fill="url(#hatch)" fillOpacity="0.4" stroke="#b0a898" strokeDasharray="5,3" strokeWidth="0.8"/>
              </g>
            ))}
            <rect x="678" y="148" width="16" height="184" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="686" y="253" textAnchor="middle" fontSize="8" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif" transform="rotate(90,686,253)">{isPT?'BANCADA ESTE':'EAST STAND'}</text>
            <g style={{cursor:'pointer'}} onClick={()=>setSelected('E1'===selected?null:'E1')}>
              <rect x="608" y="148" width="68" height="184" rx="6" fill={secFill('E1')} fillOpacity={secOp('E1')} stroke={secStroke('E1')} strokeWidth={selected==='E1'?2:1}/>
              <text x="642" y="234" textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">E1</text>
              <text x="642" y="250" textAnchor="middle" fontSize="8" fill="#e8c96a" fontFamily="sans-serif">{sections['E1']?.under_construction?(isPT?'em obras':'building'):fmt(sections['E1']?.capacity||0)}</text>
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
                <text x={x+w/2} y={y+36} textAnchor="middle" fontSize="9" fill="#e8c96a" fontFamily="sans-serif">{sections[sec]?.under_construction?(isPT?'em obras':'building'):fmt(sections[sec]?.capacity||0)}</text>
              </g>
            ))}
            <rect x="100" y="400" width="500" height="16" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="350" y="412" textAnchor="middle" fontSize="9" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif">{isPT?'BANCADA SUL':'SOUTH STAND'}</text>
            {['S1A','S2A','S3A'].map((sec,i)=>(
              <g key={sec} style={{cursor:'pointer'}} onClick={()=>setSelected(sec===selected?null:sec)}>
                <rect x={120+i*130} y="420" width="115" height="50" rx="8" fill={sections[sec]?.capacity>0?'#d4a055':'url(#hatch)'} fillOpacity={sections[sec]?.capacity>0?0.9:0.4} stroke={selected===sec?teamColor:'#b0a898'} strokeDasharray={selected===sec?'0':'6,3'} strokeWidth={selected===sec?2:0.8}/>
                <text x={120+i*130+57} y="441" textAnchor="middle" fontSize="11" fontWeight="500" fill="#6b5f4e" fontFamily="sans-serif">{sec}</text>
                <text x={120+i*130+57} y="459" textAnchor="middle" fontSize="9" fill="#9a8a78" fontFamily="sans-serif">{sections[sec]?.capacity>0?fmt(sections[sec].capacity):(isPT?'(futuro)':'(future)')}</text>
              </g>
            ))}
            {/* Court */}
            <rect x="100" y="138" width="500" height="204" rx="4" fill="#e8a030" stroke="#c07820" strokeWidth="2"/>
            <rect x="108" y="146" width="484" height="188" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <line x1="350" y1="146" x2="350" y2="334" stroke="#fff" strokeWidth="1.5"/>
            <circle cx="350" cy="240" r="38" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <circle cx="350" cy="240" r="4" fill="#d44020"/>
            {/* Left paint */}
            <rect x="108" y="185" width="95" height="110" fill="#d44020" stroke="#fff" strokeWidth="1.5"/>
            <path d="M 203 185 A 42 42 0 0 1 203 295" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <path d="M 203 185 A 42 42 0 0 0 203 295" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="5,4"/>
            <line x1="108" y1="218" x2="108" y2="262" stroke="#fff" strokeWidth="3"/>
            <circle cx="133" cy="240" r="8" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <line x1="108" y1="163" x2="203" y2="163" stroke="#fff" strokeWidth="1.5"/>
            <line x1="108" y1="317" x2="203" y2="317" stroke="#fff" strokeWidth="1.5"/>
            {/* Three-point line, properly centered on the hoop (133,240): a
                straight corner segment along each sideline, then an arc of
                radius 135 that clears both the paint (ends at x=203) and the
                free-throw circle — the old single-path version connected two
                fixed points with an unrelated radius, so its implicit center
                landed nowhere near the hoop and the arc cut across the paint. */}
            <line x1="108" y1="146" x2="230" y2="146" stroke="#fff" strokeWidth="1.5"/>
            <path d="M 230 146 A 135 135 0 0 1 230 334" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <line x1="108" y1="334" x2="230" y2="334" stroke="#fff" strokeWidth="1.5"/>
            {/* Right paint */}
            <rect x="497" y="185" width="95" height="110" fill="#d44020" stroke="#fff" strokeWidth="1.5"/>
            <path d="M 497 185 A 42 42 0 0 0 497 295" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <path d="M 497 185 A 42 42 0 0 1 497 295" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="5,4"/>
            <line x1="592" y1="218" x2="592" y2="262" stroke="#fff" strokeWidth="3"/>
            <circle cx="567" cy="240" r="8" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <line x1="592" y1="163" x2="497" y2="163" stroke="#fff" strokeWidth="1.5"/>
            <line x1="592" y1="317" x2="497" y2="317" stroke="#fff" strokeWidth="1.5"/>
            {/* Mirror of the left three-point line, centered on the right hoop (567,240) */}
            <line x1="592" y1="146" x2="470" y2="146" stroke="#fff" strokeWidth="1.5"/>
            <path d="M 470 146 A 135 135 0 0 0 470 334" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <line x1="592" y1="334" x2="470" y2="334" stroke="#fff" strokeWidth="1.5"/>
            <defs>
              <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#b0a898" strokeWidth="0.8" opacity="0.6"/>
              </pattern>
            </defs>
          </svg>

          {selected && (
            <div style={{margin:'8px 0 16px',padding:'10px 14px',background:'#faf8f5',border:`1px solid ${teamColor}44`,borderLeft:`3px solid ${teamColor}`,borderRadius:10,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <div>
                <div style={{display:'inline-block',fontSize:10,padding:'2px 6px',borderRadius:4,marginBottom:2,
                  background:isUnderConst?'#dbeafe':isBuilt?'#dcfce7':'#fef3c7',
                  color:isUnderConst?'#1d4ed8':isBuilt?'#15803d':'#b45309'}}>
                  {isUnderConst?(isPT?'Em obras':'Under construction'):isBuilt?(isPT?'Construído':'Built'):(isPT?'Por construir':'Not built')}
                </div>
                <div style={{fontSize:15,fontWeight:700,color:'#1a1512'}}>{selected}</div>
              </div>
              {[
                isBuilt&&[isPT?'Lugares':'Seats',fmt(sel?.capacity||0)],
                isBuilt&&[isPT?'Melhoria acrescenta':'Upgrade adds','+'+fmt(expansionSeats)+(isPT?' lugares':' seats')],
                !isBuilt&&[isPT?'Novos lugares':'New seats','+'+fmt(expansionSeats)],
                isGM&&[isPT?'Custo':'Cost',fmtM(cost)],
                isGM&&[isPT?'Fora de serviço':'Offline',weeks+(isPT?' semanas':' weeks')],
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
                  {building?'...':(isBuilt?(isPT?'Melhorar — ':'Upgrade — '):(isPT?'Construir — ':'Build — '))+fmtM(cost)}
                </button>
              )}
              {!canAfford&&isGM&&<span style={{fontSize:10,color:'#dc2626'}}>{isPT?'Fundos insuficientes':'Insufficient funds'}</span>}
              <button onClick={()=>setSelected(null)} style={{padding:'5px 9px',fontSize:11,borderRadius:6,border:'1px solid #d4cdc5',background:'#f0ece5',color:'#5c554e',cursor:'pointer'}}>✕</button>
            </div>
          )}
        </>
      )}

      {/* ── CONCESSIONS TAB ── */}
      {tab==='concessions' && concessions && (
        <ArenaBlueprint
          concessions={concessions}
          isGM={isGM}
          teamColor={teamColor}
          cash={cash}
          onBuild={handleBuildConcession}
          estimatedAttendance={attendance}
        />
      )}

      {/* ── TICKETS TAB ── */}
      {tab==='tickets' && (
        isGM ? (
          <div style={{maxWidth:400}}>
            <div style={{marginBottom:12,padding:'8px 12px',background:'#f0ece5',borderRadius:8,fontSize:11,color:'#5c554e',display:'flex',justifyContent:'space-between'}}>
              <span>{isPT?'Receita de bilhetes est./jogo':'Est. ticket revenue/game'}</span>
              <strong style={{color:'#15803d'}}>{fmtD(Math.round(ticketRevenue))}</strong>
            </div>
            <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279'}}>{isPT?'Preços dos Bilhetes':'Ticket Prices'}</div>
                {!editTickets && <button onClick={()=>setEditTickets(true)} style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid #d4cdc5',background:'#f0ece5',color:'#5c554e',cursor:'pointer'}}>{isPT?'Editar':'Edit'}</button>}
              </div>
              {[
                {key:'ticket_lower',    label:isPT?'Bancada Inferior':'Lower Bowl',   icon:'🟡', pct:isPT?'~50% dos lugares':'~50% of seats', note:isPT?'Nível principal':'Main seating level'},
                {key:'ticket_upper',    label:isPT?'Bancada Superior':'Upper Bowl',   icon:'🔵', pct:isPT?'~35% dos lugares':'~35% of seats', note:isPT?'Piso superior':'Upper deck'},
                {key:'ticket_courtside',label:isPT?'Courtside':'Courtside',    icon:'⭐', pct:isPT?'~2% dos lugares':'~2% of seats',  note:isPT?'Lugares premium junto ao campo':'Premium floor seats'},
                {key:'ticket_suite',    label:isPT?'Camarote (cada)':'Suite (each)', icon:'🏢', pct:isPT?'Por camarote/jogo':'Per suite/game', note:isPT?'Aluguer de camarote completo':'Full suite rental'},
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
                    {saving?(isPT?'A guardar...':'Saving...'):(isPT?'Guardar preços':'Save prices')}
                  </button>
                  <button onClick={()=>setEditTickets(false)}
                    style={{padding:'7px 12px',fontSize:12,borderRadius:8,border:'1px solid #d4cdc5',background:'#f0ece5',color:'#5c554e',cursor:'pointer'}}>
                    {isPT?'Cancelar':'Cancel'}
                  </button>
                </div>
              )}
              <div style={{marginTop:10,fontSize:10,color:'#8a8279',lineHeight:1.5}}>
                ⚠️ {isPT?'Preços mais altos reduzem a assistência. Gere o equilíbrio entre receita e afluência de adeptos.':'Higher prices reduce attendance. Monitor the balance between revenue and fan turnout.'}
              </div>
            </div>

            {teamInfo && (
              <div style={{marginTop:14,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:16}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:10}}>
                  {isPT?'Quem Está na Tua Arena':'Who\'s In Your Arena'}
                </div>
                {SEGMENTS.map(seg=>{
                  const share = getTeamSegmentMix(teamId, teamInfo.popularity)[seg.id]
                  const price = seg.tier==='lower'?config?.ticket_lower:seg.tier==='upper'?config?.ticket_upper:config?.ticket_courtside
                  const priced_out = (price||0) > seg.comfortablePrice*2
                  return (
                    <div key={seg.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid #e2dcd5'}}>
                      <span style={{fontSize:11,flex:1,color:'#1a1512'}}>{seg.label}</span>
                      <div style={{flex:2,height:6,background:'#e2dcd5',borderRadius:3,overflow:'hidden'}}>
                        <div style={{width:`${Math.round(share*100)}%`,height:'100%',background:priced_out?'#dc2626':teamColor}}/>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,color:'#5c554e',width:36,textAlign:'right'}}>{Math.round(share*100)}%</span>
                      {priced_out && <span style={{fontSize:9,color:'#dc2626',fontWeight:700}}>{isPT?'excluído p/ preço':'priced out'}</span>}
                    </div>
                  )
                })}
                <div style={{fontSize:9,color:'#8a8279',marginTop:8,lineHeight:1.5}}>
                  {isPT?'Quota de público esperada para este mercado. "Excluído p/ preço" significa que o preço atual do teu bilhete afasta esse público por completo.':'Expected audience share for this market. "Priced out" means your current ticket price puts that segment off entirely.'}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{padding:32,textAlign:'center',color:'#b0a89e',fontSize:13}}>
            🔒 {isPT?'Os preços dos bilhetes são privados, só o GM da franquia os vê.':'Ticket pricing is private to the franchise GM.'}
          </div>
        )
      )}
    </div>
  )
}

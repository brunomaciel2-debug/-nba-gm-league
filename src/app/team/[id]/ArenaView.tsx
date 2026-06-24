'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Section = {
  id: string
  section: string
  level: number
  capacity: number
  under_construction: boolean
  construction_ends_at: string | null
}

const BUILT_SECTIONS = ['N1','N2','N3','S1','S2','S3','W1','E1']
const FUTURE_SECTIONS = ['N1A','N2A','N3A','S1A','S2A','S3A','W_upper','W_mid','E_upper','E_mid']

const UPGRADE_COST = 12000000
const BUILD_COST   = 8000000
const UPGRADE_WEEKS = 8
const BUILD_WEEKS   = 12

const EXPANSION_RATE = 0.6 // future adds 60% of built section capacity

function fmt(n: number) { return n.toLocaleString() }
function fmtM(n: number) { return '$' + (n/1e6).toFixed(0) + 'M' }

export default function ArenaView({ teamId, teamColor, arenaName, arenaCapacity, cash = 45000000 }: {
  teamId: string
  teamColor: string
  arenaName: string
  arenaCapacity: number
  cash?: number
}) {
  const { profile } = useAuth()
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [sections, setSections] = useState<Record<string, Section>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('arena_sections').select('*').eq('team_id', teamId)
      .then(({ data }) => {
        const map: Record<string, Section> = {}
        for (const s of (data || [])) map[s.section] = s
        setSections(map)
        setLoading(false)
      })
  }, [teamId])

  const sel = selected ? sections[selected] : null
  const isBuilt = selected ? BUILT_SECTIONS.includes(selected) : false
  const isFuture = selected ? FUTURE_SECTIONS.includes(selected) : false
  const isUnderConst = sel?.under_construction || false

  const expansionSeats = sel && isBuilt
    ? Math.round((sections[selected!]?.capacity || 0) * EXPANSION_RATE)
    : sel && isFuture
    ? Math.round((sections[selected!.replace('A','').replace('_upper','').replace('_mid','')]?.capacity || 3000) * EXPANSION_RATE)
    : 0

  const cost = isBuilt ? UPGRADE_COST : BUILD_COST
  const weeks = isBuilt ? UPGRADE_WEEKS : BUILD_WEEKS
  const canAfford = cash >= cost

  const revBoost = Math.round(expansionSeats * 50 * 41 / 1e6 * 10) / 10

  const totalCurrent = BUILT_SECTIONS.reduce((s, k) => s + (sections[k]?.capacity || 0), 0)
  const totalFuture  = totalCurrent + FUTURE_SECTIONS.reduce((s, k) => s + (sections[k]?.capacity || 0), 0)

  const secFill = (sec: string) => {
    if (!sections[sec]) return '#e8e2d6'
    if (sections[sec].under_construction) return '#378ADD'
    if (BUILT_SECTIONS.includes(sec)) return '#8B6914'
    return 'none'
  }
  const secStroke = (sec: string) => {
    if (selected === sec) return teamColor
    if (BUILT_SECTIONS.includes(sec)) return '#6b5010'
    return '#b0a898'
  }
  const secOpacity = (sec: string) => sections[sec]?.under_construction ? 0.7 : 1

  const handleBuildUpgrade = async () => {
    if (!selected || !isGM) return
    setBuilding(true)
    setMsg('')
    const endsAt = new Date()
    endsAt.setDate(endsAt.getDate() + weeks * 7)
    await supabase.from('arena_sections')
      .update({ under_construction: true, construction_ends_at: endsAt.toISOString().split('T')[0] })
      .eq('id', sections[selected].id)
    setSections(prev => ({ ...prev, [selected]: { ...prev[selected], under_construction: true, construction_ends_at: endsAt.toISOString().split('T')[0] } }))
    setMsg(isBuilt ? 'Upgrade started!' : 'Construction started!')
    setBuilding(false)
  }

  const sectionLabel = (sec: string) => {
    const s = sections[sec]
    if (!s || s.capacity === 0) return sec.replace('_', ' ')
    return sec
  }

  if (loading) return <div className="text-center py-8" style={{color:'#8a8279'}}>Loading arena...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold" style={{color:'#1a1512'}}>{arenaName}</h3>
          <p className="text-xs" style={{color:'#8a8279'}}>
            Current capacity: <strong>{fmt(totalCurrent)}</strong> · Max potential: <strong>{fmt(totalCurrent + FUTURE_SECTIONS.reduce((s,k) => s + Math.round((sections[k.replace('A','').replace('_upper','').replace('_mid','')]?.capacity||3000)*EXPANSION_RATE), 0))}</strong>
          </p>
        </div>
        {isGM && (
          <div className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{background:'#dcfce7',color:'#15803d'}}>
            Available funds: {fmtM(cash)}
          </div>
        )}
      </div>

      <div style={{display:'flex', gap:16, alignItems:'flex-start'}}>
        {/* SVG ARENA */}
        <div style={{flex:1, minWidth:0}}>
          <svg viewBox="0 0 700 480" xmlns="http://www.w3.org/2000/svg" style={{width:'100%'}}>

            {/* Shell */}
            <rect x="2" y="2" width="696" height="476" rx="16" fill="#ccc5ba" stroke="#aaa098" strokeWidth="1"/>

            {/* ── NORTH FUTURE ── */}
            {['N1A','N2A','N3A'].map((sec, i) => (
              <g key={sec} style={{cursor:'pointer'}} onClick={() => setSelected(sec)}>
                <rect x={120 + i*130} y="8" width="115" height="50" rx="8"
                  fill={sections[sec]?.under_construction ? '#378ADD' : 'url(#hatch)'}
                  fillOpacity={sections[sec]?.capacity > 0 ? 0.9 : 0.4}
                  stroke={selected===sec ? teamColor : '#b0a898'}
                  strokeDasharray={selected===sec ? '0' : '6,3'}
                  strokeWidth={selected===sec ? 2 : 0.8}/>
                <text x={120+i*130+57} y="29" textAnchor="middle" fontSize="11" fontWeight="500" fill="#6b5f4e" fontFamily="sans-serif">{sec}</text>
                <text x={120+i*130+57} y="47" textAnchor="middle" fontSize="9" fill="#9a8a78" fontFamily="sans-serif">
                  {sections[sec]?.capacity > 0 ? fmt(sections[sec].capacity) : '(future)'}
                </text>
              </g>
            ))}

            {/* North label */}
            <rect x="100" y="62" width="500" height="16" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="350" y="74" textAnchor="middle" fontSize="9" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif">NORTH STAND</text>

            {/* ── NORTH BUILT ── */}
            {[['N1',100,82,155],['N2',272,82,156],['N3',445,82,155]].map(([sec,x,y,w]:any) => (
              <g key={sec} style={{cursor:'pointer'}} onClick={() => setSelected(sec)}>
                <rect x={x} y={y} width={w} height="52" rx="6"
                  fill={secFill(sec)} fillOpacity={secOpacity(sec)}
                  stroke={secStroke(sec)} strokeWidth={selected===sec?2:1}/>
                <text x={x+w/2} y={y+18} textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">{sec}</text>
                <text x={x+w/2} y={y+36} textAnchor="middle" fontSize="9" fill="#e8c96a" fontFamily="sans-serif">
                  {sections[sec]?.under_construction ? 'In construction' : fmt(sections[sec]?.capacity || 0)}
                </text>
              </g>
            ))}

            {/* ── WEST ── */}
            <rect x="6" y="148" width="16" height="184" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="14" y="253" textAnchor="middle" fontSize="8" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif" transform="rotate(-90,14,253)">WEST STAND</text>

            <g style={{cursor:'pointer'}} onClick={() => setSelected('W1')}>
              <rect x="24" y="148" width="68" height="184" rx="6"
                fill={secFill('W1')} fillOpacity={secOpacity('W1')}
                stroke={secStroke('W1')} strokeWidth={selected==='W1'?2:1}/>
              <text x="58" y="234" textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">W1</text>
              <text x="58" y="250" textAnchor="middle" fontSize="8" fill="#e8c96a" fontFamily="sans-serif">
                {sections['W1']?.under_construction ? 'building' : fmt(sections['W1']?.capacity||0)}
              </text>
            </g>

            {/* West future tiers */}
            {[['W_upper',148,60],['W_mid',210,60],['W_mid',270,60]].map(([sec,y,h]:any, i) => (
              <g key={sec+i} style={{cursor:'pointer'}} onClick={() => setSelected(i===0?'W_upper':'W_mid')}>
                <rect x="4" y={y} width="18" height={h} rx="4"
                  fill={sections[i===0?'W_upper':'W_mid']?.capacity>0?'#d4a055':'url(#hatch)'}
                  fillOpacity="0.4" stroke="#b0a898" strokeDasharray="5,3" strokeWidth="0.8"/>
              </g>
            ))}

            {/* ── EAST ── */}
            <rect x="678" y="148" width="16" height="184" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="686" y="253" textAnchor="middle" fontSize="8" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif" transform="rotate(90,686,253)">EAST STAND</text>

            <g style={{cursor:'pointer'}} onClick={() => setSelected('E1')}>
              <rect x="608" y="148" width="68" height="184" rx="6"
                fill={secFill('E1')} fillOpacity={secOpacity('E1')}
                stroke={secStroke('E1')} strokeWidth={selected==='E1'?2:1}/>
              <text x="642" y="234" textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">E1</text>
              <text x="642" y="250" textAnchor="middle" fontSize="8" fill="#e8c96a" fontFamily="sans-serif">
                {sections['E1']?.under_construction ? 'building' : fmt(sections['E1']?.capacity||0)}
              </text>
            </g>

            {/* East future tiers */}
            {[148,210,270].map((y,i) => (
              <g key={i} style={{cursor:'pointer'}} onClick={() => setSelected(i===0?'E_upper':'E_mid')}>
                <rect x="678" y={y} width="18" height="60" rx="4"
                  fill="url(#hatch)" fillOpacity="0.4" stroke="#b0a898" strokeDasharray="5,3" strokeWidth="0.8"/>
              </g>
            ))}

            {/* ── SOUTH BUILT ── */}
            {[['S1',100,346,155],['S2',272,346,156],['S3',445,346,155]].map(([sec,x,y,w]:any) => (
              <g key={sec} style={{cursor:'pointer'}} onClick={() => setSelected(sec)}>
                <rect x={x} y={y} width={w} height="52" rx="6"
                  fill={secFill(sec)} fillOpacity={secOpacity(sec)}
                  stroke={secStroke(sec)} strokeWidth={selected===sec?2:1}/>
                <text x={x+w/2} y={y+18} textAnchor="middle" fontSize="13" fontWeight="500" fill="#fef3c7" fontFamily="sans-serif">{sec}</text>
                <text x={x+w/2} y={y+36} textAnchor="middle" fontSize="9" fill="#e8c96a" fontFamily="sans-serif">
                  {sections[sec]?.under_construction ? 'In construction' : fmt(sections[sec]?.capacity||0)}
                </text>
              </g>
            ))}

            {/* South label */}
            <rect x="100" y="400" width="500" height="16" rx="4" fill="#d4c8a8" stroke="#b0a898" strokeWidth="0.5"/>
            <text x="350" y="412" textAnchor="middle" fontSize="9" fontWeight="500" fill="#5c4a20" fontFamily="sans-serif">SOUTH STAND</text>

            {/* ── SOUTH FUTURE ── */}
            {['S1A','S2A','S3A'].map((sec, i) => (
              <g key={sec} style={{cursor:'pointer'}} onClick={() => setSelected(sec)}>
                <rect x={120+i*130} y="420" width="115" height="50" rx="8"
                  fill={sections[sec]?.capacity>0?'#d4a055':'url(#hatch)'}
                  fillOpacity={sections[sec]?.capacity>0?0.9:0.4}
                  stroke={selected===sec?teamColor:'#b0a898'}
                  strokeDasharray={selected===sec?'0':'6,3'}
                  strokeWidth={selected===sec?2:0.8}/>
                <text x={120+i*130+57} y="441" textAnchor="middle" fontSize="11" fontWeight="500" fill="#6b5f4e" fontFamily="sans-serif">{sec}</text>
                <text x={120+i*130+57} y="459" textAnchor="middle" fontSize="9" fill="#9a8a78" fontFamily="sans-serif">
                  {sections[sec]?.capacity>0 ? fmt(sections[sec].capacity) : '(future)'}
                </text>
              </g>
            ))}

            {/* ── COURT ── */}
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

          {/* Legend */}
          <div className="flex gap-4 mt-2" style={{fontSize:11,color:'#8a8279'}}>
            <div className="flex items-center gap-1.5">
              <div style={{width:14,height:10,borderRadius:2,background:'#8B6914'}}/>
              <span>Built</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div style={{width:14,height:10,borderRadius:2,background:'#e8e2d6',border:'1px dashed #b0a898'}}/>
              <span>Expandable</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div style={{width:14,height:10,borderRadius:2,background:'#378ADD'}}/>
              <span>Under construction</span>
            </div>
          </div>
        </div>

        {/* PANEL */}
        <div style={{width:220,flexShrink:0,background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-secondary)',borderRadius:12,padding:14,minHeight:180}}>
          {!selected ? (
            <p style={{fontSize:13,color:'var(--color-text-tertiary)',lineHeight:1.5}}>Click any section to view details and construction options.</p>
          ) : (
            <>
              <div style={{display:'inline-block',fontSize:10,padding:'2px 6px',borderRadius:4,marginBottom:8,
                background: isUnderConst ? '#dbeafe' : isBuilt ? '#dcfce7' : '#fef3c7',
                color: isUnderConst ? '#1d4ed8' : isBuilt ? '#15803d' : '#b45309'}}>
                {isUnderConst ? 'Under construction' : isBuilt ? 'Built' : 'Not built'}
              </div>
              <h3 style={{fontSize:14,fontWeight:500,color:'var(--color-text-primary)',marginBottom:2}}>{selected}</h3>
              <p style={{fontSize:11,color:'var(--color-text-secondary)',marginBottom:10}}>
                {isBuilt ? 'Existing section' : 'Future expansion'}
              </p>

              {[
                isBuilt && ['Current seats', fmt(sel?.capacity||0)],
                isBuilt && ['Upgrade adds', '+'+fmt(expansionSeats)],
                !isBuilt && ['New seats', '+'+fmt(expansionSeats)],
                ['Cost', fmtM(cost)],
                ['Duration', weeks+' weeks offline'],
                ['Revenue boost', '+$'+revBoost+'M/yr'],
              ].filter(Boolean).map((row:any) => (
                <div key={row[0]} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'0.5px solid var(--color-border-tertiary)',fontSize:12}}>
                  <span style={{color:'var(--color-text-secondary)'}}>{row[0]}</span>
                  <span style={{color:'var(--color-text-primary)',fontWeight:500}}>{row[1]}</span>
                </div>
              ))}

              {isGM && !isUnderConst && (
                <>
                  <button
                    onClick={handleBuildUpgrade}
                    disabled={!canAfford || building}
                    style={{width:'100%',marginTop:10,padding:'7px',fontSize:12,fontWeight:500,
                      border:'none',borderRadius:8,cursor:canAfford&&!building?'pointer':'not-allowed',
                      background:canAfford&&!building?'#b45309':'var(--color-background-secondary)',
                      color:canAfford&&!building?'#fef3c7':'var(--color-text-tertiary)'}}>
                    {building ? 'Processing...' : (isBuilt ? 'Upgrade — ' : 'Build — ') + fmtM(cost)}
                  </button>
                  {!canAfford && <p style={{fontSize:10,color:'#dc2626',marginTop:4}}>Insufficient funds</p>}
                </>
              )}
              {!isGM && <p style={{fontSize:11,color:'var(--color-text-tertiary)',marginTop:8}}>Only the GM can order construction.</p>}
              {msg && <p style={{fontSize:11,color:'#15803d',marginTop:6}}>{msg}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

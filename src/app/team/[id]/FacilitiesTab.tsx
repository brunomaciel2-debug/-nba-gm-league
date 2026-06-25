'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import ArenaView from './ArenaView'

type GymGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A'

type Facility = {
  id: string
  team_id: string
  gym_grade: GymGrade
  has_pool: boolean
  has_sauna: boolean
  has_shooting_machine: boolean
  has_film_room: boolean
  has_sports_lab: boolean
  gym_under_construction: boolean
  gym_upgrade_ends_at: string | null
  monthly_cost: number
}

const GYM_CONFIG: Record<GymGrade, {
  label: string, color: string, bg: string,
  speed: number, injury_recovery: number, injury_risk: number,
  fa_bonus: number, monthly_cost: number,
  unlocks: string[], description: string
}> = {
  F: { label:'Grade F', color:'#dc2626', bg:'#fee2e2', speed:5,  injury_recovery:-5,  injury_risk:0,   fa_bonus:0,  monthly_cost:50000,   unlocks:[], description:'Temporary rented facility. Shared space, no dedicated court.' },
  E: { label:'Grade E', color:'#b45309', bg:'#fef3c7', speed:7,  injury_recovery:0,   injury_risk:0,   fa_bonus:0,  monthly_cost:150000,  unlocks:[], description:'Entry-level NBA facility. Basic court and weight room.' },
  D: { label:'Grade D', color:'#ca8a04', bg:'#fefce8', speed:9,  injury_recovery:3,   injury_risk:0,   fa_bonus:0,  monthly_cost:300000,  unlocks:['Playmaking'], description:'Functional practice facility. 2 courts, video room, full weight room.' },
  C: { label:'Grade C', color:'#15803d', bg:'#dcfce7', speed:12, injury_recovery:7,   injury_risk:-5,  fa_bonus:0,  monthly_cost:600000,  unlocks:['Shooting Lab'], description:'Modern facility. 3 courts, advanced video analysis, physiotherapy.' },
  B: { label:'Grade B', color:'#1d4ed8', bg:'#dbeafe', speed:15, injury_recovery:13,  injury_risk:-10, fa_bonus:5,  monthly_cost:1200000, unlocks:['Mental'], description:'Elite facility. Hydrotherapy, cryotherapy, tracking technology.' },
  A: { label:'Grade A', color:'#6d28d9', bg:'#ede9fe', speed:19, injury_recovery:20,  injury_risk:-18, fa_bonus:12, monthly_cost:2500000, unlocks:['Analytics'], description:'World class campus. Olympic pool, biomechanics lab, full spa.' },
}

const UPGRADE_CONFIG: Partial<Record<GymGrade, { cost: number, weeks: number, nextGrade: GymGrade }>> = {
  F: { cost:5000000,   weeks:4,  nextGrade:'E' },
  E: { cost:12000000,  weeks:6,  nextGrade:'D' },
  D: { cost:25000000,  weeks:8,  nextGrade:'C' },
  C: { cost:50000000,  weeks:10, nextGrade:'B' },
  B: { cost:100000000, weeks:12, nextGrade:'A' },
}

const EXTRA_FACILITIES = [
  { key:'has_pool',             label:'Pool',             icon:'🏊', cost:8000000,  monthly:80000,  bonus:'Physical +3%/wk', description:'Olympic pool for hydrotherapy and physical recovery.' },
  { key:'has_sauna',            label:'Sauna',            icon:'🧖', cost:2000000,  monthly:20000,  bonus:'Physical +2%/wk', description:'Recovery sauna to reduce muscle fatigue.' },
  { key:'has_shooting_machine', label:'Shooting Machine', icon:'🎯', cost:5000000,  monthly:100000, bonus:'Offense & Shooting +4%/wk', description:'Automated shooting machine for repetition training.' },
  { key:'has_film_room',        label:'Film Room',        icon:'🎬', cost:3000000,  monthly:50000,  bonus:'Defense & Playmaking +3%/wk', description:'Advanced film room for tactical analysis.' },
  { key:'has_sports_lab',       label:'Sports Lab',       icon:'🔬', cost:15000000, monthly:200000, bonus:'Analytics +5%/wk', description:'Biomechanics and data analytics laboratory.' },
]

function fmtM(n: number) { return '$' + (n >= 1000000 ? (n/1e6).toFixed(0)+'M' : (n/1000).toFixed(0)+'K') }

export default function FacilitiesTab({ teamId, teamColor, arenaName, arenaCapacity, cash = 45000000 }: {
  teamId: string
  teamColor: string
  arenaName?: string
  arenaCapacity?: number
  cash?: number
}) {
  const { profile } = useAuth()
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [facility, setFacility] = useState<Facility | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'gym'|'arena'>('gym')
  const [upgrading, setUpgrading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('practice_facilities').select('*').eq('team_id', teamId).single()
      .then(({ data }) => { setFacility(data); setLoading(false) })
  }, [teamId])

  const handleUpgrade = async () => {
    if (!facility || !isGM) return
    const upg = UPGRADE_CONFIG[facility.gym_grade]
    if (!upg || cash < upg.cost) return
    setUpgrading(true)
    const endsAt = new Date()
    endsAt.setDate(endsAt.getDate() + upg.weeks * 7)
    await supabase.from('practice_facilities').update({
      gym_under_construction: true,
      gym_upgrade_ends_at: endsAt.toISOString().split('T')[0],
    }).eq('id', facility.id)
    setFacility(prev => prev ? { ...prev, gym_under_construction: true, gym_upgrade_ends_at: endsAt.toISOString().split('T')[0] } : prev)
    setMsg(`Upgrade to ${upg.nextGrade} started! Ready in ${upg.weeks} weeks.`)
    setUpgrading(false)
  }

  const handleBuildExtra = async (key: string, cost: number, monthly: number) => {
    if (!facility || !isGM || cash < cost) return
    await supabase.from('practice_facilities').update({ [key]: true, monthly_cost: facility.monthly_cost + monthly }).eq('id', facility.id)
    setFacility(prev => prev ? { ...prev, [key]: true, monthly_cost: prev.monthly_cost + monthly } : prev)
    setMsg('Facility built successfully!')
  }

  if (loading) return <div className="text-center py-8" style={{color:'#8a8279'}}>Loading facilities...</div>
  if (!facility) return null

  const cfg = GYM_CONFIG[facility.gym_grade]
  const upg = UPGRADE_CONFIG[facility.gym_grade]
  const canAfford = upg ? cash >= upg.cost : false
  const nextCfg = upg ? GYM_CONFIG[upg.nextGrade] : null

  // Calculate total slot speed boost from facilities
  const facilityBoosts = [
    facility.has_pool && '+3% Physical',
    facility.has_sauna && '+2% Physical',
    facility.has_shooting_machine && '+4% Offense & Shooting',
    facility.has_film_room && '+3% Defense & Playmaking',
    facility.has_sports_lab && '+5% Analytics',
  ].filter(Boolean)

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex gap-2 mb-5">
        {[{key:'gym',label:'🏋️ Practice Facility'},{key:'arena',label:'🏟️ Arena'}].map((v:any) => (
          <button key={v.key} onClick={() => setView(v.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: view===v.key ? teamColor : '#f0ece5',
              color: view===v.key ? '#fff' : '#5c554e',
              border: `1px solid ${view===v.key ? teamColor : '#d4cdc5'}`,
            }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ARENA VIEW */}
      {view === 'arena' && (
        <div className="rounded-xl p-4" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <ArenaView teamId={teamId} teamColor={teamColor}
            arenaName={arenaName||'Arena'} arenaCapacity={arenaCapacity||20000} cash={cash}/>
        </div>
      )}

      {/* GYM VIEW */}
      {view === 'gym' && (
        <div>
          {msg && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm font-semibold"
                 style={{background:'#dcfce7',color:'#15803d',border:'1px solid #bbf7d0'}}>
              {msg}
            </div>
          )}

          {/* Current gym */}
          <div className="rounded-xl p-5 mb-5"
               style={{background: facility.gym_under_construction ? '#dbeafe' : cfg.bg,
                       border:`1px solid ${facility.gym_under_construction ? '#93c5fd' : cfg.color}33`,
                       borderLeft:`4px solid ${facility.gym_under_construction ? '#1d4ed8' : cfg.color}`}}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-black" style={{color: facility.gym_under_construction ? '#1d4ed8' : cfg.color}}>
                    {facility.gym_under_construction ? '🚧' : '🏋️'}
                  </span>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest"
                         style={{color: facility.gym_under_construction ? '#1d4ed8' : cfg.color}}>
                      Practice Facility
                    </div>
                    <div className="text-lg font-black" style={{color:'#1a1512'}}>
                      {facility.gym_under_construction ? `Upgrading to ${upg?.nextGrade}...` : cfg.label}
                    </div>
                  </div>
                </div>
                <p className="text-sm mb-3" style={{color:'#5c554e'}}>{cfg.description}</p>

                {/* Stats row */}
                <div className="flex gap-4 flex-wrap">
                  {[
                    {label:'Slot speed',val:`+${cfg.speed}%/wk base`,color:cfg.color},
                    {label:'Injury recovery',val:cfg.injury_recovery>=0?`+${cfg.injury_recovery}%`:`${cfg.injury_recovery}%`,color:cfg.injury_recovery>=0?'#15803d':'#dc2626'},
                    {label:'Injury risk',val:cfg.injury_risk===0?'No change':`${cfg.injury_risk}%`,color:cfg.injury_risk<0?'#15803d':'#5c554e'},
                    {label:'FA attraction',val:cfg.fa_bonus>0?`+${cfg.fa_bonus}%`:'None',color:cfg.fa_bonus>0?'#15803d':'#8a8279'},
                    {label:'Monthly cost',val:fmtM(facility.monthly_cost),color:'#dc2626'},
                  ].map(item => (
                    <div key={item.label} className="px-3 py-2 rounded-lg" style={{background:'rgba(255,255,255,0.6)'}}>
                      <div className="text-xs" style={{color:'#8a8279'}}>{item.label}</div>
                      <div className="text-sm font-bold" style={{color:item.color}}>{item.val}</div>
                    </div>
                  ))}
                </div>

                {/* Unlocked slots */}
                {cfg.unlocks.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <span className="text-xs" style={{color:'#8a8279'}}>Unlocks:</span>
                    {cfg.unlocks.map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded font-semibold"
                            style={{background:cfg.color+'22',color:cfg.color}}>{s} slot</span>
                    ))}
                  </div>
                )}

                {/* Facility boosts */}
                {facilityBoosts.length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <span className="text-xs" style={{color:'#8a8279'}}>Active boosts:</span>
                    {facilityBoosts.map((b:any) => (
                      <span key={b} className="text-xs px-2 py-0.5 rounded font-semibold"
                            style={{background:'#dcfce7',color:'#15803d'}}>{b}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Upgrade panel */}
              {upg && nextCfg && !facility.gym_under_construction && (
                <div className="rounded-xl p-4 flex-shrink-0"
                     style={{background:'rgba(255,255,255,0.8)',border:'1px solid #d4cdc5',minWidth:200}}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e'}}>
                    Upgrade to {upg.nextGrade}
                  </div>
                  {[
                    {label:'Cost', val:fmtM(upg.cost)},
                    {label:'Duration', val:`${upg.weeks} weeks`},
                    {label:'New speed', val:`+${nextCfg.speed}%/wk`},
                    {label:'Unlocks', val:nextCfg.unlocks[0]||'—'},
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-xs py-1"
                         style={{borderBottom:'1px solid #e2dcd5'}}>
                      <span style={{color:'#8a8279'}}>{row.label}</span>
                      <span style={{color:'#1a1512',fontWeight:600}}>{row.val}</span>
                    </div>
                  ))}
                  {isGM && (
                    <button onClick={handleUpgrade} disabled={!canAfford||upgrading}
                      className="w-full mt-3 py-2 text-xs font-bold rounded-lg"
                      style={{
                        background: canAfford ? cfg.color : '#e2dcd5',
                        color: canAfford ? '#fff' : '#8a8279',
                        border:'none', cursor: canAfford?'pointer':'not-allowed'
                      }}>
                      {upgrading ? 'Processing...' : `Upgrade — ${fmtM(upg.cost)}`}
                    </button>
                  )}
                  {!canAfford && <p className="text-xs mt-1" style={{color:'#dc2626'}}>Insufficient funds</p>}
                </div>
              )}

              {facility.gym_under_construction && (
                <div className="rounded-xl p-4 flex-shrink-0"
                     style={{background:'#dbeafe',border:'1px solid #93c5fd',minWidth:180}}>
                  <div className="text-sm font-bold mb-1" style={{color:'#1d4ed8'}}>Under Construction</div>
                  <div className="text-xs" style={{color:'#5c554e'}}>
                    Ready: {facility.gym_upgrade_ends_at
                      ? new Date(facility.gym_upgrade_ends_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
                      : 'TBD'}
                  </div>
                  <p className="text-xs mt-2" style={{color:'#5c554e'}}>
                    Facility performance reduced during construction.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Extra facilities */}
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e',letterSpacing:'1px'}}>
            Additional Facilities
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EXTRA_FACILITIES.map(ef => {
              const built = (facility as any)[ef.key]
              return (
                <div key={ef.key} className="rounded-xl p-4"
                     style={{background: built ? '#f0fdf4' : '#faf8f5',
                             border:`1px solid ${built ? '#bbf7d0' : '#d4cdc5'}`,
                             borderTop:`3px solid ${built ? '#15803d' : '#d4cdc5'}`}}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{ef.icon}</span>
                    <div>
                      <div className="text-sm font-bold" style={{color:'#1a1512'}}>{ef.label}</div>
                      <div className="text-xs" style={{color:built?'#15803d':'#8a8279'}}>
                        {built ? '✓ Built' : 'Not built'}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs mb-3" style={{color:'#5c554e'}}>{ef.description}</p>
                  <div className="text-xs font-semibold mb-3 px-2 py-1 rounded"
                       style={{background:built?'#dcfce7':'#f0ece5',color:built?'#15803d':'#5c554e',display:'inline-block'}}>
                    {ef.bonus}
                  </div>
                  {!built && (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs" style={{color:'#8a8279'}}>Cost: <strong>{fmtM(ef.cost)}</strong></div>
                        <div className="text-xs" style={{color:'#8a8279'}}>Monthly: <strong>{fmtM(ef.monthly)}</strong></div>
                      </div>
                      {isGM && (
                        <button onClick={() => handleBuildExtra(ef.key, ef.cost, ef.monthly)}
                          disabled={cash < ef.cost}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg"
                          style={{
                            background: cash >= ef.cost ? teamColor : '#e2dcd5',
                            color: cash >= ef.cost ? '#fff' : '#8a8279',
                            border:'none', cursor: cash>=ef.cost?'pointer':'not-allowed'
                          }}>
                          Build
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

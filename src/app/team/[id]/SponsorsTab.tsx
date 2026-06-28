'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Template = {
  id: string
  tier: string
  company_name: string
  sector: string
  logo_url: string | null
  fixed_annual: number
  variable_max: number
}

type Objective = {
  id: string
  template_id: string
  description: string
  bonus_amount: number
  objective_type: string
  threshold: number
}

type Contract = {
  id: string
  template_id: string
  tier: string
  fixed_monthly: number
  status: string
  signed_at: string
  template?: Template
  objectives?: ObjectiveTracking[]
}

type ObjectiveTracking = {
  id: string
  objective_id: string
  achieved: boolean
  current_value: number
  paid: boolean
  objective?: Objective
}

type JerseyImage = {
  id: string
  team_id: string
  option_number: number
  company_name: string
  jersey_url: string
}

type PoolEntry = {
  id: string
  template_id: string
  tier: string
  chosen: boolean
  template?: Template
  objectives?: Objective[]
}

const TIER_CONFIG = {
  jersey: {
    label: 'Jersey Patch',
    icon: '👕',
    color: '#1d4ed8',
    bg: '#dbeafe',
    desc: 'Logo on team jersey — visible in all games, broadcasts and media',
    impact: 'Highest visibility · Brand on every player',
  },
  court: {
    label: 'Court Logo',
    icon: '🏀',
    color: '#b45309',
    bg: '#fef3c7',
    desc: 'Logo painted at centre court — permanent camera focus',
    impact: 'High visibility · Every broadcast angle',
  },
  panels: {
    label: 'Courtside Panels',
    icon: '📺',
    color: '#15803d',
    bg: '#dcfce7',
    desc: 'Rotating electronic panels around the court perimeter',
    impact: 'Moderate visibility · Game-day exposure',
  },
}

const OBJECTIVE_ICONS: Record<string, string> = {
  wins_total:           '🏆',
  wins_streak:          '🔥',
  wins_home_streak:     '🏠',
  wins_rivalry:         '⚔️',
  wins_vs_top5:         '💪',
  attendance_avg:       '👥',
  attendance_pct_games: '📊',
  attendance_suites:    '🏢',
  ppg_avg:              '🎯',
  win_margin:           '💥',
  top_scorer_count:     '⭐',
  player_ovr_improvement:'📈',
  player_allstar:       '🌟',
  player_allstar_ballot:'🗳️',
  player_allnba:        '🏅',
  gleague_callup_games: '⬆️',
  no_major_injury:      '💊',
  reach_playoffs:       '🎮',
  reach_conf_finals:    '🥈',
  reach_finals:         '🥇',
  champion:             '🏆',
  top_conference:       '📍',
  top_division:         '📍',
  cap_utilization:      '💰',
  fan_satisfaction:     '😊',
  jumbotron_built:      '📺',
  special_events:       '🎉',
  national_broadcasts:  '📡',
  viral_highlights:     '🎬',
}

function fmt(n: number) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M'
  if (n >= 1000) return '$' + (n/1000).toFixed(0) + 'K'
  return '$' + n
}

type TipProps = { text: string, children: React.ReactNode }
function Tip({ text, children }: TipProps) {
  const [show, setShow] = useState(false)
  return (
    <span style={{position:'relative',display:'inline-flex'}}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show && (
        <span style={{
          position:'absolute',bottom:'calc(100% + 6px)',left:'50%',
          transform:'translateX(-50%)',zIndex:200,
          background:'#1a1512',color:'#f5f1eb',fontSize:11,
          padding:'6px 10px',borderRadius:6,whiteSpace:'nowrap',
          boxShadow:'0 4px 12px rgba(0,0,0,0.3)',
          border:'1px solid rgba(255,255,255,0.1)',
          pointerEvents:'none',
        }}>{text}</span>
      )}
    </span>
  )
}

function ObjectiveRow({ obj, tracking, rivalName }: { obj: Objective, tracking?: ObjectiveTracking, rivalName?: string }) {
  const achieved = tracking?.achieved || false
  const paid = tracking?.paid || false
  const icon = OBJECTIVE_ICONS[obj.objective_type] || '🎯'
  // Replace generic rival reference with actual rival name
  const description = rivalName && obj.objective_type === 'wins_rivalry'
    ? obj.description.replace(/your divisional rival|your rival/gi, rivalName)
    : obj.description

  return (
    <div style={{
      display:'flex',alignItems:'center',gap:10,
      padding:'8px 10px',borderRadius:8,
      background: achieved ? '#f0fdf4' : '#faf8f5',
      border: `1px solid ${achieved ? '#bbf7d0' : '#e2dcd5'}`,
    }}>
      <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color:achieved?'#15803d':'#1a1512',fontWeight:achieved?600:400}}>
          {description}
        </div>
        {tracking && !achieved && tracking.current_value > 0 && (
          <div style={{fontSize:10,color:'#8a8279',marginTop:2}}>
            Progress: {tracking.current_value}{obj.threshold ? ` / ${obj.threshold}` : ''}
          </div>
        )}
      </div>
      <div style={{textAlign:'right',flexShrink:0}}>
        <div style={{fontSize:12,fontWeight:700,color:achieved?'#15803d':'#5c554e'}}>
          {fmt(obj.bonus_amount)}
        </div>
        {achieved && (
          <div style={{fontSize:9,color:paid?'#15803d':'#b45309',fontWeight:600}}>
            {paid ? '✓ Paid' : '⏳ Pending'}
          </div>
        )}
      </div>
    </div>
  )
}

function JerseyPreview({ jerseyUrl, companyName }: { jerseyUrl: string, companyName: string }) {
  const [zoomed, setZoomed] = useState(false)
  return (
    <>
      {/* Thumbnail */}
      <div
        onClick={() => setZoomed(true)}
        style={{
          marginBottom:12, borderRadius:8, border:'1px solid #e2dcd5',
          background:'#f5f1eb', textAlign:'center', padding:8,
          cursor:'zoom-in', position:'relative',
        }}>
        <img src={jerseyUrl} alt="Jersey preview"
          style={{height:120, objectFit:'contain', display:'block', margin:'0 auto'}}/>
        <div style={{fontSize:9,color:'#8a8279',marginTop:4}}>
          🔍 Click to enlarge
        </div>
      </div>

      {/* Lightbox */}
      {zoomed && (
        <div
          onClick={() => setZoomed(false)}
          style={{
            position:'fixed', inset:0, zIndex:1000,
            background:'rgba(0,0,0,0.75)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'zoom-out',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#faf8f5', borderRadius:16, padding:24,
              boxShadow:'0 24px 64px rgba(0,0,0,0.4)',
              display:'flex', flexDirection:'column', alignItems:'center', gap:12,
              maxWidth:'90vw', maxHeight:'90vh',
            }}>
            <img src={jerseyUrl} alt={companyName}
              style={{maxHeight:'70vh', maxWidth:'80vw', objectFit:'contain', borderRadius:8}}/>
            <div style={{fontSize:13, fontWeight:600, color:'#1a1512'}}>{companyName}</div>
            <div style={{fontSize:11, color:'#8a8279'}}>Jersey sponsor patch preview</div>
            <button
              onClick={() => setZoomed(false)}
              style={{
                padding:'6px 20px', fontSize:12, fontWeight:600,
                border:'1px solid #d4cdc5', borderRadius:8,
                background:'#f0ece5', color:'#5c554e', cursor:'pointer',
              }}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function SponsorImagePreview({ jerseyUrl, companyName, label, aspect }: { jerseyUrl: string, companyName: string, label: string, aspect: string }) {
  const [zoomed, setZoomed] = useState(false)
  return (
    <>
      <div onClick={() => setZoomed(true)} style={{
        marginBottom:12, borderRadius:8, border:'1px solid #e2dcd5',
        background:'#f5f1eb', textAlign:'center', padding:8, cursor:'zoom-in',
      }}>
        <div style={{aspectRatio:aspect, overflow:'hidden', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <img src={jerseyUrl} alt={companyName} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}}/>
        </div>
        <div style={{fontSize:9, color:'#8a8279', marginTop:4}}>🔍 Click to enlarge</div>
      </div>
      {zoomed && (
        <div onClick={() => setZoomed(false)} style={{
          position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'#faf8f5', borderRadius:16, padding:24,
            boxShadow:'0 24px 64px rgba(0,0,0,0.4)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:12,
            maxWidth:'90vw',
          }}>
            <img src={jerseyUrl} alt={companyName} style={{maxHeight:'70vh', maxWidth:'80vw', objectFit:'contain', borderRadius:8}}/>
            <div style={{fontSize:13, fontWeight:600, color:'#1a1512'}}>{companyName}</div>
            <div style={{fontSize:11, color:'#8a8279'}}>{label}</div>
            <button onClick={() => setZoomed(false)} style={{
              padding:'6px 20px', fontSize:12, fontWeight:600,
              border:'1px solid #d4cdc5', borderRadius:8,
              background:'#f0ece5', color:'#5c554e', cursor:'pointer',
            }}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}

function SponsorCard({
  entry, objectives, isGM, teamColor, onSign, signing, hasContract, jerseyUrl, rivalName
}: {
  entry: PoolEntry
  objectives: Objective[]
  isGM: boolean
  teamColor: string
  onSign: (poolId: string, templateId: string, tier: string, fixedMonthly: number) => void
  signing: boolean
  hasContract: boolean
  jerseyUrl?: string
  rivalName?: string
}) {
  const t = entry.template!
  const tier = TIER_CONFIG[entry.tier as keyof typeof TIER_CONFIG]
  const fixedMonthly = Math.round(t.fixed_annual / 12)

  return (
    <div style={{
      background:'#faf8f5',
      border: `1px solid ${entry.chosen ? tier.color : '#d4cdc5'}`,
      borderTop: `3px solid ${entry.chosen ? tier.color : '#d4cdc5'}`,
      borderRadius:12, padding:16,
      opacity: hasContract && !entry.chosen ? 0.5 : 1,
    }}>
      {/* Sponsor image preview — all tiers */}
      {jerseyUrl && entry.tier === 'jersey' && (
        <JerseyPreview jerseyUrl={jerseyUrl} companyName={t.company_name} />
      )}
      {jerseyUrl && entry.tier === 'court' && (
        <SponsorImagePreview jerseyUrl={jerseyUrl} companyName={t.company_name} label="Court logo preview" aspect="3/2"/>
      )}
      {jerseyUrl && entry.tier === 'panels' && (
        <SponsorImagePreview jerseyUrl={jerseyUrl} companyName={t.company_name} label="Courtside panel preview" aspect="4/1"/>
      )}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
        {t.logo_url ? (
          <img src={t.logo_url} alt={t.company_name} style={{width:40,height:40,objectFit:'contain',borderRadius:6,border:'1px solid #e2dcd5'}}/>
        ) : (
          <div style={{width:40,height:40,borderRadius:6,background:tier.bg,border:`1px solid ${tier.color}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
            {tier.icon}
          </div>
        )}
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:'#1a1512'}}>{t.company_name}</div>
        </div>
        {entry.chosen && (
          <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:tier.color,color:'#fff'}}>
            ✓ Active
          </span>
        )}
      </div>

      {/* Financials */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        <Tip text="Guaranteed fixed payment regardless of performance">
          <div style={{background:tier.bg,borderRadius:8,padding:'8px 10px',cursor:'help',width:'100%'}}>
            <div style={{fontSize:9,color:tier.color,fontWeight:600,marginBottom:2}}>FIXED / YEAR</div>
            <div style={{fontSize:16,fontWeight:800,color:tier.color}}>{fmt(t.fixed_annual)}</div>
            <div style={{fontSize:10,color:tier.color+'99'}}>{fmt(fixedMonthly)}/mo</div>
          </div>
        </Tip>
        <Tip text="Maximum bonus if all objectives are achieved">
          <div style={{background:'#f0ece5',borderRadius:8,padding:'8px 10px',cursor:'help',width:'100%'}}>
            <div style={{fontSize:9,color:'#5c554e',fontWeight:600,marginBottom:2}}>VARIABLE MAX</div>
            <div style={{fontSize:16,fontWeight:800,color:'#5c554e'}}>{fmt(t.variable_max)}</div>
            <div style={{fontSize:10,color:'#8a8279'}}>by objectives</div>
          </div>
        </Tip>
      </div>

      {/* Total potential */}
      <Tip text="Fixed + all bonuses if every objective is met">
        <div style={{
          display:'flex',justifyContent:'space-between',alignItems:'center',
          padding:'6px 10px',borderRadius:6,marginBottom:12,cursor:'help',
          background:'rgba(0,0,0,0.03)',border:'1px solid #e2dcd5',
        }}>
          <span style={{fontSize:11,color:'#8a8279'}}>Total potential</span>
          <span style={{fontSize:13,fontWeight:700,color:'#1a1512'}}>{fmt(t.fixed_annual + t.variable_max)}</span>
        </div>
      </Tip>

      {/* Objectives */}
      <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:6}}>
        Bonus Objectives
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:isGM && !hasContract ? 12 : 0}}>
        {objectives.map(obj => (
          <ObjectiveRow key={obj.id} obj={obj} rivalName={rivalName}/>
        ))}
      </div>

      {/* Sign button */}
      {isGM && !hasContract && !entry.chosen && (
        <button onClick={()=>onSign(entry.id, t.id, entry.tier, fixedMonthly)}
          disabled={signing}
          style={{
            width:'100%',padding:'9px',fontSize:12,fontWeight:700,
            border:'none',borderRadius:8,cursor:signing?'not-allowed':'pointer',
            background:signing?'#e2dcd5':tier.color,
            color:signing?'#8a8279':'#fff',
            marginTop:12,
          }}>
          {signing ? 'Signing...' : `Sign Contract — ${fmt(fixedMonthly)}/mo`}
        </button>
      )}
    </div>
  )
}

export default function SponsorsTab({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const { profile } = useAuth()
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [pool, setPool] = useState<PoolEntry[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [jerseys, setJerseys] = useState<JerseyImage[]>([])
  const [rivalName, setRivalName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [msg, setMsg] = useState('')
  const [activeTier, setActiveTier] = useState<'jersey'|'court'|'panels'>('jersey')

  useEffect(() => {
    Promise.all([
      supabase.from('sponsor_pool')
        .select('*, template:sponsor_templates(*)')
        .eq('team_id', teamId).eq('season','2025-26'),
      supabase.from('sponsor_contracts')
        .select('*, template:sponsor_templates(*)')
        .eq('team_id', teamId).eq('season','2025-26').eq('status','active'),
      supabase.from('sponsor_objectives').select('*'),
      supabase.from('sponsor_jersey_images')
        .select('*').eq('team_id', teamId).eq('season','2025-26'),
    ]).then(([{data:p},{data:c},{data:o},{data:j}]) => {
      setPool(p || [])
      setContracts(c || [])
      setObjectives(o || [])
      setJerseys(j || [])
      setLoading(false)
    })

    // Fetch rival name
    supabase.from('teams').select('rival_team_id').eq('id', teamId).single()
      .then(({ data: t }) => {
        if (t?.rival_team_id) {
          supabase.from('teams').select('name').eq('id', t.rival_team_id).single()
            .then(({ data: r }) => { if (r?.name) setRivalName(r.name) })
        }
      })
  }, [teamId])

  const handleSign = async (poolId: string, templateId: string, tier: string, fixedMonthly: number) => {
    if (!isGM) return
    setSigning(true); setMsg('')

    // Create contract
    const { data: contract } = await supabase.from('sponsor_contracts').insert({
      team_id: teamId,
      template_id: templateId,
      tier,
      fixed_monthly: fixedMonthly,
      status: 'active',
      season: '2025-26',
    }).select().single()

    // Mark pool entry as chosen
    await supabase.from('sponsor_pool').update({ chosen: true }).eq('id', poolId)

    // Create objective tracking entries
    const tierObjectives = objectives.filter(o => o.template_id === templateId)
    if (tierObjectives.length && contract) {
      await supabase.from('sponsor_objective_tracking').insert(
        tierObjectives.map(o => ({
          contract_id: contract.id,
          objective_id: o.id,
          team_id: teamId,
          season: '2025-26',
          achieved: false,
          current_value: 0,
          paid: false,
        }))
      )
    }

    // Add first month to finances
    await supabase.from('franchise_transactions').insert({
      team_id: teamId,
      type: 'revenue',
      category: 'sponsor',
      amount: fixedMonthly,
      description: `Sponsor signing bonus — ${tier} contract`,
      season: '2025-26',
      week_number: 1,
    })

    // Update balance
    await supabase.rpc('increment_balance', { p_team_id: teamId, p_amount: fixedMonthly })

    setPool(prev => prev.map(e => e.id === poolId ? { ...e, chosen: true } : e))
    setContracts(prev => [...prev, { ...contract, tier, fixed_monthly: fixedMonthly, status: 'active', signed_at: new Date().toISOString() }])
    setMsg(`Contract signed! ${fmt(fixedMonthly)}/month added to your balance.`)
    setSigning(false)
  }

  if (loading) return <div style={{color:'#8a8279',padding:20}}>Loading sponsors...</div>

  const tiers: ('jersey'|'court'|'panels')[] = ['jersey','court','panels']

  return (
    <div>
      {msg && (
        <div style={{marginBottom:14,padding:'8px 12px',background:'#dcfce7',color:'#15803d',borderRadius:8,fontSize:12,fontWeight:600,border:'1px solid #bbf7d0'}}>
          ✓ {msg}
        </div>
      )}

      {/* Active contracts summary */}
      {contracts.length > 0 && (
        <div style={{marginBottom:16,padding:'12px 16px',background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:10}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:8}}>
            Active Contracts
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {contracts.map(c=>{
              const tier = TIER_CONFIG[c.tier as keyof typeof TIER_CONFIG]
              const template = pool.find(p=>p.template_id===c.template_id)?.template
              return (
                <div key={c.id} style={{
                  display:'flex',alignItems:'center',gap:8,padding:'6px 12px',
                  borderRadius:8,background:tier.bg,border:`1px solid ${tier.color}44`,
                }}>
                  <span style={{fontSize:14}}>{tier.icon}</span>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:tier.color}}>{template?.company_name||'—'}</div>
                    <div style={{fontSize:10,color:tier.color+'99'}}>{fmt(c.fixed_monthly)}/mo · {tier.label}</div>
                  </div>
                </div>
              )
            })}
            <Tip text="Total guaranteed monthly income from all active sponsors">
              <div style={{
                display:'flex',alignItems:'center',gap:6,padding:'6px 12px',
                borderRadius:8,background:'#f0ece5',border:'1px solid #d4cdc5',cursor:'help',
              }}>
                <span style={{fontSize:11,color:'#5c554e'}}>Monthly income:</span>
                <span style={{fontSize:13,fontWeight:700,color:'#15803d'}}>
                  {fmt(contracts.reduce((t,c)=>t+c.fixed_monthly,0))}
                </span>
              </div>
            </Tip>
          </div>
        </div>
      )}

      {/* Tier tabs */}
      <div style={{display:'flex',gap:6,marginBottom:16,borderBottom:'2px solid #e2dcd5'}}>
        {tiers.map(tier=>{
          const cfg = TIER_CONFIG[tier]
          const hasContract = contracts.some(c=>c.tier===tier)
          return (
            <button key={tier} onClick={()=>setActiveTier(tier)}
              style={{
                padding:'8px 16px',fontSize:12,fontWeight:600,
                border:'none',borderBottom:`3px solid ${activeTier===tier?teamColor:'transparent'}`,
                background:'transparent',cursor:'pointer',marginBottom:-2,
                color:activeTier===tier?teamColor:'#8a8279',
                display:'flex',alignItems:'center',gap:6,
              }}>
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              {hasContract && <span style={{width:6,height:6,borderRadius:3,background:'#15803d',display:'inline-block'}}/>}
            </button>
          )
        })}
      </div>

      {/* Tier description */}
      {(() => {
        const cfg = TIER_CONFIG[activeTier]
        return (
          <div style={{
            display:'flex',alignItems:'center',gap:10,
            padding:'8px 14px',borderRadius:8,marginBottom:14,
            background:cfg.bg,border:`1px solid ${cfg.color}33`,
          }}>
            <span style={{fontSize:20}}>{cfg.icon}</span>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:cfg.color}}>{cfg.desc}</div>
              <div style={{fontSize:11,color:cfg.color+'99'}}>{cfg.impact}</div>
            </div>
          </div>
        )
      })()}

      {/* Sponsor cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
        {pool
          .filter(e => e.tier === activeTier)
          .map((entry, idx) => {
            const entryObjectives = objectives.filter(o => o.template_id === entry.template_id)
            const hasContract = contracts.some(c => c.tier === activeTier)
            const sponsorImg = jerseys.find(j => j.option_number === idx + 1 && j.tier === activeTier)
            return (
              <SponsorCard
                key={entry.id}
                entry={entry}
                objectives={entryObjectives}
                isGM={isGM}
                teamColor={teamColor}
                onSign={handleSign}
                signing={signing}
                hasContract={hasContract}
                jerseyUrl={sponsorImg?.jersey_url}
                rivalName={rivalName}
              />
            )
          })
        }
      </div>

      {!isGM && (
        <div style={{marginTop:16,padding:'10px 14px',background:'#f0ece5',borderRadius:8,fontSize:11,color:'#8a8279'}}>
          🔒 Sponsor contracts and financial details are private to the franchise GM.
        </div>
      )}
    </div>
  )
}

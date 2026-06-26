'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Objective = {
  id: string
  description: string
  bonus_amount: number
  objective_type: string
  threshold: number
}

type Tracking = {
  id: string
  objective_id: string
  achieved: boolean
  current_value: number
  paid: boolean
  achieved_at: string | null
  objective?: Objective
}

type Contract = {
  id: string
  tier: string
  fixed_monthly: number
  template?: { company_name: string, sector: string }
  trackings?: Tracking[]
}

const TIER_CONFIG: Record<string, { label: string, icon: string, color: string, bg: string }> = {
  jersey:  { label: 'Jersey Patch',      icon: '👕', color: '#1d4ed8', bg: '#dbeafe' },
  court:   { label: 'Court Logo',        icon: '🏀', color: '#b45309', bg: '#fef3c7' },
  panels:  { label: 'Courtside Panels',  icon: '📺', color: '#15803d', bg: '#dcfce7' },
}

const OBJECTIVE_ICONS: Record<string, string> = {
  wins_total:           '🏆',
  wins_streak:          '🔥',
  wins_home_streak:     '🏠',
  wins_home_total:      '🏠',
  wins_rivalry:         '⚔️',
  wins_vs_top5:         '💪',
  wins_by_double_digits:'💥',
  win_margin:           '💥',
  attendance_avg:       '👥',
  top_conference:       '📍',
  top_division:         '📍',
  ppg_avg:              '🎯',
  top_scorer_count:     '⭐',
  player_ovr_improvement:'📈',
  player_allstar:       '🌟',
  no_major_injury:      '💊',
  reach_playoffs:       '🎮',
  reach_conf_finals:    '🥈',
  reach_finals:         '🥇',
  champion:             '🏆',
  cap_utilization:      '💰',
  fan_satisfaction:     '😊',
  jumbotron_built:      '📺',
  concessions_built:    '🍔',
}

function fmt(n: number) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M'
  if (n >= 1000) return '$' + (n/1000).toFixed(0) + 'K'
  return '$' + n
}

function ProgressBar({ current, threshold, achieved }: { current: number, threshold: number, achieved: boolean }) {
  if (!threshold) return null
  const pct = Math.min(100, Math.round((current / threshold) * 100))
  return (
    <div style={{marginTop:6}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#8a8279',marginBottom:3}}>
        <span>{current} / {threshold}</span>
        <span>{pct}%</span>
      </div>
      <div style={{height:5,borderRadius:3,background:'#e2dcd5',overflow:'hidden'}}>
        <div style={{
          height:'100%', borderRadius:3,
          width:`${pct}%`,
          background: achieved ? '#15803d' : pct >= 75 ? '#b45309' : '#3b82f6',
          transition:'width 0.3s',
        }}/>
      </div>
    </div>
  )
}

export default function GoalsTab({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const { profile } = useAuth()
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [contracts, setContracts] = useState<Contract[]>([])
  const [rivalName, setRivalName] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'achieved'>('all')

  useEffect(() => {
    Promise.all([
      supabase.from('sponsor_contracts')
        .select(`
          id, tier, fixed_monthly, status,
          template:sponsor_templates(company_name, sector),
          trackings:sponsor_objective_tracking(
            id, objective_id, achieved, current_value, paid, achieved_at,
            objective:sponsor_objectives(id, description, bonus_amount, objective_type, threshold)
          )
        `)
        .eq('team_id', teamId)
        .eq('season', '2025-26')
        .eq('status', 'active'),
      supabase.from('teams').select('rival_team_id').eq('id', teamId).single(),
    ]).then(([{ data: c }, { data: t }]) => {
      setContracts(c || [])
      if (t?.rival_team_id) {
        supabase.from('teams').select('name').eq('id', t.rival_team_id).single()
          .then(({ data: r }) => { if (r?.name) setRivalName(r.name) })
      }
      setLoading(false)
    })
  }, [teamId])

  if (!isGM) return (
    <div style={{padding:40,textAlign:'center',color:'#b0a89e',fontSize:13}}>
      🔒 Goals are private to the franchise GM.
    </div>
  )

  if (loading) return <div style={{color:'#8a8279',padding:20}}>Loading goals...</div>

  if (!contracts.length) return (
    <div style={{padding:48,textAlign:'center',background:'#faf8f5',border:'1px dashed #d4cdc5',borderRadius:12}}>
      <div style={{fontSize:32,marginBottom:12}}>🎯</div>
      <div style={{fontSize:14,fontWeight:700,color:'#1a1512',marginBottom:6}}>No active sponsor contracts</div>
      <div style={{fontSize:12,color:'#8a8279'}}>Sign sponsor deals in the Sponsors tab to unlock objectives.</div>
    </div>
  )

  // Flatten all trackings for summary
  const allTrackings = contracts.flatMap(c => c.trackings || [])
  const totalGoals = allTrackings.length
  const achievedGoals = allTrackings.filter(t => t.achieved).length
  const pendingGoals = totalGoals - achievedGoals
  const totalPotential = allTrackings.reduce((s, t) => s + (t.objective?.bonus_amount || 0), 0)
  const earnedBonus = allTrackings.filter(t => t.achieved).reduce((s, t) => s + (t.objective?.bonus_amount || 0), 0)
  const monthlyFixed = contracts.reduce((s, c) => s + c.fixed_monthly, 0)

  return (
    <div>
      {/* Summary header */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
        {[
          { label:'Monthly fixed',     val:fmt(monthlyFixed),         color:'#15803d', tip:'Guaranteed monthly income from all active contracts' },
          { label:'Bonus potential',   val:fmt(totalPotential),       color:'#1d4ed8', tip:'Maximum bonus if all objectives are achieved' },
          { label:'Bonus earned',      val:fmt(earnedBonus),          color:'#b45309', tip:'Bonuses already achieved and credited' },
          { label:'Goals progress',    val:`${achievedGoals}/${totalGoals}`, color:teamColor, tip:'Objectives achieved vs total' },
        ].map(item => (
          <div key={item.label} style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${item.color}`,borderRadius:10,padding:12}}>
            <div style={{fontSize:10,color:'#8a8279',marginBottom:4}}>{item.label}</div>
            <div style={{fontSize:18,fontWeight:800,color:item.color}}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {([['all','All'],['pending','Pending'],['achieved','Achieved']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{
              padding:'5px 14px', fontSize:11, fontWeight:600, borderRadius:20, cursor:'pointer',
              border:`1px solid ${filter===k ? teamColor : '#d4cdc5'}`,
              background: filter===k ? teamColor : '#f0ece5',
              color: filter===k ? '#fff' : '#5c554e',
            }}>
            {l} {k==='pending'&&pendingGoals>0&&`(${pendingGoals})`}
            {k==='achieved'&&achievedGoals>0&&`(${achievedGoals})`}
          </button>
        ))}
      </div>

      {/* Contracts & objectives */}
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {contracts.map(contract => {
          const tier = TIER_CONFIG[contract.tier] || TIER_CONFIG.panels
          const trackings = (contract.trackings || []).filter(t => {
            if (filter === 'pending') return !t.achieved
            if (filter === 'achieved') return t.achieved
            return true
          })
          if (!trackings.length) return null

          return (
            <div key={contract.id} style={{background:'#faf8f5',border:`1px solid ${tier.color}33`,borderTop:`3px solid ${tier.color}`,borderRadius:12,overflow:'hidden'}}>
              {/* Contract header */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:tier.bg+'66',borderBottom:`1px solid ${tier.color}22`}}>
                <span style={{fontSize:20}}>{tier.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1a1512'}}>{(contract.template as any)?.company_name || '—'}</div>
                  <div style={{fontSize:11,color:'#8a8279'}}>{tier.label} · {fmt(contract.fixed_monthly)}/mo guaranteed</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,color:'#8a8279'}}>Objectives</div>
                  <div style={{fontSize:13,fontWeight:700,color:tier.color}}>
                    {(contract.trackings||[]).filter(t=>t.achieved).length}/{(contract.trackings||[]).length}
                  </div>
                </div>
              </div>

              {/* Objectives list */}
              <div style={{padding:'10px 16px',display:'flex',flexDirection:'column',gap:8}}>
                {trackings.map(tracking => {
                  const obj = tracking.objective
                  if (!obj) return null
                  const icon = OBJECTIVE_ICONS[obj.objective_type] || '🎯'
                  const desc = rivalName && obj.objective_type === 'wins_rivalry'
                    ? obj.description.replace(/your divisional rival|your rival/gi, rivalName)
                    : obj.description
                  const showProgress = !tracking.achieved && tracking.current_value > 0 && obj.threshold > 1

                  return (
                    <div key={tracking.id} style={{
                      display:'flex', alignItems:'flex-start', gap:10,
                      padding:'10px 12px', borderRadius:8,
                      background: tracking.achieved ? '#f0fdf4' : '#ffffff',
                      border: `1px solid ${tracking.achieved ? '#bbf7d0' : '#e2dcd5'}`,
                    }}>
                      {/* Status icon */}
                      <div style={{
                        width:28, height:28, borderRadius:8, flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background: tracking.achieved ? '#dcfce7' : '#f0ece5',
                        fontSize:14,
                      }}>
                        {tracking.achieved ? '✓' : icon}
                      </div>

                      <div style={{flex:1,minWidth:0}}>
                        <div style={{
                          fontSize:12, fontWeight: tracking.achieved ? 600 : 400,
                          color: tracking.achieved ? '#15803d' : '#1a1512',
                          lineHeight:1.4,
                        }}>
                          {desc}
                        </div>
                        {showProgress && (
                          <ProgressBar
                            current={tracking.current_value}
                            threshold={obj.threshold}
                            achieved={tracking.achieved}
                          />
                        )}
                        {tracking.achieved && tracking.achieved_at && (
                          <div style={{fontSize:10,color:'#15803d',marginTop:3}}>
                            ✓ Achieved {new Date(tracking.achieved_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                            {tracking.paid && ' · Credited'}
                          </div>
                        )}
                      </div>

                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:12,fontWeight:700,color: tracking.achieved ? '#15803d' : '#5c554e'}}>
                          {fmt(obj.bonus_amount)}
                        </div>
                        {tracking.achieved && (
                          <div style={{fontSize:9,fontWeight:600,color: tracking.paid ? '#15803d' : '#b45309'}}>
                            {tracking.paid ? '✓ Paid' : '⏳ Pending'}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

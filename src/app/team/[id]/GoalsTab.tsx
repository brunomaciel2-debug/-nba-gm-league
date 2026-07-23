'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import { translateObjectiveDescription, RIVAL_PLACEHOLDER_PATTERN } from '@/lib/sponsor-objective-i18n'

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
  objective?: Objective | Objective[]
}

type Contract = {
  id: string
  tier: string
  template_id: string
  fixed_monthly: number
  template?: { company_name: string, sector: string } | { company_name: string, sector: string }[]
  trackings?: Tracking[]
}

type PoolEntry = { tier: string, template_id: string }
type JerseyImage = { option_number: number, tier: string, company_name: string }

const TIER_CONFIG_EN: Record<string, { label: string, icon: string, color: string, bg: string }> = {
  jersey:  { label: 'Jersey Patch',      icon: '👕', color: '#1d4ed8', bg: '#dbeafe' },
  court:   { label: 'Court Logo',        icon: '🏀', color: '#b45309', bg: '#fef3c7' },
  panels:  { label: 'Courtside Panels',  icon: '📺', color: '#15803d', bg: '#dcfce7' },
}
const TIER_CONFIG_PT: Record<string, { label: string, icon: string, color: string, bg: string }> = {
  jersey:  { label: 'Patch da Camisola', icon: '👕', color: '#1d4ed8', bg: '#dbeafe' },
  court:   { label: 'Logótipo do Campo', icon: '🏀', color: '#b45309', bg: '#fef3c7' },
  panels:  { label: 'Painéis Courtside', icon: '📺', color: '#15803d', bg: '#dcfce7' },
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
  fan_satisfaction:     '😊',
  jumbotron_built:      '📺',
  concessions_built:    '🍔',
}

function fmt(n: number) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M'
  if (n >= 1000) return '$' + (n/1000).toFixed(0) + 'K'
  return '$' + n
}

// Supabase returns joined records as arrays or objects depending on relation type
function getTemplate(c: Contract): { company_name: string, sector: string } | null {
  if (!c.template) return null
  return Array.isArray(c.template) ? c.template[0] : c.template
}

function getObjective(t: Tracking): Objective | null {
  if (!t.objective) return null
  return Array.isArray(t.objective) ? t.objective[0] : t.objective
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
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const TIER_CONFIG = isPT ? TIER_CONFIG_PT : TIER_CONFIG_EN
  const { profile } = useAuth()
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [contracts, setContracts] = useState<Contract[]>([])
  const [pool, setPool] = useState<PoolEntry[]>([])
  const [jerseys, setJerseys] = useState<JerseyImage[]>([])
  const [rivalName, setRivalName] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'achieved'>('all')

  useEffect(() => {
    Promise.all([
      supabase.from('sponsor_contracts')
        .select(`
          id, tier, template_id, fixed_monthly, status,
          template:sponsor_templates(company_name, sector),
          trackings:sponsor_objective_tracking(
            id, objective_id, achieved, current_value, paid, achieved_at,
            objective:sponsor_objectives(id, description, bonus_amount, objective_type, threshold)
          )
        `)
        .eq('team_id', teamId)
        .eq('season', '2025-26')
        .eq('status', 'active'),
      supabase.from('sponsor_pool').select('tier,template_id').eq('team_id', teamId).eq('season', '2025-26'),
      supabase.from('sponsor_jersey_images').select('option_number,tier,company_name').eq('team_id', teamId).eq('season', '2025-26'),
      supabase.from('teams').select('rival_team_id').eq('id', teamId).single(),
    ]).then(([{ data: c }, { data: p }, { data: j }, { data: t }]) => {
      setContracts(c || [])
      setPool(p || [])
      setJerseys(j || [])
      if (t?.rival_team_id) {
        supabase.from('teams').select('name').eq('id', t.rival_team_id).single()
          .then(({ data: r }) => { if (r?.name) setRivalName(r.name) })
      }
      setLoading(false)
    })
  }, [teamId])

  // The sponsor's real-world branded name (Disney, Advent Health, ...) lives
  // in sponsor_jersey_images, keyed by that team's pool position for the
  // tier (option_number) — not on the template itself, which only holds a
  // generic placeholder name shared by every team ("Sponsor A3"). Same
  // lookup SponsorsTab.tsx uses so the two tabs always agree on the name.
  const displayName = (contract: Contract): string => {
    const tierPool = pool.filter(p => p.tier === contract.tier)
    const idx = tierPool.findIndex(p => p.template_id === contract.template_id)
    const img = idx >= 0 ? jerseys.find(j => j.option_number === idx + 1 && j.tier === contract.tier) : undefined
    return img?.company_name || getTemplate(contract)?.company_name || '—'
  }

  if (!isGM) return (
    <div style={{padding:40,textAlign:'center',color:'#b0a89e',fontSize:13}}>
      🔒 {isPT ? 'Os objetivos são privados, só o GM da franquia os vê.' : 'Goals are private to the franchise GM.'}
    </div>
  )

  if (loading) return <div style={{color:'#8a8279',padding:20}}>{isPT ? 'A carregar objetivos...' : 'Loading goals...'}</div>

  if (!contracts.length) return (
    <div style={{padding:48,textAlign:'center',background:'#faf8f5',border:'1px dashed #d4cdc5',borderRadius:12}}>
      <div style={{fontSize:32,marginBottom:12}}>🎯</div>
      <div style={{fontSize:14,fontWeight:700,color:'#1a1512',marginBottom:6}}>{isPT ? 'Sem contratos de patrocínio ativos' : 'No active sponsor contracts'}</div>
      <div style={{fontSize:12,color:'#8a8279'}}>{isPT ? 'Assina acordos de patrocínio no separador Patrocinadores para desbloquear objetivos.' : 'Sign sponsor deals in the Sponsors tab to unlock objectives.'}</div>
    </div>
  )

  // Flatten all trackings for summary
  const allTrackings = contracts.flatMap(c => c.trackings || [])
  const totalGoals = allTrackings.length
  const achievedGoals = allTrackings.filter(t => t.achieved).length
  const pendingGoals = totalGoals - achievedGoals
  const totalPotential = allTrackings.reduce((s, t) => s + (getObjective(t)?.bonus_amount || 0), 0)
  const earnedBonus = allTrackings.filter(t => t.achieved).reduce((s, t) => s + (getObjective(t)?.bonus_amount || 0), 0)
  const monthlyFixed = contracts.reduce((s, c) => s + c.fixed_monthly, 0)

  return (
    <div>
      {/* Summary header */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
        {[
          { label: isPT ? 'Fixo mensal' : 'Monthly fixed',       val:fmt(monthlyFixed),         color:'#15803d', tip: isPT ? 'Receita mensal garantida de todos os contratos ativos' : 'Guaranteed monthly income from all active contracts' },
          { label: isPT ? 'Potencial de bónus' : 'Bonus potential',   val:fmt(totalPotential),       color:'#1d4ed8', tip: isPT ? 'Bónus máximo se todos os objetivos forem alcançados' : 'Maximum bonus if all objectives are achieved' },
          { label: isPT ? 'Bónus ganho' : 'Bonus earned',      val:fmt(earnedBonus),          color:'#b45309', tip: isPT ? 'Bónus já alcançados e creditados' : 'Bonuses already achieved and credited' },
          { label: isPT ? 'Progresso dos objetivos' : 'Goals progress',    val:`${achievedGoals}/${totalGoals}`, color:teamColor, tip: isPT ? 'Objetivos alcançados vs total' : 'Objectives achieved vs total' },
        ].map(item => (
          <div key={item.label} style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${item.color}`,borderRadius:10,padding:12}}>
            <div style={{fontSize:10,color:'#8a8279',marginBottom:4}}>{item.label}</div>
            <div style={{fontSize:18,fontWeight:800,color:item.color}}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {(isPT
          ? ([['all','Todos'],['pending','Pendentes'],['achieved','Alcançados']] as const)
          : ([['all','All'],['pending','Pending'],['achieved','Achieved']] as const)
        ).map(([k,l]) => (
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
                  <div style={{fontSize:13,fontWeight:700,color:'#1a1512'}}>{displayName(contract)}</div>
                  <div style={{fontSize:11,color:'#8a8279'}}>{tier.label} · {fmt(contract.fixed_monthly)}/{isPT ? 'mês garantido' : 'mo guaranteed'}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,color:'#8a8279'}}>{isPT ? 'Objetivos' : 'Objectives'}</div>
                  <div style={{fontSize:13,fontWeight:700,color:tier.color}}>
                    {(contract.trackings||[]).filter(t=>t.achieved).length}/{(contract.trackings||[]).length}
                  </div>
                </div>
              </div>

              {/* Objectives list */}
              <div style={{padding:'10px 16px',display:'flex',flexDirection:'column',gap:8}}>
                {trackings.map(tracking => {
                  const obj = getObjective(tracking)
                  if (!obj) return null
                  const icon = OBJECTIVE_ICONS[obj.objective_type] || '🎯'
                  const translated = translateObjectiveDescription(obj.description, isPT)
                  const desc = rivalName && obj.objective_type === 'wins_rivalry'
                    ? translated.replace(RIVAL_PLACEHOLDER_PATTERN, rivalName)
                    : translated
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
                            ✓ {isPT ? 'Alcançado' : 'Achieved'} {new Date(tracking.achieved_at).toLocaleDateString(isPT ? 'pt-PT' : 'en-US',{month:'short',day:'numeric'})}
                            {tracking.paid && (isPT ? ' · Creditado' : ' · Credited')}
                          </div>
                        )}
                      </div>

                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:12,fontWeight:700,color: tracking.achieved ? '#15803d' : '#5c554e'}}>
                          {fmt(obj.bonus_amount)}
                        </div>
                        {tracking.achieved && (
                          <div style={{fontSize:9,fontWeight:600,color: tracking.paid ? '#15803d' : '#b45309'}}>
                            {tracking.paid ? (isPT ? '✓ Pago' : '✓ Paid') : (isPT ? '⏳ Pendente' : '⏳ Pending')}
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

'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

const SEASON = '2025-26'

const SITUATION_INFO: Record<string, { icon: string, labelPT: string, labelEN: string, sentencePT: string, sentenceEN: string, color: string }> = {
  rebuild: {
    icon: '🌱', labelPT: 'Reconstrução', labelEN: 'Rebuild', color: '#1d4ed8',
    sentencePT: 'Os fãs querem ver um plantel jovem, excitante e com potencial de crescimento — não pressionam por um título já.',
    sentenceEN: "Fans want to see a young, exciting roster with real growth potential — they aren't pressuring for a title yet.",
  },
  retool: {
    icon: '🔧', labelPT: 'Reconstrução Avançada', labelEN: 'Retool', color: '#0e7490',
    sentencePT: 'O núcleo jovem já está a ganhar forma. Espera-se ver evolução clara, não ainda uma vaga de playoffs.',
    sentenceEN: 'The young core is starting to take shape. Clear development is expected, not a playoff berth yet.',
  },
  playoff_push: {
    icon: '🥊', labelPT: 'A Lutar pelos Playoffs', labelEN: 'Fighting for the Playoffs', color: '#b45309',
    sentencePT: 'Estás numa luta real por um lugar nos playoffs — os fãs querem ver a equipa a competir todas as noites por essa vaga.',
    sentenceEN: "You're in a real fight for a playoff spot — fans want to see the team competing hard for it every night.",
  },
  playoff_team: {
    icon: '📈', labelPT: 'Equipa de Playoffs', labelEN: 'Established Playoff Team', color: '#15803d',
    sentencePT: 'A tua equipa é uma presença habitual nos playoffs — espera-se isso mesmo, e idealmente avançar pelo menos uma ronda.',
    sentenceEN: 'Your team is a regular playoff presence — that\'s the baseline expectation, ideally advancing at least a round.',
  },
  rising_contender: {
    icon: '🚀', labelPT: 'Quer ser Contender', labelEN: 'Rising Contender', color: '#7c3aed',
    sentencePT: 'Tens talento a sério para lutar pelo título — os fãs esperam uma corrida profunda nos playoffs, não só participar.',
    sentenceEN: 'You have real title-caliber talent — fans expect a deep playoff run, not just showing up.',
  },
  contender: {
    icon: '🏆', labelPT: 'Contender', labelEN: 'Contender', color: '#b91c1c',
    sentencePT: 'A tua equipa está montada para ganhar tudo. Só uma época de campeonato satisfaz de verdade.',
    sentenceEN: 'Your roster is built to win it all. Only a championship-caliber season truly satisfies.',
  },
}

// Same 6 situations, but framed from the board's harsher, bottom-line
// perspective — owners tolerate a rebuild less patiently than fans do.
const OWNERS_SITUATION_INFO: Record<string, { sentencePT: string, sentenceEN: string }> = {
  rebuild: {
    sentencePT: 'A administração aceita a reconstrução, mas quer sinais claros de progresso — não é um cheque em branco.',
    sentenceEN: "Ownership accepts the rebuild, but wants clear signs of progress — it isn't a blank check.",
  },
  retool: {
    sentencePT: 'Espera-se prova concreta de que o rumo está certo — o núcleo jovem tem de mostrar melhorias reais.',
    sentenceEN: 'Concrete proof the direction is right is expected — the young core needs to show real improvement.',
  },
  playoff_push: {
    sentencePT: 'A administração quer ver a equipa a lutar mesmo por um lugar nos playoffs, não a desistir a meio da época.',
    sentenceEN: "Ownership wants to see the team genuinely fighting for a playoff spot, not fading out mid-season.",
  },
  playoff_team: {
    sentencePT: 'Chegar aos playoffs já não chega por si só — espera-se avançar pelo menos uma ronda.',
    sentenceEN: 'Just reaching the playoffs isn\'t enough anymore — advancing at least one round is expected.',
  },
  rising_contender: {
    sentencePT: 'Com este talento, a administração só aceita uma corrida a sério pelo título.',
    sentenceEN: 'With this much talent, ownership only accepts a real title run.',
  },
  contender: {
    sentencePT: 'Só o título satisfaz a administração este ano — não há desculpas com este plantel.',
    sentenceEN: 'Only a championship satisfies ownership this year — no excuses with this roster.',
  },
}

function fmtScore(n: number | null | undefined): string {
  return n == null ? '—' : Math.round(n).toString()
}

function fmtPct(n: number | null | undefined): string {
  return n == null ? '—' : `${Math.round(n * 100)}%`
}

function DeltaArrow({ current, previous }: { current: number | null | undefined, previous: number | null | undefined }) {
  if (current == null || previous == null) return null
  const delta = current - previous
  if (Math.abs(delta) < 0.5) return <span style={{ color: '#8a8279', fontSize: 12 }}>· ―</span>
  const up = delta > 0
  return <span style={{ color: up ? '#15803d' : '#b91c1c', fontSize: 12, fontWeight: 700 }}>{up ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}</span>
}

function Sparkline({ values, color }: { values: number[], color: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 100), min = Math.min(...values, 0)
  const range = max - min || 1
  return (
    <div className="flex items-end gap-0.5" style={{ height: 28 }}>
      {values.map((v, i) => (
        <div key={i} style={{ width: 5, height: `${Math.max(6, ((v - min) / range) * 28)}px`, background: color, opacity: 0.4 + (i / values.length) * 0.6, borderRadius: 1 }} />
      ))}
    </div>
  )
}

// The single aggregate bar per dimension — every sub-expectation (results,
// development, image, culture, etc.) is already summed into this one score,
// so the bar IS the summary Bruno asked for, not a per-sub-expectation bar.
function ProgressBar({ value, color }: { value: number | null | undefined, color: string }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="h-2.5 rounded-full overflow-hidden mb-1" style={{ background: '#e2dcd5' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function DimensionCard({ title, icon, score, trend, color, children }: {
  title: string, icon: string, score: number | null | undefined, trend: number[], color: string, children: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#faf8f5', border: '1px solid #d4cdc5', borderTop: `3px solid ${color}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{title}</span>
        </div>
        <Sparkline values={trend} color={color} />
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-2xl font-black" style={{ color: '#1a1512' }}>{fmtScore(score)}</span>
        <span className="text-xs font-semibold" style={{ color: '#8a8279' }}>/100</span>
      </div>
      <ProgressBar value={score} color={color} />
      <div className="flex flex-col gap-1 mt-3">{children}</div>
    </div>
  )
}

function BreakdownLine({ label, value }: { label: string, value: number | undefined }) {
  if (value == null) return null
  return (
    <div className="flex items-center justify-between text-xs">
      <span style={{ color: '#5c554e' }}>{label}</span>
      <span className="font-semibold" style={{ color: '#1a1512' }}>{Math.round(value)}</span>
    </div>
  )
}

function ObjectiveRow({ achieved, description, currentValue, threshold, groupLabel }: {
  achieved: boolean, description: string, currentValue: number | null, threshold: number | null, groupLabel: string
}) {
  return (
    <div className="flex items-center gap-2 text-xs py-1" style={{ borderBottom: '1px solid #e2dcd5' }}>
      <span style={{ color: achieved ? '#15803d' : '#b0a89c', fontSize: 14, flexShrink: 0 }}>{achieved ? '☑' : '☐'}</span>
      <div className="flex-1 min-w-0">
        <div style={{ color: achieved ? '#1a1512' : '#5c554e', fontWeight: achieved ? 600 : 400 }}>{description}</div>
        <div style={{ color: '#8a8279', fontSize: 10 }}>{groupLabel}</div>
      </div>
      {threshold != null && currentValue != null && (
        <span className="flex-shrink-0" style={{ color: achieved ? '#15803d' : '#8a8279', fontWeight: 600 }}>
          {Math.round(currentValue)}/{threshold}
        </span>
      )}
    </div>
  )
}

export default function SatisfactionTab({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [tenureStartWeek, setTenureStartWeek] = useState<number | null>(null)
  const [objectives, setObjectives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      // Only this GM's own tenure counts — if someone else managed this
      // team before, their history doesn't carry over.
      const { data: tenure } = await supabase.from('gm_tenure_log').select('started_week').eq('team_id', teamId).is('ended_week', null).order('started_week', { ascending: false }).limit(1).maybeSingle()
      const startWeek = tenure?.started_week ?? null
      setTenureStartWeek(startWeek)

      let query = supabase.from('gm_satisfaction_snapshots').select('*').eq('team_id', teamId).order('week_number', { ascending: true })
      if (startWeek != null) query = query.gte('week_number', startWeek)
      const { data } = await query
      setSnapshots(data || [])

      // Real chosen sponsor objectives for this team's active contracts —
      // the actual checklist, not just an aggregate count.
      const { data: contracts } = await supabase.from('sponsor_contracts')
        .select('id,tier,status,template:sponsor_templates(company_name)')
        .eq('team_id', teamId).eq('season', SEASON)
      const contractIds = (contracts || []).map((c: any) => c.id)
      const { data: tracking } = contractIds.length
        ? await supabase.from('sponsor_objective_tracking')
            .select('id,contract_id,achieved,current_value,objective:sponsor_objectives(description,threshold)')
            .in('contract_id', contractIds)
        : { data: [] as any[] }
      const contractById: Record<string, any> = {}
      ;(contracts || []).forEach((c: any) => { contractById[c.id] = c })
      const enriched = (tracking || []).map((t: any) => ({
        ...t,
        companyName: contractById[t.contract_id]?.template?.company_name || contractById[t.contract_id]?.tier,
      }))
      setObjectives(enriched)

      setLoading(false)
    })()
  }, [teamId])

  if (loading) return <div className="text-center py-8" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  if (!snapshots.length) {
    return (
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8a8279' }}>{isPT ? 'Satisfação' : 'Satisfaction'}</h2>
        <div className="rounded-xl p-6 text-center" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
          <p className="text-sm" style={{ color: '#6b5f4e' }}>
            {isPT ? 'A primeira avaliação aparece depois da primeira semana simulada.' : 'The first evaluation appears after the first simulated week.'}
          </p>
        </div>
      </div>
    )
  }

  const latest = snapshots[snapshots.length - 1]
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  const situation = SITUATION_INFO[latest.win_now_label] || SITUATION_INFO.retool
  const ownersSituation = OWNERS_SITUATION_INFO[latest.win_now_label] || OWNERS_SITUATION_INFO.retool

  const fansTrend = snapshots.map(s => s.fans_score ?? 50)
  const ownersTrend = snapshots.map(s => s.owners_score ?? 50)
  const sponsorsTrend = snapshots.map(s => s.sponsors_score ?? 50)

  const fb = latest.fans_breakdown || {}
  const ob = latest.owners_breakdown || {}
  const sb = latest.sponsors_breakdown || {}

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: '#faf8f5', border: '1px solid #d4cdc5', color: '#5c554e', lineHeight: 1.6 }}>
        📋 {isPT
          ? 'Esta é uma avaliação real do teu desempenho como GM, vista por 3 grupos diferentes — Fãs, Administração e Patrocinadores. As expetativas de cada um ajustam-se à verdadeira situação da tua equipa: uma reconstrução não é avaliada da mesma forma que uma equipa montada para ganhar tudo.'
          : "This is a real evaluation of your performance as GM, seen through 3 different groups — Fans, Ownership, and Sponsors. Each group's expectations adjust to your team's actual situation — a rebuild isn't judged the same way as a team built to win it all."}
      </div>

      {/* Composite header */}
      <div className="rounded-xl p-5 mb-4 flex items-center justify-between flex-wrap gap-4"
           style={{ background: '#faf8f5', border: '1px solid #d4cdc5', borderTop: `3px solid ${teamColor}` }}>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#8a8279' }}>
            {isPT ? 'Avaliação Geral do GM' : 'Overall GM Approval'}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black" style={{ color: teamColor }}>{fmtScore(latest.performance_score)}</span>
            <span className="text-sm font-semibold" style={{ color: '#8a8279' }}>/100</span>
            <DeltaArrow current={latest.performance_score} previous={previous?.performance_score} />
          </div>
          <div className="text-xs mt-1" style={{ color: '#8a8279' }}>
            {isPT ? 'Fãs 40% · Administração 40% · Patrocinadores 20%' : 'Fans 40% · Owners 40% · Sponsors 20%'}
          </div>
          {tenureStartWeek != null && (
            <div className="text-xs mt-1" style={{ color: '#8a8279' }}>
              {isPT ? `Neste cargo desde a semana ${tenureStartWeek}` : `In this role since week ${tenureStartWeek}`}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: situation.color }}>
            {situation.icon} {isPT ? situation.labelPT : situation.labelEN}
          </div>
          <div className="text-xs max-w-xs" style={{ color: '#5c554e', lineHeight: 1.5 }}>
            {isPT ? situation.sentencePT : situation.sentenceEN}
          </div>
        </div>
      </div>

      {/* 3 dimension cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <DimensionCard title={isPT ? 'Fãs' : 'Fans'} icon="📣" score={latest.fans_score} trend={fansTrend} color="#1d4ed8">
          <div className="text-xs mb-2" style={{ color: '#5c554e', lineHeight: 1.5 }}>
            {isPT ? situation.sentencePT : situation.sentenceEN}
          </div>
          {fb.expectedWinPct != null && (
            <div className="text-xs mb-1" style={{ color: '#8a8279' }}>
              {isPT ? 'Vitórias esperadas' : 'Expected win%'}: <strong style={{ color: '#1a1512' }}>{fmtPct(fb.expectedWinPct)}</strong>
              {' · '}{isPT ? 'Atual' : 'Actual'}: <strong style={{ color: '#1a1512' }}>{fmtPct(fb.actualWinPct)}</strong>
            </div>
          )}
          <div className="mt-1 pt-2" style={{ borderTop: '1px solid #e2dcd5' }}>
            <BreakdownLine label={isPT ? 'Resultados' : 'Results'} value={fb.resultsScore} />
            <BreakdownLine label={isPT ? 'Empolgação jovem' : 'Youth excitement'} value={fb.youthExcitement} />
            <BreakdownLine label={isPT ? 'Imagem' : 'Image'} value={fb.imageScore} />
            <BreakdownLine label={isPT ? 'Cultura' : 'Culture'} value={fb.cultureScore} />
            <div className="text-xs mt-1" style={{ color: '#8a8279' }}>
              {isPT ? 'Peso em resultados' : 'Weight on results'}: {fb.wResults != null ? Math.round(fb.wResults * 100) : '—'}%
            </div>
          </div>
        </DimensionCard>

        <DimensionCard title={isPT ? 'Administração' : 'Owners'} icon="🏛️" score={latest.owners_score} trend={ownersTrend} color="#b45309">
          <div className="text-xs mb-2" style={{ color: '#5c554e', lineHeight: 1.5 }}>
            {isPT ? ownersSituation.sentencePT : ownersSituation.sentenceEN}
          </div>
          {ob.expectedWinPct != null && (
            <div className="text-xs mb-1" style={{ color: '#8a8279' }}>
              {isPT ? 'Vitórias esperadas' : 'Expected win%'}: <strong style={{ color: '#1a1512' }}>{fmtPct(ob.expectedWinPct)}</strong>
              {' · '}{isPT ? 'Atual' : 'Actual'}: <strong style={{ color: '#1a1512' }}>{fmtPct(ob.actualWinPct)}</strong>
            </div>
          )}
          <div className="mt-1 pt-2" style={{ borderTop: '1px solid #e2dcd5' }}>
            <BreakdownLine label={isPT ? 'Desempenho desportivo' : 'Sporting performance'} value={ob.sportingPerformanceScore} />
            <BreakdownLine label={isPT ? 'Gestão desportiva' : 'Management'} value={ob.managementScore} />
            <BreakdownLine label={isPT ? 'Património' : 'Facilities'} value={ob.patrimonioScore} />
            <BreakdownLine label={isPT ? 'Crescimento' : 'Growth'} value={ob.growthScore} />
          </div>
        </DimensionCard>

        <DimensionCard title={isPT ? 'Patrocinadores' : 'Sponsors'} icon="🤝" score={latest.sponsors_score} trend={sponsorsTrend} color="#6d28d9">
          <div className="text-xs mb-2" style={{ color: '#5c554e', lineHeight: 1.5 }}>
            {isPT ? 'Distância a cumprir todos os objetivos escolhidos pelos teus patrocinadores esta época.' : 'How far you are from meeting every objective your sponsors set this season.'}
          </div>
          {sb.totalEvaluable ? (
            <div className="text-xs mb-2" style={{ color: '#5c554e' }}>
              {isPT ? 'Objetivos cumpridos' : 'Objectives met'}: <strong>{sb.totalAchieved}/{sb.totalEvaluable}</strong>
            </div>
          ) : (
            <div className="text-xs mb-2" style={{ color: '#8a8279' }}>{isPT ? 'Sem patrocinadores ativos' : 'No active sponsors'}</div>
          )}
          {objectives.length > 0 && (
            <div className="mt-1 pt-2 max-h-56 overflow-y-auto" style={{ borderTop: '1px solid #e2dcd5' }}>
              {objectives.map((o: any) => (
                <ObjectiveRow key={o.id}
                  achieved={!!o.achieved}
                  description={o.objective?.description || ''}
                  currentValue={o.current_value}
                  threshold={o.objective?.threshold}
                  groupLabel={o.companyName || ''}
                />
              ))}
            </div>
          )}
          <div className="text-xs mt-2" style={{ color: '#8a8279' }}>
            {isPT ? 'Afeta a qualidade das ofertas de patrocínio na próxima época.' : 'Affects next season\'s sponsor offer quality.'}
          </div>
        </DimensionCard>
      </div>
    </div>
  )
}

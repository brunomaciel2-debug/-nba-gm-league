'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import {
  OFF_SYSTEMS, OffSystem, TechNode, nodesForSystem, isNodeUnlocked, masteredCountByLevel, computeFamiliarity,
} from '@/lib/tactical-constants'

const SYSTEM_META: Record<OffSystem, { icon: string, labelEn: string, labelPt: string }> = {
  motion:     { icon: '🌀', labelEn: 'Motion Offense', labelPt: 'Motion Offense' },
  pickroll:   { icon: '🎯', labelEn: 'Pick & Roll',     labelPt: 'Pick & Roll' },
  transition: { icon: '⚡', labelEn: 'Fast Break',      labelPt: 'Contra-ataque' },
  iso:        { icon: '🧍', labelEn: 'Isolation',       labelPt: 'Isolamento' },
  post:       { icon: '💪', labelEn: 'Post-Up',         labelPt: 'Poste' },
}

function heatColor(v: number): string {
  if (v >= 80) return '#dc2626'
  if (v >= 55) return '#b45309'
  if (v >= 30) return '#ca8a04'
  return '#5c554e'
}

export default function TacticalSystemsTab({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const { profile } = useAuth()
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [loading, setLoading] = useState(true)
  const [activeSystem, setActiveSystem] = useState<OffSystem>('motion')
  const [viewSystem, setViewSystem] = useState<OffSystem>('motion')
  const [progressByNodeId, setProgressByNodeId] = useState<Record<string, number>>({})
  const [focusByNodeKey, setFocusByNodeKey] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data: sc } = await supabase.from('season_config').select('current_week').eq('id', 1).single()
    const week = (sc as any)?.current_week || 0
    const { data: order } = await supabase.from('gm_orders').select('atk_style').eq('team_id', teamId).eq('week_number', week).maybeSingle()
    const sys: OffSystem = (order as any)?.atk_style || 'motion'
    setActiveSystem(sys)
    setViewSystem(sys)
    const { data: rows } = await supabase.from('tactical_familiarity').select('system,node_id,progress').eq('team_id', teamId)
    const byId: Record<string, number> = {}
    ;(rows || []).forEach((r: any) => { byId[`${r.system}|${r.node_id}`] = r.progress })
    setProgressByNodeId(byId)
    // No auto-pick on the backend anymore — a system with nothing chosen
    // here makes zero progress, so the UI needs to know exactly which node
    // (if any) is the current focus to highlight it and to prompt the GM
    // when nothing has been picked yet.
    const { data: focusRows } = await supabase.from('tactical_focus').select('system,node_id').eq('team_id', teamId)
    const focusById: Record<string, string> = {}
    ;(focusRows || []).forEach((f: any) => { focusById[f.system] = f.node_id })
    setFocusByNodeKey(focusById)
    setLoading(false)
  }
  useEffect(() => { load() }, [teamId])

  if (!isGM) {
    return (
      <div className="rounded-2xl p-16 text-center" style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }}>
        <div className="text-5xl mb-4">🔒</div>
        <h3 className="text-lg font-black mb-2" style={{ color: '#1a1512' }}>{isPT ? 'Informação Privada' : 'Private Information'}</h3>
        <p className="text-sm" style={{ color: '#8a8279' }}>{isPT ? 'O desenvolvimento tático de uma equipa só é visível ao seu GM e ao Comissário.' : "A team's tactical development is only visible to its own GM and the Commissioner."}</p>
      </div>
    )
  }
  if (loading) return <div className="text-center py-8" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  const viewProgress = (nodeId: string) => progressByNodeId[`${viewSystem}|${nodeId}`] || 0
  const viewProgressMap: Record<string, number> = {}
  nodesForSystem(viewSystem).forEach(n => { viewProgressMap[n.id] = viewProgress(n.id) })
  const familiarity = computeFamiliarity(viewProgressMap, viewSystem)
  const activeProgressMap: Record<string, number> = {}
  nodesForSystem(activeSystem).forEach(n => { activeProgressMap[n.id] = progressByNodeId[`${activeSystem}|${n.id}`] || 0 })
  const activeFamiliarity = computeFamiliarity(activeProgressMap, activeSystem)
  const counts = masteredCountByLevel(viewProgressMap, viewSystem)

  // Highest level currently holding a mastered node in the viewed system —
  // if it's dormant (not this week's active system) this is exactly what's
  // eroding, top-down, per the decay rule.
  let peakLevel = 0
  for (let lvl = 5; lvl >= 1; lvl--) { if (counts[lvl] > 0) { peakLevel = lvl; break } }
  const erodingNode = peakLevel > 0 ? nodesForSystem(viewSystem).find(n => n.level === peakLevel && viewProgress(n.id) >= 100) : null

  // The chosen focus tech for the viewed system, re-validated the same way
  // the backend does — a saved focus that's since been mastered or locked
  // no longer counts as "chosen" (matches resolveWeeklyTacticalDevelopment).
  const viewFocusNodeId = focusByNodeKey[viewSystem]
  const viewFocusNode = viewFocusNodeId ? nodesForSystem(viewSystem).find(n => n.id === viewFocusNodeId) : null
  const focusValid = !!viewFocusNode && viewProgress(viewFocusNode.id) < 100 && isNodeUnlocked(viewFocusNode, viewProgressMap)
  const activeFocusNodeId = focusByNodeKey[activeSystem]
  const activeFocusNode = activeFocusNodeId ? nodesForSystem(activeSystem).find(n => n.id === activeFocusNodeId) : null
  const activeFocusValid = !!activeFocusNode && (progressByNodeId[`${activeSystem}|${activeFocusNode.id}`] || 0) < 100 && isNodeUnlocked(activeFocusNode, activeProgressMap)

  const setFocus = async (node: TechNode) => {
    setSaving(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT ? 'Não estás autenticado' : 'Not logged in'); setSaving(false); return }
    const res = await fetch('/api/tactical/set-focus', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ teamId, system: viewSystem, nodeId: node.id }),
    })
    const json = await res.json()
    if (!res.ok) setMsg(json.error || (isPT ? 'Erro' : 'Error'))
    else await load()
    setSaving(false)
  }

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: '#faf8f5', border: '1px solid #d4cdc5', color: '#5c554e', lineHeight: 1.6 }}>
        🔥 {isPT
          ? 'Quanto mais usas o mesmo sistema ofensivo nas ordens semanais, mais a equipa domina as suas techs — o que dá um boost real à performance, mesmo contra um counter. Sistemas não usados perdem domínio devagar, de cima para baixo. Tens sempre de escolher tu qual a tech a desenvolver a seguir — sem escolha, não há progresso nenhum, mesmo com o sistema ativo.'
          : "The more you use the same offensive system in weekly orders, the more the team masters its techs — a real performance boost, even against a counter. Unused systems slowly lose mastery, top-down. You always have to pick which tech develops next yourself — with nothing chosen, there's zero progress, even with the system active."}
      </div>

      {/* Active system heat bar */}
      <div className="rounded-xl p-4 mb-5" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#8a8279' }}>
            {isPT ? 'Familiaridade Atual' : 'Current Familiarity'} — {SYSTEM_META[activeSystem].icon} {isPT ? SYSTEM_META[activeSystem].labelPt : SYSTEM_META[activeSystem].labelEn}
          </span>
          <span className="text-sm font-black" style={{ color: heatColor(activeFamiliarity) }}>{Math.round(activeFamiliarity)}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: '#d4cdc5' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${activeFamiliarity}%`, background: heatColor(activeFamiliarity) }} />
        </div>
      </div>

      {/* System picker */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {OFF_SYSTEMS.map(s => (
          <button key={s} onClick={() => setViewSystem(s)}
            className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            style={{
              background: viewSystem === s ? teamColor + '22' : '#faf8f5',
              border: `1px solid ${viewSystem === s ? teamColor : '#d4cdc5'}`,
              color: viewSystem === s ? '#1a1512' : '#5c554e',
            }}>
            <span>{SYSTEM_META[s].icon}</span>
            <span>{isPT ? SYSTEM_META[s].labelPt : SYSTEM_META[s].labelEn}</span>
            {s === activeSystem && <span style={{ color: '#15803d' }}>●</span>}
          </button>
        ))}
      </div>

      {viewSystem !== activeSystem && (
        <div className="mb-5 p-3 rounded-lg text-xs" style={{ background: '#2a0a0a', border: '1px solid #5a1a1a', color: '#f5b8b8' }}>
          ⏳ {isPT
            ? `Este sistema não está ativo esta semana — não ganha progresso.${erodingNode ? ` A tech "${erodingNode.namePt}" está a perder domínio.` : ''}`
            : `This system isn't active this week — no progress is being made.${erodingNode ? ` "${erodingNode.nameEn}" is currently eroding.` : ''}`}
        </div>
      )}
      {viewSystem === activeSystem && !activeFocusValid && (
        <div className="mb-5 p-3 rounded-lg text-xs font-semibold" style={{ background: '#2a1f00', border: '1px solid #7a5a00', color: '#f5d896' }}>
          🎯 {isPT
            ? 'Ainda não escolheste nenhuma tech para desenvolver neste sistema — sem escolha, a Familiaridade Tática não avança nenhuma semana. Clica numa tech desbloqueada abaixo.'
            : "You haven't picked a tech to develop in this system yet — without a choice, Tactical Familiarity won't progress at all. Click an unlocked tech below."}
        </div>
      )}
      {msg && <div className="mb-3 text-xs font-semibold" style={{ color: '#dc2626' }}>{msg}</div>}

      {/* Pyramid */}
      <div className="flex flex-col gap-3">
        {[5, 4, 3, 2, 1].map(level => (
          <div key={level} className="flex gap-2 justify-center flex-wrap">
            {nodesForSystem(viewSystem).filter(n => n.level === level).map(node => {
              const progress = viewProgress(node.id)
              const mastered = progress >= 100
              const unlocked = isNodeUnlocked(node, viewProgressMap)
              const isFocus = focusValid && node.id === viewFocusNodeId
              // Only one tech develops at a time — once a valid focus is
              // set, every OTHER unlocked-but-not-mastered node is blocked
              // until that one is fully mastered (blurred here rather than
              // looking identically pickable, so it reads as "not yet",
              // not "broken").
              const blockedByOtherFocus = focusValid && !isFocus && !mastered && unlocked
              const name = isPT ? node.namePt : node.nameEn
              const desc = isPT ? node.descPt : node.descEn
              return (
                <button key={node.id} disabled={!unlocked || mastered || saving || viewSystem !== activeSystem || blockedByOtherFocus}
                  onClick={() => setFocus(node)}
                  title={blockedByOtherFocus ? (isPT ? 'Termina a tech em foco antes de escolheres esta' : 'Finish the in-focus tech before picking this one') : desc}
                  className="rounded-lg p-2 text-center transition-all disabled:cursor-not-allowed"
                  style={{
                    width: 108, minHeight: 66,
                    background: mastered ? '#dcfce7' : unlocked ? '#faf8f5' : '#e2dcd5',
                    border: `2px solid ${mastered ? '#15803d' : isFocus ? teamColor : unlocked ? '#d4cdc5' : '#c8c0b4'}`,
                    boxShadow: isFocus ? `0 0 0 2px ${teamColor}44` : 'none',
                    opacity: !unlocked ? 0.55 : blockedByOtherFocus ? 0.55 : 1,
                    // Locked nodes still show their real name (blurred, same
                    // treatment as blockedByOtherFocus) instead of hiding it
                    // behind a bare lock icon — a GM plans which path to take
                    // several rows ahead, so what's coming at level 2, 3...
                    // needs to be readable-through-the-blur, not a mystery box.
                    filter: (!unlocked || blockedByOtherFocus) ? 'blur(1.5px)' : 'none',
                  }}>
                  {!unlocked && (
                    <div className="text-xs mb-0.5" style={{ color: '#8a8279' }}>🔒</div>
                  )}
                  {isFocus && (
                    <div className="text-xs font-black mb-0.5" style={{ color: teamColor }}>
                      🎯 {isPT ? 'Em Foco' : 'In Focus'}
                    </div>
                  )}
                  <div className="text-xs font-bold leading-tight" style={{ color: mastered ? '#15803d' : unlocked ? '#1a1512' : '#8a8279' }}>
                    {name}
                  </div>
                  {unlocked && !mastered && (
                    <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: '#d4cdc5' }}>
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, background: teamColor }} />
                    </div>
                  )}
                  {mastered && <div className="text-xs mt-1" style={{ color: '#15803d' }}>✓ {isPT ? 'Dominada' : 'Mastered'}</div>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p className="text-xs mt-4 text-center" style={{ color: '#8a8279' }}>
        {isPT
          ? 'Só desenvolves uma tech de cada vez — clica numa tech desbloqueada do sistema ativo para começares, ou espera que a tech em foco fique dominada para escolheres a próxima.'
          : "You develop one tech at a time — click an unlocked tech in the active system to start, or wait for the in-focus one to be mastered before picking the next."}
      </p>
    </div>
  )
}

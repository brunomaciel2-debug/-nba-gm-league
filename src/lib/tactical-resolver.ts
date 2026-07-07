import { supabaseAdmin } from '@/lib/supabase'
import {
  OFF_SYSTEMS, OffSystem, TechNode, nodesForSystem, isNodeUnlocked, masteredCountByLevel,
} from '@/lib/tactical-constants'

const SEASON = '2025-26'

// Same fill-rate shape as the existing "playmaking" training slot (which
// already uses this exact tactical_dev blend) — 3-12 points/week depending
// on coaching quality, neutral baseline 60.
function fillRate(tacticalDevQuality: number): number {
  return Math.max(3, Math.min(12, 5 + (tacticalDevQuality - 60) * 0.25))
}
const DECAY_RATE = 6

function pickFocusNode(system: OffSystem, progressByNodeId: Record<string, number>): TechNode | null {
  const counts = masteredCountByLevel(progressByNodeId, system)
  // Lowest level first, first unlocked+unmastered node in tree-definition order.
  const candidates = nodesForSystem(system).filter(node =>
    (progressByNodeId[node.id] || 0) < 100 && isNodeUnlocked(node, counts)
  )
  candidates.sort((a, b) => a.level - b.level)
  return candidates[0] || null
}

// Weekly tick — safe to call every sim week (not month-gated like
// merchandising/All-Star, this needs to move every single week). For each
// team: the system matching this week's gm_orders.atk_style gets its chosen
// focus node progressed; the other 4 systems decay from the top down (the
// highest level with any mastered node loses progress first — lower levels
// stay frozen as long as a level above them is still mastered).
export async function resolveWeeklyTacticalDevelopment(week: number): Promise<{ teams: number }> {
  const { data: teams } = await supabaseAdmin.from('teams').select('id').not('id', 'in', '(ALL,RVS,ROO,SOP)')
  if (!teams?.length) return { teams: 0 }
  const teamIds = teams.map((t: any) => t.id)

  const { data: orders } = await supabaseAdmin.from('gm_orders').select('team_id,atk_style').eq('week_number', week)
  const atkStyleByTeam: Record<string, OffSystem> = {}
  ;(orders || []).forEach((o: any) => { atkStyleByTeam[o.team_id] = (o.atk_style as OffSystem) || 'motion' })

  const { data: coaches } = await supabaseAdmin.from('coaches')
    .select('team_id,role,tactical_dev').in('team_id', teamIds).in('role', ['head_coach', 'assistant_coach'])
  const coachByTeamRole: Record<string, Record<string, any>> = {}
  ;(coaches || []).forEach((c: any) => { (coachByTeamRole[c.team_id] ||= {})[c.role] = c })
  const g = (v: number | undefined | null) => v ?? 60

  const { data: focusRows } = await supabaseAdmin.from('tactical_focus').select('*').in('team_id', teamIds)
  const focusByTeamSystem: Record<string, string | null> = {}
  ;(focusRows || []).forEach((f: any) => { focusByTeamSystem[`${f.team_id}|${f.system}`] = f.node_id })

  const { data: progressRows } = await supabaseAdmin.from('tactical_familiarity').select('*').in('team_id', teamIds)
  const progressByTeamSystem: Record<string, Record<string, number>> = {}
  ;(progressRows || []).forEach((r: any) => {
    const key = `${r.team_id}|${r.system}`
    ;(progressByTeamSystem[key] ||= {})[r.node_id] = r.progress
  })

  const progressUpdates: { team_id: string, system: string, node_id: string, progress: number }[] = []
  const focusUpserts: { team_id: string, system: string, node_id: string | null }[] = []

  for (const teamId of teamIds) {
    const activeSystem = atkStyleByTeam[teamId] || 'motion'
    const hc = coachByTeamRole[teamId]?.head_coach
    const ac = coachByTeamRole[teamId]?.assistant_coach
    const tacticalDevQuality = 0.6 * g(hc?.tactical_dev) + 0.4 * g(ac?.tactical_dev)

    for (const system of OFF_SYSTEMS) {
      const key = `${teamId}|${system}`
      const progressByNodeId = { ...(progressByTeamSystem[key] || {}) }

      if (system === activeSystem) {
        let focusNodeId = focusByTeamSystem[key]
        let focusNode = focusNodeId ? nodesForSystem(system).find(n => n.id === focusNodeId) : null
        // Re-validate: if the saved focus is already mastered or somehow
        // locked (e.g. a prerequisite decayed away since it was chosen),
        // auto-pick the next sensible one instead.
        const counts = masteredCountByLevel(progressByNodeId, system)
        if (!focusNode || (progressByNodeId[focusNode.id] || 0) >= 100 || !isNodeUnlocked(focusNode, counts)) {
          focusNode = pickFocusNode(system, progressByNodeId)
          if (focusNode) focusUpserts.push({ team_id: teamId, system, node_id: focusNode.id })
        }
        if (focusNode) {
          const before = progressByNodeId[focusNode.id] || 0
          const after = Math.min(100, before + fillRate(tacticalDevQuality))
          if (after !== before) {
            progressByNodeId[focusNode.id] = after
            progressUpdates.push({ team_id: teamId, system, node_id: focusNode.id, progress: after })
          }
        }
      } else {
        // Decay from the top: find the HIGHEST level with any progress at
        // all (not just currently-mastered nodes — once a mastered node
        // starts fading it must keep fading every week, not freeze the
        // moment it first dips under 100). Levels below stay fully
        // protected/frozen as long as this level still has ANY progress;
        // only once it fully bottoms out at 0 does decay move down a level.
        let peakLevel = 0
        for (let lvl = 5; lvl >= 1; lvl--) {
          if (nodesForSystem(system).some(n => n.level === lvl && (progressByNodeId[n.id] || 0) > 0)) { peakLevel = lvl; break }
        }
        if (peakLevel > 0) {
          for (const node of nodesForSystem(system).filter(n => n.level === peakLevel)) {
            const before = progressByNodeId[node.id] || 0
            if (before > 0) {
              const after = Math.max(0, before - DECAY_RATE)
              progressByNodeId[node.id] = after
              progressUpdates.push({ team_id: teamId, system, node_id: node.id, progress: after })
            }
          }
        }
      }
    }
  }

  for (const u of progressUpdates) {
    await supabaseAdmin.from('tactical_familiarity').upsert(
      { team_id: u.team_id, system: u.system, node_id: u.node_id, progress: u.progress },
      { onConflict: 'team_id,system,node_id' }
    )
  }
  for (const f of focusUpserts) {
    await supabaseAdmin.from('tactical_focus').upsert(
      { team_id: f.team_id, system: f.system, node_id: f.node_id },
      { onConflict: 'team_id,system' }
    )
  }

  return { teams: teamIds.length }
}

// Read-only helper for cron/simulate/route.ts and the UI: current progress
// map + familiarity + mods for every team, keyed by team then system.
export async function getAllTeamsTacticalState(): Promise<Record<string, Record<OffSystem, Record<string, number>>>> {
  const { data: rows } = await supabaseAdmin.from('tactical_familiarity').select('*')
  const state: Record<string, Record<OffSystem, Record<string, number>>> = {}
  ;(rows || []).forEach((r: any) => {
    const teamState = (state[r.team_id] ||= {} as any)
    ;(teamState[r.system as OffSystem] ||= {})[r.node_id] = r.progress
  })
  return state
}

import { supabaseAdmin } from '@/lib/supabase'
import {
  OFF_SYSTEMS, OffSystem, nodesForSystem, isNodeUnlocked,
} from '@/lib/tactical-constants'

const SEASON = '2025-26'

// Full mastery of a system (15 nodes x 100 points = 1500) should be
// reachable within 75% of a 24-week regular season (18 weeks) of
// continuous, uninterrupted focus at neutral (60) coaching quality — that's
// 1500/18 ≈ 83/week. Old rate (3-12/week) made a single node take 9-20
// weeks and the full tree 100+ weeks (several seasons), which made the
// "the more you use it, the more you master it" pitch never actually
// deliver within a real season, even to a team that never switched systems.
function fillRate(tacticalDevQuality: number): number {
  return Math.max(55, Math.min(125, 85 + (tacticalDevQuality - 60) * 1))
}
// Scaled to roughly match the new fill rate (a system left idle should
// erode about as fast as a diligent one gets built) rather than the old
// DECAY_RATE=6, which barely registered against the old 3-12/week gain and
// would be nearly invisible against the new, much larger gain.
const DECAY_RATE = 100

// Weekly tick — safe to call every sim week (not month-gated like
// merchandising/All-Star, this needs to move every single week). For each
// team: the system matching this week's gm_orders.atk_style gets its chosen
// focus node progressed; the other 4 systems decay from the top down (the
// highest level with any mastered node loses progress first — lower levels
// stay frozen as long as a level above them is still mastered).
export async function resolveWeeklyTacticalDevelopment(week: number): Promise<{ teams: number, needsFocusReminder: { team_id: string, system: OffSystem }[] }> {
  const { data: teams } = await supabaseAdmin.from('teams').select('id').not('id', 'in', '(ALL,RVS,ROO,SOP)')
  if (!teams?.length) return { teams: 0, needsFocusReminder: [] }
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
  const needsFocusReminder: { team_id: string, system: OffSystem }[] = []

  for (const teamId of teamIds) {
    const activeSystem = atkStyleByTeam[teamId] || 'motion'
    const hc = coachByTeamRole[teamId]?.head_coach
    const ac = coachByTeamRole[teamId]?.assistant_coach
    const tacticalDevQuality = 0.6 * g(hc?.tactical_dev) + 0.4 * g(ac?.tactical_dev)

    for (const system of OFF_SYSTEMS) {
      const key = `${teamId}|${system}`
      const progressByNodeId = { ...(progressByTeamSystem[key] || {}) }

      if (system === activeSystem) {
        const focusNodeId = focusByTeamSystem[key]
        const focusNode = focusNodeId ? nodesForSystem(system).find(n => n.id === focusNodeId) : null
        // No auto-pick: if the GM never chose a tech, or the one they chose
        // just got mastered (or its prerequisite decayed away since), NO
        // progress happens this week — the GM has to actively pick the next
        // one themselves (see /api/tactical/set-focus). Flagged here so a
        // reminder notification goes out instead of silently stalling.
        const focusValid = focusNode && (progressByNodeId[focusNode.id] || 0) < 100 && isNodeUnlocked(focusNode, progressByNodeId)
        if (focusValid) {
          const before = progressByNodeId[focusNode!.id] || 0
          const after = Math.min(100, before + fillRate(tacticalDevQuality))
          if (after !== before) {
            progressByNodeId[focusNode!.id] = after
            progressUpdates.push({ team_id: teamId, system, node_id: focusNode!.id, progress: after })
          }
        } else {
          needsFocusReminder.push({ team_id: teamId, system })
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

  return { teams: teamIds.length, needsFocusReminder }
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

import { supabaseAdmin } from '@/lib/supabase'
import { getWeekForDate, getStatusForWeek } from '@/lib/season-week-helper'
import {
  OFF_SYSTEMS, OffSystem, nodesForSystem, isNodeUnlocked,
} from '@/lib/tactical-constants'

const SEASON = '2025-26'

// Bruno's target: a full system (15 nodes x 100 points each) should reach
// 100% mastery in roughly 15 weeks for the league's best-staffed team, ~20
// for a typical one, ~25 for a weak one — anchored on the league's REAL
// head/assistant coach pool (checked directly): combined quality (0.6*HC +
// 0.4*AC) spans ~70-85, averaging ~75.5.
//
// Only ONE node develops at a time (the GM must manually pick the next one
// every time the current one masters, see set-focus/route.ts) and progress
// past 100 on a node is wasted, not carried to the next. With a WEEKLY tick
// that forces the total for all 15 nodes to always land on a multiple of 15
// weeks (1, 2, 3... whole weeks per node) — 20 or 25 aren't reachable that
// way. Ticking once per SIMULATED DAY instead (same architecture as health
// recovery/playoffs, see daily-tick.ts) removes that stepping: progress
// accrues in fractional-week amounts daily, so any target total is exact.
//
// weeklyEquivalent(q) is the old mental model (points/week) — q=70 (today's
// weakest real team) -> 60/week -> 1500/60 = 25 weeks. q=85 (today's
// strongest) -> 100/week -> 15 weeks. q=75.5 (league average) interpolates
// to ~75/week -> 20 weeks, landing on Bruno's three target numbers without
// needing separate anchors for "average". The actual daily increment is
// this value divided by 7.
function dailyFillRate(tacticalDevQuality: number): number {
  const weeklyEquivalent = Math.max(15, Math.min(100, 60 + (tacticalDevQuality - 70) * (40 / 15)))
  return weeklyEquivalent / 7
}
// An idle system should erode roughly as fast as a typical (not elite) team
// builds it — about 3 weeks to fully erase a mastered node — so switching
// away from a system for a few weeks has real, felt consequences without
// wiping a season's worth of progress in a single tick. (35/week, same
// reasoning as dailyFillRate, spread across the 7 days of a week.)
const DAILY_DECAY_RATE = 35 / 7

// Daily tick (called once per simulated calendar day, see daily-tick.ts) —
// skipped entirely during the literal 'pre-season' phase, same as before:
// those weeks are a tactics/rotations sandbox that was never meant to count
// toward real progress (mirrors how pre-season games don't count toward
// standings or stats). For each team: the system matching that day's week's
// gm_orders.atk_style gets its chosen focus node progressed; the other 4
// systems decay from the top down (the highest level with any mastered node
// loses progress first — lower levels stay frozen as long as a level above
// them is still mastered).
export async function resolveDailyTacticalDevelopment(simDate: string): Promise<{ teams: number, needsFocusReminder: { team_id: string, system: OffSystem }[] }> {
  const week = getWeekForDate(simDate)
  if (getStatusForWeek(week) === 'pre-season') return { teams: 0, needsFocusReminder: [] }

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
        // progress happens this day — the GM has to actively pick the next
        // one themselves (see /api/tactical/set-focus). Flagged here so a
        // reminder notification goes out instead of silently stalling.
        const focusValid = focusNode && (progressByNodeId[focusNode.id] || 0) < 100 && isNodeUnlocked(focusNode, progressByNodeId)
        if (focusValid) {
          const before = progressByNodeId[focusNode!.id] || 0
          const after = Math.min(100, before + dailyFillRate(tacticalDevQuality))
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
        // starts fading it must keep fading every day, not freeze the
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
              const after = Math.max(0, before - DAILY_DECAY_RATE)
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

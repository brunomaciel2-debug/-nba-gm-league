import { supabaseAdmin } from '@/lib/supabase'
import { weeklyCost, targetMorale, sessionBoostRate } from '@/lib/psychology-office-constants'

const SEASON = '2025-26'

// Psychology Office — weekly resolver. Runs AFTER the main health/morale
// recovery step in run.ts (it reads players.moral post-natural-drift), and
// layers a guaranteed extra push toward each occupied slot's target (60,
// or 75 with Extra Hours) on top, scaled by the team's Mental Coach quality.
// A slot auto-clears the moment its player reaches target — the GM never
// has to remember to free it up. Weekly cost is deducted from the team's
// balance for every occupied slot, every week it's occupied.
export async function resolveWeeklyPsychologyOffice(week: number): Promise<{ processed: number, cleared: number }> {
  const { data: slots } = await supabaseAdmin.from('psychology_slots').select('*').not('player_id', 'is', null)
  if (!slots?.length) return { processed: 0, cleared: 0 }

  const playerIds = slots.map((s: any) => s.player_id)
  const { data: players } = await supabaseAdmin.from('players')
    .select('id,name,team_id,status,moral').in('id', playerIds)
  const playerById: Record<string, any> = {}
  ;(players || []).forEach((p: any) => { playerById[p.id] = p })

  const teamIds = Array.from(new Set(slots.map((s: any) => s.team_id)))
  const { data: mentalCoaches } = await supabaseAdmin.from('coaches')
    .select('team_id,morale_management').eq('role', 'mental_coach').in('team_id', teamIds)
  const moraleMgmtByTeam: Record<string, number> = {}
  ;(mentalCoaches || []).forEach((c: any) => { moraleMgmtByTeam[c.team_id] = c.morale_management })

  const { data: finances } = await supabaseAdmin.from('franchise_finances')
    .select('team_id,balance').in('team_id', teamIds)
  const balanceByTeam: Record<string, number> = {}
  ;(finances || []).forEach((f: any) => { balanceByTeam[f.team_id] = f.balance || 0 })

  let processed = 0, cleared = 0
  const transactions: any[] = []
  const notifications: any[] = []

  for (const slot of slots) {
    const p = playerById[slot.player_id]
    // Player traded away or left the roster entirely (waived/retired) —
    // the slot no longer makes sense, clear it silently rather than
    // charging for sessions with someone who isn't on the team anymore.
    if (!p || p.team_id !== slot.team_id || p.status !== 'active') {
      await supabaseAdmin.from('psychology_slots').update({ player_id: null, extra_hours: false, updated_at: new Date().toISOString() }).eq('id', slot.id)
      continue
    }

    processed++
    const cost = weeklyCost(slot.slot_number as 1 | 2 | 3, slot.extra_hours)
    if (cost > 0) {
      balanceByTeam[slot.team_id] = (balanceByTeam[slot.team_id] || 0) - cost
      transactions.push({
        team_id: slot.team_id, type: 'expense', category: 'psychology',
        amount: cost, description: `Psychology Office — private sessions for ${p.name}`,
        season: SEASON, week_number: week,
      })
    }

    const target = targetMorale(slot.extra_hours)
    const rate = sessionBoostRate(moraleMgmtByTeam[slot.team_id])
    const currentMoral = p.moral || 0
    const pushed = Math.round(currentMoral + (target - currentMoral) * rate)
    const newMoral = Math.max(0, Math.min(100, Math.max(currentMoral, pushed)))

    if (newMoral !== currentMoral) {
      await supabaseAdmin.from('players').update({ moral: newMoral }).eq('id', p.id)
    }

    if (newMoral >= target) {
      cleared++
      await supabaseAdmin.from('psychology_slots').update({ player_id: null, extra_hours: false, updated_at: new Date().toISOString() }).eq('id', slot.id)
      notifications.push({
        to_team_id: slot.team_id, type: 'system',
        subject: `🧠 ${p.name} finished his sessions with the Mental Coach`,
        body: `${p.name}'s morale is back up to ${newMoral}/100 after his private sessions. Slot ${slot.slot_number} in the Psychology Office is open again.`,
        read: false, metadata: { player_id: p.id, slot_number: slot.slot_number },
      })
    }
  }

  for (const [teamId, balance] of Object.entries(balanceByTeam)) {
    await supabaseAdmin.from('franchise_finances').update({ balance }).eq('team_id', teamId)
  }
  if (transactions.length) await supabaseAdmin.from('franchise_transactions').insert(transactions)
  if (notifications.length) await supabaseAdmin.from('inbox_messages').insert(notifications)

  return { processed, cleared }
}

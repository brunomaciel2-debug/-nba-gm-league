import { SupabaseClient } from '@supabase/supabase-js'
import { getStatusForWeek } from '@/lib/season-week-helper'

// Single source of truth for roster-size rules, shared by every route that
// can add or remove a player from a team (cut, rookie-option decline,
// trade execution, draft confirm).
export const MIN_ROSTER = 12
export const MAX_ROSTER = 15

// The 12-player minimum is only a soft target during the real Free Agency
// negotiation week (week 1) — GMs are actively rebuilding then. Everywhere
// else it's a hard floor.
export async function isFreeAgencyWindow(admin: SupabaseClient): Promise<boolean> {
  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  const nextWeek = (cfg?.current_week || 0) + 1
  return getStatusForWeek(nextWeek) === 'free-agency'
}

export async function getActiveRosterCount(admin: SupabaseClient, teamId: string): Promise<number> {
  const { count } = await admin.from('players').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'active')
  return count ?? 0
}

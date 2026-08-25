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

// The Trade Deadline calendar event (season_events.event_key='trade_deadline')
// already says "No trades allowed between teams after this date" — until
// now that was purely decorative, nothing anywhere actually enforced it.
// Reads the real event date instead of a hardcoded week number, so moving
// the date in the calendar (season_events) is all that's ever needed to
// change it — no redeploy.
export async function isTradeDeadlinePassed(admin: SupabaseClient): Promise<boolean> {
  const [{ data: cfg }, { data: ev }] = await Promise.all([
    admin.from('season_config').select('last_sim_day').eq('id', 1).single(),
    admin.from('season_events').select('start_date').eq('event_key', 'trade_deadline').maybeSingle(),
  ])
  if (!cfg?.last_sim_day || !ev?.start_date) return false
  // "Now" is last_sim_day + 1 day, same as the navbar's "Now" pill — trades
  // are still allowed ON the deadline date itself, blocked starting the day
  // after (matching the event's own "after this date" wording).
  const now = new Date(cfg.last_sim_day + 'T00:00:00')
  now.setDate(now.getDate() + 1)
  return now > new Date(ev.start_date + 'T00:00:00')
}

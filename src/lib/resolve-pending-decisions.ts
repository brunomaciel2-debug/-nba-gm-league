import { createClient } from '@supabase/supabase-js'
import { resolveOffers } from './resolve-offers-core'
import { resolveStaffOffers } from './resolve-staff-offers-core'
import { resolveFreeAgencyMarket } from './resolve-free-agency-core'
import { resolveDraftRound, sweepExpiredDraftConfirmations, sweepExpiredRookieOptions } from './draft-resolver'
import { resolveDraftLottery, resolveDraftClassReminder } from './draft-lottery'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Every "pending decision" concern (flat-rate FA pickups, staff-offer hiring,
// Free Agency week negotiation, both Draft rounds, expired confirmations/
// options, the draft-class reminder) used to resolve ONLY on the real-world
// daily cron (see /api/cron/resolve-all) — tied to actual UTC midnight, not
// the simulated season calendar. That's the same category of bug the old
// health-recovery `isMonday` real-wall-clock check was: a GM who submits an
// offer and then simulates several SIMULATED days forward in one sitting
// (Bruno's normal testing flow) sees nothing resolve, because real time
// barely moved. Every one of these steps is already self-gated/idempotent
// (a no-op when there's nothing pending), so it's safe to also run it
// directly from the simulate flow — resolution now happens at the next
// simulated day boundary instead of waiting for real midnight. The daily
// cron stays in place too, as a safety net for whenever nobody is actively
// simulating.
export async function resolvePendingDecisions() {
  const offers = await resolveOffers()
  const staffOffers = await resolveStaffOffers()
  const freeAgency = await resolveFreeAgencyMarket(false)
  // Must run before Round 1 resolves — reorders the 14 non-playoff teams'
  // picks by the real weighted lottery draw instead of raw record. Self-gated
  // (no-op until the playoffs are actually finished, and idempotent after).
  const lottery = await resolveDraftLottery()
  const draftRound1 = await resolveDraftRound(1, false)
  const draftRound2 = await resolveDraftRound(2, false)
  const confirmSweep = await sweepExpiredDraftConfirmations()
  const optionSweep = await sweepExpiredRookieOptions()

  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  const currentWeek = (cfg?.current_week || 0) + 1
  const draftClassReminder = await resolveDraftClassReminder(currentWeek)

  return { offers, staffOffers, freeAgency, lottery, draftRound1, draftRound2, confirmSweep, optionSweep, draftClassReminder }
}

import { NextRequest, NextResponse } from 'next/server'
import { resolveOffers } from '@/lib/resolve-offers-core'
import { resolveStaffOffers } from '@/lib/resolve-staff-offers-core'
import { resolveFreeAgencyMarket } from '@/lib/resolve-free-agency-core'
import { resolveDraftRound, sweepExpiredDraftConfirmations, sweepExpiredRookieOptions } from '@/lib/draft-resolver'
import { resolveDraftLottery } from '@/lib/draft-lottery'

// Vercel's Hobby plan only allows 2 recurring cron jobs total, so every
// "resolve pending decisions" concern in the app (flat-rate FA pickups,
// staff-offer hiring, Free Agency week negotiation, both Draft rounds,
// expired confirmations/options) now runs from this single daily entry
// point instead of each having its own schedule. Every step below is a
// no-op most days — each one's own internal phase/deadline checks decide
// whether there's actually anything to do.
async function runAll() {
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
  return { offers, staffOffers, freeAgency, lottery, draftRound1, draftRound2, confirmSweep, optionSweep }
}

export async function GET(req: NextRequest) {
  return NextResponse.json(await runAll())
}

export async function POST(req: NextRequest) {
  return NextResponse.json(await runAll())
}

import { NextRequest, NextResponse } from 'next/server'
import { resolvePendingDecisions } from '@/lib/resolve-pending-decisions'

// Vercel's Hobby plan only allows 2 recurring cron jobs total, so every
// "resolve pending decisions" concern in the app (flat-rate FA pickups,
// staff-offer hiring, Free Agency week negotiation, both Draft rounds,
// expired confirmations/options) runs from this single daily entry point
// instead of each having its own schedule. This same logic also now runs
// from the simulate flow itself (see run.ts) — this daily cron is just the
// safety net for whenever nobody is actively simulating.
export async function GET(req: NextRequest) {
  return NextResponse.json(await resolvePendingDecisions())
}

export async function POST(req: NextRequest) {
  return NextResponse.json(await resolvePendingDecisions())
}

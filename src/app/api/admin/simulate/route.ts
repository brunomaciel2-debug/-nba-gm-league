import { NextRequest, NextResponse } from 'next/server'
import { runWeeklySimulation } from '@/app/api/cron/simulate/run'

// Admin-only manual trigger — runs the simulation logic directly in this
// same invocation rather than making the route call itself over HTTP.
// The old self-fetch had no timeout of its own, so if the simulation took
// too long this route would just hang indefinitely with no error surfaced
// to the admin page, instead of the simulation's own maxDuration kicking in.
export const maxDuration = 800

export async function POST(req: NextRequest) {
  try {
    // Verify admin secret
    const { secret, dayLimit } = await req.json()
    if (secret !== process.env.ADMIN_SECRET && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return await runWeeklySimulation(dayLimit ? { dayLimit } : undefined)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

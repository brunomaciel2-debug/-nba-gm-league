import { NextRequest, NextResponse } from 'next/server'
import { runWeeklySimulation } from './run'

// Called by Vercel Cron every Monday and Thursday at midnight Lisbon time
// Configure in vercel.json: {"crons": [{"path": "/api/cron/simulate", "schedule": "0 0 * * 1,4"}]}
// This does a lot of work per invocation (games, injuries, tactics, awards,
// notifications, etc.) — ask Vercel for as much execution time as the
// current plan allows instead of relying on its (often much lower) default.
export const maxDuration = 800

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runWeeklySimulation()
}

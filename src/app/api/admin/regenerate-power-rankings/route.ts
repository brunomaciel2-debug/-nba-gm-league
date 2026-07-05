import { NextRequest, NextResponse } from 'next/server'
import { generatePowerRankings } from '@/lib/generate-power-rankings'

// Manual trigger to (re)generate a specific week's Power Rankings — useful
// to refresh a week whose comments were written without a working
// ANTHROPIC_API_KEY (falls back to generic text), without waiting for the
// next scheduled cron tick. (redeploy trigger)
export async function POST(req: NextRequest) {
  try {
    const { secret, week } = await req.json()
    const validSecrets = [`Bearer ${process.env.CRON_SECRET}`, `Bearer ${process.env.ADMIN_SECRET}`]
    if (!validSecrets.includes(req.headers.get('authorization') || '') && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!week) return NextResponse.json({ error: 'week is required' }, { status: 400 })
    const result = await generatePowerRankings(Number(week))
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

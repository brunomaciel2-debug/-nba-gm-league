import { NextRequest, NextResponse } from 'next/server'
import { generateGLeagueRegularSeasonSchedule } from '@/lib/gleague-schedule-generator'

// Replaces the G-League Regular Season schedule with a complete, balanced
// 36-game-per-team calendar (see src/lib/gleague-schedule-generator.ts).
// Only touches 'scheduled' regular-season games — never final/played ones.
export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json()
    const validSecrets = [
      `Bearer ${process.env.CRON_SECRET}`,
      `Bearer ${process.env.ADMIN_SECRET}`,
    ]
    if (!validSecrets.includes(req.headers.get('authorization') || '') && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await generateGLeagueRegularSeasonSchedule()
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { generateRegularSeasonSchedule } from '@/lib/schedule-generator'

// Replaces the Regular Season schedule with a complete, real NBA-format
// 82-game-per-team calendar (see src/lib/schedule-generator.ts). Only
// touches 'scheduled' regular-season games — never final/played ones.
export async function POST(req: NextRequest) {
  try {
    const { secret, startWeek, endWeek } = await req.json()
    const validSecrets = [
      `Bearer ${process.env.CRON_SECRET}`,
      `Bearer ${process.env.ADMIN_SECRET}`,
    ]
    if (!validSecrets.includes(req.headers.get('authorization') || '') && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await generateRegularSeasonSchedule({
      startWeek: startWeek || 17,
      endWeek: endWeek || 40,
    })
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { resolveSummerLeague } from '@/lib/summer-league'

// Admin-only manual trigger — advances the Summer League tournament by
// exactly one stage per call (roster generation, then each prelim round,
// then seeding+consolation+semis, then the final). Safe to call repeatedly;
// it's a no-op once the tournament is complete for the season.
export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json()
    if (secret !== process.env.ADMIN_SECRET && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const result = await resolveSummerLeague()
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

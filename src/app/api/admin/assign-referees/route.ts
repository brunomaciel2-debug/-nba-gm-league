import { NextRequest, NextResponse } from 'next/server'
import { assignRefereesToScheduledGames } from '@/lib/referees'

// Admin-only manual trigger — assigns a referee to every scheduled game that
// doesn't have one yet, across the whole known future schedule in one pass.
// Safe to call repeatedly (only touches referee_id IS NULL rows).
export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json()
    if (secret !== process.env.ADMIN_SECRET && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const result = await assignRefereesToScheduledGames()
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

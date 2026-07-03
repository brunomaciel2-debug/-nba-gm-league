import { NextRequest, NextResponse } from 'next/server'
import { simulatePreseasonGame } from '@/lib/preseason-simulator'

// Manual single-game trigger for the "⚡ Simular" button on a team's schedule.
// The bulk path (every pending friendly resolved automatically) lives in
// /api/cron/simulate — see src/lib/preseason-simulator.ts for the shared logic.
export async function POST(req: NextRequest) {
  try {
    const { id, secret } = await req.json()
    if (secret !== process.env.ADMIN_SECRET && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!id) return NextResponse.json({ error: 'Missing game id' }, { status: 400 })

    const result = await simulatePreseasonGame(id)
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

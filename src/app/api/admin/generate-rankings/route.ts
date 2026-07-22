import { NextRequest, NextResponse } from 'next/server'
import { generatePowerRankings } from '@/lib/generate-power-rankings'

// Pre-Season Power Rankings (week 0) — used to duplicate the whole roster/
// coach/facility scoring + AI-comment logic in this file (with a stale
// facilities.grade column that no longer exists, always scoring facilities
// at 0). Now just the shared, criteria-based generator: with 0 games played
// everywhere, its adaptive weighting already collapses onto roster talent +
// trajectory + the real week-1 schedule difficulty + any real preseason
// injuries/trades — the same "way-too-early" signals a real preseason
// column leans on, with no duplicate implementation to drift out of sync.
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const validSecrets = [
    `Bearer ${process.env.CRON_SECRET}`,
    `Bearer ${process.env.ADMIN_SECRET}`,
  ]
  if (!validSecrets.includes(auth || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await generatePowerRankings(0)
    return NextResponse.json({ success: true, generated: result.generated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

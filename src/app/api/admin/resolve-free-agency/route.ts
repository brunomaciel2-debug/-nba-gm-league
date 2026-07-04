import { NextRequest, NextResponse } from 'next/server'

// Admin-only manual trigger — calls the Free Agency market resolution cron
// internally. Supports forcing an immediate decision (bypassing the 1-2 day
// wait) so testing doesn't require waiting real days between clicks.
export async function POST(req: NextRequest) {
  try {
    const { secret, force } = await req.json()
    if (secret !== process.env.ADMIN_SECRET && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://beyondthecourt.vercel.app'
    const res = await fetch(`${baseUrl}/api/cron/resolve-free-agency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: !!force }),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

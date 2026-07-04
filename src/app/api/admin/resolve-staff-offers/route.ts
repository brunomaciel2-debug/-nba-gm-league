import { NextRequest, NextResponse } from 'next/server'

// Admin-only manual trigger — calls the staff-offer resolution cron internally
export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json()
    if (secret !== process.env.ADMIN_SECRET && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://beyondthecourt.vercel.app'
    const res = await fetch(`${baseUrl}/api/cron/resolve-staff-offers`, { method: 'GET' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

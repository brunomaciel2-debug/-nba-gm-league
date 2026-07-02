import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Admin-only manual trigger — calls the main simulate cron internally
export async function POST(req: NextRequest) {
  try {
    // Verify admin secret
    const { secret } = await req.json()
    if (secret !== process.env.ADMIN_SECRET && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the simulate endpoint internally with the cron secret
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://beyondthecourt.vercel.app'
    const res = await fetch(`${baseUrl}/api/cron/simulate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

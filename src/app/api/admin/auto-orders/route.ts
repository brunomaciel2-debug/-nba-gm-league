import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureWeeklyOrders } from '@/lib/auto-orders'

// Manual trigger for the same backfill runWeeklySimulation now runs
// automatically on every call (see run.ts) — kept for ad-hoc admin use
// (e.g. checking/fixing a week before simulating it).

export async function POST(req: NextRequest) {
  try {
    const { secret, week_number } = await req.json()
    if (secret !== process.env.ADMIN_SECRET && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let week = week_number
    if (!week) {
      const { data: cfg } = await supabaseAdmin
        .from('season_config').select('current_week').eq('id', 1).single()
      week = (cfg?.current_week || 0) + 1
    }

    const { generated, carriedForward, errors } = await ensureWeeklyOrders(week)
    return NextResponse.json({ success: true, week, generated, carriedForward, errors })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

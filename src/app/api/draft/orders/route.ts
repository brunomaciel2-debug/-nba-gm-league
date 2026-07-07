import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isDraftSubmissionOpen } from '@/lib/season-week-helper'
import { getNextDraftSeason } from '@/lib/draft-lottery'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm?.team_id) return NextResponse.json({ error: 'No team assigned' }, { status: 403 })
  const NEXT_DRAFT = await getNextDraftSeason()

  const { round, rankedProspectIds } = await req.json()
  if (![1, 2].includes(round)) return NextResponse.json({ error: 'Invalid round' }, { status: 400 })
  if (!Array.isArray(rankedProspectIds) || rankedProspectIds.length === 0) {
    return NextResponse.json({ error: 'Ranked list cannot be empty' }, { status: 400 })
  }
  if (new Set(rankedProspectIds).size !== rankedProspectIds.length) {
    return NextResponse.json({ error: 'Duplicate prospects in the list' }, { status: 400 })
  }

  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  const nextWeek = (cfg?.current_week || 0) + 1
  if (gm.role !== 'commissioner' && !isDraftSubmissionOpen(round as 1 | 2, nextWeek)) {
    return NextResponse.json({ error: `Round ${round} submission window is not open this week.` }, { status: 400 })
  }

  const { data: validProspects } = await admin
    .from('prospects').select('id').eq('season', NEXT_DRAFT).eq('drafted', false)
    .in('id', rankedProspectIds)
  const validIds = new Set((validProspects || []).map((p: any) => p.id))
  if (rankedProspectIds.some((id: string) => !validIds.has(id))) {
    return NextResponse.json({ error: 'One or more prospects are invalid or already drafted' }, { status: 400 })
  }

  const { error } = await admin.from('draft_orders').upsert({
    team_id: gm.team_id, season: NEXT_DRAFT, round,
    preferences: { ranked_prospect_ids: rankedProspectIds },
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'team_id,season,round' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  const { data: gm } = await admin.from('gm_profiles').select('team_id').eq('id', user.id).single()
  if (!gm?.team_id) return NextResponse.json({ error: 'No team' }, { status: 403 })
  const NEXT_DRAFT = await getNextDraftSeason()

  const round = Number(req.nextUrl.searchParams.get('round'))
  const { data } = await admin.from('draft_orders').select('*').eq('team_id', gm.team_id).eq('season', NEXT_DRAFT).eq('round', round).maybeSingle()
  return NextResponse.json({ order: data || null })
}

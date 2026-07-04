import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Gives every NBA team a pool of sponsor options to choose from for the
// season — one entry per sponsor_templates row (3 tiers × 3 templates each).
// Safe to re-run: replaces the pool for the given season rather than
// duplicating it, so it won't touch a sponsor a GM has already picked.
export async function POST(req: NextRequest) {
  const { secret, season } = await req.json()
  const validSecrets = [
    `Bearer ${process.env.CRON_SECRET}`,
    `Bearer ${process.env.ADMIN_SECRET}`,
  ]
  if (!validSecrets.includes(req.headers.get('authorization') || '') && secret !== 'nba-admin-2025') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetSeason = season || '2025-26'

  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .not('id', 'in', '(ALL,RVS,ROO,SOP)')
  if (!teams?.length) return NextResponse.json({ error: 'No teams' }, { status: 500 })

  const { data: templates } = await supabase.from('sponsor_templates').select('id,tier')
  if (!templates?.length) return NextResponse.json({ error: 'No sponsor templates found' }, { status: 500 })

  // Don't touch pool entries a GM already picked — only (re)generate the rest
  const { data: existing } = await supabase
    .from('sponsor_pool')
    .select('id,team_id,template_id,chosen')
    .eq('season', targetSeason)
  const chosenKeys = new Set((existing || []).filter(e => e.chosen).map(e => `${e.team_id}|${e.template_id}`))
  const untouchedIds = (existing || []).filter(e => !e.chosen).map(e => e.id)

  if (untouchedIds.length > 0) {
    await supabase.from('sponsor_pool').delete().in('id', untouchedIds)
  }

  const rows = teams.flatMap((t: any) =>
    templates
      .filter((tpl: any) => !chosenKeys.has(`${t.id}|${tpl.id}`))
      .map((tpl: any) => ({
        team_id: t.id, template_id: tpl.id, tier: tpl.tier, season: targetSeason, chosen: false,
      }))
  )

  const { error } = await supabase.from('sponsor_pool').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, teams: teams.length, templates: templates.length, generated: rows.length })
}

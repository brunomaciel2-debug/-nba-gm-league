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

  const { data: templates } = await supabase.from('sponsor_templates').select('id,tier,fixed_annual')
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

  // GM Satisfaction consequence: last season's Sponsors score (real objectives
  // met vs offered) gates which templates surface this season — a team that
  // blew off its sponsors only sees the cheapest option per tier; a team that
  // delivered sees the full range including premium templates. Templates are
  // ranked by fixed_annual within their own tier (cheapest → priciest).
  const prevYear = parseInt(targetSeason.split('-')[0], 10) - 1
  const prevSeason = `${prevYear}-${String((prevYear + 1) % 100).padStart(2, '0')}`
  const { data: prevSnapshots } = await supabase
    .from('gm_satisfaction_snapshots')
    .select('team_id,sponsors_score,week_number')
    .eq('season', prevSeason)
    .order('week_number', { ascending: false })
  const sponsorsScoreByTeam: Record<string, number> = {}
  ;(prevSnapshots || []).forEach((s: any) => { if (!(s.team_id in sponsorsScoreByTeam)) sponsorsScoreByTeam[s.team_id] = s.sponsors_score ?? 55 })

  const templatesByTier: Record<string, any[]> = {}
  templates.forEach((tpl: any) => { (templatesByTier[tpl.tier] ||= []).push(tpl) })
  Object.values(templatesByTier).forEach(list => list.sort((a, b) => (a.fixed_annual || 0) - (b.fixed_annual || 0)))

  function allowedTemplateIdsForTeam(teamId: string): Set<string> {
    // No history yet (first season, or team never had a snapshot) → don't
    // punish a team that hasn't had a chance to prove itself, mid-range default.
    const score = sponsorsScoreByTeam[teamId] ?? 55
    const allowed = new Set<string>()
    for (const list of Object.values(templatesByTier)) {
      if (score < 40) allowed.add(list[0].id) // cheapest only
      else if (score <= 70) list.slice(0, Math.max(1, Math.ceil(list.length * 2 / 3))).forEach(tpl => allowed.add(tpl.id)) // bottom 2/3
      else list.forEach(tpl => allowed.add(tpl.id)) // full range
    }
    return allowed
  }

  const rows = teams.flatMap((t: any) => {
    const allowed = allowedTemplateIdsForTeam(t.id)
    return templates
      .filter((tpl: any) => !chosenKeys.has(`${t.id}|${tpl.id}`) && allowed.has(tpl.id))
      .map((tpl: any) => ({
        team_id: t.id, template_id: tpl.id, tier: tpl.tier, season: targetSeason, chosen: false,
      }))
  })

  const { error } = await supabase.from('sponsor_pool').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, teams: teams.length, templates: templates.length, generated: rows.length })
}

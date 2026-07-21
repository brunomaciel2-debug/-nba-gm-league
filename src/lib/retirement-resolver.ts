import { supabaseAdmin } from '@/lib/supabase'
import { REGULAR_SEASON_END_WEEK } from '@/lib/allstar-constants'

const SEASON = '2025-26'
const RETIREMENT_AGE = 35
// "2 months before the season ends" — this codebase's own end-of-season
// marker is REGULAR_SEASON_END_WEEK (see run.ts's isEndOfSeason), not the
// later end of playoffs, so the warning window is relative to that.
const WARNING_START_WEEK = REGULAR_SEASON_END_WEEK - 8

// GM-facing heads-up only — "he's pondering retirement", nothing decided
// yet. Runs every week from 8 weeks out through the season's last week,
// re-checking (idempotently, via inbox_messages) which eligible players
// haven't been warned about yet this season, so a player who turns 35
// mid-window still gets one.
export async function resolveRetirementWarnings(week: number): Promise<{ warned: number }> {
  if (week < WARNING_START_WEEK || week > REGULAR_SEASON_END_WEEK) return { warned: 0 }

  const { data: eligible } = await supabaseAdmin.from('players')
    .select('id,name,team_id,age').eq('status', 'active').not('team_id', 'is', null).gte('age', RETIREMENT_AGE)
  if (!eligible?.length) return { warned: 0 }

  // This app only ever tracks one season at a time (SEASON is hardcoded
  // the same way everywhere else in this codebase), so "ever warned" and
  // "warned this season" are the same check here.
  const { data: alreadyWarned } = await supabaseAdmin.from('inbox_messages')
    .select('metadata').eq('type', 'retirement_warning')
  const warnedIds = new Set((alreadyWarned || []).map((m: any) => m.metadata?.player_id))

  const toWarn = eligible.filter((p: any) => !warnedIds.has(p.id))
  for (const p of toWarn) {
    await supabaseAdmin.from('inbox_messages').insert({
      to_team_id: p.team_id, type: 'retirement_warning',
      subject: `🤔 ${p.name} is pondering retirement`,
      body: `${p.name} (${p.age}) is thinking about whether this could be his final season. Nothing is decided yet — just something to keep in mind as the season winds down.`,
      read: false, metadata: { player_id: p.id },
    })
  }
  return { warned: toWarn.length }
}

// End-of-season: every player old enough gets a real decision queued for
// the Commissioner (see /admin/retirements) — stay one more year, or retire
// for good. Idempotent by design (checks who's already queued this season
// before inserting), so it's safe even if isEndOfSeason's week fires twice.
export async function queueRetirementDecisions(): Promise<{ queued: number }> {
  const { data: eligible } = await supabaseAdmin.from('players')
    .select('id,team_id').eq('status', 'active').not('team_id', 'is', null).gte('age', RETIREMENT_AGE)
  if (!eligible?.length) return { queued: 0 }

  const { data: existing } = await supabaseAdmin.from('retirement_decisions').select('player_id').eq('season', SEASON)
  const existingIds = new Set((existing || []).map((r: any) => r.player_id))

  const toQueue = eligible.filter((p: any) => !existingIds.has(p.id))
  if (!toQueue.length) return { queued: 0 }

  await supabaseAdmin.from('retirement_decisions').insert(
    toQueue.map((p: any) => ({ season: SEASON, player_id: p.id, team_id: p.team_id, status: 'pending' }))
  )

  // One commissioner notification per batch — not one per player, or the
  // inbox would flood every time this queues a big class of veterans at once.
  await supabaseAdmin.from('inbox_messages').insert({
    to_team_id: 'commissioner', type: 'system',
    subject: `🏀 ${toQueue.length} retirement decision${toQueue.length !== 1 ? 's' : ''} pending`,
    body: `${toQueue.length} veteran player${toQueue.length !== 1 ? 's are' : ' is'} old enough to consider retirement this season. Review at /admin/retirements.`,
    read: false, metadata: { count: toQueue.length },
  })

  return { queued: toQueue.length }
}

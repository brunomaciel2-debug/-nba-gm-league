import { supabaseAdmin } from '@/lib/supabase'
import { REGULAR_SEASON_END_WEEK } from '@/lib/allstar-constants'
import { fetchAllRows } from '@/lib/paginate'

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

  const eligible = await fetchAllRows((from,to) => supabaseAdmin.from('players')
    .select('id,name,team_id,age').eq('status', 'active').not('team_id', 'is', null).gte('age', RETIREMENT_AGE).range(from,to))
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
  const eligible = await fetchAllRows((from,to) => supabaseAdmin.from('players')
    .select('id,team_id').eq('status', 'active').not('team_id', 'is', null).gte('age', RETIREMENT_AGE).range(from,to))
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
    read: false, metadata: { count: toQueue.length, view_retirements_page: true },
  })

  return { queued: toQueue.length }
}

// The Commissioner can decide a player's fate (see /admin/retirements) any
// time after it's queued, but the roster change itself must wait until the
// season is TRULY over — playoffs finished, champion crowned — not the
// moment the decision is clicked. A player queued to leave for free agency
// is still needed on his team's playoff roster until then. Called once,
// right when the NBA Finals resolve (see recordChampionship in
// playoff-resolver.ts), so every 'decided' row gets applied in one pass.
export async function executeDecidedRetirements(week?: number | null): Promise<{ executed: number }> {
  const { data: decided } = await supabaseAdmin.from('retirement_decisions')
    .select('*, players(name,contract_years,salary), teams(name)').eq('season', SEASON).eq('status', 'decided')
  if (!decided?.length) return { executed: 0 }

  for (const d of decided) {
    const teamName = d.teams?.name || d.team_id
    if (d.decision === 'retire') {
      await supabaseAdmin.from('players').update({ status: 'retired', team_id: null, contract_years: 0 }).eq('id', d.player_id)
      await supabaseAdmin.from('transactions').insert({
        type: 'retirement', category: 'player',
        description: `${d.players?.name} announces his retirement`,
        teams: [d.team_id], players: [d.players?.name], player_ids: [d.player_id], status: 'completed', week_number: week ?? null,
      })
      await supabaseAdmin.from('inbox_messages').insert({
        to_team_id: d.team_id, type: 'contract',
        subject: `👋 ${d.players?.name} has retired`,
        body: `After careful consideration, ${d.players?.name} has decided it's time to hang up his sneakers and step away from professional basketball. Thank you for the memories.`,
        read: false, metadata: { player_id: d.player_id },
      })
    } else if (d.decision === 'stay') {
      // "Stay" only means he isn't retiring — it says nothing about WHERE he
      // plays next. A player finishing the last year of his deal (1 or 0
      // contract_years left) isn't obligated to re-sign here; he walks into
      // free agency instead. Unlike a cut, this is a natural expiry: no dead
      // cap, and the team's cap space actually opens back up.
      const contractEnded = (d.players?.contract_years ?? 1) <= 1
      if (contractEnded) {
        const { data: team } = await supabaseAdmin.from('teams').select('cap_used').eq('id', d.team_id).single()
        await supabaseAdmin.from('players').update({
          team_id: null, contract_years: 0, previous_team_id: d.team_id, dead_cap_amount: 0,
        }).eq('id', d.player_id)
        if (team) {
          await supabaseAdmin.from('teams').update({
            cap_used: Math.max(0, (team.cap_used || 0) - (d.players?.salary || 0)),
          }).eq('id', d.team_id)
        }
        await supabaseAdmin.from('transactions').insert({
          type: 'waiver', category: 'player',
          description: `${d.players?.name}'s contract with ${teamName} expires; he decides to keep playing and becomes a free agent`,
          teams: [d.team_id], players: [d.players?.name], player_ids: [d.player_id], status: 'completed', week_number: week ?? null,
        })
        await supabaseAdmin.from('inbox_messages').insert({
          to_team_id: d.team_id, type: 'contract',
          subject: `🏀 ${d.players?.name} is coming back!`,
          body: `After careful consideration, ${d.players?.name} has decided it isn't time to hang up his sneakers just yet. With his contract with ${teamName} up, he'll enter free agency looking for his next team.`,
          read: false, metadata: { player_id: d.player_id },
        })
      } else {
        await supabaseAdmin.from('transactions').insert({
          type: 'extension', category: 'player',
          description: `${d.players?.name} returns for one more season with ${teamName}`,
          teams: [d.team_id], players: [d.players?.name], player_ids: [d.player_id], status: 'completed', week_number: week ?? null,
        })
        await supabaseAdmin.from('inbox_messages').insert({
          to_team_id: d.team_id, type: 'contract',
          subject: `🏀 ${d.players?.name} is coming back!`,
          body: `After careful consideration, ${d.players?.name} has decided it isn't time to hang up his sneakers just yet — he'll suit up for ${teamName} for at least one more season.`,
          read: false, metadata: { player_id: d.player_id },
        })
      }
    }
    await supabaseAdmin.from('retirement_decisions').update({ status: 'executed' }).eq('id', d.id)
  }
  return { executed: decided.length }
}

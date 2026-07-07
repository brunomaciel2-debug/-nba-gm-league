import { createClient } from '@supabase/supabase-js'
import { getTeamLang, notifDraftLotteryResult } from './notifications-helpers'
import { NEXT_DRAFT } from './draft-constants'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Current in-season identifier — distinct from NEXT_DRAFT (the draft CLASS
// year, e.g. '2027'), since playoff_series/teams are keyed by the season
// actually being played, not the draft class being resolved.
const SEASON = '2025-26'

// Real, official NBA lottery odds since the 2019 reform: 1,000
// combinations distributed across the 14 non-playoff teams (worst record
// = seed index 0 = best odds). Sums to exactly 1000.
export const LOTTERY_COMBOS = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5]
export const LOTTERY_TOTAL_COMBOS = LOTTERY_COMBOS.reduce((s, c) => s + c, 0) // 1000

export interface LotteryTeamSeed { team_id: string, original_seed: number }
export interface LotteryResult { team_id: string, original_seed: number, resulting_pick: number, odds_pct: number }

// The 14 lottery-eligible teams for a season: every real team that never
// appears as team_high/team_low in a `round: 2` playoff_series row (this
// codebase's internal numbering for the real first playoff round — round 1
// is the play-in). Sorted worst-to-best by regular-season record, same
// tie-break already used in draft-resolver.ts's existing sort.
export async function getLotteryTeams(): Promise<LotteryTeamSeed[]> {
  const { data: playoffSeries } = await admin.from('playoff_series').select('team_high,team_low').eq('season', SEASON).eq('round', 2)
  const playoffTeamIds = new Set<string>()
  ;(playoffSeries || []).forEach((s: any) => { if (s.team_high) playoffTeamIds.add(s.team_high); if (s.team_low) playoffTeamIds.add(s.team_low) })

  const { data: teams } = await admin.from('teams').select('id,wins,losses').not('id', 'in', '(ALL,RVS,ROO,SOP)')
  const lotteryTeams = (teams || []).filter((t: any) => !playoffTeamIds.has(t.id))
  const sorted = [...lotteryTeams].sort((a: any, b: any) =>
    ((a.wins ?? 0) - (b.wins ?? 0)) || ((b.losses ?? 0) - (a.losses ?? 0))
  )
  return sorted.map((t: any, i: number) => ({ team_id: t.id, original_seed: i + 1 }))
}

// Weighted draw without replacement for the top 4 picks only — real format
// since 2019. Picks 5-14 simply fill in the remaining teams' original seed
// order, which is what guarantees no team ever drops more than 4 spots
// below its seed (only 4 spots are ever up for grabs above them).
export function drawLottery(sortedTeams: LotteryTeamSeed[]): LotteryResult[] {
  const pool = sortedTeams.map((t, i) => ({ ...t, combos: LOTTERY_COMBOS[i] ?? 5 }))
  const oddsByTeam: Record<string, number> = {}
  pool.forEach(t => { oddsByTeam[t.team_id] = (t.combos / LOTTERY_TOTAL_COMBOS) * 100 })

  const drawnOrder: LotteryTeamSeed[] = []
  let remaining = [...pool]
  for (let pick = 0; pick < 4 && remaining.length > 0; pick++) {
    const totalCombos = remaining.reduce((s, t) => s + t.combos, 0)
    let r = Math.random() * totalCombos
    let winner = remaining[remaining.length - 1]
    for (const t of remaining) { r -= t.combos; if (r <= 0) { winner = t; break } }
    drawnOrder.push({ team_id: winner.team_id, original_seed: winner.original_seed })
    remaining = remaining.filter(t => t.team_id !== winner.team_id)
  }
  // Whoever wasn't drawn into the top 4 fills 5-14 in original seed order.
  const drawnIds = new Set(drawnOrder.map(t => t.team_id))
  const rest = sortedTeams.filter(t => !drawnIds.has(t.team_id))
  const finalOrder = [...drawnOrder, ...rest]

  return finalOrder.map((t, i) => ({
    team_id: t.team_id, original_seed: t.original_seed, resulting_pick: i + 1,
    odds_pct: oddsByTeam[t.team_id],
  }))
}

// Self-gated — safe to call every day from resolve-all: skips if the
// lottery already ran this season (idempotent), and skips until the
// playoffs are actually completely finished (every playoff_series row for
// the season must be status='completed', not just the regular season over).
export async function resolveDraftLottery(): Promise<{ skipped: boolean, results?: LotteryResult[] }> {
  const { count: alreadyDone } = await admin.from('draft_lottery_results').select('id', { count: 'exact', head: true }).eq('season', NEXT_DRAFT)
  if (alreadyDone && alreadyDone > 0) return { skipped: true }

  const { count: unfinished } = await admin.from('playoff_series').select('id', { count: 'exact', head: true }).eq('season', SEASON).neq('status', 'completed')
  const { count: anySeries } = await admin.from('playoff_series').select('id', { count: 'exact', head: true }).eq('season', SEASON)
  if (!anySeries || (unfinished && unfinished > 0)) return { skipped: true }

  const sortedTeams = await getLotteryTeams()
  if (sortedTeams.length !== 14) {
    console.warn(`Draft Lottery: expected 14 lottery teams, found ${sortedTeams.length} — skipping.`)
    return { skipped: true }
  }

  const results = drawLottery(sortedTeams)
  await admin.from('draft_lottery_results').insert(results.map(r => ({
    season: NEXT_DRAFT, team_id: r.team_id, original_seed: r.original_seed,
    resulting_pick: r.resulting_pick, odds_pct: r.odds_pct,
  })))

  for (const r of results) {
    const lang = await getTeamLang(r.team_id)
    const notif = notifDraftLotteryResult(lang, r.resulting_pick, r.original_seed, r.odds_pct)
    await admin.from('inbox_messages').insert({
      to_team_id: r.team_id, type: 'draft', subject: notif.subject, body: notif.body,
      read: false, metadata: { resulting_pick: r.resulting_pick, original_seed: r.original_seed },
    })
  }

  return { skipped: false, results }
}

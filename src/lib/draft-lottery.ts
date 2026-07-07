import { createClient } from '@supabase/supabase-js'
import { getTeamLang, notifDraftLotteryResult } from './notifications-helpers'
import { DEFAULT_DRAFT_SEASON } from './draft-constants'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Current in-season identifier — distinct from the draft CLASS year (e.g.
// '2027'), since playoff_series/teams are keyed by the season actually
// being played, not the draft class being resolved.
const SEASON = '2025-26'

// The draft-class season tag now lives in the `draft_config` table instead
// of a hardcoded constant — set once by the initial migration, and updated
// automatically every time a new Draft Class is uploaded through
// /admin/draft-class (see setNextDraftSeason() below). No code change or
// redeploy needed each season anymore.
export async function getNextDraftSeason(): Promise<string> {
  const { data } = await admin.from('draft_config').select('next_draft_season').eq('id', 1).maybeSingle()
  return data?.next_draft_season || DEFAULT_DRAFT_SEASON
}
export async function setNextDraftSeason(season: string): Promise<void> {
  await admin.from('draft_config').upsert({ id: 1, next_draft_season: season, updated_at: new Date().toISOString() })
}

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

// Real NBA rule for the 16 playoff teams' picks (15-30): ordered by
// furthest elimination round reached — earliest exit picks earliest, the
// NBA Finals loser picks 29th, and the champion always picks 30th/last.
// Ties within the same round break by worse regular-season record, same
// tie-break used everywhere else in this file. Fully deterministic from
// playoff_series, so unlike the lottery draw this is recomputed live each
// call rather than persisted.
export async function getPlayoffFinishOrder(): Promise<Record<string, number>> {
  const { data: series } = await admin.from('playoff_series').select('*').eq('season', SEASON).eq('status', 'completed')
  const { data: teams } = await admin.from('teams').select('id,wins,losses')
  const recordByTeam: Record<string, { wins: number, losses: number }> = {}
  ;(teams || []).forEach((t: any) => { recordByTeam[t.id] = { wins: t.wins ?? 0, losses: t.losses ?? 0 } })

  // real playoff rounds only (2=Round 1, 3=Conf Semis, 4=Conf Finals, 5=Finals)
  const byRound: Record<number, any[]> = {}
  ;(series || []).forEach((s: any) => { if (s.round >= 2) (byRound[s.round] ||= []).push(s) })

  const loserOf = (s: any) => (s.wins_high > s.wins_low ? s.team_low : s.team_high)
  const winnerOf = (s: any) => (s.wins_high > s.wins_low ? s.team_high : s.team_low)

  const sortByRecord = (ids: string[]) => [...ids].sort((a, b) => {
    const ra = recordByTeam[a] || { wins: 0, losses: 0 }, rb = recordByTeam[b] || { wins: 0, losses: 0 }
    return (ra.wins - rb.wins) || (rb.losses - ra.losses)
  })

  const rankByTeam: Record<string, number> = {}
  let rank = 1
  for (const round of [2, 3, 4]) {
    const losers = sortByRecord((byRound[round] || []).map(loserOf).filter(Boolean))
    for (const teamId of losers) rankByTeam[teamId] = rank++
  }
  const finals = (byRound[5] || [])[0]
  if (finals) {
    rankByTeam[loserOf(finals)] = rank++
    rankByTeam[winnerOf(finals)] = rank++ // champion — always the last pick, 30th overall
  }
  return rankByTeam
}

// Self-gated — safe to call every day from resolve-all: skips if the
// lottery already ran this season (idempotent), and skips until the
// playoffs are actually completely finished (every playoff_series row for
// the season must be status='completed', not just the regular season over).
export async function resolveDraftLottery(): Promise<{ skipped: boolean, results?: LotteryResult[] }> {
  const NEXT_DRAFT = await getNextDraftSeason()
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

// Self-gated, idempotent commissioner reminder: fires once when the
// playoffs begin (week 41) if next season's Draft Class hasn't been
// uploaded yet, and again at week 50 (the Round 1 pick-order submission
// deadline) if it's still missing — both checked against the same
// inbox_messages row (keyed by trigger_week) so a daily cron never repeats
// the same reminder twice.
export async function resolveDraftClassReminder(currentWeek: number): Promise<{ sent: boolean }> {
  if (currentWeek !== 41 && currentWeek !== 50) return { sent: false }

  const NEXT_DRAFT = await getNextDraftSeason()
  const { count: prospectCount } = await admin.from('prospects').select('id', { count: 'exact', head: true }).eq('season', NEXT_DRAFT)
  if (prospectCount && prospectCount > 0) return { sent: false }

  const { count: alreadySent } = await admin.from('inbox_messages').select('id', { count: 'exact', head: true })
    .eq('type', 'draft_class_reminder').eq('to_team_id', 'commissioner')
    .contains('metadata', { trigger_week: currentWeek, season: NEXT_DRAFT })
  if (alreadySent && alreadySent > 0) return { sent: false }

  const urgent = currentWeek === 50
  await admin.from('inbox_messages').insert({
    to_team_id: 'commissioner',
    type: 'draft_class_reminder',
    subject: urgent
      ? `⏰ Draft Class for ${NEXT_DRAFT} is still missing — deadline this week`
      : `🎓 Time to upload the ${NEXT_DRAFT} Draft Class`,
    body: urgent
      ? `The playoffs are almost over and no prospects have been uploaded yet for the ${NEXT_DRAFT} Draft Class. Round 1 draft day is coming up fast — go to /admin/draft-class to download the template, fill it in, and upload it before the draft resolves.`
      : `The playoffs have started, which means the ${NEXT_DRAFT} Draft is getting close. Go to /admin/draft-class to download the CSV template, fill in this season's prospects, and upload it whenever you're ready.`,
    read: false,
    metadata: { trigger_week: currentWeek, season: NEXT_DRAFT },
  })

  return { sent: true }
}

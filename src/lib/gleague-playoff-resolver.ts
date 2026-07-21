import { supabaseAdmin } from '@/lib/supabase'
import { buildTeamBox } from '@/lib/gleague-simulator'

const SEASON = '2025-26'

// Top 8 per conference (16 total) qualify — matches the "Top 8 qualify for
// playoffs" text already shown on /gleague's Standings tab. Same bracket
// SHAPE as the NBA's playoff-resolver.ts (Round 1 -> Round 2 -> Conference
// Final -> Finals, just without a Play-In), but every series is a single
// game instead of best-of-7 — real G-League playoffs are a short, quick
// format, which also keeps this genuinely distinct from the NBA bracket
// rather than a smaller copy of it. Uses the same lightweight
// buildTeamBox() formula as the regular season (no possession engine,
// matchups, or tactics — this league never has any of that), not
// simulateGame().
function buildAdvanceMap(conf: 'eastern' | 'western'): Record<string, { seriesType: string, slot: 'team_high' | 'team_low' }> {
  const c = conf
  return {
    [`r1_${c}_1v8`]: { seriesType: `r2_${c}_a`, slot: 'team_high' },
    [`r1_${c}_4v5`]: { seriesType: `r2_${c}_a`, slot: 'team_low' },
    [`r1_${c}_2v7`]: { seriesType: `r2_${c}_b`, slot: 'team_high' },
    [`r1_${c}_3v6`]: { seriesType: `r2_${c}_b`, slot: 'team_low' },
    [`r2_${c}_a`]: { seriesType: `cf_${c}`, slot: 'team_high' },
    [`r2_${c}_b`]: { seriesType: `cf_${c}`, slot: 'team_low' },
  }
}
const ADVANCE_MAP: Record<string, { seriesType: string, slot: 'team_high' | 'team_low' }> = {
  ...buildAdvanceMap('eastern'), ...buildAdvanceMap('western'),
}

function weekForSeries(seriesType: string): number {
  if (seriesType.startsWith('r1_')) return 14
  if (seriesType.startsWith('r2_')) return 15
  if (seriesType.startsWith('cf_')) return 16
  return 17 // gl_finals
}

async function fillSlot(seriesType: string, slot: 'team_high' | 'team_low', teamId: string) {
  await supabaseAdmin.from('gleague_playoff_series').update({ [slot]: teamId, status: 'active' }).eq('season', SEASON).eq('series_type', seriesType)
}

async function seedBracket() {
  const { data: teams } = await supabaseAdmin.from('gleague_teams').select('id,conference,wins,losses')
  if (!teams?.length) return

  const seedsByConf: Record<string, any[]> = {}
  for (const t of teams) (seedsByConf[t.conference] ||= []).push(t)
  for (const conf of Object.keys(seedsByConf)) {
    seedsByConf[conf].sort((a, b) => {
      const aPct = a.wins / Math.max(1, a.wins + a.losses), bPct = b.wins / Math.max(1, b.wins + b.losses)
      return bPct - aPct || b.wins - a.wins
    })
  }

  const rows: any[] = []
  for (const [conf, teamsList] of Object.entries(seedsByConf)) {
    const seeds = teamsList.slice(0, 8) // top 8 — matches /gleague's own "Top 8 qualify" text
    if (seeds.length < 8) continue
    const [s1, s2, s3, s4, s5, s6, s7, s8] = seeds
    const key = conf.toLowerCase()
    rows.push({ season: SEASON, series_type: `r1_${key}_1v8`, team_high: s1.id, team_low: s8.id, games_needed: 1, status: 'active' })
    rows.push({ season: SEASON, series_type: `r1_${key}_4v5`, team_high: s4.id, team_low: s5.id, games_needed: 1, status: 'active' })
    rows.push({ season: SEASON, series_type: `r1_${key}_2v7`, team_high: s2.id, team_low: s7.id, games_needed: 1, status: 'active' })
    rows.push({ season: SEASON, series_type: `r1_${key}_3v6`, team_high: s3.id, team_low: s6.id, games_needed: 1, status: 'active' })
    rows.push({ season: SEASON, series_type: `r2_${key}_a`, team_high: null, team_low: null, games_needed: 1, status: 'pending' })
    rows.push({ season: SEASON, series_type: `r2_${key}_b`, team_high: null, team_low: null, games_needed: 1, status: 'pending' })
    rows.push({ season: SEASON, series_type: `cf_${key}`, team_high: null, team_low: null, games_needed: 1, status: 'pending' })
  }
  if (!rows.length) return
  rows.push({ season: SEASON, series_type: 'gl_finals', team_high: null, team_low: null, games_needed: 1, status: 'pending' })
  await supabaseAdmin.from('gleague_playoff_series').insert(rows.map(r => ({ ...r, wins_high: 0, wins_low: 0 })))
}

async function advanceWinner(seriesType: string, winnerId: string) {
  if (seriesType === 'cf_eastern' || seriesType === 'cf_western') {
    const { data: finals } = await supabaseAdmin.from('gleague_playoff_series').select('*').eq('season', SEASON).eq('series_type', 'gl_finals').single()
    const { data: winnerTeam } = await supabaseAdmin.from('gleague_teams').select('wins,losses').eq('id', winnerId).single()
    const otherSlotFilled = finals?.team_high || finals?.team_low
    if (!otherSlotFilled) { await fillSlot('gl_finals', 'team_high', winnerId); return }
    const { data: otherTeam } = await supabaseAdmin.from('gleague_teams').select('wins,losses').eq('id', otherSlotFilled).single()
    const winnerPct = (winnerTeam?.wins || 0) / Math.max(1, (winnerTeam?.wins || 0) + (winnerTeam?.losses || 0))
    const otherPct = (otherTeam?.wins || 0) / Math.max(1, (otherTeam?.wins || 0) + (otherTeam?.losses || 0))
    if (winnerPct > otherPct) {
      await supabaseAdmin.from('gleague_playoff_series').update({ team_high: winnerId, team_low: otherSlotFilled }).eq('season', SEASON).eq('series_type', 'gl_finals')
    } else {
      await fillSlot('gl_finals', 'team_low', winnerId)
    }
    return
  }
  const advance = ADVANCE_MAP[seriesType]
  if (!advance) return
  await fillSlot(advance.seriesType, advance.slot, winnerId)
}

async function recordChampionship(championId: string, runnerUpId: string) {
  const { data: teams } = await supabaseAdmin.from('gleague_teams').select('id,name').in('id', [championId, runnerUpId])
  const nameById: Record<string, string> = {}
  ;(teams || []).forEach((t: any) => { nameById[t.id] = t.name })
  await supabaseAdmin.from('championship_history').insert({
    season: SEASON, league: 'gleague',
    champion_team_id: championId, champion_team_name: nameById[championId] || championId,
    runner_up_team_id: runnerUpId, runner_up_team_name: nameById[runnerUpId] || runnerUpId,
  })
}

// Advances the bracket by one game per still-open series, per call — same
// idempotent, call-repeatedly shape as playoff-resolver.ts. Only begins
// once every regular-season G-League game has actually been played (the
// real schedule decides, never a guessed week number — see the comment
// history in run.ts's G-League catch-up block for why that matters here).
export async function resolveGLeaguePlayoffs(week: number): Promise<{ processed: number }> {
  const { count: pendingRegular } = await supabaseAdmin.from('gleague_games')
    .select('*', { count: 'exact', head: true }).eq('season', SEASON).eq('game_type', 'regular').eq('status', 'scheduled')
  if (pendingRegular && pendingRegular > 0) return { processed: 0 }

  const { count: existingSeries } = await supabaseAdmin.from('gleague_playoff_series')
    .select('*', { count: 'exact', head: true }).eq('season', SEASON)
  if (!existingSeries) {
    // Also bail if the regular season simply hasn't started yet (no games
    // played at all) — otherwise this would seed a bracket on day one.
    const { count: anyPlayed } = await supabaseAdmin.from('gleague_games')
      .select('*', { count: 'exact', head: true }).eq('season', SEASON).eq('game_type', 'regular').eq('status', 'final')
    if (!anyPlayed) return { processed: 0 }
    await seedBracket()
  }

  const { data: series } = await supabaseAdmin.from('gleague_playoff_series').select('*').eq('season', SEASON).neq('status', 'completed')
  if (!series?.length) return { processed: 0 }

  let processed = 0
  for (const s of series) {
    if (!s.team_high || !s.team_low) continue // still waiting on a previous round

    const homeTeamId = s.team_high // single game — higher seed / better record always hosts
    const awayTeamId = s.team_low

    const { data: roster } = await supabaseAdmin.from('players').select('*').in('gleague_team_id', [homeTeamId, awayTeamId])
    const homeBox = buildTeamBox((roster || []).filter((p: any) => p.gleague_team_id === homeTeamId), homeTeamId)
    const awayBox = buildTeamBox((roster || []).filter((p: any) => p.gleague_team_id === awayTeamId), awayTeamId)
    if (!homeBox.length || !awayBox.length) continue

    const homeScore = homeBox.reduce((sum, b) => sum + b.pts, 0)
    const awayScore = awayBox.reduce((sum, b) => sum + b.pts, 0)

    const { data: gameRec } = await supabaseAdmin.from('gleague_games').insert({
      season: SEASON, week_number: weekForSeries(s.series_type),
      home_team: homeTeamId, away_team: awayTeamId,
      home_score: homeScore, away_score: awayScore, status: 'final',
      played_at: new Date().toISOString(), game_type: 'playoff',
    }).select().single()

    if (gameRec) {
      const withGameId = [...homeBox, ...awayBox].map(b => ({ ...b, game_id: gameRec.id }))
      await supabaseAdmin.from('gleague_box_scores').insert(withGameId)
    }
    processed++

    // Single game — decided immediately. Playoff results never touch
    // gleague_teams.wins/losses (same as the NBA bracket): those numbers
    // are the regular-season record this bracket was seeded from, and must
    // stay that way for next season's seeding too.
    const homeWon = homeScore > awayScore
    const winnerId = homeWon ? homeTeamId : awayTeamId
    const loserId = homeWon ? awayTeamId : homeTeamId
    await supabaseAdmin.from('gleague_playoff_series').update({
      status: 'completed', wins_high: homeWon ? 1 : 0, wins_low: homeWon ? 0 : 1,
    }).eq('id', s.id)
    await advanceWinner(s.series_type, winnerId)
    if (s.series_type === 'gl_finals') await recordChampionship(winnerId, loserId)
  }
  return { processed }
}

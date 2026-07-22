import { createClient } from '@supabase/supabase-js'
import { computeRosterQuality, normalizeRosterQuality, computeTop5AvgAge, countHighPotential } from './roster-quality'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function clamp01(v: number): number { return Math.min(1, Math.max(0, v)) }
function eloNorm(elo: number): number { return clamp01(((elo ?? 1500) - 1300) / 400) }
function round2(v: number): number { return Math.round(v * 100) / 100 }

type Grade = 'good' | 'neutral' | 'bad'
type CriteriaBlock = { key: string, grade: Grade, score: number, data: Record<string, any> }

// Replaces the old AI-written 2-sentence comment (which depended on a paid
// Anthropic API budget that ran out in days, not the "months" originally
// planned) with 9 deterministic, data-only criteria blocks. TeamPageTabs-
// style separation of concerns: this file computes facts + a grade + a
// 0-1 score per block; the frontend (power-rankings/page.tsx) owns all
// icons, labels and i18n text, same as elsewhere in the app.
export async function generatePowerRankings(week: number) {
  // Fetch all active teams with their data
  const { data: teams } = await supabase
    .from('teams')
    .select('id,name,wins,losses,pts_for,pts_against,conference,division,rival_team_id,elo')
    .not('id', 'in', '(ALL,RVS,ROO,SOP)')
    .order('wins', { ascending: false })

  if (!teams?.length) return { generated: 0 }

  const teamNameMap: Record<string, string> = {}
  const teamEloMap: Record<string, number> = {}
  teams.forEach((t: any) => { teamNameMap[t.id] = t.name; teamEloMap[t.id] = t.elo ?? 1500 })

  const { data: cfg } = await supabase.from('season_config').select('season').eq('id', 1).single()
  const currentSeason = cfg?.season || '2025-26'
  const currentSeasonYear = parseInt(currentSeason.split('-')[0], 10)

  // Every active player (real_ovr/usage/age/potential_grade feed roster
  // quality + trajectory below)
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id,name,pos,team_id,real_ovr,usage,age,potential_grade')
    .eq('status', 'active')
    .not('team_id', 'is', null)
    .order('real_ovr', { ascending: false })

  const teamPlayersMap: Record<string, {name:string,pos:string}[]> = {}
  const teamRosterMap: Record<string, any[]> = {}
  for (const p of (allPlayers || [])) {
    if (!p.team_id) continue
    ;(teamRosterMap[p.team_id] ||= []).push(p)
    if (!teamPlayersMap[p.team_id]) teamPlayersMap[p.team_id] = []
    if (teamPlayersMap[p.team_id].length < 2) {
      teamPlayersMap[p.team_id].push({ name: p.name, pos: p.pos })
    }
  }

  // Last 5 games per team
  const { data: recentGames } = await supabase
    .from('games')
    .select('id,home_team,away_team,home_score,away_score,played_at,week_number')
    .eq('season', '2025-26')
    .eq('status', 'final')
    .order('played_at', { ascending: false })
    .limit(300)

  // Next week's real matchups (schedule difficulty ahead)
  const { data: upcomingGames } = await supabase
    .from('games')
    .select('home_team,away_team')
    .eq('week_number', week + 1)
    .eq('status', 'scheduled')

  // Injuries — significant ones only (5+ games out)
  const { data: injuries } = await supabase
    .from('injury_log')
    .select('player_id,severity,games_out,status,players!inner(name,team_id,usage)')
    .eq('season', '2025-26')
    .eq('status', 'active')
    .gte('games_out', 5)

  const { data: prevRankings } = await supabase
    .from('power_rankings')
    .select('team_id,rank')
    .eq('season', '2025-26')
    .eq('week_number', week - 1)

  const prevRankMap: Record<string, number> = {}
  ;(prevRankings || []).forEach((r: any) => prevRankMap[r.team_id] = r.rank)

  // Recent trades (last 10 real-world days) — now pulling real_ovr too, so
  // trade activity becomes a real net-talent-gained/lost score, not just a
  // list of names for a columnist to mention.
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentTradeProposals } = await supabase
    .from('trade_proposals').select('id').eq('status', 'accepted').gte('resolved_at', tenDaysAgo)
  const proposalIds = (recentTradeProposals || []).map((p: any) => p.id)
  let tradeRows: any[] = []
  if (proposalIds.length) {
    const { data } = await supabase.from('trade_proposal_teams')
      .select('team_id,players_in,players_out').in('proposal_id', proposalIds)
    tradeRows = data || []
  }
  const tradedPlayerIds = new Set<string>()
  tradeRows.forEach((r: any) => {
    ;(r.players_in || []).forEach((id: string) => tradedPlayerIds.add(id))
    ;(r.players_out || []).forEach((id: string) => tradedPlayerIds.add(id))
  })
  const tradedPlayerInfo: Record<string, { name: string, real_ovr: number }> = {}
  if (tradedPlayerIds.size) {
    const { data } = await supabase.from('players').select('id,name,real_ovr').in('id', Array.from(tradedPlayerIds))
    ;(data || []).forEach((p: any) => { tradedPlayerInfo[p.id] = { name: p.name, real_ovr: p.real_ovr || 70 } })
  }
  const teamTradesMap: Record<string, { in: string[], out: string[], netOvrDelta: number }> = {}
  tradeRows.forEach((r: any) => {
    const entry = (teamTradesMap[r.team_id] ||= { in: [], out: [], netOvrDelta: 0 })
    ;(r.players_in || []).forEach((id: string) => {
      const info = tradedPlayerInfo[id]
      if (info) { entry.in.push(info.name); entry.netOvrDelta += info.real_ovr }
    })
    ;(r.players_out || []).forEach((id: string) => {
      const info = tradedPlayerInfo[id]
      if (info) { entry.out.push(info.name); entry.netOvrDelta -= info.real_ovr }
    })
  })

  // Extra future first-round draft capital (picks acquired via trade, for a
  // season after the current one)
  const { data: draftPicks } = await supabase.from('draft_picks')
    .select('team_id,original_team_id,season').eq('status', 'owned')
  const teamExtraPicks: Record<string, number> = {}
  ;(draftPicks || []).forEach((pk: any) => {
    if (pk.team_id === pk.original_team_id) return
    const pickYear = parseInt(String(pk.season), 10)
    if (!isNaN(pickYear) && pickYear > currentSeasonYear) {
      teamExtraPicks[pk.team_id] = (teamExtraPicks[pk.team_id] || 0) + 1
    }
  })

  // ── Pass 1: raw per-team facts ──────────────────────────────
  type RawTeam = {
    id: string, name: string, wins: number, losses: number, gamesPlayed: number
    winPct: number, elo: number, ppg: number, oppPpg: number
    last5: string, last5Wins: number, streak: string
    lastOppAvgElo: number | null, nextOppAvgElo: number | null
    teamInjuries: { name: string, severity: string, gamesOut: number, usage: number }[]
    rosterQualityNorm: number, avgAge: number, highPotentialCount: number, extraPicks: number
    prevRank: number | null
  }

  const rawTeams: RawTeam[] = teams.map((team: any) => {
    const teamGames = (recentGames || [])
      .filter((g: any) => g.home_team === team.id || g.away_team === team.id)
      .slice(0, 5)

    const last5Results = teamGames.map((g: any) => {
      const won = (g.home_team === team.id && g.home_score > g.away_score) ||
                  (g.away_team === team.id && g.away_score > g.home_score)
      return won ? 'W' : 'L'
    })
    const last5 = last5Results.join('-') || 'N/A'
    const last5Wins = last5Results.filter(r => r === 'W').length

    let streak = 0, streakType = ''
    for (const r of last5Results) {
      if (!streakType) { streakType = r; streak = 1 }
      else if (r === streakType) streak++
      else break
    }
    const streakStr = streakType ? `${streakType}${streak}` : 'N/A'

    const teamInjuries = (injuries || [])
      .filter((i: any) => i.players?.team_id === team.id)
      .map((i: any) => ({ name: i.players?.name, severity: i.severity, gamesOut: i.games_out, usage: i.players?.usage || 0 }))

    const gamesPlayed = team.wins + team.losses
    const ppg = gamesPlayed > 0 ? Math.round((team.pts_for || 0) / gamesPlayed * 10) / 10 : 0
    const oppPpg = gamesPlayed > 0 ? Math.round((team.pts_against || 0) / gamesPlayed * 10) / 10 : 0

    const lastOpponentElos = teamGames.map((g: any) => teamEloMap[g.home_team === team.id ? g.away_team : g.home_team] ?? 1500)
    const lastOppAvgElo = lastOpponentElos.length ? lastOpponentElos.reduce((a: number, b: number) => a + b, 0) / lastOpponentElos.length : null

    const nextOpponents = (upcomingGames || [])
      .filter((g: any) => g.home_team === team.id || g.away_team === team.id)
      .map((g: any) => g.home_team === team.id ? g.away_team : g.home_team)
    const nextOpponentElos = nextOpponents.map((id: string) => teamEloMap[id] ?? 1500)
    const nextOppAvgElo = nextOpponentElos.length ? nextOpponentElos.reduce((a: number, b: number) => a + b, 0) / nextOpponentElos.length : null

    const roster = teamRosterMap[team.id] || []
    const rosterQuality = computeRosterQuality(roster)
    const rosterQualityNorm = normalizeRosterQuality(rosterQuality)
    const avgAge = computeTop5AvgAge(roster)
    const highPotentialCount = countHighPotential(roster)
    const extraPicks = teamExtraPicks[team.id] || 0

    return {
      id: team.id, name: team.name, wins: team.wins, losses: team.losses, gamesPlayed,
      winPct: gamesPlayed > 0 ? team.wins / gamesPlayed : 0,
      elo: team.elo ?? 1500, ppg, oppPpg,
      last5, last5Wins, streak: streakStr,
      lastOppAvgElo, nextOppAvgElo, teamInjuries,
      rosterQualityNorm, avgAge, highPotentialCount, extraPicks,
      prevRank: prevRankMap[team.id] || null,
    }
  })

  // ── Pass 2: league-wide schedule-difficulty ranks ───────────
  // Rank 1 = hardest (highest average opponent Elo), 30 = easiest.
  const byLastOpp = [...rawTeams].filter(t => t.lastOppAvgElo !== null).sort((a, b) => (b.lastOppAvgElo! - a.lastOppAvgElo!))
  const lastHardnessRank: Record<string, number> = {}
  byLastOpp.forEach((t, i) => { lastHardnessRank[t.id] = i + 1 })
  const lastRankTotal = byLastOpp.length

  const byNextOpp = [...rawTeams].filter(t => t.nextOppAvgElo !== null).sort((a, b) => (b.nextOppAvgElo! - a.nextOppAvgElo!))
  const nextHardnessRank: Record<string, number> = {}
  byNextOpp.forEach((t, i) => { nextHardnessRank[t.id] = i + 1 })
  const nextRankTotal = byNextOpp.length

  // ── Pass 3: build the 9 criteria blocks + composite score ───
  const rankings: any[] = []
  const scored = rawTeams.map(t => {
    const resultsWeight = clamp01(t.gamesPlayed / 20)
    const rosterWeight = 1 - resultsWeight

    // 1. Recent form
    const recentFormScore = t.gamesPlayed > 0 ? t.last5Wins / 5 : 0.5
    const recentFormGrade: Grade = t.gamesPlayed === 0 ? 'neutral' : t.last5Wins >= 4 ? 'good' : t.last5Wins === 3 ? 'neutral' : 'bad'
    const recentForm: CriteriaBlock = { key: 'recent_form', grade: recentFormGrade, score: round2(recentFormScore), data: { last5: t.last5, wins: t.last5Wins, streak: t.streak } }

    // 2. Elo (opponent-adjusted strength)
    const eloScore = eloNorm(t.elo)
    const eloRank = [...rawTeams].sort((a, b) => b.elo - a.elo).findIndex(x => x.id === t.id) + 1
    const eloGrade: Grade = eloRank <= 10 ? 'good' : eloRank <= 20 ? 'neutral' : 'bad'
    const elo: CriteriaBlock = { key: 'elo', grade: eloGrade, score: round2(eloScore), data: { value: Math.round(t.elo), leagueRank: eloRank } }

    // 3. Net rating (point differential)
    const diff = t.ppg - t.oppPpg
    const netRatingScore = clamp01((diff + 20) / 40)
    const netRatingGrade: Grade = diff >= 5 ? 'good' : diff <= -5 ? 'bad' : 'neutral'
    const netRating: CriteriaBlock = { key: 'net_rating', grade: netRatingGrade, score: round2(netRatingScore), data: { diff: round2(diff) } }

    // 4. Roster talent
    const rosterQualityGrade: Grade = t.rosterQualityNorm >= 0.7 ? 'good' : t.rosterQualityNorm >= 0.4 ? 'neutral' : 'bad'
    const rosterQuality: CriteriaBlock = { key: 'roster_quality', grade: rosterQualityGrade, score: round2(t.rosterQualityNorm), data: { norm: round2(t.rosterQualityNorm) } }

    // 5. Schedule just played vs performance
    const lastRank = lastHardnessRank[t.id] || Math.ceil(lastRankTotal / 2)
    const hardnessBonus = lastRankTotal > 1 ? 1 - (lastRank - 1) / (lastRankTotal - 1) : 0.5
    const scheduleLastScore = t.gamesPlayed > 0 ? clamp01(recentFormScore * 0.7 + hardnessBonus * 0.3) : 0.5
    const scheduleLastGrade: Grade = t.gamesPlayed === 0 ? 'neutral'
      : (lastRank <= 10 && t.last5Wins >= 3) ? 'good'
      : (lastRank > (lastRankTotal - 10) && t.last5Wins < 3) ? 'bad'
      : 'neutral'
    const scheduleLast: CriteriaBlock = { key: 'schedule_last', grade: scheduleLastGrade, score: round2(scheduleLastScore), data: { hardnessRank: lastRank, totalTeams: lastRankTotal, wins: t.last5Wins, games: t.last5 === 'N/A' ? 0 : t.last5.split('-').length } }

    // 6. Schedule ahead
    const nextRank = nextHardnessRank[t.id] || null
    // nextRank 1 = hardest slate ahead, nextRankTotal = easiest — an easy
    // week ahead is the advantage, so the score rises toward the easy end.
    const scheduleNextScore = nextRank ? clamp01((nextRank - 1) / Math.max(1, nextRankTotal - 1)) : 0.5
    const scheduleNextGrade: Grade = !nextRank ? 'neutral' : nextRank <= 10 ? 'bad' : nextRank > (nextRankTotal - 10) ? 'good' : 'neutral'
    const scheduleNext: CriteriaBlock = { key: 'schedule_next', grade: scheduleNextGrade, score: round2(scheduleNextScore), data: { hardnessRank: nextRank, totalTeams: nextRankTotal } }

    // 7. Injuries
    const totalInjuredUsage = t.teamInjuries.reduce((s, i) => s + i.usage, 0)
    const injuriesScore = clamp01(1 - totalInjuredUsage / 150)
    const injuriesGrade: Grade = t.teamInjuries.length === 0 ? 'good' : totalInjuredUsage >= 70 || t.teamInjuries.length >= 2 ? 'bad' : 'neutral'
    const injuriesBlock: CriteriaBlock = { key: 'injuries', grade: injuriesGrade, score: round2(injuriesScore), data: { players: t.teamInjuries } }

    // 8. Trade activity
    const trades = teamTradesMap[t.id]
    const netOvrDelta = trades?.netOvrDelta || 0
    const tradesScore = clamp01(0.5 + netOvrDelta / 40)
    const tradesGrade: Grade = !trades ? 'neutral' : netOvrDelta > 1 ? 'good' : netOvrDelta < -1 ? 'bad' : 'neutral'
    const tradesBlock: CriteriaBlock = { key: 'trades', grade: tradesGrade, score: round2(tradesScore), data: { in: trades?.in || [], out: trades?.out || [], netOvrDelta: round2(netOvrDelta) } }

    // 9. Trajectory / future outlook
    const ageFactor = clamp01(1 - (t.avgAge - 24) / 10)
    const potentialFactor = clamp01(t.highPotentialCount / 4)
    const picksFactor = clamp01(t.extraPicks / 3)
    const trajectoryScore = clamp01(0.4 * ageFactor + 0.3 * potentialFactor + 0.3 * picksFactor)
    const trajectoryGrade: Grade = (t.avgAge < 26 && t.highPotentialCount >= 2) ? 'good' : (t.avgAge > 29 && t.highPotentialCount <= 1) ? 'bad' : 'neutral'
    const trajectory: CriteriaBlock = { key: 'trajectory', grade: trajectoryGrade, score: round2(trajectoryScore), data: { avgAge: round2(t.avgAge), highPotentialCount: t.highPotentialCount, extraPicks: t.extraPicks } }

    const criteria = [recentForm, elo, netRating, rosterQuality, scheduleLast, scheduleNext, injuriesBlock, tradesBlock, trajectory]

    // Composite: adaptive roster-vs-results blend (same spirit as before —
    // roster talent carries the ranking early season, real results take
    // over as games accumulate) worth 85%, plus 15% of always-relevant
    // modifiers (schedule ahead, injuries, trades, trajectory) that apply
    // regardless of how many games have been played.
    const resultsScoreCombined = recentFormScore * 0.30 + eloScore * 0.35 + netRatingScore * 0.20 + scheduleLastScore * 0.15
    const mainScore = rosterWeight * t.rosterQualityNorm + resultsWeight * resultsScoreCombined
    const finalScore = mainScore * 0.85 + scheduleNextScore * 0.05 + injuriesScore * 0.05 + tradesScore * 0.02 + trajectoryScore * 0.03

    return { raw: t, criteria, finalScore }
  })

  scored.sort((a, b) => b.finalScore - a.finalScore)

  scored.forEach((s, idx) => {
    const rank = idx + 1
    const prevRank = s.raw.prevRank
    const trend = !prevRank ? 'new' : rank < prevRank ? 'up' : rank > prevRank ? 'down' : 'same'
    rankings.push({
      season: '2025-26',
      week_number: week,
      team_id: s.raw.id,
      rank,
      previous_rank: prevRank,
      trend,
      criteria: s.criteria,
      wins: s.raw.wins,
      losses: s.raw.losses,
      last5: s.raw.last5,
      ppg: s.raw.ppg,
      opp_ppg: s.raw.oppPpg,
    })
  })

  await supabase.from('power_rankings').upsert(rankings, { onConflict: 'season,week_number,team_id' })

  return { generated: rankings.length }
}

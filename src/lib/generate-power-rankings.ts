import { createClient } from '@supabase/supabase-js'
import { computeRosterQuality, normalizeRosterQuality, computeTop5AvgAge, countHighPotential } from './roster-quality'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function clamp01(v: number): number { return Math.min(1, Math.max(0, v)) }
function eloNorm(elo: number): number { return clamp01(((elo ?? 1500) - 1300) / 400) }

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

  // Fetch every active player (real_ovr for star/second-option text, plus
  // usage/age/potential_grade for the "future potential" composite below —
  // one query serves both instead of duplicating the roster fetch)
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id,name,pos,team_id,real_ovr,usage,age,potential_grade')
    .eq('status', 'active')
    .not('team_id', 'is', null)
    .order('real_ovr', { ascending: false })

  // Build top 2 per team map (star/second option) + full roster per team
  // (sorted by real_ovr descending, same order as allPlayers) for the
  // future-potential composite.
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

  // Fetch last 5 games for each team
  const { data: recentGames } = await supabase
    .from('games')
    .select('id,home_team,away_team,home_score,away_score,played_at,week_number')
    .eq('season', '2025-26')
    .eq('status', 'final')
    .order('played_at', { ascending: false })
    .limit(300)

  // Next week's real matchups (now that games carry a real per-game
  // scheduled_date, next week's slate genuinely exists ahead of time) —
  // used only for "schedule coming up" narrative context, never the score.
  const { data: upcomingGames } = await supabase
    .from('games')
    .select('home_team,away_team')
    .eq('week_number', week + 1)
    .eq('status', 'scheduled')

  // Fetch injury data
  const { data: injuries } = await supabase
    .from('injury_log')
    .select('player_id,severity,games_out,status,players!inner(name,team_id,usage)')
    .eq('season', '2025-26')
    .eq('status', 'active')
    .gte('games_out', 5)

  // Fetch previous week rankings
  const { data: prevRankings } = await supabase
    .from('power_rankings')
    .select('team_id,rank')
    .eq('season', '2025-26')
    .eq('week_number', week - 1)

  const prevRankMap: Record<string, number> = {}
  ;(prevRankings || []).forEach((r: any) => prevRankMap[r.team_id] = r.rank)

  // Recent trades (last 10 real-world days) — narrative context only, so a
  // columnist can mention "just acquired X" the same week it happened.
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
  const tradedPlayerNames: Record<string, string> = {}
  if (tradedPlayerIds.size) {
    const { data } = await supabase.from('players').select('id,name').in('id', Array.from(tradedPlayerIds))
    ;(data || []).forEach((p: any) => { tradedPlayerNames[p.id] = p.name })
  }
  const teamTradesMap: Record<string, { in: string[], out: string[] }> = {}
  tradeRows.forEach((r: any) => {
    const entry = (teamTradesMap[r.team_id] ||= { in: [], out: [] })
    ;(r.players_in || []).forEach((id: string) => { if (tradedPlayerNames[id]) entry.in.push(tradedPlayerNames[id]) })
    ;(r.players_out || []).forEach((id: string) => { if (tradedPlayerNames[id]) entry.out.push(tradedPlayerNames[id]) })
  })

  // Extra future first-round draft capital (picks acquired via trade, for
  // a season after the current one) — a real "trajectory" signal, text only.
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

  // Player form vs. expectation — each team's top real_ovr player's recent
  // scoring (last 4 recorded box scores, ~2 weeks) vs. his own season
  // average. Naturally empty pre-season (no box_scores rows yet) — omitted
  // gracefully below, same pattern as the existing injury fallback.
  const starIds = Object.values(teamRosterMap).map(roster => roster[0]?.id).filter(Boolean)
  const teamFormMap: Record<string, { recent: number, season: number } > = {}
  if (starIds.length) {
    // box_scores has no timestamp column of its own — order via the real
    // games.played_at through the FK embed, not a nonexistent column (this
    // was silently returning nothing before, always falling back to "not
    // enough recent data yet").
    const [{ data: recentBox }, { data: seasonStats }] = await Promise.all([
      supabase.from('box_scores').select('player_id,pts,games!inner(played_at)').in('player_id', starIds).eq('games.status', 'final').order('played_at', { foreignTable: 'games', ascending: false }),
      supabase.from('player_stats').select('player_id,pts,games').eq('season', currentSeason).in('player_id', starIds),
    ])
    const seasonAvgById: Record<string, number> = {}
    ;(seasonStats || []).forEach((s: any) => { if (s.games > 0) seasonAvgById[s.player_id] = s.pts / s.games })
    const recentByPlayer: Record<string, number[]> = {}
    ;(recentBox || []).forEach((b: any) => {
      const arr = (recentByPlayer[b.player_id] ||= [])
      if (arr.length < 4) arr.push(b.pts || 0)
    })
    for (const teamId of Object.keys(teamRosterMap)) {
      const starId = teamRosterMap[teamId][0]?.id
      const recent = starId ? recentByPlayer[starId] : null
      const seasonAvg = starId ? seasonAvgById[starId] : undefined
      if (recent && recent.length >= 2 && seasonAvg) {
        teamFormMap[teamId] = { recent: recent.reduce((a, b) => a + b, 0) / recent.length, season: seasonAvg }
      }
    }
  }

  // Build team context for each team
  type TeamContext = {
    id: string
    name: string
    record: string
    wins: number
    losses: number
    winPct: number
    elo: number
    ppg: number
    oppPpg: number
    last5: string
    last5Wins: number
    streak: string
    injuredPlayers: string[]
    conference: string
    division: string
    confRank: number
    prevRank: number | null
    starPlayer: string
    secondPlayer: string
    scheduleLastNote: string
    scheduleNextNote: string
    tradeNote: string
    formNote: string
    potentialNote: string
    rosterNote: string
    rosterQualityNorm: number
    gamesPlayed: number
  }

  const teamContexts: TeamContext[] = teams.map((team: any) => {
    // Last 5 games
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

    // Current streak
    let streak = 0
    let streakType = ''
    for (const r of last5Results) {
      if (!streakType) { streakType = r; streak = 1 }
      else if (r === streakType) streak++
      else break
    }
    const streakStr = streakType ? `${streakType}${streak}` : 'N/A'

    // Injured players
    const teamInjuries = (injuries || [])
      .filter((i: any) => i.players?.team_id === team.id)
      .map((i: any) => `${i.players?.name} (${i.severity}, ${i.games_out}g out)`)

    // PPG
    const gamesPlayed = team.wins + team.losses
    const ppg = gamesPlayed > 0 ? Math.round((team.pts_for || 0) / gamesPlayed * 10) / 10 : 0
    const oppPpg = gamesPlayed > 0 ? Math.round((team.pts_against || 0) / gamesPlayed * 10) / 10 : 0

    // Conference rank
    const confTeams = teams
      .filter((t: any) => t.conference === team.conference)
      .sort((a: any, b: any) => b.wins - a.wins)
    const confRank = confTeams.findIndex((t: any) => t.id === team.id) + 1

    // Schedule just played — average Elo of the same last-5 opponents above.
    // Real, opponent-adjusted difficulty, not invented.
    const lastOpponentElos = teamGames.map((g: any) => teamEloMap[g.home_team === team.id ? g.away_team : g.home_team] ?? 1500)
    const scheduleLastNote = lastOpponentElos.length
      ? `faced a ${lastOpponentElos.reduce((a: number, b: number) => a + b, 0) / lastOpponentElos.length >= 1520 ? 'brutal' : lastOpponentElos.reduce((a: number, b: number) => a + b, 0) / lastOpponentElos.length <= 1470 ? 'soft' : 'average'} slate last 5 (avg opponent Elo ${Math.round(lastOpponentElos.reduce((a: number, b: number) => a + b, 0) / lastOpponentElos.length)})`
      : 'no games played yet'

    // Schedule coming up — real next-week matchups now that games carry a
    // real per-game scheduled_date.
    const nextOpponents = (upcomingGames || [])
      .filter((g: any) => g.home_team === team.id || g.away_team === team.id)
      .map((g: any) => g.home_team === team.id ? g.away_team : g.home_team)
    const scheduleNextNote = nextOpponents.length
      ? `next week: ${nextOpponents.map((id: string) => teamNameMap[id] || id).join(', ')}`
      : 'no games scheduled next week'

    // Recent trades — real, only mentioned when something actually happened.
    const trades = teamTradesMap[team.id]
    const tradeNote = trades && (trades.in.length || trades.out.length)
      ? `${trades.in.length ? `acquired ${trades.in.join(', ')}` : ''}${trades.in.length && trades.out.length ? '; ' : ''}${trades.out.length ? `traded away ${trades.out.join(', ')}` : ''}`
      : 'no trades this week'

    // Player form vs. expectation — the team's top real_ovr player's recent
    // scoring vs. his own season average. Empty until box_scores exist.
    const form = teamFormMap[team.id]
    const formNote = form
      ? `${teamPlayersMap[team.id]?.[0]?.name || 'star player'} averaging ${form.recent.toFixed(1)} over his last few outings vs. ${form.season.toFixed(1)} season average (${form.recent >= form.season * 1.15 ? 'well above' : form.recent <= form.season * 0.85 ? 'well below' : 'in line with'} expectations)`
      : 'not enough recent data yet'

    // Future potential / draft capital — average age of the team's top-5
    // usage players, count of A/B potential-grade talent on the roster, and
    // extra future first-round picks banked via trade.
    const roster = teamRosterMap[team.id] || []
    const avgAge = computeTop5AvgAge(roster)
    const highPotentialCount = countHighPotential(roster)
    const extraPicks = teamExtraPicks[team.id] || 0
    const potentialNote = `top-5 rotation averages ${avgAge.toFixed(1)} years old, ${highPotentialCount} roster player(s) graded A/B potential, ${extraPicks} extra future first-round pick(s) banked`

    // Roster quality — usage-weighted real_ovr across the top-8 rotation
    // players. This is what actually separates title contenders from
    // rebuilding teams BEFORE results exist (preseason, or any team's first
    // handful of games, where wins/last-5/Elo are all still tied/degenerate
    // and can't tell teams apart on their own — confirmed live: with every
    // team at 0-0 and Elo still at the default 1500, the old formula had
    // literally nothing to rank on and produced an arbitrary order). Bounds
    // (73-85) calibrated from this season's actual top-8 weighted real_ovr
    // spread across all 30 teams.
    const rosterQuality = computeRosterQuality(roster)
    const rosterQualityNorm = normalizeRosterQuality(rosterQuality)
    const rosterNote = rosterQualityNorm >= 0.7 ? 'one of the most talent-loaded rosters in the league on paper'
      : rosterQualityNorm >= 0.4 ? 'solid, playoff-caliber talent on paper'
      : 'still fairly thin on top-end talent relative to the league'

    return {
      id: team.id,
      name: team.name,
      record: `${team.wins}-${team.losses}`,
      wins: team.wins,
      losses: team.losses,
      winPct: gamesPlayed > 0 ? team.wins / gamesPlayed : 0,
      elo: team.elo ?? 1500,
      ppg,
      oppPpg,
      last5,
      last5Wins,
      streak: streakStr,
      injuredPlayers: teamInjuries,
      conference: team.conference,
      division: team.division,
      confRank,
      prevRank: prevRankMap[team.id] || null,
      starPlayer: teamPlayersMap[team.id]?.[0]?.name || '',
      secondPlayer: teamPlayersMap[team.id]?.[1]?.name || '',
      scheduleLastNote,
      scheduleNextNote,
      tradeNote,
      formNote,
      potentialNote,
      rosterNote,
      rosterQualityNorm,
      gamesPlayed,
    }
  })

  // Sort by composite score, blended between roster talent and real results.
  // Early in the season (few games played) results are still a coin-flip
  // signal — record/last-5/Elo are all near-identical for every team, so
  // roster quality (top-8 usage-weighted real_ovr) does most of the work,
  // same way real "way-too-early" power rankings work. As games accumulate,
  // results progressively take over — full trust in results by ~20 games,
  // a quarter into the season. Results bucket itself stays grounded, never
  // predictive: winPct (35%) + last5 (20%) + point differential (15%) +
  // Elo (30%, already opponent-adjusted via updateElo()).
  const scoreOf = (t: TeamContext) => {
    const resultsWeight = clamp01(t.gamesPlayed / 20)
    const rosterWeight = 1 - resultsWeight
    const resultsScore = t.winPct * 0.35 + (t.last5Wins / 5) * 0.20 + clamp01((t.ppg - t.oppPpg + 20) / 40) * 0.15 + eloNorm(t.elo) * 0.30
    return rosterWeight * t.rosterQualityNorm + resultsWeight * resultsScore
  }
  teamContexts.sort((a, b) => scoreOf(b) - scoreOf(a))

  // Generate comments via Claude API in batches of 5
  const rankings: any[] = []

  for (let i = 0; i < teamContexts.length; i += 5) {
    const batch = teamContexts.slice(i, i + 5)

    const prompt = `You are a seasoned NBA journalist writing the weekly Power Rankings column. Write a sharp, accurate, 2-sentence comment for each of these teams, IN BOTH ENGLISH AND EUROPEAN PORTUGUESE (Portugal, not Brazil) — two independent, natural-sounding comments conveying the same analysis, not a literal translation of each other. Be critical when needed, optimistic when warranted. Sound human — like a columnist with opinions, not a data report. Reference players by name, mention specific recent performances, streaks, or injuries when relevant. When the data below mentions a tough or soft schedule (past or upcoming), a recent trade, a player over/under-performing expectations, or the team's youth/draft capital, weave it in naturally when it's the most interesting angle for that team — don't force all of it into every comment. Do NOT invent facts not present in the data below. Do NOT mention OVR ratings or numerical attributes. Do NOT start every sentence the same way.

Week ${week} data:

${batch.map((t, idx) => `
TEAM ${i + idx + 1}: ${t.name}
- Record: ${t.record} (${t.conference}, #${t.confRank} in conference)
- Last 5: ${t.last5} | Current streak: ${t.streak}
- Scoring: ${t.ppg} PPG offensively, ${t.oppPpg} PPG allowed
- Star player: ${t.starPlayer || 'N/A'}${t.secondPlayer ? ` | Second option: ${t.secondPlayer}` : ''}
- Notable injuries: ${t.injuredPlayers.length ? t.injuredPlayers.join(', ') : 'none'}
- Schedule just played: ${t.scheduleLastNote}
- Schedule ahead: ${t.scheduleNextNote}
- Trade activity this week: ${t.tradeNote}
- Star player recent form: ${t.formNote}
- Roster talent level: ${t.rosterNote}
- Roster outlook: ${t.potentialNote}
- Previous ranking: ${t.prevRank ? `#${t.prevRank}` : 'first week'}
`).join('\n')}

Respond ONLY with a JSON array, no markdown, no explanation:
[
  {"team_id": "TEAM_ID", "comment_en": "2-sentence comment in English", "comment_pt": "2-sentence comment in European Portuguese"},
  ...
]

Use these exact team IDs: ${batch.map(t => t.id).join(', ')}`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1800,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const text = data.content?.[0]?.text || '[]'
      const clean = text.replace(/```json|```/g, '').trim()
      const comments: { team_id: string, comment_en: string, comment_pt: string }[] = JSON.parse(clean)

      for (let j = 0; j < batch.length; j++) {
        const team = batch[j]
        const rank = i + j + 1
        const commentData = comments.find(c => c.team_id === team.id)
        const comment = commentData?.comment_en || `${team.name} sit at ${team.record}${team.starPlayer ? ` with ${team.starPlayer} leading the charge` : ''} and continue their season.`
        const commentPt = commentData?.comment_pt || `${team.name} estão em ${team.record}${team.starPlayer ? `, com ${team.starPlayer} à frente` : ''} e continuam a sua época.`

        const prevRank = team.prevRank
        const trend = !prevRank ? 'new'
          : rank < prevRank ? 'up'
          : rank > prevRank ? 'down'
          : 'same'

        rankings.push({
          season: '2025-26',
          week_number: week,
          team_id: team.id,
          rank,
          previous_rank: prevRank,
          trend,
          comment,
          comment_pt: commentPt,
          wins: team.wins,
          losses: team.losses,
          last5: team.last5,
          ppg: team.ppg,
          opp_ppg: team.oppPpg,
        })
      }
    } catch (err) {
      // Fallback without AI comment
      for (let j = 0; j < batch.length; j++) {
        const team = batch[j]
        const rank = i + j + 1
        const prevRank = team.prevRank
        const trend = !prevRank ? 'new' : rank < prevRank ? 'up' : rank > prevRank ? 'down' : 'same'
        rankings.push({
          season: '2025-26', week_number: week, team_id: team.id,
          rank, previous_rank: prevRank, trend,
          comment: `${team.name} are ${team.record} on the season with a ${team.last5} record in their last five games.`,
          comment_pt: `${team.name} estão em ${team.record} na época, com um registo de ${team.last5} nos últimos cinco jogos.`,
          wins: team.wins, losses: team.losses, last5: team.last5, ppg: team.ppg, opp_ppg: team.oppPpg,
        })
      }
    }
  }

  // Upsert all rankings
  await supabase.from('power_rankings').upsert(rankings, { onConflict: 'season,week_number,team_id' })

  return { generated: rankings.length }
}

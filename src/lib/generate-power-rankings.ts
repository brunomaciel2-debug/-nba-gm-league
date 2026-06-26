import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function generatePowerRankings(week: number) {
  // Fetch all active teams with their data
  const { data: teams } = await supabase
    .from('teams')
    .select('id,name,wins,losses,pts_for,pts_against,conference,division,rival_team_id')
    .not('id', 'in', '(ALL,RVS,ROO,SOP)')
    .order('wins', { ascending: false })

  if (!teams?.length) return { generated: 0 }

  // Fetch last 5 games for each team
  const { data: recentGames } = await supabase
    .from('games')
    .select('id,home_team,away_team,home_score,away_score,played_at,week_number')
    .eq('season', '2025-26')
    .eq('status', 'final')
    .order('played_at', { ascending: false })
    .limit(300)

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

  // Build team context for each team
  type TeamContext = {
    id: string
    name: string
    record: string
    wins: number
    losses: number
    winPct: number
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

    return {
      id: team.id,
      name: team.name,
      record: `${team.wins}-${team.losses}`,
      wins: team.wins,
      losses: team.losses,
      winPct: gamesPlayed > 0 ? team.wins / gamesPlayed : 0,
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
    }
  })

  // Sort by composite score: winPct (50%) + last5 (30%) + ppg differential (20%)
  teamContexts.sort((a, b) => {
    const scoreA = a.winPct * 0.5 + (a.last5Wins / 5) * 0.3 + Math.min(1, Math.max(0, (a.ppg - a.oppPpg + 20) / 40)) * 0.2
    const scoreB = b.winPct * 0.5 + (b.last5Wins / 5) * 0.3 + Math.min(1, Math.max(0, (b.ppg - b.oppPpg + 20) / 40)) * 0.2
    return scoreB - scoreA
  })

  // Generate comments via Claude API in batches of 5
  const rankings: any[] = []

  for (let i = 0; i < teamContexts.length; i += 5) {
    const batch = teamContexts.slice(i, i + 5)

    const prompt = `You are a seasoned NBA journalist writing the weekly Power Rankings column. Write a sharp, accurate, 2-sentence comment for each of these teams. Be critical when needed, optimistic when warranted. Sound human — like a columnist with opinions, not a data report. Reference specific stats, streaks, or injuries when relevant. Do NOT start every sentence the same way.

Week ${week} data:

${batch.map((t, idx) => `
TEAM ${i + idx + 1}: ${t.name}
- Record: ${t.record} (${t.conference}, #${t.confRank} in conference)
- Last 5: ${t.last5} | Current streak: ${t.streak}
- Scoring: ${t.ppg} PPG offensively, ${t.oppPpg} PPG allowed
- Notable injuries: ${t.injuredPlayers.length ? t.injuredPlayers.join(', ') : 'none'}
- Previous ranking: ${t.prevRank ? `#${t.prevRank}` : 'first week'}
`).join('\n')}

Respond ONLY with a JSON array, no markdown, no explanation:
[
  {"team_id": "TEAM_ID", "comment": "2-sentence comment here"},
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
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const text = data.content?.[0]?.text || '[]'
      const clean = text.replace(/```json|```/g, '').trim()
      const comments: { team_id: string, comment: string }[] = JSON.parse(clean)

      for (let j = 0; j < batch.length; j++) {
        const team = batch[j]
        const rank = i + j + 1
        const commentData = comments.find(c => c.team_id === team.id)
        const comment = commentData?.comment || `${team.name} sit at ${team.record} and continue their season.`

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
          wins: team.wins, losses: team.losses, last5: team.last5, ppg: team.ppg, opp_ppg: team.oppPpg,
        })
      }
    }
  }

  // Upsert all rankings
  await supabase.from('power_rankings').upsert(rankings, { onConflict: 'season,week_number,team_id' })

  return { generated: rankings.length }
}

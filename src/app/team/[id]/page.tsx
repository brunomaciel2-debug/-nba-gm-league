import { supabase } from '@/lib/supabase'
import GMPanel from './GMPanel'
import TeamPageTabs from './TeamPageTabs'
import TeamCapRoom from './TeamCapRoom'
import { readableTeamColor } from '@/lib/color'

export const dynamic = "force-dynamic"

// Calculate a composite team strength score (0-100)
// Used for odds calculation in TeamSchedule
async function calcTeamStrength(teamId: string, recentGames: any[]): Promise<number> {
  // 1. OVR — average of all active players' key attributes (35%)
  const { data: players } = await supabase
    .from('players')
    .select('usage,three,layup,dunk,mid,ft,siq,blk,stl,idef,pdef,stamina,durability,health')
    .eq('team_id', teamId)
    .eq('status', 'active')

  const ATTR_KEYS = ['three','layup','dunk','mid','ft','siq','blk','stl','idef','pdef','stamina','durability']
  let ovrScore = 50
  if (players && players.length > 0) {
    const playerOvrs = players.map((p: any) => {
      const attrAvg = ATTR_KEYS.reduce((s, k) => s + (p[k] || 50), 0) / ATTR_KEYS.length
      return attrAvg
    })
    // Weight by usage — better players get more weight
    ovrScore = playerOvrs.reduce((s, v) => s + v, 0) / playerOvrs.length
  }
  const ovrNorm = Math.min(100, Math.max(0, (ovrScore - 40) / 40 * 100)) // 40→0%, 80→100%

  // 2. Win% — season record (25%)
  const { data: teamData } = await supabase
    .from('teams')
    .select('wins,losses,elo')
    .eq('id', teamId)
    .single()

  const wins = teamData?.wins || 0
  const losses = teamData?.losses || 0
  const totalGames = wins + losses
  const winPct = totalGames > 0 ? wins / totalGames : 0.5
  const winPctNorm = winPct * 100

  // 3. Recent form — last 5 games (20%)
  const teamGames = recentGames
    .filter((g: any) => g.status === 'final' && (g.home_team === teamId || g.away_team === teamId))
    .slice(-5)
  let formScore = 50
  if (teamGames.length > 0) {
    const formWins = teamGames.filter((g: any) => {
      const isHome = g.home_team === teamId
      const myScore = isHome ? g.home_score : g.away_score
      const oppScore = isHome ? g.away_score : g.home_score
      return myScore > oppScore
    }).length
    // Weight recent games more (last game = 2x, others = 1x)
    const weights = teamGames.map((_: any, i: number) => i === teamGames.length - 1 ? 2 : 1)
    const totalWeight = weights.reduce((s: number, w: number) => s + w, 0)
    const weightedWins = teamGames.reduce((s: number, g: any, i: number) => {
      const isHome = g.home_team === teamId
      const myScore = isHome ? g.home_score : g.away_score
      const oppScore = isHome ? g.away_score : g.home_score
      return s + (myScore > oppScore ? weights[i] : 0)
    }, 0)
    formScore = (weightedWins / totalWeight) * 100
  }

  // 4. Health — average health of active players (15%)
  let healthScore = 80
  if (players && players.length > 0) {
    healthScore = players.reduce((s: number, p: any) => s + (p.health ?? 100), 0) / players.length
  }

  // 5. Elo (5%)
  const elo = teamData?.elo || 1500
  const eloNorm = Math.min(100, Math.max(0, (elo - 1300) / 400 * 100)) // 1300→0%, 1700→100%

  // Weighted composite
  const strength =
    ovrNorm     * 0.35 +
    winPctNorm  * 0.25 +
    formScore   * 0.20 +
    healthScore * 0.15 +
    eloNorm     * 0.05

  return Math.round(strength)
}

export default async function TeamPage({ params }: { params: { id: string } }) {
  const teamId = params.id.toUpperCase()

  const [{ data: team }, { data: players }, { data: games }, { data: allTeams }, { data: injuries }, { data: coaches }, { data: preseasonGames }] =
    await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase.from('players').select('*, player_stats(*)')
        .eq('team_id', teamId).eq('status','active').order('usage', { ascending: false }),
      supabase.from('games').select('*')
        .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
        .order('week_number').order('game_number'),
      supabase.from('teams').select('id,name,color,logo_url,arena,elo,wins,losses'),
      supabase.from('injury_log').select('*').eq('status','active').limit(100),
      supabase.from('coaches').select('*').eq('team_id', teamId),
      supabase.from('preseason_games').select('*')
        .eq('season','2025-26')
        .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
        .order('scheduled_date'),
    ])

  if (!team) return <div className="p-8 text-center" style={{color:'#6b5f4e'}}>Team not found.</div>

  const t = team as any
  const color = readableTeamColor(t.color)
  const cap = t.salary_cap
  const used = t.cap_used
  const space = cap - used
  const teamsMap = Object.fromEntries((allTeams||[]).map((x:any) => [x.id, x]))

  // Merge preseason games
  const normalizedPreseason = (preseasonGames||[])
    .filter((g:any) => ['scheduled','accepted','final'].includes(g.status))
    .map((g:any) => ({
      id: g.id,
      week_number: 0,
      game_number: 0,
      home_team: g.home_team,
      away_team: g.away_team,
      home_score: g.home_score || null,
      away_score: g.away_score || null,
      status: g.status === 'final' ? 'final' : 'scheduled',
      played_at: g.scheduled_date ? g.scheduled_date + 'T12:00:00' : null,
      game_type: 'preseason',
      _preseason: true,
    }))

  // Fetch world teams
  const worldTeamIds = (preseasonGames||[])
    .flatMap((g:any) => [g.home_team, g.away_team])
    .filter((id:string) => id && !teamsMap[id])
  if (worldTeamIds.length > 0) {
    const { data: worldTeams } = await supabase.from('world_teams').select('id,name,color,logo_url').in('id', worldTeamIds)
    ;(worldTeams||[]).forEach((wt:any) => { teamsMap[wt.id] = wt })
  }

  const allGames = [...normalizedPreseason, ...(games||[])]
  const teamPlayerIds = new Set((players||[]).map((p:any) => p.id))
  const teamInjuries = (injuries||[]).filter((i:any) => teamPlayerIds.has(i.player_id))

  const played = (games||[]).filter((g:any) => g.status === 'final')
  const wins = played.filter((g:any) =>
    (g.home_team===teamId ? g.home_score : g.away_score) > (g.home_team===teamId ? g.away_score : g.home_score)
  ).length
  const losses = played.length - wins
  const pct = played.length > 0 ? (wins/played.length).toFixed(3) : '-'

  // Calculate strength for this team and all upcoming opponents
  const upcomingOpponentIds = [...new Set(
    allGames
      .filter((g:any) => g.status !== 'final')
      .map((g:any) => g.home_team === teamId ? g.away_team : g.home_team)
      .filter((id:string) => id && teamsMap[id]) // only NBA teams
  )]

  // Calculate strengths in parallel
  const [myStrength, ...oppStrengths] = await Promise.all([
    calcTeamStrength(teamId, games||[]),
    ...upcomingOpponentIds.map((id: string) => calcTeamStrength(id, games||[])),
  ])

  // Build strength map and add to teamsMap
  const strengthMap: Record<string,number> = { [teamId]: myStrength }
  upcomingOpponentIds.forEach((id: string, i: number) => {
    strengthMap[id] = oppStrengths[i]
  })

  // Enrich teamsMap with strength scores
  Object.keys(strengthMap).forEach(id => {
    if (teamsMap[id]) teamsMap[id] = { ...teamsMap[id], strength: strengthMap[id] }
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* HEADER */}
      <div className="rounded-2xl p-6 mb-4"
           style={{background:'#e8e2d6',borderTop:'4px solid '+color,border:'1px solid #d4cec3'}}>
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-28 h-28 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
               style={{background:color+'22',border:'2px solid '+color+'44'}}>
            {t.logo_url
              ? <img src={t.logo_url} alt={t.name} className="w-full h-full object-contain p-1"/>
              : <span className="text-3xl font-black" style={{color}}>{t.id}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold mb-1" style={{color}}>{t.conference} · {t.division}</div>
            <h1 className="text-3xl font-bold mb-1" style={{color:'#1a1612'}}>{t.name}</h1>
            <div className="text-sm" style={{color:'#6b5f4e'}}>{t.arena} · {t.city}</div>
          </div>
          <div className="flex gap-6">
            {[{v:wins,l:'W',c:'#15803d'},{v:losses,l:'L',c:'#dc2626'},{v:pct,l:'PCT',c:'#1a1512'}].map(x => (
              <div key={x.l} className="text-center">
                <div className="text-3xl font-black" style={{color:x.c}}>{x.v}</div>
                <div className="text-xs" style={{color:'#6b5f4e'}}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CAP ROOM + GM PANEL */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <TeamCapRoom used={used} cap={cap} space={space} color={color} />
        <GMPanel teamId={teamId} />
      </div>

      <TeamPageTabs
        players={players||[]}
        games={allGames}
        teamId={teamId}
        teamColor={color}
        teamsMap={teamsMap}
        coaches={coaches||[]}
        injuries={teamInjuries}
        arenaName={t.arena}
        arenaCapacity={t.arena_capacity}
      />
    </div>
  )
}

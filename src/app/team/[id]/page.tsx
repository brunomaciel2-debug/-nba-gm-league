import { supabase } from '@/lib/supabase'
import GMPanel from './GMPanel'
import TeamPageTabs from './TeamPageTabs'
import TeamCapRoom from './TeamCapRoom'
import { readableTeamColor } from '@/lib/color'
export const dynamic = "force-dynamic"

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
      supabase.from('teams').select('id,name,color,logo_url,arena,elo'),
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

  // Merge preseason games into games array with normalized shape
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
      // Flatten team info for teamsMap lookup
      _preseason: true,
    }))

  // Fetch world teams that appear in preseason games but aren't in teamsMap
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

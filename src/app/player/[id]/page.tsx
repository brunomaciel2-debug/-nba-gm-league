import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { calcOvr } from '@/lib/ovr'
import { getStatusForWeek } from '@/lib/season-week-helper'
import OfferButton from './OfferButton'
import PlayerPageClient from './PlayerPageClient'
export const dynamic = "force-dynamic"

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const [{ data: player }, { data: stats }, { data: injuries }, { data: contracts }, { data: playerAwards }, { data: lastGames }, { data: cfg }] =
    await Promise.all([
      supabase.from('players').select('*, nba_experience, nba_recruitable, world_team_id, world_teams:world_team_id(id,name,country), teams(name,color,id,logo_url)').eq('id', params.id).single(),
      supabase.from('player_stats').select('*,triple_doubles').eq('player_id', params.id).order('season', { ascending: false }),
      supabase.from('injury_log').select('*').eq('player_id', params.id).order('created_at', { ascending: false }),
      supabase.from('contracts').select('*').eq('player_id', params.id).order('season', { ascending: true }),
      supabase.from('awards').select('award_type,period,season,stats_context,created_at').eq('player_id', params.id).order('created_at', { ascending: false }),
      supabase.from('box_scores').select('*,games(id,home_team,away_team,home_score,away_score,played_at,home:teams!games_home_team_fkey(name,color),away:teams!games_away_team_fkey(name,color))').eq('player_id', params.id).gt('mins', 0).order('created_at', { ascending: false }).limit(5),
      supabase.from('season_config').select('current_week').eq('id', 1).single(),
    ])
  const nextWeek = (cfg?.current_week || 0) + 1
  const phase = getStatusForWeek(nextWeek)
  const faClosed = nextWeek >= 39 // 2 weeks before the play-in (week 41) — roster freeze

  if (!player) return <div className="p-8 text-center" style={{ color:'#5c554e' }}>Player not found.</div>

  const p = player as any
  const team = p.teams as any
  const tc = readableTeamColor(team?.color || '3a8adf')
  const ovr = calcOvr(p)
  const currentContract = (contracts||[]).find((c:any) => c.season==='2025-26')
  const totalValue = (contracts||[]).reduce((sum:number,c:any) => sum+c.salary, 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PlayerPageClient
        player={p}
        stats={stats||[]}
        injuries={injuries||[]}
        contracts={contracts||[]}
        playerAwards={playerAwards||[]}
        lastGames={lastGames||[]}
        teamColor={tc}
        ovr={ovr}
        currentContract={currentContract}
        totalValue={totalValue}
        actionButtons={!player.team_id && (
          <OfferButton playerId={player.id} isAssigned={!!player.on_gleague_assignment} phase={phase} faClosed={faClosed} />
        )}
      />
    </div>
  )
}

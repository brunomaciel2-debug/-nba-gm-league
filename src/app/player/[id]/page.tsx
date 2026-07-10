import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { calcOvr } from '@/lib/ovr'
import { getStatusForWeek } from '@/lib/season-week-helper'
import OfferButton from './OfferButton'
import DraftConfirmPanel from './DraftConfirmPanel'
import RookieOptionPanel from './RookieOptionPanel'
import ContractExtensionPanel from './ContractExtensionPanel'
import CutButton from './CutButton'
import PlayerPageClient from './PlayerPageClient'
export const dynamic = "force-dynamic"

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const [{ data: player }, { data: stats }, { data: injuries }, { data: contracts }, { data: playerAwards }, { data: lastGames }, { data: cfg }, { data: allTeams }, { data: transactions }] =
    await Promise.all([
      supabase.from('players').select('*, nba_experience, nba_recruitable, world_team_id, world_teams:world_team_id(id,name,country), teams:teams!players_team_id_fkey(name,color,id,logo_url)').eq('id', params.id).single(),
      supabase.from('player_stats').select('*,triple_doubles').eq('player_id', params.id).order('season', { ascending: false }),
      supabase.from('injury_log').select('*').eq('player_id', params.id).order('created_at', { ascending: false }),
      supabase.from('contracts').select('*').eq('player_id', params.id).order('season', { ascending: true }),
      supabase.from('awards').select('award_type,period,season,stats_context,created_at').eq('player_id', params.id).order('created_at', { ascending: false }),
      supabase.from('box_scores').select('*,games(id,home_team,away_team,home_score,away_score,played_at,home:teams!games_home_team_fkey(name,color),away:teams!games_away_team_fkey(name,color))').eq('player_id', params.id).gt('mins', 0).order('created_at', { ascending: false }).limit(5),
      supabase.from('season_config').select('current_week').eq('id', 1).single(),
      supabase.from('teams').select('id,name,color,logo_url'),
      supabase.from('player_transactions').select('*').eq('player_id', params.id).order('created_at', { ascending: false }),
    ])
  const teamMap: Record<string, any> = {}
  for (const t of (allTeams || [])) teamMap[t.id] = t
  const nextWeek = (cfg?.current_week || 0) + 1
  const phase = getStatusForWeek(nextWeek)
  const faClosed = nextWeek >= 39 // 2 weeks before the play-in (week 41) — roster freeze

  if (!player) return <div className="p-8 text-center" style={{ color:'#5c554e' }}>Player not found. / Jogador não encontrado.</div>

  const p = player as any
  const team = p.teams as any
  const tc = readableTeamColor(team?.color || '3a8adf')
  const ovr = calcOvr(p)
  const currentContract = (contracts||[]).find((c:any) => c.season==='2025-26')
  const totalValue = (contracts||[]).reduce((sum:number,c:any) => sum+c.salary, 0)

  // The current season only gets a player_stats row once he's actually
  // played a game (see cron/simulate's per-team accumulation) — before
  // that (e.g. preseason, or right after joining a new team) the table
  // would just skip 2025-26 entirely, looking like his stats history ends
  // a year ago. Synthesize a placeholder 0-game row so his CURRENT team
  // always shows for the current season, same as the real row will once
  // he actually plays.
  const hasCurrentSeasonRow = (stats || []).some((s: any) => s.season === '2025-26')
  const statsForDisplay = (!hasCurrentSeasonRow && p.team_id)
    ? [{ id: 'placeholder-2025-26', season: '2025-26', team_id: p.team_id, games: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, turnovers: 0, oreb: 0, pf: 0, mins: 0, plus_minus: 0, triple_doubles: 0 }, ...(stats || [])]
    : (stats || [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PlayerPageClient
        player={p}
        stats={statsForDisplay}
        teamMap={teamMap}
        transactions={transactions||[]}
        injuries={injuries||[]}
        contracts={contracts||[]}
        playerAwards={playerAwards||[]}
        lastGames={lastGames||[]}
        teamColor={tc}
        ovr={ovr}
        currentContract={currentContract}
        totalValue={totalValue}
        actionButtons={
          !player.team_id ? (
            <OfferButton playerId={player.id} isAssigned={!!player.on_gleague_assignment} phase={phase} faClosed={faClosed} />
          ) : p.status === 'draft_pending' ? (
            <DraftConfirmPanel playerId={player.id} />
          ) : p.rookie_option_status?.startsWith('pending_') ? (
            <RookieOptionPanel playerId={player.id} />
          ) : (
            <>
              <ContractExtensionPanel playerId={player.id} />
              <CutButton playerId={player.id} playerTeamId={player.team_id} />
            </>
          )
        }
      />
    </div>
  )
}

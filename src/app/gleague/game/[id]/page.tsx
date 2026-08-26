'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import GameBoxScore, { BoxRow } from '@/components/GameBoxScore'

// Round label for a playoff game — same bracket shape as
// gleague-playoff-resolver.ts's weekForSeries() (r1->14, r2->15, cf->16,
// gl_finals->17), just the reverse mapping for display. Doesn't distinguish
// east/west (the games table has no series_type of its own to read that
// from), so both conferences' Round 2 games read simply "Conf. Semis".
const PLAYOFF_ROUND_LABEL: Record<number, { en: string, pt: string }> = {
  14: { en: 'Round 1', pt: 'Ronda 1' },
  15: { en: 'Conf. Semis', pt: 'Meias-Finais de Conferência' },
  16: { en: 'Conf. Finals', pt: 'Final de Conferência' },
  17: { en: 'G League Finals', pt: 'Final da G League' },
}

export default function GLeagueGamePage({ params }: { params: { id: string } }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<any>(null)
  const [boxScores, setBoxScores] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      const { data: gameData } = await supabase
        .from('gleague_games')
        .select('*, home:gleague_teams!gleague_games_home_team_fkey(*), away:gleague_teams!gleague_games_away_team_fkey(*)')
        .eq('id', params.id)
        .single()
      setGame(gameData)
      if (!gameData) { setLoading(false); return }

      const { data: boxScoresData } = await supabase
        .from('gleague_box_scores')
        .select('*, player:players(id,name,pos,photo_url)')
        .eq('game_id', params.id)
        .order('pts', { ascending: false })
      setBoxScores(boxScoresData || [])
      setLoading(false)
    })()
  }, [params.id])

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-12 text-center" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  if (!game) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <p className="text-sm" style={{ color: '#8a8279' }}>{isPT ? 'Jogo não encontrado.' : 'Game not found.'}</p>
      </div>
    )
  }

  // The G-League's simplified formula-based box score (buildTeamBox() in
  // gleague-simulator.ts) never produces technical fouls, plus/minus, or
  // foul-trouble flags — GameBoxScore already treats all three as optional,
  // so they just render as 0/blank rather than breaking anything.
  const toBoxRow = (b: any): BoxRow => ({
    id: b.id, player_id: b.player?.id ?? b.player_id, name: b.player?.name ?? '', photo_url: b.player?.photo_url ?? null, pos: b.player?.pos ?? '',
    mins: b.mins || 0, pts: b.pts || 0, fgm: b.fgm || 0, fga: b.fga || 0, tpm: b.tpm || 0, tpa: b.tpa || 0,
    ftm: b.ftm || 0, fta: b.fta || 0, reb: b.reb || 0, ast: b.ast || 0, turnovers: b.turnovers || 0,
    stl: b.stl || 0, blk: b.blk || 0, off_reb: b.off_reb || 0, def_reb: b.def_reb || 0, pf: b.pf || 0,
    tech_fouls: 0, plus_minus: 0, is_starter: !!b.is_starter, foul_trouble: false,
  })

  const homeBox = boxScores.filter((b: any) => b.gleague_team_id === game.home_team).map(toBoxRow)
  const awayBox = boxScores.filter((b: any) => b.gleague_team_id === game.away_team).map(toBoxRow)

  const roundLabel = PLAYOFF_ROUND_LABEL[game.week_number]
  const weekLabel = game.game_type === 'playoff'
    ? (roundLabel ? (isPT ? roundLabel.pt : roundLabel.en) : (isPT ? 'Playoffs' : 'Playoffs'))
    : (isPT ? 'Época Regular' : 'Regular Season')

  return (
    <GameBoxScore
      homeTeam={{
        id: game.home_team, name: game.home?.name || game.home_team, logo_url: game.home?.logo_url, color: game.home?.color,
        href: `/gleague/${game.home_team}`, arena: game.home?.arena, city: game.home?.city,
        wins: game.home?.wins, losses: game.home?.losses,
      }}
      awayTeam={{
        id: game.away_team, name: game.away?.name || game.away_team, logo_url: game.away?.logo_url, color: game.away?.color,
        href: `/gleague/${game.away_team}`,
        wins: game.away?.wins, losses: game.away?.losses,
      }}
      homeScore={game.home_score}
      awayScore={game.away_score}
      homeBox={homeBox}
      awayBox={awayBox}
      playedAt={game.played_at}
      weekLabel={weekLabel}
      status={game.status}
      isPT={isPT}
      backHref="/gleague?tab=schedule"
      backLabel={isPT ? 'G League' : 'G League'}
      playerHref={(playerId) => playerId != null ? `/player/${playerId}` : null}
    />
  )
}

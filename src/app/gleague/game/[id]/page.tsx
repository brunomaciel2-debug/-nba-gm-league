'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import GameBoxScore, { BoxRow } from '@/components/GameBoxScore'

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

  // G-League box scores don't track technical fouls or a live +/- — those
  // columns simply don't exist on gleague_box_scores, unlike the NBA's
  // fuller box_scores table. Zeroed out here rather than adding columns
  // the G-League simulation has no way to produce real values for.
  const toBoxRow = (b: any): BoxRow => ({
    id: b.id, player_id: b.player?.id ?? b.player_id, name: b.player?.name ?? '', photo_url: b.player?.photo_url ?? null, pos: b.player?.pos ?? '',
    mins: b.mins || 0, pts: b.pts || 0, fgm: b.fgm || 0, fga: b.fga || 0, tpm: b.tpm || 0, tpa: b.tpa || 0,
    ftm: b.ftm || 0, fta: b.fta || 0, reb: b.reb || 0, ast: b.ast || 0, turnovers: b.turnovers || 0,
    stl: b.stl || 0, blk: b.blk || 0, off_reb: b.off_reb || 0, def_reb: b.def_reb || 0, pf: b.pf || 0,
    tech_fouls: 0, plus_minus: 0, is_starter: !!b.is_starter,
    foul_trouble: false,
  })

  const homeBox = boxScores.filter((b: any) => b.gleague_team_id === game.home_team).map(toBoxRow)
  const awayBox = boxScores.filter((b: any) => b.gleague_team_id === game.away_team).map(toBoxRow)

  const home = game.home as any
  const away = game.away as any

  return (
    <GameBoxScore
      homeTeam={{ id: game.home_team, name: home?.name, logo_url: home?.logo_url, color: home?.color, href: `/gleague/${game.home_team}`, arena: home?.arena, city: home?.city, wins: home?.wins, losses: home?.losses }}
      awayTeam={{ id: game.away_team, name: away?.name, logo_url: away?.logo_url, color: away?.color, href: `/gleague/${game.away_team}`, wins: away?.wins, losses: away?.losses }}
      homeScore={game.home_score}
      awayScore={game.away_score}
      homeBox={homeBox}
      awayBox={awayBox}
      playedAt={game.played_at}
      weekLabel={game.week_number > 0 ? `${isPT ? 'Semana' : 'Week'} ${game.week_number}` : null}
      status={game.status}
      isPT={isPT}
      backHref="/gleague"
      backLabel={isPT ? 'G-League' : 'G-League'}
      playerHref={(playerId) => playerId ? `/player/${playerId}` : null}
    />
  )
}

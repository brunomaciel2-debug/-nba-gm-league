'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import GameBoxScore, { BoxRow } from '@/components/GameBoxScore'

export default function GamePage({ params }: { params: { id: string } }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<any>(null)
  const [referee, setReferee] = useState<any>(null)
  const [boxScores, setBoxScores] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      const { data: gameData } = await supabase
        .from('games')
        .select('*, home:teams!games_home_team_fkey(*), away:teams!games_away_team_fkey(*)')
        .eq('id', params.id)
        .single()
      setGame(gameData)
      if (!gameData) { setLoading(false); return }

      // No declared foreign key from games.referee_id to referees (same
      // convention as team_id elsewhere) — fetch the name separately rather
      // than risk an embedded-join 400.
      if (gameData.referee_id) {
        const { data: ref } = await supabase.from('referees').select('name').eq('id', gameData.referee_id).single()
        setReferee(ref)
      }

      const { data: boxScoresData } = await supabase
        .from('box_scores')
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

  const toBoxRow = (b: any): BoxRow => ({
    id: b.id, player_id: b.player?.id ?? b.player_id, name: b.player?.name ?? '', photo_url: b.player?.photo_url ?? null, pos: b.player?.pos ?? '',
    mins: b.mins || 0, pts: b.pts || 0, fgm: b.fgm || 0, fga: b.fga || 0, tpm: b.tpm || 0, tpa: b.tpa || 0,
    ftm: b.ftm || 0, fta: b.fta || 0, reb: b.reb || 0, ast: b.ast || 0, turnovers: b.turnovers || 0,
    stl: b.stl || 0, blk: b.blk || 0, off_reb: b.off_reb || 0, def_reb: b.def_reb || 0, pf: b.pf || 0,
    tech_fouls: b.tech_fouls || 0, plus_minus: b.plus_minus || 0, is_starter: !!b.is_starter,
  })

  const homeBox = boxScores.filter((b: any) => b.team_id === game.home_team).map(toBoxRow)
  const awayBox = boxScores.filter((b: any) => b.team_id === game.away_team).map(toBoxRow)

  const home = game.home as any
  const away = game.away as any

  return (
    <GameBoxScore
      homeTeam={{ id: game.home_team, name: home?.name, logo_url: home?.logo_url, color: home?.color, href: `/team/${game.home_team}` }}
      awayTeam={{ id: game.away_team, name: away?.name, logo_url: away?.logo_url, color: away?.color, href: `/team/${game.away_team}` }}
      homeScore={game.home_score}
      awayScore={game.away_score}
      homeBox={homeBox}
      awayBox={awayBox}
      periodScores={game.period_scores}
      playedAt={game.played_at}
      weekLabel={game.week_number > 0 ? `${isPT ? 'Semana' : 'Week'} ${game.week_number}` : null}
      attendance={game.attendance}
      refereeName={referee?.name || null}
      refereeHref={referee?.name ? `/referees/${game.referee_id}` : null}
      refereeRating={game.referee_rating}
      status={game.status}
      isPT={isPT}
      backHref="/schedule"
      backLabel={isPT ? 'Calendário' : 'Schedule'}
    />
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import GameBoxScore, { BoxRow } from '@/components/GameBoxScore'

// Friendly games against a "Rest of the World" team never get a real `games`
// row (world_team ids can't satisfy games.home_team/away_team's FK to
// teams.id — see preseason-simulator.ts) — their box score lives directly on
// preseason_games.box_score as { home: [...], away: [...] }. This route
// renders that data through the exact same GameBoxScore panel used for real
// NBA-vs-NBA games, so the two look identical to the commissioner.
export default function FriendlyGamePage({ params }: { params: { id: string } }) {
  const { t } = useTranslation()
  const router = useRouter()
  const isPT = t('common.save') === 'Guardar'
  const [loading, setLoading] = useState(true)
  const [pg, setPg] = useState<any>(null)
  const [homeInfo, setHomeInfo] = useState<any>(null)
  const [awayInfo, setAwayInfo] = useState<any>(null)
  const [photosByPlayerId, setPhotosByPlayerId] = useState<Record<string, string>>({})

  useEffect(() => {
    (async () => {
      const { data: pgData } = await supabase
        .from('preseason_games')
        .select('*')
        .eq('id', params.id)
        .single()

      if (!pgData) { setLoading(false); return }

      // NBA-vs-NBA friendlies DO get a real games row — send those to the
      // canonical box score page instead of duplicating the lookup here.
      if (pgData.game_id) {
        router.replace(`/game/${pgData.game_id}`)
        return
      }

      setPg(pgData)

      const homeTable = pgData.home_type === 'nba' ? 'teams' : 'world_teams'
      const awayTable = pgData.away_type === 'nba' ? 'teams' : 'world_teams'
      // world_teams has no arena_capacity column (no arena economy for World
      // opponents) — only request it against the real `teams` table.
      const homeCols = homeTable === 'teams' ? 'id,name,logo_url,color,arena,city,arena_capacity' : 'id,name,logo_url,color,arena,city'
      const [{ data: home }, { data: away }] = await Promise.all([
        supabase.from(homeTable).select(homeCols).eq('id', pgData.home_team).single(),
        supabase.from(awayTable).select('id,name,logo_url,color,arena,city').eq('id', pgData.away_team).single(),
      ])
      setHomeInfo(home)
      setAwayInfo(away)

      // box_score is a frozen JSON blob (no photo_url stored) — a World-team
      // opponent's players never have a `players` row at all, so only fetch
      // for the ids that plausibly do (skips a pointless empty-array query).
      const playerIds = [...(pgData.box_score?.home || []), ...(pgData.box_score?.away || [])]
        .map((b: any) => b.player_id).filter(Boolean)
      if (playerIds.length) {
        const { data: photoRows } = await supabase.from('players').select('id,photo_url').in('id', playerIds)
        const map: Record<string, string> = {}
        for (const p of photoRows || []) if (p.photo_url) map[p.id] = p.photo_url
        setPhotosByPlayerId(map)
      }
      setLoading(false)
    })()
  }, [params.id])

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-12 text-center" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  if (!pg) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <p className="text-sm" style={{ color: '#8a8279' }}>{isPT ? 'Jogo não encontrado.' : 'Game not found.'}</p>
      </div>
    )
  }

  const toBoxRow = (b: any): BoxRow => ({
    id: b.player_id, player_id: b.player_id, name: b.name || '', photo_url: photosByPlayerId[b.player_id] || null, pos: b.pos || '',
    mins: b.mins || 0, pts: b.pts || 0, fgm: b.fgm || 0, fga: b.fga || 0, tpm: b.tpm || 0, tpa: b.tpa || 0,
    ftm: b.ftm || 0, fta: b.fta || 0, reb: b.reb || 0, ast: b.ast || 0, turnovers: b.turnovers || 0,
    stl: b.stl || 0, blk: b.blk || 0, off_reb: b.off_reb || 0, def_reb: b.def_reb || 0, pf: b.pf || 0,
    tech_fouls: b.tech_fouls || 0, plus_minus: b.plus_minus || 0, is_starter: !!b.is_starter,
    foul_trouble: !!b.foul_trouble,
  })

  const homeBox: BoxRow[] = (pg.box_score?.home || []).map(toBoxRow)
  const awayBox: BoxRow[] = (pg.box_score?.away || []).map(toBoxRow)

  // A World team has no NBA-team profile page to link to — only real NBA
  // players/teams get clickable links.
  const homeIsWorld = pg.home_type !== 'nba'
  const awayIsWorld = pg.away_type !== 'nba'

  return (
    <GameBoxScore
      homeTeam={{
        id: pg.home_team, name: homeInfo?.name || pg.home_team, logo_url: homeInfo?.logo_url, color: homeInfo?.color,
        href: homeIsWorld ? `/world/${pg.home_team}` : `/team/${pg.home_team}`,
        arena: homeInfo?.arena, city: homeInfo?.city, capacity: (homeInfo as any)?.arena_capacity,
      }}
      awayTeam={{
        id: pg.away_team, name: awayInfo?.name || pg.away_team, logo_url: awayInfo?.logo_url, color: awayInfo?.color,
        href: awayIsWorld ? `/world/${pg.away_team}` : `/team/${pg.away_team}`,
      }}
      homeScore={pg.home_score}
      awayScore={pg.away_score}
      homeBox={homeBox}
      awayBox={awayBox}
      periodScores={pg.period_scores}
      playedAt={pg.scheduled_date ? `${pg.scheduled_date}T12:00:00` : null}
      weekLabel={isPT ? 'Amigável' : 'Friendly'}
      status={pg.status}
      isPT={isPT}
      backHref="/schedule"
      backLabel={isPT ? 'Calendário' : 'Schedule'}
    />
  )
}

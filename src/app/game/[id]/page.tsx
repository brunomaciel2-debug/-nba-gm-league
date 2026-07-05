'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor, readableTeamColorOnDark } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

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

  const homeBox = boxScores.filter((b: any) => b.team_id === game.home_team)
  const awayBox = boxScores.filter((b: any) => b.team_id === game.away_team)

  const home = game.home as any
  const away = game.away as any
  const homeColor = readableTeamColor(home?.color)
  const awayColor = readableTeamColor(away?.color)
  const homeColorOnDark = readableTeamColorOnDark(home?.color)
  const awayColorOnDark = readableTeamColorOnDark(away?.color)
  const homeWon = game.home_score > game.away_score

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(isPT ? 'pt-PT' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  // Column order matches the standard NBA box score convention — these
  // abbreviations (MIN, PTS, FG...) stay in English in both languages,
  // same as real Portuguese-language NBA broadcasts.
  const statCols = [
    { key: 'mins', label: 'MIN' },
    { key: 'pts', label: 'PTS' },
    { key: 'fg', label: 'FG' },
    { key: 'tp', label: '3PT' },
    { key: 'ft', label: 'FT' },
    { key: 'reb', label: 'REB' },
    { key: 'ast', label: 'AST' },
    { key: 'turnovers', label: 'TO' },
    { key: 'stl', label: 'STL' },
    { key: 'blk', label: 'BLK' },
    { key: 'off_reb', label: 'OREB' },
    { key: 'def_reb', label: 'DREB' },
    { key: 'pf', label: 'PF' },
    { key: 'tech_fouls', label: 'TECH' },
    { key: 'plus_minus', label: '+/-' },
  ]
  const splitCols: Record<string, [string, string]> = { fg: ['fgm', 'fga'], tp: ['tpm', 'tpa'], ft: ['ftm', 'fta'] }

  const sumStat = (box: any[], key: string) => box.reduce((s, b) => s + (b[key] || 0), 0)
  const teamTotals = (box: any[]) => {
    const tot: Record<string, number> = {}
    ;['pts', 'reb', 'ast', 'turnovers', 'stl', 'blk', 'off_reb', 'def_reb', 'pf', 'tech_fouls', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta'].forEach(k => tot[k] = sumStat(box, k))
    return tot
  }
  const pct = (m: number, a: number) => a > 0 ? Math.round(m / a * 100) + '%' : '—'

  const homeTotals = teamTotals(homeBox)
  const awayTotals = teamTotals(awayBox)

  const cellValue = (b: any, key: string) => {
    if (splitCols[key]) { const [m, a] = splitCols[key]; return `${b[m] || 0}-${b[a] || 0}` }
    if (key === 'plus_minus') { const v = b[key] || 0; return v > 0 ? `+${v}` : `${v}` }
    return b[key] ?? 0
  }

  const BoxTable = ({ players, color, totals }: { players: any[], color: string, totals: any }) => {
    // Older games simulated before is_starter existed have it false/null for
    // everyone — fall back to "top 5 minutes = starters" so those box scores
    // still group sensibly instead of dumping everyone into BENCH.
    const hasStarterFlag = players.some((b: any) => b.is_starter)
    const played = players.filter((b: any) => (b.mins || 0) > 0).sort((a: any, b: any) => (b.mins || 0) - (a.mins || 0))
    const starters = hasStarterFlag ? played.filter((b: any) => b.is_starter) : played.slice(0, 5)
    const bench = hasStarterFlag ? played.filter((b: any) => !b.is_starter) : played.slice(5)
    const dnp = players.filter((b: any) => !(b.mins || 0)).sort((a: any, b: any) => (a.player?.name || '').localeCompare(b.player?.name || ''))

    const PlayerRow = ({ b, i }: { b: any, i: number }) => (
      <tr style={{ background: i % 2 === 0 ? '#faf8f5' : '#f5f1eb', borderBottom: '1px solid #e8e2d6' }}>
        <td className="px-3 py-2">
          <Link href={`/player/${b.player?.id}`} className="no-underline font-semibold hover:underline"
            style={{ color }}>
            {b.player?.name}
          </Link>
          <span className="ml-1.5 text-xs" style={{ color: '#9c8e7a' }}>{b.player?.pos}</span>
          {(b.tech_fouls || 0) >= 2 && (
            <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#dc2626', color: '#fff' }}>
              ⛔ {isPT ? 'EXPULSO' : 'EJECTED'}
            </span>
          )}
        </td>
        {statCols.map(c => (
          <td key={c.key} className="px-2 py-2 text-right font-semibold"
            style={{
              color: c.key === 'pts' && b[c.key] >= 20 ? color
                : c.key === 'tech_fouls' && b[c.key] > 0 ? '#dc2626'
                : '#1a1512',
            }}>
            {cellValue(b, c.key)}
          </td>
        ))}
      </tr>
    )

    const SectionHeader = ({ label }: { label: string }) => (
      <tr style={{ background: '#ddd7ca', borderBottom: '1px solid #d4cdc5' }}>
        <th className="px-3 py-2 text-left font-bold" style={{ color: '#5c554e', minWidth: 140 }}>{label}</th>
        {statCols.map(c => (
          <th key={c.key} className="px-2 py-2 text-right font-bold" style={{ color: '#5c554e' }}>{c.label}</th>
        ))}
      </tr>
    )

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <SectionHeader label={isPT ? 'TITULARES' : 'STARTERS'} />
          </thead>
          <tbody>
            {starters.map((b: any, i: number) => <PlayerRow key={b.id} b={b} i={i} />)}
          </tbody>
          {bench.length > 0 && (
            <>
              <thead>
                <SectionHeader label={isPT ? 'BANCO' : 'BENCH'} />
              </thead>
              <tbody>
                {bench.map((b: any, i: number) => <PlayerRow key={b.id} b={b} i={i} />)}
              </tbody>
            </>
          )}
          {dnp.length > 0 && (
            <tbody>
              {dnp.map((b: any, i: number) => (
                <tr key={b.id} style={{ background: i % 2 === 0 ? '#faf8f5' : '#f5f1eb', borderBottom: '1px solid #e8e2d6' }}>
                  <td className="px-3 py-2">
                    <Link href={`/player/${b.player?.id}`} className="no-underline font-semibold hover:underline" style={{ color }}>
                      {b.player?.name}
                    </Link>
                    <span className="ml-1.5 text-xs" style={{ color: '#9c8e7a' }}>{b.player?.pos}</span>
                  </td>
                  <td colSpan={statCols.length} className="px-2 py-2 text-center" style={{ color: '#9c8e7a' }}>
                    {isPT ? "NÃO JOGOU — DECISÃO DO TREINADOR" : "DNP-COACH'S DECISION"}
                  </td>
                </tr>
              ))}
            </tbody>
          )}
          <tbody>
            {/* Totals row */}
            <tr style={{ background: '#e8e2d6', borderTop: '2px solid #d4cdc5' }}>
              <td className="px-3 py-2 font-black text-xs" style={{ color: '#1a1512' }}>{isPT ? 'EQUIPA' : 'TEAM'}</td>
              {statCols.map(c => (
                <td key={c.key} className="px-2 py-2 text-right font-black" style={{ color: '#1a1512' }}>
                  {c.key === 'mins' || c.key === 'plus_minus' ? '' : cellValue(totals, c.key)}
                </td>
              ))}
            </tr>
            {/* Shooting % row */}
            <tr style={{ background: '#e8e2d6', borderBottom: '1px solid #d4cdc5' }}>
              <td className="px-3 py-2"></td>
              {statCols.map(c => (
                <td key={c.key} className="px-2 py-2 text-right text-xs font-semibold" style={{ color: '#8a8279' }}>
                  {c.key === 'fg' ? pct(totals.fgm, totals.fga)
                    : c.key === 'tp' ? pct(totals.tpm, totals.tpa)
                    : c.key === 'ft' ? pct(totals.ftm, totals.fta)
                    : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link href="/schedule" className="text-xs no-underline mb-6 block" style={{ color: '#8a8279' }}>
        ← {isPT ? 'Calendário' : 'Schedule'}
      </Link>

      {/* SCOREBOARD */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: '#1a1512', border: '1px solid #2a2218' }}>
        <div className="text-center text-xs mb-4" style={{ color: '#8a8279' }}>
          {game.played_at ? fmtDate(game.played_at) : ''}
          {game.week_number > 0 && ` · ${isPT ? 'Semana' : 'Week'} ${game.week_number}`}
          {game.attendance > 0 && ` · ${game.attendance.toLocaleString()} ${isPT ? 'adeptos' : 'fans'}`}
          {referee?.name && (
            <>
              {' · '}{isPT ? 'Árbitro' : 'Ref'}: <Link href={`/referees/${game.referee_id}`} style={{ color: '#8a8279', textDecoration: 'underline' }}>{referee.name}</Link>
              {game.status === 'final' && game.referee_rating != null && ` (${game.referee_rating.toFixed(1)}/10)`}
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          {/* Home */}
          <div className="flex-1 text-center">
            <Link href={`/team/${game.home_team}`} className="no-underline">
              {home?.logo_url && (
                <img src={home.logo_url} alt="" className="w-20 h-20 object-contain mx-auto mb-3" />
              )}
              <div className="text-sm font-bold" style={{ color: homeColorOnDark }}>{home?.name}</div>
              <div className="text-xs mb-2" style={{ color: '#8a8279' }}>{isPT ? 'CASA' : 'HOME'}</div>
            </Link>
            <div className="text-6xl font-black" style={{ color: homeWon ? homeColorOnDark : '#5c554e' }}>
              {game.home_score}
            </div>
            {homeWon && <div className="text-xs font-bold mt-1" style={{ color: '#4ade80' }}>{isPT ? 'VITÓRIA' : 'WIN'}</div>}
          </div>

          {/* VS */}
          <div className="text-center flex-shrink-0">
            <div className="text-2xl font-black" style={{ color: '#3a3228' }}>VS</div>
            {game.status === 'final' && (
              <div className="text-xs px-2 py-0.5 rounded mt-1" style={{ background: '#2a2218', color: '#8a8279' }}>
                {isPT ? 'FINAL' : 'FINAL'}
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 text-center">
            <Link href={`/team/${game.away_team}`} className="no-underline">
              {away?.logo_url && (
                <img src={away.logo_url} alt="" className="w-20 h-20 object-contain mx-auto mb-3" />
              )}
              <div className="text-sm font-bold" style={{ color: awayColorOnDark }}>{away?.name}</div>
              <div className="text-xs mb-2" style={{ color: '#8a8279' }}>{isPT ? 'FORA' : 'AWAY'}</div>
            </Link>
            <div className="text-6xl font-black" style={{ color: !homeWon ? awayColorOnDark : '#5c554e' }}>
              {game.away_score}
            </div>
            {!homeWon && <div className="text-xs font-bold mt-1" style={{ color: '#4ade80' }}>{isPT ? 'VITÓRIA' : 'WIN'}</div>}
          </div>
        </div>
      </div>

      {/* BOX SCORES */}
      {boxScores.length > 0 ? (
        <div className="flex flex-col gap-6">
          {/* Home box score */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #d4cdc5', borderTop: `3px solid ${homeColor}` }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#e8e2d6' }}>
              {home?.logo_url && <img src={home.logo_url} alt="" className="w-6 h-6 object-contain" />}
              <span className="font-bold text-sm" style={{ color: homeColor }}>{home?.name}</span>
              <span className="ml-auto text-lg font-black" style={{ color: '#1a1512' }}>{game.home_score}</span>
            </div>
            <BoxTable players={homeBox} color={homeColor} totals={homeTotals} />
          </div>

          {/* Away box score */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #d4cdc5', borderTop: `3px solid ${awayColor}` }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#e8e2d6' }}>
              {away?.logo_url && <img src={away.logo_url} alt="" className="w-6 h-6 object-contain" />}
              <span className="font-bold text-sm" style={{ color: awayColor }}>{away?.name}</span>
              <span className="ml-auto text-lg font-black" style={{ color: '#1a1512' }}>{game.away_score}</span>
            </div>
            <BoxTable players={awayBox} color={awayColor} totals={awayTotals} />
          </div>
        </div>
      ) : (
        <div className="text-center py-12 rounded-2xl" style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }}>
          <div className="text-3xl mb-3">📊</div>
          <p className="text-sm" style={{ color: '#8a8279' }}>{isPT ? 'Box score não disponível para este jogo.' : 'Box score not available for this game.'}</p>
        </div>
      )}
    </div>
  )
}

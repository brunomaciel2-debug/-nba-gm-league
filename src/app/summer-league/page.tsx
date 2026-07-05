'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

const ROUND_LABEL: Record<string, { pt: string, en: string }> = {
  prelim: { pt: 'Preliminar', en: 'Preliminary' },
  consolation: { pt: 'Consolação', en: 'Consolation' },
  semifinal: { pt: 'Meia-Final', en: 'Semifinal' },
  final: { pt: 'Final', en: 'Final' },
}

const ROLE_LABEL: Record<string, { pt: string, en: string, color: string }> = {
  rookie: { pt: 'Rookie', en: 'Rookie', color: '#15803d' },
  sophomore: { pt: 'Sophomore', en: 'Sophomore', color: '#1d4ed8' },
  filler: { pt: 'Complemento', en: 'Filler', color: '#8a8279' },
}

function TeamChip({ team, isPT }: { team: any, isPT: boolean }) {
  const tc = team ? readableTeamColor(team.color) : '#9c9088'
  return (
    <div className="flex items-center gap-2 min-w-0">
      {team?.logo_url
        ? <img src={team.logo_url} alt="" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
        : <div style={{ width: 22, height: 22, borderRadius: 3, background: tc + '22', flexShrink: 0 }} />}
      <span className="truncate text-xs font-semibold" style={{ color: '#1a1512' }}>{team?.name || (isPT ? 'A definir' : 'TBD')}</span>
    </div>
  )
}

export default function SummerLeaguePage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [tab, setTab] = useState<'calendar' | 'results' | 'standings' | 'bracket' | 'roster'>('standings')
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState<any[]>([])
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({})
  const [expandedGame, setExpandedGame] = useState<string | null>(null)
  const [boxScores, setBoxScores] = useState<Record<string, any[]>>({})
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [rosters, setRosters] = useState<any[]>([])
  const [playersMap, setPlayersMap] = useState<Record<number, any>>({})

  useEffect(() => {
    (async () => {
      const [{ data: gamesData }, { data: teamsData }, gm] = await Promise.all([
        supabase.from('summer_league_games').select('*').order('scheduled_date'),
        supabase.from('teams').select('id,name,color,logo_url').not('id', 'in', '(ALL,RVS,ROO,SOP)'),
        supabase.auth.getUser().then(async ({ data }) => {
          if (!data.user) return null
          const { data: profile } = await supabase.from('gm_profiles').select('team_id').eq('id', data.user.id).single()
          return profile
        }),
      ])
      setGames(gamesData || [])
      const tMap: Record<string, any> = {}
      ;(teamsData || []).forEach((tm: any) => { tMap[tm.id] = tm })
      setTeamsMap(tMap)
      setMyTeamId(gm?.team_id || null)

      const { data: rosterData } = await supabase.from('summer_league_rosters').select('*')
      setRosters(rosterData || [])
      const playerIds = Array.from(new Set((rosterData || []).map((r: any) => r.player_id)))
      if (playerIds.length) {
        const { data: playersData } = await supabase.from('players').select('id,name,pos,age').in('id', playerIds)
        const pMap: Record<number, any> = {}
        ;(playersData || []).forEach((p: any) => { pMap[p.id] = p })
        setPlayersMap(pMap)
      }
      setLoading(false)
    })()
  }, [])

  const toggleBoxScore = async (gameId: string) => {
    if (expandedGame === gameId) { setExpandedGame(null); return }
    setExpandedGame(gameId)
    if (!boxScores[gameId]) {
      const { data } = await supabase.from('summer_league_box_scores').select('*').eq('game_id', gameId).order('pts', { ascending: false })
      const withPlayers = await Promise.all((data || []).map(async (b: any) => {
        const { data: p } = await supabase.from('players').select('name').eq('id', b.player_id).single()
        return { ...b, name: p?.name || '...' }
      }))
      setBoxScores(prev => ({ ...prev, [gameId]: withPlayers }))
    }
  }

  if (loading) return <div className="text-center py-12" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  const prelimGames = games.filter(g => g.round === 'prelim')
  const consolationGames = games.filter(g => g.round === 'consolation')
  const semiGames = games.filter(g => g.round === 'semifinal').sort((a, b) => (a.game_number || 0) - (b.game_number || 0))
  const finalGame = games.find(g => g.round === 'final')

  // Standings computed the same way as summer-league.ts's getSummerLeagueStandings
  const rec: Record<string, { wins: number, losses: number, diff: number }> = {}
  Object.keys(teamsMap).forEach(id => { rec[id] = { wins: 0, losses: 0, diff: 0 } })
  for (const g of prelimGames) {
    if (g.home_score == null || g.away_score == null) continue
    const homeWon = g.home_score > g.away_score
    if (rec[g.home_team]) { rec[g.home_team].wins += homeWon ? 1 : 0; rec[g.home_team].losses += homeWon ? 0 : 1; rec[g.home_team].diff += g.home_score - g.away_score }
    if (rec[g.away_team]) { rec[g.away_team].wins += homeWon ? 0 : 1; rec[g.away_team].losses += homeWon ? 1 : 0; rec[g.away_team].diff += g.away_score - g.home_score }
  }
  const standings = Object.keys(teamsMap).map(id => ({ team: teamsMap[id], ...rec[id] }))
    .sort((a, b) => {
      const pctA = (a.wins + a.losses) ? a.wins / (a.wins + a.losses) : 0
      const pctB = (b.wins + b.losses) ? b.wins / (b.wins + b.losses) : 0
      return pctB - pctA || b.diff - a.diff
    })

  const myRoster = myTeamId ? rosters.filter(r => r.team_id === myTeamId) : []

  const TABS: { key: typeof tab, labelPT: string, labelEN: string }[] = [
    { key: 'standings', labelPT: 'Classificação', labelEN: 'Standings' },
    { key: 'calendar', labelPT: 'Calendário', labelEN: 'Calendar' },
    { key: 'results', labelPT: 'Resultados', labelEN: 'Results' },
    { key: 'bracket', labelPT: 'Playoff Bracket', labelEN: 'Playoff Bracket' },
    { key: 'roster', labelPT: 'O Meu Roster', labelEN: 'My Roster' },
  ]

  const GameRow = ({ g }: { g: any }) => {
    const home = teamsMap[g.home_team], away = teamsMap[g.away_team]
    const done = g.home_score != null
    return (
      <div className="rounded-lg" style={{ border: '1px solid #d4cdc5', background: '#faf8f5' }}>
        <button onClick={() => toggleBoxScore(g.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
          <span className="text-xs w-16 flex-shrink-0" style={{ color: '#8a8279' }}>{g.scheduled_date}</span>
          <TeamChip team={home} isPT={isPT} />
          <span className="text-xs font-black flex-shrink-0" style={{ color: done ? '#1a1512' : '#c8b8a8' }}>
            {done ? `${g.home_score} - ${g.away_score}` : (isPT ? 'vs' : 'vs')}
          </span>
          <TeamChip team={away} isPT={isPT} />
          {g.game_number && <span className="text-xs ml-auto flex-shrink-0" style={{ color: '#8a8279' }}>#{g.game_number}</span>}
        </button>
        {expandedGame === g.id && (
          <div className="px-3 pb-3 grid sm:grid-cols-2 gap-3">
            {[g.home_team, g.away_team].map(tid => (
              <div key={tid}>
                <div className="text-xs font-bold mb-1" style={{ color: '#5c554e' }}>{teamsMap[tid]?.name}</div>
                <table className="w-full text-xs">
                  <tbody>
                    {(boxScores[g.id] || []).filter(b => b.team_id === tid).map(b => (
                      <tr key={b.player_id} style={{ borderTop: '1px solid #e8e2d6' }}>
                        <td className="py-1 truncate" style={{ color: '#1a1512', maxWidth: 120 }}>{b.name}</td>
                        <td className="py-1 text-right" style={{ color: '#8a8279' }}>{b.mins}m</td>
                        <td className="py-1 text-right font-bold" style={{ color: '#1a1512' }}>{b.pts}p</td>
                        <td className="py-1 text-right" style={{ color: '#8a8279' }}>{b.reb}r</td>
                        <td className="py-1 text-right" style={{ color: '#8a8279' }}>{b.ast}a</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-2">
        <span className="sec-title">
          <i className="ti ti-sun" style={{ fontSize: 14, marginRight: 6, color: '#c8102e' }}></i>
          Summer League — Las Vegas
        </span>
      </div>
      <p className="text-xs mb-4" style={{ color: '#8a8279' }}>
        {isPT
          ? 'As 30 equipas jogam com os seus Rookies e Sophomores (completados com jovens agentes livres) — nada aqui conta para as estatísticas, cap ou registo real da tua equipa.'
          : "All 30 teams play with their Rookies and Sophomores (filled out with young free agents) — nothing here counts toward real stats, cap, or your team's record."}
      </p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: tab === tb.key ? '#c8102e' : '#e8e2d6', color: tab === tb.key ? '#fff' : '#5c554e' }}>
            {isPT ? tb.labelPT : tb.labelEN}
          </button>
        ))}
      </div>

      {games.length === 0 && (
        <div className="rounded-xl p-6 text-center" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
          <p className="text-sm" style={{ color: '#6b5f4e' }}>
            {isPT ? 'A Summer League ainda não começou esta época.' : "Summer League hasn't started this season yet."}
          </p>
        </div>
      )}

      {tab === 'standings' && games.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #d4cdc5' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#e8e2d6' }}>
                <th className="text-left py-2 px-3" style={{ color: '#5c554e' }}>#</th>
                <th className="text-left py-2 px-3" style={{ color: '#5c554e' }}>{isPT ? 'Equipa' : 'Team'}</th>
                <th className="text-right py-2 px-3" style={{ color: '#5c554e' }}>V</th>
                <th className="text-right py-2 px-3" style={{ color: '#5c554e' }}>D</th>
                <th className="text-right py-2 px-3" style={{ color: '#5c554e' }}>+/-</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => (
                <tr key={row.team.id} style={{ background: i < 4 ? '#dcfce7' : '#faf8f5', borderTop: '1px solid #e8e2d6' }}>
                  <td className="py-2 px-3 font-bold" style={{ color: i < 4 ? '#15803d' : '#8a8279' }}>{i + 1}</td>
                  <td className="py-2 px-3"><TeamChip team={row.team} isPT={isPT} /></td>
                  <td className="py-2 px-3 text-right font-bold">{row.wins}</td>
                  <td className="py-2 px-3 text-right">{row.losses}</td>
                  <td className="py-2 px-3 text-right" style={{ color: row.diff >= 0 ? '#15803d' : '#dc2626' }}>{row.diff >= 0 ? '+' : ''}{row.diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="flex flex-col gap-4">
          {['prelim', 'consolation', 'semifinal', 'final'].map(round => {
            const roundGames = games.filter(g => g.round === round)
            if (!roundGames.length) return null
            return (
              <div key={round}>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#8a8279' }}>
                  {isPT ? ROUND_LABEL[round].pt : ROUND_LABEL[round].en}
                </div>
                <div className="flex flex-col gap-2">
                  {roundGames.map(g => <GameRow key={g.id} g={g} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'results' && (
        <div className="flex flex-col gap-2">
          {games.filter(g => g.home_score != null).map(g => <GameRow key={g.id} g={g} />)}
        </div>
      )}

      {tab === 'bracket' && (
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#8a8279' }}>{isPT ? 'Meias-Finais' : 'Semifinals'}</div>
          <div className="flex gap-8 flex-wrap justify-center">
            {[1, 2].map(n => {
              const g = semiGames.find(sg => sg.game_number === n)
              return (
                <div key={n} className="flex flex-col gap-1" style={{ width: 220 }}>
                  <div className="text-xs" style={{ color: '#8a8279' }}>{isPT ? `Meia-Final ${n}` : `Semifinal ${n}`}</div>
                  <div className="rounded-lg p-2" style={{ background: '#f0ece5', border: '1px solid #d4cdc5' }}>
                    <TeamChip team={g ? teamsMap[g.home_team] : null} isPT={isPT} />
                    <div className="text-center text-xs my-1" style={{ color: '#8a8279' }}>{g?.home_score != null ? `${g.home_score} - ${g.away_score}` : 'vs'}</div>
                    <TeamChip team={g ? teamsMap[g.away_team] : null} isPT={isPT} />
                  </div>
                </div>
              )
            })}
          </div>
          <i className="ti ti-trophy" style={{ fontSize: 32, color: '#c8102e' }}></i>
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#c8102e' }}>{isPT ? 'Final' : 'Final'}</div>
          <div className="rounded-lg p-3" style={{ background: '#fff0f0', border: '1.5px dashed #c8102e', width: 240 }}>
            <TeamChip team={finalGame ? teamsMap[finalGame.home_team] : null} isPT={isPT} />
            <div className="text-center text-xs my-1" style={{ color: '#8a8279' }}>{finalGame?.home_score != null ? `${finalGame.home_score} - ${finalGame.away_score}` : 'vs'}</div>
            <TeamChip team={finalGame ? teamsMap[finalGame.away_team] : null} isPT={isPT} />
          </div>
          {finalGame?.home_score != null && (
            <div className="text-sm font-black" style={{ color: '#15803d' }}>
              🏆 {teamsMap[finalGame.home_score > finalGame.away_score ? finalGame.home_team : finalGame.away_team]?.name}
            </div>
          )}
        </div>
      )}

      {tab === 'roster' && (
        <div>
          {!myTeamId && <p className="text-sm" style={{ color: '#8a8279' }}>{isPT ? 'Inicia sessão com uma equipa para ver o teu roster.' : 'Log in with a team to see your roster.'}</p>}
          {myTeamId && !myRoster.length && <p className="text-sm" style={{ color: '#8a8279' }}>{isPT ? 'Roster ainda não gerado.' : 'Roster not generated yet.'}</p>}
          <div className="flex flex-col gap-2">
            {myRoster.map(r => {
              const p = playersMap[r.player_id]
              const role = ROLE_LABEL[r.role]
              return (
                <div key={r.player_id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }}>
                  <span className="text-sm font-semibold flex-1" style={{ color: '#1a1512' }}>{p?.name || '...'}</span>
                  <span className="text-xs" style={{ color: '#8a8279' }}>{p?.pos}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: role.color + '22', color: role.color }}>
                    {isPT ? role.pt : role.en}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

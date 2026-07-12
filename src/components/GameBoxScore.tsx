'use client'
import Link from 'next/link'
import { readableTeamColor, readableTeamColorOnDark } from '@/lib/color'

// Same panel for every game — real NBA vs NBA and NBA vs Rest of the World
// friendlies alike. Both callers (src/app/game/[id]/page.tsx and
// src/app/game/friendly/[id]/page.tsx) normalize their own data source into
// this one flat row shape so this component never has to know where the
// numbers came from.
export interface BoxRow {
  id: string | number
  player_id: string | number | null
  name: string
  pos: string
  mins: number
  pts: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  reb: number
  ast: number
  turnovers: number
  stl: number
  blk: number
  off_reb: number
  def_reb: number
  pf: number
  tech_fouls: number
  plus_minus: number
  is_starter?: boolean
}

export interface TeamInfo {
  id: string
  name: string
  logo_url?: string | null
  color?: string | null
  href?: string
}

export interface PeriodScore {
  quarter: number
  home: number
  away: number
}

export interface GameBoxScoreProps {
  homeTeam: TeamInfo
  awayTeam: TeamInfo
  homeScore: number
  awayScore: number
  homeBox: BoxRow[]
  awayBox: BoxRow[]
  periodScores?: PeriodScore[] | null
  playedAt?: string | null
  weekLabel?: string | null
  attendance?: number | null
  refereeName?: string | null
  refereeHref?: string | null
  refereeRating?: number | null
  status?: string
  isPT: boolean
  backHref: string
  backLabel: string
  playerHref?: (playerId: string | number | null) => string | null
}

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
] as const
const splitCols: Record<string, [string, string]> = { fg: ['fgm', 'fga'], tp: ['tpm', 'tpa'], ft: ['ftm', 'fta'] }

// Game Score (GmSc) — John Hollinger's formula, the one NBA.com/ESPN/
// Basketball-Reference actually use to summarize a single-game performance
// in one number. 10 is average, 40+ is MVP-caliber. Entirely derivable
// from the box score stats already stored — no new columns needed.
const gameScore = (b: BoxRow) =>
  b.pts + 0.4 * b.fgm - 0.7 * b.fga - 0.4 * (b.fta - b.ftm)
  + 0.7 * b.off_reb + 0.3 * b.def_reb + b.stl + 0.7 * b.ast + 0.7 * b.blk
  - 0.4 * b.pf - b.turnovers

const sumStat = (box: BoxRow[], key: string) => box.reduce((s, b) => s + ((b as any)[key] || 0), 0)
const teamTotals = (box: BoxRow[]) => {
  const tot: Record<string, number> = {}
  ;['pts', 'reb', 'ast', 'turnovers', 'stl', 'blk', 'off_reb', 'def_reb', 'pf', 'tech_fouls', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta'].forEach(k => tot[k] = sumStat(box, k))
  return tot
}
const pct = (m: number, a: number) => a > 0 ? Math.round(m / a * 100) + '%' : '—'
const cellValue = (b: any, key: string) => {
  if (splitCols[key]) { const [m, a] = splitCols[key]; return `${b[m] || 0}-${b[a] || 0}` }
  if (key === 'plus_minus') { const v = b[key] || 0; return v > 0 ? `+${v}` : `${v}` }
  return b[key] ?? 0
}

export default function GameBoxScore(props: GameBoxScoreProps) {
  const {
    homeTeam, awayTeam, homeScore, awayScore, homeBox, awayBox, periodScores,
    playedAt, weekLabel, attendance, refereeName, refereeHref, refereeRating,
    status, isPT, backHref, backLabel, playerHref,
  } = props

  const homeColor = readableTeamColor(homeTeam.color || '')
  const awayColor = readableTeamColor(awayTeam.color || '')
  const homeColorOnDark = readableTeamColorOnDark(homeTeam.color || '')
  const awayColorOnDark = readableTeamColorOnDark(awayTeam.color || '')
  const homeWon = homeScore > awayScore

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(isPT ? 'pt-PT' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const homeTotals = teamTotals(homeBox)
  const awayTotals = teamTotals(awayBox)

  const resolvePlayerHref = (b: BoxRow) => playerHref ? playerHref(b.player_id) : (b.player_id != null ? `/player/${b.player_id}` : null)

  // Game MVP — highest Game Score among everyone who actually played, on
  // either team. Only meaningful once the game has real box score minutes.
  const homePlayed = homeBox.filter(b => (b.mins || 0) > 0).map(b => ({ b, isHome: true }))
  const awayPlayed = awayBox.filter(b => (b.mins || 0) > 0).map(b => ({ b, isHome: false }))
  const mvpEntry = [...homePlayed, ...awayPlayed].reduce<{ b: BoxRow, isHome: boolean } | null>(
    (best, cur) => (!best || gameScore(cur.b) > gameScore(best.b)) ? cur : best, null,
  )
  const mvpColor = mvpEntry ? (mvpEntry.isHome ? homeColor : awayColor) : ''
  const mvpTeam = mvpEntry ? (mvpEntry.isHome ? homeTeam : awayTeam) : null

  const BoxTable = ({ players, color, totals }: { players: BoxRow[], color: string, totals: any }) => {
    const hasStarterFlag = players.some((b) => b.is_starter)
    const played = players.filter((b) => (b.mins || 0) > 0).sort((a, b) => (b.mins || 0) - (a.mins || 0))
    const starters = hasStarterFlag ? played.filter((b) => b.is_starter) : played.slice(0, 5)
    const bench = hasStarterFlag ? played.filter((b) => !b.is_starter) : played.slice(5)
    const dnp = players.filter((b) => !(b.mins || 0)).sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    const NameCell = ({ b }: { b: BoxRow }) => {
      const href = resolvePlayerHref(b)
      const inner = <>{b.name}</>
      return href ? (
        <Link href={href} className="no-underline font-semibold hover:underline" style={{ color }}>{inner}</Link>
      ) : (
        <span className="font-semibold" style={{ color }}>{inner}</span>
      )
    }

    const PlayerRow = ({ b, i }: { b: BoxRow, i: number }) => (
      <tr style={{ background: i % 2 === 0 ? '#faf8f5' : '#f5f1eb', borderBottom: '1px solid #e8e2d6' }}>
        <td className="px-3 py-2">
          <NameCell b={b} />
          <span className="ml-1.5 text-xs" style={{ color: '#9c8e7a' }}>{b.pos}</span>
          {(b.tech_fouls || 0) >= 2 && (
            <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#dc2626', color: '#fff' }}>
              ⛔ {isPT ? 'EXPULSO' : 'EJECTED'}
            </span>
          )}
        </td>
        {statCols.map(c => (
          <td key={c.key} className="px-2 py-2 text-right font-semibold"
            style={{
              color: c.key === 'pts' && (b as any)[c.key] >= 20 ? color
                : c.key === 'tech_fouls' && (b as any)[c.key] > 0 ? '#dc2626'
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
            {starters.map((b, i) => <PlayerRow key={b.id} b={b} i={i} />)}
          </tbody>
          {bench.length > 0 && (
            <>
              <thead>
                <SectionHeader label={isPT ? 'BANCO' : 'BENCH'} />
              </thead>
              <tbody>
                {bench.map((b, i) => <PlayerRow key={b.id} b={b} i={i} />)}
              </tbody>
            </>
          )}
          {dnp.length > 0 && (
            <tbody>
              {dnp.map((b, i) => (
                <tr key={b.id} style={{ background: i % 2 === 0 ? '#faf8f5' : '#f5f1eb', borderBottom: '1px solid #e8e2d6' }}>
                  <td className="px-3 py-2">
                    <NameCell b={b} />
                    <span className="ml-1.5 text-xs" style={{ color: '#9c8e7a' }}>{b.pos}</span>
                  </td>
                  <td colSpan={statCols.length} className="px-2 py-2 text-center" style={{ color: '#9c8e7a' }}>
                    {isPT ? "NÃO JOGOU — DECISÃO DO TREINADOR" : "DNP-COACH'S DECISION"}
                  </td>
                </tr>
              ))}
            </tbody>
          )}
          <tbody>
            <tr style={{ background: '#e8e2d6', borderTop: '2px solid #d4cdc5' }}>
              <td className="px-3 py-2 font-black text-xs" style={{ color: '#1a1512' }}>{isPT ? 'EQUIPA' : 'TEAM'}</td>
              {statCols.map(c => (
                <td key={c.key} className="px-2 py-2 text-right font-black" style={{ color: '#1a1512' }}>
                  {c.key === 'mins' || c.key === 'plus_minus' ? '' : cellValue(totals, c.key)}
                </td>
              ))}
            </tr>
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
      <Link href={backHref} className="text-xs no-underline mb-6 block" style={{ color: '#8a8279' }}>
        ← {backLabel}
      </Link>

      {/* SCOREBOARD */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: '#1a1512', border: '1px solid #2a2218' }}>
        <div className="text-center text-xs mb-4" style={{ color: '#8a8279' }}>
          {playedAt ? fmtDate(playedAt) : ''}
          {weekLabel && ` · ${weekLabel}`}
          {!!attendance && attendance > 0 && ` · ${attendance.toLocaleString()} ${isPT ? 'adeptos' : 'fans'}`}
          {refereeName && (
            <>
              {' · '}{isPT ? 'Árbitro' : 'Ref'}: {refereeHref ? (
                <Link href={refereeHref} style={{ color: '#8a8279', textDecoration: 'underline' }}>{refereeName}</Link>
              ) : refereeName}
              {status === 'final' && refereeRating != null && ` (${refereeRating.toFixed(1)}/10)`}
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          {/* Home */}
          <div className="flex-1 text-center">
            {homeTeam.href ? (
              <Link href={homeTeam.href} className="no-underline">
                {homeTeam.logo_url && <img src={homeTeam.logo_url} alt="" className="w-20 h-20 object-contain mx-auto mb-3" />}
                <div className="text-sm font-bold" style={{ color: homeColorOnDark }}>{homeTeam.name}</div>
                <div className="text-xs mb-2" style={{ color: '#8a8279' }}>{isPT ? 'CASA' : 'HOME'}</div>
              </Link>
            ) : (
              <>
                {homeTeam.logo_url && <img src={homeTeam.logo_url} alt="" className="w-20 h-20 object-contain mx-auto mb-3" />}
                <div className="text-sm font-bold" style={{ color: homeColorOnDark }}>{homeTeam.name}</div>
                <div className="text-xs mb-2" style={{ color: '#8a8279' }}>{isPT ? 'CASA' : 'HOME'}</div>
              </>
            )}
            <div className="text-6xl font-black" style={{ color: homeWon ? homeColorOnDark : '#5c554e' }}>
              {homeScore}
            </div>
            {homeWon && <div className="text-xs font-bold mt-1" style={{ color: '#4ade80' }}>{isPT ? 'VITÓRIA' : 'WIN'}</div>}
          </div>

          {/* VS */}
          <div className="text-center flex-shrink-0">
            <div className="text-2xl font-black" style={{ color: '#3a3228' }}>VS</div>
            {status === 'final' && (
              <div className="text-xs px-2 py-0.5 rounded mt-1" style={{ background: '#2a2218', color: '#8a8279' }}>
                {isPT ? 'FINAL' : 'FINAL'}
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 text-center">
            {awayTeam.href ? (
              <Link href={awayTeam.href} className="no-underline">
                {awayTeam.logo_url && <img src={awayTeam.logo_url} alt="" className="w-20 h-20 object-contain mx-auto mb-3" />}
                <div className="text-sm font-bold" style={{ color: awayColorOnDark }}>{awayTeam.name}</div>
                <div className="text-xs mb-2" style={{ color: '#8a8279' }}>{isPT ? 'FORA' : 'AWAY'}</div>
              </Link>
            ) : (
              <>
                {awayTeam.logo_url && <img src={awayTeam.logo_url} alt="" className="w-20 h-20 object-contain mx-auto mb-3" />}
                <div className="text-sm font-bold" style={{ color: awayColorOnDark }}>{awayTeam.name}</div>
                <div className="text-xs mb-2" style={{ color: '#8a8279' }}>{isPT ? 'FORA' : 'AWAY'}</div>
              </>
            )}
            <div className="text-6xl font-black" style={{ color: !homeWon ? awayColorOnDark : '#5c554e' }}>
              {awayScore}
            </div>
            {!homeWon && <div className="text-xs font-bold mt-1" style={{ color: '#4ade80' }}>{isPT ? 'VITÓRIA' : 'WIN'}</div>}
          </div>
        </div>

        {/* LINE SCORE — Q1-Q4 plus OT1/OT2/... if the game went to overtime */}
        {periodScores && periodScores.length > 0 && (
          <div className="mt-5 pt-4 overflow-x-auto" style={{ borderTop: '1px solid #2a2218' }}>
            <table className="mx-auto text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="px-3 py-1 text-left" style={{ color: '#5c554e' }}></th>
                  {periodScores.map(p => (
                    <th key={p.quarter} className="px-3 py-1 text-right font-semibold" style={{ color: '#8a8279' }}>
                      {p.quarter <= 4 ? `Q${p.quarter}` : `OT${p.quarter - 4}`}
                    </th>
                  ))}
                  <th className="px-3 py-1 text-right font-bold" style={{ color: '#8a8279' }}>{isPT ? 'FINAL' : 'FINAL'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-1 text-left font-semibold" style={{ color: homeColorOnDark }}>{homeTeam.name}</td>
                  {periodScores.map(p => (
                    <td key={p.quarter} className="px-3 py-1 text-right" style={{ color: '#d8d2c5' }}>{p.home}</td>
                  ))}
                  <td className="px-3 py-1 text-right font-bold" style={{ color: homeColorOnDark }}>{homeScore}</td>
                </tr>
                <tr>
                  <td className="px-3 py-1 text-left font-semibold" style={{ color: awayColorOnDark }}>{awayTeam.name}</td>
                  {periodScores.map(p => (
                    <td key={p.quarter} className="px-3 py-1 text-right" style={{ color: '#d8d2c5' }}>{p.away}</td>
                  ))}
                  <td className="px-3 py-1 text-right font-bold" style={{ color: awayColorOnDark }}>{awayScore}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GAME MVP — highest Game Score (GmSc), the same formula NBA.com/
          ESPN use to summarize a single-game performance in one number. */}
      {mvpEntry && mvpTeam && (
        <div className="rounded-2xl p-4 mb-6 flex items-center gap-4" style={{ background: '#faf8f5', border: `1px solid ${mvpColor}` }}>
          <div className="text-3xl">🏆</div>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8a8279' }}>
              {isPT ? 'MVP do Jogo' : 'Game MVP'}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {resolvePlayerHref(mvpEntry.b) ? (
                <Link href={resolvePlayerHref(mvpEntry.b)!} className="no-underline font-black text-base hover:underline" style={{ color: mvpColor }}>
                  {mvpEntry.b.name}
                </Link>
              ) : (
                <span className="font-black text-base" style={{ color: mvpColor }}>{mvpEntry.b.name}</span>
              )}
              <span className="text-xs" style={{ color: '#8a8279' }}>{mvpTeam.name}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#e8e2d6', color: '#5c554e' }}>
                {isPT ? 'Pontuação de Jogo' : 'Game Score'}: {gameScore(mvpEntry.b).toFixed(1)}
              </span>
            </div>
            <div className="text-sm font-semibold mt-1" style={{ color: '#1a1512' }}>
              {mvpEntry.b.pts} {isPT ? 'PTS' : 'PTS'} · {mvpEntry.b.reb} {isPT ? 'RES' : 'REB'} · {mvpEntry.b.ast} {isPT ? 'AST' : 'AST'}
              {mvpEntry.b.stl >= 3 && ` · ${mvpEntry.b.stl} ${isPT ? 'ROU' : 'STL'}`}
              {mvpEntry.b.blk >= 3 && ` · ${mvpEntry.b.blk} ${isPT ? 'DES' : 'BLK'}`}
            </div>
          </div>
        </div>
      )}

      {/* BOX SCORES */}
      {(homeBox.length > 0 || awayBox.length > 0) ? (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #d4cdc5', borderTop: `3px solid ${homeColor}` }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#e8e2d6' }}>
              {homeTeam.logo_url && <img src={homeTeam.logo_url} alt="" className="w-6 h-6 object-contain" />}
              <span className="font-bold text-sm" style={{ color: homeColor }}>{homeTeam.name}</span>
              <span className="ml-auto text-lg font-black" style={{ color: '#1a1512' }}>{homeScore}</span>
            </div>
            <BoxTable players={homeBox} color={homeColor} totals={homeTotals} />
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #d4cdc5', borderTop: `3px solid ${awayColor}` }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#e8e2d6' }}>
              {awayTeam.logo_url && <img src={awayTeam.logo_url} alt="" className="w-6 h-6 object-contain" />}
              <span className="font-bold text-sm" style={{ color: awayColor }}>{awayTeam.name}</span>
              <span className="ml-auto text-lg font-black" style={{ color: '#1a1512' }}>{awayScore}</span>
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

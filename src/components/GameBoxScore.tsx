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
  photo_url?: string | null
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
  arena?: string | null
  city?: string | null
  capacity?: number | null
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
  refereePhotoUrl?: string | null
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
  { key: 'gmsc', label: 'GmSc' },
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
// Referee rating (0-10, rateRefereePerformance() in referees.ts) as a real
// traffic-light read: green once it's genuinely good, yellow through the
// merely-average middle, red the moment it dips below a passing grade.
const refRatingColor = (v: number) => v >= 7 ? '#22c55e' : v >= 6 ? '#eab308' : '#ef4444'
// A bare number ("6.5") doesn't mean anything at a glance — pair it with the
// same plain-language grade a real officiating review would use.
const refRatingLabel = (v: number, isPT: boolean) => {
  const en = v >= 9 ? 'Perfect Officiating' : v >= 8 ? 'Outstanding Performance' : v >= 7 ? 'Excellent Performance'
    : v >= 6 ? 'Questionable Performance' : v >= 5 ? 'Poor Performance' : v >= 4 ? 'Bad Officiating' : 'Terrible Officiating'
  const pt = v >= 9 ? 'Arbitragem Perfeita' : v >= 8 ? 'Desempenho Excecional' : v >= 7 ? 'Excelente Desempenho'
    : v >= 6 ? 'Desempenho Questionável' : v >= 5 ? 'Desempenho Fraco' : v >= 4 ? 'Má Arbitragem' : 'Arbitragem Terrível'
  return isPT ? pt : en
}
const cellValue = (b: any, key: string) => {
  if (splitCols[key]) { const [m, a] = splitCols[key]; return `${b[m] || 0}-${b[a] || 0}` }
  if (key === 'plus_minus') { const v = b[key] || 0; return v > 0 ? `+${v}` : `${v}` }
  if (key === 'gmsc') return gameScore(b).toFixed(1)
  return b[key] ?? 0
}

// Stadium-bowl attendance meter — a ring of "seats" (radial ticks) around the
// arena's real capacity, lit up in the home team's color for the fraction
// that's actually filled. Attendance/capacity were already computed and
// stored per game (audience-segments.ts) but only ever showed up as a plain
// number — this makes "how full was the building" something you can read at
// a glance instead of doing the division in your head.
const ArenaBowl = ({ attendance, capacity, color, isPT }: { attendance: number, capacity: number, color: string, isPT: boolean }) => {
  const fillPct = Math.max(0, Math.min(1, attendance / capacity))
  const totalSeats = 64
  const filledSeats = Math.round(fillPct * totalSeats)
  const cx = 100, cy = 100, rInner = 58, rOuter = 80
  const seats = Array.from({ length: totalSeats }).map((_, i) => {
    const angle = (i / totalSeats) * Math.PI * 2 - Math.PI / 2
    const x1 = cx + rInner * Math.cos(angle), y1 = cy + rInner * Math.sin(angle)
    const x2 = cx + rOuter * Math.cos(angle), y2 = cy + rOuter * Math.sin(angle)
    const filled = i < filledSeats
    return (
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={filled ? color : 'rgba(255,255,255,0.14)'}
        strokeWidth={4.2} strokeLinecap="round"
        style={filled ? { filter: `drop-shadow(0 0 4px ${color}aa)` } : undefined}
      />
    )
  })
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-20 h-20">
        {seats}
        <circle cx={cx} cy={cy} r={rInner - 16} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" />
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="24" fontWeight="900" fill="#fff">{Math.round(fillPct * 100)}%</text>
        <text x={cx} y={cy + 17} textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1" fill="#b9b2d0">{isPT ? 'LOTAÇÃO' : 'CAPACITY'}</text>
      </svg>
      <div className="text-[11px] font-semibold mt-0.5" style={{ color: '#d6d0e8' }}>
        {attendance.toLocaleString()} <span style={{ color: '#8a83a3' }}>/ {capacity.toLocaleString()}</span>
      </div>
    </div>
  )
}

export default function GameBoxScore(props: GameBoxScoreProps) {
  const {
    homeTeam, awayTeam, homeScore, awayScore, homeBox, awayBox, periodScores,
    playedAt, weekLabel, attendance, refereeName, refereeHref, refereePhotoUrl, refereeRating,
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

  const BoxTable = ({ players, color, totals, mvpPlayerId }: { players: BoxRow[], color: string, totals: any, mvpPlayerId?: string | number | null }) => {
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

    const PlayerRow = ({ b, i }: { b: BoxRow, i: number }) => {
      const isMvp = mvpPlayerId != null && b.player_id === mvpPlayerId
      return (
        <tr style={{ background: isMvp ? '#fdf6e3' : i % 2 === 0 ? '#faf8f5' : '#f5f1eb', borderBottom: '1px solid #e8e2d6' }}>
          <td className="px-3 py-1">
            <NameCell b={b} />
            <span className="ml-1.5 text-xs" style={{ color: '#9c8e7a' }}>{b.pos}</span>
            {isMvp && <span className="ml-1.5 text-xs">🏆</span>}
            {(b.tech_fouls || 0) >= 2 && (
              <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#dc2626', color: '#fff' }}>
                ⛔ {isPT ? 'EXPULSO' : 'EJECTED'}
              </span>
            )}
          </td>
          {statCols.map(c => (
            <td key={c.key} className="px-2 py-1 text-right font-semibold"
              style={{
                color: c.key === 'gmsc' && isMvp ? '#b45309'
                  : c.key === 'pts' && (b as any)[c.key] >= 20 ? color
                  : c.key === 'tech_fouls' && (b as any)[c.key] > 0 ? '#dc2626'
                  : '#1a1512',
              }}>
              {cellValue(b, c.key)}
            </td>
          ))}
        </tr>
      )
    }

    const SectionHeader = ({ label }: { label: string }) => (
      <tr style={{ background: '#ddd7ca', borderBottom: '1px solid #d4cdc5' }}>
        <th className="px-3 py-1 text-left font-bold" style={{ color: '#5c554e', minWidth: 140, borderLeft: `3px solid ${color}` }}>{label}</th>
        {statCols.map(c => (
          <th key={c.key} className="px-2 py-1 text-right font-bold" style={{ color: '#5c554e' }}>{c.label}</th>
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
                  <td className="px-3 py-1">
                    <NameCell b={b} />
                    <span className="ml-1.5 text-xs" style={{ color: '#9c8e7a' }}>{b.pos}</span>
                  </td>
                  <td colSpan={statCols.length} className="px-2 py-1 text-center" style={{ color: '#9c8e7a' }}>
                    {isPT ? "NÃO JOGOU — DECISÃO DO TREINADOR" : "DNP-COACH'S DECISION"}
                  </td>
                </tr>
              ))}
            </tbody>
          )}
          <tbody>
            <tr style={{ background: '#e8e2d6', borderTop: '2px solid #d4cdc5' }}>
              <td className="px-3 py-1 font-black text-xs" style={{ color: '#1a1512' }}>{isPT ? 'EQUIPA' : 'TEAM'}</td>
              {statCols.map(c => (
                <td key={c.key} className="px-2 py-1 text-right font-black" style={{ color: '#1a1512' }}>
                  {c.key === 'mins' || c.key === 'plus_minus' || c.key === 'gmsc' ? '' : cellValue(totals, c.key)}
                </td>
              ))}
            </tr>
            <tr style={{ background: '#e8e2d6', borderBottom: '1px solid #d4cdc5' }}>
              <td className="px-3 py-1"></td>
              {statCols.map(c => (
                <td key={c.key} className="px-2 py-1 text-right text-xs font-semibold" style={{ color: '#8a8279' }}>
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
    <div className="max-w-6xl mx-auto px-4 py-4">
      <Link href={backHref} className="text-xs no-underline mb-3 block" style={{ color: '#8a8279' }}>
        ← {backLabel}
      </Link>

      {/* SCOREBOARD */}
      <div
        className="relative overflow-hidden rounded-2xl p-4 mb-4"
        style={{
          background: `linear-gradient(120deg, ${homeColorOnDark}59 0%, #1a1329 38%, #1a1329 62%, ${awayColorOnDark}59 100%), repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 2px, transparent 2px, transparent 13px), #1a1329`,
          border: '1px solid #352a4a',
          boxShadow: `0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ background: `linear-gradient(90deg, ${homeColorOnDark} 0%, #fff 50%, ${awayColorOnDark} 100%)`, boxShadow: `0 0 16px ${homeColorOnDark}88` }}
        />
        {homeTeam.arena && (
          <div className="text-center text-sm font-bold mb-0.5" style={{ color: '#f5f2fa' }}>
            {homeTeam.arena}{homeTeam.city && ` · ${homeTeam.city}`}
          </div>
        )}
        <div className="text-center text-xs mb-2" style={{ color: '#b9b2d0' }}>
          {playedAt ? fmtDate(playedAt) : ''}
          {weekLabel && ` · ${weekLabel}`}
          {!!attendance && attendance > 0 && !homeTeam.capacity && ` · ${attendance.toLocaleString()} ${isPT ? 'adeptos' : 'fans'}`}
        </div>
        {(refereeName || (!!attendance && attendance > 0 && !!homeTeam.capacity)) && (
          <div className="flex items-center justify-center gap-4 mb-3 flex-wrap">
            {!!attendance && attendance > 0 && !!homeTeam.capacity && (
              <ArenaBowl attendance={attendance} capacity={homeTeam.capacity} color={homeColorOnDark} isPT={isPT} />
            )}
            {refereeName && (
              <div className="flex items-center gap-2.5 rounded-2xl pl-2 pr-3 py-1.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div
                  className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.15)' }}
                >
                  {refereePhotoUrl
                    ? <img src={refereePhotoUrl} alt="" className="w-full h-full object-cover" />
                    : <span className="text-sm font-black" style={{ color: '#b9b2d0' }}>
                        {refereeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#b9b2d0' }}>{isPT ? 'Árbitro' : 'Referee'}</div>
                  {refereeHref ? (
                    <Link href={refereeHref} className="text-sm font-bold no-underline block" style={{ color: '#f5f2fa' }}>{refereeName}</Link>
                  ) : (
                    <span className="text-sm font-bold block" style={{ color: '#f5f2fa' }}>{refereeName}</span>
                  )}
                  {status === 'final' && refereeRating != null && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-xs font-black px-1.5 py-0.5 rounded-full"
                        style={{ color: '#1a1512', background: refRatingColor(refereeRating), boxShadow: `0 0 8px ${refRatingColor(refereeRating)}88` }}
                      >
                        {refereeRating.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: refRatingColor(refereeRating) }}>
                        {refRatingLabel(refereeRating, isPT)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          {/* Home */}
          <div className="flex-1 text-center">
            {homeTeam.href ? (
              <Link href={homeTeam.href} className="no-underline">
                {homeTeam.logo_url && (
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ background: `radial-gradient(circle, ${homeColorOnDark}3d 0%, transparent 72%)`, filter: `drop-shadow(0 0 10px ${homeColorOnDark}40)` }}
                  >
                    <img src={homeTeam.logo_url} alt="" className="w-12 h-12 object-contain" />
                  </div>
                )}
                <div className="text-sm font-black" style={{ color: '#f5f2fa' }}>{homeTeam.name}</div>
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 mt-0.5 tracking-widest"
                  style={{ background: `${homeColorOnDark}2a`, color: homeColorOnDark }}>{isPT ? 'CASA' : 'HOME'}</span>
              </Link>
            ) : (
              <>
                {homeTeam.logo_url && (
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ background: `radial-gradient(circle, ${homeColorOnDark}3d 0%, transparent 72%)`, filter: `drop-shadow(0 0 10px ${homeColorOnDark}40)` }}
                  >
                    <img src={homeTeam.logo_url} alt="" className="w-12 h-12 object-contain" />
                  </div>
                )}
                <div className="text-sm font-black" style={{ color: '#f5f2fa' }}>{homeTeam.name}</div>
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 mt-0.5 tracking-widest"
                  style={{ background: `${homeColorOnDark}2a`, color: homeColorOnDark }}>{isPT ? 'CASA' : 'HOME'}</span>
              </>
            )}
            <div
              className="mx-auto rounded-2xl py-1 px-3 inline-block"
              style={{
                background: homeWon ? `linear-gradient(180deg, ${homeColorOnDark}33, ${homeColorOnDark}0d)` : 'rgba(255,255,255,0.04)',
                border: homeWon ? `1px solid ${homeColorOnDark}66` : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="text-4xl font-black leading-none"
                style={{ color: homeWon ? '#ffffff' : '#8a83a3', textShadow: homeWon ? `0 0 32px ${homeColorOnDark}bb` : 'none' }}
              >
                {homeScore}
              </div>
            </div>
            {homeWon && <div className="text-xs font-black mt-1 tracking-widest" style={{ color: '#4ade80' }}>● {isPT ? 'VITÓRIA' : 'WIN'}</div>}
          </div>

          {/* VS */}
          <div className="text-center flex-shrink-0">
            <div
              className="w-11 h-11 flex items-center justify-center text-xs font-black rotate-45"
              style={{
                background: `linear-gradient(135deg, ${homeColorOnDark}, ${awayColorOnDark})`,
                boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
                borderRadius: '14px',
              }}
            >
              <span className="-rotate-45" style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>VS</span>
            </div>
            {status === 'final' && (
              <div className="flex flex-col items-center gap-1 mt-2">
                <div className="text-[10px] px-2 py-0.5 rounded-full font-black tracking-widest" style={{ background: 'rgba(255,255,255,0.08)', color: '#d6d0e8', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {isPT ? 'FINAL' : 'FINAL'}
                </div>
                {periodScores && periodScores.length > 4 && (
                  <div className="text-[10px] px-2 py-0.5 rounded-full font-black tracking-widest animate-pulse" style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b55' }}>
                    {periodScores.length === 5 ? 'OT' : `${periodScores.length - 4}OT`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 text-center">
            {awayTeam.href ? (
              <Link href={awayTeam.href} className="no-underline">
                {awayTeam.logo_url && (
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ background: `radial-gradient(circle, ${awayColorOnDark}3d 0%, transparent 72%)`, filter: `drop-shadow(0 0 10px ${awayColorOnDark}40)` }}
                  >
                    <img src={awayTeam.logo_url} alt="" className="w-12 h-12 object-contain" />
                  </div>
                )}
                <div className="text-sm font-black" style={{ color: '#f5f2fa' }}>{awayTeam.name}</div>
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 mt-0.5 tracking-widest"
                  style={{ background: `${awayColorOnDark}2a`, color: awayColorOnDark }}>{isPT ? 'FORA' : 'AWAY'}</span>
              </Link>
            ) : (
              <>
                {awayTeam.logo_url && (
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ background: `radial-gradient(circle, ${awayColorOnDark}3d 0%, transparent 72%)`, filter: `drop-shadow(0 0 10px ${awayColorOnDark}40)` }}
                  >
                    <img src={awayTeam.logo_url} alt="" className="w-12 h-12 object-contain" />
                  </div>
                )}
                <div className="text-sm font-black" style={{ color: '#f5f2fa' }}>{awayTeam.name}</div>
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 mt-0.5 tracking-widest"
                  style={{ background: `${awayColorOnDark}2a`, color: awayColorOnDark }}>{isPT ? 'FORA' : 'AWAY'}</span>
              </>
            )}
            <div
              className="mx-auto rounded-2xl py-1 px-3 inline-block"
              style={{
                background: !homeWon ? `linear-gradient(180deg, ${awayColorOnDark}33, ${awayColorOnDark}0d)` : 'rgba(255,255,255,0.04)',
                border: !homeWon ? `1px solid ${awayColorOnDark}66` : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="text-4xl font-black leading-none"
                style={{ color: !homeWon ? '#ffffff' : '#8a83a3', textShadow: !homeWon ? `0 0 32px ${awayColorOnDark}bb` : 'none' }}
              >
                {awayScore}
              </div>
            </div>
            {!homeWon && <div className="text-xs font-black mt-1 tracking-widest" style={{ color: '#4ade80' }}>● {isPT ? 'VITÓRIA' : 'WIN'}</div>}
          </div>
        </div>

      </div>

      {/* LINE SCORE + GAME MVP — same row, docked side by side, instead of
          the MVP eating a full extra width of vertical space on its own. */}
      {((periodScores && periodScores.length > 0) || (mvpEntry && mvpTeam)) && (
        <div className="flex flex-col sm:flex-row rounded-2xl overflow-hidden mb-4" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {/* LINE SCORE — Q1-Q4 plus OT1/OT2/... if the game went to overtime */}
          {periodScores && periodScores.length > 0 && (
            <div className="flex-shrink-0 overflow-x-auto flex items-center" style={{ background: '#1a1329' }}>
              <table className="text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th className="px-3 py-1 text-left" style={{ color: '#8a83a3', background: 'rgba(255,255,255,0.05)' }}></th>
                    {periodScores.map(p => (
                      <th key={p.quarter} className="px-3 py-1 text-right font-semibold" style={{ color: p.quarter > 4 ? '#f59e0b' : '#b9b2d0', background: 'rgba(255,255,255,0.05)' }}>
                        {p.quarter <= 4 ? `Q${p.quarter}` : `OT${p.quarter - 4}`}
                      </th>
                    ))}
                    <th className="px-3 py-1 text-right font-bold" style={{ color: '#b9b2d0', background: 'rgba(255,255,255,0.05)' }}>{isPT ? 'FINAL' : 'FINAL'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-1 text-left font-semibold" style={{ color: homeColorOnDark, background: 'rgba(255,255,255,0.03)' }}>{homeTeam.name}</td>
                    {periodScores.map(p => (
                      <td key={p.quarter} className="px-3 py-1 text-right" style={{ color: '#e8e4f2', background: 'rgba(255,255,255,0.03)' }}>{p.home}</td>
                    ))}
                    <td className="px-3 py-1 text-right font-black" style={{ color: homeColorOnDark, background: 'rgba(255,255,255,0.03)' }}>{homeScore}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1 text-left font-semibold" style={{ color: awayColorOnDark }}>{awayTeam.name}</td>
                    {periodScores.map(p => (
                      <td key={p.quarter} className="px-3 py-1 text-right" style={{ color: '#e8e4f2' }}>{p.away}</td>
                    ))}
                    <td className="px-3 py-1 text-right font-black" style={{ color: awayColorOnDark }}>{awayScore}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* GAME MVP — highest Game Score (GmSc), the same formula NBA.com/
              ESPN use to summarize a single-game performance in one number. */}
          {mvpEntry && mvpTeam && (
            <div
              className="relative flex-1 overflow-hidden p-3 flex items-center gap-3 min-w-0"
              style={{ background: `linear-gradient(120deg, #fdf6e3, #faf8f5 60%)`, borderTop: `1px solid ${mvpColor}`, borderRight: `1px solid ${mvpColor}`, borderBottom: `1px solid ${mvpColor}` }}
            >
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${mvpColor}, #f5c542)` }} />
              {mvpEntry.b.photo_url ? (
                <img src={mvpEntry.b.photo_url} alt="" className="w-24 h-24 rounded-full object-cover flex-shrink-0"
                  style={{ border: `3px solid ${mvpColor}`, boxShadow: `0 0 0 4px ${mvpColor}1a` }} />
              ) : (
                <div className="text-5xl flex-shrink-0">🏆</div>
              )}
              <div className="min-w-0">
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
                <div className="text-sm font-semibold mt-0.5" style={{ color: '#1a1512' }}>
                  {mvpEntry.b.pts} {isPT ? 'PTS' : 'PTS'} · {mvpEntry.b.reb} {isPT ? 'RES' : 'REB'} · {mvpEntry.b.ast} {isPT ? 'AST' : 'AST'}
                  {mvpEntry.b.stl >= 3 && ` · ${mvpEntry.b.stl} ${isPT ? 'ROU' : 'STL'}`}
                  {mvpEntry.b.blk >= 3 && ` · ${mvpEntry.b.blk} ${isPT ? 'DES' : 'BLK'}`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOX SCORES */}
      {(homeBox.length > 0 || awayBox.length > 0) ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #d4cdc5', borderTop: `3px solid ${homeColor}`, boxShadow: '0 4px 16px rgba(26,21,18,0.08)' }}>
            <div className="px-4 py-2 flex items-center gap-3" style={{ background: `linear-gradient(90deg, ${homeColor}1f, #e8e2d6 65%)` }}>
              {homeTeam.logo_url && <img src={homeTeam.logo_url} alt="" className="w-6 h-6 object-contain" />}
              <span className="font-black text-sm tracking-wide" style={{ color: homeColor }}>{homeTeam.name}</span>
              <span className="ml-auto text-lg font-black" style={{ color: '#1a1512' }}>{homeScore}</span>
            </div>
            <BoxTable players={homeBox} color={homeColor} totals={homeTotals} mvpPlayerId={mvpEntry?.b.player_id} />
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #d4cdc5', borderTop: `3px solid ${awayColor}`, boxShadow: '0 4px 16px rgba(26,21,18,0.08)' }}>
            <div className="px-4 py-2 flex items-center gap-3" style={{ background: `linear-gradient(90deg, ${awayColor}1f, #e8e2d6 65%)` }}>
              {awayTeam.logo_url && <img src={awayTeam.logo_url} alt="" className="w-6 h-6 object-contain" />}
              <span className="font-black text-sm tracking-wide" style={{ color: awayColor }}>{awayTeam.name}</span>
              <span className="ml-auto text-lg font-black" style={{ color: '#1a1512' }}>{awayScore}</span>
            </div>
            <BoxTable players={awayBox} color={awayColor} totals={awayTotals} mvpPlayerId={mvpEntry?.b.player_id} />
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

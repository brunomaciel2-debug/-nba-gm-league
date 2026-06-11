'use client'
import { useState } from 'react'
import Link from 'next/link'

type Mode = 'stats' | 'attributes'

// ── TOOLTIPS ─────────────────────────────────────────────────────────────────
const TOOLTIPS: Record<string, string> = {
  // Stats
  PPG:  'Points Per Game — average points scored per game',
  RPG:  'Rebounds Per Game — average total rebounds (offensive + defensive) per game',
  APG:  'Assists Per Game — average assists per game',
  SPG:  'Steals Per Game — average steals per game',
  BPG:  'Blocks Per Game — average blocked shots per game',
  'FG%': 'Field Goal Percentage — shots made ÷ shots attempted (all 2PT and 3PT)',
  '3P%': 'Three-Point Percentage — 3PT shots made ÷ 3PT shots attempted',
  'FT%': 'Free Throw Percentage — free throws made ÷ free throws attempted',
  TO:   'Turnovers Per Game — average turnovers lost per game',
  Salary:'Annual salary for the current season (2025-26)',
  GP:   'Games Played',
  // Attributes
  '3PT': 'Three-Point Shooting — quality of 3PT mechanics and accuracy (0-100)',
  LAY:  'Layup — finishing ability near the rim in motion (0-100)',
  DNK:  'Dunk — power and precision on dunk attempts (0-100)',
  MID:  'Mid-Range — quality of pull-up jumpers and mid-range shots (0-100)',
  FT:   'Free Throws — free throw mechanics and percentage (0-100)',
  SIQ:  'Shot IQ — decision-making and shot selection; knows when to shoot vs pass (0-100)',
  DF:   'Draw Foul — ability to draw fouls on shot attempts (0-100)',
  BLK:  'Block — shot-blocking ability and timing (0-100)',
  STL:  'Steal — ball-stealing instincts and anticipation (0-100)',
  IDEF: 'Interior Defense — ability to protect the paint and defend in the post (0-100)',
  PDEF: 'Perimeter Defense — on-ball perimeter defense and lateral quickness (0-100)',
  DREB: 'Defensive Rebound — positioning and aggression on defensive glass (0-100)',
  OREB: 'Offensive Rebound — positioning and aggression on offensive glass (0-100)',
  STA:  'Stamina — in-game fatigue resistance; affects performance in late quarters (0-100)',
  DUR:  'Durability — resistance to injuries over the course of a season (0-100)',
  BH:   'Ball Handle — dribbling control and ability to create off the bounce (0-100)',
  PV:   'Pass Vision — court vision and ability to find open teammates (0-100)',
  PIQ:  'Pass IQ — decision-making with the ball; choosing the right pass (0-100)',
  AR:   'Assist Role — natural tendency to create for teammates over shooting (0-100)',
  CLU:  'Clutch / Pressure — performance accuracy in close game situations (last 2 min, ≤5 pts) (0-100)',
  CON:  'Consistency — game-to-game performance variance; high = reliable (0-100)',
  CE:   'Crowd Effect — home crowd energy boost; benefits home team players (0-100)',
  STR:  'Streaky — hot/cold shooting tendency; affected by momentum (0-100)',
  TT:   'Trash Talk — energised by hostile road crowds; performs better away (0-100)',
}

function Tooltip({ label, tip }: { label: string, tip?: string }) {
  const [show, setShow] = useState(false)
  if (!tip) return <span>{label}</span>
  return (
    <span className="relative inline-flex items-center gap-0.5 group"
          onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {label}
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-xs cursor-help ml-0.5"
            style={{ background: '#1e3a5f', color: '#60a0ff', fontSize: 9, lineHeight: 1 }}>i</span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap pointer-events-none"
              style={{ background: '#0a1628', border: '1px solid #1e3a5f', color: '#c0ccd8',
                       maxWidth: 240, whiteSpace: 'normal', lineHeight: 1.4 }}>
          {tip}
        </span>
      )}
    </span>
  )
}

const STAT_COLS = [
  { key: 'name',   label: 'Player', color: '',        numeric: false },
  { key: 'pos',    label: 'Pos',    color: '',        numeric: false },
  { key: 'ppg',    label: 'PPG',    color: '#ffa040', numeric: true  },
  { key: 'rpg',    label: 'RPG',    color: '#40e080', numeric: true  },
  { key: 'apg',    label: 'APG',    color: '#60a0ff', numeric: true  },
  { key: 'spg',    label: 'SPG',    color: '#c040ff', numeric: true  },
  { key: 'bpg',    label: 'BPG',    color: '#ff6040', numeric: true  },
  { key: 'fgpct',  label: 'FG%',    color: '#c0ccd8', numeric: true  },
  { key: 'tppct',  label: '3P%',    color: '#ffd040', numeric: true  },
  { key: 'ftpct',  label: 'FT%',    color: '#40d0d0', numeric: true  },
  { key: 'topg',   label: 'TO',     color: '#e04040', numeric: true  },
  { key: 'salary', label: 'Salary', color: '#7090b0', numeric: true  },
]

const ATTR_COLS = [
  { key: 'name',        label: 'Player', color: '',        numeric: false },
  { key: 'pos',         label: 'Pos',    color: '',        numeric: false },
  { key: 'three',       label: '3PT',    color: '#ffd040', numeric: true },
  { key: 'layup',       label: 'LAY',    color: '#ffa040', numeric: true },
  { key: 'dunk',        label: 'DNK',    color: '#ff6040', numeric: true },
  { key: 'mid',         label: 'MID',    color: '#ffa040', numeric: true },
  { key: 'ft',          label: 'FT',     color: '#40d0d0', numeric: true },
  { key: 'siq',         label: 'SIQ',    color: '#ffa040', numeric: true },
  { key: 'blk',         label: 'BLK',    color: '#ff6040', numeric: true },
  { key: 'stl',         label: 'STL',    color: '#c040ff', numeric: true },
  { key: 'idef',        label: 'IDEF',   color: '#40e080', numeric: true },
  { key: 'pdef',        label: 'PDEF',   color: '#40e080', numeric: true },
  { key: 'def_reb',     label: 'DREB',   color: '#60a0ff', numeric: true },
  { key: 'off_reb',     label: 'OREB',   color: '#60a0ff', numeric: true },
  { key: 'stamina',     label: 'STA',    color: '#c040ff', numeric: true },
  { key: 'durability',  label: 'DUR',    color: '#c040ff', numeric: true },
  { key: 'ball_hdl',    label: 'BH',     color: '#40d0d0', numeric: true },
  { key: 'pass_vis',    label: 'PV',     color: '#40d0d0', numeric: true },
  { key: 'pass_iq',     label: 'PIQ',    color: '#40d0d0', numeric: true },
  { key: 'assist_role', label: 'AR',     color: '#40d0d0', numeric: true },
  { key: 'pressure',    label: 'CLU',    color: '#ffd040', numeric: true },
  { key: 'consistency', label: 'CON',    color: '#ffd040', numeric: true },
  { key: 'crowd_effect',label: 'CE',     color: '#ffd040', numeric: true },
  { key: 'streaky',     label: 'STR',    color: '#ffd040', numeric: true },
]

function attrColor(v: number) {
  if (v >= 90) return '#ffd040'
  if (v >= 80) return '#40e080'
  if (v >= 70) return '#60a0ff'
  if (v >= 60) return '#c0ccd8'
  if (v >= 50) return '#7090b0'
  return '#506070'
}

export default function RosterTable({ players, teamColor }: { players: any[], teamColor: string }) {
  const [mode, setMode] = useState<Mode>('stats')
  const [sortKey, setSortKey] = useState('ppg')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const rows = players.map((p: any) => {
    const s = p.player_stats?.[0] || {}
    const gp = s.games || 0
    const avg = (v: number) => gp > 0 ? parseFloat((v / gp).toFixed(1)) : 0
    return {
      id: p.id, name: p.name, pos: p.pos, photo_url: p.photo_url, salary: p.salary,
      ppg: avg(s.pts), rpg: avg(s.reb), apg: avg(s.ast),
      spg: avg(s.stl), bpg: avg(s.blk),
      fgpct: s.fga > 0 ? parseFloat((s.fgm / s.fga * 100).toFixed(1)) : 0,
      tppct: s.tpa > 0 ? parseFloat((s.tpm / s.tpa * 100).toFixed(1)) : 0,
      ftpct: s.fta > 0 ? parseFloat((s.ftm / s.fta * 100).toFixed(1)) : 0,
      topg: avg(s.turnovers),
      three: p.three, layup: p.layup, dunk: p.dunk, mid: p.mid, ft: p.ft,
      siq: p.siq, draw_foul: p.draw_foul, blk: p.blk, stl: p.stl,
      idef: p.idef, pdef: p.pdef, def_reb: p.def_reb, off_reb: p.off_reb,
      stamina: p.stamina, durability: p.durability, ball_hdl: p.ball_hdl,
      pass_vis: p.pass_vis, pass_iq: p.pass_iq, assist_role: p.assist_role,
      pressure: p.pressure, consistency: p.consistency,
      crowd_effect: p.crowd_effect, streaky: p.streaky,
    }
  })

  const handleSort = (key: string, numeric: boolean) => {
    if (!numeric) return
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...rows].sort((a: any, b: any) => {
    const av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'desc' ? bv - av : av - bv
    return 0
  })

  const cols = mode === 'stats' ? STAT_COLS : ATTR_COLS
  const capFmt = (n: number) => n >= 1000000 ? '$' + (n / 1000000).toFixed(1) + 'M' : '$' + n.toLocaleString()

  const fmtVal = (key: string, val: any) => {
    if (key === 'salary') return capFmt(val)
    if (['fgpct','tppct','ftpct'].includes(key)) return val > 0 ? val + '%' : '—'
    if (typeof val === 'number') return val > 0 ? val : '—'
    return val
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#060c18', border: '1px solid #1e3a5f' }}>
          {(['stats','attributes'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setSortKey(m==='stats'?'ppg':'three'); setSortDir('desc') }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{ background: mode===m?'#1e3a5f':'transparent', color: mode===m?'#60a0ff':'#7090b0' }}>
              {m === 'stats' ? '📊 Stats' : '⚡ Attributes'}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: '#405060' }}>
          Click column header to sort · hover <span style={{ background:'#1e3a5f',color:'#60a0ff',borderRadius:4,padding:'0 4px',fontSize:9 }}>i</span> for definitions
        </span>
      </div>

      <div className="rounded-xl overflow-hidden overflow-x-auto mb-2" style={{ border: '1px solid #1e3a5f' }}>
        <table className="w-full text-xs" style={{ minWidth: mode==='attributes'?900:600 }}>
          <thead>
            <tr style={{ background: '#060c18', borderBottom: '1px solid #1e3a5f' }}>
              {cols.map(col => (
                <th key={col.key}
                    onClick={() => handleSort(col.key, col.numeric)}
                    className={`px-3 py-2.5 font-semibold select-none whitespace-nowrap
                      ${col.numeric ? 'text-right cursor-pointer' : 'text-left'}
                      ${col.key === 'name' ? 'min-w-[140px]' : ''}`}
                    style={{ color: sortKey===col.key?(col.color||'#60a0ff'):'#7090b0', transition:'color .15s' }}>
                  <Tooltip label={col.label} tip={TOOLTIPS[col.label]} />
                  {sortKey===col.key && <span className="ml-1">{sortDir==='desc'?'↓':'↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p: any, i: number) => (
              <tr key={p.id}
                  style={{ background: i%2===0?'#0f1e33':'#0c1a2c', borderBottom:'1px solid #0a1628' }}
                  className="hover:brightness-110 transition-all">
                {cols.map(col => {
                  if (col.key === 'name') return (
                    <td key="name" className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                             style={{ background: teamColor+'22' }}>
                          {p.photo_url
                            ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-xs font-black"
                                   style={{ color: teamColor }}>
                                {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                              </div>
                          }
                        </div>
                        <Link href={`/player/${p.id}`}
                              className="font-semibold text-white no-underline hover:text-blue-400 transition-colors whitespace-nowrap">
                          {p.name}
                        </Link>
                      </div>
                    </td>
                  )
                  if (col.key === 'pos') return (
                    <td key="pos" className="px-3 py-2" style={{ color:'#7090b0' }}>{p.pos}</td>
                  )
                  const val = (p as any)[col.key]
                  const isActive = sortKey === col.key
                  return (
                    <td key={col.key} className="px-3 py-2 text-right font-semibold"
                        style={{
                          color: mode==='attributes' && col.numeric && typeof val==='number'
                            ? attrColor(val)
                            : isActive ? '#fff' : col.color||'#c0ccd8',
                          background: isActive ? teamColor+'11' : undefined,
                        }}>
                      {fmtVal(col.key, val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color:'#304050' }}>
        {sorted.length} players · {mode==='stats'?'Per game averages':'Attribute ratings (0–100) · Gold ≥90 · Green ≥80 · Blue ≥70'}
      </p>
    </div>
  )
}

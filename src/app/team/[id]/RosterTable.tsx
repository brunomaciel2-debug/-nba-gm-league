'use client'
import { useState } from 'react'
import Link from 'next/link'

type Mode = 'stats' | 'attributes'

const STAT_COLS = [
  { key: 'name',    label: 'Player',   color: '',        numeric: false },
  { key: 'pos',     label: 'Pos',      color: '',        numeric: false },
  { key: 'ppg',     label: 'PPG',      color: '#ffa040', numeric: true  },
  { key: 'rpg',     label: 'RPG',      color: '#40e080', numeric: true  },
  { key: 'apg',     label: 'APG',      color: '#60a0ff', numeric: true  },
  { key: 'spg',     label: 'SPG',      color: '#c040ff', numeric: true  },
  { key: 'bpg',     label: 'BPG',      color: '#ff6040', numeric: true  },
  { key: 'fgpct',   label: 'FG%',      color: '#c0ccd8', numeric: true  },
  { key: 'tppct',   label: '3P%',      color: '#ffd040', numeric: true  },
  { key: 'ftpct',   label: 'FT%',      color: '#40d0d0', numeric: true  },
  { key: 'topg',    label: 'TO',       color: '#e04040', numeric: true  },
  { key: 'salary',  label: 'Salary',   color: '#7090b0', numeric: true  },
]

const ATTR_COLS = [
  { key: 'name',        label: 'Player',        color: '',        numeric: false },
  { key: 'pos',         label: 'Pos',           color: '',        numeric: false },
  { key: 'usage',       label: 'USG',           color: '#ffa040', numeric: true },
  { key: 'three',       label: '3PT',           color: '#ffd040', numeric: true },
  { key: 'layup',       label: 'LAY',           color: '#ffa040', numeric: true },
  { key: 'dunk',        label: 'DNK',           color: '#ff6040', numeric: true },
  { key: 'mid',         label: 'MID',           color: '#ffa040', numeric: true },
  { key: 'ft',          label: 'FT',            color: '#40d0d0', numeric: true },
  { key: 'blk',         label: 'BLK',           color: '#ff6040', numeric: true },
  { key: 'stl',         label: 'STL',           color: '#c040ff', numeric: true },
  { key: 'idef',        label: 'IDEF',          color: '#40e080', numeric: true },
  { key: 'pdef',        label: 'PDEF',          color: '#40e080', numeric: true },
  { key: 'def_reb',     label: 'DREB',          color: '#60a0ff', numeric: true },
  { key: 'off_reb',     label: 'OREB',          color: '#60a0ff', numeric: true },
  { key: 'stamina',     label: 'STA',           color: '#c040ff', numeric: true },
  { key: 'ball_hdl',    label: 'BH',            color: '#40d0d0', numeric: true },
  { key: 'pass_vis',    label: 'PV',            color: '#40d0d0', numeric: true },
  { key: 'pressure',    label: 'CLU',           color: '#ffd040', numeric: true },
  { key: 'consistency', label: 'CON',           color: '#ffd040', numeric: true },
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

  // Build flat rows
  const rows = players.map((p: any) => {
    const s = p.player_stats?.[0] || {}
    const gp = s.games || 0
    const avg = (v: number) => gp > 0 ? parseFloat((v / gp).toFixed(1)) : 0
    return {
      id: p.id,
      name: p.name,
      pos: p.pos,
      photo_url: p.photo_url,
      salary: p.salary,
      // stats
      ppg:   avg(s.pts),
      rpg:   avg(s.reb),
      apg:   avg(s.ast),
      spg:   avg(s.stl),
      bpg:   avg(s.blk),
      fgpct: s.fga > 0 ? parseFloat((s.fgm / s.fga * 100).toFixed(1)) : 0,
      tppct: s.tpa > 0 ? parseFloat((s.tpm / s.tpa * 100).toFixed(1)) : 0,
      ftpct: s.fta > 0 ? parseFloat((s.ftm / s.fta * 100).toFixed(1)) : 0,
      topg:  avg(s.turnovers),
      // attributes
      usage: p.usage, three: p.three, layup: p.layup, dunk: p.dunk,
      mid: p.mid, ft: p.ft, blk: p.blk, stl: p.stl,
      idef: p.idef, pdef: p.pdef, def_reb: p.def_reb, off_reb: p.off_reb,
      stamina: p.stamina, ball_hdl: p.ball_hdl, pass_vis: p.pass_vis,
      pressure: p.pressure, consistency: p.consistency,
    }
  })

  const handleSort = (key: string, numeric: boolean) => {
    if (!numeric) return
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...rows].sort((a: any, b: any) => {
    const av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'desc' ? bv - av : av - bv
    }
    return 0
  })

  const cols = mode === 'stats' ? STAT_COLS : ATTR_COLS
  const capFmt = (n: number) => n >= 1000000 ? '$' + (n / 1000000).toFixed(1) + 'M' : '$' + n.toLocaleString()

  const fmtVal = (key: string, val: any) => {
    if (key === 'salary') return capFmt(val)
    if (key === 'fgpct' || key === 'tppct' || key === 'ftpct') return val > 0 ? val + '%' : '—'
    if (typeof val === 'number') return val > 0 ? val : '—'
    return val
  }

  return (
    <div>
      {/* Mode toggle + sort hint */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#060c18', border: '1px solid #1e3a5f' }}>
          {(['stats', 'attributes'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setSortKey(m === 'stats' ? 'ppg' : 'usage'); setSortDir('desc') }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{ background: mode === m ? '#1e3a5f' : 'transparent', color: mode === m ? '#60a0ff' : '#7090b0' }}>
              {m === 'stats' ? '📊 Stats' : '⚡ Attributes'}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: '#405060' }}>Click any column header to sort</span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden overflow-x-auto mb-2" style={{ border: '1px solid #1e3a5f' }}>
        <table className="w-full text-xs" style={{ minWidth: mode === 'attributes' ? 800 : 600 }}>
          <thead>
            <tr style={{ background: '#060c18', borderBottom: '1px solid #1e3a5f' }}>
              {cols.map(col => (
                <th key={col.key}
                    onClick={() => handleSort(col.key, col.numeric)}
                    className={`px-3 py-2.5 font-semibold select-none ${col.numeric ? 'text-right cursor-pointer hover:brightness-125' : 'text-left'} ${col.key === 'name' ? 'min-w-[140px]' : ''}`}
                    style={{ color: sortKey === col.key ? (col.color || '#60a0ff') : '#7090b0', transition: 'color .15s' }}>
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1 text-xs">{sortDir === 'desc' ? '↓' : '↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p: any, i: number) => (
              <tr key={p.id}
                  style={{ background: i % 2 === 0 ? '#0f1e33' : '#0c1a2c', borderBottom: '1px solid #0a1628' }}
                  className="hover:brightness-110 transition-all">
                {cols.map(col => {
                  if (col.key === 'name') return (
                    <td key="name" className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                             style={{ background: teamColor + '22' }}>
                          {p.photo_url
                            ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-xs font-black"
                                   style={{ color: teamColor }}>
                                {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
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
                    <td key="pos" className="px-3 py-2" style={{ color: '#7090b0' }}>{p.pos}</td>
                  )
                  const val = (p as any)[col.key]
                  const isActive = sortKey === col.key
                  const displayVal = fmtVal(col.key, val)
                  return (
                    <td key={col.key} className="px-3 py-2 text-right font-semibold"
                        style={{
                          color: mode === 'attributes' && col.numeric && typeof val === 'number'
                            ? attrColor(val)
                            : isActive ? '#fff' : col.color || '#c0ccd8',
                          background: isActive ? teamColor + '11' : undefined,
                        }}>
                      {displayVal}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: '#304050' }}>
        {sorted.length} players · {mode === 'stats' ? 'Per game averages' : 'Attribute ratings (0-100)'}
      </p>
    </div>
  )
}

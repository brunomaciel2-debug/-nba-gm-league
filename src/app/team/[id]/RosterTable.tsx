'use client'
import { useState } from 'react'
import Link from 'next/link'

type Mode = 'stats' | 'attributes'

const TOOLTIPS: Record<string, string> = {
  PPG:  'Points Per Game',
  RPG:  'Total Rebounds Per Game (OFF + DEF)',
  OREB: 'Offensive Rebounds Per Game',
  DREB: 'Defensive Rebounds Per Game',
  APG:  'Assists Per Game',
  SPG:  'Steals Per Game',
  BPG:  'Blocks Per Game',
  'FG%':'Field Goal % (all shots)',
  '3P%':'Three-Point %',
  'FT%':'Free Throw %',
  TO:   'Turnovers Per Game',
  PF:   'Personal Fouls Per Game',
  TF:   'Technical Fouls (season total)',
  Salary:'Current season salary',
  '3PT':'Three-Point Shooting (0-100)',
  LAY:  'Layup — finishing near rim (0-100)',
  DNK:  'Dunk — power finisher (0-100)',
  MID:  'Mid-Range shooting (0-100)',
  FT:   'Free Throw mechanics (0-100)',
  SIQ:  'Shot IQ — knows when to shoot vs pass (0-100)',
  DF:   'Draw Foul ability (0-100)',
  BLK:  'Shot Blocking (0-100)',
  STL:  'Steal instincts (0-100)',
  IDEF: 'Interior / Paint Defense (0-100)',
  PDEF: 'Perimeter / On-ball Defense (0-100)',
  'DREB_A':'Defensive Rebound positioning (0-100)',
  'OREB_A':'Offensive Rebound aggression (0-100)',
  STA:  'Stamina — late-game performance (0-100)',
  DUR:  'Durability — injury resistance (0-100)',
  BH:   'Ball Handle — dribbling control (0-100)',
  PV:   'Pass Vision — court vision (0-100)',
  PIQ:  'Pass IQ — decision-making with ball (0-100)',
  AR:   'Assist Role — tendency to create for others (0-100)',
  CLU:  'Clutch — performs under pressure in close games (0-100)',
  CON:  'Consistency — low variance game-to-game (0-100)',
  CE:   'Crowd Effect — benefits from home crowd (0-100)',
  STR:  'Streaky — hot/cold shooting swings (0-100)',
}

// CSS tooltip — works inside overflow containers
function TH({ col, sortKey, sortDir, onSort }: {
  col: { key: string, label: string, color: string, numeric: boolean },
  sortKey: string, sortDir: string,
  onSort: (k: string, n: boolean) => void
}) {
  const tip = TOOLTIPS[col.label]
  const isActive = sortKey === col.key
  return (
    <th onClick={() => onSort(col.key, col.numeric)}
        className={`px-3 py-2.5 font-semibold select-none whitespace-nowrap
          ${col.numeric ? 'text-right cursor-pointer' : 'text-left'}
          ${col.key === 'name' ? 'sticky left-0 z-10' : ''}`}
        style={{ color: isActive ? (col.color||'#60a0ff') : '#8a7a6a',
                 background: col.key==='name' ? '#120f0a' : undefined }}>
      <span className="inline-flex items-center gap-0.5 group relative">
        {col.label}
        {tip && (
          <>
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full ml-0.5 flex-shrink-0"
                  style={{ background:'#3a3228', color:'#60a0ff', fontSize:8, lineHeight:1 }}>i</span>
            <span className="absolute top-full left-0 mt-1 px-2.5 py-1.5 rounded-lg text-xs
                             opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
                  style={{ background:'#16120d', border:'1px solid #2a5a8f', color:'#e8e0d0',
                           width:180, whiteSpace:'normal', lineHeight:1.5, fontWeight:400 }}>
              {tip}
            </span>
          </>
        )}
        {isActive && <span className="ml-0.5 text-xs">{sortDir==='desc'?'↓':'↑'}</span>}
      </span>
    </th>
  )
}

const STAT_COLS = [
  { key:'name',   label:'Player', color:'',        numeric:false },
  { key:'pos',    label:'Pos',    color:'',        numeric:false },
  { key:'ppg',    label:'PPG',    color:'#ffa040', numeric:true  },
  { key:'rpg',    label:'RPG',    color:'#60a0ff', numeric:true  },
  { key:'orpg',   label:'OREB',   color:'#3a9aff', numeric:true  },
  { key:'drpg',   label:'DREB',   color:'#2a7acf', numeric:true  },
  { key:'apg',    label:'APG',    color:'#40d0d0', numeric:true  },
  { key:'spg',    label:'SPG',    color:'#c040ff', numeric:true  },
  { key:'bpg',    label:'BPG',    color:'#ff6040', numeric:true  },
  { key:'fgpct',  label:'FG%',    color:'#e8e0d0', numeric:true  },
  { key:'tppct',  label:'3P%',    color:'#ffd040', numeric:true  },
  { key:'ftpct',  label:'FT%',    color:'#40d0d0', numeric:true  },
  { key:'topg',   label:'TO',     color:'#e04040', numeric:true  },
  { key:'pfpg',   label:'PF',     color:'#e06060', numeric:true  },
  { key:'tf',     label:'TF',     color:'#ff4040', numeric:true  },
  { key:'salary', label:'Salary', color:'#8a7a6a', numeric:true  },
]

const ATTR_COLS = [
  { key:'name',        label:'Player', color:'',        numeric:false },
  { key:'pos',         label:'Pos',    color:'',        numeric:false },
  { key:'three',       label:'3PT',    color:'#ffd040', numeric:true },
  { key:'layup',       label:'LAY',    color:'#ffa040', numeric:true },
  { key:'dunk',        label:'DNK',    color:'#ff6040', numeric:true },
  { key:'mid',         label:'MID',    color:'#ffa040', numeric:true },
  { key:'ft',          label:'FT',     color:'#40d0d0', numeric:true },
  { key:'siq',         label:'SIQ',    color:'#ffa040', numeric:true },
  { key:'draw_foul',   label:'DF',     color:'#ffa040', numeric:true },
  { key:'blk',         label:'BLK',    color:'#ff6040', numeric:true },
  { key:'stl',         label:'STL',    color:'#c040ff', numeric:true },
  { key:'idef',        label:'IDEF',   color:'#40e080', numeric:true },
  { key:'pdef',        label:'PDEF',   color:'#40e080', numeric:true },
  { key:'def_reb',     label:'DREB',   color:'#60a0ff', numeric:true },
  { key:'off_reb',     label:'OREB',   color:'#60a0ff', numeric:true },
  { key:'stamina',     label:'STA',    color:'#c040ff', numeric:true },
  { key:'durability',  label:'DUR',    color:'#c040ff', numeric:true },
  { key:'ball_hdl',    label:'BH',     color:'#40d0d0', numeric:true },
  { key:'pass_vis',    label:'PV',     color:'#40d0d0', numeric:true },
  { key:'pass_iq',     label:'PIQ',    color:'#40d0d0', numeric:true },
  { key:'assist_role', label:'AR',     color:'#40d0d0', numeric:true },
  { key:'pressure',    label:'CLU',    color:'#ffd040', numeric:true },
  { key:'consistency', label:'CON',    color:'#ffd040', numeric:true },
  { key:'crowd_effect',label:'CE',     color:'#ffd040', numeric:true },
  { key:'streaky',     label:'STR',    color:'#ffd040', numeric:true },
]

function attrColor(v: number) {
  if (v >= 90) return '#ffd040'
  if (v >= 80) return '#40e080'
  if (v >= 70) return '#60a0ff'
  if (v >= 60) return '#e8e0d0'
  if (v >= 50) return '#8a7a6a'
  return '#6a5a4a'
}

export default function RosterTable({ players, teamColor }: { players: any[], teamColor: string }) {
  const [mode, setMode] = useState<Mode>('stats')
  const [sortKey, setSortKey] = useState('ppg')
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc')

  const rows = players.map((p: any) => {
    const s = p.player_stats?.[0] || {}
    const gp = s.games || 0
    const avg = (v: number) => gp > 0 ? parseFloat((v / gp).toFixed(1)) : 0
    const orpg = gp > 0 ? parseFloat(((s.off_reb||0)/gp).toFixed(1)) : 0
    const drpg = gp > 0 ? parseFloat(((s.def_reb||0)/gp).toFixed(1)) : 0
    return {
      id:p.id, name:p.name, pos:p.pos, photo_url:p.photo_url, salary:p.salary,
      ppg:avg(s.pts), rpg:parseFloat((orpg+drpg).toFixed(1))||avg(s.reb),
      orpg, drpg,
      apg:avg(s.ast), spg:avg(s.stl), bpg:avg(s.blk),
      fgpct:s.fga>0?parseFloat((s.fgm/s.fga*100).toFixed(1)):0,
      tppct:s.tpa>0?parseFloat((s.tpm/s.tpa*100).toFixed(1)):0,
      ftpct:s.fta>0?parseFloat((s.ftm/s.fta*100).toFixed(1)):0,
      topg:avg(s.turnovers),
      pfpg:gp>0?parseFloat(((s.fouls||0)/gp).toFixed(1)):0,
      tf:s.tech_fouls||0,
      three:p.three, layup:p.layup, dunk:p.dunk, mid:p.mid, ft:p.ft,
      siq:p.siq, draw_foul:p.draw_foul, blk:p.blk, stl:p.stl,
      idef:p.idef, pdef:p.pdef, def_reb:p.def_reb, off_reb:p.off_reb,
      stamina:p.stamina, durability:p.durability, ball_hdl:p.ball_hdl,
      pass_vis:p.pass_vis, pass_iq:p.pass_iq, assist_role:p.assist_role,
      pressure:p.pressure, consistency:p.consistency,
      crowd_effect:p.crowd_effect, streaky:p.streaky,
    }
  })

  const handleSort = (key: string, numeric: boolean) => {
    if (!numeric) return
    if (sortKey === key) setSortDir(d => d==='desc'?'asc':'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...rows].sort((a:any, b:any) => {
    const av=a[sortKey], bv=b[sortKey]
    if (typeof av==='number' && typeof bv==='number')
      return sortDir==='desc' ? bv-av : av-bv
    return 0
  })

  const cols = mode==='stats' ? STAT_COLS : ATTR_COLS
  const capFmt = (n:number) => n>=1000000?'$'+(n/1000000).toFixed(1)+'M':'$'+n.toLocaleString()
  const fmtVal = (key:string, val:any) => {
    if (key==='salary') return capFmt(val)
    if (['fgpct','tppct','ftpct'].includes(key)) return val>0?val+'%':'—'
    if (typeof val==='number') return val>0?val:'—'
    return val
  }

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'#120f0a',border:'1px solid #3a3228'}}>
          {(['stats','attributes'] as Mode[]).map(m=>(
            <button key={m} onClick={()=>{setMode(m);setSortKey(m==='stats'?'ppg':'three');setSortDir('desc')}}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{background:mode===m?'#3a3228':'transparent',color:mode===m?'#60a0ff':'#8a7a6a'}}>
              {m==='stats'?'📊 Stats':'⚡ Attributes'}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{color:'#5a4a3a'}}>
          Click column to sort · hover <span style={{background:'#3a3228',color:'#60a0ff',borderRadius:3,padding:'0 3px',fontSize:8}}>i</span> for definitions
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-x-auto mb-2" style={{border:'1px solid #3a3228', overflowY:'visible'}}>
        <table className="w-full text-xs" style={{minWidth:mode==='attributes'?900:640, borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#120f0a',borderBottom:'1px solid #3a3228'}}>
              {cols.map(col=>(
                <TH key={col.key} col={col} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p:any,i:number)=>(
              <tr key={p.id}
                  style={{background:i%2===0?'#241f18':'#1e1a14',borderBottom:'1px solid #16120d'}}
                  className="hover:brightness-110 transition-all">
                {cols.map(col=>{
                  if (col.key==='name') return (
                    <td key="name" className="px-3 py-2 sticky left-0 z-10"
                        style={{background:i%2===0?'#241f18':'#1e1a14'}}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                             style={{background:teamColor+'22'}}>
                          {p.photo_url
                            ?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                            :<div className="w-full h-full flex items-center justify-center text-xs font-black"
                                  style={{color:teamColor}}>
                               {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                             </div>}
                        </div>
                        <Link href={`/player/${p.id}`}
                              className="font-semibold text-white no-underline hover:text-blue-400 transition-colors whitespace-nowrap">
                          {p.name}
                        </Link>
                      </div>
                    </td>
                  )
                  if (col.key==='pos') return (
                    <td key="pos" className="px-3 py-2" style={{color:'#8a7a6a'}}>{p.pos}</td>
                  )
                  const val=(p as any)[col.key]
                  const isActive=sortKey===col.key
                  return (
                    <td key={col.key} className="px-3 py-2 text-right font-semibold"
                        style={{
                          color:mode==='attributes'&&col.numeric&&typeof val==='number'
                            ?attrColor(val):isActive?'#fff':col.color||'#e8e0d0',
                          background:isActive?teamColor+'11':undefined,
                        }}>
                      {fmtVal(col.key,val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{color:'#4a3a2a'}}>
        {sorted.length} players · {mode==='stats'
          ?'Per game averages · TF = season total technical fouls'
          :'Ratings 0–100 · Gold ≥90 · Green ≥80 · Blue ≥70'}
      </p>
    </div>
  )
}

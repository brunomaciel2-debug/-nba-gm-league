'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcOvr, ovrColor } from '@/lib/ovr'

const POSITIONS = ['All','PG','SG','SF','PF','C']
type Mode = 'stats' | 'attributes'
type Tab  = 'players' | 'gleague' | 'staff'

const TOOLTIPS: Record<string,string> = {
  '3PT':'Three-Point Shooting (0-100)', LAY:'Layup (0-100)', DNK:'Dunk (0-100)',
  MID:'Mid-Range (0-100)', FT:'Free Throw (0-100)', SIQ:'Shot IQ (0-100)',
  DF:'Draw Foul (0-100)', BLK:'Block (0-100)', STL:'Steal (0-100)',
  IDEF:'Interior Defense (0-100)', PDEF:'Perimeter Defense (0-100)',
  DREB:'Def. Rebound (0-100)', OREB:'Off. Rebound (0-100)',
  STA:'Stamina (0-100)', DUR:'Durability (0-100)',
  BH:'Ball Handle (0-100)', PV:'Pass Vision (0-100)', PIQ:'Pass IQ (0-100)',
  AR:'Assist Role (0-100)', CLU:'Clutch (0-100)', CON:'Consistency (0-100)',
  CE:'Crowd Effect (0-100)', STR:'Streaky (0-100)',
  OVR:'Overall rating', AGE:'Player age', EXP:'NBA seasons played',
}

const ATTR_COLS = [
  {key:'three',      label:'3PT',  color:'#b45309'},
  {key:'layup',      label:'LAY',  color:'#c2410c'},
  {key:'dunk',       label:'DNK',  color:'#c2410c'},
  {key:'mid',        label:'MID',  color:'#c2410c'},
  {key:'ft',         label:'FT',   color:'#0e7490'},
  {key:'siq',        label:'SIQ',  color:'#c2410c'},
  {key:'draw_foul',  label:'DF',   color:'#c2410c'},
  {key:'blk',        label:'BLK',  color:'#c2410c'},
  {key:'stl',        label:'STL',  color:'#7c3aed'},
  {key:'idef',       label:'IDEF', color:'#166534'},
  {key:'pdef',       label:'PDEF', color:'#166534'},
  {key:'def_reb',    label:'DREB', color:'#1e40af'},
  {key:'off_reb',    label:'OREB', color:'#1e40af'},
  {key:'stamina',    label:'STA',  color:'#7c3aed'},
  {key:'durability', label:'DUR',  color:'#7c3aed'},
  {key:'ball_hdl',   label:'BH',   color:'#0e7490'},
  {key:'pass_vis',   label:'PV',   color:'#0e7490'},
  {key:'pass_iq',    label:'PIQ',  color:'#0e7490'},
  {key:'assist_role',label:'AR',   color:'#0e7490'},
  {key:'pressure',   label:'CLU',  color:'#b45309'},
  {key:'consistency',label:'CON',  color:'#b45309'},
  {key:'crowd_effect',label:'CE',  color:'#b45309'},
  {key:'streaky',    label:'STR',  color:'#b45309'},
]

function attrColor(v: number) {
  if (v >= 90) return '#b45309'
  if (v >= 80) return '#15803d'
  if (v >= 70) return '#1d4ed8'
  if (v >= 60) return '#1a1512'
  return '#8a8279'
}

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                    width:12,height:12,borderRadius:'50%',background:'#d4cdc5',
                    color:'#5c554e',fontSize:8,fontWeight:700,lineHeight:1}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2 py-1.5 rounded-lg text-xs
                       opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{background:'#1a1512',color:'#f5f1eb',width:180,whiteSpace:'normal',
                    lineHeight:1.4,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>
        {text}
      </span>
    </span>
  )
}

function SortTh({ label, sk, active, dir, onClick }: {
  label: string, sk: string, active: boolean, dir: string, onClick: () => void
}) {
  return (
    <th onClick={onClick} className="px-2 py-2.5 text-center cursor-pointer select-none whitespace-nowrap"
        style={{background:'#f0ece5',color:active?'#c8102e':'#5c554e',fontSize:11,fontWeight:700,
                letterSpacing:'0.5px',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5'}}>
      {label}{TOOLTIPS[label] && <Tip text={TOOLTIPS[label]}/>}
      {active && <span style={{marginLeft:3}}>{dir==='desc'?'↓':'↑'}</span>}
    </th>
  )
}

function salaryRange(ovr: number) {
  if (ovr >= 90) return '$30M–$45M'
  if (ovr >= 85) return '$20M–$30M'
  if (ovr >= 80) return '$12M–$20M'
  if (ovr >= 75) return '$8M–$14M'
  if (ovr >= 70) return '$5M–$10M'
  if (ovr >= 65) return '$3M–$6M'
  if (ovr >= 60) return '$1.5M–$4M'
  return '$1M–$2.5M'
}

const EXP_LABEL = (n: number) => n === 0 ? 'Rookie' : n === 1 ? '2nd Yr' : n === 2 ? '3rd Yr' : `${n} Yrs`

// ── STAFF ─────────────────────────────────────────────────

const ROLE_COLORS: Record<string,string> = {
  head_coach:'#b45309', assistant_coach:'#1d4ed8', trainer:'#15803d', physio:'#6d28d9'
}

function staffRating(c: any) {
  if (c.role === 'physio')  return c.rehab_speed || 0
  if (c.role === 'trainer') return Math.round(((c.conditioning||0)+(c.recovery_boost||0)+(c.injury_prevent||0))/3)
  return Math.round(((c.off_adjustment||0)+(c.def_adjustment||0)+(c.off_development||0)+(c.def_development||0)+(c.tactical_dev||0))/5)
}

function StaffTab({ staff }: { staff: any[] }) {
  const [filter, setFilter]   = useState('all')
  const [sortKey, setSortKey] = useState('attr')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [search, setSearch]   = useState('')

  const filtered = staff
    .filter(c => filter === 'all' || c.role === filter)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => {
      let av = 0, bv = 0
      if (sortKey === 'glTeam') { const r = (a.glTeam||'').localeCompare(b.glTeam||''); return sortDir === 'asc' ? r : -r }      if (sortKey === 'name')  { const r = a.name?.localeCompare(b.name) || 0; return sortDir === 'asc' ? r : -r }
      if (sortKey === 'age')   { av = a.age || 0;              bv = b.age || 0 }
      if (sortKey === 'attr')  { av = staffRating(a);          bv = staffRating(b) }
      if (sortKey === 'oa')    { av = a.off_adjustment || 0;   bv = b.off_adjustment || 0 }
      if (sortKey === 'da')    { av = a.def_adjustment || 0;   bv = b.def_adjustment || 0 }
      if (sortKey === 'od')    { av = a.off_development || 0;  bv = b.off_development || 0 }
      if (sortKey === 'dd')    { av = a.def_development || 0;  bv = b.def_development || 0 }
      if (sortKey === 'cond')  { av = a.conditioning || 0;     bv = b.conditioning || 0 }
      if (sortKey === 'rec')   { av = a.recovery_boost || 0;   bv = b.recovery_boost || 0 }
      if (sortKey === 'inj')   { av = a.injury_prevent || 0;   bv = b.injury_prevent || 0 }
      if (sortKey === 'rehab') { av = a.rehab_speed || 0;      bv = b.rehab_speed || 0 }
      return sortDir === 'asc' ? av - bv : bv - av
    })

  const toggle = (k: string) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const Th = ({ k, lbl }: { k: string, lbl: string }) => (
    <th onClick={() => toggle(k)} className="px-3 py-2.5 cursor-pointer select-none whitespace-nowrap"
        style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',fontSize:11,fontWeight:700,
                letterSpacing:'0.5px',color:sortKey===k?'#c8102e':'#5c554e',textAlign:'center'}}>
      {lbl}{sortKey===k && <span className="ml-1">{sortDir==='asc'?'↑':'↓'}</span>}
    </th>
  )

  const V = ({ v, good, color }: { v: number, good: number, color: string }) =>
    v ? <span style={{color: v >= good ? color : '#5c554e', fontWeight: 600}}>{v}</span>
      : <span style={{color:'#c8c0b4'}}>—</span>

  return (
    <div>
      <div className="rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-end"
           style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div className="flex-1 min-w-36">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..."
            className="w-full px-3 py-1.5 rounded-lg text-sm"
            style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        </div>
        <div className="flex gap-1 flex-wrap">
          {['all','head_coach','assistant_coach','trainer','physio'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
              style={{background:filter===f?'#1a1512':'#f0ece5',color:filter===f?'#fff':'#5c554e',
                      border:'1px solid '+(filter===f?'#1a1512':'#d4cdc5')}}>
              {f === 'all' ? 'All' : f.replace(/_/g,' ').split(' ').map((w:string) => w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{color:'#8a8279'}}>{filtered.length} available</span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th onClick={() => toggle('name')} className="px-3 py-2.5 text-left cursor-pointer"
                    style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',fontSize:11,
                            fontWeight:700,color:sortKey==='name'?'#c8102e':'#5c554e',letterSpacing:'0.5px',minWidth:160}}>
                  NAME{sortKey==='name'&&<span className="ml-1">{sortDir==='asc'?'↑':'↓'}</span>}
                </th>
                <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',fontSize:11,fontWeight:700,
                            color:'#5c554e',letterSpacing:'0.5px',padding:'10px 12px',textAlign:'left'}}>ROLE</th>
                <Th k="age"   lbl="AGE" />
                <Th k="oa"    lbl="OFF ADJ" />
                <Th k="da"    lbl="DEF ADJ" />
                <Th k="od"    lbl="OFF DEV" />
                <Th k="dd"    lbl="DEF DEV" />
                <Th k="cond"  lbl="COND" />
                <Th k="rec"   lbl="RECOV" />
                <Th k="inj"   lbl="INJ PRV" />
                <Th k="rehab" lbl="REHAB" />
                <Th k="attr"  lbl="RATING" />
                <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} className="px-4 py-8 text-center" style={{color:'#8a8279'}}>No staff available.</td></tr>
              ) : filtered.map((c: any, i: number) => {
                const rc = ROLE_COLORS[c.role] || '#5c554e'
                const rating = staffRating(c)
                const rc2 = rating >= 80 ? '#b45309' : rating >= 70 ? '#15803d' : rating >= 60 ? '#1d4ed8' : '#8a8279'
                return (
                  <tr key={c.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,overflow:'hidden',
                                     background:rc+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {c.photo_url
                            ?<img src={c.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                            :<span style={{fontSize:9,fontWeight:900,color:rc}}>
                              {c.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                            </span>}
                        </div>
                        <div>
                          <Link href={`/staff/${c.id}`} className="font-semibold no-underline hover:underline" style={{color:'#1a1512'}}>
                            {c.name}
                          </Link>
                          {c.nationality && <span className="ml-1.5 text-xs" style={{color:'#8a8279'}}>{c.nationality}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{background:rc+'18',color:rc}}>
                        {c.role.replace(/_/g,' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center" style={{color:'#5c554e'}}>{c.age || '—'}</td>
                    <td className="px-3 py-2.5 text-center"><V v={c.off_adjustment}  good={75} color="#b45309"/></td>
                    <td className="px-3 py-2.5 text-center"><V v={c.def_adjustment}  good={75} color="#15803d"/></td>
                    <td className="px-3 py-2.5 text-center"><V v={c.off_development} good={75} color="#b45309"/></td>
                    <td className="px-3 py-2.5 text-center"><V v={c.def_development} good={75} color="#15803d"/></td>
                    <td className="px-3 py-2.5 text-center"><V v={c.conditioning}    good={75} color="#15803d"/></td>
                    <td className="px-3 py-2.5 text-center"><V v={c.recovery_boost}  good={75} color="#1d4ed8"/></td>
                    <td className="px-3 py-2.5 text-center"><V v={c.injury_prevent}  good={75} color="#b45309"/></td>
                    <td className="px-3 py-2.5 text-center"><V v={c.rehab_speed}     good={75} color="#6d28d9"/></td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-black text-sm" style={{color:rc2}}>{rating}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/staff/${c.id}`}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg no-underline"
                            style={{background:'#c8102e',color:'#fff'}}>
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────

export default function FreeAgentsPage() {
  const [tab,    setTab]    = useState<Tab>('players')
  const [players,setPlayers]= useState<any[]>([])
  const [staff,  setStaff]  = useState<any[]>([])
  const [loading,setLoading]= useState(true)
  const [pos,    setPos]    = useState('All')
  const [mode,   setMode]   = useState<Mode>('attributes')
  const [sortKey,setSortKey]= useState('ovr')
  const [sortDir,setSortDir]= useState<'desc'|'asc'>('desc')
  const [search, setSearch] = useState('')
  const [maxAge, setMaxAge] = useState(42)

  useEffect(() => {
    Promise.all([
      supabase.from('players')
        .select('*, photo_url, gleague_team_id, gleague_teams(id,name), player_stats(pts,reb,ast,stl,blk,games,fgm,fga,tpm,tpa,ftm,fta,season)')
        .is('team_id', null).is('world_team_id', null).eq('status', 'active'),
      supabase.from('coaches').select('*').is('team_id', null),
    ]).then(([{ data: pl }, { data: st }]) => {
      setPlayers(pl || [])
      setStaff(st || [])
      setLoading(false)
    })
  }, [])

  const rows = players.map((p: any) => {
    const s = (p.player_stats || []).find((s: any) => s.season === '2025-26') || {}
    const gp = s.games || 0
    const avg = (v: number) => gp > 0 ? parseFloat((v / gp).toFixed(1)) : 0
    const ovr = calcOvr(p)
    return {
      ...p, ovr,
      ppg: avg(s.pts), rpg: avg(s.reb), apg: avg(s.ast),
      spg: avg(s.stl), bpg: avg(s.blk),
      fgpct: s.fga > 0 ? parseFloat((s.fgm/s.fga*100).toFixed(1)) : 0,
      tppct: s.tpa > 0 ? parseFloat((s.tpm/s.tpa*100).toFixed(1)) : 0,
      ftpct: s.fta > 0 ? parseFloat((s.ftm/s.fta*100).toFixed(1)) : 0,
      topg: avg(s.turnovers), glTeam: p.gleague_teams?.name||null,
    }
  })

  const isGleague = tab === 'gleague'
  const filtered = rows
    .filter(p => isGleague ? !!p.glTeam : !p.glTeam)
    .filter(p => pos === 'All' || p.pos === pos)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => (p.age || 25) <= maxAge)
    .sort((a: any, b: any) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const POT_COLOR: Record<string,string> = {A:'#c8102e',B:'#b45309',C:'#1d4ed8',D:'#6b6258',F:'#9c9088'}

  return (
    <div className="max-w-full px-4 py-6">
      <div className="sec-hdr mb-4">
        <span className="sec-title">
          <i className="ti ti-user-plus" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          Free Agents — 2025-26
        </span>
        <span className="text-sm font-semibold" style={{color:'#8a8279'}}>
          {loading ? 'Loading…' : tab === 'staff' ? `${staff.length} staff` : `${filtered.length} ${tab === 'gleague' ? 'G-Leaguers' : 'players'}`}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b" style={{borderColor:'#d4cdc5'}}>
        {(['players','gleague','staff'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{padding:'10px 20px',fontSize:14,fontWeight:600,cursor:'pointer',
                    background:'transparent',border:'none',
                    color: tab===t ? '#1a1512' : '#5c554e',
                    borderBottom: tab===t ? '3px solid #c8102e' : '3px solid transparent',
                    marginBottom: -1}}>
            {t === 'players' ? 'Players' : t === 'gleague' ? 'G-Leaguers' : 'Staff'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{color:'#8a8279'}}>Loading...</div>
      ) : tab === 'staff' ? (
        <StaffTab staff={staff} />
      ) : (
        <>
          {/* Player filters */}
          <div className="rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-end"
               style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
            <div className="flex-1 min-w-36">
              <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Search</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Player name..."
                className="w-full px-3 py-1.5 rounded-lg text-sm"
                style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Position</label>
              <div className="flex gap-1">
                {POSITIONS.map(p => (
                  <button key={p} onClick={() => setPos(p)}
                    className="text-xs font-bold px-2 py-1.5 rounded-lg"
                    style={{background:pos===p?'#1a1512':'#f0ece5',color:pos===p?'#fff':'#5c554e',
                            border:'1px solid '+(pos===p?'#1a1512':'#d4cdc5')}}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Max Age: {maxAge}</label>
              <input type="range" min={18} max={45} value={maxAge} onChange={e => setMaxAge(+e.target.value)} className="w-28"/>
            </div>
            <div className="flex gap-1">
              {(['attributes','stats'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{background:mode===m?'#1a1512':'#f0ece5',color:mode===m?'#fff':'#5c554e',
                          border:'1px solid '+(mode===m?'#1a1512':'#d4cdc5')}}>
                  {m === 'attributes' ? '⚡ Attributes' : '📊 Stats'}
                </button>
              ))}
            </div>
          </div>

          {/* Player table */}
          <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
            <div className="overflow-x-auto">
              <table className="w-full" style={{borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#f0ece5'}}>
                    <th className="px-3 py-2.5 text-left sticky left-0 z-10"
                        style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',
                                borderRight:'1px solid #e2dcd5',minWidth:160,fontWeight:700,fontSize:11,color:'#5c554e'}}>
                      Player
                    </th>
                    <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 8px',
                                fontWeight:700,fontSize:11,color:'#5c554e',textAlign:'center',
                                borderRight:'1px solid #e2dcd5'}}>Pos</th>
                    <SortTh label="OVR" sk={sortKey} active={sortKey==='ovr'} dir={sortDir} onClick={() => handleSort('ovr')}/>
                    <SortTh label="AGE" sk={sortKey} active={sortKey==='age'} dir={sortDir} onClick={() => handleSort('age')}/>
                    <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 8px',
                                fontWeight:700,fontSize:11,color:'#5c554e',textAlign:'center',
                                borderRight:'1px solid #e2dcd5'}}>
                      EXP<Tip text={TOOLTIPS.EXP}/></th><th onClick={()=>handleSort('glTeam')} style={{cursor:'pointer',padding:'8px 10px',textAlign:'left',fontWeight:700,fontSize:11,color:'#8a8279',whiteSpace:'nowrap'}}>STATUS {sortKey==='glTeam'?(sortDir==='asc'?'^':'v'):''}</th>
                    {mode === 'attributes' ? (
                      ATTR_COLS.map(c => (
                        <SortTh key={c.key} label={c.label} sk={sortKey} active={sortKey===c.key} dir={sortDir} onClick={() => handleSort(c.key)}/>
                      ))
                    ) : (
                      ['ppg','rpg','apg','spg','bpg'].map(k => (
                        <SortTh key={k} label={k.toUpperCase()} sk={sortKey} active={sortKey===k} dir={sortDir} onClick={() => handleSort(k)}/>
                      ))
                    )}
                    <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 8px',
                                fontWeight:700,fontSize:11,color:'#5c554e',textAlign:'center',whiteSpace:'nowrap'}}>
                      Salary Ask
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={30} className="px-4 py-8 text-center" style={{color:'#8a8279'}}>No players match.</td></tr>
                  ) : filtered.map((p: any, i: number) => {
                    const oc = ovrColor(p.ovr)
                    return (
                      <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e8e3db'}}>
                        <td className="px-3 py-2 sticky left-0 z-10 whitespace-nowrap"
                            style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderRight:'1px solid #e2dcd5'}}>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded flex-shrink-0 overflow-hidden"
                                 style={{background:oc+'18'}}>
                              {p.photo_url
                                ?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                :<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',
                                              justifyContent:'center',fontSize:8,fontWeight:900,color:oc}}>
                                  {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                </div>}
                            </div>
                            <Link href={`/player/${p.id}`} className="font-semibold no-underline hover:underline"
                                  style={{color:'#1a1512'}}>{p.name}</Link>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}>
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                                style={{background:'#e8e2d8',color:'#3d3731'}}>{p.pos}</span>
                        </td>
                        <td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}>
                          <span className="font-black text-sm" style={{color:oc}}>{p.ovr}</span>
                        </td>
                        <td className="px-2 py-2 text-center text-sm" style={{color:'#5c554e',borderRight:'1px solid #e2dcd5'}}>
                          {p.age ?? '—'}
                        </td>
                        <td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}>
                          <span className="text-xs font-semibold"
                                style={{color:(p.nba_experience??1)===0?'#6d28d9':'#5c554e'}}>
                            {EXP_LABEL(p.nba_experience ?? 1)}</span></td><td style={{padding:'6px 8px'}}><span style={{display:'inline-block',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,background:p.glTeam?'#1a3a2a':'#2a1a0a',color:p.glTeam?'#4ade80':'#d4a04a'}}>{p.glTeam||'FA'}</span></td>
                        {mode === 'attributes' ? (
                          ATTR_COLS.map(c => (
                            <td key={c.key} className="px-2 py-2 text-center" style={{borderRight:'1px solid #e8e3db'}}>
                              <span className="text-xs font-bold" style={{color:attrColor(p[c.key]||0)}}>
                                {p[c.key] || 0}
                              </span>
                            </td>
                          ))
                        ) : (
                          ['ppg','rpg','apg','spg','bpg'].map(k => (
                            <td key={k} className="px-2 py-2 text-center text-sm font-semibold"
                                style={{color:'#1a1512',borderRight:'1px solid #e8e3db'}}>
                              {p[k] || '—'}
                            </td>
                          ))
                        )}
                        <td className="px-3 py-2 text-center whitespace-nowrap font-semibold text-xs"
                            style={{color:'#1a1512'}}>
                          {salaryRange(p.ovr)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs"
                 style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5',color:'#8a8279'}}>
              Click column headers to sort · Hover i for definitions
            </div>
          </div>
        </>
      )}
    </div>
  )
}

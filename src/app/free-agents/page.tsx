'use client'
import { useEffect, useState } from 'react'
import { readableTeamColor } from '@/lib/color'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcOvr, ovrColor } from '@/lib/ovr'

const POSITIONS = ['All','PG','SG','SF','PF','C']
type Mode = 'stats' | 'attributes'

const TOOLTIPS: Record<string,string> = {
  PPG:'Points Per Game', RPG:'Rebounds Per Game', APG:'Assists Per Game',
  SPG:'Steals Per Game', BPG:'Blocks Per Game', 'FG%':'Field Goal %',
  '3P%':'Three-Point %', 'FT%':'Free Throw %', TO:'Turnovers Per Game',
  '3PT':'Three-Point Shooting (0-100)', LAY:'Layup — rim finishing (0-100)',
  DNK:'Dunk power (0-100)', MID:'Mid-Range (0-100)', FT:'Free Throw mechanics (0-100)',
  SIQ:'Shot IQ (0-100)', DF:'Draw Foul (0-100)', BLK:'Block (0-100)',
  STL:'Steal (0-100)', IDEF:'Interior Defense (0-100)', PDEF:'Perimeter Defense (0-100)',
  DREB:'Def. Rebound (0-100)', OREB:'Off. Rebound (0-100)',
  STA:'Stamina (0-100)', DUR:'Durability (0-100)',
  BH:'Ball Handle (0-100)', PV:'Pass Vision (0-100)',
  PIQ:'Pass IQ (0-100)', AR:'Assist Role (0-100)',
  CLU:'Clutch (0-100)', CON:'Consistency (0-100)', CE:'Crowd Effect (0-100)', STR:'Streaky (0-100)',
  EXP:'NBA Experience (seasons)', AGE:'Player age', OVR:'Overall rating',
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

function attrColor(v:number) {
  if (v>=90) return '#b45309'
  if (v>=80) return '#15803d'
  if (v>=70) return '#1d4ed8'
  if (v>=60) return '#1a1512'
  return '#8a8279'
}

function Tip({text}:{text:string}) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-xs font-bold"
            style={{background:'#d4cdc5',color:'#5c554e',fontSize:8,lineHeight:1}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2 py-1.5 rounded-lg text-xs
                       opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{background:'#1a1512',color:'#f5f1eb',width:180,whiteSpace:'normal',
                    lineHeight:1.4,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>
        {text}
      </span>
    </span>
  )
}

function ColHeader({label,sortKey,active,dir,onClick}:{label:string,sortKey:string,active:boolean,dir:string,onClick:()=>void}) {
  return (
    <th className="px-2 py-2.5 text-center cursor-pointer select-none whitespace-nowrap"
        onClick={onClick}
        style={{background:'#f0ece5',color:active?'#c8102e':'#5c554e',fontSize:11,fontWeight:700,
                letterSpacing:'0.5px',borderBottom:'2px solid #d4cdc5',
                borderRight:'1px solid #e2dcd5'}}>
      {label}
      {TOOLTIPS[label] && <Tip text={TOOLTIPS[label]}/>}
      {active && <span style={{marginLeft:3}}>{dir==='desc'?'↓':'↑'}</span>}
    </th>
  )
}

function Bar({value,color}:{value:number,color:string}) {
  const v = value||0
  const c = attrColor(v)
  return (
    <div className="flex items-center gap-1.5 justify-center">
      <div className="w-14 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{background:'#e2dcd5'}}>
        <div style={{width:Math.min(v,100)+'%',height:'100%',background:c,borderRadius:3}}/>
      </div>
      <span className="text-xs font-bold w-5 text-right flex-shrink-0" style={{color:c,fontSize:10}}>{v}</span>
    ) : (
        /* STAFF FREE AGENTS */
        <StaffFA staff={staff} />
      )}
    </div>
  )
}

const ROLE_COLORS: Record<string,string> = {
  head_coach:'#b45309', assistant_coach:'#1d4ed8', trainer:'#15803d', physio:'#6d28d9'
}

function mainAttr(c: any) {
  if (c.role==='physio') return c.rehab_speed||0
  if (c.role==='trainer') return Math.round(((c.conditioning||0)+(c.recovery_boost||0)+(c.injury_prevent||0))/3)
  return Math.round(((c.off_adjustment||0)+(c.def_adjustment||0)+(c.off_development||0)+(c.def_development||0)+(c.tactical_dev||0))/5)
}

function StaffFA({ staff }: { staff: any[] }) {
  const [filter, setFilter] = useState('all')
  const [sortKey, setSortKey] = useState('attr')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [search, setSearch] = useState('')

  const isCoach = (r:string) => r==='head_coach'||r==='assistant_coach'

  const filtered = staff
    .filter(c => filter==='all' || c.role===filter)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a:any,b:any) => {
      let av=0,bv=0
      if (sortKey==='name') { av=a.name?.localeCompare(b.name)||0; return sortDir==='asc'?av:-av }
      if (sortKey==='age')  { av=a.age||0; bv=b.age||0 }
      if (sortKey==='attr') { av=mainAttr(a); bv=mainAttr(b) }
      if (sortKey==='oa')   { av=a.off_adjustment||0; bv=b.off_adjustment||0 }
      if (sortKey==='da')   { av=a.def_adjustment||0; bv=b.def_adjustment||0 }
      if (sortKey==='od')   { av=a.off_development||0; bv=b.off_development||0 }
      if (sortKey==='dd')   { av=a.def_development||0; bv=b.def_development||0 }
      if (sortKey==='cond') { av=a.conditioning||0; bv=b.conditioning||0 }
      if (sortKey==='rec')  { av=a.recovery_boost||0; bv=b.recovery_boost||0 }
      if (sortKey==='inj')  { av=a.injury_prevent||0; bv=b.injury_prevent||0 }
      if (sortKey==='rehab'){ av=a.rehab_speed||0; bv=b.rehab_speed||0 }
      return sortDir==='asc'?av-bv:bv-av
    })

  const toggle = (k:string) => {
    if (sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const Th = ({k,label}:{k:string,label:string}) => (
    <th onClick={()=>toggle(k)} className="px-3 py-2.5 text-left cursor-pointer select-none whitespace-nowrap"
        style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',fontSize:11,fontWeight:700,
                letterSpacing:'0.5px',color:sortKey===k?'#c8102e':'#5c554e'}}>
      {label}{sortKey===k&&<span className="ml-1">{sortDir==='asc'?'↑':'↓'}</span>}
    </th>
  )

  return (
    <div>
      <div className="rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-end"
           style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div className="flex-1 min-w-36">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff..."
            className="w-full px-3 py-1.5 rounded-lg text-sm"
            style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        </div>
        <div className="flex gap-1 flex-wrap">
          {['all','head_coach','assistant_coach','trainer','physio'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
              style={{background:filter===f?'#1a1512':'#f0ece5',color:filter===f?'#fff':'#5c554e',
                      border:'1px solid '+(filter===f?'#1a1512':'#d4cdc5')}}>
              {f==='all'?'All':f.replace(/_/g,' ').replace(/\w/g,(c:string)=>c.toUpperCase())}
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
                <Th k="name"  label="NAME" />
                <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 12px',
                            fontSize:11,fontWeight:700,color:'#5c554e',letterSpacing:'0.5px'}}>ROLE</th>
                <Th k="age"   label="AGE" />
                <Th k="oa"    label="OFF ADJ" />
                <Th k="da"    label="DEF ADJ" />
                <Th k="od"    label="OFF DEV" />
                <Th k="dd"    label="DEF DEV" />
                <Th k="cond"  label="COND" />
                <Th k="rec"   label="RECOV" />
                <Th k="inj"   label="INJ PREV" />
                <Th k="rehab" label="REHAB" />
                <Th k="attr"  label="RATING" />
                <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={13} className="px-4 py-8 text-center" style={{color:'#8a8279'}}>No staff available.</td></tr>
              ) : filtered.map((c:any,i:number) => {
                const rc = ROLE_COLORS[c.role]||'#5c554e'
                const attr = mainAttr(c)
                const ac = attr>=80?'#b45309':attr>=70?'#15803d':attr>=60?'#1d4ed8':'#8a8279'
                const val = (v:number,good:number,c1:string,c2:string) =>
                  v ? <span style={{color:v>=good?c1:c2,fontWeight:600}}>{v}</span> : <span style={{color:'#c8c0b4'}}>—</span>
                return (
                  <tr key={c.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                    <td className="px-3 py-2.5">
                      <Link href={`/staff/${c.id}`} className="font-semibold no-underline hover:underline" style={{color:'#1a1512'}}>{c.name}</Link>
                      {c.nationality && <span className="ml-1.5 text-xs" style={{color:'#8a8279'}}>{c.nationality}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{background:rc+'18',color:rc}}>
                        {c.role.replace(/_/g,' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center" style={{color:'#5c554e'}}>{c.age||'—'}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.off_adjustment,75,'#b45309','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.def_adjustment,75,'#15803d','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.off_development,75,'#b45309','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.def_development,75,'#15803d','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.conditioning,75,'#15803d','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.recovery_boost,75,'#1d4ed8','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.injury_prevent,75,'#b45309','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.rehab_speed,75,'#6d28d9','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-black text-sm" style={{color:ac}}>{attr}</span>
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

function salaryRange(ovr:number) {
  if (ovr>=90) return '$30M–$45M'
  if (ovr>=85) return '$20M–$30M'
  if (ovr>=80) return '$12M–$20M'
  if (ovr>=75) return '$8M–$14M'
  if (ovr>=70) return '$5M–$10M'
  if (ovr>=65) return '$3M–$6M'
  if (ovr>=60) return '$1.5M–$4M'
  return '$1M–$2.5M'
}

const EXP_LABEL = (n:number) => n===0?'Rookie':n===1?'2nd Yr':n===2?'3rd Yr':`${n} Yrs`

export default function FreeAgentsPage() {
  const [tab, setTab] = useState<'players'|'staff'>('players')
  const [players, setPlayers] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pos,    setPos]    = useState('All')
  const [mode,   setMode]   = useState<Mode>('attributes')
  const [sortKey,setSortKey]= useState('ovr')
  const [sortDir,setSortDir]= useState<'desc'|'asc'>('desc')
  const [search, setSearch] = useState('')
  const [maxAge, setMaxAge] = useState(42)

  useEffect(()=>{
    supabase.from('players')
      .select('*, player_stats(pts,reb,ast,stl,blk,games,fgm,fga,tpm,tpa,ftm,fta,season)')
      .is('team_id',null)
      .eq('status','active')
      .then(({data})=>{
        setPlayers(data||[])
        setLoading(false)
      })
  },[])

  const rows = players.map((p:any)=>{
    const s = (p.player_stats||[]).find((s:any)=>s.season==='2025-26') || {}
    const gp = s.games||0
    const avg = (v:number) => gp>0 ? parseFloat((v/gp).toFixed(1)) : 0
    const ovr = calcOvr(p)
    return {
      ...p, ovr,
      ppg:avg(s.pts), rpg:avg(s.reb), apg:avg(s.ast),
      spg:avg(s.stl), bpg:avg(s.blk),
      fgpct:s.fga>0?parseFloat((s.fgm/s.fga*100).toFixed(1)):0,
      tppct:s.tpa>0?parseFloat((s.tpm/s.tpa*100).toFixed(1)):0,
      ftpct:s.fta>0?parseFloat((s.ftm/s.fta*100).toFixed(1)):0,
      topg:avg(s.turnovers),
    }
  })

  const filtered = rows
    .filter(p=>pos==='All'||p.pos===pos)
    .filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p=>(p.age||25)<=maxAge)
    .sort((a:any,b:any)=>{
      const av=a[sortKey]??0, bv=b[sortKey]??0
      return sortDir==='desc'?bv-av:av-bv
    })

  const handleSort = (key:string) => {
    if(sortKey===key) setSortDir(d=>d==='desc'?'asc':'desc')
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
          {loading?'Loading…':`${filtered.length} players`}
        </span>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4 border-b" style={{borderColor:'#d4cdc5'}}>
        {([['players','Players'],['staff','Staff']] as const).map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)}
            className="px-5 py-2.5 text-sm font-semibold transition-all"
            style={{color:tab===key?'#1a1512':'#5c554e',
                    borderBottom:tab===key?'3px solid #c8102e':'3px solid transparent',
                    marginBottom:-1,background:'transparent',border:'none',cursor:'pointer'}}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-end"
           style={{background:'#faf8f5',border:'1px solid #d4cdc5',display:tab==='staff'?'none':'flex'}}>
        <div className="flex-1 min-w-36">
          <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Search</label>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Player name..."
            className="w-full px-3 py-1.5 rounded-lg text-sm"
            style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Position</label>
          <div className="flex gap-1">
            {POSITIONS.map(p=>(
              <button key={p} onClick={()=>setPos(p)}
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
          <input type="range" min={18} max={45} value={maxAge} onChange={e=>setMaxAge(+e.target.value)} className="w-28"/>
        </div>
        <div className="flex gap-1">
          {(['attributes','stats'] as const).map(m=>(
            <button key={m} onClick={()=>setMode(m)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg capitalize"
              style={{background:mode===m?'#1a1512':'#f0ece5',color:mode===m?'#fff':'#5c554e',
                      border:'1px solid '+(mode===m?'#1a1512':'#d4cdc5')}}>
              {m==='attributes'?'⚡ Attributes':'📊 Stats'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{color:'#8a8279'}}>Loading...</div>
      ) : tab === 'players' ? (
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#f0ece5'}}>
                  {/* Fixed columns */}
                  <th className="px-3 py-2.5 text-left sticky left-0 z-10 whitespace-nowrap"
                      style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',
                              borderRight:'1px solid #e2dcd5',minWidth:160,fontWeight:700,fontSize:11,color:'#5c554e'}}>
                    Player
                  </th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap"
                      style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',
                              borderRight:'1px solid #e2dcd5',fontWeight:700,fontSize:11,color:'#5c554e'}}>
                    Pos
                  </th>
                  {/* OVR — always visible */}
                  <ColHeader label="OVR" sortKey={sortKey} active={sortKey==='ovr'} dir={sortDir} onClick={()=>handleSort('ovr')}/>
                  {/* AGE */}
                  <ColHeader label="AGE" sortKey={sortKey} active={sortKey==='age'} dir={sortDir} onClick={()=>handleSort('age')}/>
                  {/* EXP */}
                  <th className="px-2 py-2.5 text-center whitespace-nowrap"
                      style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',
                              borderRight:'1px solid #e2dcd5',fontWeight:700,fontSize:11,color:'#5c554e'}}>
                    EXP<Tip text={TOOLTIPS.EXP}/>
                  </th>

                  {mode==='attributes' ? (
                    ATTR_COLS.map(c=>(
                      <ColHeader key={c.key} label={c.label} sortKey={sortKey}
                        active={sortKey===c.key} dir={sortDir} onClick={()=>handleSort(c.key)}/>
                    ))
                  ) : (
                    ['ppg','rpg','apg','spg','bpg','fgpct','tppct','ftpct','topg'].map(k=>(
                      <ColHeader key={k} label={k.toUpperCase().replace('PCT','%')} sortKey={sortKey}
                        active={sortKey===k} dir={sortDir} onClick={()=>handleSort(k)}/>
                    ))
                  )}
                  <th className="px-3 py-2.5 text-center whitespace-nowrap"
                      style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',
                              fontWeight:700,fontSize:11,color:'#5c554e'}}>
                    Salary Ask
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p:any,i:number)=>{
                  const oc = ovrColor(p.ovr)
                  return (
                    <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',
                                           borderBottom:'1px solid #e8e3db'}}>
                      {/* Player name */}
                      <td className="px-3 py-2 sticky left-0 z-10 whitespace-nowrap"
                          style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderRight:'1px solid #e2dcd5'}}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-xs font-black"
                               style={{background:oc+'18',color:oc}}>
                            {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                          </div>
                          <Link href={`/player/${p.id}`}
                                className="font-semibold no-underline hover:underline"
                                style={{color:'#1a1512'}}>{p.name}</Link>
                        </div>
                      </td>
                      {/* Pos */}
                      <td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}>
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                              style={{background:'#e8e2d8',color:'#3d3731'}}>{p.pos}</span>
                      </td>
                      {/* OVR */}
                      <td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}>
                        <span className="font-black text-sm" style={{color:oc}}>{p.ovr}</span>
                      </td>
                      {/* Age */}
                      <td className="px-2 py-2 text-center text-sm" style={{color:'#5c554e',borderRight:'1px solid #e2dcd5'}}>
                        {p.age??'—'}
                      </td>
                      {/* Exp */}
                      <td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}>
                        <span className="text-xs font-semibold"
                              style={{color:(p.nba_experience??1)===0?'#6d28d9':'#5c554e'}}>
                          {EXP_LABEL(p.nba_experience??1)}
                        </span>
                      </td>

                      {mode==='attributes' ? (
                        ATTR_COLS.map(c=>(
                          <td key={c.key} className="px-2 py-2 text-center" style={{borderRight:'1px solid #e8e3db'}}>
                            <span className="text-xs font-bold" style={{color:attrColor(p[c.key]||0)}}>{p[c.key]||0}</span>
                          </td>
                        ))
                      ) : (
                        ['ppg','rpg','apg','spg','bpg','fgpct','tppct','ftpct','topg'].map(k=>(
                          <td key={k} className="px-2 py-2 text-center text-sm font-semibold"
                              style={{color:k==='topg'?'#dc2626':'#1a1512',borderRight:'1px solid #e8e3db'}}>
                            {p[k]||'—'}
                          </td>
                        ))
                      )}

                      {/* Salary Ask */}
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
          <div className="px-4 py-2 text-xs" style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5',color:'#8a8279'}}>
            Click column headers to sort · Hover <strong>i</strong> for definitions · Stats shown if player has games played
          </div>
        </div>
      )}
    ) : (
        /* STAFF FREE AGENTS */
        <StaffFA staff={staff} />
      )}
    </div>
  )
}

const ROLE_COLORS: Record<string,string> = {
  head_coach:'#b45309', assistant_coach:'#1d4ed8', trainer:'#15803d', physio:'#6d28d9'
}

function mainAttr(c: any) {
  if (c.role==='physio') return c.rehab_speed||0
  if (c.role==='trainer') return Math.round(((c.conditioning||0)+(c.recovery_boost||0)+(c.injury_prevent||0))/3)
  return Math.round(((c.off_adjustment||0)+(c.def_adjustment||0)+(c.off_development||0)+(c.def_development||0)+(c.tactical_dev||0))/5)
}

function StaffFA({ staff }: { staff: any[] }) {
  const [filter, setFilter] = useState('all')
  const [sortKey, setSortKey] = useState('attr')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [search, setSearch] = useState('')

  const isCoach = (r:string) => r==='head_coach'||r==='assistant_coach'

  const filtered = staff
    .filter(c => filter==='all' || c.role===filter)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a:any,b:any) => {
      let av=0,bv=0
      if (sortKey==='name') { av=a.name?.localeCompare(b.name)||0; return sortDir==='asc'?av:-av }
      if (sortKey==='age')  { av=a.age||0; bv=b.age||0 }
      if (sortKey==='attr') { av=mainAttr(a); bv=mainAttr(b) }
      if (sortKey==='oa')   { av=a.off_adjustment||0; bv=b.off_adjustment||0 }
      if (sortKey==='da')   { av=a.def_adjustment||0; bv=b.def_adjustment||0 }
      if (sortKey==='od')   { av=a.off_development||0; bv=b.off_development||0 }
      if (sortKey==='dd')   { av=a.def_development||0; bv=b.def_development||0 }
      if (sortKey==='cond') { av=a.conditioning||0; bv=b.conditioning||0 }
      if (sortKey==='rec')  { av=a.recovery_boost||0; bv=b.recovery_boost||0 }
      if (sortKey==='inj')  { av=a.injury_prevent||0; bv=b.injury_prevent||0 }
      if (sortKey==='rehab'){ av=a.rehab_speed||0; bv=b.rehab_speed||0 }
      return sortDir==='asc'?av-bv:bv-av
    })

  const toggle = (k:string) => {
    if (sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const Th = ({k,label}:{k:string,label:string}) => (
    <th onClick={()=>toggle(k)} className="px-3 py-2.5 text-left cursor-pointer select-none whitespace-nowrap"
        style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',fontSize:11,fontWeight:700,
                letterSpacing:'0.5px',color:sortKey===k?'#c8102e':'#5c554e'}}>
      {label}{sortKey===k&&<span className="ml-1">{sortDir==='asc'?'↑':'↓'}</span>}
    </th>
  )

  return (
    <div>
      <div className="rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-end"
           style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div className="flex-1 min-w-36">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff..."
            className="w-full px-3 py-1.5 rounded-lg text-sm"
            style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        </div>
        <div className="flex gap-1 flex-wrap">
          {['all','head_coach','assistant_coach','trainer','physio'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
              style={{background:filter===f?'#1a1512':'#f0ece5',color:filter===f?'#fff':'#5c554e',
                      border:'1px solid '+(filter===f?'#1a1512':'#d4cdc5')}}>
              {f==='all'?'All':f.replace(/_/g,' ').replace(/\w/g,(c:string)=>c.toUpperCase())}
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
                <Th k="name"  label="NAME" />
                <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 12px',
                            fontSize:11,fontWeight:700,color:'#5c554e',letterSpacing:'0.5px'}}>ROLE</th>
                <Th k="age"   label="AGE" />
                <Th k="oa"    label="OFF ADJ" />
                <Th k="da"    label="DEF ADJ" />
                <Th k="od"    label="OFF DEV" />
                <Th k="dd"    label="DEF DEV" />
                <Th k="cond"  label="COND" />
                <Th k="rec"   label="RECOV" />
                <Th k="inj"   label="INJ PREV" />
                <Th k="rehab" label="REHAB" />
                <Th k="attr"  label="RATING" />
                <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={13} className="px-4 py-8 text-center" style={{color:'#8a8279'}}>No staff available.</td></tr>
              ) : filtered.map((c:any,i:number) => {
                const rc = ROLE_COLORS[c.role]||'#5c554e'
                const attr = mainAttr(c)
                const ac = attr>=80?'#b45309':attr>=70?'#15803d':attr>=60?'#1d4ed8':'#8a8279'
                const val = (v:number,good:number,c1:string,c2:string) =>
                  v ? <span style={{color:v>=good?c1:c2,fontWeight:600}}>{v}</span> : <span style={{color:'#c8c0b4'}}>—</span>
                return (
                  <tr key={c.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                    <td className="px-3 py-2.5">
                      <Link href={`/staff/${c.id}`} className="font-semibold no-underline hover:underline" style={{color:'#1a1512'}}>{c.name}</Link>
                      {c.nationality && <span className="ml-1.5 text-xs" style={{color:'#8a8279'}}>{c.nationality}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{background:rc+'18',color:rc}}>
                        {c.role.replace(/_/g,' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center" style={{color:'#5c554e'}}>{c.age||'—'}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.off_adjustment,75,'#b45309','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.def_adjustment,75,'#15803d','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.off_development,75,'#b45309','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.def_development,75,'#15803d','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.conditioning,75,'#15803d','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.recovery_boost,75,'#1d4ed8','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.injury_prevent,75,'#b45309','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">{val(c.rehab_speed,75,'#6d28d9','#5c554e')}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-black text-sm" style={{color:ac}}>{attr}</span>
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

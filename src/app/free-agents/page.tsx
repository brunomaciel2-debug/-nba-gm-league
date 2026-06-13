'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcOvr, ovrColor } from '@/lib/ovr'

const POSITIONS = ['All','PG','SG','SF','PF','C']
const SORT_OPTIONS = [
  {value:'ovr',label:'Overall'},{value:'age',label:'Age'},
  {value:'pts',label:'Points'},{value:'reb',label:'Rebounds'},
  {value:'ast',label:'Assists'},{value:'salary',label:'Salary Ask'},
]

const POT_COLOR: Record<string,string> = {A:'#c8102e',B:'#b45309',C:'#1d4ed8',D:'#6b6258',F:'#9c9088'}
const EXP_LABEL = (n:number) => n===0?'Rookie':n===1?'2nd Year':n===2?'3rd Year':`${n} Yrs`
const EXP_COLOR = (n:number) => n===0?'#6d28d9':n<=2?'#1d4ed8':'#5c554e'

// Salary range based on OVR
function salaryRange(ovr: number): string {
  if (ovr >= 90) return '$30M – $45M'
  if (ovr >= 85) return '$20M – $30M'
  if (ovr >= 80) return '$12M – $20M'
  if (ovr >= 75) return '$8M – $14M'
  if (ovr >= 70) return '$5M – $10M'
  if (ovr >= 65) return '$3M – $6M'
  if (ovr >= 60) return '$1.5M – $4M'
  return '$1M – $2.5M'
}

const ATTR_GROUPS = [
  {label:'Scoring',   color:'#b45309', attrs:['usage','three','layup','dunk','mid','ft','siq','draw_foul']},
  {label:'Defense',   color:'#15803d', attrs:['blk','stl','idef','pdef']},
  {label:'Playmaking',color:'#1d4ed8', attrs:['ball_hdl','pass_vis','pass_iq','assist_role']},
  {label:'Physical',  color:'#6d28d9', attrs:['stamina','durability','def_reb','off_reb']},
  {label:'Mental',    color:'#c2410c', attrs:['pressure','consistency','crowd_effect']},
]
const ATTR_LABEL: Record<string,string> = {
  usage:'Usage',three:'3PT',layup:'Layup',dunk:'Dunk',mid:'Mid',ft:'FT',siq:'Shot IQ',draw_foul:'Draw Foul',
  blk:'Block',stl:'Steal',idef:'Int. Def',pdef:'Per. Def',
  ball_hdl:'Ball Hdl',pass_vis:'Pass Vis',pass_iq:'Pass IQ',assist_role:'Ast Role',
  stamina:'Stamina',durability:'Durability',def_reb:'D. Reb',off_reb:'O. Reb',
  pressure:'Clutch',consistency:'Consist.',crowd_effect:'Crowd',
}

function AttrBar({value,color}:{value:number,color:string}) {
  const pct = Math.min(100, value||0)
  const c = value>=85?'#b45309':value>=70?color:value>=50?color+'aa':'#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'#e2dcd5'}}>
        <div style={{width:pct+'%',height:'100%',background:c,borderRadius:3}}/>
      </div>
      <span className="text-xs font-bold w-6 text-right" style={{color:c,fontSize:10}}>{value||0}</span>
    </div>
  )
}

function PlayerCard({p}:{p:any}) {
  const ovr = calcOvr(p)
  const oc = ovrColor(ovr)
  const gp = p.stats?.games||0
  const avg = (v:number) => gp>0?(v/gp).toFixed(1):'—'
  return (
    <div className="rounded-2xl overflow-hidden" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'3px solid '+oc}}>
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{background:oc+'15',border:'1.5px solid '+oc+'33'}}>
          {p.photo_url
            ?<img src={p.photo_url} alt="" className="w-full h-full object-cover rounded-xl"/>
            :<span className="text-xl font-black" style={{color:oc}}>{p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/player/${p.id}`} className="no-underline hover:underline">
            <div className="font-bold text-base leading-tight" style={{color:'#1a1512'}}>{p.name}</div>
          </Link>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{background:'#e8e2d8',color:'#3d3731'}}>{p.pos}</span>
            <span className="text-xs" style={{color:'#8a8279'}}>Age {p.age||'—'}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{background:EXP_COLOR(p.nba_experience)+'18',color:EXP_COLOR(p.nba_experience)}}>
              {EXP_LABEL(p.nba_experience??1)}
            </span>
          </div>
        </div>
        <div className="text-center flex-shrink-0">
          <div className="text-2xl font-black" style={{color:oc}}>{ovr}</div>
          <div className="text-xs font-bold" style={{color:oc}}>OVR</div>
          <div className="text-xs mt-0.5 font-bold" style={{color:POT_COLOR[p.potential_grade]||'#8a8279'}}>
            {p.potential_grade} POT
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {gp > 0 && (
        <div className="px-4 pb-3 flex gap-4">
          {[{v:avg(p.stats.pts),l:'PPG',c:'#b45309'},{v:avg(p.stats.reb),l:'RPG',c:'#15803d'},{v:avg(p.stats.ast),l:'APG',c:'#1d4ed8'},{v:avg(p.stats.stl),l:'SPG',c:'#6d28d9'},{v:avg(p.stats.blk),l:'BPG',c:'#c2410c'}].map(s=>(
            <div key={s.l} className="text-center">
              <div className="text-sm font-black" style={{color:s.c}}>{s.v}</div>
              <div className="text-xs" style={{color:'#9c9088',fontSize:9}}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Attributes */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {ATTR_GROUPS.map(g=>(
          <div key={g.label}>
            <div className="text-xs font-bold mb-1" style={{color:g.color,fontSize:9,letterSpacing:'0.5px'}}>{g.label.toUpperCase()}</div>
            {g.attrs.map(a=>(
              <div key={a} className="flex items-center gap-1 mb-0.5">
                <span className="w-12 flex-shrink-0" style={{fontSize:9,color:'#8a8279'}}>{ATTR_LABEL[a]}</span>
                <AttrBar value={p[a]||0} color={g.color}/>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Salary ask + action */}
      <div className="px-4 py-3 flex items-center justify-between"
           style={{borderTop:'1px solid #e2dcd5',background:'#f5f1eb'}}>
        <div>
          <div className="text-xs" style={{color:'#8a8279'}}>Estimated ask</div>
          <div className="text-sm font-bold" style={{color:'#1a1512'}}>{salaryRange(ovr)}</div>
        </div>
        <Link href={`/player/${p.id}`}
              className="text-xs font-bold px-4 py-2 rounded-lg no-underline"
              style={{background:'#c8102e',color:'#fff'}}>
          Full Profile →
        </Link>
      </div>
    </div>
  )
}

export default function FreeAgentsPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pos, setPos]         = useState('All')
  const [sortBy, setSortBy]   = useState('ovr')
  const [search, setSearch]   = useState('')
  const [maxAge, setMaxAge]   = useState(42)
  const [view, setView]       = useState<'cards'|'table'>('table')

  useEffect(()=>{
    supabase.from('players')
      .select('*,player_stats!left(pts,reb,ast,stl,blk,games,season)')
      .is('team_id',null)
      .eq('status','active')
      .then(({data})=>{
        const withStats = (data||[]).map((p:any)=>{
          const s = (p.player_stats||[]).find((s:any)=>s.season==='2025-26')
          return {...p, stats:s||null}
        })
        setPlayers(withStats)
        setLoading(false)
      })
  },[])

  const filtered = players
    .filter(p=>pos==='All'||p.pos===pos)
    .filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p=>(p.age||25)<=maxAge)
    .map(p=>({...p,_ovr:calcOvr(p)}))
    .sort((a,b)=>{
      if(sortBy==='ovr')    return b._ovr-a._ovr
      if(sortBy==='age')    return (a.age||25)-(b.age||25)
      if(sortBy==='salary') return b._ovr-a._ovr // use OVR as proxy
      if(sortBy==='pts')    return ((b.stats?.pts||0)/(b.stats?.games||1))-((a.stats?.pts||0)/(a.stats?.games||1))
      if(sortBy==='reb')    return ((b.stats?.reb||0)/(b.stats?.games||1))-((a.stats?.reb||0)/(a.stats?.games||1))
      if(sortBy==='ast')    return ((b.stats?.ast||0)/(b.stats?.games||1))-((a.stats?.ast||0)/(a.stats?.games||1))
      return 0
    })

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-4">
        <span className="sec-title">
          <i className="ti ti-user-plus" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          Free Agents — 2025-26
        </span>
        <span className="text-sm font-semibold" style={{color:'#8a8279'}}>
          {loading?'Loading…':`${filtered.length} players available`}
        </span>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-end"
           style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div className="flex-1 min-w-36">
          <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Search</label>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Player name..."
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Position</label>
          <div className="flex gap-1">
            {POSITIONS.map(p=>(
              <button key={p} onClick={()=>setPos(p)}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
                style={{background:pos===p?'#1a1512':'#f0ece5',color:pos===p?'#fff':'#5c554e',border:'1px solid '+(pos===p?'#1a1512':'#d4cdc5')}}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Sort</label>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
            {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Max Age: {maxAge}</label>
          <input type="range" min={18} max={45} value={maxAge} onChange={e=>setMaxAge(+e.target.value)} className="w-28"/>
        </div>
        <div className="flex gap-1">
          {(['table','cards'] as const).map(v=>(
            <button key={v} onClick={()=>setView(v)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{background:view===v?'#1a1512':'#f0ece5',color:view===v?'#fff':'#5c554e',border:'1px solid '+(view===v?'#1a1512':'#d4cdc5')}}>
              <i className={`ti ${v==='table'?'ti-table':'ti-layout-grid'}`} style={{fontSize:13}}></i>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{color:'#8a8279'}}>Loading free agents...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12" style={{color:'#8a8279'}}>
          <i className="ti ti-user-off" style={{fontSize:40,color:'#d4cdc5'}}></i>
          <p className="mt-3">No players match your filters.</p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p:any)=><PlayerCard key={p.id} p={p}/>)}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                  {['Player','Pos','Age','Exp','OVR','POT','PPG','RPG','APG','Salary Ask',''].map(h=>(
                    <th key={h} className="px-3 py-2.5 text-left"
                        style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',whiteSpace:'nowrap'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p:any,i:number)=>{
                  const ovr=p._ovr; const oc=ovrColor(ovr)
                  const gp=p.stats?.games||0; const avg=(v:number)=>gp>0?(v/gp).toFixed(1):'—'
                  return (
                    <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <td className="px-3 py-2.5">
                        <Link href={`/player/${p.id}`} className="no-underline font-semibold hover:underline" style={{color:'#1a1512'}}>{p.name}</Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{background:'#e8e2d8',color:'#3d3731'}}>{p.pos}</span>
                      </td>
                      <td className="px-3 py-2.5 text-sm" style={{color:'#5c554e'}}>{p.age||'—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-semibold" style={{color:EXP_COLOR(p.nba_experience??1)}}>{EXP_LABEL(p.nba_experience??1)}</span>
                      </td>
                      <td className="px-3 py-2.5"><span className="font-black" style={{color:oc}}>{ovr}</span></td>
                      <td className="px-3 py-2.5"><span className="font-black text-sm" style={{color:POT_COLOR[p.potential_grade]||'#8a8279'}}>{p.potential_grade||'—'}</span></td>
                      <td className="px-3 py-2.5 font-semibold" style={{color:'#b45309'}}>{avg(p.stats?.pts||0)}</td>
                      <td className="px-3 py-2.5" style={{color:'#15803d'}}>{avg(p.stats?.reb||0)}</td>
                      <td className="px-3 py-2.5" style={{color:'#1d4ed8'}}>{avg(p.stats?.ast||0)}</td>
                      <td className="px-3 py-2.5 font-semibold text-sm" style={{color:'#1a1512'}}>{salaryRange(ovr)}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/player/${p.id}`} className="text-xs font-bold px-3 py-1.5 rounded-lg no-underline" style={{background:'#c8102e',color:'#fff'}}>View</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

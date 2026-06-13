'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcOvr } from '@/lib/ovr'
import { ovrColor } from '@/lib/ovr'

const POSITIONS = ['All','PG','SG','SF','PF','C']
const SORT_OPTIONS = [
  { value:'ovr',    label:'OVR' },
  { value:'salary', label:'Salary' },
  { value:'age',    label:'Age' },
  { value:'pts',    label:'Points' },
  { value:'reb',    label:'Rebounds' },
  { value:'ast',    label:'Assists' },
]

export default function FreeAgentsPage() {
  const [players, setPlayers]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [pos, setPos]           = useState('All')
  const [sortBy, setSortBy]     = useState('ovr')
  const [search, setSearch]     = useState('')
  const [maxAge, setMaxAge]     = useState(40)

  useEffect(() => {
    supabase
      .from('players')
      .select('*, player_stats(pts,reb,ast,stl,blk,games,season)')
      .is('team_id', null)
      .eq('status','active')
      .then(({ data }) => {
        setPlayers(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = players
    .filter(p => pos === 'All' || p.pos === pos)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => (p.age || 25) <= maxAge)
    .map(p => {
      const ovr = calcOvr(p)
      const curStats = (p.player_stats || []).find((s:any) => s.season === '2025-26')
      return { ...p, ovr, curStats }
    })
    .sort((a,b) => {
      if (sortBy === 'ovr')    return b.ovr - a.ovr
      if (sortBy === 'salary') return (b.salary||0) - (a.salary||0)
      if (sortBy === 'age')    return (a.age||25) - (b.age||25)
      if (sortBy === 'pts')    return ((b.curStats?.pts||0)/(b.curStats?.games||1)) - ((a.curStats?.pts||0)/(a.curStats?.games||1))
      if (sortBy === 'reb')    return ((b.curStats?.reb||0)/(b.curStats?.games||1)) - ((a.curStats?.reb||0)/(a.curStats?.games||1))
      if (sortBy === 'ast')    return ((b.curStats?.ast||0)/(b.curStats?.games||1)) - ((a.curStats?.ast||0)/(a.curStats?.games||1))
      return 0
    })

  const potColor: Record<string,string> = {A:'#c8102e',B:'#b45309',C:'#1d4ed8',D:'#6b6258',F:'#9c9088'}

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-12 text-center" style={{color:'#5c554e'}}>
      Loading free agents...
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-6">
        <span className="sec-title">
          <i className="ti ti-user-plus" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          Free Agents — 2025-26
        </span>
        <span className="text-sm font-semibold" style={{color:'#8a8279'}}>
          {filtered.length} players available
        </span>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-end"
           style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        {/* Search */}
        <div className="flex-1 min-w-40">
          <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Search</label>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Player name..."
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        </div>
        {/* Position */}
        <div>
          <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Position</label>
          <div className="flex gap-1">
            {POSITIONS.map(p=>(
              <button key={p} onClick={()=>setPos(p)}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
                style={{background:pos===p?'#1a1512':'#f0ece5',color:pos===p?'#fff':'#5c554e',
                        border:'1px solid '+(pos===p?'#1a1512':'#d4cdc5')}}>
                {p}
              </button>
            ))}
          </div>
        </div>
        {/* Sort */}
        <div>
          <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Sort by</label>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
            {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {/* Max age */}
        <div>
          <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>Max Age: {maxAge}</label>
          <input type="range" min={18} max={45} value={maxAge} onChange={e=>setMaxAge(+e.target.value)}
            className="w-28"/>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12" style={{color:'#8a8279'}}>
          <i className="ti ti-user-off" style={{fontSize:40,color:'#d4cdc5'}}></i>
          <p className="mt-3">No players match your filters.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                  <th className="px-4 py-2.5 text-left" style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>Player</th>
                  <th className="px-3 py-2.5 text-center" style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>Pos</th>
                  <th className="px-3 py-2.5 text-center" style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>Age</th>
                  <th className="px-3 py-2.5 text-center" style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>OVR</th>
                  <th className="px-3 py-2.5 text-center" style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>POT</th>
                  <th className="px-3 py-2.5 text-right" style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>PPG</th>
                  <th className="px-3 py-2.5 text-right" style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>RPG</th>
                  <th className="px-3 py-2.5 text-right" style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>APG</th>
                  <th className="px-4 py-2.5 text-right" style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>Salary Ask</th>
                  <th className="px-4 py-2.5 text-center" style={{color:'#5c554e',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i) => {
                  const oc = ovrColor(p.ovr)
                  const gp = p.curStats?.games || 0
                  const avg = (v:number) => gp>0?(v/gp).toFixed(1):'—'
                  const salaryAsk = p.salary
                    ? '$'+(p.salary/1000000).toFixed(1)+'M'
                    : '$'+(Math.max(1,(p.ovr-50)*0.15)).toFixed(1)+'M'
                  return (
                    <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <td className="px-4 py-2.5">
                        <Link href={`/player/${p.id}`} className="no-underline font-semibold hover:underline"
                              style={{color:'#1a1512'}}>{p.name}</Link>
                        {p.nba_experience===0 && <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-bold" style={{background:'#6d28d9',color:'#fff',fontSize:9}}>R</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                              style={{background:'#e8e2d8',color:'#3d3731'}}>{p.pos}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-sm" style={{color:'#5c554e'}}>{p.age||'—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-black text-sm" style={{color:oc}}>{p.ovr}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs font-black" style={{color:potColor[p.potential_grade]||'#8a8279'}}>
                          {p.potential_grade||'—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm font-semibold" style={{color:'#b45309'}}>{avg(p.curStats?.pts||0)}</td>
                      <td className="px-3 py-2.5 text-right text-sm" style={{color:'#15803d'}}>{avg(p.curStats?.reb||0)}</td>
                      <td className="px-3 py-2.5 text-right text-sm" style={{color:'#1d4ed8'}}>{avg(p.curStats?.ast||0)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-sm" style={{color:'#1a1512'}}>{salaryAsk}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Link href={`/player/${p.id}`}
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
          <div className="px-4 py-2 text-xs" style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5',color:'#8a8279'}}>
            R = Rookie · POT = Potential Grade · Stats from current season if available
          </div>
        </div>
      )}
    </div>
  )
}

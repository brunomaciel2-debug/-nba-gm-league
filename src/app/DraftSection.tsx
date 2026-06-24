'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type DraftTab = 'class' | 'mock' | 'results'

const POS_COLOR: Record<string, string> = {
  PG: '#1d4ed8', SG: '#6d28d9', SF: '#15803d', PF: '#b45309', C: '#dc2626',
}

export default function DraftSection() {
  const [isCommissioner, setIsCommissioner] = useState(false)

  const [tab, setTab] = useState<DraftTab>('class')
  const [prospects, setProspects] = useState<any[]>([])
  const [standings, setStandings] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [teams, setTeams] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const NEXT_DRAFT = '2027'

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data: gm } = await supabase.from('gm_profiles').select('role').eq('id', user.id).single()
        if (gm?.role === 'commissioner') setIsCommissioner(true)
      }
    })

    Promise.all([
      supabase.from('prospects').select('*').eq('season', NEXT_DRAFT).order('overall', { ascending: false }),
      supabase.from('teams').select('id,name,logo_url,color,wins,losses,conference').not('id','in','(ALL,RVS,ROO,SOP)'),
      supabase.from('draft_results').select('*, prospects(*), teams(id,name,logo_url,color)').eq('season', NEXT_DRAFT).order('pick_number'),
    ]).then(([{ data: p }, { data: t }, { data: r }]) => {
      setProspects(p || [])
      // Ordenar por wins (pior primeiro = escolhe primeiro)
      const sorted = [...(t || [])].sort((a, b) => a.wins - b.wins || b.losses - a.losses)
      setStandings(sorted)
      const map: Record<string, any> = {}
      for (const team of (t || [])) map[team.id] = team
      setTeams(map)
      setResults(r || [])
      setLoading(false)
    })
  }, [])

  // Mock draft — cruzar standings com prospects
  const mockDraft = standings.slice(0, 30).map((team, i) => ({
    pick: i + 1,
    team,
    prospect: prospects[i] || null,
  }))

  const OVR_COLOR = (ovr: number) =>
    ovr >= 85 ? '#b45309' : ovr >= 75 ? '#15803d' : ovr >= 65 ? '#1d4ed8' : '#5c554e'
  const OVR_BG = (ovr: number) =>
    ovr >= 85 ? '#fef3c7' : ovr >= 75 ? '#dcfce7' : ovr >= 65 ? '#dbeafe' : '#f0ece5'

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="section-header mb-5">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{color:'#1a1612',letterSpacing:'1.5px'}}>
          <i className="ti ti-clipboard-list" style={{fontSize:14,marginRight:6,color:'#b45309'}}></i>
          Draft 2026-27
        </span>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { key: 'class',   label: '🎓 Draft Class' },
          { key: 'mock',    label: '📊 Mock Draft' },
          { key: 'results', label: '🏆 Draft Results' },
        ].map((t: any) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === t.key ? '#1a1512' : '#e8e2d6',
              color: tab === t.key ? '#f5f1eb' : '#5c554e',
              border: '1px solid ' + (tab === t.key ? '#1a1512' : '#d4cdc5'),
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{color:'#8a8279'}}>Loading...</div>
      ) : (
        <>
          {/* ── DRAFT CLASS ── */}
          {tab === 'class' && (
            <div>
              {prospects.length === 0 ? (
                <div className="rounded-2xl p-12 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cdc5'}}>
                  <div className="text-5xl mb-4">🎓</div>
                  <h3 className="text-lg font-black mb-2" style={{color:'#1a1512'}}>Draft Class Not Yet Available</h3>
                  <p className="text-sm" style={{color:'#6b5f4e'}}>
                    The 2026-27 draft class will be revealed closer to the draft date.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                        {['#','Player','Pos','Age','From', ...(isCommissioner?['OVR','Potential']:['Potential']),'Notes'].map((h,i) => (
                          <th key={h} className={`px-3 py-2.5 font-bold text-xs ${i===0?'text-center':i<=2?'text-left':'text-right'}`}
                              style={{color:'#5c554e'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prospects.map((p, i) => (
                        <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                          <td className="px-3 py-2.5 text-center font-black text-xs" style={{color:'#b45309'}}>{i+1}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {p.photo_url
                                ? <img src={p.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"/>
                                : <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black"
                                       style={{background:'#e8e2d6',color:'#5c554e'}}>
                                    {p.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                  </div>
                              }
                              <span className="font-bold" style={{color:'#1a1512'}}>{p.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                                  style={{background:(POS_COLOR[p.pos]||'#5c554e')+'22',color:POS_COLOR[p.pos]||'#5c554e'}}>
                              {p.pos}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right" style={{color:'#6b5f4e'}}>{p.age||'—'}</td>
                          <td className="px-3 py-2.5 text-xs text-right" style={{color:'#6b5f4e'}}>{p.college||p.nationality||'—'}</td>
                          {isCommissioner && (
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-xs font-black px-2 py-0.5 rounded"
                                  style={{background:OVR_BG(p.overall),color:OVR_COLOR(p.overall)}}>
                              {p.overall||'?'}
                            </span>
                          </td>
                          )}
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-xs font-black px-2 py-0.5 rounded"
                                  style={{background:OVR_BG(p.potential),color:OVR_COLOR(p.potential)}}>
                              {p.potential||'?'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right" style={{color:'#8a8279'}}>{p.notes||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── MOCK DRAFT ── */}
          {tab === 'mock' && (
            <div>
              <p className="text-xs mb-4" style={{color:'#6b5f4e'}}>
                Preview baseado na classificação actual. Pior classificado escolhe primeiro. Actualiza automaticamente com os resultados.
              </p>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                        {['Pick','Team','Prospect','Pos',...(isCommissioner?['OVR']:[])].map((h,i) => (
                          <th key={h} className={`px-3 py-2.5 font-bold text-xs ${i<=1?'text-left':'text-right'}`}
                              style={{color:'#5c554e'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mockDraft.map(({ pick, team, prospect }) => (
                        <tr key={pick} style={{background:pick%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                          <td className="px-3 py-2.5 text-center font-black text-sm" style={{color:'#b45309'}}>{pick}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {team.logo_url && <img src={team.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}
                              <span className="font-semibold text-xs" style={{color:'#1a1512'}}>{team.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-xs" style={{color:'#1a1512'}}>
                            {prospect?.name || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {prospect?.pos && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                                    style={{background:(POS_COLOR[prospect.pos]||'#5c554e')+'22',color:POS_COLOR[prospect.pos]||'#5c554e'}}>
                                {prospect.pos}
                              </span>
                            )}
                          </td>
                          {isCommissioner && (
                          <td className="px-3 py-2.5 text-right">
                            {prospect?.overall && (
                              <span className="text-xs font-black px-2 py-0.5 rounded"
                                    style={{background:OVR_BG(prospect.overall),color:OVR_COLOR(prospect.overall)}}>
                                {prospect.overall}
                              </span>
                            )}
                          </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
          )}

          {/* ── DRAFT RESULTS ── */}
          {tab === 'results' && (
            <div>
              {results.length === 0 ? (
                <div className="rounded-2xl p-12 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cdc5'}}>
                  <div className="text-5xl mb-4">🏆</div>
                  <h3 className="text-lg font-black mb-2" style={{color:'#1a1512'}}>Draft Not Yet Completed</h3>
                  <p className="text-sm" style={{color:'#6b5f4e'}}>
                    The official draft results will appear here after the draft takes place.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                        {['Pick','Rnd','Team','Player','Pos','OVR'].map((h,i) => (
                          <th key={h} className={`px-3 py-2.5 font-bold text-xs ${i<=2?'text-left':'text-right'}`}
                              style={{color:'#5c554e'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={r.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                          <td className="px-3 py-2.5 font-black text-sm" style={{color:'#b45309'}}>{r.pick_number}</td>
                          <td className="px-3 py-2.5 text-xs">
                            <span className="font-bold px-1.5 py-0.5 rounded"
                                  style={{background:r.round===1?'#fef3c7':'#dbeafe',color:r.round===1?'#b45309':'#1d4ed8'}}>
                              R{r.round}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {r.teams?.logo_url && <img src={r.teams.logo_url} alt="" className="w-5 h-5 object-contain flex-shrink-0"/>}
                              <span className="text-xs font-semibold" style={{color:'#1a1512'}}>{r.teams?.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-bold text-right" style={{color:'#1a1512'}}>
                            {r.prospects?.name || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {r.prospects?.pos && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                                    style={{background:(POS_COLOR[r.prospects.pos]||'#5c554e')+'22',color:POS_COLOR[r.prospects.pos]||'#5c554e'}}>
                                {r.prospects.pos}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {r.prospects?.overall && (
                              <span className="text-xs font-black px-2 py-0.5 rounded"
                                    style={{background:OVR_BG(r.prospects.overall),color:OVR_COLOR(r.prospects.overall)}}>
                                {r.prospects.overall}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

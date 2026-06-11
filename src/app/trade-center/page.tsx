'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import Link from 'next/link'

type Tab = 'players' | 'staff' | 'tradeblock'

export default function TradeCenterPage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<Tab>('players')
  const [teams, setTeams] = useState<any[]>([])
  const [tradeBlock, setTradeBlock] = useState<any[]>([])
  const [freeStaff, setFreeStaff] = useState<any[]>([])
  const [staffFilter, setStaffFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('*, players(id,name,pos,salary,health,moral,usage)')
        .not('id','in','(ALL,RVS)').order('name'),
      supabase.from('trade_block').select('*, players(id,name,pos,salary,team_id,health), teams(id,name,color,logo_url)')
        .eq('status','available').order('created_at',{ascending:false}),
      supabase.from('coaches').select('*').is('team_id',null).order('role').order('name'),
    ]).then(([{data:ts},{data:tb},{data:fs}]) => {
      setTeams(ts||[])
      setTradeBlock(tb||[])
      setFreeStaff(fs||[])
      setLoading(false)
    })
  }, [])

  const myTeamId = profile?.team_id
  const capFmt = (n:number) => n>=1000000?'$'+(n/1000000).toFixed(1)+'M':'$'+n?.toLocaleString()

  const ROLE_COLORS: Record<string,string> = {
    head_coach:'#ffd040',assistant_coach:'#60a0ff',trainer:'#40e080',physio:'#c040ff'
  }

  const filteredStaff = freeStaff.filter(c =>
    staffFilter==='all' || c.role===staffFilter
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#f0ebe0'}}>🔄 Trade Center</h1>
          <p className="text-sm" style={{color:'#8a7a6a'}}>
            {myTeamId ? `Managing: ${profile?.teams?.name}` : 'Browse trades and staff signings'}
          </p>
        </div>
        {!user && (
          <Link href="/login" className="no-underline px-4 py-2 rounded-lg text-sm font-bold"
                style={{background:'#3a8adf',color:'#fff'}}>Sign In to Trade</Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          {key:'players',    label:'🏀 Player Trades'},
          {key:'staff',      label:'👔 Staff Free Agency'},
          {key:'tradeblock', label:'📋 Trade Block'},
        ].map((t:any)=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{background:tab===t.key?'#3a3228':'#241f18',
                    color:tab===t.key?'#f0ebe0':'#8a7a6a',
                    border:'1px solid '+(tab===t.key?'#5a4a3a':'#3a3228')}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{color:'#8a7a6a'}}>Loading...</div>
      ) : (
        <>
          {/* ── PLAYER TRADES ─────────────────────────── */}
          {tab==='players' && (
            <div>
              <p className="text-xs mb-4" style={{color:'#6a5a4a'}}>
                Click a team to propose a trade. Players on the trade block are highlighted.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(t => {
                  const tc = readableTeamColor(t.color)
                  const isMyTeam = t.id === myTeamId
                  const tbPlayerIds = new Set(tradeBlock.filter(tb=>tb.teams?.id===t.id).map(tb=>tb.players?.id))
                  return (
                    <div key={t.id} className="rounded-xl overflow-hidden"
                         style={{border:'1px solid '+(isMyTeam?tc+'44':'#3a3228')}}>
                      <div className="flex items-center gap-2 px-4 py-2.5"
                           style={{background:'#120f0a',borderBottom:'1px solid #3a3228'}}>
                        {t.logo_url && <img src={t.logo_url} alt="" className="w-5 h-5 object-contain"/>}
                        <span className="font-bold text-sm" style={{color:isMyTeam?tc:'#f0ebe0'}}>{t.name}</span>
                        {isMyTeam && <span className="text-xs ml-auto" style={{color:tc}}>Your Team</span>}
                        {!isMyTeam && user && (
                          <Link href={`/trade-center/propose?to=${t.id}`}
                                className="ml-auto text-xs px-2 py-1 rounded no-underline font-semibold"
                                style={{background:'#1e3a5f',color:'#60a0ff'}}>
                            Propose →
                          </Link>
                        )}
                      </div>
                      <div className="p-3" style={{background:'#1a1610'}}>
                        {(t.players||[]).slice(0,8).map((p:any) => {
                          const onBlock = tbPlayerIds.has(p.id)
                          return (
                            <div key={p.id} className="flex items-center gap-2 py-1.5"
                                 style={{borderBottom:'1px solid #2a2218'}}>
                              <span className="text-xs w-7 flex-shrink-0" style={{color:'#6a5a4a'}}>{p.pos}</span>
                              <span className="text-xs flex-1 font-semibold" style={{color:onBlock?'#ffd040':'#c0b8a8'}}>
                                {p.name}
                                {onBlock && <span className="ml-1 text-xs">📋</span>}
                              </span>
                              <span className="text-xs" style={{color:'#6a5a4a'}}>{capFmt(p.salary)}</span>
                            </div>
                          )
                        })}
                        {(t.players||[]).length > 8 && (
                          <p className="text-xs mt-1 text-center" style={{color:'#4a3a2a'}}>
                            +{(t.players||[]).length-8} more players
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── STAFF FREE AGENCY ──────────────────────── */}
          {tab==='staff' && (
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-xs font-semibold" style={{color:'#8a7a6a'}}>Filter:</span>
                {['all','head_coach','assistant_coach','trainer','physio'].map(f=>(
                  <button key={f} onClick={()=>setStaffFilter(f)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{background:staffFilter===f?'#3a3228':'#241f18',
                            color:staffFilter===f?'#f0ebe0':'#8a7a6a',
                            border:'1px solid '+(staffFilter===f?'#5a4a3a':'#3a3228')}}>
                    {f==='all'?'All':f.replace('_',' ')}
                  </button>
                ))}
                <span className="text-xs ml-auto" style={{color:'#5a4a3a'}}>{filteredStaff.length} available</span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStaff.map(c => {
                  const rc = ROLE_COLORS[c.role]||'#8a7a6a'
                  // AI salary suggestion based on attributes
                  const avgAttr = c.role==='physio'?c.rehab_speed:
                    c.role==='trainer'?Math.round((c.conditioning+c.recovery_boost+c.injury_prevent)/3):
                    Math.round((c.off_adjustment+c.def_adjustment+c.off_development+c.def_development+c.tactical_dev)/5)
                  const suggestedSalary = Math.round((avgAttr/100) * (
                    c.role==='head_coach'?12000000:c.role==='assistant_coach'?3000000:
                    c.role==='trainer'?900000:700000
                  ))

                  return (
                    <div key={c.id} className="rounded-xl p-4"
                         style={{background:'#241f18',border:'1px solid #3a3228',borderTop:'2px solid '+rc}}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-xs font-semibold" style={{color:rc}}>
                            {c.role.replace(/_/g,' ')}
                          </div>
                          <div className="font-bold" style={{color:'#f0ebe0'}}>{c.name}</div>
                          <div className="text-xs" style={{color:'#6a5a4a'}}>{c.nationality}{c.age?` · Age ${c.age}`:''}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs" style={{color:'#8a7a6a'}}>AI Suggestion</div>
                          <div className="text-sm font-bold" style={{color:'#ffa040'}}>{capFmt(suggestedSalary)}/yr</div>
                        </div>
                      </div>

                      {/* Key attributes */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {c.role==='head_coach'&&[
                          ['OA',c.off_adjustment],['DA',c.def_adjustment],
                          ['OD',c.off_development],['DD',c.def_development],['P',c.personality]
                        ].map(([l,v])=>(
                          <div key={l as string} className="rounded px-2 py-0.5 text-xs text-center"
                               style={{background:'#1a1610'}}>
                            <span style={{color:'#8a7a6a'}}>{l} </span>
                            <span className="font-bold" style={{color:rc}}>{v}</span>
                          </div>
                        ))}
                        {c.role==='assistant_coach'&&[
                          ['OA',c.off_adjustment],['OD',c.off_development],['DD',c.def_development]
                        ].map(([l,v])=>(
                          <div key={l as string} className="rounded px-2 py-0.5 text-xs"
                               style={{background:'#1a1610'}}>
                            <span style={{color:'#8a7a6a'}}>{l} </span>
                            <span className="font-bold" style={{color:rc}}>{v}</span>
                          </div>
                        ))}
                        {c.role==='trainer'&&[
                          ['COND',c.conditioning],['REC',c.recovery_boost],['INJ',c.injury_prevent]
                        ].map(([l,v])=>(
                          <div key={l as string} className="rounded px-2 py-0.5 text-xs"
                               style={{background:'#1a1610'}}>
                            <span style={{color:'#8a7a6a'}}>{l} </span>
                            <span className="font-bold" style={{color:rc}}>{v}</span>
                          </div>
                        ))}
                        {c.role==='physio'&&(
                          <div className="rounded px-2 py-0.5 text-xs" style={{background:'#1a1610'}}>
                            <span style={{color:'#8a7a6a'}}>Rehab </span>
                            <span className="font-bold" style={{color:rc}}>{c.rehab_speed}</span>
                          </div>
                        )}
                      </div>

                      {user && myTeamId && (
                        <Link href={`/trade-center/staff-offer?coach=${c.id}`}
                              className="block text-center text-xs font-bold py-2 rounded-lg no-underline"
                              style={{background:rc+'22',color:rc,border:'1px solid '+rc+'44'}}>
                          Make Offer
                        </Link>
                      )}
                    </div>
                  )
                })}
                {filteredStaff.length===0&&(
                  <div className="col-span-3 text-center py-8" style={{color:'#6a5a4a'}}>
                    No free agent staff available in this category.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TRADE BLOCK ─────────────────────────────── */}
          {tab==='tradeblock' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs" style={{color:'#6a5a4a'}}>
                  Players placed on the trade block by their GMs, in chronological order.
                </p>
                {user && myTeamId && (
                  <Link href="/trade-center/manage-block"
                        className="text-xs px-3 py-1.5 rounded-lg no-underline font-semibold"
                        style={{background:'#1e3a5f',color:'#60a0ff'}}>
                    Manage My Block →
                  </Link>
                )}
              </div>
              {tradeBlock.length===0?(
                <div className="rounded-xl p-8 text-center" style={{background:'#241f18',border:'1px solid #3a3228'}}>
                  <p style={{color:'#6a5a4a'}}>No players on the trade block yet.</p>
                </div>
              ):(
                <div className="flex flex-col gap-2">
                  {tradeBlock.map(tb => {
                    const tc = readableTeamColor(tb.teams?.color||'555')
                    return (
                      <div key={tb.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                           style={{background:'#241f18',border:'1px solid #3a3228'}}>
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0"
                             style={{background:tc+'22'}}>
                          {tb.teams?.logo_url
                            ?<img src={tb.teams.logo_url} alt="" className="w-full h-full object-contain p-1"/>
                            :<div className="w-full h-full flex items-center justify-center text-xs font-black"
                                  style={{color:tc}}>{tb.teams?.id?.slice(0,2)}</div>}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold" style={{color:'#f0ebe0'}}>{tb.players?.name}</div>
                          <div className="text-xs" style={{color:'#8a7a6a'}}>
                            {tb.players?.pos} · {tb.teams?.name} · {capFmt(tb.players?.salary)}
                          </div>
                          {tb.notes && <div className="text-xs mt-0.5" style={{color:'#6a5a4a'}}>"{tb.notes}"</div>}
                        </div>
                        <div className="text-xs" style={{color:'#4a3a2a'}}>
                          {new Date(tb.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                        </div>
                        {user && myTeamId !== tb.teams?.id && (
                          <Link href={`/trade-center/propose?to=${tb.teams?.id}&player=${tb.players?.id}`}
                                className="text-xs px-3 py-1.5 rounded-lg no-underline font-semibold flex-shrink-0"
                                style={{background:'#2a2000',color:'#ffd040'}}>
                            Propose Trade
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import Link from 'next/link'

type Tab = 'players' | 'tradeblock'


// ── STAFF TABLE COMPONENT ───────────────────────────────────────

export default function TradeCenterPage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<'players'|'tradeblock'>('players')
  const [teams, setTeams] = useState<any[]>([])
  const [tradeBlock, setTradeBlock] = useState<any[]>([])
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
      setTradeBlock(tb||[])      setLoading(false)
    })
  }, [])

  const myTeamId = profile?.team_id
  const isCommissioner = profile?.role === 'commissioner'
  const capFmt = (n:number) => n>=1000000?'$'+(n/1000000).toFixed(1)+'M':'$'+n?.toLocaleString()

  const ROLE_COLORS: Record<string,string> = {
    head_coach:'#b45309',assistant_coach:'#1d4ed8',trainer:'#15803d',physio:'#6d28d9'
  }    staffFilter==='all' || c.role===staffFilter
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1a1612'}}>🔄 Trade Center</h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>
            {myTeamId ? `Managing: ${profile?.teams?.name}` : 'Browse trades and staff signings'}
          </p>
        </div>
        {!user && (
          <Link href="/login" className="no-underline px-4 py-2 rounded-lg text-sm font-bold"
                style={{background:'#1d4ed8',color:'#e8e2d6'}}>Sign In to Trade</Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          {key:'players',    label:'🏀 Player Trades'},
                    {key:'tradeblock', label:'📋 Trade Block'},
        ].map((t:any)=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{background:tab===t.key?'#d4cdc5':'#ede8df',
                    color:tab===t.key?'#1a1512':'#5c554e',
                    border:'1px solid '+(tab===t.key?'#8a8279':'#d4cdc5')}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{color:'#6b5f4e'}}>Loading...</div>
      ) : (
        <>
          {/* ── PLAYER TRADES ─────────────────────────── */}
          {tab==='players' && (
            <div>
              <p className="text-xs mb-4" style={{color:'#6b5f4e'}}>
                Click a team to propose a trade. Players on the trade block are highlighted.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(t => {
                  const tc = readableTeamColor(t.color)
                  const isMyTeam = myTeamId ? t.id === myTeamId : false
                  const tbPlayerIds = new Set(tradeBlock.filter(tb=>tb.teams?.id===t.id).map(tb=>tb.players?.id))
                  return (
                    <div key={t.id} className="rounded-xl overflow-hidden"
                         style={{border:'1px solid '+(isMyTeam?tc+'55':'#d4cdc5')}}>
                      {/* Team header — clickable */}
                      <Link href={`/team/${t.id}`} className="no-underline">
                        <div className="flex items-center gap-2 px-4 py-3 transition-all hover:brightness-125"
                             style={{background:'#ede8de',borderBottom:tbPlayerIds.size>0?'1px solid #3a3228':'none'}}>
                          {t.logo_url && <img src={t.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}
                          <span className="font-bold text-sm flex-1" style={{color:isMyTeam?tc:'#1a1512'}}>{t.name}</span>
                          {isMyTeam && <span className="text-xs" style={{color:tc}}>Your Team</span>}
                        </div>
                      </Link>
                      {/* Trade block players — only if any */}
                      {tbPlayerIds.size > 0 && (
                        <div className="px-4 py-2" style={{background:'#ddd7ca'}}>
                          <div className="text-xs mb-1.5 font-semibold" style={{color:'#b45309'}}>📋 Trade Block</div>
                          {tradeBlock.filter(tb=>tb.teams?.id===t.id).map((tb:any)=>(
                            <div key={tb.id} className="flex items-center gap-2 py-1"
                                 style={{borderBottom:'1px solid #ddd8ce'}}>
                              <span className="text-xs w-7 flex-shrink-0" style={{color:'#6b5f4e'}}>{tb.players?.pos}</span>
                              <span className="text-xs flex-1 font-semibold" style={{color:'#b45309'}}>{tb.players?.name}</span>
                              <span className="text-xs" style={{color:'#6b5f4e'}}>{capFmt(tb.players?.salary)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Propose button */}
                      {!isMyTeam && user && myTeamId !== t.id && (
                        <div className="px-4 py-2" style={{borderTop:'1px solid #2a2218'}}>
                          <Link href={`/trade-center/propose?to=${t.id}`}
                                className="block text-center text-xs font-semibold py-1.5 rounded-lg no-underline"
                                style={{background:'#1d4ed8',color:'#fff'}}>
                            Propose Trade →
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── STAFF FREE AGENCY ──────────────────────── */}
          {tab==='staff' && (
            <StaffTable
              staff={freeStaff}
              filter={staffFilter}
              setFilter={setStaffFilter}
              user={user}
              myTeamId={myTeamId}
              capFmt={capFmt}
            />
          )}

          {/* ── TRADE BLOCK ─────────────────────────────── */}
          {tab==='tradeblock' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs" style={{color:'#6b5f4e'}}>
                  Players placed on the trade block by their GMs, in chronological order.
                </p>
                {user && myTeamId && (
                  <Link href="/trade-center/manage-block"
                        className="text-xs px-3 py-1.5 rounded-lg no-underline font-semibold"
                        style={{background:'#1d4ed8',color:'#fff'}}>
                    Manage My Block →
                  </Link>
                )}
              </div>
              {tradeBlock.length===0?(
                <div className="rounded-xl p-8 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                  <p style={{color:'#6b5f4e'}}>No players on the trade block yet.</p>
                </div>
              ):(
                <div className="flex flex-col gap-2">
                  {tradeBlock.map(tb => {
                    const tc = readableTeamColor(tb.teams?.color||'555')
                    return (
                      <div key={tb.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                           style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0"
                             style={{background:tc+'22'}}>
                          {tb.teams?.logo_url
                            ?<img src={tb.teams.logo_url} alt="" className="w-full h-full object-contain p-1"/>
                            :<div className="w-full h-full flex items-center justify-center text-xs font-black"
                                  style={{color:tc}}>{tb.teams?.id?.slice(0,2)}</div>}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold" style={{color:'#1a1612'}}>{tb.players?.name}</div>
                          <div className="text-xs" style={{color:'#6b5f4e'}}>
                            {tb.players?.pos} · {tb.teams?.name} · {capFmt(tb.players?.salary)}
                          </div>
                          {tb.notes && <div className="text-xs mt-0.5" style={{color:'#6b5f4e'}}>"{tb.notes}"</div>}
                        </div>
                        <div className="text-xs" style={{color:'#b8ae9e'}}>
                          {new Date(tb.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                        </div>
                        {user && myTeamId !== tb.teams?.id && (
                          <Link href={`/trade-center/propose?to=${tb.teams?.id}&player=${tb.players?.id}`}
                                className="text-xs px-3 py-1.5 rounded-lg no-underline font-semibold flex-shrink-0"
                                style={{background:'#fef3c7',color:'#b45309'}}>
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

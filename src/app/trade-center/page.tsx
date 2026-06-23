'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import Link from 'next/link'

export default function TradeCenterPage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<'players'|'tradeblock'>('players')
  const [teams, setTeams] = useState<any[]>([])
  const [tradeBlock, setTradeBlock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('id,name,color,logo_url,conference,division')
        .not('id','in','(ALL,RVS,ROO,SOP)').order('name'),
      supabase.from('trade_block').select('*, players(id,name,pos,real_ovr,photo_url,team_id), teams(id,name,color,logo_url)')
        .eq('status','available').order('created_at',{ascending:false}),
    ]).then(([{data:ts},{data:tb}]) => {
      setTeams(ts||[])
      setTradeBlock(tb||[])
      setLoading(false)
    })
  }, [])

  const myTeamId = profile?.team_id

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1a1512'}}>🔄 Trade Center</h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>
            {myTeamId ? `Managing: ${(profile as any)?.teams?.name}` : 'Browse trades'}
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
                Selecciona uma equipa para propor uma troca.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(t => {
                  const tc = readableTeamColor(t.color)
                  const isMyTeam = myTeamId ? t.id === myTeamId : false
                  return (
                    <div key={t.id} className="rounded-xl overflow-hidden"
                         style={{border:'1px solid '+(isMyTeam?tc+'55':'#d4cdc5')}}>
                      <Link href={`/team/${t.id}`} className="no-underline">
                        <div className="flex items-center gap-2 px-4 py-3"
                             style={{background:'#ede8de'}}
                             onMouseEnter={e=>(e.currentTarget.style.background='#e2dbd0')}
                             onMouseLeave={e=>(e.currentTarget.style.background='#ede8de')}>
                          {t.logo_url && <img src={t.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0"/>}
                          <span className="font-bold text-sm flex-1" style={{color:isMyTeam?tc:'#1a1512'}}>{t.name}</span>
                          {isMyTeam && <span className="text-xs font-semibold" style={{color:tc}}>Your Team</span>}
                        </div>
                      </Link>
                      {!isMyTeam && user && (
                        <div className="px-4 py-2" style={{background:'#faf8f5',borderTop:'1px solid #e2dcd5'}}>
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

          {/* ── TRADE BLOCK ─────────────────────────────── */}
          {tab==='tradeblock' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs" style={{color:'#6b5f4e'}}>
                  Jogadores disponíveis para troca, por equipa.
                </p>
                {user && myTeamId && (
                  <Link href="/trade-center/manage-block"
                        className="text-xs px-3 py-1.5 rounded-lg no-underline font-semibold"
                        style={{background:'#1d4ed8',color:'#fff'}}>
                    Manage My Block →
                  </Link>
                )}
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(t => {
                  const tc = readableTeamColor(t.color)
                  const tbPlayers = tradeBlock.filter(tb => tb.teams?.id === t.id)
                  const isMyTeam = myTeamId === t.id
                  return (
                    <div key={t.id} className="rounded-xl overflow-hidden"
                         style={{
                           border:'1px solid '+(tbPlayers.length>0?tc+'55':'#e2dcd5'),
                           opacity: tbPlayers.length===0 ? 0.45 : 1,
                         }}>
                      {/* Team header */}
                      <div className="flex items-center gap-2 px-4 py-3"
                           style={{background: tbPlayers.length>0?'#ede8de':'#f5f2ee',
                                   borderBottom: tbPlayers.length>0?'1px solid #e2dcd5':'none'}}>
                        {t.logo_url
                          ? <img src={t.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0"/>
                          : <div className="w-7 h-7 flex-shrink-0"/>
                        }
                        <span className="font-bold text-sm flex-1"
                              style={{color: tbPlayers.length>0?'#1a1512':'#9a9088'}}>
                          {t.name}
                        </span>
                        {tbPlayers.length > 0
                          ? <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                                  style={{background:'#fef3c7',color:'#b45309'}}>
                              {tbPlayers.length} available
                            </span>
                          : <span className="text-xs" style={{color:'#b0a89e'}}>—</span>
                        }
                      </div>

                      {/* Players com foto */}
                      {tbPlayers.length > 0 && (
                        <div style={{background:'#faf8f5'}}>
                          {tbPlayers.map((tb:any) => {
                            const ovr = tb.players?.real_ovr
                            const ovrColor = ovr>=85?'#b45309':ovr>=75?'#15803d':ovr>=65?'#1d4ed8':'#5c554e'
                            const ovrBg = ovr>=85?'#fef3c7':ovr>=75?'#dcfce7':ovr>=65?'#dbeafe':'#f0ece5'
                            return (
                              <Link key={tb.id} href={`/player/${tb.players?.id}`} className="no-underline">
                                <div className="flex items-center gap-3 px-4 py-3"
                                     style={{borderBottom:'1px solid #e8e2d8'}}
                                     onMouseEnter={e=>(e.currentTarget.style.background='#f0ece5')}
                                     onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                                  {/* Foto */}
                                  {tb.players?.photo_url
                                    ? <img src={tb.players.photo_url} alt=""
                                           className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                           style={{border:'2px solid '+tc+'44'}}/>
                                    : <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black"
                                           style={{background:tc+'22',color:tc}}>
                                        {tb.players?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                      </div>
                                  }
                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate" style={{color:'#1a1512'}}>
                                      {tb.players?.name}
                                    </div>
                                    <div className="text-xs" style={{color:'#6b5f4e'}}>
                                      {tb.players?.pos}
                                    </div>
                                  </div>
                                  {/* OVR */}
                                  {ovr && (
                                    <div className="flex flex-col items-center justify-center rounded-lg px-2 py-1 flex-shrink-0"
                                         style={{background:ovrBg,border:'1px solid '+ovrColor+'44'}}>
                                      <span className="text-sm font-black" style={{color:ovrColor}}>{ovr}</span>
                                      <span className="text-xs" style={{color:ovrColor,fontSize:8}}>OVR</span>
                                    </div>
                                  )}
                                </div>
                              </Link>
                            )
                          })}
                          {/* Propose trade */}
                          {user && !isMyTeam && (
                            <div className="px-4 py-2" style={{borderTop:'1px solid #e2dcd5',background:'#f5f1eb'}}>
                              <Link href={`/trade-center/propose?to=${t.id}`}
                                    className="block text-center text-xs font-semibold py-1.5 rounded-lg no-underline"
                                    style={{background:'#1d4ed8',color:'#fff'}}>
                                Propose Trade →
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

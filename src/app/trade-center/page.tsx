'use client'
import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import Link from 'next/link'
import PendingTradesPanel from './PendingTradesPanel'
import TradeDetailModal from './TradeDetailModal'

function TradeCenterPageInner() {
  const { user, profile } = useAuth()
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const searchParams = useSearchParams()
  const router = useRouter()
  const reviewProposalId = searchParams.get('proposal')
  const [tab, setTab] = useState<'players'|'tradeblock'|'pending'>('players')
  const [teams, setTeams] = useState<any[]>([])
  const [tradeBlock, setTradeBlock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('id,name,color,logo_url,conference,division')
        .not('id','in','(ALL,RVS,ROO,SOP)').order('name'),
      supabase.from('trade_block').select('*, players(id,name,pos,real_ovr,photo_url,team_id), teams(id,name,color,logo_url)')
        .eq('status','available').order('created_at',{ascending:false}),
    ]).then(([{data:ts},{data:tb}]) => {
      setTeams(ts||[]); setTradeBlock(tb||[]); setLoading(false)
    })
  }, [])

  const myTeamId = profile?.team_id

  useEffect(() => {
    if (!myTeamId) return
    supabase.from('trade_proposal_teams').select('*, trade_proposals(status,initiator_team)').eq('team_id', myTeamId)
      .then(({ data }) => {
        const pending = (data || []).filter((e: any) => e.trade_proposals?.status === 'pending' && e.trade_proposals?.initiator_team !== myTeamId)
        setPendingCount(pending.length)
        if (pending.length > 0) setTab('pending')
      })
  }, [myTeamId])

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1a1512'}}>🔄 Trade Center</h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>
            {myTeamId ? `${isPT?'A gerir':'Managing'}: ${(profile as any)?.teams?.name}` : (isPT?'Ver trades':'Browse trades')}
          </p>
        </div>
        {!user && (
          <Link href="/login" className="no-underline px-4 py-2 rounded-lg text-sm font-bold"
                style={{background:'#1d4ed8',color:'#e8e2d6'}}>
            {isPT?'Entrar para Negociar':'Sign In to Trade'}
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          ...(myTeamId ? [{key:'pending', labelEN:`🔔 Pending Trades${pendingCount>0?` (${pendingCount})`:''}`, labelPT:`🔔 Trocas Pendentes${pendingCount>0?` (${pendingCount})`:''}`}] : []),
          {key:'players',    labelEN:'🏀 Player Trades',  labelPT:'🏀 Trades de Jogadores'},
          {key:'tradeblock', labelEN:'📋 Trade Block',    labelPT:'📋 Trade Block'},
        ].map((t:any)=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{background:tab===t.key?(t.key==='pending'&&pendingCount>0?'#fee2e2':'#d4cdc5'):'#ede8df',
                    color:tab===t.key?(t.key==='pending'&&pendingCount>0?'#dc2626':'#1a1512'):'#5c554e',
                    border:'1px solid '+(tab===t.key?(t.key==='pending'&&pendingCount>0?'#fca5a5':'#8a8279'):'#d4cdc5')}}>
            {isPT ? t.labelPT : t.labelEN}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{color:'#6b5f4e'}}>{t('common.loading')}</div>
      ) : (
        <>
          {tab==='pending' && myTeamId && (
            <div>
              <p className="text-xs mb-4" style={{color:'#6b5f4e'}}>
                {isPT ? 'Trocas que outras equipas te propuseram — aceita ou recusa.' : 'Trades other teams have proposed to you — accept or reject.'}
              </p>
              <PendingTradesPanel teamId={myTeamId} />
            </div>
          )}
          {tab==='players' && (
            <div>
              <p className="text-xs mb-4" style={{color:'#6b5f4e'}}>
                {isPT ? 'Seleciona uma equipa para propor uma trade.' : 'Select a team to propose a trade.'}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(tm => {
                  const tc = readableTeamColor(tm.color)
                  const isMyTeam = myTeamId ? tm.id === myTeamId : false
                  return (
                    <div key={tm.id} className="rounded-xl overflow-hidden"
                         style={{border:'1px solid '+(isMyTeam?tc+'55':'#d4cdc5')}}>
                      <Link href={`/team/${tm.id}`} className="no-underline">
                        <div className="flex items-center gap-2 px-4 py-3" style={{background:'#ede8de'}}
                             onMouseEnter={e=>(e.currentTarget.style.background='#e2dbd0')}
                             onMouseLeave={e=>(e.currentTarget.style.background='#ede8de')}>
                          {tm.logo_url && <img src={tm.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0"/>}
                          <span className="font-bold text-sm flex-1" style={{color:isMyTeam?tc:'#1a1512'}}>{tm.name}</span>
                          {isMyTeam && <span className="text-xs font-semibold" style={{color:tc}}>{isPT?'A Minha Equipa':'Your Team'}</span>}
                        </div>
                      </Link>
                      {!isMyTeam && user && (
                        <div className="px-4 py-2" style={{background:'#faf8f5',borderTop:'1px solid #e2dcd5'}}>
                          <Link href={`/trade-center/propose?to=${tm.id}`}
                                className="block text-center text-xs font-semibold py-1.5 rounded-lg no-underline"
                                style={{background:'#1d4ed8',color:'#fff'}}>
                            {isPT?'Propor Trade →':'Propose Trade →'}
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab==='tradeblock' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs" style={{color:'#6b5f4e'}}>
                  {isPT?'Jogadores disponíveis para trade, por equipa.':'Players available for trade, by team.'}
                </p>
                {user && myTeamId && (
                  <Link href="/trade-center/manage-block"
                        className="text-xs px-3 py-1.5 rounded-lg no-underline font-semibold"
                        style={{background:'#1d4ed8',color:'#fff'}}>
                    {isPT?'Gerir o Meu Block →':'Manage My Block →'}
                  </Link>
                )}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(tm => {
                  const tc = readableTeamColor(tm.color)
                  const tbPlayers = tradeBlock.filter(tb => tb.teams?.id === tm.id)
                  const isMyTeam = myTeamId === tm.id
                  return (
                    <div key={tm.id} className="rounded-xl overflow-hidden"
                         style={{border:'1px solid '+(tbPlayers.length>0?tc+'55':'#e2dcd5'),opacity:tbPlayers.length===0?0.45:1}}>
                      <div className="flex items-center gap-2 px-4 py-3"
                           style={{background:tbPlayers.length>0?'#ede8de':'#f5f2ee',borderBottom:tbPlayers.length>0?'1px solid #e2dcd5':'none'}}>
                        {tm.logo_url?<img src={tm.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0"/>:<div className="w-7 h-7 flex-shrink-0"/>}
                        <span className="font-bold text-sm flex-1" style={{color:tbPlayers.length>0?'#1a1512':'#9a9088'}}>{tm.name}</span>
                        {tbPlayers.length>0
                          ?<span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{background:'#fef3c7',color:'#b45309'}}>
                            {tbPlayers.length} {isPT?'disponíveis':'available'}
                           </span>
                          :<span className="text-xs" style={{color:'#b0a89e'}}>—</span>}
                      </div>
                      {tbPlayers.length>0&&(
                        <div style={{background:'#faf8f5'}}>
                          {tbPlayers.map((tb:any)=>{
                            const ovr=tb.players?.real_ovr
                            const ovrColor=ovr>=85?'#b45309':ovr>=75?'#15803d':ovr>=65?'#1d4ed8':'#5c554e'
                            const ovrBg=ovr>=85?'#fef3c7':ovr>=75?'#dcfce7':ovr>=65?'#dbeafe':'#f0ece5'
                            return (
                              <Link key={tb.id} href={`/player/${tb.players?.id}`} className="no-underline">
                                <div className="flex items-center gap-3 px-4 py-3" style={{borderBottom:'1px solid #e8e2d8'}}
                                     onMouseEnter={e=>(e.currentTarget.style.background='#f0ece5')}
                                     onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                                  {tb.players?.photo_url
                                    ?<img src={tb.players.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{border:'2px solid '+tc+'44'}}/>
                                    :<div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black" style={{background:tc+'22',color:tc}}>
                                       {tb.players?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                     </div>}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate" style={{color:'#1a1512'}}>{tb.players?.name}</div>
                                    <div className="text-xs" style={{color:'#6b5f4e'}}>{tb.players?.pos}</div>
                                  </div>
                                  {ovr&&<div className="flex flex-col items-center justify-center rounded-lg px-2 py-1 flex-shrink-0" style={{background:ovrBg,border:'1px solid '+ovrColor+'44'}}>
                                    <span className="text-sm font-black" style={{color:ovrColor}}>{ovr}</span>
                                    <span className="text-xs" style={{color:ovrColor,fontSize:8}}>OVR</span>
                                  </div>}
                                </div>
                              </Link>
                            )
                          })}
                          {user&&!isMyTeam&&(
                            <div className="px-4 py-2" style={{borderTop:'1px solid #e2dcd5',background:'#f5f1eb'}}>
                              <Link href={`/trade-center/propose?to=${tm.id}`}
                                    className="block text-center text-xs font-semibold py-1.5 rounded-lg no-underline"
                                    style={{background:'#1d4ed8',color:'#fff'}}>
                                {isPT?'Propor Trade →':'Propose Trade →'}
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

      {reviewProposalId && (
        <TradeDetailModal proposalId={reviewProposalId} isPT={isPT} onClose={() => router.push('/trade-center')} />
      )}
    </div>
  )
}

export default function TradeCenterPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-6" style={{color:'#6b5f4e'}}>Loading...</div>}>
      <TradeCenterPageInner />
    </Suspense>
  )
}

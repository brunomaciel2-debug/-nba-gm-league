'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import { formatSimDate } from '@/lib/season-week-helper'
import { readableTeamColorOnDark } from '@/lib/color'

const TYPE_ACCENT: Record<string,string> = {
  trade:      '#fb923c',
  signing:    '#4ade80',
  waiver:     '#c4b5fd',
  suspension: '#facc15',
  extension:  '#38bdf8',
  retirement: '#f59e0b',
  gleague_assign: '#22d3ee',
  gleague_recall: '#22d3ee',
}

export default function TransactionsPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [txs,setTxs] = useState<any[]>([])
  const [teamMap,setTeamMap] = useState<Record<string,any>>({})
  const [gleagueTeamMap,setGleagueTeamMap] = useState<Record<string,any>>({})
  const [playerPhotos,setPlayerPhotos] = useState<Record<string,string>>({})
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    // Injuries have their own dedicated Injury Center (/injuries) now — this
    // feed is only about roster/staff movement (entries, exits, trades).
    supabase.from('transactions').select('*').neq('type','injury').order('created_at',{ascending:false}).limit(100)
      .then(async ({data})=>{
        const list = data||[]
        setTxs(list)
        const [{data:teams},{data:glTeams}] = await Promise.all([
          supabase.from('teams').select('id,name,logo_url,color'),
          supabase.from('gleague_teams').select('id,name,logo_url,color'),
        ])
        const tMap: Record<string,any> = {}
        ;(teams||[]).forEach((tm:any)=>{ tMap[tm.id]=tm })
        setTeamMap(tMap)
        const glMap: Record<string,any> = {}
        ;(glTeams||[]).forEach((tm:any)=>{ glMap[tm.id]=tm })
        setGleagueTeamMap(glMap)

        const playerIds = Array.from(new Set(list.flatMap((tx:any)=>tx.player_ids||[]).filter(Boolean)))
        if (playerIds.length) {
          const {data:players} = await supabase.from('players').select('id,photo_url').in('id',playerIds)
          const pMap: Record<string,string> = {}
          ;(players||[]).forEach((p:any)=>{ if(p.photo_url) pMap[p.id]=p.photo_url })
          setPlayerPhotos(pMap)
        }
        setLoading(false)
      })
  },[])

  // Resolves a structured details.from/details.to endpoint (see
  // gleague/assign+recall/route.ts) into a real name/logo/color, whichever
  // table it actually lives in.
  const resolveEndpoint = (ep: {kind:string,id:string|null}|undefined) => {
    if (!ep?.id) return null
    if (ep.kind === 'gleague_team') return gleagueTeamMap[ep.id] || null
    return teamMap[ep.id] || null
  }

  const TYPE_LABELS_PT: Record<string,string> = {
    trade:'Trade',signing:'Contrato',waiver:'Waiver',suspension:'Suspensão',extension:'Renovação',retirement:'Retirada',
    gleague_assign:'G-League ↓',gleague_recall:'G-League ↑'
  }
  const TYPE_LABELS_EN: Record<string,string> = {
    trade:'Trade',signing:'Signing',waiver:'Waiver',suspension:'Suspension',extension:'Extension',retirement:'Retirement',
    gleague_assign:'G-League ↓',gleague_recall:'G-League ↑'
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2" style={{color:'#1a1512'}}>🔄 {isPT?'Transações':'Transactions'}</h1>
      <p className="text-sm mb-6" style={{color:'#6b5f4e'}}>
        {isPT?'Entradas, saídas e trocas de jogadores e staff — actualizado em tempo real.':'Entries, exits and trades of players and staff — updated in real time.'}
      </p>
      {loading?<div className="text-center py-8" style={{color:'#8a8279'}}>{t('common.loading')}</div>
      :txs.length===0?(
        <div className="rounded-xl p-8 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <p style={{color:'#6b5f4e'}}>{isPT?'Sem transações. A liga está sossegada... por agora.':'No transactions yet. The league is quiet... for now.'}</p>
        </div>
      ):(
        <div className="flex flex-col gap-4">
          {txs.map((tx:any)=>{
            const accent = TYPE_ACCENT[tx.type] || '#a78bfa'
            const typeLabel = isPT ? (TYPE_LABELS_PT[tx.type]||tx.type.toUpperCase()) : (TYPE_LABELS_EN[tx.type]||tx.type.toUpperCase())
            const teams = (tx.teams||[]).map((tid:string)=>teamMap[tid]).filter(Boolean)
            const primaryColor = teams[0]?.color ? readableTeamColorOnDark(teams[0].color) : accent
            const players = (tx.players||[]).map((name:string,i:number)=>({ name, id: tx.player_ids?.[i] }))
            // A structured from->to move (currently G-League assign/recall —
            // see gleague/assign+recall/route.ts) gets its own clear
            // logo-to-logo arrow instead of the generic avatar-stack layout,
            // so "which direction did this actually go" reads at a glance
            // instead of only living in the description text.
            const fromEndpoint = resolveEndpoint(tx.details?.from)
            const toEndpoint = resolveEndpoint(tx.details?.to)
            const hasFlow = !!(fromEndpoint && toEndpoint)
            return(
              <div key={tx.id} className="relative overflow-hidden rounded-2xl"
                style={{
                  background:`linear-gradient(120deg, ${primaryColor}22 0%, #140f24 28%, #140f24 72%, ${accent}18 100%), repeating-linear-gradient(115deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 14px), #140f24`,
                  border:'1px solid rgba(255,255,255,0.08)',
                  boxShadow:`0 10px 30px -12px ${primaryColor}55, inset 0 1px 0 rgba(255,255,255,0.05)`,
                }}>
                {/* Top accent beam — bright, futuristic, keyed to the transaction type */}
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{background:`linear-gradient(90deg, transparent, ${accent}, transparent)`, boxShadow:`0 0 16px 1px ${accent}aa`}}/>

                {hasFlow && (()=>{
                  // Player-in-the-middle layout: FROM logo -> arrow -> PLAYER
                  // photo (the largest, dominant element — the actual subject
                  // of the move) -> arrow -> TO logo. Every team logo sits on
                  // a plain light circle (never the team's own color) so a
                  // logo that happens to share the team's accent hue (very
                  // common — most crests ARE the team color) never blends
                  // into its own backdrop the way a color-tinted circle did.
                  const player = players[0]
                  const Arrow = () => (
                    <div className="flex items-center flex-1" style={{minWidth:24,maxWidth:56}}>
                      <div className="flex-1 h-[2px]" style={{background:`linear-gradient(90deg, transparent, ${accent})`}}/>
                      <div style={{width:0,height:0,borderTop:'5px solid transparent',borderBottom:'5px solid transparent',borderLeft:`8px solid ${accent}`,filter:`drop-shadow(0 0 4px ${accent}aa)`}}/>
                    </div>
                  )
                  const TeamBadge = ({ep}:{ep:any}) => {
                    const epColor = ep.color ? readableTeamColorOnDark(ep.color) : accent
                    return (
                      <div className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{width:72}}>
                        <div className="rounded-full flex items-center justify-center" style={{width:56,height:56,background:'#f5f1eb',border:`2.5px solid ${epColor}`,boxShadow:`0 0 14px 1px ${epColor}77`}}>
                          {ep.logo_url?<img src={ep.logo_url} alt="" className="w-9 h-9 object-contain"/>:<span className="text-lg">🏀</span>}
                        </div>
                        <span className="text-[10px] font-bold text-center leading-tight" style={{color:'#d6d0e8'}}>{ep.name}</span>
                      </div>
                    )
                  }
                  return (
                    <div className="flex items-center justify-center gap-2 pt-4 px-4">
                      <TeamBadge ep={fromEndpoint}/>
                      <Arrow/>
                      {player && (
                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{width:88}}>
                          <div className="rounded-full p-[3px]" style={{width:80,height:80,background:`conic-gradient(from 180deg, ${accent}, #fff, ${accent}, #fde68a, ${accent})`,boxShadow:`0 0 20px 3px ${accent}77`}}>
                            <div className="w-full h-full rounded-full overflow-hidden" style={{background:'#241c3d'}}>
                              {playerPhotos[player.id]
                                ?<img src={playerPhotos[player.id]} alt="" className="w-full h-full object-cover"/>
                                :<div className="w-full h-full flex items-center justify-center text-lg font-black" style={{color:accent}}>{player.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
                            </div>
                          </div>
                        </div>
                      )}
                      <Arrow/>
                      <TeamBadge ep={toEndpoint}/>
                    </div>
                  )
                })()}

                <div className="flex items-center gap-4" style={hasFlow?{padding:'2px 16px 16px'}:{padding:16}}>
                  {/* Player avatar stack — conic-gradient ring (same "trading card"
                      language as the All-Star cards elsewhere in the app), with a
                      team logo badge floating on its corner. Falls back to a plain
                      glowing type-icon when there's no individual player (e.g. a
                      pure team-level entry). Skipped when the flow header above
                      already shows the player riding the arrow — showing it twice
                      would be redundant. */}
                  {!hasFlow && (
                  <div className="flex -space-x-4 flex-shrink-0">
                    {players.length>0 ? players.slice(0,3).map((p:any,i:number)=>{
                      const pTeam = teams[Math.min(i,teams.length-1)]
                      const ringColor = pTeam?.color ? readableTeamColorOnDark(pTeam.color) : accent
                      return (
                        <div key={p.id||i} className="relative flex-shrink-0" style={{width:60,height:60,zIndex:10-i}}>
                          <div className="w-full h-full rounded-full p-[2.5px]" style={{background:`conic-gradient(from 180deg, ${ringColor}, #fff, ${ringColor}, #fde68a, ${ringColor})`, boxShadow:`0 0 14px 2px ${ringColor}66`}}>
                            <div className="w-full h-full rounded-full overflow-hidden" style={{background:'#241c3d'}}>
                              {playerPhotos[p.id]
                                ?<img src={playerPhotos[p.id]} alt="" className="w-full h-full object-cover"/>
                                :<div className="w-full h-full flex items-center justify-center text-sm font-black" style={{color:ringColor}}>{p.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
                            </div>
                          </div>
                          {pTeam?.logo_url&&(
                            <div className="absolute rounded-full overflow-hidden flex items-center justify-center" style={{width:22,height:22,right:-2,bottom:-2,background:'#0f0b1e',border:'2px solid '+ringColor,boxShadow:'0 2px 6px rgba(0,0,0,0.6)'}}>
                              <img src={pTeam.logo_url} alt="" className="w-full h-full object-contain p-0.5"/>
                            </div>
                          )}
                        </div>
                      )
                    }) : (
                      <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{width:60,height:60,background:`${accent}22`,border:`2px solid ${accent}77`,boxShadow:`0 0 14px 2px ${accent}44`}}>
                        {teams[0]?.logo_url
                          ?<img src={teams[0].logo_url} alt="" className="w-8 h-8 object-contain"/>
                          :<span className="text-2xl">🔄</span>}
                      </div>
                    )}
                    {players.length>3&&(
                      <div className="relative flex items-center justify-center rounded-full flex-shrink-0" style={{width:60,height:60,background:'#241c3d',border:'2px solid rgba(255,255,255,0.15)',zIndex:1}}>
                        <span className="text-xs font-black" style={{color:'#c9c2e0'}}>+{players.length-3}</span>
                      </div>
                    )}
                  </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-1.5"
                      style={{background:`${accent}22`,color:accent,border:`1px solid ${accent}55`,letterSpacing:'1.2px'}}>
                      {typeLabel}
                    </span>
                    <p className="text-sm font-bold leading-snug" style={{color:'#f3f0fa'}}>
                      {players.length>0 ? players.map((p:any,i:number)=>(
                        <span key={p.id||i}>
                          {i>0 && (i===players.length-1 ? (isPT?' e ':' & ') : ', ')}
                          {p.id
                            ? <Link href={`/player/${p.id}`} className="no-underline hover:underline" style={{color:'#fff'}}>{p.name}</Link>
                            : p.name}
                        </span>
                      )) : tx.description}
                    </p>
                    {players.length>0 && <p className="text-xs mt-0.5" style={{color:'#c4bcd9'}}>{tx.description}</p>}
                    {!hasFlow && teams.length>0&&(
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {teams.map((tm:any,i:number)=>(
                          <Link key={tm.id+i} href={`/team/${tm.id}`}
                            className="flex items-center gap-1 no-underline px-1.5 py-0.5 rounded-full hover:brightness-125 transition-all"
                            style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)'}}>
                            {tm.logo_url&&<img src={tm.logo_url} alt="" className="w-3.5 h-3.5 object-contain"/>}
                            <span className="text-[10px] font-bold" style={{color:'#d6d0e8'}}>{tm.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="text-xs flex-shrink-0 text-right" style={{color:'#b3ace0'}}>
                    {tx.week_number ? (
                      <>
                        <div className="font-semibold" style={{color:'#e4dff5'}}>{formatSimDate(tx.week_number, isPT?'pt-PT':'en-US')}</div>
                        <div style={{fontSize:10,opacity:0.85}}>
                          {new Date(tx.created_at).toLocaleTimeString(isPT?'pt-PT':'en-US',{hour:'2-digit',minute:'2-digit'})}
                        </div>
                      </>
                    ) : (
                      new Date(tx.created_at).toLocaleString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

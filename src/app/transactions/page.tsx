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
  const [playerPhotos,setPlayerPhotos] = useState<Record<string,string>>({})
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    // Injuries have their own dedicated Injury Center (/injuries) now — this
    // feed is only about roster/staff movement (entries, exits, trades).
    supabase.from('transactions').select('*').neq('type','injury').order('created_at',{ascending:false}).limit(100)
      .then(async ({data})=>{
        const list = data||[]
        setTxs(list)
        const [{data:teams}] = await Promise.all([
          supabase.from('teams').select('id,name,logo_url,color'),
        ])
        const tMap: Record<string,any> = {}
        ;(teams||[]).forEach((tm:any)=>{ tMap[tm.id]=tm })
        setTeamMap(tMap)

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
            return(
              <div key={tx.id} className="relative overflow-hidden rounded-2xl"
                style={{
                  background:`linear-gradient(120deg, ${primaryColor}33 0%, #140f24 32%, #140f24 68%, ${accent}22 100%), repeating-linear-gradient(115deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 14px), #140f24`,
                  border:'1px solid rgba(255,255,255,0.08)',
                  boxShadow:`0 10px 30px -12px ${primaryColor}55, inset 0 1px 0 rgba(255,255,255,0.05)`,
                }}>
                {/* Top accent beam — bright, futuristic, keyed to the transaction type */}
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{background:`linear-gradient(90deg, transparent, ${accent}, transparent)`, boxShadow:`0 0 16px 1px ${accent}aa`}}/>

                <div className="flex items-center gap-4 p-4">
                  {/* Player avatar stack — conic-gradient ring (same "trading card"
                      language as the All-Star cards elsewhere in the app), with a
                      team logo badge floating on its corner. Falls back to a plain
                      glowing type-icon when there's no individual player (e.g. a
                      pure team-level entry). */}
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
                    {players.length>0 && <p className="text-xs mt-0.5" style={{color:'#9d94b8'}}>{tx.description}</p>}
                    {teams.length>0&&(
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

                  <span className="text-xs flex-shrink-0 text-right" style={{color:'#8a83a3'}}>
                    {tx.week_number ? (
                      <>
                        <div className="font-semibold" style={{color:'#c9c2e0'}}>{formatSimDate(tx.week_number, isPT?'pt-PT':'en-US')}</div>
                        <div style={{fontSize:10,opacity:0.7}}>
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

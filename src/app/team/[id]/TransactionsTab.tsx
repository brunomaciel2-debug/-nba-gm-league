'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import { formatWeekRange } from '@/lib/season-week-helper'

const TX_LABELS_PT: Record<string,string> = { trade:'Troca', fa_signing:'Assinatura FA', cut:'Corte', draft:'Draft' }
const TX_LABELS_EN: Record<string,string> = { trade:'Trade', fa_signing:'FA Signing', cut:'Cut', draft:'Draft' }
const TX_COLORS: Record<string,{color:string,bg:string}> = {
  trade:{color:'#1d4ed8',bg:'#dbeafe'}, fa_signing:{color:'#15803d',bg:'#dcfce7'},
  cut:{color:'#dc2626',bg:'#fee2e2'}, draft:{color:'#6d28d9',bg:'#ede9fe'},
}

export default function TransactionsTab({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [loading, setLoading] = useState(true)
  const [txs, setTxs] = useState<any[]>([])
  const [playerMap, setPlayerMap] = useState<Record<string, any>>({})
  const [teamMap, setTeamMap] = useState<Record<string, any>>({})

  useEffect(() => {
    Promise.all([
      supabase.from('player_transactions').select('*')
        .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
        .order('season', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('teams').select('id,name,logo_url,color'),
    ]).then(async ([{ data: tx }, { data: teams }]) => {
      const tMap: Record<string, any> = {}
      for (const t2 of (teams || [])) tMap[t2.id] = t2
      setTeamMap(tMap)

      const playerIds = Array.from(new Set((tx || []).map((x: any) => x.player_id)))
      const pMap: Record<string, any> = {}
      if (playerIds.length) {
        const { data: players } = await supabase.from('players').select('id,name,pos,photo_url').in('id', playerIds)
        for (const p of (players || [])) pMap[p.id] = p
      }
      setPlayerMap(pMap)
      setTxs(tx || [])
      setLoading(false)
    })
  }, [teamId])

  if (loading) return <div className="text-center py-8" style={{color:'#8a8279'}}>{t('common.loading')}</div>

  if (txs.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <p className="text-sm" style={{color:'#8a8279'}}>{isPT?'Sem transferências registadas para esta franchise.':'No transactions on record for this franchise.'}</p>
      </div>
    )
  }

  const bySeason: Record<string, any[]> = {}
  for (const tx of txs) { (bySeason[tx.season] ||= []).push(tx) }
  const seasons = Object.keys(bySeason).sort().reverse()

  return (
    <div>
      <p className="text-xs mb-4" style={{color:'#6b5f4e'}}>
        {isPT ? 'Todo o histórico de trocas, assinaturas de free agency, cortes e escolhas de draft desta franchise.' : "This franchise's full history of trades, free agency signings, cuts, and draft picks."}
      </p>
      <div className="flex flex-col gap-6">
        {seasons.map(season => (
          <div key={season}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-black" style={{color:'#1a1512'}}>{season}</h3>
              <div className="flex-1 h-px" style={{background:'#d4cdc5'}}/>
            </div>
            <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
              {bySeason[season].map((tx: any, i: number) => {
                const player = playerMap[tx.player_id]
                const fromTeam = tx.from_team_id ? teamMap[tx.from_team_id] : null
                const toTeam = tx.to_team_id ? teamMap[tx.to_team_id] : null
                const label = (isPT ? TX_LABELS_PT : TX_LABELS_EN)[tx.type] || tx.type
                const txColor = TX_COLORS[tx.type] || { color:'#5c554e', bg:'#f0ece5' }
                const isIncoming = tx.to_team_id === teamId
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                       style={{borderBottom:i<bySeason[season].length-1?'1px solid #e2dcd5':'none',
                               background:i%2===0?'#faf8f5':'#f5f1eb'}}>
                    <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{background:txColor.bg,color:txColor.color}}>{label}</span>
                    {player?.photo_url
                      ? <img src={player.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" style={{border:'1px solid #d4cdc5'}}/>
                      : <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold flex-shrink-0" style={{background:'#f0ece5',color:'#8a8279'}}>
                          {player?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2) || '?'}
                        </div>}
                    <a href={`/player/${tx.player_id}`} className="text-sm font-semibold no-underline flex-shrink-0" style={{color:'#1a1512'}}>
                      {player?.name || `#${tx.player_id}`}
                    </a>
                    <div className="flex items-center gap-1.5 text-xs flex-1 min-w-0" style={{color:'#6b5f4e'}}>
                      <span style={{fontWeight: isIncoming ? 400 : 700, color: isIncoming ? '#6b5f4e' : '#dc2626'}}>
                        {fromTeam?.name || (isPT?'Agente Livre':'Free Agent')}
                      </span>
                      <span style={{color:'#b0a89e'}}>→</span>
                      <span style={{fontWeight: isIncoming ? 700 : 400, color: isIncoming ? '#15803d' : '#6b5f4e'}}>
                        {toTeam?.name || (isPT?'Agente Livre':'Free Agent')}
                      </span>
                    </div>
                    <div className="text-xs flex-shrink-0" style={{color:'#a89f97'}}>
                      {tx.week_number ? formatWeekRange(tx.week_number, isPT?'pt-PT':'en-US') : ''}
                    </div>
                    {tx.type === 'trade' && tx.proposal_id && (
                      <a href={`/trade-center?proposal=${tx.proposal_id}`}
                         className="text-xs font-semibold no-underline flex-shrink-0" style={{color:teamColor}}>
                        {isPT?'Ver Troca →':'View Trade →'}
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

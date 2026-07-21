'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import { formatSimDate } from '@/lib/season-week-helper'

const TYPE_STYLE: Record<string,{bg:string,color:string}> = {
  trade:      {bg:'#2a2010',color:'#c2410c'},
  signing:    {bg:'#0a2a10',color:'#166534'},
  waiver:     {bg:'#1a0a2a',color:'#7c3aed'},
  suspension: {bg:'#1a1a00',color:'#ffcc00'},
  extension:  {bg:'#0a2030',color:'#0ea5e9'},
  retirement: {bg:'#2a1808',color:'#b45309'},
}

// The "Player(s)"/"Staff" tag at the start of each row — orthogonal to the
// type badge (TRADE/CONTRATO/...), since a signing can be either a player
// or a coach and the type alone doesn't say which.
const CATEGORY_STYLE: Record<string,{bg:string,color:string}> = {
  player: {bg:'#e0e7ff',color:'#3730a3'},
  staff:  {bg:'#fef3c7',color:'#92400e'},
}

export default function TransactionsPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [txs,setTxs] = useState<any[]>([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    // Injuries have their own dedicated Injury Center (/injuries) now — this
    // feed is only about roster/staff movement (entries, exits, trades).
    supabase.from('transactions').select('*').neq('type','injury').order('created_at',{ascending:false}).limit(100)
      .then(({data})=>{setTxs(data||[]);setLoading(false)})
  },[])

  const TYPE_LABELS_PT: Record<string,string> = {
    trade:'TRADE',signing:'CONTRATO',waiver:'WAIVER',suspension:'SUSPENSÃO',extension:'RENOVAÇÃO',retirement:'RETIRADA'
  }
  const CATEGORY_LABELS_PT: Record<string,string> = { player:'Jogador(es)', staff:'Staff' }
  const CATEGORY_LABELS_EN: Record<string,string> = { player:'Player(s)', staff:'Staff' }

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
        <div className="flex flex-col gap-3">
          {txs.map((tx:any)=>{
            const style=TYPE_STYLE[tx.type]||{bg:'#f0ece5',color:'#6b5f4e'}
            const typeLabel = isPT ? (TYPE_LABELS_PT[tx.type]||tx.type.toUpperCase()) : tx.type.toUpperCase()
            const category = tx.category || 'player'
            const catStyle = CATEGORY_STYLE[category] || CATEGORY_STYLE.player
            const catLabel = isPT ? (CATEGORY_LABELS_PT[category]||category) : (CATEGORY_LABELS_EN[category]||category)
            return(
              <div key={tx.id} className="rounded-xl px-5 py-4" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold px-2 py-1 rounded flex-shrink-0 mt-0.5" style={{background:catStyle.bg,color:catStyle.color}}>
                    #{catLabel}
                  </span>
                  <span className="text-xs font-bold px-2 py-1 rounded flex-shrink-0 mt-0.5" style={{background:style.bg,color:style.color}}>
                    {typeLabel}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{color:'#1a1512'}}>{tx.description}</p>
                    {tx.teams&&tx.teams.length>0&&(
                      <p className="text-xs mt-1" style={{color:'#6b5f4e'}}>{isPT?'Equipas':'Teams'}: {tx.teams.join(' · ')}</p>
                    )}
                    {tx.players&&tx.players.length>0&&(
                      <p className="text-xs mt-0.5" style={{color:'#6b5f4e'}}>{isPT?'Jogadores':'Players'}: {tx.players.join(', ')}</p>
                    )}
                  </div>
                  <span className="text-xs flex-shrink-0 text-right" style={{color:'#9c8e7a'}}>
                    {tx.week_number ? (
                      <>
                        <div>{formatSimDate(tx.week_number, isPT?'pt-PT':'en-US')}</div>
                        <div style={{fontSize:10,opacity:0.7}}>
                          {isPT?'Semana':'Week'} {tx.week_number} · {new Date(tx.created_at).toLocaleTimeString(isPT?'pt-PT':'en-US',{hour:'2-digit',minute:'2-digit'})}
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

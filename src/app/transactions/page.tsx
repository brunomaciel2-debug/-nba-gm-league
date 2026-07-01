'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

const TYPE_STYLE: Record<string,{bg:string,color:string}> = {
  trade:      {bg:'#2a2010',color:'#c2410c'},
  signing:    {bg:'#0a2a10',color:'#166534'},
  waiver:     {bg:'#1a0a2a',color:'#7c3aed'},
  injury:     {bg:'#2a0a0a',color:'#ff4040'},
  suspension: {bg:'#1a1a00',color:'#ffcc00'},
}

export default function TransactionsPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [txs,setTxs] = useState<any[]>([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    supabase.from('transactions').select('*').order('created_at',{ascending:false}).limit(100)
      .then(({data})=>{setTxs(data||[]);setLoading(false)})
  },[])

  const TYPE_LABELS_PT: Record<string,string> = {
    trade:'TRADE',signing:'CONTRATO',waiver:'WAIVER',injury:'LESÃO',suspension:'SUSPENSÃO'
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2" style={{color:'#1a1512'}}>🔄 {isPT?'Transações':'Transactions'}</h1>
      <p className="text-sm mb-6" style={{color:'#6b5f4e'}}>
        {isPT?'Todos os trades, contratos, lesões e movimentos de plantel — actualizado em tempo real.':'All trades, signings, injuries and roster moves — updated in real time.'}
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
            return(
              <div key={tx.id} className="rounded-xl px-5 py-4" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="flex items-start gap-3">
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
                  <span className="text-xs flex-shrink-0" style={{color:'#9c8e7a'}}>
                    {new Date(tx.created_at).toLocaleString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
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

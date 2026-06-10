import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
export const revalidate = 30

const TYPE_STYLE: Record<string,{bg:string,color:string}> = {
  trade:      { bg:'#2a1a00', color:'#ffa040' },
  signing:    { bg:'#0a2a10', color:'#40e080' },
  waiver:     { bg:'#1a0a2a', color:'#c040ff' },
  injury:     { bg:'#2a0a0a', color:'#ff4040' },
  suspension: { bg:'#1a1a00', color:'#ffcc00' },
}

export default async function TransactionsPage() {
  const { data: txs } = await supabase.from('transactions').select('*')
    .order('created_at', { ascending: false }).limit(100)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-2">🔄 Transactions</h1>
      <p className="text-sm mb-6" style={{ color:'#7090b0' }}>All trades, signings, injuries and roster moves — updated in real time.</p>

      {(txs||[]).length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background:'#0f1e33',border:'1px solid #1e3a5f' }}>
          <p style={{ color:'#506070' }}>No transactions yet. The league is quiet... for now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(txs||[]).map((tx:Transaction) => {
            const style = TYPE_STYLE[tx.type] || { bg:'#1a2a3a', color:'#7090b0' }
            return (
              <div key={tx.id} className="rounded-xl px-5 py-4"
                   style={{ background:'#0f1e33', border:'1px solid #1e3a5f' }}>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold px-2 py-1 rounded flex-shrink-0 mt-0.5"
                        style={{ background:style.bg, color:style.color }}>
                    {tx.type.toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{tx.description}</p>
                    {tx.teams && tx.teams.length>0 && (
                      <p className="text-xs mt-1" style={{ color:'#7090b0' }}>
                        Teams: {tx.teams.join(' · ')}
                      </p>
                    )}
                    {tx.players && tx.players.length>0 && (
                      <p className="text-xs mt-0.5" style={{ color:'#7090b0' }}>
                        Players: {tx.players.join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color:'#405060' }}>
                    {new Date(tx.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
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

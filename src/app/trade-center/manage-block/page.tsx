'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

export default function ManageTradeBlockPage() {
  const { user, profile } = useAuth()
  const [players, setPlayers]   = useState<any[]>([])
  const [onBlock, setOnBlock]   = useState<Set<string>>(new Set())
  const [notes,   setNotes]     = useState<Record<string,string>>({})
  const [saving,  setSaving]    = useState<Record<string,boolean>>({})

  useEffect(() => {
    if (!profile?.team_id) return
    Promise.all([
      supabase.from('players').select('id,name,pos,salary,usage').eq('team_id',profile.team_id).eq('status','active').order('usage',{ascending:false}),
      supabase.from('trade_block').select('*').eq('team_id',profile.team_id).eq('status','available'),
    ]).then(([{data:p},{data:tb}])=>{
      setPlayers(p||[])
      const ids = new Set<string>((tb||[]).map((t:any)=>t.player_id))
      setOnBlock(ids)
      const n: Record<string,string> = {}
      ;(tb||[]).forEach((t:any)=>{ n[t.player_id]=t.notes||'' })
      setNotes(n)
    })
  },[profile])

  const toggle = async (playerId: string) => {
    if (!user||!profile?.team_id) return
    setSaving(s=>({...s,[playerId]:true}))
    if (onBlock.has(playerId)) {
      await supabase.from('trade_block').update({status:'removed',removed_at:new Date().toISOString()})
        .eq('player_id',playerId).eq('team_id',profile.team_id).eq('status','available')
      setOnBlock(s=>{const n=new Set(s);n.delete(playerId);return n})
    } else {
      await supabase.from('trade_block').insert({
        player_id:playerId, team_id:profile.team_id,
        added_by:user.id, notes:notes[playerId]||'', status:'available'
      })
      setOnBlock(s=>{ const n=new Set(Array.from(s)); n.add(playerId); return n })
    }
    setSaving(s=>({...s,[playerId]:false}))
  }

  const capFmt = (n:number) => '$'+(n/1000000).toFixed(1)+'M'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <a href="/trade-center" className="text-xs no-underline mb-4 block" style={{color:'#6b5f4e'}}>← Trade Center</a>
      <h1 className="text-xl font-bold mb-2" style={{color:'#1a1612'}}>📋 Manage Trade Block</h1>
      <p className="text-xs mb-6" style={{color:'#6b5f4e'}}>
        Add players to the trade block to signal your willingness to trade them. Other GMs will see this.
      </p>
      <div className="flex flex-col gap-2">
        {players.map(p=>{
          const isOn = onBlock.has(p.id)
          return (
            <div key={p.id} className="rounded-xl p-3"
                 style={{background:isOn?'#2a2000':'#faf8f5',
                         border:'1px solid '+(isOn?'#b4530944':'#d4cdc5')}}>
              <div className="flex items-center gap-3">
                <span className="text-xs w-7" style={{color:'#6b5f4e'}}>{p.pos}</span>
                <span className="font-semibold flex-1" style={{color:'#1a1612'}}>{p.name}</span>
                <span className="text-xs" style={{color:'#6b5f4e'}}>{capFmt(p.salary)}</span>
                <button onClick={()=>toggle(p.id)} disabled={saving[p.id]}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40"
                  style={{background:isOn?'#5a4a00':'#d4cdc5',color:isOn?'#b45309':'#5c554e'}}>
                  {saving[p.id]?'...':isOn?'📋 On Block':'Add to Block'}
                </button>
              </div>
              {isOn && (
                <input value={notes[p.id]||''} onChange={e=>setNotes(n=>({...n,[p.id]:e.target.value}))}
                  placeholder="Note for other GMs (optional)..."
                  className="mt-2 w-full px-3 py-1.5 rounded-lg text-xs outline-none"
                  style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#3d3529'}} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

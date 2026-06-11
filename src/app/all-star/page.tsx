'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const POSITIONS = ['PG','SG','SF','PF','C']
const CONFERENCES = ['Eastern','Western']

export default function AllStarVotingPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<Record<string,any>>({})
  const [votes, setVotes] = useState<Record<string,string[]>>({E:{} as any,W:{} as any} as any)
  const [submitted, setSubmitted] = useState(false)
  const [gmTeam, setGmTeam] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    Promise.all([
      supabase.from('players').select('id,name,pos,team_id,photo_url,player_stats(games,pts,reb,ast)')
        .eq('status','active').order('usage',{ascending:false}),
      supabase.from('teams').select('id,name,conference,color,logo_url'),
    ]).then(([{data:ps},{data:ts}])=>{
      if(ps)setPlayers(ps)
      if(ts)setTeams(Object.fromEntries(ts.map((t:any)=>[t.id,t])))
      setLoading(false)
    })
  },[])

  const confPlayers = (conf:string) =>
    players.filter(p=>teams[p.team_id]?.conference===conf)
      .map(p=>{
        const s=p.player_stats?.[0]||{}
        const gp=s.games||1
        return {...p, ppg:(s.pts/gp).toFixed(1), rpg:(s.reb/gp).toFixed(1), apg:(s.ast/gp).toFixed(1)}
      })
      .sort((a:any,b:any)=>parseFloat(b.ppg)-parseFloat(a.ppg))

  const toggleVote = (conf:string, pos:string, playerId:string) => {
    setVotes((v:any)=>{
      const cur = v[conf]?.[pos]||[]
      if(cur.includes(playerId)){
        return {...v,[conf]:{...v[conf],[pos]:cur.filter((x:string)=>x!==playerId)}}
      }
      if(cur.length>=2) return v // max 2 per position
      return {...v,[conf]:{...v[conf],[pos]:[...cur,playerId]}}
    })
  }

  const totalVotes = Object.values(votes).flatMap((cv:any)=>Object.values(cv).flat()).length
  const maxVotes = CONFERENCES.length * POSITIONS.length * 2 // 2 per position per conf = 20

  if(loading) return <div className="max-w-4xl mx-auto px-4 py-12 text-center" style={{color:'#8a7a6a'}}>Loading...</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{color:'#f0ebe0'}}>⭐ All-Star Game Voting</h1>
          <p className="text-sm" style={{color:'#8a7a6a'}}>
            Select 2 players per position per conference. GMs vote for the East vs West rosters.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black" style={{color:'#ffd040'}}>{totalVotes}/{maxVotes}</div>
          <div className="text-xs" style={{color:'#8a7a6a'}}>votes cast</div>
        </div>
      </div>

      {CONFERENCES.map(conf=>(
        <div key={conf} className="mb-8">
          <h2 className="text-lg font-bold mb-4"
              style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>
            {conf} Conference All-Stars
          </h2>
          {POSITIONS.map(pos=>{
            const posPlayers = confPlayers(conf).filter(p=>p.pos===pos||
              (pos==='SF'&&p.pos==='PF')||
              (pos==='PF'&&p.pos==='SF')
            ).slice(0,12)
            const selected = (votes as any)[conf]?.[pos]||[]
            return (
              <div key={pos} className="mb-4 rounded-xl overflow-hidden"
                   style={{border:'1px solid #3a3228'}}>
                <div className="px-4 py-2 flex items-center justify-between"
                     style={{background:'#120f0a',borderBottom:'1px solid #3a3228'}}>
                  <span className="font-bold text-sm" style={{color:'#f0ebe0'}}>{pos}</span>
                  <span className="text-xs" style={{color:selected.length===2?'#40e080':'#8a7a6a'}}>
                    {selected.length}/2 selected
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3"
                     style={{background:'#1a1610'}}>
                  {posPlayers.map((p:any)=>{
                    const isSel = selected.includes(p.id)
                    const t = teams[p.team_id]
                    return (
                      <button key={p.id} onClick={()=>toggleVote(conf,pos,p.id)}
                        className="flex items-center gap-2 p-2 rounded-lg text-left transition-all"
                        style={{background:isSel?'#2a2000':'#241f18',
                                border:'1px solid '+(isSel?'#ffd040':'#3a3228')}}>
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                             style={{background:'#3a3228'}}>
                          {p.photo_url
                            ?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                            :<div className="w-full h-full flex items-center justify-center text-xs font-black"
                                  style={{color:'#8a7a6a'}}>
                               {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                             </div>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate"
                               style={{color:isSel?'#ffd040':'#f0ebe0'}}>{p.name}</div>
                          <div className="text-xs" style={{color:'#6a5a4a'}}>
                            {p.ppg}pts · {t?.id}
                          </div>
                        </div>
                        {isSel && <span className="ml-auto text-base flex-shrink-0">⭐</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <div className="flex items-center gap-4">
        <button
          disabled={submitted}
          onClick={()=>setSubmitted(true)}
          className="px-8 py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-all"
          style={{background:submitted?'#0a5a20':'#2a2000',
                  color:submitted?'#40e080':'#ffd040',
                  border:'1px solid '+(submitted?'#1a5a20':'#5a4a00')}}>
          {submitted?'✓ Vote Submitted!':'Submit All-Star Votes'}
        </button>
        <span className="text-xs" style={{color:'#6a5a4a'}}>
          Voting closes at the end of Week 13
        </span>
      </div>
    </div>
  )
}

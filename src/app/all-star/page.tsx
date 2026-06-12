'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'

const POSITIONS = ['PG','SG','SF','PF','C']
const CONFS = ['Eastern','Western']

export default function AllStarPage() {
  const [ready,   setReady]   = useState(false)
  const [players, setPlayers] = useState<any[]>([])
  const [teams,   setTeams]   = useState<Record<string,any>>({})
  const [curWeek, setCurWeek] = useState(0)
  const [votes,   setVotes]   = useState<Record<string,Record<string,string[]>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [gmTeam,    setGmTeam]    = useState('')
  const [tab,       setTab]       = useState<'vote'|'results'>('vote')
  const [roster,    setRoster]    = useState<any[]>([])

  // Voting window config (hardcoded as fallback)
  const VOTING_OPENS  = 11
  const VOTING_CLOSES = 12

  useEffect(() => {
    const load = async () => {
      try {
        const [r1, r2, r3, r4] = await Promise.allSettled([
          supabase.from('players').select('id,name,pos,team_id,photo_url,status,player_stats(games,pts,reb,ast)').eq('status','active'),
          supabase.from('teams').select('id,name,conference,color,logo_url').not('id','in','(ALL,RVS)'),
          supabase.from('season_config').select('current_week').eq('id',1).single(),
          supabase.from('allstar_roster').select('*, players(name,pos,photo_url,team_id)').eq('season','2025-26'),
        ])
        if (r1.status==='fulfilled' && r1.value.data) setPlayers(r1.value.data)
        if (r2.status==='fulfilled' && r2.value.data) setTeams(Object.fromEntries(r2.value.data.map((t:any)=>[t.id,t])))
        if (r3.status==='fulfilled' && r3.value.data) setCurWeek((r3.value.data as any).current_week||0)
        if (r4.status==='fulfilled' && r4.value.data) setRoster(r4.value.data)
      } catch(e) { console.error(e) }
      setReady(true)
    }
    load()
  }, [])

  const votingOpen   = curWeek >= VOTING_OPENS && curWeek <= VOTING_CLOSES
  const votingClosed = curWeek >  VOTING_CLOSES
  const announced    = roster.length > 0

  const expectedGames = Math.max(1, Math.round((Math.min(curWeek,13)/26)*82))
  const minGames = curWeek === 0 ? 0 : Math.floor(expectedGames*0.75)

  const confPlayers = (conf:string, pos:string) =>
    players.filter(p => {
      const gp = p.player_stats?.[0]?.games||0
      return teams[p.team_id]?.conference===conf &&
        (p.pos===pos||(pos==='SF'&&p.pos==='PF')||(pos==='PF'&&p.pos==='SF')) &&
        gp >= minGames
    }).map(p => {
      const s=p.player_stats?.[0]||{}; const gp=Math.max(1,s.games||1)
      return {...p, ppg:(s.pts/gp).toFixed(1), score:(s.pts/gp)*0.5+(s.reb/gp)*0.25+(s.ast/gp)*0.25}
    }).sort((a:any,b:any)=>b.score-a.score).slice(0,10)

  const toggleVote = (conf:string, pos:string, pid:string) => {
    if (!votingOpen||submitted) return
    setVotes(v=>{
      const cur=v[conf]?.[pos]||[]
      if (cur.includes(pid)) return {...v,[conf]:{...v[conf],[pos]:cur.filter(x=>x!==pid)}}
      if (cur.length>=2) return v
      return {...v,[conf]:{...(v[conf]||{}),[pos]:[...cur,pid]}}
    })
  }

  const saveVotes = async () => {
    if (!gmTeam) return
    setSaving(true)
    const rows:any[]=[]
    for (const conf of CONFS) for (const pos of POSITIONS) for (const pid of (votes[conf]?.[pos]||[])) {
      rows.push({gm_team_id:gmTeam,season:'2025-26',conference:conf,position:pos,player_id:pid,is_auto:false})
    }
    if (rows.length>0) await supabase.from('allstar_votes').upsert(rows,{onConflict:'gm_team_id,season,conference,position,player_id'})
    setSaving(false); setSubmitted(true)
  }

  const totalVotes = Object.values(votes).reduce((s,cv)=>s+Object.values(cv).reduce((ss,a)=>ss+(a as string[]).length,0),0)

  // Always render something — no blank screen
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header — always visible */}
      <div className="rounded-2xl p-6 mb-6"
           style={{background:'#fef3c7',border:'1px solid #5a4a00',borderTop:'4px solid #ffd040'}}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{color:'#b45309'}}>⭐ All-Star Weekend 2025-26</h1>
            <p className="text-sm" style={{color:'#8a6a00'}}>Week 14 · Rookies vs Sophomores (Sat) · East vs West (Sun)</p>
          </div>
          <div className="text-right">
            {!ready ? (
              <span className="text-xs px-3 py-1.5 rounded-full" style={{background:'#e8e2d6',color:'#6b5f4e'}}>Loading...</span>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-full font-semibold inline-block"
                    style={{background:votingOpen?'#0a2a10':votingClosed?'#2a0a0a':'#faf8f5',
                            color:votingOpen?'#40e080':votingClosed?'#e04040':'#5c554e'}}>
                {votingOpen?'🗳️ Voting Open':votingClosed?'🔒 Voting Closed':`Opens Week ${VOTING_OPENS}`}
              </span>
            )}
            <div className="text-xs mt-1" style={{color:'#6b5f4e'}}>Current: Week {curWeek}</div>
          </div>
        </div>
      </div>

      {!ready ? (
        <div className="rounded-xl p-8 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <p style={{color:'#6b5f4e'}}>Loading All-Star data...</p>
        </div>
      ) : (
        <>
          {/* Rules bar */}
          <div className="rounded-xl px-4 py-3 mb-5 text-xs" style={{background:'#e8e2d6',border:'1px solid #d4cec3',color:'#6b5f4e'}}>
            <strong style={{color:'#1a1612'}}>Eligibility:</strong> ≥{minGames} games played (75% of ~{expectedGames} games) · No injured players ·{' '}
            <strong style={{color:'#1a1612'}}>Starters:</strong> top-voted per position (5 per team) + 7 reserves ·{' '}
            <strong style={{color:'#1a1612'}}>Auto-vote:</strong> GMs who miss deadline get system votes
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5">
            {[{k:'vote',l:'🗳️ Cast Votes'},{k:'results',l:'📊 Roster'}].map((t:any)=>(
              <button key={t.k} onClick={()=>setTab(t.k)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{background:tab===t.k?'#d4cdc5':'#faf8f5',color:tab===t.k?'#1a1512':'#5c554e',
                        border:'1px solid '+(tab===t.k?'#d4cdc5':'#d4cdc5')}}>
                {t.l}
              </button>
            ))}
          </div>

          {/* VOTE */}
          {tab==='vote' && <>
            {!votingOpen && !votingClosed && (
              <div className="rounded-xl p-10 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="text-5xl mb-4">🔒</div>
                <h2 className="text-xl font-bold mb-2" style={{color:'#1a1612'}}>Voting opens Week {VOTING_OPENS}</h2>
                <p style={{color:'#6b5f4e'}}>The league is currently in Week {curWeek}. Voting opens at the start of Week {VOTING_OPENS}.</p>
              </div>
            )}
            {votingClosed && (
              <div className="rounded-xl p-10 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="text-5xl mb-4">⏳</div>
                <h2 className="text-xl font-bold mb-2" style={{color:'#1a1612'}}>Voting Closed</h2>
                <p style={{color:'#6b5f4e'}}>Commissioner is finalising the rosters. Announcement coming soon.</p>
              </div>
            )}
            {votingOpen && <>
              <div className="flex items-center gap-3 mb-5 p-3 rounded-xl"
                   style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <span className="text-xs font-semibold" style={{color:'#6b5f4e'}}>Your team:</span>
                <select value={gmTeam} onChange={e=>setGmTeam(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg flex-1"
                  style={{background:'#ddd7ca',border:'1px solid #d4cec3',color:'#1a1612',outline:'none'}}>
                  <option value="">— Select your team —</option>
                  {Object.values(teams).map((t:any)=>(
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <span className="text-xs font-bold" style={{color:totalVotes===20?'#40e080':'#5c554e'}}>{totalVotes}/20</span>
              </div>
              {CONFS.map(conf=>(
                <div key={conf} className="mb-8">
                  <h2 className="text-base font-bold mb-4"
                      style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>{conf} — pick 2 per position</h2>
                  {POSITIONS.map(pos=>{
                    const pool=confPlayers(conf,pos); const sel=votes[conf]?.[pos]||[]
                    return (
                      <div key={pos} className="mb-3 rounded-xl overflow-hidden" style={{border:'1px solid #d4cec3'}}>
                        <div className="px-4 py-2 flex justify-between" style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
                          <span className="font-bold" style={{color:'#1a1612'}}>{pos}</span>
                          <span className="text-xs" style={{color:sel.length===2?'#40e080':'#5c554e'}}>{sel.length}/2</span>
                        </div>
                        {pool.length===0?(
                          <div className="p-4 text-xs text-center" style={{color:'#6b5f4e'}}>
                            No eligible players yet.
                          </div>
                        ):(
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3" style={{background:'#ede8de'}}>
                            {pool.map((p:any)=>{
                              const isSel=sel.includes(p.id); const t=teams[p.team_id]; const tc=readableTeamColor(t?.color||'555555')
                              return (
                                <button key={p.id} onClick={()=>toggleVote(conf,pos,p.id)}
                                  disabled={!isSel&&sel.length>=2}
                                  className="flex flex-col items-center p-2 rounded-lg transition-all disabled:opacity-40"
                                  style={{background:isSel?'#2a2000':'#faf8f5',border:'1px solid '+(isSel?'#ffd040':'#d4cdc5')}}>
                                  <div className="w-10 h-10 rounded-full overflow-hidden mb-1" style={{background:tc+'22'}}>
                                    {p.photo_url?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                                      :<div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:tc}}>
                                         {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                       </div>}
                                  </div>
                                  <div className="text-xs font-semibold" style={{color:isSel?'#ffd040':'#1a1512'}}>
                                    {p.name.split(' ').slice(-1)[0]}
                                  </div>
                                  <div className="text-xs" style={{color:'#6b5f4e'}}>{p.ppg}pts</div>
                                  {isSel&&<span>⭐</span>}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              <button onClick={saveVotes} disabled={saving||submitted||!gmTeam}
                className="px-8 py-3 rounded-xl font-bold disabled:opacity-40"
                style={{background:submitted?'#0a5a20':'#2a2000',color:submitted?'#40e080':'#ffd040',
                        border:'1px solid '+(submitted?'#1a5a20':'#5a4a00')}}>
                {saving?'Saving...':submitted?'✓ Submitted!':'Submit Votes'}
              </button>
            </>}
          </>}

          {/* RESULTS */}
          {tab==='results' && (
            !announced?(
              <div className="rounded-xl p-10 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="text-5xl mb-4">⭐</div>
                <h2 className="text-xl font-bold mb-2" style={{color:'#1a1612'}}>Not yet announced</h2>
                <p style={{color:'#6b5f4e'}}>Roster will be announced by the Commissioner after Week {VOTING_CLOSES}.</p>
              </div>
            ):(
              CONFS.map(conf=>{
                const cr=roster.filter((r:any)=>r.conference===conf).sort((a:any,b:any)=>(b.is_starter?1:0)-(a.is_starter?1:0))
                return (
                  <div key={conf} className="mb-8">
                    <h2 className="text-lg font-bold mb-4" style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>{conf} All-Stars</h2>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {cr.map((r:any)=>{
                        const p=r.players; const t=teams[p?.team_id]; const tc=readableTeamColor(t?.color||'555')
                        return (
                          <div key={r.id} className="rounded-xl p-3 text-center"
                               style={{background:r.is_starter?'#2a2000':'#faf8f5',border:'1px solid '+(r.is_starter?'#ffd040':'#d4cdc5')}}>
                            {r.is_starter&&<div className="text-xs font-bold mb-1" style={{color:'#b45309'}}>⭐ STARTER</div>}
                            <div className="w-12 h-12 rounded-full overflow-hidden mx-auto mb-2" style={{background:tc+'22'}}>
                              {p?.photo_url?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                                :<div className="w-full h-full flex items-center justify-center font-black" style={{color:tc}}>
                                   {p?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                 </div>}
                            </div>
                            <div className="text-xs font-bold" style={{color:'#1a1612'}}>{p?.name?.split(' ').slice(-1)[0]}</div>
                            <div className="text-xs" style={{color:'#6b5f4e'}}>{r.position} · {t?.id}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )
          )}
        </>
      )}
    </div>
  )
}

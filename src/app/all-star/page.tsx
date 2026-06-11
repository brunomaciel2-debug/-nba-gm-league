'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import Link from 'next/link'

const POSITIONS = ['PG','SG','SF','PF','C']
const CONFS = ['Eastern','Western']
// Max 2 votes per position per conference (system picks top-voted)
const MAX_PER_POS = 2

export default function AllStarPage() {
  const [players,    setPlayers]    = useState<any[]>([])
  const [teams,      setTeams]      = useState<Record<string,any>>({})
  const [config,     setConfig]     = useState<any>(null)
  const [season,     setSeason]     = useState<any>(null)
  const [votes,      setVotes]      = useState<Record<string,Record<string,string[]>>>({})
  const [submitted,  setSubmitted]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [roster,     setRoster]     = useState<any[]>([])
  const [gmTeam,     setGmTeam]     = useState('')
  const [tab,        setTab]        = useState<'vote'|'results'>('vote')
  const [loading,    setLoading]    = useState(true)

  useEffect(()=>{
    Promise.all([
      supabase.from('players')
        .select('id,name,pos,team_id,photo_url,status,player_stats(games,pts,reb,ast,stl,blk)')
        .eq('status','active'),
      supabase.from('teams').select('*'),
      supabase.from('allstar_config').select('*').eq('id',1).single(),
      supabase.from('season_config').select('current_week').eq('id',1).single(),
      supabase.from('allstar_roster').select('*, players(name,pos,photo_url,team_id)').eq('season','2025-26'),
    ]).then(([{data:ps},{data:ts},{data:cfg},{data:sc},{data:rs}])=>{
      if(ps) setPlayers(ps)
      if(ts) setTeams(Object.fromEntries(ts.map((t:any)=>[t.id,t])))
      if(cfg) setConfig(cfg)
      if(sc)  setSeason(sc)
      if(rs)  setRoster(rs||[])
      setLoading(false)
    })
  },[])

  // Check if voting is open based on current week
  const currentWeek = season?.current_week || 0
  const votingOpen   = config && currentWeek >= config.voting_opens_week && currentWeek <= config.voting_closes_week
  const votingClosed = config && currentWeek > config.voting_closes_week
  const announced    = roster.length > 0

  // Eligible players: active, not injured, played ≥75% of games so far
  const gamesPlayed = (p:any) => p.player_stats?.[0]?.games || 0
  // Approx games that should have been played by week 13
  const expectedGames = Math.max(1, Math.round((Math.min(currentWeek,13) / 26) * 82))
  const minGames = Math.floor(expectedGames * 0.75)

  const eligible = players.filter(p =>
    p.status === 'active' && gamesPlayed(p) >= minGames
  )

  const confPlayers = (conf:string, pos:string) => {
    return eligible
      .filter(p => {
        const inConf = teams[p.team_id]?.conference === conf
        // Allow SF/PF to be listed under both
        const matchPos = p.pos === pos ||
          (pos==='SF' && p.pos==='PF') ||
          (pos==='PF' && p.pos==='SF')
        return inConf && matchPos
      })
      .map(p => {
        const s = p.player_stats?.[0] || {}
        const gp = Math.max(1, s.games||1)
        const score = (s.pts/gp)*0.5 + (s.reb/gp)*0.25 + (s.ast/gp)*0.25
        return { ...p, ppg:(s.pts/gp).toFixed(1), rpg:(s.reb/gp).toFixed(1),
                 apg:(s.ast/gp).toFixed(1), score }
      })
      .sort((a:any,b:any) => b.score - a.score)
      .slice(0, 15)
  }

  const toggleVote = (conf:string, pos:string, pid:string) => {
    if (!votingOpen || submitted) return
    setVotes(v => {
      const cur = v[conf]?.[pos] || []
      if (cur.includes(pid)) {
        return {...v, [conf]: {...v[conf], [pos]: cur.filter(x=>x!==pid)}}
      }
      if (cur.length >= MAX_PER_POS) return v
      return {...v, [conf]: {...(v[conf]||{}), [pos]: [...cur, pid]}}
    })
  }

  const totalVotes = Object.values(votes).reduce((sum, cv) =>
    sum + Object.values(cv).reduce((s,arr)=>s+(arr as string[]).length,0), 0)
  const maxVotes = CONFS.length * POSITIONS.length * MAX_PER_POS

  const saveVotes = async () => {
    setSaving(true)
    const rows: any[] = []
    for (const conf of CONFS) {
      for (const pos of POSITIONS) {
        const pids = votes[conf]?.[pos] || []
        for (const pid of pids) {
          rows.push({
            gm_team_id: gmTeam || 'ORL',
            season: '2025-26',
            conference: conf,
            position: pos,
            player_id: pid,
            is_auto: false,
          })
        }
      }
    }
    if (rows.length > 0) {
      await supabase.from('allstar_votes').upsert(rows, {onConflict:'gm_team_id,season,conference,position,player_id'})
    }
    setSaving(false)
    setSubmitted(true)
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-center" style={{color:'#8a7a6a'}}>
      Loading All-Star info...
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="rounded-2xl p-6 mb-6"
           style={{background:'#2a2000',border:'1px solid #5a4a00',borderTop:'4px solid #ffd040'}}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{color:'#ffd040'}}>⭐ All-Star Weekend 2025-26</h1>
            <p className="text-sm" style={{color:'#8a6a00'}}>
              Week 14 · Rookies vs Sophomores (Saturday) · East vs West (Sunday)
            </p>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-xs px-3 py-1 rounded-full font-semibold"
                  style={{background: votingOpen?'#0a2a10':votingClosed?'#2a0a0a':'#1a1610',
                          color: votingOpen?'#40e080':votingClosed?'#e04040':'#8a7a6a'}}>
              {votingOpen ? '🗳️ Voting Open' : votingClosed ? '🔒 Voting Closed' :
               currentWeek < (config?.voting_opens_week||11) ? `Opens Week ${config?.voting_opens_week||11}` : '—'}
            </span>
            {votingOpen && (
              <span className="text-xs" style={{color:'#6a5a4a'}}>
                Closes end of Week {config?.voting_closes_week||12}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Eligibility info */}
      <div className="rounded-xl px-4 py-3 mb-6 flex items-center gap-3"
           style={{background:'#241f18',border:'1px solid #3a3228'}}>
        <span className="text-lg">📋</span>
        <div className="text-xs" style={{color:'#8a7a6a'}}>
          <strong style={{color:'#f0ebe0'}}>Eligibility:</strong> Players must have played ≥75% of games (≥{minGames} of ~{expectedGames} games played so far).
          Injured players are automatically replaced by the next most-voted eligible player.
          GMs who don't vote by Week {config?.voting_closes_week||12} will have the system vote for them based on stats.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[{key:'vote',label:'🗳️ Cast Votes'},{key:'results',label:'📊 Results & Roster'}].map((t:any)=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{background:tab===t.key?'#3a3228':'#241f18',
                    color:tab===t.key?'#f0ebe0':'#8a7a6a',
                    border:'1px solid '+(tab===t.key?'#5a4a3a':'#3a3228')}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VOTING TAB ─────────────────────────────── */}
      {tab === 'vote' && (
        <>
          {!votingOpen && !votingClosed && (
            <div className="rounded-xl p-8 text-center" style={{background:'#241f18',border:'1px solid #3a3228'}}>
              <div className="text-4xl mb-3">🔒</div>
              <h2 className="text-lg font-bold mb-2" style={{color:'#f0ebe0'}}>Voting not yet open</h2>
              <p style={{color:'#8a7a6a'}}>All-Star voting opens at the start of Week {config?.voting_opens_week||11}.</p>
              <p className="text-xs mt-2" style={{color:'#6a5a4a'}}>Current week: {currentWeek}</p>
            </div>
          )}

          {votingClosed && !announced && (
            <div className="rounded-xl p-8 text-center" style={{background:'#241f18',border:'1px solid #3a3228'}}>
              <div className="text-4xl mb-3">⏳</div>
              <h2 className="text-lg font-bold mb-2" style={{color:'#f0ebe0'}}>Voting is closed</h2>
              <p style={{color:'#8a7a6a'}}>The Commissioner is reviewing results and will announce the rosters.</p>
            </div>
          )}

          {votingOpen && (
            <>
              {/* GM team selector */}
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl"
                   style={{background:'#241f18',border:'1px solid #3a3228'}}>
                <span className="text-xs font-semibold" style={{color:'#8a7a6a'}}>Voting as:</span>
                <select value={gmTeam} onChange={e=>setGmTeam(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{background:'#120f0a',border:'1px solid #3a3228',color:'#f0ebe0',outline:'none'}}>
                  <option value="">Select your team</option>
                  {Object.values(teams).filter((t:any)=>!['ALL','RVS'].includes(t.id)).map((t:any)=>(
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <span className="ml-auto text-xs font-bold" style={{color:totalVotes===maxVotes?'#40e080':'#8a7a6a'}}>
                  {totalVotes}/{maxVotes} votes
                </span>
              </div>

              {/* Voting grid */}
              {CONFS.map(conf=>(
                <div key={conf} className="mb-8">
                  <h2 className="text-base font-bold mb-4"
                      style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>
                    {conf} Conference
                  </h2>
                  {POSITIONS.map(pos=>{
                    const pool = confPlayers(conf, pos)
                    const sel  = votes[conf]?.[pos] || []
                    return (
                      <div key={pos} className="mb-3 rounded-xl overflow-hidden"
                           style={{border:'1px solid #3a3228'}}>
                        <div className="px-4 py-2 flex items-center justify-between"
                             style={{background:'#120f0a',borderBottom:'1px solid #3a3228'}}>
                          <span className="font-bold text-sm" style={{color:'#f0ebe0'}}>{pos}</span>
                          <span className="text-xs" style={{color:sel.length===MAX_PER_POS?'#40e080':'#8a7a6a'}}>
                            {sel.length}/{MAX_PER_POS} selected · pick your top {MAX_PER_POS}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 p-3"
                             style={{background:'#1a1610'}}>
                          {pool.slice(0,10).map((p:any)=>{
                            const isSel = sel.includes(p.id)
                            const t = teams[p.team_id]
                            const tc = readableTeamColor(t?.color||'555')
                            const disabled = !isSel && sel.length >= MAX_PER_POS
                            return (
                              <button key={p.id}
                                onClick={()=>toggleVote(conf,pos,p.id)}
                                disabled={disabled}
                                className="flex flex-col items-center p-2 rounded-lg text-center transition-all disabled:opacity-40"
                                style={{background:isSel?'#2a2000':'#241f18',
                                        border:'1px solid '+(isSel?'#ffd040':'#3a3228'),
                                        cursor:disabled?'not-allowed':'pointer'}}>
                                <div className="w-10 h-10 rounded-full overflow-hidden mb-1.5 flex-shrink-0"
                                     style={{background:tc+'22',border:'1px solid '+tc+'44'}}>
                                  {p.photo_url
                                    ?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                                    :<div className="w-full h-full flex items-center justify-center text-xs font-black"
                                          style={{color:tc}}>
                                       {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                     </div>}
                                </div>
                                <div className="text-xs font-semibold leading-tight mb-0.5"
                                     style={{color:isSel?'#ffd040':'#f0ebe0'}}>
                                  {p.name.split(' ').slice(-1)[0]}
                                </div>
                                <div className="text-xs" style={{color:'#6a5a4a'}}>{p.ppg}pts</div>
                                {isSel && <span className="text-sm mt-0.5">⭐</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              <div className="flex items-center gap-4 mt-4">
                <button onClick={saveVotes} disabled={saving||submitted||!gmTeam}
                  className="px-8 py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-all"
                  style={{background:submitted?'#0a5a20':'#2a2000',
                          color:submitted?'#40e080':'#ffd040',
                          border:'1px solid '+(submitted?'#1a5a20':'#5a4a00')}}>
                  {saving?'Saving...':submitted?'✓ Votes Submitted!':'Submit All-Star Votes'}
                </button>
                {!gmTeam && <span className="text-xs" style={{color:'#e04040'}}>Select your team first</span>}
                {gmTeam && !submitted && (
                  <span className="text-xs" style={{color:'#6a5a4a'}}>
                    Votes are saved immediately — you can change them until Week {config?.voting_closes_week||12}
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── RESULTS TAB ─────────────────────────────── */}
      {tab === 'results' && (
        <>
          {!announced ? (
            <div className="rounded-xl p-8 text-center" style={{background:'#241f18',border:'1px solid #3a3228'}}>
              <div className="text-4xl mb-3">⭐</div>
              <h2 className="text-lg font-bold mb-2" style={{color:'#f0ebe0'}}>Roster not yet announced</h2>
              <p style={{color:'#8a7a6a'}}>
                {votingOpen ? 'Voting is still open. Roster will be announced after Week '+config?.voting_closes_week+'.' :
                 votingClosed ? 'Voting is closed. Commissioner will announce the rosters soon.' :
                 'Roster will be announced after voting closes.'}
              </p>
            </div>
          ) : (
            <>
              {CONFS.map(conf=>{
                const confRoster = roster.filter((r:any)=>r.conference===conf)
                  .sort((a:any,b:any)=>(b.is_starter?1:0)-(a.is_starter?1:0) || b.vote_count-a.vote_count)
                return (
                  <div key={conf} className="mb-8">
                    <h2 className="text-lg font-bold mb-4"
                        style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>
                      {conf} All-Stars
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {confRoster.map((r:any)=>{
                        const p = r.players
                        const t = teams[p?.team_id]
                        const tc = readableTeamColor(t?.color||'555')
                        return (
                          <div key={r.id} className="rounded-xl p-3 text-center"
                               style={{background:r.is_starter?'#2a2000':'#241f18',
                                       border:'1px solid '+(r.is_starter?'#ffd040':'#3a3228')}}>
                            {r.is_starter && (
                              <div className="text-xs font-bold mb-1" style={{color:'#ffd040'}}>⭐ STARTER</div>
                            )}
                            <div className="w-14 h-14 rounded-full overflow-hidden mx-auto mb-2"
                                 style={{background:tc+'22',border:'2px solid '+tc+'44'}}>
                              {p?.photo_url
                                ?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                                :<div className="w-full h-full flex items-center justify-center text-lg font-black"
                                      style={{color:tc}}>
                                   {p?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                 </div>}
                            </div>
                            <div className="text-sm font-bold" style={{color:'#f0ebe0'}}>{p?.name}</div>
                            <div className="text-xs" style={{color:'#6a5a4a'}}>{r.position} · {t?.id}</div>
                            {r.is_injured && (
                              <div className="text-xs mt-1 px-2 py-0.5 rounded"
                                   style={{background:'#2a0a0a',color:'#e04040'}}>
                                🏥 Replaced
                              </div>
                            )}
                            {r.vote_count > 0 && (
                              <div className="text-xs mt-1" style={{color:'#6a5a4a'}}>
                                {r.vote_count} votes
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
}

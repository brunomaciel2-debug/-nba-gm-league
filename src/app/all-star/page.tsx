'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'

const POSITIONS = ['PG','SG','SF','PF','C']
const CONFS = ['Eastern','Western']

export default function AllStarPage() {
  const [players,   setPlayers]   = useState<any[]>([])
  const [teams,     setTeams]     = useState<Record<string,any>>({})
  const [config,    setConfig]    = useState<any>({ voting_opens_week:11, voting_closes_week:12, announce_week:13, allstar_week:14 })
  const [curWeek,   setCurWeek]   = useState(0)
  const [votes,     setVotes]     = useState<Record<string,Record<string,string[]>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [roster,    setRoster]    = useState<any[]>([])
  const [gmTeam,    setGmTeam]    = useState('')
  const [tab,       setTab]       = useState<'vote'|'results'>('vote')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [
          { data: ps, error: e1 },
          { data: ts, error: e2 },
          { data: sc, error: e3 },
          { data: rs, error: e4 },
        ] = await Promise.all([
          supabase.from('players').select('id,name,pos,team_id,photo_url,status,player_stats(games,pts,reb,ast)').eq('status','active'),
          supabase.from('teams').select('id,name,conference,color,logo_url').not('id','in','(ALL,RVS)'),
          supabase.from('season_config').select('current_week').eq('id',1).single(),
          supabase.from('allstar_roster').select('*, players(name,pos,photo_url,team_id)').eq('season','2025-26'),
        ])
        if (e1) console.warn('players error', e1)
        if (e2) console.warn('teams error', e2)
        if (e3) console.warn('season_config error', e3)
        if (e4) console.warn('roster error', e4)

        setPlayers(ps || [])
        setTeams(Object.fromEntries((ts||[]).map((t:any) => [t.id, t])))
        setCurWeek(sc?.current_week || 0)
        setRoster(rs || [])

        // Try allstar_config — may not exist yet
        const { data: cfg } = await supabase.from('allstar_config').select('*').eq('id',1).single()
        if (cfg) setConfig(cfg)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const votingOpen   = curWeek >= config.voting_opens_week  && curWeek <= config.voting_closes_week
  const votingClosed = curWeek >  config.voting_closes_week
  const announced    = roster.length > 0

  // Eligible players
  const expectedGames = Math.max(1, Math.round((Math.min(curWeek,13)/26)*82))
  const minGames = Math.floor(expectedGames * 0.75)

  const confPlayers = (conf: string, pos: string) =>
    players
      .filter(p => {
        const gp = p.player_stats?.[0]?.games || 0
        const confMatch = teams[p.team_id]?.conference === conf
        const posMatch = p.pos===pos || (pos==='SF'&&p.pos==='PF') || (pos==='PF'&&p.pos==='SF')
        return confMatch && posMatch && gp >= minGames
      })
      .map(p => {
        const s = p.player_stats?.[0] || {}
        const gp = Math.max(1, s.games||1)
        return { ...p, ppg:(s.pts/gp).toFixed(1), score:(s.pts/gp)*0.5+(s.reb/gp)*0.25+(s.ast/gp)*0.25 }
      })
      .sort((a:any,b:any) => b.score - a.score)
      .slice(0, 10)

  const toggleVote = (conf:string, pos:string, pid:string) => {
    if (!votingOpen || submitted) return
    setVotes(v => {
      const cur = v[conf]?.[pos] || []
      if (cur.includes(pid)) return {...v,[conf]:{...v[conf],[pos]:cur.filter(x=>x!==pid)}}
      if (cur.length >= 2) return v
      return {...v,[conf]:{...(v[conf]||{}),[pos]:[...cur,pid]}}
    })
  }

  const saveVotes = async () => {
    if (!gmTeam) return
    setSaving(true)
    const rows: any[] = []
    for (const conf of CONFS) {
      for (const pos of POSITIONS) {
        for (const pid of (votes[conf]?.[pos] || [])) {
          rows.push({ gm_team_id:gmTeam, season:'2025-26', conference:conf, position:pos, player_id:pid, is_auto:false })
        }
      }
    }
    if (rows.length > 0) {
      await supabase.from('allstar_votes').upsert(rows, { onConflict:'gm_team_id,season,conference,position,player_id' })
    }
    setSaving(false)
    setSubmitted(true)
  }

  const totalVotes = Object.values(votes).reduce((sum,cv) => sum+Object.values(cv).reduce((s,a)=>s+(a as string[]).length,0), 0)

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <div className="text-4xl mb-4">⭐</div>
      <p style={{color:'#8a7a6a'}}>Loading All-Star info...</p>
    </div>
  )

  if (error) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <p style={{color:'#e04040'}}>Error: {error}</p>
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
              Week {config.allstar_week} · Rookies vs Sophomores (Sat) · East vs West (Sun)
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs px-3 py-1.5 rounded-full font-semibold inline-block"
                  style={{background:votingOpen?'#0a2a10':votingClosed?'#2a0a0a':'#241f18',
                          color:votingOpen?'#40e080':votingClosed?'#e04040':'#8a7a6a'}}>
              {votingOpen ? '🗳️ Voting Open' :
               votingClosed ? '🔒 Voting Closed' :
               `Opens Week ${config.voting_opens_week}`}
            </span>
            <div className="text-xs mt-1" style={{color:'#6a5a4a'}}>Current: Week {curWeek}</div>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="rounded-xl px-4 py-3 mb-6" style={{background:'#241f18',border:'1px solid #3a3228'}}>
        <p className="text-xs" style={{color:'#8a7a6a'}}>
          <strong style={{color:'#f0ebe0'}}>Eligibility:</strong> ≥{minGames} games played (75% of ~{expectedGames} games so far) · No injured players ·
          <strong style={{color:'#f0ebe0'}}> Auto-vote:</strong> GMs who don't vote by Week {config.voting_closes_week} will have the system vote for them based on stats ·
          <strong style={{color:'#f0ebe0'}}> Starters:</strong> top-voted per position (5 per team) + 7 reserves
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[{key:'vote',label:'🗳️ Cast Votes'},{key:'results',label:'📊 Roster & Results'}].map((t:any)=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{background:tab===t.key?'#3a3228':'#241f18',color:tab===t.key?'#f0ebe0':'#8a7a6a',
                    border:'1px solid '+(tab===t.key?'#5a4a3a':'#3a3228')}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* VOTE TAB */}
      {tab==='vote' && (
        <>
          {!votingOpen && !votingClosed && (
            <div className="rounded-xl p-10 text-center" style={{background:'#241f18',border:'1px solid #3a3228'}}>
              <div className="text-5xl mb-4">🔒</div>
              <h2 className="text-xl font-bold mb-2" style={{color:'#f0ebe0'}}>Voting opens Week {config.voting_opens_week}</h2>
              <p style={{color:'#8a7a6a'}}>Come back once the season reaches Week {config.voting_opens_week}.</p>
              <p className="text-sm mt-3 px-3 py-1.5 rounded-full inline-block"
                 style={{background:'#2a2000',color:'#ffd040'}}>Currently Week {curWeek}</p>
            </div>
          )}

          {votingClosed && (
            <div className="rounded-xl p-10 text-center" style={{background:'#241f18',border:'1px solid #3a3228'}}>
              <div className="text-5xl mb-4">⏳</div>
              <h2 className="text-xl font-bold mb-2" style={{color:'#f0ebe0'}}>Voting closed</h2>
              <p style={{color:'#8a7a6a'}}>Commissioner is reviewing results. Roster announcement coming soon.</p>
            </div>
          )}

          {votingOpen && (
            <>
              <div className="flex items-center gap-3 mb-5 p-3 rounded-xl"
                   style={{background:'#241f18',border:'1px solid #3a3228'}}>
                <span className="text-xs font-semibold" style={{color:'#8a7a6a'}}>Your team:</span>
                <select value={gmTeam} onChange={e=>setGmTeam(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg flex-1"
                  style={{background:'#120f0a',border:'1px solid #3a3228',color:'#f0ebe0',outline:'none'}}>
                  <option value="">— Select your team —</option>
                  {Object.values(teams).map((t:any)=>(
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <span className="text-xs font-bold ml-auto"
                      style={{color:totalVotes===CONFS.length*POSITIONS.length*2?'#40e080':'#8a7a6a'}}>
                  {totalVotes}/{CONFS.length*POSITIONS.length*2} votes
                </span>
              </div>

              {CONFS.map(conf=>(
                <div key={conf} className="mb-8">
                  <h2 className="text-base font-bold mb-4"
                      style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>
                    {conf} Conference — pick 2 per position
                  </h2>
                  {POSITIONS.map(pos=>{
                    const pool = confPlayers(conf, pos)
                    const sel  = votes[conf]?.[pos] || []
                    return (
                      <div key={pos} className="mb-3 rounded-xl overflow-hidden"
                           style={{border:'1px solid #3a3228'}}>
                        <div className="px-4 py-2 flex items-center justify-between"
                             style={{background:'#120f0a',borderBottom:'1px solid #3a3228'}}>
                          <span className="font-bold" style={{color:'#f0ebe0'}}>{pos}</span>
                          <span className="text-xs" style={{color:sel.length===2?'#40e080':'#8a7a6a'}}>
                            {sel.length}/2 selected
                          </span>
                        </div>
                        {pool.length === 0 ? (
                          <div className="p-4 text-xs text-center" style={{color:'#6a5a4a'}}>
                            No eligible players yet — needs {minGames}+ games played.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3" style={{background:'#1a1610'}}>
                            {pool.map((p:any)=>{
                              const isSel = sel.includes(p.id)
                              const t = teams[p.team_id]
                              const tc = readableTeamColor(t?.color||'555555')
                              const disabled = !isSel && sel.length >= 2
                              return (
                                <button key={p.id} onClick={()=>toggleVote(conf,pos,p.id)}
                                  disabled={disabled}
                                  className="flex flex-col items-center p-2 rounded-lg transition-all disabled:opacity-40"
                                  style={{background:isSel?'#2a2000':'#241f18',
                                          border:'1px solid '+(isSel?'#ffd040':'#3a3228'),
                                          cursor:disabled?'not-allowed':'pointer'}}>
                                  <div className="w-10 h-10 rounded-full overflow-hidden mb-1"
                                       style={{background:tc+'22',border:'1px solid '+tc+'33'}}>
                                    {p.photo_url
                                      ?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                                      :<div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:tc}}>
                                         {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                       </div>}
                                  </div>
                                  <div className="text-xs font-semibold text-center leading-tight"
                                       style={{color:isSel?'#ffd040':'#f0ebe0'}}>
                                    {p.name.split(' ').slice(-1)[0]}
                                  </div>
                                  <div className="text-xs" style={{color:'#6a5a4a'}}>{p.ppg}pts</div>
                                  {isSel && <span className="text-base">⭐</span>}
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
                className="px-8 py-3 rounded-xl font-bold disabled:opacity-40 transition-all"
                style={{background:submitted?'#0a5a20':'#2a2000',
                        color:submitted?'#40e080':'#ffd040',
                        border:'1px solid '+(submitted?'#1a5a20':'#5a4a00')}}>
                {saving?'Saving...':submitted?'✓ Submitted!':'Submit Votes'}
              </button>
            </>
          )}
        </>
      )}

      {/* RESULTS TAB */}
      {tab==='results' && (
        <>
          {!announced ? (
            <div className="rounded-xl p-10 text-center" style={{background:'#241f18',border:'1px solid #3a3228'}}>
              <div className="text-5xl mb-4">⭐</div>
              <h2 className="text-xl font-bold mb-2" style={{color:'#f0ebe0'}}>Roster not yet announced</h2>
              <p style={{color:'#8a7a6a'}}>Will be announced by the Commissioner after Week {config.voting_closes_week}.</p>
            </div>
          ) : (
            CONFS.map(conf=>{
              const cr = roster.filter((r:any)=>r.conference===conf)
                .sort((a:any,b:any)=>(b.is_starter?1:0)-(a.is_starter?1:0)||b.vote_count-a.vote_count)
              return (
                <div key={conf} className="mb-8">
                  <h2 className="text-lg font-bold mb-4" style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>
                    {conf} All-Stars
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {cr.map((r:any)=>{
                      const p=r.players; const t=teams[p?.team_id]; const tc=readableTeamColor(t?.color||'555')
                      return (
                        <div key={r.id} className="rounded-xl p-3 text-center"
                             style={{background:r.is_starter?'#2a2000':'#241f18',border:'1px solid '+(r.is_starter?'#ffd040':'#3a3228')}}>
                          {r.is_starter&&<div className="text-xs font-bold mb-1" style={{color:'#ffd040'}}>⭐ STARTER</div>}
                          <div className="w-12 h-12 rounded-full overflow-hidden mx-auto mb-2" style={{background:tc+'22'}}>
                            {p?.photo_url?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                              :<div className="w-full h-full flex items-center justify-center font-black" style={{color:tc}}>
                                {p?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                               </div>}
                          </div>
                          <div className="text-xs font-bold" style={{color:'#f0ebe0'}}>{p?.name?.split(' ').slice(-1)[0]}</div>
                          <div className="text-xs" style={{color:'#6a5a4a'}}>{r.position} · {t?.id}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </>
      )}
    </div>
  )
}

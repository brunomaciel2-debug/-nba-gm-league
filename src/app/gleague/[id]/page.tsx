'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcOvr, ovrColor } from '@/lib/ovr'
import { readableTeamColor } from '@/lib/color'

type Tab = 'roster' | 'schedule'

const ATTR_GROUPS = [
  {label:'Scoring',    color:'#b45309', attrs:['usage','three','layup','dunk','mid','ft','siq','draw_foul']},
  {label:'Defense',    color:'#15803d', attrs:['blk','stl','idef','pdef']},
  {label:'Playmaking', color:'#1d4ed8', attrs:['ball_hdl','pass_vis','pass_iq','assist_role']},
  {label:'Physical',   color:'#6d28d9', attrs:['stamina','durability','def_reb','off_reb']},
  {label:'Mental',     color:'#c2410c', attrs:['pressure','consistency','crowd_effect']},
]
const ATTR_LABEL: Record<string,string> = {
  usage:'USG',three:'3PT',layup:'LAY',dunk:'DNK',mid:'MID',ft:'FT',siq:'SIQ',draw_foul:'DF',
  blk:'BLK',stl:'STL',idef:'IDEF',pdef:'PDEF',
  ball_hdl:'BH',pass_vis:'PV',pass_iq:'PIQ',assist_role:'AR',
  stamina:'STA',durability:'DUR',def_reb:'DREB',off_reb:'OREB',
  pressure:'CLU',consistency:'CON',crowd_effect:'CE',
}
const ATTR_TIP: Record<string,string> = {
  USG:'Usage Rate — how often this player is involved in plays (0-100)',
  '3PT':'Three-Point Shooting ability (0-100)',
  LAY:'Layup — finishing at the rim (0-100)',
  DNK:'Dunk power and frequency (0-100)',
  MID:'Mid-Range shooting (0-100)',
  FT:'Free Throw mechanics (0-100)',
  SIQ:'Shot IQ — shot selection quality (0-100)',
  DF:'Draw Foul tendency (0-100)',
  BLK:'Shot blocking (0-100)',
  STL:'Steal ability (0-100)',
  IDEF:'Interior Defense (0-100)',
  PDEF:'Perimeter Defense (0-100)',
  BH:'Ball Handling (0-100)',
  PV:'Pass Vision (0-100)',
  PIQ:'Pass IQ — decision making (0-100)',
  AR:'Assist Role — playmaking tendency (0-100)',
  STA:'Stamina — endurance over game (0-100)',
  DUR:'Durability — injury resistance (0-100)',
  DREB:'Defensive Rebounding (0-100)',
  OREB:'Offensive Rebounding (0-100)',
  CLU:'Clutch — performance under pressure (0-100)',
  CON:'Consistency across games (0-100)',
  CE:'Crowd Effect — home/away impact (0-100)',
  OVR:'Overall rating (calculated from all attributes)',
  AGE:'Player age',
  EXP:'NBA seasons played (0 = never played in NBA)',
  PPG:'Points Per Game (G-League)',
  RPG:'Rebounds Per Game (G-League)',
  APG:'Assists Per Game (G-League)',
}

function attrColor(v: number) {
  if (v >= 85) return '#b45309'
  if (v >= 75) return '#15803d'
  if (v >= 65) return '#1d4ed8'
  return '#8a8279'
}

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-0.5 cursor-help align-middle">
      <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                    width:11,height:11,borderRadius:'50%',background:'#d4cdc5',
                    color:'#5c554e',fontSize:7,fontWeight:700,lineHeight:1}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2 py-1.5 rounded-lg text-xs
                       opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{background:'#1a1512',color:'#f5f1eb',width:180,whiteSpace:'normal',
                    lineHeight:1.4,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.3)',
                    position:'absolute'}}>
        {text}
      </span>
    </span>
  )
}

function ColTh({ label, color, sortKey, active, dir, onClick }: {
  label: string, color: string, sortKey?: string, active?: boolean, dir?: string, onClick?: () => void
}) {
  return (
    <th onClick={onClick}
        style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5',
                padding:'8px 4px',textAlign:'center',whiteSpace:'nowrap',
                color:active?'#c8102e':color,fontSize:10,fontWeight:700,letterSpacing:'0.3px',
                cursor:onClick?'pointer':'default',userSelect:'none'}}>
      <span style={{display:'inline-flex',alignItems:'center',gap:1}}>
        {label}
        {ATTR_TIP[label] && <Tip text={ATTR_TIP[label]}/>}
        {active && <span style={{marginLeft:2}}>{dir==='desc'?'↓':'↑'}</span>}
      </span>
    </th>
  )
}

export default function GLeagueTeamPage({ params }: { params: { id: string } }) {
  const [tab, setTab]       = useState<Tab>('roster')
  const [team, setTeam]     = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [games, setGames]   = useState<any[]>([])
  const [coach, setCoach]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('ovr')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')

  useEffect(() => {
    Promise.all([
      supabase.from('gleague_teams')
        .select('*, nba:teams!gleague_teams_nba_affiliate_fkey(id,name,logo_url,color)')
        .eq('id', params.id).single(),
      supabase.from('players').select('*, gleague_player_stats(*)')
        .eq('gleague_team_id', params.id).order('usage', { ascending: false }),
      supabase.from('gleague_games')
        .select('*, home:gleague_teams!gleague_games_home_team_fkey(id,name,color), away:gleague_teams!gleague_games_away_team_fkey(id,name,color)')
        .or(`home_team.eq.${params.id},away_team.eq.${params.id}`)
        .order('played_at'),
      supabase.from('coaches').select('*').eq('gleague_team_id', params.id).limit(1),
    ]).then(([{data:t},{data:pl},{data:g},{data:c}]) => {
      setTeam(t)
      setPlayers(pl||[])
      setGames(g||[])
      setCoach(c?.[0]||null)
      setLoading(false)
    })
  }, [params.id])

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d==='desc'?'asc':'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  if (loading) return (
    <div style={{textAlign:'center',padding:'48px',color:'#8a8279'}}>Loading...</div>
  )
  if (!team) return (
    <div style={{textAlign:'center',padding:'48px',color:'#8a8279'}}>Team not found.</div>
  )

  const tc  = readableTeamColor(team.color||'#1d4ed8')
  const gp  = team.wins + team.losses
  const pct = gp>0 ? (team.wins/gp).toFixed(3).replace(/^0/,'') : '.000'
  const played   = games.filter((g:any) => g.status==='final')
  const upcoming = games.filter((g:any) => g.status!=='final')

  const rows = players.map((p:any) => {
    const ovr = calcOvr(p)
    const s   = (p.gleague_player_stats||[])[0]
    const gp2 = s?.games||0
    const avg = (v:number) => gp2>0 ? parseFloat((v/gp2).toFixed(1)) : 0
    return { ...p, ovr,
      ppg: avg(s?.pts||0), rpg: avg(s?.reb||0), apg: avg(s?.ast||0) }
  }).sort((a:any,b:any) => {
    const av=a[sortKey]??0, bv=b[sortKey]??0
    return sortDir==='desc' ? bv-av : av-bv
  })

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 16px'}}>
      <Link href="/gleague" style={{fontSize:12,color:'#5c554e',textDecoration:'none',
            display:'inline-flex',alignItems:'center',gap:4,marginBottom:16}}>
        ← G-League
      </Link>

      {/* HEADER */}
      <div style={{background:'#e8e2d6',borderTop:`4px solid ${tc}`,border:'1px solid #d4cec3',
                   borderRadius:16,padding:24,marginBottom:16}}>
        <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:24}}>
          <div style={{width:96,height:96,borderRadius:16,background:tc+'22',
                       border:`2px solid ${tc}44`,display:'flex',alignItems:'center',
                       justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
            {(team.logo_url || team.nba?.logo_url)
              ?<img src={team.logo_url || team.nba?.logo_url} alt={team.name} style={{width:'100%',height:'100%',objectFit:'contain',padding:4}}/>
              :<span style={{fontSize:24,fontWeight:900,color:tc}}>{team.id}</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:tc,marginBottom:2}}>
              G-League · {team.conference} Conference
            </div>
            <h1 style={{fontSize:28,fontWeight:700,color:'#1a1512',margin:'0 0 4px'}}>
              {team.name}
            </h1>
            <div style={{fontSize:13,color:'#6b5f4e'}}>
              {team.arena}{team.city?` · ${team.city}`:''}
            </div>
            {team.nba && (
              <Link href={`/team/${team.nba.id}`} style={{fontSize:12,fontWeight:600,color:tc,textDecoration:'none',display:'block',marginTop:4}}>
                ↑ NBA Affiliate: {team.nba.name}
              </Link>
            )}
          </div>
          <div style={{display:'flex',gap:24,flexShrink:0}}>
            {[{v:team.wins,l:'W',c:'#15803d'},{v:team.losses,l:'L',c:'#dc2626'},{v:pct,l:'PCT',c:'#1a1512'}].map((x:any)=>(
              <div key={x.l} style={{textAlign:'center'}}>
                <div style={{fontSize:28,fontWeight:900,color:x.c}}>{x.v}</div>
                <div style={{fontSize:11,color:'#6b5f4e'}}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:0,borderBottom:'2px solid #d4cdc5',marginBottom:20}}>
        {([
          {key:'roster',   label:'Roster',   badge:`${players.length} players`},
          {key:'schedule', label:'Schedule', badge:`${played.length} played · ${upcoming.length} remaining`},
        ] as const).map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',
                    fontSize:14,fontWeight:600,cursor:'pointer',background:'transparent',
                    border:'none',borderBottom:tab===t.key?'3px solid #c8102e':'3px solid transparent',
                    marginBottom:-2,color:tab===t.key?'#1a1512':'#5c554e'}}>
            {t.label}
            <span style={{fontSize:11,padding:'2px 6px',borderRadius:4,
                          background:tab===t.key?'#e8e2d8':'#f0ece5',color:'#5c554e'}}>
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {/* ROSTER TAB */}
      {tab === 'roster' && (
        <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{background:'#f0ece5'}}>
                  <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5',
                              padding:'10px 12px',textAlign:'left',fontWeight:700,fontSize:11,color:'#5c554e',
                              position:'sticky',left:0,zIndex:10,minWidth:150}}>
                    Player
                  </th>
                  <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5',
                              padding:'8px',textAlign:'center',fontWeight:700,fontSize:11,color:'#5c554e'}}>POS</th>
                  <ColTh label="OVR" color="#1a1512" active={sortKey==='ovr'} dir={sortDir} onClick={()=>handleSort('ovr')}/>
                  <ColTh label="AGE" color="#5c554e" active={sortKey==='age'} dir={sortDir} onClick={()=>handleSort('age')}/>
                  <ColTh label="EXP" color="#5c554e" active={sortKey==='nba_experience'} dir={sortDir} onClick={()=>handleSort('nba_experience')}/>
                  {ATTR_GROUPS.map(g => g.attrs.map(a => (
                    <ColTh key={a} label={ATTR_LABEL[a]} color={g.color}
                           active={sortKey===a} dir={sortDir} onClick={()=>handleSort(a)}/>
                  )))}
                  <ColTh label="PPG" color="#b45309" active={sortKey==='ppg'} dir={sortDir} onClick={()=>handleSort('ppg')}/>
                  <ColTh label="RPG" color="#15803d" active={sortKey==='rpg'} dir={sortDir} onClick={()=>handleSort('rpg')}/>
                  <ColTh label="APG" color="#1d4ed8" active={sortKey==='apg'} dir={sortDir} onClick={()=>handleSort('apg')}/>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={30} style={{padding:'32px',textAlign:'center',color:'#8a8279'}}>No players assigned.</td></tr>
                ) : rows.map((p:any, i:number) => {
                  const oc = ovrColor(p.ovr)
                  const bg = i%2===0?'#faf8f5':'#f5f1eb'
                  return (
                    <tr key={p.id} style={{background:bg,borderBottom:'1px solid #e2dcd5'}}>
                      <td style={{padding:'8px 12px',position:'sticky',left:0,zIndex:5,
                                  background:bg,borderRight:'1px solid #e2dcd5',whiteSpace:'nowrap'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:22,height:22,borderRadius:4,flexShrink:0,
                                       background:oc+'18',display:'flex',alignItems:'center',
                                       justifyContent:'center',fontSize:8,fontWeight:900,color:oc}}>
                            {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                          </div>
                          <Link href={`/player/${p.id}`}
                                style={{fontWeight:600,color:'#1a1512',textDecoration:'none',
                                        fontSize:12}}>
                            {p.name}
                          </Link>
                          {p.on_gleague_assignment && (
                            <span style={{background:'#c8102e',color:'#fff',fontSize:8,
                                          fontWeight:700,padding:'1px 4px',borderRadius:3}}>NBA</span>
                          )}
                        </div>
                      </td>
                      <td style={{padding:'6px 8px',textAlign:'center',borderRight:'1px solid #e2dcd5'}}>
                        <span style={{background:'#e8e2d8',color:'#3d3731',fontSize:10,
                                      fontWeight:600,padding:'2px 5px',borderRadius:4}}>{p.pos}</span>
                      </td>
                      <td style={{padding:'6px 4px',textAlign:'center',borderRight:'1px solid #e2dcd5'}}>
                        <span style={{fontWeight:900,fontSize:13,color:oc}}>{p.ovr}</span>
                      </td>
                      <td style={{padding:'6px 4px',textAlign:'center',color:'#5c554e',borderRight:'1px solid #e2dcd5'}}>
                        {p.age||'—'}
                      </td>
                      <td style={{padding:'6px 4px',textAlign:'center',borderRight:'1px solid #e2dcd5'}}>
                        <span style={{fontWeight:700,fontSize:11,color:'#5c554e'}}>
                          {p.nba_experience ?? 0}
                        </span>
                      </td>
                      {ATTR_GROUPS.map(g => g.attrs.map(a => (
                        <td key={a} style={{padding:'6px 4px',textAlign:'center',borderRight:'1px solid #e8e3db'}}>
                          <span style={{color:attrColor(p[a]||0),fontWeight:700,fontSize:11}}>
                            {p[a]||0}
                          </span>
                        </td>
                      )))}
                      <td style={{padding:'6px 4px',textAlign:'center',color:'#b45309',fontWeight:600}}>{p.ppg||'—'}</td>
                      <td style={{padding:'6px 4px',textAlign:'center',color:'#15803d'}}>{p.rpg||'—'}</td>
                      <td style={{padding:'6px 4px',textAlign:'center',color:'#1d4ed8'}}>{p.apg||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:'8px 16px',background:'#f5f1eb',borderTop:'1px solid #e2dcd5',
                       fontSize:11,color:'#8a8279'}}>
            {players.length} players · NBA = on assignment from NBA roster · EXP = NBA seasons played · Click columns to sort
          </div>
        </div>
      )}

      {/* SCHEDULE TAB */}
      {tab === 'schedule' && (
        <div>
          {played.length > 0 && (
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',
                           color:'#5c554e',marginBottom:12}}>Results</div>
              <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
                {played.slice().reverse().map((g:any, i:number) => {
                  const isHome = g.home_team===params.id
                  const myScore = isHome?g.home_score:g.away_score
                  const opScore = isHome?g.away_score:g.home_score
                  const opp = isHome?g.away:g.home
                  const won = myScore > opScore
                  const otc = readableTeamColor(opp?.color||'#5c554e')
                  return (
                    <div key={g.id} style={{display:'flex',alignItems:'center',gap:16,
                                            padding:'10px 16px',
                                            background:i%2===0?'#faf8f5':'#f5f1eb',
                                            borderBottom:'1px solid #e2dcd5'}}>
                      <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,
                                    background:won?'#15803d':'#dc2626',color:'#fff',flexShrink:0}}>
                        {won?'W':'L'}
                      </span>
                      <span style={{fontSize:11,color:'#8a8279',minWidth:48,flexShrink:0}}>
                        {g.played_at?new Date(g.played_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—'}
                      </span>
                      <Link href={`/gleague/${opp?.id}`}
                            style={{flex:1,fontWeight:600,fontSize:13,color:otc,textDecoration:'none',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {isHome?'vs':'@'} {opp?.name||'—'}
                      </Link>
                      <span style={{fontWeight:900,fontSize:14,color:won?'#15803d':'#dc2626',flexShrink:0}}>
                        {myScore}–{opScore}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',
                           color:'#5c554e',marginBottom:12}}>Upcoming</div>
              <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
                {upcoming.map((g:any, i:number) => {
                  const isHome = g.home_team===params.id
                  const opp = isHome?g.away:g.home
                  const otc = readableTeamColor(opp?.color||'#5c554e')
                  return (
                    <div key={g.id} style={{display:'flex',alignItems:'center',gap:16,
                                            padding:'10px 16px',
                                            background:i%2===0?'#faf8f5':'#f5f1eb',
                                            borderBottom:'1px solid #e2dcd5'}}>
                      <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,
                                    background:'#e8e2d8',color:'#5c554e',flexShrink:0}}>
                        {isHome?'HOME':'AWAY'}
                      </span>
                      <span style={{fontSize:11,color:'#8a8279',minWidth:48,flexShrink:0}}>
                        {g.played_at?new Date(g.played_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):`Wk ${g.week_number}`}
                      </span>
                      <Link href={`/gleague/${opp?.id}`}
                            style={{flex:1,fontWeight:600,fontSize:13,color:otc,textDecoration:'none'}}>
                        {isHome?'vs':'@'} {opp?.name||'—'}
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {played.length===0 && upcoming.length===0 && (
            <div style={{textAlign:'center',padding:'32px',color:'#8a8279'}}>No games scheduled.</div>
          )}
        </div>
      )}

      {/* HEAD COACH */}
      {coach && (
        <div style={{marginTop:24,borderRadius:12,padding:20,background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',color:'#5c554e',marginBottom:12}}>
            HEAD COACH
          </div>
          <Link href={`/staff/${coach.id}`} style={{textDecoration:'none'}}>
            <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'3px solid #b45309',
                         borderRadius:12,padding:16,display:'inline-block',minWidth:220}}>
              <div style={{fontSize:11,fontWeight:600,color:'#b45309',marginBottom:2}}>🎯 Head Coach</div>
              <div style={{fontSize:16,fontWeight:700,color:'#1a1512'}}>{coach.name}</div>
              <div style={{fontSize:11,color:'#8a8279',marginTop:2}}>{coach.nationality}{coach.age?` · Age ${coach.age}`:''}</div>
            </div>
          </Link>
        </div>
      )}

      {/* INJURY REPORT */}
      <div style={{marginTop:16,borderRadius:12,padding:16,background:'#e8e2d6',border:'1px solid #d4cec3'}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',color:'#5c554e',marginBottom:8}}>
          INJURY REPORT
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#15803d'}}>
          ✅ No active injuries. Full squad available.
        </div>
      </div>
    </div>
  )
}

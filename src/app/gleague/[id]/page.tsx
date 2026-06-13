import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { calcOvr, ovrColor } from '@/lib/ovr'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60

const ATTR_GROUPS = [
  {label:'Scoring',    color:'#b45309', attrs:['usage','three','layup','dunk','mid','ft','siq','draw_foul']},
  {label:'Defense',    color:'#15803d', attrs:['blk','stl','idef','pdef']},
  {label:'Playmaking', color:'#1d4ed8', attrs:['ball_hdl','pass_vis','pass_iq','assist_role']},
  {label:'Physical',   color:'#6d28d9', attrs:['stamina','durability','def_reb','off_reb']},
]
const ATTR_LABEL: Record<string,string> = {
  usage:'USG',three:'3PT',layup:'LAY',dunk:'DNK',mid:'MID',ft:'FT',siq:'SIQ',draw_foul:'DF',
  blk:'BLK',stl:'STL',idef:'IDEF',pdef:'PDEF',
  ball_hdl:'BH',pass_vis:'PV',pass_iq:'PIQ',assist_role:'AR',
  stamina:'STA',durability:'DUR',def_reb:'DREB',off_reb:'OREB',
}

function attrColor(v:number) {
  if(v>=85) return '#b45309'; if(v>=75) return '#15803d'
  if(v>=65) return '#1d4ed8'; return '#8a8279'
}

export default async function GLeagueTeamPage({ params }: { params: { id: string } }) {
  const { data: team } = await supabase
    .from('gleague_teams')
    .select('*, nba:teams!gleague_teams_nba_affiliate_fkey(id,name,logo_url,color)')
    .eq('id', params.id).single()
  if (!team) notFound()

  const [{ data: players }, { data: recentGames }, { data: upcoming }] = await Promise.all([
    supabase.from('players').select('*, gleague_player_stats(*)')
      .or(`gleague_team_id.eq.${params.id},and(on_gleague_assignment.eq.true,gleague_team_id.eq.${params.id})`)
      .order('usage', { ascending: false }),
    supabase.from('gleague_games')
      .select('*, home:gleague_teams!gleague_games_home_team_fkey(id,name,color), away:gleague_teams!gleague_games_away_team_fkey(id,name,color)')
      .or(`home_team.eq.${params.id},away_team.eq.${params.id}`)
      .eq('status','final').order('played_at',{ascending:false}).limit(5),
    supabase.from('gleague_games')
      .select('*, home:gleague_teams!gleague_games_home_team_fkey(id,name,color), away:gleague_teams!gleague_games_away_team_fkey(id,name,color)')
      .or(`home_team.eq.${params.id},away_team.eq.${params.id}`)
      .eq('status','scheduled').order('played_at',{ascending:true}).limit(5),
  ])

  const tc = readableTeamColor(team.color||'#1d4ed8')
  const gp = team.wins + team.losses
  const pct = gp>0?(team.wins/gp).toFixed(3).replace(/^0/,''):'.000'
  const allPlayers = players||[]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link href="/gleague" className="text-xs no-underline flex items-center gap-1 mb-6" style={{color:'#5c554e'}}>
        <i className="ti ti-arrow-left" style={{fontSize:14}}></i> G-League
      </Link>

      {/* Header */}
      <div className="rounded-2xl p-6 mb-6" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`4px solid ${tc}`}}>
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{background:tc+'18',border:`2px solid ${tc}33`}}>
            {team.nba?.logo_url
              ?<img src={team.nba.logo_url} alt="" className="w-full h-full object-contain p-1"/>
              :<span className="text-2xl font-black" style={{color:tc}}>{team.id}</span>}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1" style={{color:'#1a1512'}}>{team.name}</h1>
            <div className="flex flex-wrap gap-3 text-sm" style={{color:'#5c554e'}}>
              {team.nba && (
                <Link href={`/team/${team.nba.id}`} className="no-underline font-semibold flex items-center gap-1" style={{color:tc}}>
                  <i className="ti ti-arrow-up" style={{fontSize:12}}></i>NBA: {team.nba.name}
                </Link>
              )}
              {team.arena && <span><i className="ti ti-building" style={{fontSize:13,marginRight:3}}></i>{team.arena}</span>}
              {team.city  && <span><i className="ti ti-map-pin"  style={{fontSize:13,marginRight:3}}></i>{team.city}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="text-center">
                <div className="text-3xl font-black" style={{color:'#15803d'}}>{team.wins}</div>
                <div className="text-xs" style={{color:'#8a8279'}}>W</div>
              </div>
              <span className="text-2xl font-black" style={{color:'#d4cdc5'}}>-</span>
              <div className="text-center">
                <div className="text-3xl font-black" style={{color:'#dc2626'}}>{team.losses}</div>
                <div className="text-xs" style={{color:'#8a8279'}}>L</div>
              </div>
            </div>
            <div className="text-sm font-bold" style={{color:'#5c554e'}}>{pct} PCT</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Recent results */}
        <div>
          <div className="sec-hdr mb-3">
            <span className="sec-title">Recent Results</span>
          </div>
          {(recentGames||[]).length===0 ? (
            <div className="text-sm text-center py-4" style={{color:'#8a8279'}}>No games played yet.</div>
          ) : (recentGames||[]).map((g:any)=>{
            const isHome = g.home_team===params.id
            const myScore = isHome?g.home_score:g.away_score
            const opScore = isHome?g.away_score:g.home_score
            const opp = isHome?g.away:g.home
            const won = myScore>opScore
            const otc = readableTeamColor(opp?.color||'#5c554e')
            return (
              <div key={g.id} className="flex items-center gap-3 py-2.5 border-b" style={{borderColor:'#e2dcd5'}}>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{background:won?'#15803d':'#dc2626',color:'#fff'}}>{won?'W':'L'}</span>
                <Link href={`/gleague/${opp?.id}`} className="flex-1 no-underline text-sm font-semibold truncate"
                      style={{color:otc}}>{isHome?'vs':'@'} {opp?.name}</Link>
                <span className="text-sm font-black flex-shrink-0"
                      style={{color:won?'#15803d':'#dc2626'}}>{myScore}-{opScore}</span>
              </div>
            )
          })}

          <div className="sec-hdr mt-5 mb-3">
            <span className="sec-title">Upcoming</span>
          </div>
          {(upcoming||[]).length===0 ? (
            <div className="text-sm text-center py-4" style={{color:'#8a8279'}}>No upcoming games.</div>
          ) : (upcoming||[]).map((g:any)=>{
            const isHome = g.home_team===params.id
            const opp = isHome?g.away:g.home
            const otc = readableTeamColor(opp?.color||'#5c554e')
            return (
              <div key={g.id} className="flex items-center gap-3 py-2.5 border-b" style={{borderColor:'#e2dcd5'}}>
                <span className="text-xs flex-shrink-0" style={{color:'#8a8279',minWidth:40}}>
                  {g.played_at?new Date(g.played_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'TBD'}
                </span>
                <Link href={`/gleague/${opp?.id}`} className="flex-1 no-underline text-sm font-semibold truncate"
                      style={{color:otc}}>{isHome?'vs':'@'} {opp?.name}</Link>
              </div>
            )
          })}
        </div>

        {/* Roster */}
        <div className="md:col-span-2">
          <div className="sec-hdr mb-3">
            <span className="sec-title">Roster</span>
            <span className="text-xs" style={{color:'#8a8279'}}>{allPlayers.length} players</span>
          </div>
          {allPlayers.length===0 ? (
            <div className="rounded-xl p-6 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <p className="text-sm" style={{color:'#8a8279'}}>No players assigned yet.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
              <div className="overflow-x-auto">
                <table className="w-full" style={{borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                      <th className="px-3 py-2.5 text-left" style={{color:'#5c554e',fontWeight:700,letterSpacing:'0.5px',minWidth:140}}>Player</th>
                      <th className="px-2 py-2.5 text-center" style={{color:'#5c554e',fontWeight:700}}>POS</th>
                      <th className="px-2 py-2.5 text-center" style={{color:'#5c554e',fontWeight:700}}>OVR</th>
                      {ATTR_GROUPS.map(g=>g.attrs.map(a=>(
                        <th key={a} className="px-1.5 py-2.5 text-center" style={{color:g.color,fontWeight:700,fontSize:9}}>{ATTR_LABEL[a]}</th>
                      )))}
                      <th className="px-2 py-2.5 text-center" style={{color:'#5c554e',fontWeight:700}}>PPG</th>
                      <th className="px-2 py-2.5 text-center" style={{color:'#5c554e',fontWeight:700}}>RPG</th>
                      <th className="px-2 py-2.5 text-center" style={{color:'#5c554e',fontWeight:700}}>APG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPlayers.map((p:any,i:number)=>{
                      const ovr=calcOvr(p); const oc=ovrColor(ovr)
                      const s=(p.gleague_player_stats||[])[0]
                      const gp2=s?.games||0; const avg=(v:number)=>gp2>0?(v/gp2).toFixed(1):'—'
                      return (
                        <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Link href={`/player/${p.id}`} className="font-semibold no-underline hover:underline" style={{color:'#1a1512'}}>{p.name}</Link>
                              {p.on_gleague_assignment && (
                                <span style={{background:'#c8102e',color:'#fff',fontSize:8,fontWeight:700,padding:'1px 4px',borderRadius:3}}>NBA</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span style={{background:'#e8e2d8',color:'#3d3731',fontSize:10,fontWeight:600,padding:'2px 6px',borderRadius:4}}>{p.pos}</span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className="font-black" style={{color:oc,fontSize:13}}>{ovr}</span>
                          </td>
                          {ATTR_GROUPS.map(g=>g.attrs.map(a=>(
                            <td key={a} className="px-1.5 py-2 text-center">
                              <span style={{color:attrColor(p[a]||0),fontWeight:700,fontSize:11}}>{p[a]||0}</span>
                            </td>
                          )))}
                          <td className="px-2 py-2 text-center font-semibold" style={{color:'#b45309'}}>{avg(s?.pts||0)}</td>
                          <td className="px-2 py-2 text-center" style={{color:'#15803d'}}>{avg(s?.reb||0)}</td>
                          <td className="px-2 py-2 text-center" style={{color:'#1d4ed8'}}>{avg(s?.ast||0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

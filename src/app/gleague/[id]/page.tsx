import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { calcOvr, ovrColor } from '@/lib/ovr'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60

export default async function GLeagueTeamPage({ params }: { params: { id: string } }) {
  const { data: team } = await supabase
    .from('gleague_teams')
    .select('*, nba:teams!gleague_teams_nba_affiliate_fkey(id,name,logo_url,color)')
    .eq('id', params.id).single()

  if (!team) notFound()

  const { data: assignedPlayers } = await supabase
    .from('players')
    .select('*, gleague_player_stats(*)')
    .eq('gleague_team_id', params.id)
    .order('usage', { ascending: false })

  const { data: nbaPlayers } = await supabase
    .from('players')
    .select('*, gleague_player_stats(*)')
    .eq('on_gleague_assignment', true)
    .eq('gleague_team_id', params.id)

  const tc = readableTeamColor(team.color || '#1d4ed8')
  const gp = team.wins + team.losses
  const pct = gp > 0 ? (team.wins/gp).toFixed(3).replace(/^0/,'') : '.000'
  const allPlayers = [...(nbaPlayers||[]), ...(assignedPlayers||[])
    .filter((p:any) => !(nbaPlayers||[]).find((n:any) => n.id === p.id))]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href="/gleague" className="text-xs no-underline flex items-center gap-1 mb-6" style={{color:'#5c554e'}}>
        <i className="ti ti-arrow-left" style={{fontSize:14}}></i> G-League Standings
      </Link>

      {/* Header */}
      <div className="rounded-2xl p-6 mb-6" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`4px solid ${tc}`}}>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{background:tc+'18',border:`2px solid ${tc}33`}}>
            {team.nba?.logo_url
              ?<img src={team.nba.logo_url} alt="" className="w-full h-full object-contain p-1"/>
              :<span className="text-2xl font-black" style={{color:tc}}>{team.id}</span>}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1" style={{color:'#1a1512'}}>{team.name}</h1>
            <div className="flex items-center gap-3 flex-wrap text-sm" style={{color:'#5c554e'}}>
              {team.nba && (
                <Link href={`/team/${team.nba.id}`} className="no-underline font-semibold" style={{color:tc}}>
                  Affiliate: {team.nba.name}
                </Link>
              )}
              {team.arena && <span><i className="ti ti-building" style={{fontSize:13,marginRight:3}}></i>{team.arena}</span>}
              <span><i className="ti ti-map-pin" style={{fontSize:13,marginRight:3}}></i>{team.city}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-2xl font-black" style={{color:'#15803d'}}>{team.wins}</div>
                <div className="text-xs" style={{color:'#8a8279'}}>W</div>
              </div>
              <div className="text-xl font-black" style={{color:'#d4cdc5'}}>-</div>
              <div className="text-center">
                <div className="text-2xl font-black" style={{color:'#dc2626'}}>{team.losses}</div>
                <div className="text-xs" style={{color:'#8a8279'}}>L</div>
              </div>
            </div>
            <div className="text-sm font-semibold mt-1" style={{color:'#5c554e'}}>{pct} PCT</div>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="sec-hdr mb-4">
        <span className="sec-title">
          <i className="ti ti-users" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          Roster
        </span>
        <span className="text-xs" style={{color:'#8a8279'}}>{allPlayers.length} players</span>
      </div>

      {allPlayers.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <p className="text-sm" style={{color:'#8a8279'}}>No players assigned to this team yet.</p>
          <p className="text-xs mt-1" style={{color:'#a89f97'}}>GMs can send players from their NBA roster to the G-League affiliate.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          <table className="w-full" style={{borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                {['Player','Pos','OVR','Age','Status','PPG','RPG','APG'].map(h=>(
                  <th key={h} className="px-3 py-2.5" style={{color:'#5c554e',fontSize:11,fontWeight:700,
                      textTransform:'uppercase',letterSpacing:'0.5px',textAlign:h==='Player'?'left':'center'}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPlayers.map((p:any, i:number) => {
                const ovr = calcOvr(p)
                const oc = ovrColor(ovr)
                const s = (p.gleague_player_stats||[])[0]
                const gp2 = s?.games || 0
                const avg = (v:number) => gp2>0?(v/gp2).toFixed(1):'—'
                const isNBA = p.on_gleague_assignment
                return (
                  <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/player/${p.id}`} className="font-semibold no-underline hover:underline" style={{color:'#1a1512'}}>
                          {p.name}
                        </Link>
                        {isNBA && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{background:'#c8102e',color:'#fff',fontSize:9}}>
                            NBA
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{background:'#e8e2d8',color:'#3d3731'}}>{p.pos}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-black text-sm" style={{color:oc}}>{ovr}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center" style={{color:'#5c554e'}}>{p.age||'—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs font-semibold" style={{color:isNBA?'#c8102e':'#5c554e'}}>
                        {isNBA?'Assigned':'G-League'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold" style={{color:'#b45309'}}>{avg(s?.pts||0)}</td>
                    <td className="px-3 py-2.5 text-center" style={{color:'#15803d'}}>{avg(s?.reb||0)}</td>
                    <td className="px-3 py-2.5 text-center" style={{color:'#1d4ed8'}}>{avg(s?.ast||0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

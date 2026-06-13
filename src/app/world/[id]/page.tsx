import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { readableTeamColor } from '@/lib/color'
import FriendlyButton from './FriendlyButton'
export const dynamic = 'force-dynamic'

export default async function WorldTeamPage({ params }: { params: { id: string } }) {
  const { data: team } = await supabase
    .from('world_teams').select('*').eq('id', params.id.toUpperCase()).single()
  if (!team) notFound()

  const { data: players } = await supabase
    .from('players').select('id,name,pos,age,nationality,usage,photo_url')
    .eq('world_team_id', params.id.toUpperCase())
    .order('usage', { ascending: false })

  const { data: friendlies } = await supabase
    .from('friendly_requests')
    .select('*, nba:teams!friendly_requests_nba_team_id_fkey(id,name,logo_url,color)')
    .eq('world_team_id', params.id.toUpperCase())
    .eq('status', 'confirmed')
    .order('scheduled_date')

  const tc = readableTeamColor(team.color || '#1d4ed8')

  return (
    <div style={{maxWidth:960,margin:'0 auto',padding:'24px 16px'}}>
      <Link href="/teams" style={{fontSize:12,color:'#5c554e',textDecoration:'none',
            display:'inline-flex',alignItems:'center',gap:4,marginBottom:16}}>
        ← Teams
      </Link>

      {/* HEADER */}
      <div style={{borderRadius:16,padding:24,marginBottom:20,
                   background:'#e8e2d6',border:'1px solid #d4cec3',borderTop:`4px solid ${tc}`}}>
        <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:24}}>
          <div style={{width:96,height:96,borderRadius:16,background:tc+'22',
                       border:`2px solid ${tc}44`,display:'flex',alignItems:'center',
                       justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
            {team.logo_url
              ?<img src={team.logo_url} alt={team.name} style={{width:'100%',height:'100%',objectFit:'contain',padding:4}}/>
              :<span style={{fontSize:22,fontWeight:900,color:tc}}>{team.id}</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:tc,marginBottom:2}}>
              {team.continent} · {team.country}
            </div>
            <h1 style={{fontSize:28,fontWeight:700,color:'#1a1512',margin:'0 0 4px'}}>{team.name}</h1>
            <div style={{fontSize:13,color:'#6b5f4e'}}>
              {team.arena && <span>{team.arena}</span>}
              {team.city && <span> · {team.city}</span>}
              {team.founded && <span> · Est. {team.founded}</span>}
            </div>
            {team.description && (
              <p style={{fontSize:12,color:'#5c554e',marginTop:8,lineHeight:1.5}}>{team.description}</p>
            )}
          </div>
          {/* Friendly button — client component */}
          <FriendlyButton worldTeamId={team.id} worldTeamName={team.name} />
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {/* ROSTER */}
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',
                       color:'#5c554e',marginBottom:12}}>Roster</div>
          {(!players||players.length===0) ? (
            <div style={{borderRadius:12,padding:24,textAlign:'center',
                         background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <p style={{fontSize:13,color:'#8a8279'}}>Roster not yet available.</p>
              <p style={{fontSize:11,color:'#a89f97',marginTop:4}}>Players will be added before the pre-season.</p>
            </div>
          ) : (
            <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                    {['Player','Pos','Age','Nat.'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',textAlign:h==='Player'?'left':'center',
                                          fontWeight:700,fontSize:11,color:'#5c554e',letterSpacing:'0.5px'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((p:any,i:number)=>(
                    <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <td style={{padding:'8px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:24,height:24,borderRadius:'50%',flexShrink:0,overflow:'hidden',
                                       background:tc+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {p.photo_url
                              ?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                              :<span style={{fontSize:8,fontWeight:900,color:tc}}>
                                {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                              </span>}
                          </div>
                          <span style={{fontWeight:600,color:'#1a1512'}}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{padding:'8px',textAlign:'center'}}>
                        <span style={{background:'#e8e2d8',color:'#3d3731',fontSize:10,
                                      fontWeight:600,padding:'2px 5px',borderRadius:4}}>{p.pos}</span>
                      </td>
                      <td style={{padding:'8px',textAlign:'center',color:'#5c554e'}}>{p.age||'—'}</td>
                      <td style={{padding:'8px',textAlign:'center',color:'#5c554e',fontSize:11}}>{p.nationality||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CONFIRMED FRIENDLIES */}
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',
                       color:'#5c554e',marginBottom:12}}>Scheduled Friendlies</div>
          {(!friendlies||friendlies.length===0) ? (
            <div style={{borderRadius:12,padding:24,textAlign:'center',
                         background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <p style={{fontSize:13,color:'#8a8279'}}>No friendlies scheduled yet.</p>
              <p style={{fontSize:11,color:'#a89f97',marginTop:4}}>GMs can propose a game using the button above.</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {friendlies.map((f:any)=>{
                const ntc = readableTeamColor(f.nba?.color||'#1d4ed8')
                return (
                  <div key={f.id} style={{borderRadius:10,padding:'12px 16px',
                                          background:'#faf8f5',border:'1px solid #d4cdc5',
                                          borderLeft:`3px solid ${ntc}`}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:32,height:32,borderRadius:8,overflow:'hidden',
                                   background:ntc+'18',flexShrink:0}}>
                        {f.nba?.logo_url
                          ?<img src={f.nba.logo_url} alt="" style={{width:'100%',height:'100%',objectFit:'contain',padding:2}}/>
                          :<span style={{fontSize:9,fontWeight:900,color:ntc,display:'flex',alignItems:'center',
                                         justifyContent:'center',height:'100%'}}>{f.nba_team_id}</span>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13,color:'#1a1512'}}>{f.nba?.name}</div>
                        <div style={{fontSize:11,color:'#8a8279'}}>
                          {new Date(f.scheduled_date).toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'})}
                        </div>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:6,
                                    background:'#dcfce7',color:'#15803d'}}>Confirmed</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

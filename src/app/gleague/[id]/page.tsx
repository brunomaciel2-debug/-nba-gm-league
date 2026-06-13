import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { readableTeamColor } from '@/lib/color'
import { calcOvr, ovrColor } from '@/lib/ovr'
export const revalidate = 60

// ── Reuse RosterTable logic inline for G-League ──────────────────────────
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
const EXP_LABEL = (n:number) => n===0?'Rookie':n===1?'2nd Yr':n===2?'3rd Yr':`${n} Yrs`

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

  const [{ data: players }, { data: games }, { data: coaches }] = await Promise.all([
    supabase.from('players').select('*, gleague_player_stats(*)')
      .eq('gleague_team_id', params.id)
      .order('usage', { ascending: false }),
    supabase.from('gleague_games')
      .select('*, home:gleague_teams!gleague_games_home_team_fkey(id,name,color), away:gleague_teams!gleague_games_away_team_fkey(id,name,color)')
      .or(`home_team.eq.${params.id},away_team.eq.${params.id}`)
      .order('played_at'),
    supabase.from('coaches').select('*').eq('team_id', (team as any).nba_affiliate).limit(4),
  ])

  const tc = readableTeamColor((team as any).color || '#1d4ed8')
  const t = team as any
  const gp = t.wins + t.losses
  const pct = gp > 0 ? (t.wins/gp).toFixed(3).replace(/^0/,'') : '.000'
  const played = (games||[]).filter((g:any) => g.status === 'final')
  const upcoming = (games||[]).filter((g:any) => g.status !== 'final')

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link href="/gleague" className="text-xs no-underline flex items-center gap-1 mb-4" style={{color:'#5c554e'}}>
        <i className="ti ti-arrow-left" style={{fontSize:14}}></i> G-League
      </Link>

      {/* HEADER — same style as NBA team page */}
      <div className="rounded-2xl p-6 mb-4"
           style={{background:'#e8e2d6',borderTop:`4px solid ${tc}`,border:'1px solid #d4cec3'}}>
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-28 h-28 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
               style={{background:tc+'22',border:`2px solid ${tc}44`}}>
            {t.nba?.logo_url
              ?<img src={t.nba.logo_url} alt={t.name} className="w-full h-full object-contain p-1"/>
              :<span className="text-3xl font-black" style={{color:tc}}>{t.id}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold mb-1" style={{color:tc}}>
              G-League · {t.conference} Conference
            </div>
            <h1 className="text-3xl font-bold mb-1" style={{color:'#1a1512'}}>{t.name}</h1>
            <div className="text-sm" style={{color:'#6b5f4e'}}>
              {t.arena && <span>{t.arena}</span>}
              {t.city && <span> · {t.city}</span>}
            </div>
            {t.nba && (
              <Link href={`/team/${t.nba.id}`} className="no-underline text-xs font-semibold mt-1 block" style={{color:tc}}>
                ↑ NBA Affiliate: {t.nba.name}
              </Link>
            )}
          </div>
          <div className="flex gap-6">
            {[{v:t.wins,l:'W',c:'#15803d'},{v:t.losses,l:'L',c:'#dc2626'},{v:pct,l:'PCT',c:'#1a1512'}].map((x:any)=>(
              <div key={x.l} className="text-center">
                <div className="text-3xl font-black" style={{color:x.c}}>{x.v}</div>
                <div className="text-xs" style={{color:'#6b5f4e'}}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS — Roster & Schedule */}
      <GLTabs players={players||[]} played={played} upcoming={upcoming} teamId={params.id} />

      {/* COACHING STAFF (inherited from NBA affiliate) */}
      {(coaches||[]).length > 0 && (
        <div className="mt-6 rounded-xl p-5" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>
            COACHING STAFF <span className="font-normal" style={{color:'#9c9088'}}>(NBA Affiliate)</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(coaches||[]).map((c:any) => {
              const roleColor: Record<string,string> = {head_coach:'#b45309',assistant_coach:'#1d4ed8',trainer:'#15803d',physio:'#6d28d9'}
              const rc = roleColor[c.role]||'#5c554e'
              return (
                <Link key={c.id} href={`/staff/${c.id}`} className="no-underline group">
                  <div className="rounded-xl p-3 group-hover:brightness-95 transition-all"
                       style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${rc}`}}>
                    <div className="text-xs font-semibold mb-0.5" style={{color:rc}}>
                      {c.role.replace(/_/g,' ')}
                    </div>
                    <div className="font-bold text-sm" style={{color:'#1a1512'}}>{c.name}</div>
                    <div className="text-xs mt-0.5" style={{color:'#8a8279'}}>{c.nationality} · Age {c.age}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* INJURY REPORT placeholder */}
      <div className="mt-4 rounded-xl p-4" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
        <h2 className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e',letterSpacing:'1.5px'}}>INJURY REPORT</h2>
        <div className="flex items-center gap-2 text-sm" style={{color:'#15803d'}}>
          <i className="ti ti-checkbox" style={{fontSize:16}}></i>
          No active injuries. Full squad available.
        </div>
      </div>
    </div>
  )
}

// ── GLTabs — Roster + Schedule client component ───────────────────────────
function RosterTab({ players }: { players: any[] }) {
  if (!players.length) return (
    <div className="rounded-xl p-6 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
      <p className="text-sm" style={{color:'#8a8279'}}>No players assigned yet.</p>
    </div>
  )

  return (
    <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
      <div className="overflow-x-auto">
        <table className="w-full" style={{borderCollapse:'collapse',fontSize:11}}>
          <thead>
            <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
              <th className="px-3 py-2.5 text-left sticky left-0 z-10"
                  style={{background:'#f0ece5',minWidth:150,color:'#5c554e',fontWeight:700,letterSpacing:'0.5px'}}>Player</th>
              <th className="px-2 py-2.5 text-center" style={{color:'#5c554e',fontWeight:700}}>POS</th>
              <th className="px-2 py-2.5 text-center" style={{color:'#5c554e',fontWeight:700}}>OVR</th>
              <th className="px-2 py-2.5 text-center" style={{color:'#5c554e',fontWeight:700}}>AGE</th>
              <th className="px-2 py-2.5 text-center" style={{color:'#5c554e',fontWeight:700}}>EXP</th>
              {ATTR_GROUPS.map(g => g.attrs.map(a => (
                <th key={a} className="px-1.5 py-2.5 text-center"
                    style={{color:g.color,fontWeight:700,fontSize:9,letterSpacing:'0.3px'}}>{ATTR_LABEL[a]}</th>
              )))}
              <th className="px-2 py-2.5 text-center" style={{color:'#b45309',fontWeight:700}}>PPG</th>
              <th className="px-2 py-2.5 text-center" style={{color:'#15803d',fontWeight:700}}>RPG</th>
              <th className="px-2 py-2.5 text-center" style={{color:'#1d4ed8',fontWeight:700}}>APG</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p:any, i:number) => {
              const ovr = calcOvr(p)
              const oc  = ovrColor(ovr)
              const s   = (p.gleague_player_stats||[])[0]
              const gp2 = s?.games || 0
              const avg = (v:number) => gp2>0?(v/gp2).toFixed(1):'—'
              return (
                <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                  <td className="px-3 py-2 sticky left-0 z-10 whitespace-nowrap"
                      style={{background:i%2===0?'#faf8f5':'#f5f1eb'}}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center"
                           style={{background:oc+'18',fontSize:8,fontWeight:900,color:oc}}>
                        {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                      </div>
                      <Link href={`/player/${p.id}`} className="font-semibold no-underline hover:underline"
                            style={{color:'#1a1512'}}>{p.name}</Link>
                      {p.on_gleague_assignment && (
                        <span style={{background:'#c8102e',color:'#fff',fontSize:8,fontWeight:700,padding:'1px 4px',borderRadius:3}}>NBA</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span style={{background:'#e8e2d8',color:'#3d3731',fontSize:10,fontWeight:600,padding:'2px 5px',borderRadius:4}}>
                      {p.pos}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="font-black" style={{color:oc,fontSize:13}}>{ovr}</span>
                  </td>
                  <td className="px-2 py-2 text-center" style={{color:'#5c554e'}}>{p.age||'—'}</td>
                  <td className="px-2 py-2 text-center">
                    <span style={{color:(p.nba_experience??1)===0?'#6d28d9':'#5c554e',fontSize:10,fontWeight:600}}>
                      {EXP_LABEL(p.nba_experience??0)}
                    </span>
                  </td>
                  {ATTR_GROUPS.map(g => g.attrs.map(a => (
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
      <div className="px-4 py-2 text-xs" style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5',color:'#8a8279'}}>
        {players.length} players · NBA = on assignment from NBA roster · EXP = NBA seasons played
      </div>
    </div>
  )
}

function GLTabs({ players, played, upcoming, teamId }: {
  players: any[], played: any[], upcoming: any[], teamId: string
}) {
  // Server render both, show/hide via CSS (no client JS needed)
  return (
    <div>
      <div className="flex gap-0 border-b mb-4" style={{borderColor:'#d4cdc5'}}>
        {[
          {id:'roster',   label:`📋 Roster`,   badge:`${players.length} players`},
          {id:'schedule', label:`📅 Schedule`,  badge:`${played.length} played · ${upcoming.length} remaining`},
        ].map((t,i) => (
          <div key={t.id} className="px-5 py-3 text-sm font-semibold"
               style={{color:i===0?'#1a1512':'#5c554e',
                       borderBottom:i===0?'3px solid #c8102e':'3px solid transparent',
                       marginBottom:-1}}>
            {t.label}
            <span className="ml-2 text-xs px-2 py-0.5 rounded"
                  style={{background:i===0?'#e8e2d8':'#f0ece5',color:'#5c554e'}}>{t.badge}</span>
          </div>
        ))}
      </div>

      {/* Roster always shown */}
      <RosterTab players={players} />

      {/* Schedule below */}
      {played.length > 0 && (
        <div className="mt-6">
          <div className="sec-hdr mb-3"><span className="sec-title">Results</span></div>
          <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
            {played.slice(-10).reverse().map((g:any,i:number) => {
              const isHome = g.home_team === teamId
              const myScore = isHome?g.home_score:g.away_score
              const opScore = isHome?g.away_score:g.home_score
              const opp = isHome?g.away:g.home
              const won = myScore > opScore
              const otc = readableTeamColor(opp?.color||'#5c554e')
              return (
                <div key={g.id} className="flex items-center gap-4 px-4 py-2.5"
                     style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                  <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                        style={{background:won?'#15803d':'#dc2626',color:'#fff'}}>{won?'W':'L'}</span>
                  <span className="text-xs flex-shrink-0" style={{color:'#8a8279',minWidth:40}}>
                    {g.played_at?new Date(g.played_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—'}
                  </span>
                  <Link href={`/gleague/${opp?.id}`} className="flex-1 no-underline text-sm font-semibold truncate"
                        style={{color:otc}}>{isHome?'vs':'@'} {opp?.name||'—'}</Link>
                  <span className="font-black flex-shrink-0" style={{color:won?'#15803d':'#dc2626'}}>
                    {myScore}–{opScore}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-4">
          <div className="sec-hdr mb-3"><span className="sec-title">Upcoming</span></div>
          <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
            {upcoming.slice(0,8).map((g:any,i:number) => {
              const isHome = g.home_team === teamId
              const opp = isHome?g.away:g.home
              const otc = readableTeamColor(opp?.color||'#5c554e')
              return (
                <div key={g.id} className="flex items-center gap-4 px-4 py-2.5"
                     style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                  <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                        style={{background:'#e8e2d8',color:'#5c554e'}}>{isHome?'H':'A'}</span>
                  <span className="text-xs flex-shrink-0" style={{color:'#8a8279',minWidth:40}}>
                    {g.played_at?new Date(g.played_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'Wk '+g.week_number}
                  </span>
                  <Link href={`/gleague/${opp?.id}`} className="flex-1 no-underline text-sm font-semibold truncate"
                        style={{color:otc}}>{isHome?'vs':'@'} {opp?.name||'—'}</Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

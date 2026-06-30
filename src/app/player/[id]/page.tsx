import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { calcOvr } from '@/lib/ovr'
import OfferButton from './OfferButton'
import CutButton from './CutButton'
import ContractExtensionPanel from './ContractExtensionPanel'
export const dynamic = "force-dynamic"

const ATTR_TIPS: Record<string,string> = {
  usage:'Usage Rate — how often this player is involved in offensive plays. High usage = primary option.',
  three:'Three Point — shooting ability from beyond the arc.',
  layup:'Layup — finishing ability at the rim.',
  dunk:'Dunk — ability to finish with power above the rim.',
  mid:'Mid-Range — ability to score from mid-range.',
  ft:'Free Throws — free throw shooting accuracy.',
  siq:'Shot IQ — decision-making on shot selection.',
  draw_foul:'Draw Foul — ability to get to the free throw line.',
  blk:'Block — ability to block opponent shots.',
  stl:'Steal — ability to strip the ball or intercept passes.',
  idef:'Interior Defense — ability to defend in the paint.',
  pdef:'Perimeter Defense — ability to guard on the perimeter.',
  def_reb:'Defensive Rebound — ability to secure rebounds after opponent misses.',
  off_reb:'Offensive Rebound — ability to recover missed shots offensively.',
  stamina:'Stamina — endurance across a game.',
  durability:'Durability — resistance to injuries.',
  ball_hdl:'Ball Handling — ability to dribble under pressure.',
  pass_vis:'Pass Vision — ability to read the defence and find open teammates.',
  pass_iq:'Pass IQ — decision-making when passing.',
  assist_role:'Assist Role — how naturally this player fits into a pass-first role.',
  pressure:'Clutch/Pressure — performance in high-pressure moments.',
  consistency:'Consistency — game-to-game variance in performance.',
  crowd_effect:'Crowd Effect — how much crowd noise affects this player.',
  streaky:'Streaky — tendency to have hot and cold streaks.',
  trash_talk:'Trash Talk — ability to get in opponents\'s heads.',
  moral:'Morale — current mental state.',
}

function AttrTooltip({ tip }: { tip: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-xs font-bold flex-shrink-0"
            style={{background:'#d4cdc5',color:'#5c554e',lineHeight:1,fontSize:9}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{background:'#1a1512',color:'#f5f1eb',width:220,whiteSpace:'normal',lineHeight:1.5,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>
        {tip}
      </span>
    </span>
  )
}

const ATTR_GROUPS = [
  { label:'Scoring', color:'#b45309', attrs:[
    {key:'usage',label:'Usage Rate'},{key:'three',label:'Three Point'},
    {key:'layup',label:'Layup'},{key:'dunk',label:'Dunk'},
    {key:'mid',label:'Mid-Range'},{key:'ft',label:'Free Throws'},
    {key:'siq',label:'Shot IQ'},{key:'draw_foul',label:'Draw Foul'},
  ]},
  { label:'Defense', color:'#15803d', attrs:[
    {key:'blk',label:'Block'},{key:'stl',label:'Steal'},
    {key:'idef',label:'Interior Defense'},{key:'pdef',label:'Perimeter Defense'},
  ]},
  { label:'Rebounding', color:'#1d4ed8', attrs:[
    {key:'def_reb',label:'Def. Rebound'},{key:'off_reb',label:'Off. Rebound'},
  ]},
  { label:'Athleticism', color:'#6d28d9', attrs:[
    {key:'stamina',label:'Stamina'},{key:'durability',label:'Durability'},
  ]},
  { label:'Playmaking', color:'#0e7490', attrs:[
    {key:'ball_hdl',label:'Ball Handle'},{key:'pass_vis',label:'Pass Vision'},
    {key:'pass_iq',label:'Pass IQ'},{key:'assist_role',label:'Assist Role'},
  ]},
  { label:'Psychological', color:'#b45309', attrs:[
    {key:'pressure',label:'Clutch/Pressure'},{key:'consistency',label:'Consistency'},
    {key:'crowd_effect',label:'Crowd Effect'},{key:'streaky',label:'Streaky'},
    {key:'trash_talk',label:'Trash Talk'},
  ]},
]

const TYPE_LABEL: Record<string,{label:string,color:string,bg:string}> = {
  guaranteed:      {label:'Guaranteed',   color:'#15803d',bg:'#dcfce7'},
  player_option:   {label:'Player Option',color:'#1d4ed8',bg:'#dbeafe'},
  team_option:     {label:'Team Option',  color:'#c2410c',bg:'#fee2e2'},
  two_way:         {label:'Two-Way',      color:'#6d28d9',bg:'#ede9fe'},
  qualifying_offer:{label:'QO',           color:'#b45309',bg:'#fef3c7'},
}

function AttrBar({ value, color }: { value: number, color: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const barColor = value>=85?'#b45309':value>=70?color:value>=50?color+'99':'#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#d4cdc5'}}>
        <div className="h-full rounded-full" style={{width:pct+'%',background:barColor}}></div>
      </div>
      <span className="text-xs font-bold w-7 text-right"
            style={{color:value>=85?'#b45309':value>=70?'#1a1512':value>=50?'#5c554e':'#dc2626'}}>
        {value}
      </span>
    </div>
  )
}

function OVR({ value }: { value: number }) {
  const color = value>=85?'#b45309':value>=75?'#15803d':value>=65?'#1d4ed8':'#5c554e'
  const bg    = value>=85?'#fef3c7':value>=75?'#dcfce7':value>=65?'#dbeafe':'#f0ece5'
  return (
    <div className="flex flex-col items-center justify-center rounded-xl p-3 min-w-[60px]"
         style={{background:bg,border:'1px solid '+color+'44'}}>
      <span className="text-2xl font-black" style={{color}}>{value}</span>
      <span className="text-xs font-semibold" style={{color}}>OVR</span>
    </div>
  )
}

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const [{ data: player }, { data: stats }, { data: injuries }, { data: contracts }, { data: playerAwards }, { data: lastGames }] =
    await Promise.all([
      supabase.from('players').select('*, nba_experience, nba_recruitable, world_team_id, world_teams:world_team_id(id,name,country), teams(name,color,id,logo_url)').eq('id', params.id).single(),
      supabase.from('player_stats').select('*,triple_doubles').eq('player_id', params.id).order('season', {ascending:false}),
      supabase.from('injury_log').select('*').eq('player_id', params.id).order('created_at', {ascending:false}),
      supabase.from('contracts').select('*').eq('player_id', params.id).order('season', {ascending:true}),
      supabase.from('awards').select('award_type,period,season,stats_context,created_at').eq('player_id', params.id).order('created_at', {ascending:false}),
      supabase.from('box_scores').select('*,games(id,home_team,away_team,home_score,away_score,played_at,home:teams!games_home_team_fkey(name,color),away:teams!games_away_team_fkey(name,color))').eq('player_id', params.id).order('created_at', {ascending:false}).limit(5),
    ])

  if (!player) return <div className="p-8 text-center" style={{color:'#5c554e'}}>Player not found.</div>

  const p = player as any
  const team = p.teams as any
  const tc = readableTeamColor(team?.color || '3a8adf')
  const ovr = calcOvr(p)
  const capFmt = (n:number) => n ? '$'+(n/1000000).toFixed(2)+'M' : '—'

  const AWARD_LABELS: Record<string,string> = {
    potw_eastern:'Player of the Week (East)', potw_western:'Player of the Week (West)',
    potm_eastern:'Player of the Month (East)', potm_western:'Player of the Month (West)',
    mvp:'MVP', dpoy:'Defensive Player of the Year', roy:'Rookie of the Year',
    coy:'Coach of the Year', mip:'Most Improved Player', finals_mvp:'Finals MVP',
    all_nba_1:'1st Team All-NBA', all_nba_2:'2nd Team All-NBA', all_nba_3:'3rd Team All-NBA',
    all_rookie_1:'1st Rookie Team', all_rookie_2:'2nd Rookie Team',
  }
  const AWARD_COLORS: Record<string,string> = {
    mvp:'#c8102e', dpoy:'#15803d', roy:'#6d28d9', finals_mvp:'#c8102e',
    all_nba_1:'#b45309', all_nba_2:'#5c554e', all_nba_3:'#8a8279',
    potw_eastern:'#b45309', potw_western:'#1d4ed8',
    potm_eastern:'#b45309', potm_western:'#1d4ed8',
    all_rookie_1:'#6d28d9', all_rookie_2:'#8a8279',
  }

  const currentContract = (contracts||[]).find((c:any) => c.season==='2025-26')
  const totalValue = (contracts||[]).reduce((sum:number,c:any) => sum+c.salary, 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">

      {/* HEADER */}
      <div className="rounded-2xl p-6 mb-6"
           style={{background:'#faf8f5',borderTop:'4px solid '+tc,border:'1px solid #d4cdc5'}}>
        <div className="flex gap-5 flex-wrap items-start">
          <div className="flex-shrink-0">
            {p.photo_url
              ? <img src={p.photo_url} alt={p.name} className="w-40 h-40 rounded-xl object-cover" style={{border:'2px solid '+tc}}/>
              : <div className="w-40 h-40 rounded-xl flex items-center justify-center text-3xl font-black"
                     style={{background:tc+'18',color:tc,border:'2px solid '+tc+'33'}}>
                  {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{color:tc,letterSpacing:'1px'}}>
                  {p.world_team_id && p.world_teams ? `${p.world_teams.name} · ${p.world_teams.country}` : team?.name} · {p.pos}
                </div>
                <h1 className="text-3xl font-black mb-2" style={{color:'#1a1512'}}>{p.name}</h1>
                <div className="flex gap-3 text-sm flex-wrap items-center">
                  {p.nationality && <span style={{color:'#5c554e'}}>{p.nationality}</span>}
                  {p.age && <span style={{color:'#5c554e'}}>Age {p.age}</span>}
                  {p.nba_experience===0
                    ? <span className="text-xs px-2 py-0.5 rounded font-bold" style={{background:'#6d28d9',color:'#fff'}}>Rookie</span>
                    : p.nba_experience===1
                    ? <span className="text-xs px-2 py-0.5 rounded font-bold" style={{background:'#1d4ed8',color:'#fff'}}>Sophomore</span>
                    : <span style={{color:'#8a8279',fontSize:12}}>{p.nba_experience}yr exp</span>
                  }
                  {p.status !== 'active' && (
                    <span className="px-2 py-0.5 rounded font-semibold text-xs" style={{background:'#fee2e2',color:'#dc2626'}}>
                      🏥 {p.injury_type||'Injured'}
                    </span>
                  )}
                </div>
              </div>
              <OVR value={ovr}/>
            </div>
            {currentContract && (
              <div className="flex gap-6 mt-3 flex-wrap">
                {[
                  {label:'2025-26 Salary',val:capFmt(currentContract.salary)},
                  {label:'Contract',val:`${(contracts||[]).length}yr`},
                  {label:'Total Value',val:capFmt(totalValue)},
                ].map(item=>(
                  <div key={item.label}>
                    <div className="text-xs" style={{color:'#8a8279'}}>{item.label}</div>
                    <div className="font-bold" style={{color:'#1a1512'}}>{item.val}</div>
                  </div>
                ))}
                <div>
                  <div className="text-xs" style={{color:'#8a8279'}}>Type</div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{background:TYPE_LABEL[currentContract.type]?.bg||'#f0ece5',
                                color:TYPE_LABEL[currentContract.type]?.color||'#5c554e'}}>
                    {TYPE_LABEL[currentContract.type]?.label||currentContract.type}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {p.gleague_team_id && !p.team_id && (
        <div style={{margin:'0 0 16px',padding:'16px',borderRadius:12,border:'1px solid #1a3a2a',background:'#0f1f15'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#4ade80',marginBottom:8,letterSpacing:1}}>G-LEAGUE CONTRACT</div>
          <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
            <div><div style={{fontSize:11,color:'#4ade80',opacity:0.7}}>Salary</div><div style={{fontWeight:700,color:'#4ade80'}}>$50,000</div></div>
            <div><div style={{fontSize:11,color:'#4ade80',opacity:0.7}}>Type</div><div style={{fontWeight:700,color:'#4ade80'}}>G-League</div></div>
            <div><div style={{fontSize:11,color:'#4ade80',opacity:0.7}}>Season</div><div style={{fontWeight:700,color:'#4ade80'}}>2025-26</div></div>
          </div>
        </div>
      )}
      {!p.team_id && <OfferButton playerId={p.id} isAssigned={!!p.on_gleague_assignment}/>}

      {/* CONTRACT EXTENSION — only shows if eligible (≤2 years left) and on a roster */}
      {p.team_id && <ContractExtensionPanel playerId={p.id}/>}

      {p.team_id && p.nba_recruitable !== false && (
        <div className="mb-4">
          {p.on_gleague_assignment ? (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                 style={{background:'#fef9c3',border:'1px solid #b45309'}}>
              <div className="text-xs font-semibold" style={{color:'#b45309'}}>On G-League Assignment</div>
              <form action="/api/gleague/recall" method="POST">
                <input type="hidden" name="playerId" value={p.id}/>
                <button type="submit" className="text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{background:'#1d4ed8',color:'#fff'}}>Recall to NBA</button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl flex-wrap gap-2"
                 style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <div className="text-xs" style={{color:'#5c554e'}}>Available for G-League assignment</div>
              <div className="flex items-center gap-2 flex-wrap">
                <form action="/api/gleague/assign" method="POST">
                  <input type="hidden" name="playerId" value={p.id}/>
                  <input type="hidden" name="teamId" value={p.team_id}/>
                  <button type="submit" className="text-xs font-bold px-3 py-1.5 rounded-lg"
                          style={{background:'#15803d',color:'#fff'}}>Send to G-League</button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {p.nba_recruitable === false && (
        <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-2"
             style={{background:'#fef9c3',border:'1px solid #b45309'}}>
          <i className="ti ti-world" style={{fontSize:16,color:'#b45309'}}></i>
          <span className="text-xs font-semibold" style={{color:'#b45309'}}>
            International player — not available for NBA contracts. Pre-season friendly only.
          </span>
        </div>
      )}

      {/* ATTRIBUTES */}
      <div className="sec-hdr mb-4"><span className="sec-title">Attributes</span></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {ATTR_GROUPS.map(group => (
          <div key={group.label} className="rounded-xl p-4"
               style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'2px solid '+group.color}}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3"
                 style={{color:group.color,letterSpacing:'1px'}}>{group.label}</div>
            {group.attrs.map(attr => (
              <div key={attr.key} className="mb-2">
                <div className="text-xs mb-0.5 flex items-center" style={{color:'#5c554e'}}>
                  {attr.label}
                  {ATTR_TIPS[attr.key] && <AttrTooltip tip={ATTR_TIPS[attr.key]}/>}
                </div>
                <AttrBar value={(p as any)[attr.key]||0} color={group.color}/>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* STATS */}
      <div className="sec-hdr mb-3"><span className="sec-title">Season Statistics</span></div>
      {(stats||[]).length > 0 ? (
        <div className="rounded-xl overflow-hidden mb-6" style={{border:'1px solid #d4cdc5'}}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{minWidth:700}}>
              <thead>
                <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                  {['Season','GP','MIN','PPG','RPG','APG','SPG','BPG','OREB','DREB','FG%','3P%','FT%','TO','PF','TD','+/-'].map(h=>(
                    <th key={h} className="px-2.5 py-2.5 font-bold text-right first:text-left"
                        style={{color:'#5c554e',whiteSpace:'nowrap',fontSize:10}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(stats||[]).map((s:any,i:number) => {
                  const gp=s.games||0
                  const avg=(v:number)=>gp>0?(v/gp).toFixed(1):'—'
                  const avgM=(v:number)=>gp>0?(v/gp).toFixed(0):'—'
                  const pctS=(m:number,a:number)=>a>0?(m/a*100).toFixed(1)+'%':'—'
                  const oreb=s.oreb||0
                  const dreb=s.reb?(s.reb-oreb):0
                  const pm=s.plus_minus||0
                  return (
                    <tr key={s.id||i} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <td className="px-2.5 py-2.5 font-bold" style={{color:'#1a1512',whiteSpace:'nowrap'}}>{s.season}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{gp}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{avgM(s.mins||0)}</td>
                      <td className="px-2.5 py-2.5 text-right font-bold" style={{color:'#b45309'}}>{avg(s.pts)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#15803d'}}>{avg(s.reb)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#1d4ed8'}}>{avg(s.ast)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#6d28d9'}}>{avg(s.stl)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#c2410c'}}>{avg(s.blk)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{avg(oreb)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{avg(dreb)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{pctS(s.fgm,s.fga)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{pctS(s.tpm,s.tpa)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{pctS(s.ftm,s.fta)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#dc2626'}}>{avg(s.turnovers)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#8a8279'}}>{avg(s.pf||0)}</td>
                      <td className="px-2.5 py-2.5 text-right font-bold" style={{color:s.triple_doubles>0?'#6d28d9':'#8a8279'}}>{s.triple_doubles||0}</td>
                      <td className="px-2.5 py-2.5 text-right font-semibold"
                          style={{color:pm>0?'#15803d':pm<0?'#dc2626':'#8a8279'}}>
                        {pm>0?'+':''}{pm||0}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs" style={{color:'#a89f97',borderTop:'1px solid #e2dcd5',background:'#f5f1eb'}}>
            Per game averages · TD = Triple-Doubles · +/- = season total
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4 text-center mb-6" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <p className="text-sm" style={{color:'#5c554e'}}>No stats yet — season hasn't started.</p>
        </div>
      )}

      {/* LAST 5 GAMES */}
      <div className="mt-6">
        <div className="sec-hdr mb-4"><span className="sec-title">Last 5 Games</span></div>
        {(lastGames||[]).length === 0 ? (
          <div className="rounded-xl p-4 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
            <p className="text-sm" style={{color:'#8a8279'}}>No games played yet.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{minWidth:600}}>
                <thead>
                  <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                    {['Date','Matchup','Result','MIN','PTS','REB','AST','STL','BLK','FG','3P','FT','+/-'].map(h=>(
                      <th key={h} className="px-2.5 py-2.5 font-bold text-right first:text-left"
                          style={{color:'#5c554e',fontSize:10,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(lastGames||[]).map((b:any,i:number) => {
                    const g = b.games
                    if (!g || !g.home || !g.away) return null
                    const isHome = g.home_team === p.team_id
                    const opp = isHome ? g.away : g.home
                    const myScore = isHome ? g.home_score : g.away_score
                    const oppScore = isHome ? g.away_score : g.home_score
                    const won = (myScore||0) > (oppScore||0)
                    const oppColor = readableTeamColor(opp?.color||'#5c554e')
                    return (
                      <tr key={b.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                        <td className="px-2.5 py-2.5 whitespace-nowrap" style={{color:'#8a8279'}}>
                          {g.played_at ? new Date(g.played_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'}
                        </td>
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <span style={{color:'#8a8279'}}>{isHome?'vs':'@'} </span>
                          <span style={{color:oppColor,fontWeight:600}}>{opp?.name||'—'}</span>
                        </td>
                        <td className="px-2.5 py-2.5 font-bold whitespace-nowrap"
                            style={{color:won?'#15803d':'#dc2626'}}>
                          {won?'W':'L'} {myScore}-{oppScore}
                        </td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{b.mins||0}</td>
                        <td className="px-2.5 py-2.5 text-right font-bold" style={{color:'#b45309'}}>{b.pts||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#15803d'}}>{b.reb||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#1d4ed8'}}>{b.ast||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#6d28d9'}}>{b.stl||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#c2410c'}}>{b.blk||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{b.fgm||0}/{b.fga||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{b.tpm||0}/{b.tpa||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{b.ftm||0}/{b.fta||0}</td>
                        <td className="px-2.5 py-2.5 text-right font-semibold"
                            style={{color:(b.plus_minus||0)>0?'#15803d':(b.plus_minus||0)<0?'#dc2626':'#8a8279'}}>
                          {(b.plus_minus||0)>0?'+':''}{b.plus_minus||0}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* INJURY HISTORY */}
      <div className="mt-6 mb-6">
        <div className="sec-hdr mb-4"><span className="sec-title">Injury History</span></div>
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          {(injuries||[]).length === 0 ? (
            <div className="px-4 py-5 text-center" style={{background:'#faf8f5'}}>
              <p className="text-sm" style={{color:'#8a8279'}}>No injury history — clean bill of health.</p>
            </div>
          ) : (injuries||[]).map((inj:any,i:number) => (
            <div key={inj.id} className="flex items-center gap-4 px-4 py-3"
                 style={{borderBottom:i<(injuries||[]).length-1?'1px solid #e2dcd5':'none',
                         background:i%2===0?'#faf8f5':'#f5f1eb'}}>
              <i className="ti ti-alert-triangle" style={{fontSize:16,color:'#dc2626',flexShrink:0}}></i>
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{color:'#dc2626'}}>{inj.injury_type}</div>
                <div className="text-xs mt-0.5" style={{color:'#8a8279'}}>
                  {new Date(inj.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
                </div>
              </div>
              <div className="text-sm font-semibold text-right" style={{color:'#5c554e'}}>
                {inj.games_out} game{inj.games_out!==1?'s':''} out
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AWARDS */}
      <div className="mt-2">
        <div className="sec-hdr mb-4"><span className="sec-title">Awards & Honours</span></div>
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          {(playerAwards||[]).length === 0 ? (
            <div className="px-4 py-6 text-center" style={{background:'#faf8f5'}}>
              <i className="ti ti-trophy" style={{fontSize:28,color:'#d4cdc5'}}></i>
              <p className="text-sm mt-2" style={{color:'#8a8279'}}>No awards yet</p>
            </div>
          ) : (playerAwards||[]).map((a:any,i:number) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3"
                 style={{borderBottom:i<(playerAwards||[]).length-1?'1px solid #e2dcd5':'none',
                         background:i%2===0?'#faf8f5':'#f5f1eb'}}>
              <i className="ti ti-award" style={{fontSize:16,color:AWARD_COLORS[a.award_type]||'#b45309',flexShrink:0}}></i>
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{color:'#1a1512'}}>{AWARD_LABELS[a.award_type]||a.award_type}</div>
                <div className="text-xs" style={{color:'#8a8279'}}>
                  {a.season} · {a.period?.replace('week_','Week ').replace('month_','Month ').replace('season','Full Season')}
                </div>
              </div>
              {a.stats_context?.ppg && (
                <div className="text-xs font-semibold" style={{color:'#5c554e'}}>
                  {a.stats_context.ppg} PPG
                  {a.stats_context.rpg && ` · ${a.stats_context.rpg} RPG`}
                  {a.stats_context.apg && ` · ${a.stats_context.apg} APG`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CONTRACT */}
      {(contracts||[]).length > 0 && (
        <div className="mt-6">
          <div className="sec-hdr mb-3"><span className="sec-title">Contract</span></div>
          <div className="rounded-xl overflow-hidden mb-6" style={{border:'1px solid #d4cdc5'}}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{background:'#f0ece5',borderBottom:'1px solid #d4cdc5'}}>
                  <th className="px-4 py-2.5 text-left font-semibold" style={{color:'#5c554e'}}>Season</th>
                  <th className="px-4 py-2.5 text-right font-semibold" style={{color:'#5c554e'}}>Salary</th>
                  <th className="px-4 py-2.5 text-right font-semibold" style={{color:'#5c554e'}}>Type</th>
                </tr>
              </thead>
              <tbody>
                {(contracts||[]).map((c:any,i:number) => {
                  const typeInfo=TYPE_LABEL[c.type]||{label:c.type,color:'#5c554e',bg:'#f0ece5'}
                  const isCurrent=c.season==='2025-26'
                  return (
                    <tr key={c.id} style={{background:isCurrent?tc+'11':i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold" style={{color:isCurrent?tc:'#1a1512'}}>{c.season}</span>
                        {isCurrent && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{background:tc+'22',color:tc}}>Current</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold" style={{color:'#1a1512'}}>{capFmt(c.salary)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                              style={{background:typeInfo.bg,color:typeInfo.color}}>{typeInfo.label}</span>
                      </td>
                    </tr>
                  )
                })}
                <tr style={{background:'#f0ece5',borderTop:'2px solid #d4cdc5'}}>
                  <td className="px-4 py-2.5 font-bold" style={{color:'#1a1512'}}>Total</td>
                  <td className="px-4 py-2.5 text-right font-black" style={{color:'#c8102e'}}>{capFmt(totalValue)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}

import { supabase } from '@/lib/supabase'
import type { Player, PlayerStats, Team } from '@/lib/types'
export const revalidate = 60

const ATTR_GROUPS = [
  { label: 'Scoring',      color: '#ffa040', attrs: [
    {key:'usage',label:'Usage Rate'},{key:'three',label:'Three Point'},
    {key:'layup',label:'Layup'},{key:'dunk',label:'Dunk'},
    {key:'mid',label:'Mid-Range'},{key:'ft',label:'Free Throws'},
    {key:'siq',label:'Shot IQ'},{key:'draw_foul',label:'Draw Foul'},
  ]},
  { label: 'Defense',      color: '#40e080', attrs: [
    {key:'blk',label:'Block'},{key:'stl',label:'Steal'},
    {key:'idef',label:'Interior Defense'},{key:'pdef',label:'Perimeter Defense'},
  ]},
  { label: 'Rebounding',   color: '#60a0ff', attrs: [
    {key:'def_reb',label:'Def. Rebound'},{key:'off_reb',label:'Off. Rebound'},
  ]},
  { label: 'Athleticism',  color: '#c040ff', attrs: [
    {key:'stamina',label:'Stamina'},{key:'durability',label:'Durability'},
  ]},
  { label: 'Playmaking',   color: '#40d0d0', attrs: [
    {key:'ball_hdl',label:'Ball Handle'},{key:'pass_vis',label:'Pass Vision'},
    {key:'pass_iq',label:'Pass IQ'},{key:'assist_role',label:'Assist Role'},
  ]},
  { label: 'Psychological',color: '#ffd040', attrs: [
    {key:'pressure',label:'Clutch/Pressure'},{key:'consistency',label:'Consistency'},
    {key:'crowd_effect',label:'Crowd Effect'},{key:'streaky',label:'Streaky'},
    {key:'trash_talk',label:'Trash Talk'},
  ]},
]

function AttrBar({ value, color }: { value: number, color: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const barColor = value >= 85 ? '#ffd040' : value >= 70 ? color : value >= 50 ? color+'99' : '#e04040'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'#1e3a5f' }}>
        <div className="h-full rounded-full transition-all" style={{ width:pct+'%', background:barColor }}></div>
      </div>
      <span className="text-xs font-bold w-7 text-right"
            style={{ color: value>=85?'#ffd040':value>=70?'#e8eaf0':value>=50?'#7090b0':'#e04040' }}>
        {value}
      </span>
    </div>
  )
}

function RatingBadge({ value }: { value: number }) {
  const color = value>=85?'#ffd040':value>=75?'#40e080':value>=65?'#60a0ff':value>=55?'#7090b0':'#e04040'
  const bg    = value>=85?'#2a2000':value>=75?'#0a2a10':value>=65?'#0a1a3a':value>=55?'#1a2a3a':'#2a0a0a'
  return (
    <div className="flex flex-col items-center justify-center rounded-xl p-3"
         style={{ background:bg, border:'1px solid '+color+'44', minWidth:60 }}>
      <span className="text-2xl font-black" style={{ color }}>{value}</span>
      <span className="text-xs" style={{ color:color+'99' }}>OVR</span>
    </div>
  )
}

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const [{ data: player }, { data: stats }, { data: injuries }] = await Promise.all([
    supabase.from('players').select('*, teams(name,color,id)').eq('id', params.id).single(),
    supabase.from('player_stats').select('*').eq('player_id', params.id).order('season', { ascending: false }),
    supabase.from('injuries').select('*').eq('player_id', params.id).order('created_at', { ascending: false }),
  ])
  if (!player) return <div className="p-8 text-center" style={{ color:'#7090b0' }}>Player not found.</div>

  const p = player as any
  const team = p.teams as any
  const teamColor = '#' + (team?.color || '3a8adf')

  // Overall rating: weighted average of key attributes
  const ovr = Math.round((p.usage*.15 + p.siq*.12 + p.consistency*.10 + p.pressure*.08 +
    (p.layup+p.dunk)/2*.10 + p.three*.08 + p.idef*.08 + p.pdef*.07 +
    p.stamina*.05 + p.ball_hdl*.07 + p.pass_iq*.05 + p.def_reb*.05) / 1.0)

  const capFmt = (n:number) => n ? '$'+Math.round(n/1000000).toFixed(1)+'M' : '—'
  const pct = (m:number,a:number) => a>0?(m/a*100).toFixed(1)+'%':'—'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* HEADER */}
      <div className="rounded-2xl p-6 mb-6"
           style={{ background:'#0f1e33', borderTop:'4px solid '+teamColor, border:'1px solid #1e3a5f' }}>
        <div className="flex gap-5 flex-wrap items-start">
          {/* Photo or avatar */}
          <div className="flex-shrink-0">
            {p.photo_url
              ? <img src={p.photo_url} alt={p.name} className="w-28 h-28 rounded-xl object-cover"
                     style={{ border:'2px solid '+teamColor }} />
              : <div className="w-28 h-28 rounded-xl flex items-center justify-center text-3xl font-black"
                     style={{ background:teamColor+'22', color:teamColor, border:'2px solid '+teamColor }}>
                  {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color:teamColor }}>
                  {team?.name} · {p.pos}
                </div>
                <h1 className="text-3xl font-black text-white mb-1">{p.name}</h1>
                <div className="flex gap-4 text-sm flex-wrap">
                  {p.nationality && <span style={{ color:'#7090b0' }}>🌍 {p.nationality}</span>}
                  {p.age && <span style={{ color:'#7090b0' }}>Age {p.age}</span>}
                  {p.status !== 'active' && (
                    <span className="px-2 py-0.5 rounded font-semibold text-xs"
                          style={{ background:'#2a0a0a', color:'#ff4040' }}>
                      {p.status === 'injured' ? `🏥 ${p.injury_type||'Injured'}` : p.status}
                    </span>
                  )}
                </div>
              </div>
              <RatingBadge value={ovr} />
            </div>
            {/* Contract */}
            <div className="flex gap-6 mt-3 flex-wrap">
              <div>
                <div className="text-xs" style={{ color:'#506070' }}>Salary</div>
                <div className="font-bold text-white">{capFmt(p.salary)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color:'#506070' }}>Contract</div>
                <div className="font-bold text-white">{p.contract_years || 1}yr</div>
              </div>
              <div>
                <div className="text-xs" style={{ color:'#506070' }}>Status</div>
                <div className="font-bold" style={{ color: p.status==='active'?'#40e080':'#e04040' }}>
                  {p.status==='active'?'Active':p.status}
                </div>
              </div>
              {p.games_missed > 0 && (
                <div>
                  <div className="text-xs" style={{ color:'#506070' }}>Games Missed</div>
                  <div className="font-bold" style={{ color:'#ffa040' }}>{p.games_missed}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">

          {/* ATTRIBUTES */}
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:'#506070' }}>
            Attributes
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {ATTR_GROUPS.map(group => (
              <div key={group.label} className="rounded-xl p-4"
                   style={{ background:'#0f1e33', border:'1px solid #1e3a5f' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-3"
                     style={{ color:group.color }}>{group.label}</div>
                <div className="flex flex-col gap-2">
                  {group.attrs.map(attr => (
                    <div key={attr.key}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs" style={{ color:'#7090b0' }}>{attr.label}</span>
                      </div>
                      <AttrBar value={(p as any)[attr.key] || 0} color={group.color} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* SEASON STATS */}
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:'#506070' }}>
            Season Statistics
          </h2>
          {(stats||[]).length > 0 ? (
            <div className="rounded-xl overflow-hidden mb-6" style={{ border:'1px solid #1e3a5f' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background:'#060c18', borderBottom:'1px solid #1e3a5f' }}>
                    {['Season','GP','PPG','RPG','APG','SPG','BPG','FG%','3P%','FT%','TO'].map(h=>(
                      <th key={h} className="px-3 py-2 font-semibold text-right first:text-left"
                          style={{ color:'#7090b0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(stats||[]).map((s:any,i:number) => {
                    const gp=s.games||0
                    const avg=(v:number)=>gp>0?(v/gp).toFixed(1):'—'
                    return (
                      <tr key={s.id} style={{ background:i%2===0?'#0f1e33':'#0c1a2c',borderBottom:'1px solid #0a1628' }}>
                        <td className="px-3 py-2 font-semibold text-white">{s.season}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#7090b0' }}>{gp}</td>
                        <td className="px-3 py-2 text-right font-bold" style={{ color:'#ffa040' }}>{avg(s.pts)}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#40e080' }}>{avg(s.reb)}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#60a0ff' }}>{avg(s.ast)}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#c040ff' }}>{avg(s.stl)}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#ff6040' }}>{avg(s.blk)}</td>
                        <td className="px-3 py-2 text-right">{pct(s.fgm,s.fga)}</td>
                        <td className="px-3 py-2 text-right">{pct(s.tpm,s.tpa)}</td>
                        <td className="px-3 py-2 text-right">{pct(s.ftm,s.fta)}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#e04040' }}>{avg(s.turnovers)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl p-4 text-center mb-6"
                 style={{ background:'#0f1e33',border:'1px solid #1e3a5f' }}>
              <p className="text-sm" style={{ color:'#506070' }}>No stats yet — season hasn't started.</p>
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-4">
          {/* QUICK STATS */}
          <div className="rounded-xl p-4" style={{ background:'#0f1e33',border:'1px solid #1e3a5f' }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:'#506070' }}>
              This Season
            </h3>
            {(stats||[])[0] ? (() => {
              const s = (stats||[])[0] as any
              const gp = s.games||0
              const avg=(v:number)=>gp>0?(v/gp).toFixed(1):'—'
              return (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {label:'PPG',val:avg(s.pts),color:'#ffa040'},
                    {label:'RPG',val:avg(s.reb),color:'#40e080'},
                    {label:'APG',val:avg(s.ast),color:'#60a0ff'},
                    {label:'FG%',val:s.fga>0?(s.fgm/s.fga*100).toFixed(1)+'%':'—',color:'#c0ccd8'},
                    {label:'3P%',val:s.tpa>0?(s.tpm/s.tpa*100).toFixed(1)+'%':'—',color:'#ffd040'},
                    {label:'GP', val:gp,color:'#7090b0'},
                  ].map(item=>(
                    <div key={item.label} className="rounded-lg p-2.5 text-center"
                         style={{ background:'#060c18' }}>
                      <div className="text-lg font-black" style={{ color:item.color }}>{item.val}</div>
                      <div className="text-xs" style={{ color:'#506070' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              )
            })() : <p className="text-xs text-center" style={{ color:'#506070' }}>No stats yet.</p>}
          </div>

          {/* INJURY HISTORY */}
          <div className="rounded-xl p-4" style={{ background:'#0f1e33',border:'1px solid #1e3a5f' }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:'#506070' }}>
              Injury History
            </h3>
            {(injuries||[]).length > 0 ? (injuries||[]).map((inj:any) => (
              <div key={inj.id} className="py-2" style={{ borderBottom:'1px solid #1e3a5f' }}>
                <div className="text-sm font-semibold" style={{ color:'#ff4040' }}>{inj.injury_type}</div>
                <div className="text-xs mt-0.5" style={{ color:'#7090b0' }}>
                  {inj.games_out} games out ·{' '}
                  {new Date(inj.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                </div>
              </div>
            )) : (
              <p className="text-xs" style={{ color:'#506070' }}>No injury history. 💪</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

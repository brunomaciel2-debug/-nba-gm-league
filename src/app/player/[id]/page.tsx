import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { calcOvr } from '@/lib/ovr'
export const revalidate = 60

const ATTR_GROUPS = [
  { label: 'Scoring',       color: '#b45309', attrs: [
    {key:'usage',label:'Usage Rate'},{key:'three',label:'Three Point'},
    {key:'layup',label:'Layup'},{key:'dunk',label:'Dunk'},
    {key:'mid',label:'Mid-Range'},{key:'ft',label:'Free Throws'},
    {key:'siq',label:'Shot IQ'},{key:'draw_foul',label:'Draw Foul'},
  ]},
  { label: 'Defense',       color: '#15803d', attrs: [
    {key:'blk',label:'Block'},{key:'stl',label:'Steal'},
    {key:'idef',label:'Interior Defense'},{key:'pdef',label:'Perimeter Defense'},
  ]},
  { label: 'Rebounding',    color: '#1d4ed8', attrs: [
    {key:'def_reb',label:'Def. Rebound'},{key:'off_reb',label:'Off. Rebound'},
  ]},
  { label: 'Athleticism',   color: '#6d28d9', attrs: [
    {key:'stamina',label:'Stamina'},{key:'durability',label:'Durability'},
  ]},
  { label: 'Playmaking',    color: '#0e7490', attrs: [
    {key:'ball_hdl',label:'Ball Handle'},{key:'pass_vis',label:'Pass Vision'},
    {key:'pass_iq',label:'Pass IQ'},{key:'assist_role',label:'Assist Role'},
  ]},
  { label: 'Psychological', color: '#b45309', attrs: [
    {key:'pressure',label:'Clutch/Pressure'},{key:'consistency',label:'Consistency'},
    {key:'crowd_effect',label:'Crowd Effect'},{key:'streaky',label:'Streaky'},
    {key:'trash_talk',label:'Trash Talk'},
  ]},
]

const TYPE_LABEL: Record<string,{label:string,color:string,bg:string}> = {
  guaranteed:       {label:'Guaranteed',   color:'#166534', bg:'#0a2a10'},
  player_option:    {label:'Player Option', color:'#1e40af', bg:'#0a1a3a'},
  team_option:      {label:'Team Option',   color:'#c2410c', bg:'#2a2010'},
  two_way:          {label:'Two-Way',       color:'#7c3aed', bg:'#1a0a2a'},
  qualifying_offer: {label:'QO',            color:'#b45309', bg:'#2a2000'},
}

function AttrBar({ value, color }: { value: number, color: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const barColor = value>=85?'#b45309':value>=70?color:value>=50?color+'99':'#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'#d4cdc5' }}>
        <div className="h-full rounded-full" style={{ width:pct+'%', background:barColor }}></div>
      </div>
      <span className="text-xs font-bold w-7 text-right"
            style={{ color:value>=85?'#b45309':value>=70?'#1a1512':value>=50?'#5c554e':'#dc2626' }}>
        {value}
      </span>
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
      )}
    </div>
  )
}

function OVR({ value }: { value: number }) {
  const color = value>=85?'#b45309':value>=75?'#15803d':value>=65?'#1d4ed8':'#5c554e'
  const bg    = value>=85?'#2a2000':value>=75?'#0a2a10':value>=65?'#0a1a3a':'#f0ece5'
  return (
    <div className="flex flex-col items-center justify-center rounded-xl p-3 min-w-[60px]"
         style={{ background:bg, border:'1px solid '+color+'44' }}>
      <span className="text-2xl font-black" style={{ color }}>{value}</span>
      <span className="text-xs" style={{ color:color+'99' }}>OVR</span>
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
      )}
    </div>
  )
}

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const [{ data: player }, { data: stats }, { data: injuries }, { data: contracts }, { data: playerAwards }] =
    await Promise.all([
      supabase.from('players').select('*,nba_experience, teams(name,color,id,logo_url)').eq('id', params.id).single(),
      supabase.from('player_stats').select('*').eq('player_id', params.id).order('season', { ascending: false }),
      supabase.from('injury_log').select('*').eq('player_id', params.id).order('created_at', { ascending: false }),
      supabase.from('contracts').select('*').eq('player_id', params.id).order('season', { ascending: true }),
      supabase.from('awards').select('award_type,period,season,stats_context,created_at').eq('player_id', params.id).order('created_at',{ascending:false}),
    ])

  if (!player) return <div className="p-8 text-center" style={{ color:'#6b5f4e' }}>Player not found.</div>

  const p = player as any
  const team = p.teams as any
  const teamColor = '#'+(team?.color||'3a8adf')

  const ovr = calcOvr(p)

  const capFmt = (n:number) => n ? '$'+(n/1000000).toFixed(2)+'M' : '—'
  const pct    = (m:number,a:number) => a>0?(m/a*100).toFixed(1)+'%':'—'

  // Current season contract
  const currentContract = (contracts||[]).find((c:any) => c.season==='2025-26')
  const totalValue = (contracts||[]).reduce((sum:number,c:any) => sum+c.salary, 0)

  const potGrade = (p as any).potential_grade || 'C'
  const potColor: Record<string,string> = {A:'#b45309',B:'#15803d',C:'#1d4ed8',D:'#b45309',E:'#e06040',F:'#dc2626'}
  const potBg:    Record<string,string> = {A:'#2a2000',B:'#0a2a10',C:'#0a1a3a',D:'#2a1500',E:'#2a0800',F:'#2a0000'}


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
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">

      {/* HEADER */}
      <div className="rounded-2xl p-6 mb-6"
           style={{ background:'#e8e2d6', borderTop:'4px solid '+teamColor, border:'1px solid #d4cec3' }}>
        <div className="flex gap-5 flex-wrap items-start">
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
                <h1 className="text-3xl font-black text-white mb-2">{p.name}</h1>
                <div className="flex gap-4 text-sm flex-wrap">
                  {p.nationality && <span style={{ color:'#6b5f4e' }}>🌍 {p.nationality}</span>}
                  {p.age && <span style={{ color:'#6b5f4e' }}>Age {p.age}</span>}
                  {p.status !== 'active' && (
                    <span className="px-2 py-0.5 rounded font-semibold text-xs"
                          style={{ background:'#fee2e2', color:'#ff4040' }}>
                      🏥 {p.injury_type||'Injured'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <OVR value={ovr} />
                <div className="rounded-lg px-2.5 py-1.5 text-center"
                     style={{background:potBg[potGrade]||'#eee8df',border:'1px solid '+(potColor[potGrade]||'#5c554e')+'44'}}>
                  <div className="text-lg font-black leading-none" style={{color:potColor[potGrade]||'#5c554e'}}>{potGrade}</div>
                  <div style={{fontSize:9,color:'#6b5f4e'}}>POT</div>
                </div>
              </div>
            </div>
            {/* Current season quick info */}
            {currentContract && (
              <div className="flex gap-6 mt-3 flex-wrap">
                <div>
                  <div className="text-xs" style={{ color:'#6b5f4e' }}>2025-26 Salary</div>
                  <div className="font-bold text-white">{capFmt(currentContract.salary)}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color:'#6b5f4e' }}>Contract Length</div>
                  <div className="font-bold text-white">{(contracts||[]).length}yr</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color:'#6b5f4e' }}>Total Value</div>
                  <div className="font-bold text-white">{capFmt(totalValue)}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color:'#6b5f4e' }}>Type</div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{ background:TYPE_LABEL[currentContract.type]?.bg||'#f0ece5',
                                 color:TYPE_LABEL[currentContract.type]?.color||'#5c554e' }}>
                    {TYPE_LABEL[currentContract.type]?.label||currentContract.type}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HEALTH & MORALE */}
      {(() => {
        const health = p.health ?? 100
        const moral  = p.moral  ?? 80
        const hColor = health>=90?'#15803d':health>=80?'#a0e040':health>=65?'#b45309':health>=50?'#b45309':'#dc2626'
        const hLabel = health>=90?'Healthy':health>=80?'Good':health>=65?'Limited':health>=50?'Questionable':'OUT'
        const mColor = moral>=80?'#6d28d9':moral>=60?'#8030cc':'#dc2626'
        const mLabel = moral>=80?'High':moral>=60?'Normal':'Low'
        const perfNote = health>=90?'Full potential':health>=80?'~90% output':health>=65?'~75% output':health>=50?'~60% output · risk of aggravation':'Cannot play'
        return (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl p-4" style={{background:hColor+'18',border:'1px solid '+hColor+'55'}}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{color:'#6b5f4e'}}>❤️ Health</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{background:hColor+'33',color:hColor}}>{hLabel}</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden mb-2" style={{background:'#cec7bc'}}>
                <div className="h-full rounded-full" style={{width:health+'%',background:hColor}}></div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black" style={{color:hColor}}>{health}%</span>
                <span className="text-xs text-right" style={{color:'#6b5f4e',maxWidth:140}}>{perfNote}</span>
              </div>
            </div>
            <div className="rounded-xl p-4" style={{background:mColor+'18',border:'1px solid '+mColor+'55'}}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{color:'#6b5f4e'}}>🧠 Morale</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{background:mColor+'33',color:mColor}}>{mLabel}</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden mb-2" style={{background:'#cec7bc'}}>
                <div className="h-full rounded-full" style={{width:moral+'%',background:mColor}}></div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black" style={{color:mColor}}>{moral}%</span>
                <span className="text-xs text-right" style={{color:'#6b5f4e'}}>Affects consistency & clutch performance</span>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">

          {/* ATTRIBUTES */}
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:'#6b5f4e' }}>Attributes</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {ATTR_GROUPS.map(group => (
              <div key={group.label} className="rounded-xl p-4"
                   style={{ background:'#e8e2d6', border:'1px solid #d4cec3' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-3"
                     style={{ color:group.color }}>{group.label}</div>
                {group.attrs.map(attr => (
                  <div key={attr.key} className="mb-2">
                    <div className="text-xs mb-0.5" style={{ color:'#6b5f4e' }}>{attr.label}</div>
                    <AttrBar value={(p as any)[attr.key]||0} color={group.color} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* CONTRACT TABLE */}
          {(contracts||[]).length > 0 && (
            <>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:'#6b5f4e' }}>Contract</h2>
              <div className="rounded-xl overflow-hidden mb-6" style={{ border:'1px solid #d4cec3' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background:'#ddd7ca', borderBottom:'1px solid #d4cec3' }}>
                      <th className="px-4 py-2.5 text-left font-semibold" style={{ color:'#6b5f4e' }}>Season</th>
                      <th className="px-4 py-2.5 text-right font-semibold" style={{ color:'#6b5f4e' }}>Salary</th>
                      <th className="px-4 py-2.5 text-right font-semibold" style={{ color:'#6b5f4e' }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(contracts||[]).map((c:any, i:number) => {
                      const typeInfo = TYPE_LABEL[c.type]||{label:c.type,color:'#6b5f4e',bg:'#f0ece5'}
                      const isCurrent = c.season==='2025-26'
                      return (
                        <tr key={c.id}
                            style={{ background:isCurrent?teamColor+'11':i%2===0?'#faf8f5':'#faf8f5',
                                     borderBottom:'1px solid #16120d' }}>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold" style={{ color:isCurrent?teamColor:'#1a1512' }}>
                              {c.season}
                            </span>
                            {isCurrent && <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
                                               style={{ background:teamColor+'33',color:teamColor }}>Current</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold"
                              style={{ color:isCurrent?'#e8e2d6':'#1a1512' }}>
                            {capFmt(c.salary)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded"
                                  style={{ background:typeInfo.bg, color:typeInfo.color }}>
                              {typeInfo.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ background:'#ddd7ca', borderTop:'1px solid #3a3228' }}>
                      <td className="px-4 py-2.5 font-bold text-white">Total</td>
                      <td className="px-4 py-2.5 text-right font-black" style={{ color:'#c2410c' }}>
                        {capFmt(totalValue)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* SEASON STATS */}
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:'#6b5f4e' }}>Season Statistics</h2>
          {(stats||[]).length > 0 ? (
            <div className="rounded-xl overflow-hidden mb-6" style={{ border:'1px solid #d4cec3' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background:'#ddd7ca',borderBottom:'1px solid #d4cec3' }}>
                    {['Season','GP','PPG','RPG','APG','SPG','BPG','FG%','3P%','FT%','TO'].map(h=>(
                      <th key={h} className="px-3 py-2 font-semibold text-right first:text-left"
                          style={{ color:'#6b5f4e' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(stats||[]).map((s:any,i:number) => {
                    const gp=s.games||0
                    const avg=(v:number)=>gp>0?(v/gp).toFixed(1):'—'
                    return (
                      <tr key={s.id} style={{ background:i%2===0?'#ece7dd':'#e8e2d6',borderBottom:'1px solid #16120d' }}>
                        <td className="px-3 py-2 font-semibold text-white">{s.season}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#6b5f4e' }}>{gp}</td>
                        <td className="px-3 py-2 text-right font-bold" style={{ color:'#c2410c' }}>{avg(s.pts)}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#166534' }}>{avg(s.reb)}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#1e40af' }}>{avg(s.ast)}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#7c3aed' }}>{avg(s.stl)}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#ff6040' }}>{avg(s.blk)}</td>
                        <td className="px-3 py-2 text-right">{pct(s.fgm,s.fga)}</td>
                        <td className="px-3 py-2 text-right">{pct(s.tpm,s.tpa)}</td>
                        <td className="px-3 py-2 text-right">{pct(s.ftm,s.fta)}</td>
                        <td className="px-3 py-2 text-right" style={{ color:'#dc2626' }}>{avg(s.turnovers)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl p-4 text-center mb-6" style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
              <p className="text-sm" style={{ color:'#6b5f4e' }}>No stats yet — season hasn't started.</p>
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-4">

          {/* THIS SEASON STATS */}
          <div className="rounded-xl p-4" style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:'#6b5f4e' }}>This Season</h3>
            {(stats||[])[0] ? (() => {
              const s=(stats||[])[0] as any
              const gp=s.games||0
              const avg=(v:number)=>gp>0?(v/gp).toFixed(1):'—'
              return (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {label:'PPG',val:avg(s.pts),color:'#c2410c'},
                    {label:'RPG',val:avg(s.reb),color:'#166534'},
                    {label:'APG',val:avg(s.ast),color:'#1e40af'},
                    {label:'FG%',val:s.fga>0?(s.fgm/s.fga*100).toFixed(1)+'%':'—',color:'#1a1512'},
                    {label:'3P%',val:s.tpa>0?(s.tpm/s.tpa*100).toFixed(1)+'%':'—',color:'#b45309'},
                    {label:'GP', val:gp,color:'#6b5f4e'},
                  ].map(item=>(
                    <div key={item.label} className="rounded-lg p-2.5 text-center" style={{ background:'#ddd7ca' }}>
                      <div className="text-lg font-black" style={{ color:item.color }}>{item.val}</div>
                      <div className="text-xs" style={{ color:'#6b5f4e' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              )
            })() : <p className="text-xs text-center" style={{ color:'#6b5f4e' }}>No stats yet.</p>}
          </div>

          {/* INJURY HISTORY */}
          <div className="rounded-xl p-4" style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:'#6b5f4e' }}>Injury History</h3>
            {(injuries||[]).length > 0 ? (injuries||[]).map((inj:any) => (
              <div key={inj.id} className="py-2" style={{ borderBottom:'1px solid #d4cec3' }}>
                <div className="text-sm font-semibold" style={{ color:'#ff4040' }}>{inj.injury_type}</div>
                <div className="text-xs mt-0.5" style={{ color:'#6b5f4e' }}>
                  {inj.games_out} games ·{' '}
                  {new Date(inj.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                </div>
              </div>
            )) : (
              <p className="text-xs" style={{ color:'#6b5f4e' }}>No injury history. 💪</p>
            )}
          </div>

        </div>
      </div>

      {/* Awards */}
      {playerAwards && playerAwards.length > 0 && (
        <div className="mt-6">
          <div className="sec-hdr mb-4">
            <span className="sec-title">
              <i className="ti ti-trophy" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
              Awards & Honours
            </span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
            {playerAwards.map((a:any,i:number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3"
                   style={{borderBottom:i<playerAwards.length-1?'1px solid #e2dcd5':'none',
                           background:i%2===0?'#faf8f5':'#f5f1eb'}}>
                <i className="ti ti-award" style={{fontSize:16,color:AWARD_COLORS[a.award_type]||'#b45309',flexShrink:0}}></i>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{color:'#1a1512'}}>
                    {AWARD_LABELS[a.award_type]||a.award_type}
                  </div>
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
      )}
    </div>
  )
}

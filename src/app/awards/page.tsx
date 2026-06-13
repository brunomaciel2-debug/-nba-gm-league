import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60

const AWARD_META: Record<string,{label:string,icon:string,color:string,desc:string}> = {
  potw_eastern: {label:'Player of the Week',   icon:'ti-star',         color:'#b45309', desc:'Eastern Conference'},
  potw_western: {label:'Player of the Week',   icon:'ti-star',         color:'#1d4ed8', desc:'Western Conference'},
  potm_eastern: {label:'Player of the Month',  icon:'ti-calendar-star',color:'#b45309', desc:'Eastern Conference'},
  potm_western: {label:'Player of the Month',  icon:'ti-calendar-star',color:'#1d4ed8', desc:'Western Conference'},
  mvp:          {label:'MVP',                  icon:'ti-trophy',       color:'#c8102e', desc:'Most Valuable Player'},
  dpoy:         {label:'DPOY',                 icon:'ti-shield',       color:'#15803d', desc:'Defensive Player of the Year'},
  roy:          {label:'Rookie of the Year',   icon:'ti-bolt',         color:'#6d28d9', desc:'Best First-Year Player'},
  coy:          {label:'Coach of the Year',    icon:'ti-whistle',      color:'#0e7490', desc:'Best Head Coach'},
  mip:          {label:'Most Improved',        icon:'ti-trending-up',  color:'#c2410c', desc:'Most Improved Player'},
  finals_mvp:   {label:'Finals MVP',           icon:'ti-medal',        color:'#c8102e', desc:'Championship Series MVP'},
  all_nba_1:    {label:'1st Team All-NBA',     icon:'ti-award',        color:'#b45309', desc:''},
  all_nba_2:    {label:'2nd Team All-NBA',     icon:'ti-award',        color:'#5c554e', desc:''},
  all_nba_3:    {label:'3rd Team All-NBA',     icon:'ti-award',        color:'#8a8279', desc:''},
  all_rookie_1: {label:'1st Rookie Team',      icon:'ti-award',        color:'#6d28d9', desc:''},
  all_rookie_2: {label:'2nd Rookie Team',      icon:'ti-award',        color:'#8a8279', desc:''},
}

type Tab = 'weekly' | 'monthly' | 'yearly'

async function getAwards(type: 'weekly'|'monthly'|'yearly') {
  let types: string[] = []
  if (type==='weekly')  types = ['potw_eastern','potw_western']
  if (type==='monthly') types = ['potm_eastern','potm_western']
  if (type==='yearly')  types = ['mvp','dpoy','roy','coy','mip','finals_mvp','all_nba_1','all_nba_2','all_nba_3','all_rookie_1','all_rookie_2']

  const { data } = await supabase.from('awards')
    .select('*, players(id,name,pos,photo_url,team_id,teams(id,name,color,logo_url)), coaches(id,name,role,team_id,teams(id,name,color,logo_url))')
    .eq('season','2025-26')
    .in('award_type', types)
    .order('award_type').order('created_at',{ascending:false})

  return data || []
}

function AwardCard({ award }: { award: any }) {
  const meta = AWARD_META[award.award_type] || {label:award.award_type,icon:'ti-star',color:'#5c554e',desc:''}
  const isCoach = award.award_type === 'coy'
  const entity = isCoach ? award.coaches : award.players
  const team = entity?.teams
  const tc = team ? readableTeamColor(team.color) : '#5c554e'
  const stats = award.stats_context

  return (
    <div className="rounded-2xl overflow-hidden" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${meta.color}`}}>
      <div className="px-5 py-3 flex items-center justify-between" style={{background:'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
        <div className="flex items-center gap-2">
          <i className={`ti ${meta.icon}`} style={{fontSize:16,color:meta.color}}></i>
          <span className="text-xs font-bold uppercase tracking-widest" style={{color:meta.color,letterSpacing:'1px'}}>{meta.label}</span>
        </div>
        <div className="text-xs" style={{color:'#8a8279'}}>
          {meta.desc && <span>{meta.desc} · </span>}
          <span>{award.period?.replace('week_','Week ').replace('month_','Month ').replace('season','2025-26')}</span>
        </div>
      </div>

      <div className="p-5">
        {entity ? (
          <Link href={isCoach ? `/staff/${entity.id}` : `/player/${entity.id}`} className="no-underline group flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
                 style={{background:tc+'18',border:`1.5px solid ${tc}33`}}>
              {entity.photo_url || entity.logo_url
                ?<img src={entity.photo_url||entity.logo_url} alt="" className="w-full h-full object-cover"/>
                :<div className="w-full h-full flex items-center justify-center font-black text-lg" style={{color:tc}}>
                   {entity.photo_url
                     ?<img src={entity.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/>
                     :entity.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                 </div>}
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg group-hover:underline" style={{color:'#1a1512'}}>{entity.name}</div>
              <div className="text-sm" style={{color:tc}}>
                {entity.pos && <span className="mr-1.5">{entity.pos}</span>}
                {team?.name}
              </div>
              {stats && (
                <div className="flex gap-3 mt-1.5 flex-wrap">
                  {stats.ppg && <span className="text-xs font-semibold" style={{color:'#5c554e'}}>{stats.ppg} PPG</span>}
                  {stats.rpg && <span className="text-xs font-semibold" style={{color:'#5c554e'}}>{stats.rpg} RPG</span>}
                  {stats.apg && <span className="text-xs font-semibold" style={{color:'#5c554e'}}>{stats.apg} APG</span>}
                  {stats.games && <span className="text-xs" style={{color:'#8a8279'}}>{stats.games} GP</span>}
                </div>
              )}
            </div>
          </Link>
        ) : (
          <div className="text-center py-4" style={{color:'#8a8279'}}>
            <i className={`ti ${meta.icon}`} style={{fontSize:28,color:'#d4cdc5'}}></i>
            <p className="text-sm mt-2">Season in progress</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TeamAward({ awards, type }: { awards: any[], type: string }) {
  const meta = AWARD_META[type]
  const members = awards.filter(a=>a.award_type===type)
  if (!meta) return null

  return (
    <div className="rounded-2xl overflow-hidden" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${meta.color}`}}>
      <div className="px-5 py-3 flex items-center gap-2" style={{background:'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
        <i className={`ti ${meta.icon}`} style={{fontSize:16,color:meta.color}}></i>
        <span className="text-xs font-bold uppercase tracking-widest" style={{color:meta.color,letterSpacing:'1px'}}>{meta.label}</span>
        <span className="text-xs ml-auto" style={{color:'#8a8279'}}>2025-26 Season</span>
      </div>
      <div className="p-4">
        {members.length === 0 ? (
          <div className="text-center py-4" style={{color:'#8a8279'}}>
            <p className="text-sm">Available at end of season</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {members.map((a:any,i:number) => {
              const p = a.players
              const tc = p?.teams ? readableTeamColor(p.teams.color) : '#5c554e'
              return (
                <Link key={a.id} href={`/player/${p?.id}`} className="no-underline group flex items-center gap-3 px-3 py-2 rounded-xl transition-all"
                      style={{background:i%2===0?'#f5f1eb':'transparent'}}>
                  <span className="text-sm font-black w-5" style={{color:meta.color}}>{i+1}</span>
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                       style={{background:tc+'18'}}>
                    {p?.photo_url?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                      :<div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:tc}}>
                         {p?.photo_url
                           ?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/>
                           :p?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                       </div>}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold group-hover:underline" style={{color:'#1a1512'}}>{p?.name}</div>
                    <div className="text-xs" style={{color:tc}}>{p?.pos} · {p?.teams?.name}</div>
                  </div>
                  {a.stats_context?.ppg && (
                    <span className="text-xs font-semibold" style={{color:'#5c554e'}}>{a.stats_context.ppg} PPG</span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default async function AwardsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = (searchParams.tab || 'weekly') as Tab
  const awards = await getAwards(tab)

  // Group weekly by period
  const weeklyPeriods = Array.from(new Set(awards.filter(a=>a.award_type.startsWith('potw')).map((a:any)=>a.period)))
    .sort((a,b) => parseInt(b.split('_')[1]||'0') - parseInt(a.split('_')[1]||'0'))

  const monthlyPeriods = Array.from(new Set(awards.filter(a=>a.award_type.startsWith('potm')).map((a:any)=>a.period)))
    .sort((a,b) => parseInt(b.split('_')[1]||'0') - parseInt(a.split('_')[1]||'0'))

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="sec-hdr mb-6">
        <span className="sec-title">
          <i className="ti ti-trophy" style={{fontSize:16,marginRight:8,color:'#c8102e'}}></i>
          Awards — 2025-26 Season
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b" style={{borderColor:'#d4cdc5'}}>
        {([['weekly','Weekly'],['monthly','Monthly'],['yearly','Season Awards']] as const).map(([key,label]) => (
          <Link key={key} href={`/awards?tab=${key}`} className="no-underline">
            <div className="px-5 py-3 text-sm font-semibold transition-all"
                 style={{color: tab===key ? '#1a1512' : '#5c554e',
                         borderBottom: tab===key ? '3px solid #c8102e' : '3px solid transparent',
                         marginBottom: -1}}>
              {label}
            </div>
          </Link>
        ))}
      </div>

      {/* WEEKLY */}
      {tab === 'weekly' && (
        <div>
          {weeklyPeriods.length === 0 ? (
            <div className="text-center py-16">
              <i className="ti ti-star" style={{fontSize:48,color:'#d4cdc5'}}></i>
              <p className="text-base mt-4 font-semibold" style={{color:'#5c554e'}}>No weekly awards yet</p>
              <p className="text-sm mt-1" style={{color:'#8a8279'}}>Awards are calculated after each simulation run.</p>
            </div>
          ) : weeklyPeriods.map(period => (
            <div key={period} className="mb-8">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4"
                  style={{color:'#5c554e',letterSpacing:'1px'}}>
                {period.replace('week_','Week ')}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {['potw_eastern','potw_western'].map(type => {
                  const a = awards.find((aw:any)=>aw.award_type===type && aw.period===period)
                  return a ? <AwardCard key={type} award={a} /> : null
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MONTHLY */}
      {tab === 'monthly' && (
        <div>
          {monthlyPeriods.length === 0 ? (
            <div className="text-center py-16">
              <i className="ti ti-calendar-star" style={{fontSize:48,color:'#d4cdc5'}}></i>
              <p className="text-base mt-4 font-semibold" style={{color:'#5c554e'}}>No monthly awards yet</p>
              <p className="text-sm mt-1" style={{color:'#8a8279'}}>Monthly awards are calculated every 4 simulation weeks.</p>
            </div>
          ) : monthlyPeriods.map(period => (
            <div key={period} className="mb-8">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4"
                  style={{color:'#5c554e',letterSpacing:'1px'}}>
                {period.replace('month_','Month ')}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {['potm_eastern','potm_western'].map(type => {
                  const a = awards.find((aw:any)=>aw.award_type===type && aw.period===period)
                  return a ? <AwardCard key={type} award={a} /> : null
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* YEARLY */}
      {tab === 'yearly' && (
        <div>
          {/* Individual awards */}
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>Individual Awards</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {['mvp','dpoy','roy','coy','mip','finals_mvp'].map(type => {
              const a = awards.find((aw:any)=>aw.award_type===type)
              const meta = AWARD_META[type]
              if (!a) return (
                <div key={type} className="rounded-2xl overflow-hidden" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${meta.color}`}}>
                  <div className="px-5 py-3 flex items-center gap-2" style={{background:'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                    <i className={`ti ${meta.icon}`} style={{fontSize:16,color:meta.color}}></i>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{color:meta.color,letterSpacing:'1px'}}>{meta.label}</span>
                  </div>
                  <div className="p-5 text-center">
                    <i className={`ti ${meta.icon}`} style={{fontSize:32,color:'#d4cdc5'}}></i>
                    <p className="text-sm mt-2" style={{color:'#8a8279'}}>Season in progress</p>
                    <p className="text-xs mt-1" style={{color:'#a89f97'}}>{meta.desc}</p>
                  </div>
                </div>
              )
              return <AwardCard key={type} award={a} />
            })}
          </div>

          {/* Team awards */}
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>All-NBA Teams</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {['all_nba_1','all_nba_2','all_nba_3'].map(type => (
              <TeamAward key={type} awards={awards} type={type} />
            ))}
          </div>

          <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>All-Rookie Teams</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {['all_rookie_1','all_rookie_2'].map(type => (
              <TeamAward key={type} awards={awards} type={type} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

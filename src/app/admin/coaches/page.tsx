import { supabase } from '@/lib/supabase'
import Link from 'next/link'
export const revalidate = 60

const ROLE_LABEL: Record<string,{label:string,color:string,icon:string}> = {
  head_coach:      {label:'Head Coach',       color:'#ffd040',icon:'🎯'},
  assistant_coach: {label:'Assistant Coach',  color:'#60a0ff',icon:'📋'},
  trainer:         {label:'Trainer',          color:'#40e080',icon:'💪'},
  physio:          {label:'Physio',           color:'#c040ff',icon:'🏥'},
}

export default async function CoachesPage() {
  const [{ data: coaches }, { data: teams }] = await Promise.all([
    supabase.from('coaches').select('*').order('role').order('name'),
    supabase.from('teams').select('id,name,color,logo_url'),
  ])
  const teamMap = Object.fromEntries((teams||[]).map((t:any)=>[t.id,t]))

  const assigned  = (coaches||[]).filter((c:any) => c.team_id)
  const freeAgents = (coaches||[]).filter((c:any) => !c.team_id)

  const byTeam: Record<string,any[]> = {}
  assigned.forEach((c:any) => {
    if (!byTeam[c.team_id]) byTeam[c.team_id] = []
    byTeam[c.team_id].push(c)
  })

  const capFmt = (n:number) => '$'+Math.round(n/1000000).toFixed(1)+'M'

  const CoachCard = ({ c }: { c: any }) => {
    const role = ROLE_LABEL[c.role] || { label:c.role, color:'#8a7a6a', icon:'👤' }
    return (
      <div className="rounded-xl p-3" style={{background:'#241f18',border:'1px solid #3a3228'}}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="font-semibold text-sm" style={{color:'#f0ebe0'}}>{c.name}</div>
            <div className="text-xs flex items-center gap-1" style={{color:role.color}}>
              {role.icon} {role.label}
              {c.specialty && <span style={{color:'#8a7a6a'}}> · {c.specialty}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold" style={{color:'#ffa040'}}>{capFmt(c.salary)}</div>
            <div className="text-xs" style={{color:'#6a5a4a'}}>{c.contract_years}yr</div>
          </div>
        </div>
        {/* Key stats per role */}
        {c.role === 'head_coach' && (
          <div className="grid grid-cols-3 gap-1">
            {[['OFF',c.offense_iq,'#ffa040'],['DEF',c.defense_iq,'#40e080'],['DEV',c.player_dev,'#60a0ff'],
              ['MOT',c.motivation,'#c040ff'],['MGT',c.game_mgmt,'#ffd040']].map(([l,v,col])=>(
              <div key={l as string} className="rounded px-2 py-1 text-center" style={{background:'#1a1610'}}>
                <div className="text-xs font-bold" style={{color:col as string}}>{v}</div>
                <div className="text-xs" style={{color:'#6a5a4a'}}>{l}</div>
              </div>
            ))}
          </div>
        )}
        {c.role === 'assistant_coach' && (
          <div className="flex gap-2">
            <div className="rounded px-2 py-1 text-center" style={{background:'#1a1610'}}>
              <div className="text-xs font-bold" style={{color:'#60a0ff'}}>{c.specialty_boost}</div>
              <div className="text-xs" style={{color:'#6a5a4a'}}>Boost</div>
            </div>
            <div className="rounded px-2 py-1 text-center" style={{background:'#1a1610'}}>
              <div className="text-xs font-bold" style={{color:'#40e080'}}>{c.player_dev}</div>
              <div className="text-xs" style={{color:'#6a5a4a'}}>Dev</div>
            </div>
          </div>
        )}
        {c.role === 'trainer' && (
          <div className="grid grid-cols-3 gap-1">
            {[['COND',c.conditioning,'#40e080'],['REC',c.recovery_boost,'#60a0ff'],['INJ',c.injury_prevent,'#ffd040']].map(([l,v,col])=>(
              <div key={l as string} className="rounded px-2 py-1 text-center" style={{background:'#1a1610'}}>
                <div className="text-xs font-bold" style={{color:col as string}}>{v}</div>
                <div className="text-xs" style={{color:'#6a5a4a'}}>{l}</div>
              </div>
            ))}
          </div>
        )}
        {c.role === 'physio' && (
          <div className="flex gap-2">
            <div className="rounded px-2 py-1 text-center" style={{background:'#1a1610'}}>
              <div className="text-xs font-bold" style={{color:'#c040ff'}}>{c.rehab_speed}</div>
              <div className="text-xs" style={{color:'#6a5a4a'}}>Rehab</div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#f0ebe0'}}>🎯 Coaching Staff</h1>
          <p className="text-sm" style={{color:'#8a7a6a'}}>All 30 teams + free agent coaches available for hire.</p>
        </div>
        <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg no-underline"
              style={{background:'#3a3228',color:'#8a7a6a'}}>← Admin</Link>
      </div>

      {/* Teams */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{color:'#6a5a4a'}}>Team Staff</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {Object.entries(byTeam).map(([teamId, staff]) => {
          const t = teamMap[teamId]
          return (
            <div key={teamId} className="rounded-xl overflow-hidden" style={{border:'1px solid #3a3228'}}>
              <div className="flex items-center gap-2 px-4 py-2.5" style={{background:'#120f0a',borderBottom:'1px solid #3a3228'}}>
                {t?.logo_url && <img src={t.logo_url} alt="" className="w-5 h-5 object-contain"/>}
                <span className="font-bold text-sm" style={{color:'#f0ebe0'}}>{t?.name||teamId}</span>
              </div>
              <div className="p-3 flex flex-col gap-2">
                {staff.map(c => <CoachCard key={c.id} c={c} />)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Free Agents */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{color:'#6a5a4a'}}>
        🆓 Free Agent Coaches ({freeAgents.length})
      </h2>
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
        {freeAgents.map(c => <CoachCard key={c.id} c={c} />)}
      </div>
    </div>
  )
}

import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const ROLE_ORDER = ['head_coach','assistant_coach','trainer','physio']
const ROLE_INFO: Record<string,{label:string,color:string,icon:string}> = {
  head_coach:      {label:'Head Coach',      color:'#b45309',icon:'🎯'},
  assistant_coach: {label:'Assistant Coach', color:'#1d4ed8',icon:'📋'},
  trainer:         {label:'Trainer',         color:'#15803d',icon:'💪'},
  physio:          {label:'Physio',          color:'#6d28d9',icon:'🏥'},
}
const ATK_LABELS: Record<string,string> = {
  motion:'Motion',pickroll:'Pick & Roll',transition:'Fast Break',iso:'Isolation',post:'Post-Up'
}
const DEF_LABELS: Record<string,string> = {
  man:'Man-to-Man',zone23:'Zone 2-3',press:'Full Press',pack:'Pack Paint'
}

function StatBar({ label, value, color }: { label: string, value: number, color: string }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs flex-shrink-0" style={{color:'#5c554e',width:96}}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#cec7bc'}}>
        <div className="h-full rounded-full" style={{width:value+'%',background:color}}></div>
      </div>
      <span className="text-xs font-bold w-6 text-right flex-shrink-0"
            style={{color:value>=85?'#b45309':value>=70?color:'#8a8279'}}>{value}</span>
    </div>
  )
}

function PersonalityBar({ value }: { value: number }) {
  const pct = ((value-1)/9)*100
  const color = value<=3?'#3b82f6':value<=6?'#22c55e':value<=8?'#f97316':'#ef4444'
  const label = value<=3?'Calm':value<=6?'Balanced':value<=8?'Intense':'Hot-headed'
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{color:'#5c554e'}}>Personality</span>
        <span className="font-semibold" style={{color}}>{label} {value}/10</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden relative"
           style={{background:'linear-gradient(to right,#3b82f6 0%,#22c55e 33%,#f97316 66%,#ef4444 100%)'}}>
        <div className="absolute top-0 h-full w-2 rounded-full bg-white"
             style={{left:`calc(${pct}% - 4px)`,boxShadow:'0 0 0 2px rgba(0,0,0,0.2)'}}></div>
      </div>
      <div className="flex justify-between text-xs mt-0.5" style={{color:'#a89f97'}}>
        <span>Calm</span><span>Intense</span>
      </div>
    </div>
  )
}

export default async function CoachingStaff({ teamId }: { teamId: string }) {
  const { data: staff } = await supabase
    .from('coaches').select('*').eq('team_id', teamId)

  if (!staff || staff.length === 0) return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e',letterSpacing:'1.5px'}}>COACHING STAFF</h2>
      <div className="rounded-xl p-4 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <p className="text-sm" style={{color:'#8a8279'}}>No staff assigned.</p>
      </div>
    </div>
  )

  const sorted = [...staff].sort((a:any,b:any) =>
    ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  )

  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>COACHING STAFF</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sorted.map((c:any) => {
          const info = ROLE_INFO[c.role] || {label:c.role,color:'#5c554e',icon:'👤'}
          const isCoach = c.role==='head_coach'||c.role==='assistant_coach'
          return (
            <Link key={c.id} href={`/staff/${c.id}`} className="no-underline group">
              <div className="rounded-xl p-4 h-full transition-all group-hover:brightness-95"
                   style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'3px solid '+info.color}}>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs font-semibold mb-0.5" style={{color:info.color}}>
                      {info.icon} {info.label}
                    </div>
                    <div className="font-bold" style={{color:'#1a1512'}}>{c.name}</div>
                    <div className="text-xs" style={{color:'#8a8279'}}>
                      {c.nationality}{c.age?` · Age ${c.age}`:''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold" style={{color:'#b45309'}}>
                      ${(c.salary/1000000).toFixed(1)}M
                    </div>
                    <div className="text-xs" style={{color:'#8a8279'}}>{c.contract_years}yr</div>
                  </div>
                </div>

                {isCoach && (
                  <>
                    <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'#b45309',letterSpacing:'1px'}}>
                      Game Time
                    </div>
                    <StatBar label="Off. Adjust"   value={c.off_adjustment}  color="#b45309" />
                    <StatBar label="Def. Adjust"   value={c.def_adjustment}  color="#15803d" />
                    <StatBar label="Substitutions" value={c.substitutions}   color="#1d4ed8" />
                    <StatBar label="Timeout Mgmt"  value={c.timeout_mgmt}    color="#b45309" />

                    <div className="text-xs font-bold uppercase tracking-wider mb-2 mt-3" style={{color:'#6d28d9',letterSpacing:'1px'}}>
                      Practice
                    </div>
                    <StatBar label="Off. Dev"  value={c.off_development} color="#b45309" />
                    <StatBar label="Def. Dev"  value={c.def_development} color="#15803d" />
                    <StatBar label="Tactical"  value={c.tactical_dev}    color="#1d4ed8" />
                    <StatBar label="Physical"  value={c.physical_dev}    color="#6d28d9" />
                    <StatBar label="Mental"    value={c.mental_dev}      color="#b45309" />

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="text-xs px-2 py-0.5 rounded font-semibold"
                            style={{background:'#b45309',color:'#fff'}}>
                        {ATK_LABELS[c.pref_atk_style]||c.pref_atk_style}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-semibold"
                            style={{background:'#15803d',color:'#fff'}}>
                        {DEF_LABELS[c.pref_def_style]||c.pref_def_style}
                      </span>
                    </div>
                    <PersonalityBar value={c.personality||5} />
                  </>
                )}

                {c.role==='trainer' && (
                  <>
                    <StatBar label="Conditioning" value={c.conditioning}    color="#15803d" />
                    <StatBar label="Recovery"     value={c.recovery_boost}  color="#1d4ed8" />
                    <StatBar label="Inj. Prevent" value={c.injury_prevent}  color="#b45309" />
                  </>
                )}

                {c.role==='physio' && (
                  <StatBar label="Rehab Speed" value={c.rehab_speed} color="#6d28d9" />
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

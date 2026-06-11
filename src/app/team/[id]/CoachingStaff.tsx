import { supabase } from '@/lib/supabase'

const ROLE_INFO: Record<string,{label:string,color:string,icon:string}> = {
  head_coach:      {label:'Head Coach',      color:'#ffd040',icon:'🎯'},
  assistant_coach: {label:'Assistant Coach', color:'#60a0ff',icon:'📋'},
  trainer:         {label:'Trainer',         color:'#40e080',icon:'💪'},
  physio:          {label:'Physio',          color:'#c040ff',icon:'🏥'},
}

const ATK_LABELS: Record<string,string> = {
  motion:'Motion',pickroll:'Pick & Roll',transition:'Fast Break',iso:'Isolation',post:'Post-Up'
}
const DEF_LABELS: Record<string,string> = {
  man:'Man-to-Man',zone23:'Zone 2-3',press:'Full Press',pack:'Pack Paint'
}

function PersonalityBar({ value }: { value: number }) {
  const pct = ((value - 1) / 9) * 100
  const color = value <= 3 ? '#60a0ff' : value <= 6 ? '#40e080' : value <= 8 ? '#ffa040' : '#e04040'
  const label = value <= 3 ? 'Calm' : value <= 6 ? 'Balanced' : value <= 8 ? 'Intense' : 'Hot-headed'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{color:'#6a5a4a'}}>Personality</span>
        <span className="font-semibold" style={{color}}>{label} ({value}/10)</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden relative" style={{background:'linear-gradient(to right,#60a0ff,#40e080,#ffa040,#e04040)'}}>
        <div className="absolute top-0 h-full w-1.5 rounded-full bg-white shadow-md" style={{left:`calc(${pct}% - 3px)`}}></div>
      </div>
    </div>
  )
}

function StatBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs w-20 flex-shrink-0" style={{color:'#6a5a4a'}}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'#3a3228'}}>
        <div className="h-full rounded-full" style={{width:value+'%',background:color}}></div>
      </div>
      <span className="text-xs font-bold w-6 text-right" style={{color}}>{value}</span>
    </div>
  )
}

export default async function CoachingStaff({ teamId }: { teamId: string }) {
  const { data: staff } = await supabase
    .from('coaches').select('*').eq('team_id', teamId).order('role')

  if (!staff || staff.length === 0) return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6a5a4a'}}>🎯 Coaching Staff</h2>
      <div className="rounded-xl p-4 text-center" style={{background:'#241f18',border:'1px solid #3a3228'}}>
        <p className="text-sm" style={{color:'#6a5a4a'}}>No staff assigned.</p>
      </div>
    </div>
  )

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{color:'#6a5a4a'}}>🎯 Coaching Staff</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {staff.map((c:any) => {
          const info = ROLE_INFO[c.role] || {label:c.role,color:'#8a7a6a',icon:'👤'}
          const isCoach = c.role==='head_coach'||c.role==='assistant_coach'
          return (
            <div key={c.id} className="rounded-xl p-4"
                 style={{background:'#241f18',border:'1px solid #3a3228',borderTop:'2px solid '+info.color}}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs font-semibold mb-0.5" style={{color:info.color}}>
                    {info.icon} {info.label}
                  </div>
                  <div className="font-bold" style={{color:'#f0ebe0'}}>{c.name}</div>
                  <div className="text-xs" style={{color:'#6a5a4a'}}>{c.nationality}{c.age?` · Age ${c.age}`:''}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold" style={{color:'#ffa040'}}>${Math.round(c.salary/1000000).toFixed(1)}M</div>
                  <div className="text-xs" style={{color:'#6a5a4a'}}>{c.contract_years}yr</div>
                </div>
              </div>

              {/* HC / AC attributes */}
              {isCoach && (
                <>
                  {/* Game Time */}
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'#ffa040'}}>⚡ Game Time</div>
                  <StatBar label="Off. Adjust"  value={c.off_adjustment||0}  color="#ffa040" />
                  <StatBar label="Def. Adjust"  value={c.def_adjustment||0}  color="#40e080" />
                  <StatBar label="Substitutions" value={c.substitutions||0}  color="#60a0ff" />
                  <StatBar label="Timeout Mgmt" value={c.timeout_mgmt||0}    color="#ffd040" />

                  {/* Practice Time */}
                  <div className="text-xs font-bold uppercase tracking-wider mb-2 mt-3" style={{color:'#c040ff'}}>📚 Practice Time</div>
                  <StatBar label="Off. Dev"   value={c.off_development||0}  color="#ffa040" />
                  <StatBar label="Def. Dev"   value={c.def_development||0}  color="#40e080" />
                  <StatBar label="Tactical"   value={c.tactical_dev||0}     color="#60a0ff" />
                  <StatBar label="Physical"   value={c.physical_dev||0}     color="#c040ff" />
                  <StatBar label="Mental"     value={c.mental_dev||0}       color="#ffd040" />

                  {/* Style preferences */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded" style={{background:'#2a1500',color:'#ffa040'}}>
                      ATK: {ATK_LABELS[c.pref_atk_style]||c.pref_atk_style}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{background:'#0a2a10',color:'#40e080'}}>
                      DEF: {DEF_LABELS[c.pref_def_style]||c.pref_def_style}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{background:'#2a2000',color:'#ffd040'}}>
                      +{c.style_boost}% match
                    </span>
                  </div>

                  {/* Personality */}
                  <div className="mt-3">
                    <PersonalityBar value={c.personality||5} />
                  </div>
                </>
              )}

              {/* Trainer attributes */}
              {c.role==='trainer' && (
                <>
                  <StatBar label="Conditioning"  value={c.conditioning||0}    color="#40e080" />
                  <StatBar label="Recovery"      value={c.recovery_boost||0}  color="#60a0ff" />
                  <StatBar label="Inj. Prevent"  value={c.injury_prevent||0}  color="#ffd040" />
                  <div className="text-xs mt-2" style={{color:'#5a4a3a'}}>
                    Reduces health loss & injury probability
                  </div>
                </>
              )}

              {/* Physio attributes */}
              {c.role==='physio' && (
                <>
                  <StatBar label="Rehab Speed"   value={c.rehab_speed||0}     color="#c040ff" />
                  <div className="text-xs mt-2" style={{color:'#5a4a3a'}}>
                    Reduces injury recovery time
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

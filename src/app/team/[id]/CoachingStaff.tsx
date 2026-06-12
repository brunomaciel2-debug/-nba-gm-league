import { supabase } from '@/lib/supabase'

const ROLE_ORDER = ['head_coach','assistant_coach','trainer','physio']
const ROLE_INFO: Record<string,{label:string,color:string,icon:string}> = {
  head_coach:      {label:'Head Coach',      color:'#b45309',icon:'🎯'},
  assistant_coach: {label:'Assistant Coach', color:'#2563eb',icon:'📋'},
  trainer:         {label:'Trainer',         color:'#16a34a',icon:'💪'},
  physio:          {label:'Physio',          color:'#7c3aed',icon:'🏥'},
}
const ATK_LABELS: Record<string,string> = {
  motion:'Motion',pickroll:'Pick & Roll',transition:'Fast Break',iso:'Isolation',post:'Post-Up'
}
const DEF_LABELS: Record<string,string> = {
  man:'Man-to-Man',zone23:'Zone 2-3',press:'Full Press',pack:'Pack Paint'
}

// Tooltips for each attribute
const TIPS: Record<string,string> = {
  off_adjustment:  'Offensive Adjustment — ability to tactically counter the opponent\'s defence in real time. Higher = better shot quality against any defence.',
  def_adjustment:  'Defensive Adjustment — ability to adapt the team\'s defence to the opponent\'s offensive system. Higher = fewer easy buckets allowed.',
  substitutions:   'Substitutions — making the right substitutions at the right moment. Affects fatigue management and matchup exploitation.',
  timeout_mgmt:    'Timeout Management — knowing when to call a timeout and what to say. Boosts morale during opponent runs and late-game pressure.',
  off_development: 'Offensive Development — improves players\' offensive attributes over time: Three Point, Layup, Dunk, Mid-Range, Free Throws, Shot IQ, Draw Foul.',
  def_development: 'Defensive Development — improves players\' defensive attributes: Block, Steal, Interior Defense, Perimeter Defense.',
  tactical_dev:    'Tactical Development — improves basketball IQ and team play: Pass Vision, Pass IQ, Assist Role, Defensive & Offensive Rebound positioning.',
  physical_dev:    'Physical Development — improves athletic attributes: Stamina and Durability.',
  mental_dev:      'Mental Development — improves psychological resilience: Clutch/Pressure, Consistency, Crowd Effect resistance, Morale stability.',
  conditioning:    'Conditioning — reduces health loss per game and per training session. Higher = players stay fresher throughout the season.',
  recovery_boost:  'Recovery — increases health recovery between games. Stacks with training intensity. Higher = faster bounce-back.',
  injury_prevent:  'Injury Prevention — reduces the probability of injuries occurring in games and practice.',
  rehab_speed:     'Rehab Speed — reduces the recovery time of injured players. A 80+ physio can cut injury time by 20-30%.',
  personality:     'Personality — 1=Calm & analytical (benefits low-ego players, consistency<60). 10=Intense & emotional (benefits high-ego players, consistency>75). Complementary HC+AC personalities give a +5% development bonus.',
  style_boost:     'Style Match Boost — when the GM\'s weekly tactical orders match this coach\'s preferred style, the team gets this % performance boost.',
}

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full flex-shrink-0"
            style={{background:'#d4cdc5',color:'#6b5f4e',fontSize:8,lineHeight:1}}>i</span>
      <span className="absolute bottom-full left-0 mb-2 z-50 px-2.5 py-2 rounded-lg text-xs
                       opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{background:'#eee8df',border:'1px solid #d4cec3',color:'#3d3529',
                    width:220,whiteSpace:'normal',lineHeight:1.5,fontWeight:400}}>
        {text}
      </span>
    </span>
  )
}

function StatBar({ label, value, color, tipKey }: { label: string, value: number, color: string, tipKey?: string }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs flex-shrink-0" style={{color:'#6b5f4e',width:96}}>
        {label}{tipKey && TIPS[tipKey] && <Tip text={TIPS[tipKey]} />}
      </span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'#cec7bc'}}>
        <div className="h-full rounded-full" style={{width:value+'%',background:color}}></div>
      </div>
      <span className="text-xs font-bold w-6 text-right flex-shrink-0"
            style={{color:value>=85?'#b45309':value>=70?color:'#6b5f4e'}}>{value}</span>
    </div>
  )
}

function PersonalityBar({ value }: { value: number }) {
  const pct = ((value-1)/9)*100
  const color = value<=3?'#1d4ed8':value<=6?'#15803d':value<=8?'#b45309':'#dc2626'
  const label = value<=3?'Calm':value<=6?'Balanced':value<=8?'Intense':'Hot-headed'
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{color:'#6b5f4e'}}>
          Personality<Tip text={TIPS.personality} />
        </span>
        <span className="font-semibold" style={{color}}>{label} {value}/10</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden relative"
           style={{background:'linear-gradient(to right,#3b82f6 0%,#22c55e 33%,#c2410c 66%,#ef4444 100%)'}}>
        <div className="absolute top-0 h-full w-2 rounded-full bg-white opacity-90"
             style={{left:`calc(${pct}% - 4px)`,boxShadow:'0 0 0 2px #fff,0 0 4px rgba(0,0,0,0.3)'}}></div>
      </div>
      <div className="flex justify-between text-xs mt-0.5" style={{color:'#b8ae9e'}}>
        <span>😐 Calm</span><span>🔥 Intense</span>
      </div>
    </div>
  )
}

export default async function CoachingStaff({ teamId }: { teamId: string }) {
  const { data: staff } = await supabase
    .from('coaches').select('*').eq('team_id', teamId)

  if (!staff || staff.length === 0) return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>🎯 Coaching Staff</h2>
      <div className="rounded-xl p-4 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
        <p className="text-sm" style={{color:'#6b5f4e'}}>No staff assigned.</p>
      </div>
    </div>
  )

  // Sort by role order
  const sorted = [...staff].sort((a:any,b:any) =>
    ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  )

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{color:'#6b5f4e'}}>🎯 Coaching Staff</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sorted.map((c:any) => {
          const info = ROLE_INFO[c.role] || {label:c.role,color:'#6b5f4e',icon:'👤'}
          const isCoach = c.role==='head_coach'||c.role==='assistant_coach'
          return (
            <div key={c.id} className="rounded-xl p-4"
                 style={{background:'#e8e2d6',border:'1px solid #d4cec3',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderTop:'3px solid '+info.color}}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs font-semibold mb-0.5" style={{color:info.color}}>
                    {info.icon} {info.label}
                  </div>
                  <div className="font-bold" style={{color:'#1a1612'}}>{c.name}</div>
                  <div className="text-xs" style={{color:'#6b5f4e'}}>
                    {c.nationality}{c.age?` · Age ${c.age}`:''}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-semibold" style={{color:'#d97706'}}>
                    ${(c.salary/1000000).toFixed(1)}M
                  </div>
                  <div className="text-xs" style={{color:'#6b5f4e'}}>{c.contract_years}yr</div>
                </div>
              </div>

              {isCoach && (
                <>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'#d97706'}}>
                    ⚡ Game Time
                  </div>
                  <StatBar label="Off. Adjust"   value={c.off_adjustment}  color="#b45309" tipKey="off_adjustment" />
                  <StatBar label="Def. Adjust"   value={c.def_adjustment}  color="#15803d" tipKey="def_adjustment" />
                  <StatBar label="Substitutions" value={c.substitutions}   color="#1d4ed8" tipKey="substitutions" />
                  <StatBar label="Timeout Mgmt"  value={c.timeout_mgmt}    color="#b45309" tipKey="timeout_mgmt" />

                  <div className="text-xs font-bold uppercase tracking-wider mb-2 mt-3" style={{color:'#7c3aed'}}>
                    📚 Practice Time
                  </div>
                  <StatBar label="Off. Dev"    value={c.off_development}  color="#b45309" tipKey="off_development" />
                  <StatBar label="Def. Dev"    value={c.def_development}  color="#15803d" tipKey="def_development" />
                  <StatBar label="Tactical"    value={c.tactical_dev}     color="#1d4ed8" tipKey="tactical_dev" />
                  <StatBar label="Physical"    value={c.physical_dev}     color="#6d28d9" tipKey="physical_dev" />
                  <StatBar label="Mental"      value={c.mental_dev}       color="#b45309" tipKey="mental_dev" />

                  {/* Style preference */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="text-xs px-2 py-0.5 rounded" style={{background:'#b45309',color:'#fff'}}>
                      {ATK_LABELS[c.pref_atk_style]||c.pref_atk_style}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{background:'#15803d',color:'#fff'}}>
                      {DEF_LABELS[c.pref_def_style]||c.pref_def_style}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{background:'#b45309',color:'#fff'}}>
                      +{c.style_boost}% match
                      <Tip text={TIPS.style_boost} />
                    </span>
                  </div>
                  <PersonalityBar value={c.personality||5} />
                </>
              )}

              {c.role==='trainer' && (
                <>
                  <StatBar label="Conditioning"  value={c.conditioning}    color="#15803d" tipKey="conditioning" />
                  <StatBar label="Recovery"      value={c.recovery_boost}  color="#1d4ed8" tipKey="recovery_boost" />
                  <StatBar label="Inj. Prevent"  value={c.injury_prevent}  color="#b45309" tipKey="injury_prevent" />
                </>
              )}

              {c.role==='physio' && (
                <StatBar label="Rehab Speed"   value={c.rehab_speed}       color="#6d28d9" tipKey="rehab_speed" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

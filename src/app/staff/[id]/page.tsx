import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60


const TIPS: Record<string,string> = {
  off_adjustment:  "Ability to counter the opponent's defence in real time. Impacts shot quality and offensive efficiency.",
  def_adjustment:  "Ability to adapt the team's defence to neutralise the opponent's offence.",
  substitutions:   'Making the right substitutions at the right moment. Affects fatigue management and matchup exploitation.',
  timeout_mgmt:    "Knowing when to call a timeout. Boosts morale during runs and in late-game pressure situations.",
  off_development: "Improves players offensive attributes: Three Point, Layup, Dunk, Mid-Range, Free Throws, Shot IQ, Draw Foul.",
  def_development: "Improves players defensive attributes: Block, Steal, Interior Defense, Perimeter Defense.",
  tactical_dev:    'Improves basketball IQ: Pass Vision, Pass IQ, Assist Role, Offensive and Defensive Rebound positioning.',
  physical_dev:    'Improves athletic attributes: Stamina and Durability.',
  mental_dev:      'Improves psychological resilience: Clutch, Consistency, Crowd Effect resistance, Morale stability.',
  conditioning:    'Reduces health loss per game and per training session. Higher = players stay fresher across the season.',
  recovery_boost:  'Increases health recovery between games. Stacks with training intensity.',
  injury_prevent:  'Reduces the probability of injuries occurring in games and training.',
  rehab_speed:     'Reduces the recovery time of injured players. 80+ can cut injury time by 20-30%.',
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full flex-shrink-0 text-xs font-bold"
            style={{background:'#cec7bc',color:'#5c554e',lineHeight:1,fontSize:9}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs
                       opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{background:'#1a1512',color:'#f5f1eb',width:220,whiteSpace:'normal',
                    lineHeight:1.5,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>
        {text}
      </span>
    </span>
  )
}

const ROLE_INFO: Record<string,{label:string,color:string,icon:string}> = {
  head_coach:      {label:'Head Coach',      color:'#b45309',icon:'ti-whistle'},
  assistant_coach: {label:'Assistant Coach', color:'#1d4ed8',icon:'ti-clipboard-list'},
  trainer:         {label:'Trainer',         color:'#15803d',icon:'ti-activity'},
  physio:          {label:'Physio',          color:'#6d28d9',icon:'ti-heart-rate-monitor'},
}

const ATK: Record<string,string> = {motion:'Motion',pickroll:'Pick & Roll',transition:'Fast Break',iso:'Isolation',post:'Post-Up'}
const DEF: Record<string,string> = {man:'Man-to-Man',zone23:'Zone 2-3',press:'Full Press',pack:'Pack Paint'}
const SEASONS = ['2025-26','2026-27','2027-28']

function StatRow({ label, value, color, tipKey }: { label:string, value:number, color:string, tipKey?:string }) {
  if (!value) return null
  const pct = Math.min(value, 100)
  return (
    <div className="flex items-center gap-3 mb-2.5">
      <span className="text-sm w-32 flex-shrink-0" style={{color:'#5c554e'}}>{label}{tipKey && TIPS[tipKey] && <Tooltip text={TIPS[tipKey]} />}</span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{background:'#cec7bc'}}>
        <div className="h-full rounded-full" style={{width:pct+'%',background:color}}/>
      </div>
      <span className="text-sm font-bold w-8 text-right" style={{
        color: value>=85?'#b45309':value>=70?color:'#8a8279'
      }}>{value}</span>
    </div>
  )
}

export default async function StaffPage({ params }: { params: { id: string } }) {
  const { data: coach } = await supabase.from('coaches').select('*').eq('id', params.id).single()
  if (!coach) notFound()

  const { data: team } = coach.team_id
    ? await supabase.from('teams').select('*').eq('id', coach.team_id).single()
    : { data: null }

  const info = ROLE_INFO[coach.role] || { label: coach.role, color: '#5c554e', icon: 'ti-user' }
  const tc = team ? readableTeamColor((team as any).color) : '#5c554e'
  const isCoach = coach.role === 'head_coach' || coach.role === 'assistant_coach'

  // Salary over contract years
  const contractYears = Array.from({ length: coach.contract_years || 1 }, (_, i) => {
    const yr = 2025 + i
    const season = `${yr}-${String(yr+1).slice(2)}`
    return { season, salary: Math.round(coach.salary * Math.pow(1.05, i)) }
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link href={team ? `/team/${coach.team_id}` : '/trade-center'}
            className="text-sm no-underline flex items-center gap-1 mb-6"
            style={{color:'#5c554e'}}>
        <i className="ti ti-arrow-left" style={{fontSize:16}}></i>
        {team ? (team as any).name : 'Free Agents'}
      </Link>

      {/* Header */}
      <div className="rounded-2xl p-6 mb-6" style={{
        background:'#faf8f5', border:'1px solid #d4cdc5',
        borderTop: `4px solid ${info.color}`
      }}>
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{background:info.color+'18',border:`2px solid ${info.color}33`}}>
            <i className={`ti ${info.icon}`} style={{fontSize:36,color:info.color}}></i>
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-widest mb-1"
                 style={{color:info.color,letterSpacing:'1.5px'}}>
              {info.label}
            </div>
            <h1 className="text-3xl font-bold mb-1" style={{color:'#1a1512'}}>{coach.name}</h1>
            <div className="flex items-center gap-3 flex-wrap text-sm" style={{color:'#5c554e'}}>
              {coach.nationality && <span><i className="ti ti-world" style={{fontSize:14,marginRight:4}}></i>{coach.nationality}</span>}
              {coach.age && <span><i className="ti ti-calendar" style={{fontSize:14,marginRight:4}}></i>Age {coach.age}</span>}
              {team && (
                <Link href={`/team/${coach.team_id}`} className="no-underline flex items-center gap-1.5"
                      style={{color:tc}}>
                  {(team as any).logo_url && <img src={(team as any).logo_url} alt="" className="w-4 h-4 object-contain"/>}
                  {(team as any).name}
                </Link>
              )}
              {!team && <span className="text-xs px-2 py-0.5 rounded font-semibold"
                              style={{background:'#15803d',color:'#fff'}}>Free Agent</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black" style={{color:'#1a1512'}}>
              ${(coach.salary/1000000).toFixed(2)}M
            </div>
            <div className="text-sm" style={{color:'#5c554e'}}>/year</div>
            <div className="text-sm mt-0.5" style={{color:'#8a8279'}}>
              {coach.contract_years}yr · ${(coach.salary*coach.contract_years/1000000).toFixed(1)}M total
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Attributes */}
        <div>
          {isCoach && (
            <>
              <div className="sec-hdr mb-4">
                <span className="sec-title">
                  <i className="ti ti-bolt" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
                  Game Time
                </span>
              </div>
              <div className="rounded-xl p-5 mb-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
                <StatRow label="Off. Adjustment" value={coach.off_adjustment} tipKey="off_adjustment" color="#b45309" />
                <StatRow label="Def. Adjustment" value={coach.def_adjustment} tipKey="def_adjustment" color="#15803d" />
                <StatRow label="Substitutions"   value={coach.substitutions}  color="#1d4ed8" />
                <StatRow label="Timeout Mgmt"    value={coach.timeout_mgmt}   color="#b45309" />
              </div>

              <div className="sec-hdr mb-4">
                <span className="sec-title">
                  <i className="ti ti-school" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
                  Practice Time
                </span>
              </div>
              <div className="rounded-xl p-5 mb-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
                <StatRow label="Off. Development" value={coach.off_development} tipKey="off_development" color="#b45309" />
                <StatRow label="Def. Development" value={coach.def_development} tipKey="def_development" color="#15803d" />
                <StatRow label="Tactical"          value={coach.tactical_dev}   color="#1d4ed8" />
                <StatRow label="Physical"          value={coach.physical_dev}   color="#6d28d9" />
                <StatRow label="Mental"            value={coach.mental_dev}     color="#b45309" />
              </div>

              {/* Style & Personality */}
              <div className="rounded-xl p-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
                <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1px'}}>Style & Personality</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-sm px-3 py-1 rounded-lg font-semibold"
                        style={{background:'#b45309',color:'#fff'}}>
                    {ATK[coach.pref_atk_style]||coach.pref_atk_style}
                  </span>
                  <span className="text-sm px-3 py-1 rounded-lg font-semibold"
                        style={{background:'#15803d',color:'#fff'}}>
                    {DEF[coach.pref_def_style]||coach.pref_def_style}
                  </span>
                  <span className="text-sm px-3 py-1 rounded-lg font-semibold"
                        style={{background:'#1d4ed8',color:'#fff'}}>
                    +{coach.style_boost}% style match
                  </span>
                </div>
                {/* Personality thermometer */}
                <div className="mb-1 flex justify-between text-xs" style={{color:'#5c554e'}}>
                  <span>Personality</span>
                  <span className="font-semibold">
                    {coach.personality<=3?'Calm':coach.personality<=6?'Balanced':coach.personality<=8?'Intense':'Hot-headed'}
                    {' '}({coach.personality}/10)
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden relative"
                     style={{background:'linear-gradient(to right,#3b82f6,#22c55e,#f97316,#ef4444)'}}>
                  <div className="absolute top-0 h-full w-3 rounded-full"
                       style={{left:`calc(${((coach.personality-1)/9)*100}% - 6px)`,
                               background:'#fff',boxShadow:'0 0 0 2px rgba(0,0,0,0.2)'}}/>
                </div>
                <div className="flex justify-between text-xs mt-1" style={{color:'#a89f97'}}>
                  <span>Calm</span><span>Intense</span>
                </div>
              </div>
            </>
          )}

          {coach.role === 'trainer' && (
            <div className="rounded-xl p-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e'}}>Attributes</div>
              <StatRow label="Conditioning"     value={coach.conditioning}    color="#15803d" />
              <StatRow label="Recovery"         value={coach.recovery_boost}  color="#1d4ed8" />
              <StatRow label="Injury Prevention"value={coach.injury_prevent}  color="#b45309" />
            </div>
          )}

          {coach.role === 'physio' && (
            <div className="rounded-xl p-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e'}}>Attributes</div>
              <StatRow label="Rehab Speed" value={coach.rehab_speed} tipKey="rehab_speed" color="#6d28d9" />
              <div className="mt-4 p-3 rounded-lg text-sm" style={{background:'#eee8df',color:'#5c554e',lineHeight:1.5}}>
                A rehab speed of <strong style={{color:'#1a1512'}}>{coach.rehab_speed}</strong> reduces injury recovery time by approximately{' '}
                <strong style={{color:'#6d28d9'}}>{Math.round((coach.rehab_speed-50)/50*30)}%</strong>.
              </div>
            </div>
          )}
        </div>

        {/* Contract */}
        <div>
          <div className="sec-hdr mb-4">
            <span className="sec-title">
              <i className="ti ti-receipt" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
              Contract
            </span>
          </div>
          <div className="rounded-xl overflow-hidden mb-5" style={{border:'1px solid #d4cdc5'}}>
            <div className="px-4 py-2.5" style={{background:'#eee8df',borderBottom:'1px solid #d4cdc5'}}>
              <div className="flex justify-between text-xs font-semibold" style={{color:'#5c554e'}}>
                <span>Season</span><span>Salary</span>
              </div>
            </div>
            {contractYears.map((yr, i) => (
              <div key={yr.season} className="flex justify-between items-center px-4 py-3"
                   style={{borderBottom: i < contractYears.length-1 ? '1px solid #e2dcd5' : 'none',
                           background: i===0 ? '#faf8f5' : '#f5f1eb'}}>
                <div>
                  <span className="text-sm font-semibold" style={{color:'#1a1512'}}>{yr.season}</span>
                  {i===0 && <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-bold"
                                  style={{background:'#c8102e',color:'#fff'}}>Current</span>}
                </div>
                <span className="text-sm font-bold" style={{color:i===0?'#1a1512':'#5c554e'}}>
                  ${(yr.salary/1000000).toFixed(2)}M
                </span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3" style={{background:'#eee8df',borderTop:'2px solid #d4cdc5'}}>
              <span className="text-sm font-bold" style={{color:'#1a1512'}}>Total</span>
              <span className="text-sm font-black" style={{color:'#c8102e'}}>
                ${(contractYears.reduce((s,y)=>s+y.salary,0)/1000000).toFixed(1)}M
              </span>
            </div>
          </div>

          {/* Natural role note */}
          {coach.natural_role && coach.natural_role !== coach.role && (
            <div className="rounded-xl p-4" style={{background:'#fff8e8',border:'1px solid #b45309',borderLeft:'4px solid #b45309'}}>
              <div className="text-xs font-bold mb-1" style={{color:'#b45309'}}>
                <i className="ti ti-alert-triangle" style={{marginRight:4}}></i>Role Mismatch
              </div>
              <div className="text-sm" style={{color:'#5c554e'}}>
                Natural role is <strong>{coach.natural_role.replace(/_/g,' ')}</strong>. Current assignment incurs a 30% effectiveness penalty.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

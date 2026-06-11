import { supabase } from '@/lib/supabase'

const ROLE_INFO: Record<string,{label:string,color:string,icon:string,impact:string}> = {
  head_coach:      {label:'Head Coach',      color:'#ffd040',icon:'🎯',impact:'Development rate, morale, in-game decisions'},
  assistant_coach: {label:'Assistant Coach', color:'#60a0ff',icon:'📋',impact:'Specialty attribute boost'},
  trainer:         {label:'Trainer',         color:'#40e080',icon:'💪',impact:'Health recovery, injury prevention'},
  physio:          {label:'Physio',          color:'#c040ff',icon:'🏥',impact:'Injury rehab speed'},
}

export default async function CoachingStaff({ teamId }: { teamId: string }) {
  const { data: staff } = await supabase
    .from('coaches').select('*').eq('team_id', teamId).order('role')

  if (!staff || staff.length === 0) return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6a5a4a'}}>🎯 Coaching Staff</h2>
      <div className="rounded-xl p-4 text-center" style={{background:'#241f18',border:'1px solid #3a3228'}}>
        <p className="text-sm" style={{color:'#6a5a4a'}}>No staff assigned yet.</p>
      </div>
    </div>
  )

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6a5a4a'}}>🎯 Coaching Staff</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {staff.map((c:any) => {
          const info = ROLE_INFO[c.role] || {label:c.role,color:'#8a7a6a',icon:'👤',impact:''}
          return (
            <div key={c.id} className="rounded-xl p-4" style={{background:'#241f18',border:'1px solid #3a3228',borderTop:'2px solid '+info.color}}>
              <div className="text-lg mb-1">{info.icon}</div>
              <div className="text-xs font-semibold mb-0.5" style={{color:info.color}}>{info.label}</div>
              <div className="font-bold text-sm mb-1" style={{color:'#f0ebe0'}}>{c.name}</div>
              <div className="text-xs mb-2" style={{color:'#6a5a4a'}}>{c.nationality} · Age {c.age}</div>

              {/* Role-specific ratings */}
              {c.role === 'head_coach' && (
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {[['OFF',c.offense_iq,'#ffa040'],['DEF',c.defense_iq,'#40e080'],['DEV',c.player_dev,'#60a0ff'],
                    ['MOT',c.motivation,'#c040ff'],['MGT',c.game_mgmt,'#ffd040']].map(([l,v,col])=>(
                    <div key={l as string} className="rounded px-1.5 py-1 text-center" style={{background:'#1a1610'}}>
                      <div className="text-xs font-black" style={{color:col as string}}>{v}</div>
                      <div style={{fontSize:9,color:'#6a5a4a'}}>{l}</div>
                    </div>
                  ))}
                </div>
              )}
              {c.role === 'assistant_coach' && c.specialty && (
                <div className="rounded px-2 py-1 text-center mb-2 text-xs"
                     style={{background:'#1a1610',color:'#60a0ff'}}>
                  Specialty: <strong>{c.specialty}</strong> (+{c.specialty_boost})
                </div>
              )}
              {c.role === 'trainer' && (
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {[['COND',c.conditioning,'#40e080'],['REC',c.recovery_boost,'#60a0ff'],['INJ',c.injury_prevent,'#ffd040']].map(([l,v,col])=>(
                    <div key={l as string} className="rounded px-1.5 py-1 text-center" style={{background:'#1a1610'}}>
                      <div className="text-xs font-black" style={{color:col as string}}>{v}</div>
                      <div style={{fontSize:9,color:'#6a5a4a'}}>{l}</div>
                    </div>
                  ))}
                </div>
              )}
              {c.role === 'physio' && (
                <div className="rounded px-2 py-1 text-center mb-2 text-xs"
                     style={{background:'#1a1610',color:'#c040ff'}}>
                  Rehab Speed: <strong>{c.rehab_speed}</strong>
                </div>
              )}

              <div className="text-xs" style={{color:'#5a4a3a'}}>{info.impact}</div>
              <div className="text-xs mt-1 font-semibold" style={{color:'#6a5a4a'}}>
                ${Math.round(c.salary/1000000).toFixed(1)}M · {c.contract_years}yr
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

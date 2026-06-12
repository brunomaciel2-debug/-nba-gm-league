'use client'

const SEVERITY_STYLE: Record<string,{color:string,bg:string,label:string}> = {
  minor:                { color:'#b45309', bg:'#2a2000', label:'Minor' },
  moderate:             { color:'#c2410c', bg:'#2a1500', label:'Moderate' },
  serious:              { color:'#ff6040', bg:'#2a0a00', label:'Serious' },
  severe:               { color:'#dc2626', bg:'#2a0000', label:'Severe' },
  career_threatening:   { color:'#ff2040', bg:'#3a0000', label:'Career Risk' },
}

const HEALTH_STYLE = (h: number) => {
  if (h >= 90) return { color:'#166534', label:'Healthy',      bar:'#40e080' }
  if (h >= 80) return { color:'#a0e040', label:'Good',         bar:'#a0e040' }
  if (h >= 65) return { color:'#b45309', label:'Limited',      bar:'#ffd040' }
  if (h >= 50) return { color:'#c2410c', label:'Questionable', bar:'#ffa040' }
  return              { color:'#dc2626', label:'Out',           bar:'#e04040' }
}

const PLAY_STATUS = (health: number, canPlay: boolean) => {
  if (health < 50)  return { text:'OUT',          color:'#dc2626', bg:'#2a0000' }
  if (health < 60)  return { text:'GAME-TIME',     color:'#c2410c', bg:'#2a1500' }
  if (health < 75)  return { text:'LIMITED',       color:'#b45309', bg:'#2a2000' }
  return                   { text:'AVAILABLE',     color:'#166534', bg:'#0a2a10' }
}

export default function InjuryReport({ injuries, players }: {
  injuries: any[],
  players: any[]
}) {
  // Map player_id to player info
  const playerMap = Object.fromEntries(players.map((p:any)=>[p.id, p]))

  // Only active injuries
  const active = injuries.filter((i:any) => i.status === 'active')

  if (active.length === 0) return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>
        🏥 Injury Report
      </h2>
      <div className="rounded-xl p-5 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
        <p className="text-sm" style={{color:'#6b5f4e'}}>✅ No active injuries. Full squad available.</p>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{color:'#6b5f4e'}}>
          🏥 Injury Report
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{background:'#fee2e2',color:'#dc2626'}}>
          {active.length} player{active.length!==1?'s':''} injured
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {active.map((inj:any) => {
          const p = playerMap[inj.player_id]
          const health = p?.health ?? 100
          const hs = HEALTH_STYLE(health)
          const sev = SEVERITY_STYLE[inj.severity] || SEVERITY_STYLE.minor
          const ps = PLAY_STATUS(health, inj.can_play)

          return (
            <div key={inj.id} className="rounded-xl overflow-hidden"
                 style={{border:'1px solid '+sev.color+'44'}}>
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3"
                   style={{background:sev.bg,borderBottom:'1px solid '+sev.color+'33'}}>
                {/* Photo or initials */}
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
                     style={{background:'#3a3228'}}>
                  {p?.photo_url
                    ?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                    :<div className="w-full h-full flex items-center justify-center text-xs font-black"
                          style={{color:'#6b5f4e'}}>
                       {p?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'?'}
                     </div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{color:'#1a1612'}}>{p?.name||'Unknown'}</div>
                  <div className="text-xs" style={{color:'#6b5f4e'}}>{p?.pos} · {inj.injury_type}</div>
                </div>
                {/* Severity badge */}
                <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                      style={{background:sev.color+'22',color:sev.color}}>
                  {sev.label}
                </span>
                {/* Play status */}
                <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                      style={{background:ps.bg,color:ps.color}}>
                  {ps.text}
                </span>
              </div>

              {/* Details */}
              <div className="px-4 py-3" style={{background:'#ece7dd'}}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {/* Health bar */}
                  <div>
                    <div className="text-xs mb-1" style={{color:'#6b5f4e'}}>Health</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#3a3228'}}>
                        <div className="h-full rounded-full" style={{width:health+'%',background:hs.bar}}></div>
                      </div>
                      <span className="text-xs font-bold" style={{color:hs.color}}>{health}%</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{color:hs.color}}>{hs.label}</div>
                  </div>

                  {/* Occurred in */}
                  <div>
                    <div className="text-xs mb-1" style={{color:'#6b5f4e'}}>Occurred in</div>
                    <div className="text-sm font-semibold" style={{color:'#1a1612'}}>
                      {inj.occurred_in === 'game' ? '🏀 Game' : '🏋️ Practice'}
                    </div>
                  </div>

                  {/* Games out */}
                  <div>
                    <div className="text-xs mb-1" style={{color:'#6b5f4e'}}>Games Out</div>
                    <div className="text-sm font-bold" style={{color:'#c2410c'}}>
                      ~{inj.games_out} games
                    </div>
                  </div>

                  {/* Return estimate */}
                  <div>
                    <div className="text-xs mb-1" style={{color:'#6b5f4e'}}>Est. Return</div>
                    <div className="text-sm font-semibold" style={{color:'#1a1612'}}>
                      {inj.return_week ? `Week ${inj.return_week}` : 'TBD'}
                    </div>
                  </div>
                </div>

                {/* Performance impact */}
                {health < 100 && (
                  <div className="rounded-lg px-3 py-2 text-xs" style={{background:'#ddd7ca'}}>
                    {health >= 90 && <span style={{color:'#a0e040'}}>⚡ 90% performance — slight impact on explosiveness</span>}
                    {health >= 80 && health < 90 && <span style={{color:'#b45309'}}>⚡ 75% performance — visibly limited athleticism</span>}
                    {health >= 65 && health < 80 && <span style={{color:'#c2410c'}}>⚡ 60% performance — significant movement restrictions</span>}
                    {health >= 50 && health < 65 && <span style={{color:'#ff6040'}}>⚡ 50% performance — severely limited · {inj.play_risk}% chance of aggravating injury if plays</span>}
                    {health < 50 && <span style={{color:'#dc2626'}}>🚫 Cannot play — health below 50%</span>}
                  </div>
                )}

                {/* Recurring warning */}
                {inj.is_recurring && (
                  <div className="mt-2 rounded-lg px-3 py-2 text-xs flex items-center gap-2"
                       style={{background:'#fef3c7',border:'1px solid #5a3000'}}>
                    <span style={{color:'#c2410c'}}>⚠️ Recurring injury — higher aggravation risk this season</span>
                  </div>
                )}

                {/* Psychological note */}
                {inj.injury_category === 'psychological' && (
                  <div className="mt-2 rounded-lg px-3 py-2 text-xs"
                       style={{background:'#1a1228',border:'1px solid #3a2a5a'}}>
                    <span style={{color:'#7c3aed'}}>
                      🧠 Psychological — affects morale ({inj.moral_impact > 0 ? '-' : ''}{inj.moral_impact} moral) and consistency
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

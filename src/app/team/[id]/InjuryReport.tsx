'use client'
import { useTranslation } from '@/components/I18nProvider'

const SEVERITY_STYLE: Record<string,{color:string,bg:string,labelEN:string,labelPT:string}> = {
  minor:              { color:'#b45309', bg:'#2a2000', labelEN:'Minor',       labelPT:'Ligeira' },
  moderate:           { color:'#c2410c', bg:'#2a1500', labelEN:'Moderate',    labelPT:'Moderada' },
  serious:            { color:'#ff6040', bg:'#2a0a00', labelEN:'Serious',     labelPT:'Séria' },
  severe:             { color:'#dc2626', bg:'#2a0000', labelEN:'Severe',      labelPT:'Severa' },
  career_threatening: { color:'#ff2040', bg:'#3a0000', labelEN:'Career Risk', labelPT:'Risco de Carreira' },
}

const HEALTH_STYLE = (h: number, isPT: boolean) => {
  if (h >= 90) return { color:'#166534', label: isPT?'Saudável':'Healthy',        bar:'#15803d' }
  if (h >= 80) return { color:'#a0e040', label: isPT?'Bom':'Good',                bar:'#a0e040' }
  if (h >= 65) return { color:'#b45309', label: isPT?'Limitado':'Limited',        bar:'#b45309' }
  if (h >= 50) return { color:'#c2410c', label: isPT?'Duvidoso':'Questionable',   bar:'#b45309' }
  return              { color:'#dc2626', label: isPT?'Fora':'Out',                 bar:'#dc2626' }
}

const PLAY_STATUS = (health: number, isPT: boolean) => {
  if (health < 50) return { text: isPT?'FORA':'OUT',              color:'#dc2626', bg:'#2a0000' }
  if (health < 60) return { text: isPT?'GAME-TIME':'GAME-TIME',   color:'#c2410c', bg:'#2a1500' }
  if (health < 75) return { text: isPT?'LIMITADO':'LIMITED',      color:'#b45309', bg:'#2a2000' }
  return                  { text: isPT?'DISPONÍVEL':'AVAILABLE',  color:'#166534', bg:'#0a2a10' }
}

export default function InjuryReport({ injuries, players }: { injuries: any[], players: any[] }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const playerMap = Object.fromEntries(players.map((p:any)=>[p.id,p]))
  const active = injuries.filter((i:any) => i.status === 'active')

  if (active.length === 0) return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>
        🏥 {isPT ? 'Relatório de Lesões' : 'Injury Report'}
      </h2>
      <div className="rounded-xl p-5 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
        <p className="text-sm" style={{color:'#6b5f4e'}}>
          ✅ {isPT ? 'Sem lesões activas. Plantel disponível na totalidade.' : 'No active injuries. Full squad available.'}
        </p>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{color:'#6b5f4e'}}>
          🏥 {isPT ? 'Relatório de Lesões' : 'Injury Report'}
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{background:'#fee2e2',color:'#dc2626'}}>
          {active.length} {isPT ? `jogador${active.length!==1?'es':''} lesionado${active.length!==1?'s':''}` : `player${active.length!==1?'s':''} injured`}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {active.map((inj:any) => {
          const p = playerMap[inj.player_id]
          const health = p?.health ?? 100
          const hs = HEALTH_STYLE(health, isPT)
          const sev = SEVERITY_STYLE[inj.severity] || SEVERITY_STYLE.minor
          const ps = PLAY_STATUS(health, isPT)
          return (
            <div key={inj.id} className="rounded-xl overflow-hidden" style={{border:'1px solid '+sev.color+'44'}}>
              <div className="flex items-center gap-3 px-4 py-3" style={{background:sev.bg,borderBottom:'1px solid '+sev.color+'33'}}>
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0" style={{background:'#cec7bc'}}>
                  {p?.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:'#6b5f4e'}}>
                        {p?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'?'}
                      </div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{color:'#1a1612'}}>{p?.name||'Unknown'}</div>
                  <div className="text-xs" style={{color:'#6b5f4e'}}>{p?.pos} · {inj.injury_type}</div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{background:sev.color+'22',color:sev.color}}>
                  {isPT ? sev.labelPT : sev.labelEN}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{background:ps.bg,color:ps.color}}>
                  {ps.text}
                </span>
              </div>
              <div className="px-4 py-3" style={{background:'#ece7dd'}}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <div className="text-xs mb-1" style={{color:'#6b5f4e'}}>{isPT?'Saúde':'Health'}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#cec7bc'}}>
                        <div className="h-full rounded-full" style={{width:health+'%',background:hs.bar}}/>
                      </div>
                      <span className="text-xs font-bold" style={{color:hs.color}}>{health}%</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{color:hs.color}}>{hs.label}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{color:'#6b5f4e'}}>{isPT?'Ocorreu em':'Occurred in'}</div>
                    <div className="text-sm font-semibold" style={{color:'#1a1612'}}>
                      {inj.occurred_in === 'game' ? (isPT?'🏀 Jogo':'🏀 Game') : (isPT?'🏋️ Treino':'🏋️ Practice')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{color:'#6b5f4e'}}>{isPT?'Jogos Falhados':'Games Out'}</div>
                    <div className="text-sm font-bold" style={{color:'#c2410c'}}>~{inj.games_out} {isPT?'jogos':'games'}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{color:'#6b5f4e'}}>{isPT?'Regresso Est.':'Est. Return'}</div>
                    <div className="text-sm font-semibold" style={{color:'#1a1612'}}>
                      {inj.return_week ? `${isPT?'Semana':'Week'} ${inj.return_week}` : 'TBD'}
                    </div>
                  </div>
                </div>
                {health < 100 && (
                  <div className="rounded-lg px-3 py-2 text-xs" style={{background:'#ddd7ca'}}>
                    {health>=90&&<span style={{color:'#a0e040'}}>⚡ {isPT?'90% de rendimento — ligeiro impacto na explosividade':'90% performance — slight impact on explosiveness'}</span>}
                    {health>=80&&health<90&&<span style={{color:'#b45309'}}>⚡ {isPT?'75% de rendimento — atletismo visivelmente limitado':'75% performance — visibly limited athleticism'}</span>}
                    {health>=65&&health<80&&<span style={{color:'#c2410c'}}>⚡ {isPT?'60% de rendimento — restrições significativas de movimento':'60% performance — significant movement restrictions'}</span>}
                    {health>=50&&health<65&&<span style={{color:'#ff6040'}}>⚡ {isPT?`50% de rendimento — muito limitado · ${inj.play_risk}% chance de agravar a lesão`:`50% performance — severely limited · ${inj.play_risk}% chance of aggravating injury`}</span>}
                    {health<50&&<span style={{color:'#dc2626'}}>🚫 {isPT?'Não pode jogar — saúde abaixo de 50%':'Cannot play — health below 50%'}</span>}
                  </div>
                )}
                {inj.is_recurring && (
                  <div className="mt-2 rounded-lg px-3 py-2 text-xs flex items-center gap-2" style={{background:'#fef3c7',border:'1px solid #5a3000'}}>
                    <span style={{color:'#c2410c'}}>⚠️ {isPT?'Lesão recorrente — maior risco de agravamento esta época':'Recurring injury — higher aggravation risk this season'}</span>
                  </div>
                )}
                {inj.injury_category === 'psychological' && (
                  <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{background:'#1a1228',border:'1px solid #3a2a5a'}}>
                    <span style={{color:'#7c3aed'}}>
                      🧠 {isPT?`Psicológica — afecta moral (${inj.moral_impact>0?'-':''}${inj.moral_impact} moral) e consistência`:`Psychological — affects morale (${inj.moral_impact>0?'-':''}${inj.moral_impact} moral) and consistency`}
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

'use client'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

const ROLE_ORDER = ['head_coach','assistant_coach','trainer','physio','scout']

const ATK_LABELS_EN: Record<string,string> = { motion:'Motion',pickroll:'Pick & Roll',transition:'Fast Break',iso:'Isolation',post:'Post-Up' }
const ATK_LABELS_PT: Record<string,string> = { motion:'Motion',pickroll:'Pick & Roll',transition:'Contra-Ataque',iso:'Isolamento',post:'Poste' }
const DEF_LABELS_EN: Record<string,string> = { man:'Man-to-Man',zone23:'Zone 2-3',press:'Full Press',pack:'Pack Paint' }
const DEF_LABELS_PT: Record<string,string> = { man:'Individual',zone23:'Zona 2-3',press:'Pressing Total',pack:'Defesa Fechada' }

function StatBar({ label, value, color }: { label: string, value: number, color: string }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs flex-shrink-0" style={{color:'#5c554e',width:96}}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#cec7bc'}}>
        <div className="h-full rounded-full" style={{width:value+'%',background:color}}/>
      </div>
      <span className="text-xs font-bold w-6 text-right flex-shrink-0"
            style={{color:value>=85?'#b45309':value>=70?color:'#8a8279'}}>{value}</span>
    </div>
  )
}

function PersonalityBar({ value, isPT }: { value: number, isPT: boolean }) {
  const pct = ((value-1)/9)*100
  const color = value<=3?'#3b82f6':value<=6?'#22c55e':value<=8?'#f97316':'#ef4444'
  const label = isPT
    ? (value<=3?'Calmo':value<=6?'Equilibrado':value<=8?'Intenso':'Impulsivo')
    : (value<=3?'Calm':value<=6?'Balanced':value<=8?'Intense':'Hot-headed')
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{color:'#5c554e'}}>{isPT?'Personalidade':'Personality'}</span>
        <span className="font-semibold" style={{color}}>{label} {value}/10</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden relative"
           style={{background:'linear-gradient(to right,#3b82f6 0%,#22c55e 33%,#f97316 66%,#ef4444 100%)'}}>
        <div className="absolute top-0 h-full w-2 rounded-full bg-white"
             style={{left:`calc(${pct}% - 4px)`,boxShadow:'0 0 0 2px rgba(0,0,0,0.2)'}}/>
      </div>
      <div className="flex justify-between text-xs mt-0.5" style={{color:'#a89f97'}}>
        <span>{isPT?'Calmo':'Calm'}</span><span>{isPT?'Intenso':'Intense'}</span>
      </div>
    </div>
  )
}

export default function CoachingStaff({ staff }: { staff: any[] }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const ROLE_INFO: Record<string,{label:string,color:string,icon:string}> = {
    head_coach:      {label: isPT?'Head Coach':'Head Coach',           color:'#b45309',icon:'🏆'},
    assistant_coach: {label: isPT?'Ass. Treinador':'Assistant Coach',  color:'#1d4ed8',icon:'📋'},
    trainer:         {label: isPT?'Preparador Físico':'Trainer',       color:'#15803d',icon:'💪'},
    physio:          {label: isPT?'Fisioterapeuta':'Physio',           color:'#6d28d9',icon:'🏥'},
    scout:           {label: isPT?'Olheiro':'Scout',                   color:'#0e7490',icon:'🔍'},
  }

  const ATK = isPT ? ATK_LABELS_PT : ATK_LABELS_EN
  const DEF = isPT ? DEF_LABELS_PT : DEF_LABELS_EN

  if (!staff || staff.length === 0) return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e',letterSpacing:'1.5px'}}>
        {isPT ? 'STAFF TÉCNICO' : 'COACHING STAFF'}
      </h2>
      <div className="rounded-xl p-4 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <p className="text-sm" style={{color:'#8a8279'}}>{isPT ? 'Sem staff atribuído.' : 'No staff assigned.'}</p>
      </div>
    </div>
  )

  const sorted = [...staff].sort((a:any,b:any) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))

  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>
        {isPT ? 'STAFF TÉCNICO' : 'COACHING STAFF'}
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sorted.map((c:any) => {
          const info = ROLE_INFO[c.role] || {label:c.role,color:'#5c554e',icon:'👤'}
          const isCoach = c.role==='head_coach'||c.role==='assistant_coach'
          const initials = c.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()
          return (
            <Link key={c.id} href={`/staff/${c.id}`} className="no-underline group">
              <div className="rounded-xl p-4 h-full transition-all group-hover:brightness-95"
                   style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'3px solid '+info.color}}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center"
                       style={{background:info.color+'18',border:`2px solid ${info.color}33`}}>
                    {c.photo_url ? <img src={c.photo_url} alt={c.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      : <span style={{fontSize:14,fontWeight:800,color:info.color}}>{initials}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold mb-0.5" style={{color:info.color}}>{info.label}</div>
                    <div className="font-bold text-sm leading-tight" style={{color:'#1a1512'}}>{c.name}</div>
                    <div className="text-xs" style={{color:'#8a8279'}}>
                      {c.nationality}{c.age?` · ${isPT?'Idade':'Age'} ${c.age}`:''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold" style={{color:'#b45309'}}>${(c.salary/1000000).toFixed(1)}M</div>
                    <div className="text-xs" style={{color:'#8a8279'}}>{c.contract_years}{isPT?'ano(s)':'yr'}</div>
                  </div>
                </div>
                {isCoach && (
                  <>
                    <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'#b45309',letterSpacing:'1px'}}>{isPT?'Jogo':'Game Time'}</div>
                    <StatBar label={isPT?'Aj. Ataque':'Off. Adjust'}   value={c.off_adjustment}  color="#b45309" />
                    <StatBar label={isPT?'Aj. Defesa':'Def. Adjust'}   value={c.def_adjustment}  color="#15803d" />
                    <StatBar label={isPT?'Substituições':'Substitutions'} value={c.substitutions} color="#1d4ed8" />
                    <StatBar label={isPT?'Gestão Tempos':'Timeout Mgmt'}  value={c.timeout_mgmt}  color="#b45309" />
                    <div className="text-xs font-bold uppercase tracking-wider mb-2 mt-3" style={{color:'#6d28d9',letterSpacing:'1px'}}>{isPT?'Treino':'Practice'}</div>
                    <StatBar label={isPT?'Dev. Ataque':'Off. Dev'}    value={c.off_development} color="#b45309" />
                    <StatBar label={isPT?'Dev. Defesa':'Def. Dev'}    value={c.def_development} color="#15803d" />
                    <StatBar label={isPT?'Tático':'Tactical'}          value={c.tactical_dev}    color="#1d4ed8" />
                    <StatBar label={isPT?'Físico':'Physical'}           value={c.physical_dev}    color="#6d28d9" />
                    <StatBar label={isPT?'Mental':'Mental'}             value={c.mental_dev}      color="#b45309" />
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{background:'#b45309',color:'#fff'}}>
                        {ATK[c.pref_atk_style]||c.pref_atk_style}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{background:'#15803d',color:'#fff'}}>
                        {DEF[c.pref_def_style]||c.pref_def_style}
                      </span>
                    </div>
                    <PersonalityBar value={c.personality||5} isPT={isPT} />
                  </>
                )}
                {c.role==='trainer' && (
                  <>
                    <StatBar label={isPT?'Condicionamento':'Conditioning'} value={c.conditioning}   color="#15803d" />
                    <StatBar label={isPT?'Recuperação':'Recovery'}         value={c.recovery_boost} color="#1d4ed8" />
                    <StatBar label={isPT?'Prev. Lesões':'Inj. Prevent'}   value={c.injury_prevent}  color="#b45309" />
                  </>
                )}
                {c.role==='physio' && (
                  <StatBar label={isPT?'Velocidade Rehab':'Rehab Speed'} value={c.rehab_speed} color="#6d28d9" />
                )}
                {c.role==='scout' && (
                  <>
                    <StatBar label={isPT?'Avaliação':'Evaluation'} value={c.scouting_evaluation} color="#0e7490" />
                    <StatBar label={isPT?'Rede Contactos':'Network'}   value={c.scouting_network}    color="#1d4ed8" />
                    <StatBar label={isPT?'Experiência':'Experience'}   value={c.scouting_experience} color="#6d28d9" />
                  </>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

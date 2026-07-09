'use client'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

const ROLE_ORDER = ['head_coach','assistant_coach','trainer','physio','scout','mental_coach','social_media_manager']

const ATK_LABELS_EN: Record<string,string> = { motion:'Motion',pickroll:'Pick & Roll',transition:'Fast Break',iso:'Isolation',post:'Post-Up' }
const ATK_LABELS_PT: Record<string,string> = { motion:'Motion',pickroll:'Pick & Roll',transition:'Contra-Ataque',iso:'Isolamento',post:'Poste' }
const DEF_LABELS_EN: Record<string,string> = { man:'Man-to-Man',zone23:'Zone 2-3',press:'Full Press',pack:'Pack Paint' }
const DEF_LABELS_PT: Record<string,string> = { man:'Individual',zone23:'Zona 2-3',press:'Pressing Total',pack:'Defesa Fechada' }

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full flex-shrink-0 text-xs font-bold" style={{background:'#cec7bc',color:'#5c554e',lineHeight:1,fontSize:9}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{background:'#1a1512',color:'#f5f1eb',width:220,whiteSpace:'normal',lineHeight:1.5,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>{text}</span>
    </span>
  )
}

// What each stat actually does in the real simulation — formula-grounded,
// not marketing copy. Some fields share a name across roles but only
// really matter for one of them (e.g. off_adjustment only reads the head
// coach's value); a few are honestly not wired to anything yet.
const STAT_TIPS_PT: Record<string, string> = {
  'off_adjustment:head_coach': 'Ajusta o teu ataque durante o jogo real: reforça uma vantagem de matchup já existente ou atenua uma desvantagem, até ±30%.',
  'off_adjustment:assistant_coach': 'Este valor ainda não afeta a simulação para o assistente treinador — só o do Head Coach conta nos ajustes durante o jogo.',
  'def_adjustment:head_coach': 'O mesmo que o Ajuste de Ataque, mas do lado defensivo do matchup — até ±30%.',
  'def_adjustment:assistant_coach': 'Este valor ainda não afeta a simulação para o assistente treinador — só o do Head Coach conta nos ajustes durante o jogo.',
  substitutions: 'Ainda não está ligado a nenhuma fórmula da simulação — é apenas informativo por agora.',
  timeout_mgmt: 'Ainda não está ligado a nenhuma fórmula da simulação — é apenas informativo por agora.',
  'off_development:head_coach': 'Conta 60% da qualidade que preenche o slot semanal de Treino de Ataque do plantel.',
  'off_development:assistant_coach': 'Este valor ainda não afeta a simulação para o assistente treinador — a contribuição real dele usa dados internos não mostrados aqui.',
  'def_development:head_coach': 'Conta 60% da qualidade que preenche o slot semanal de Treino de Defesa do plantel.',
  'def_development:assistant_coach': 'Este valor ainda não afeta a simulação para o assistente treinador — a contribuição real dele usa dados internos não mostrados aqui.',
  tactical_dev: 'Conta para a qualidade do slot de treino Tático (60% Head Coach + 40% Assistente) e acelera o domínio real dos sistemas táticos da equipa.',
  'physical_dev:head_coach': 'Conta 30% da qualidade que preenche o slot semanal de Treino Físico — o Preparador Físico conta os outros 70%.',
  'physical_dev:assistant_coach': 'Este valor ainda não afeta a simulação para o assistente treinador — quem conta a par do Head Coach é o Preparador Físico.',
  mental_dev: 'Conta para a qualidade do slot de treino Mental (60% Head Coach + 40% Assistente) — o Head Coach precisa de pelo menos 70 aqui para esse slot desbloquear.',
  conditioning: 'Aumenta a chance semanal real de evolução dos atributos físicos do plantel (resistência, durabilidade, ressaltos).',
  recovery_boost: 'Conta 70% da qualidade que preenche o slot semanal de Recuperação — o Head Coach conta os outros 30%.',
  injury_prevent: 'Ainda não está ligado à fórmula real de lesões — é apenas informativo por agora.',
  rehab_speed: 'Acelera a recuperação semanal real de jogadores lesionados, até 30% mais rápido.',
  scouting_evaluation: 'Conta 50% dos pontos de scouting reais ganhos por semana — o maior peso dos três.',
  scouting_network: 'Conta 20% dos pontos de scouting reais ganhos por semana.',
  scouting_experience: 'Conta 30% dos pontos de scouting reais ganhos por semana.',
  morale_management: 'Acelera a velocidade real com que o moral de cada jogador se aproxima do valor que "merece" ter, semana a semana.',
  team_cohesion: 'Reduz a chance real de perdas de bola em jogo, até 20% a menos.',
  composure_coaching: 'Reduz o impacto real da pressão em momentos decisivos do jogo, até 12%.',
  sm_engagement: 'Determina o crescimento (ou perda) passivo real de seguidores todas as semanas.',
  fan_interaction: 'Determina a chance semanal real de um evento de interação com fãs — sobe o moral de um jogador e os seguidores da equipa.',
  social_responsibility: 'Determina a chance semanal real de um evento de responsabilidade social — sobe a popularidade da equipa e a fama de um jogador.',
}
const STAT_TIPS_EN: Record<string, string> = {
  'off_adjustment:head_coach': "Adjusts your offense during the real game: sharpens an already-favorable matchup or dulls an unfavorable one, up to ±30%.",
  'off_adjustment:assistant_coach': "This value doesn't affect the simulation yet for the assistant coach — only the head coach's value counts toward in-game adjustments.",
  'def_adjustment:head_coach': 'Same as Offense Adjust, but on the defensive side of the matchup — up to ±30%.',
  'def_adjustment:assistant_coach': "This value doesn't affect the simulation yet for the assistant coach — only the head coach's value counts toward in-game adjustments.",
  substitutions: "Not wired to any simulation formula yet — informational only for now.",
  timeout_mgmt: "Not wired to any simulation formula yet — informational only for now.",
  'off_development:head_coach': "Counts for 60% of the quality that fills the roster's weekly Offense Training slot.",
  'off_development:assistant_coach': "This value doesn't affect the simulation yet for the assistant coach — their real contribution uses internal data not shown here.",
  'def_development:head_coach': "Counts for 60% of the quality that fills the roster's weekly Defense Training slot.",
  'def_development:assistant_coach': "This value doesn't affect the simulation yet for the assistant coach — their real contribution uses internal data not shown here.",
  tactical_dev: 'Counts toward the Tactical training slot quality (60% head coach + 40% assistant) and speeds up the real mastery of the team\'s tactical systems.',
  'physical_dev:head_coach': "Counts for 30% of the quality that fills the weekly Physical Training slot — the Trainer counts the other 70%.",
  'physical_dev:assistant_coach': "This value doesn't affect the simulation yet for the assistant coach — the Trainer is who counts alongside the head coach.",
  mental_dev: 'Counts toward the Mental training slot quality (60% head coach + 40% assistant) — the head coach needs at least 70 here for that slot to unlock.',
  conditioning: "Raises the roster's real weekly chance of physical attribute growth (stamina, durability, rebounding).",
  recovery_boost: 'Counts for 70% of the quality that fills the weekly Recovery slot — the head coach counts the other 30%.',
  injury_prevent: "Not wired to the real injury formula yet — informational only for now.",
  rehab_speed: 'Speeds up injured players\' real weekly recovery, by up to 30%.',
  scouting_evaluation: 'Counts for 50% of real scouting points earned per week — the heaviest of the three.',
  scouting_network: 'Counts for 20% of real scouting points earned per week.',
  scouting_experience: 'Counts for 30% of real scouting points earned per week.',
  morale_management: "Speeds up how fast each player's real moral drifts toward the value it \"deserves,\" week by week.",
  team_cohesion: 'Lowers the real in-game turnover chance, by up to 20%.',
  composure_coaching: 'Lowers the real impact of pressure in decisive game moments, by up to 12%.',
  sm_engagement: 'Drives real passive follower growth (or loss) every week.',
  fan_interaction: 'Drives the real weekly chance of a fan-interaction event — raises one player\'s moral and the team\'s followers.',
  social_responsibility: 'Drives the real weekly chance of a social-responsibility event — raises team popularity and one player\'s fame.',
}

function statTip(field: string, role: string, isPT: boolean): string | undefined {
  const dict = isPT ? STAT_TIPS_PT : STAT_TIPS_EN
  return dict[`${field}:${role}`] ?? dict[field]
}

function StatBar({ label, value, color, tip }: { label: string, value: number, color: string, tip?: string }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs flex-shrink-0 flex items-center" style={{color:'#5c554e',width:112}}>{label}{tip && <Tooltip text={tip} />}</span>
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

export default function CoachingStaff({ staff, socialMediaFollowers }: { staff: any[], socialMediaFollowers?: number }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const ROLE_INFO: Record<string,{label:string,color:string,icon:string}> = {
    head_coach:      {label: isPT?'Head Coach':'Head Coach',           color:'#b45309',icon:'🏆'},
    assistant_coach: {label: isPT?'Ass. Treinador':'Assistant Coach',  color:'#1d4ed8',icon:'📋'},
    trainer:         {label: isPT?'Preparador Físico':'Trainer',       color:'#15803d',icon:'💪'},
    physio:          {label: isPT?'Fisioterapeuta':'Physio',           color:'#6d28d9',icon:'🏥'},
    scout:           {label: isPT?'Olheiro':'Scout',                   color:'#0e7490',icon:'🔍'},
    mental_coach:    {label: isPT?'Mental Coach':'Mental Coach',       color:'#9333ea',icon:'🧠'},
    social_media_manager: {label: isPT?'Social Media Manager':'Social Media Manager', color:'#db2777',icon:'📱'},
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
                    <StatBar label={isPT?'Aj. Ataque':'Off. Adjust'}   value={c.off_adjustment}  color="#b45309" tip={statTip('off_adjustment',c.role,isPT)} />
                    <StatBar label={isPT?'Aj. Defesa':'Def. Adjust'}   value={c.def_adjustment}  color="#15803d" tip={statTip('def_adjustment',c.role,isPT)} />
                    <StatBar label={isPT?'Substituições':'Substitutions'} value={c.substitutions} color="#1d4ed8" tip={statTip('substitutions',c.role,isPT)} />
                    <StatBar label={isPT?'Gestão Tempos':'Timeout Mgmt'}  value={c.timeout_mgmt}  color="#b45309" tip={statTip('timeout_mgmt',c.role,isPT)} />
                    <div className="text-xs font-bold uppercase tracking-wider mb-2 mt-3" style={{color:'#6d28d9',letterSpacing:'1px'}}>{isPT?'Treino':'Practice'}</div>
                    <StatBar label={isPT?'Dev. Ataque':'Off. Dev'}    value={c.off_development} color="#b45309" tip={statTip('off_development',c.role,isPT)} />
                    <StatBar label={isPT?'Dev. Defesa':'Def. Dev'}    value={c.def_development} color="#15803d" tip={statTip('def_development',c.role,isPT)} />
                    <StatBar label={isPT?'Tático':'Tactical'}          value={c.tactical_dev}    color="#1d4ed8" tip={statTip('tactical_dev',c.role,isPT)} />
                    <StatBar label={isPT?'Físico':'Physical'}           value={c.physical_dev}    color="#6d28d9" tip={statTip('physical_dev',c.role,isPT)} />
                    <StatBar label={isPT?'Mental':'Mental'}             value={c.mental_dev}      color="#b45309" tip={statTip('mental_dev',c.role,isPT)} />
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
                    <StatBar label={isPT?'Condicionamento':'Conditioning'} value={c.conditioning}   color="#15803d" tip={statTip('conditioning',c.role,isPT)} />
                    <StatBar label={isPT?'Recuperação':'Recovery'}         value={c.recovery_boost} color="#1d4ed8" tip={statTip('recovery_boost',c.role,isPT)} />
                    <StatBar label={isPT?'Prev. Lesões':'Inj. Prevent'}   value={c.injury_prevent}  color="#b45309" tip={statTip('injury_prevent',c.role,isPT)} />
                  </>
                )}
                {c.role==='physio' && (
                  <StatBar label={isPT?'Velocidade Rehab':'Rehab Speed'} value={c.rehab_speed} color="#6d28d9" tip={statTip('rehab_speed',c.role,isPT)} />
                )}
                {c.role==='scout' && (
                  <>
                    <StatBar label={isPT?'Avaliação':'Evaluation'} value={c.scouting_evaluation} color="#0e7490" tip={statTip('scouting_evaluation',c.role,isPT)} />
                    <StatBar label={isPT?'Rede Contactos':'Network'}   value={c.scouting_network}    color="#1d4ed8" tip={statTip('scouting_network',c.role,isPT)} />
                    <StatBar label={isPT?'Experiência':'Experience'}   value={c.scouting_experience} color="#6d28d9" tip={statTip('scouting_experience',c.role,isPT)} />
                  </>
                )}
                {c.role==='mental_coach' && (
                  <>
                    <StatBar label={isPT?'Gestão de Moral':'Morale Mgmt'}     value={c.morale_management}  color="#9333ea" tip={statTip('morale_management',c.role,isPT)} />
                    <StatBar label={isPT?'Coesão de Equipa':'Team Cohesion'}  value={c.team_cohesion}      color="#1d4ed8" tip={statTip('team_cohesion',c.role,isPT)} />
                    <StatBar label={isPT?'Gestão de Pressão':'Composure'}     value={c.composure_coaching} color="#b45309" tip={statTip('composure_coaching',c.role,isPT)} />
                  </>
                )}
                {c.role==='social_media_manager' && (
                  <>
                    <StatBar label={isPT?'Envolvimento':'SM Engagement'}     value={c.sm_engagement}         color="#db2777" tip={statTip('sm_engagement',c.role,isPT)} />
                    <StatBar label={isPT?'Interação c/ Fãs':'Fan Interaction'} value={c.fan_interaction}      color="#1d4ed8" tip={statTip('fan_interaction',c.role,isPT)} />
                    <StatBar label={isPT?'Resp. Social':'Social Resp.'}      value={c.social_responsibility}  color="#15803d" tip={statTip('social_responsibility',c.role,isPT)} />
                    {socialMediaFollowers!=null && (
                      <div className="text-xs mt-2 font-semibold" style={{color:'#db2777'}}>
                        📱 {Number(socialMediaFollowers).toLocaleString()} {isPT?'seguidores':'followers'}
                      </div>
                    )}
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

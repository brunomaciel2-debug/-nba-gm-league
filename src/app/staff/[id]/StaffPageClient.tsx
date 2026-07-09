'use client'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'
import CoachPhotoUpload from './CoachPhotoUpload'

// Formula-grounded, not marketing copy — mirrors CoachingStaff.tsx's
// statTip dictionary exactly, since it's the same underlying mechanics.
// A few fields share a name across roles but only really matter for one
// of them; resolveTips() below bakes the right variant in for this page's
// single coach. Some are honestly not wired to anything yet.
const TIPS_EN: Record<string,string> = {
  'off_adjustment:head_coach':"Adjusts your offense during the real game: sharpens an already-favorable matchup or dulls an unfavorable one, up to ±30%.",
  'off_adjustment:assistant_coach':"This value doesn't affect the simulation yet for the assistant coach — only the head coach's value counts toward in-game adjustments.",
  'def_adjustment:head_coach':'Same as Offense Adjust, but on the defensive side of the matchup — up to ±30%.',
  'def_adjustment:assistant_coach':"This value doesn't affect the simulation yet for the assistant coach — only the head coach's value counts toward in-game adjustments.",
  substitutions:'Not wired to any simulation formula yet — informational only for now.',
  timeout_mgmt:'Not wired to any simulation formula yet — informational only for now.',
  'off_development:head_coach':"Counts for 60% of the quality that fills the roster's weekly Offense Training slot.",
  'off_development:assistant_coach':"This value doesn't affect the simulation yet for the assistant coach — their real contribution uses internal data not shown here.",
  'def_development:head_coach':"Counts for 60% of the quality that fills the roster's weekly Defense Training slot.",
  'def_development:assistant_coach':"This value doesn't affect the simulation yet for the assistant coach — their real contribution uses internal data not shown here.",
  tactical_dev:'Counts toward the Tactical training slot quality (60% head coach + 40% assistant) and speeds up the real mastery of the team\'s tactical systems.',
  'physical_dev:head_coach':'Counts for 30% of the quality that fills the weekly Physical Training slot — the Trainer counts the other 70%.',
  'physical_dev:assistant_coach':"This value doesn't affect the simulation yet for the assistant coach — the Trainer is who counts alongside the head coach.",
  mental_dev:'Counts toward the Mental training slot quality (60% head coach + 40% assistant) — the head coach needs at least 70 here for that slot to unlock.',
  conditioning:"Raises the roster's real weekly chance of physical attribute growth (stamina, durability, rebounding).",
  recovery_boost:'Counts for 70% of the quality that fills the weekly Recovery slot — the head coach counts the other 30%.',
  injury_prevent:'Not wired to the real injury formula yet — informational only for now.',
  rehab_speed:'Speeds up injured players\' real weekly recovery, by up to 30%.',
  style_boost:'Style Match Boost — percentage bonus when GM tactics match this coach preferred style.',
  personality:'Coach Personality — affects player development and team chemistry.',
  scouting_evaluation:'Counts for 50% of real scouting points earned per week — the heaviest of the three.',
  scouting_network:'Counts for 20% of real scouting points earned per week.',
  scouting_experience:'Counts for 30% of real scouting points earned per week.',
  morale_management:"Speeds up how fast each player's real moral drifts toward the value it \"deserves,\" week by week.",
  team_cohesion:'Lowers the real in-game turnover chance, by up to 20%.',
  composure_coaching:'Lowers the real impact of pressure in decisive game moments, by up to 12%.',
  sm_engagement:'Drives real passive follower growth (or loss) every week.',
  fan_interaction:'Drives the real weekly chance of a fan-interaction event — raises one player\'s moral and the team\'s followers.',
  social_responsibility:'Drives the real weekly chance of a social-responsibility event — raises team popularity and one player\'s fame.',
}
const TIPS_PT: Record<string,string> = {
  'off_adjustment:head_coach':'Ajusta o teu ataque durante o jogo real: reforça uma vantagem de matchup já existente ou atenua uma desvantagem, até ±30%.',
  'off_adjustment:assistant_coach':'Este valor ainda não afeta a simulação para o assistente treinador — só o do Head Coach conta nos ajustes durante o jogo.',
  'def_adjustment:head_coach':'O mesmo que o Ajuste de Ataque, mas do lado defensivo do matchup — até ±30%.',
  'def_adjustment:assistant_coach':'Este valor ainda não afeta a simulação para o assistente treinador — só o do Head Coach conta nos ajustes durante o jogo.',
  substitutions:'Ainda não está ligado a nenhuma fórmula da simulação — é apenas informativo por agora.',
  timeout_mgmt:'Ainda não está ligado a nenhuma fórmula da simulação — é apenas informativo por agora.',
  'off_development:head_coach':'Conta 60% da qualidade que preenche o slot semanal de Treino de Ataque do plantel.',
  'off_development:assistant_coach':'Este valor ainda não afeta a simulação para o assistente treinador — a contribuição real dele usa dados internos não mostrados aqui.',
  'def_development:head_coach':'Conta 60% da qualidade que preenche o slot semanal de Treino de Defesa do plantel.',
  'def_development:assistant_coach':'Este valor ainda não afeta a simulação para o assistente treinador — a contribuição real dele usa dados internos não mostrados aqui.',
  tactical_dev:'Conta para a qualidade do slot de treino Tático (60% Head Coach + 40% Assistente) e acelera o domínio real dos sistemas táticos da equipa.',
  'physical_dev:head_coach':'Conta 30% da qualidade que preenche o slot semanal de Treino Físico — o Preparador Físico conta os outros 70%.',
  'physical_dev:assistant_coach':'Este valor ainda não afeta a simulação para o assistente treinador — quem conta a par do Head Coach é o Preparador Físico.',
  mental_dev:'Conta para a qualidade do slot de treino Mental (60% Head Coach + 40% Assistente) — o Head Coach precisa de pelo menos 70 aqui para esse slot desbloquear.',
  conditioning:'Aumenta a chance semanal real de evolução dos atributos físicos do plantel (resistência, durabilidade, ressaltos).',
  recovery_boost:'Conta 70% da qualidade que preenche o slot semanal de Recuperação — o Head Coach conta os outros 30%.',
  injury_prevent:'Ainda não está ligado à fórmula real de lesões — é apenas informativo por agora.',
  rehab_speed:'Acelera a recuperação semanal real de jogadores lesionados, até 30% mais rápido.',
  style_boost:'Bónus de Estilo — bónus percentual quando as táticas do GM correspondem ao estilo preferido deste treinador.',
  personality:'Personalidade do Treinador — afecta o desenvolvimento dos jogadores e a química de equipa.',
  scouting_evaluation:'Conta 50% dos pontos de scouting reais ganhos por semana — o maior peso dos três.',
  scouting_network:'Conta 20% dos pontos de scouting reais ganhos por semana.',
  scouting_experience:'Conta 30% dos pontos de scouting reais ganhos por semana.',
  morale_management:'Acelera a velocidade real com que o moral de cada jogador se aproxima do valor que "merece" ter, semana a semana.',
  team_cohesion:'Reduz a chance real de perdas de bola em jogo, até 20% a menos.',
  composure_coaching:'Reduz o impacto real da pressão em momentos decisivos do jogo, até 12%.',
  sm_engagement:'Determina o crescimento (ou perda) passivo real de seguidores todas as semanas.',
  fan_interaction:'Determina a chance semanal real de um evento de interação com fãs — sobe o moral de um jogador e os seguidores da equipa.',
  social_responsibility:'Determina a chance semanal real de um evento de responsabilidade social — sobe a popularidade da equipa e a fama de um jogador.',
}

function resolveTips(dict: Record<string,string>, role: string): Record<string,string> {
  const resolved: Record<string,string> = {}
  for (const key of Object.keys(dict)) {
    if (key.includes(':')) continue
    resolved[key] = dict[`${key}:${role}`] ?? dict[key]
  }
  return resolved
}

const ROLE_INFO_EN: Record<string,{label:string,color:string,icon:string}> = {
  head_coach:     {label:'Head Coach',      color:'#b45309',icon:'ti-whistle'},
  assistant_coach:{label:'Assistant Coach', color:'#1d4ed8',icon:'ti-clipboard-list'},
  trainer:        {label:'Trainer',         color:'#15803d',icon:'ti-activity'},
  physio:         {label:'Physio',          color:'#6d28d9',icon:'ti-heart-rate-monitor'},
  scout:          {label:'Scout',           color:'#0e7490',icon:'ti-search'},
  mental_coach:   {label:'Mental Coach',    color:'#9333ea',icon:'ti-brain'},
  social_media_manager: {label:'Social Media Manager', color:'#db2777',icon:'ti-device-mobile'},
}
const ROLE_INFO_PT: Record<string,{label:string,color:string,icon:string}> = {
  head_coach:     {label:'Head Coach',        color:'#b45309',icon:'ti-whistle'},
  assistant_coach:{label:'Ass. Treinador',    color:'#1d4ed8',icon:'ti-clipboard-list'},
  trainer:        {label:'Preparador Físico', color:'#15803d',icon:'ti-activity'},
  physio:         {label:'Fisioterapeuta',    color:'#6d28d9',icon:'ti-heart-rate-monitor'},
  scout:          {label:'Olheiro',           color:'#0e7490',icon:'ti-search'},
  mental_coach:   {label:'Mental Coach',      color:'#9333ea',icon:'ti-brain'},
  social_media_manager: {label:'Social Media Manager', color:'#db2777',icon:'ti-device-mobile'},
}
const ATK_EN: Record<string,string> = {motion:'Motion',pickroll:'Pick & Roll',transition:'Fast Break',iso:'Isolation',post:'Post-Up'}
const ATK_PT: Record<string,string> = {motion:'Motion',pickroll:'Pick & Roll',transition:'Contra-Ataque',iso:'Isolamento',post:'Jogo de Poste'}
const DEF_EN: Record<string,string> = {man:'Man-to-Man',zone23:'Zone 2-3',press:'Full Press',pack:'Pack Paint'}
const DEF_PT: Record<string,string> = {man:'Individual',zone23:'Zona 2-3',press:'Pressing Total',pack:'Defesa Fechada'}

function Tooltip({text}:{text:string}){return(<span className="relative group inline-flex ml-1 cursor-help align-middle"><span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full flex-shrink-0 text-xs font-bold" style={{background:'#cec7bc',color:'#5c554e',lineHeight:1,fontSize:9}}>i</span><span className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{background:'#1a1512',color:'#f5f1eb',width:220,whiteSpace:'normal',lineHeight:1.5,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>{text}</span></span>)}

function StatRow({label,value,color,tip}:{label:string,value:number,color:string,tip?:string}){
  if(!value)return null
  return(
    <div className="flex items-center gap-3 mb-2.5">
      <span className="text-sm w-40 flex-shrink-0" style={{color:'#5c554e'}}>{label}{tip&&<Tooltip text={tip}/>}</span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{background:'#cec7bc'}}>
        <div className="h-full rounded-full" style={{width:Math.min(value,100)+'%',background:color}}/>
      </div>
      <span className="text-sm font-bold w-8 text-right" style={{color:value>=85?'#b45309':value>=70?color:'#8a8279'}}>{value}</span>
    </div>
  )
}

export default function StaffPageClient({coach,team}:{coach:any,team:any}) {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const TIPS = resolveTips(isPT ? TIPS_PT : TIPS_EN, coach.role)
  const ROLE_INFO = isPT ? ROLE_INFO_PT : ROLE_INFO_EN
  const ATK = isPT ? ATK_PT : ATK_EN
  const DEF = isPT ? DEF_PT : DEF_EN

  const info = ROLE_INFO[coach.role] || {label:coach.role,color:'#5c554e',icon:'ti-user'}
  const tc = team ? readableTeamColor((team as any).color) : '#5c554e'
  const isCoach = coach.role==='head_coach'||coach.role==='assistant_coach'
  const isScout = coach.role==='scout'
  const contractYears = Array.from({length:coach.contract_years||1},(_,i)=>{const yr=2025+i;return{season:`${yr}-${String(yr+1).slice(2)}`,salary:coach.salary}})

  const personalityLabel = (v:number) => isPT
    ? (v<=3?'Calmo':v<=6?'Equilibrado':v<=8?'Intenso':'Impulsivo')
    : (v<=3?'Calm':v<=6?'Balanced':v<=8?'Intense':'Hot-headed')

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link href={team?`/team/${coach.team_id}`:'/trade-center'} className="text-sm no-underline flex items-center gap-1 mb-6" style={{color:'#5c554e'}}>
        <i className="ti ti-arrow-left" style={{fontSize:16}}></i>
        {team?(team as any).name:(isPT?'Free Agents':'Free Agents')}
      </Link>

      <div className="rounded-2xl p-6 mb-6" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`4px solid ${info.color}`}}>
        <div className="flex items-start gap-5 flex-wrap">
          <div className="flex flex-col gap-2 flex-shrink-0" style={{width:128}}>
            <div className="w-32 h-32 rounded-2xl overflow-hidden flex items-center justify-center" style={{background:info.color+'18',border:`2px solid ${info.color}33`}}>
              {coach.photo_url?<img src={coach.photo_url} alt={coach.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<i className={`ti ${info.icon}`} style={{fontSize:36,color:info.color}}></i>}
            </div>
            <CoachPhotoUpload coachId={coach.id} currentPhoto={coach.photo_url} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{color:info.color,letterSpacing:'1.5px'}}>{info.label}</div>
            <h1 className="text-3xl font-bold mb-1" style={{color:'#1a1512'}}>{coach.name}</h1>
            <div className="flex items-center gap-3 flex-wrap text-sm" style={{color:'#5c554e'}}>
              {coach.nationality&&<span><i className="ti ti-world" style={{fontSize:14,marginRight:4}}></i>{coach.nationality}</span>}
              {coach.age&&<span><i className="ti ti-calendar" style={{fontSize:14,marginRight:4}}></i>{isPT?'Idade':'Age'} {coach.age}</span>}
              {team&&<Link href={`/team/${coach.team_id}`} className="no-underline flex items-center gap-1.5" style={{color:tc}}>{(team as any).logo_url&&<img src={(team as any).logo_url} alt="" className="w-4 h-4 object-contain"/>}{(team as any).name}</Link>}
              {!team&&<span className="text-xs px-2 py-0.5 rounded font-semibold" style={{background:'#15803d',color:'#fff'}}>Free Agent</span>}
            </div>
            {!team&&(
              <Link href={`/trade-center/staff-offer?coach=${coach.id}`} className="inline-block mt-3 text-xs font-bold px-4 py-2 rounded-lg no-underline" style={{background:'#c8102e',color:'#fff'}}>
                {isPT?'📨 Enviar Proposta':'📨 Send Offer'}
              </Link>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-black" style={{color:'#1a1512'}}>${(coach.salary/1000000).toFixed(2)}M</div>
            <div className="text-sm" style={{color:'#5c554e'}}>/{isPT?'ano':'year'}</div>
            <div className="text-sm mt-0.5" style={{color:'#8a8279'}}>{coach.contract_years}{isPT?'ano(s)':'yr'} · ${(coach.salary*coach.contract_years/1000000).toFixed(1)}M {isPT?'total':'total'}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          {isCoach&&(
            <>
              <div className="sec-hdr mb-4"><span className="sec-title"><i className="ti ti-bolt" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>{isPT?'Jogo':'Game Time'}</span></div>
              <div className="rounded-xl p-5 mb-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
                <StatRow label={isPT?'Aj. Ataque':'Off. Adjustment'}  value={coach.off_adjustment}  color="#b45309" tip={TIPS.off_adjustment} />
                <StatRow label={isPT?'Aj. Defesa':'Def. Adjustment'}  value={coach.def_adjustment}  color="#15803d" tip={TIPS.def_adjustment} />
                <StatRow label={isPT?'Substituições':'Substitutions'}  value={coach.substitutions}   color="#1d4ed8" tip={TIPS.substitutions} />
                <StatRow label={isPT?'Gestão Tempos':'Timeout Mgmt'}   value={coach.timeout_mgmt}    color="#b45309" tip={TIPS.timeout_mgmt} />
              </div>
              <div className="sec-hdr mb-4"><span className="sec-title"><i className="ti ti-school" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>{isPT?'Treino':'Practice Time'}</span></div>
              <div className="rounded-xl p-5 mb-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
                <StatRow label={isPT?'Dev. Ataque':'Off. Development'}  value={coach.off_development} color="#b45309" tip={TIPS.off_development} />
                <StatRow label={isPT?'Dev. Defesa':'Def. Development'}  value={coach.def_development} color="#15803d" tip={TIPS.def_development} />
                <StatRow label={isPT?'Tático':'Tactical'}               value={coach.tactical_dev}    color="#1d4ed8" tip={TIPS.tactical_dev} />
                <StatRow label={isPT?'Físico':'Physical'}               value={coach.physical_dev}    color="#6d28d9" tip={TIPS.physical_dev} />
                <StatRow label={isPT?'Mental':'Mental'}                 value={coach.mental_dev}      color="#b45309" tip={TIPS.mental_dev} />
              </div>
              <div className="rounded-xl p-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
                <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1px'}}>{isPT?'Estilo & Personalidade':'Style & Personality'}</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-sm px-3 py-1 rounded-lg font-semibold" style={{background:'#b45309',color:'#fff'}}>{ATK[coach.pref_atk_style]||coach.pref_atk_style}</span>
                  <span className="text-sm px-3 py-1 rounded-lg font-semibold" style={{background:'#15803d',color:'#fff'}}>{DEF[coach.pref_def_style]||coach.pref_def_style}</span>
                  <span className="relative group text-sm px-3 py-1 rounded-lg font-semibold cursor-help" style={{background:'#1d4ed8',color:'#fff'}}>
                    +{coach.style_boost}% {isPT?'bónus estilo':'style match'}
                    <span className="absolute bottom-full left-0 mb-1 z-50 px-3 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{background:'#1a1512',color:'#f5f1eb',width:240,whiteSpace:'normal',lineHeight:1.5,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>{TIPS.style_boost}</span>
                  </span>
                </div>
                <div className="mb-1 flex justify-between text-xs" style={{color:'#5c554e'}}>
                  <span>{isPT?'Personalidade':'Personality'}<Tooltip text={TIPS.personality}/></span>
                  <span className="font-semibold">{personalityLabel(coach.personality)} ({coach.personality}/10)</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden relative" style={{background:'linear-gradient(to right,#3b82f6,#22c55e,#f97316,#ef4444)'}}>
                  <div className="absolute top-0 h-full w-3 rounded-full" style={{left:`calc(${((coach.personality-1)/9)*100}% - 6px)`,background:'#fff',boxShadow:'0 0 0 2px rgba(0,0,0,0.2)'}}/>
                </div>
                <div className="flex justify-between text-xs mt-1" style={{color:'#a89f97'}}>
                  <span>{isPT?'Calmo':'Calm'}</span><span>{isPT?'Intenso':'Intense'}</span>
                </div>
              </div>
            </>
          )}
          {coach.role==='trainer'&&(
            <div className="rounded-xl p-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e'}}>{isPT?'Atributos':'Attributes'}</div>
              <StatRow label={isPT?'Condicionamento':'Conditioning'}    value={coach.conditioning}   color="#15803d" tip={TIPS.conditioning} />
              <StatRow label={isPT?'Recuperação':'Recovery'}            value={coach.recovery_boost} color="#1d4ed8" tip={TIPS.recovery_boost} />
              <StatRow label={isPT?'Prev. Lesões':'Injury Prevention'}  value={coach.injury_prevent} color="#b45309" tip={TIPS.injury_prevent} />
            </div>
          )}
          {coach.role==='physio'&&(
            <div className="rounded-xl p-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e'}}>{isPT?'Atributos':'Attributes'}</div>
              <StatRow label={isPT?'Velocidade Rehab':'Rehab Speed'} value={coach.rehab_speed} color="#6d28d9" tip={TIPS.rehab_speed} />
              <div className="mt-4 p-3 rounded-lg text-sm" style={{background:'#eee8df',color:'#5c554e',lineHeight:1.5}}>
                {isPT?<>{isPT?'Uma velocidade de rehab de':'A rehab speed of'} <strong style={{color:'#1a1512'}}>{coach.rehab_speed}</strong> {isPT?'reduz o tempo de recuperação de lesões em aproximadamente':'reduces injury recovery time by approximately'} <strong style={{color:'#6d28d9'}}>{Math.round((coach.rehab_speed-50)/50*30)}%</strong>.</>:<>A rehab speed of <strong style={{color:'#1a1512'}}>{coach.rehab_speed}</strong> reduces injury recovery time by approximately <strong style={{color:'#6d28d9'}}>{Math.round((coach.rehab_speed-50)/50*30)}%</strong>.</>}
              </div>
            </div>
          )}
          {isScout&&(
            <div className="rounded-xl p-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e'}}>{isPT?'Atributos de Scouting':'Scouting Attributes'}</div>
              <StatRow label={isPT?'Avaliação':'Evaluation'} value={coach.scouting_evaluation} color="#0e7490" tip={TIPS.scouting_evaluation} />
              <StatRow label={isPT?'Rede Contactos':'Network'}   value={coach.scouting_network}    color="#1d4ed8" tip={TIPS.scouting_network} />
              <StatRow label={isPT?'Experiência':'Experience'}   value={coach.scouting_experience} color="#6d28d9" tip={TIPS.scouting_experience} />
              <div className="mt-4 p-3 rounded-lg text-sm" style={{background:'#eee8df',color:'#5c554e',lineHeight:1.5}}>
                {isPT?'Pontos de scouting semanais estimados:':'Estimated weekly scouting points:'} <strong style={{color:'#0e7490'}}>{Math.round((coach.scouting_evaluation||0)*0.5+(coach.scouting_experience||0)*0.3+(coach.scouting_network||0)*0.2)}</strong>.
              </div>
              {team&&<Link href="/scouting" className="inline-block mt-3 text-xs font-bold px-3 py-1.5 rounded-lg no-underline" style={{background:'#0e7490',color:'#fff'}}>{isPT?'Ir para Scouting →':'Go to Scouting →'}</Link>}
            </div>
          )}
          {coach.role==='mental_coach'&&(
            <div className="rounded-xl p-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e'}}>{isPT?'Atributos':'Attributes'}</div>
              <StatRow label={isPT?'Gestão de Moral':'Morale Management'}    value={coach.morale_management}  color="#9333ea" tip={TIPS.morale_management} />
              <StatRow label={isPT?'Coesão de Equipa':'Team Cohesion'}      value={coach.team_cohesion}      color="#1d4ed8" tip={TIPS.team_cohesion} />
              <StatRow label={isPT?'Gestão de Pressão':'Composure'}          value={coach.composure_coaching} color="#b45309" tip={TIPS.composure_coaching} />
              <div className="mt-4 p-3 rounded-lg text-sm" style={{background:'#eee8df',color:'#5c554e',lineHeight:1.5}}>
                {isPT
                  ? <>{coach.morale_management>=75?'Consegue destravar jogadores presos em moral baixa (abaixo de 50) — a maioria dos treinadores não consegue.':'Um Mental Coach mais forte (75+) consegue destravar jogadores presos em moral baixa — este ainda não chega lá.'}</>
                  : <>{coach.morale_management>=75?'Can unstick players trapped in low morale (below 50) — most coaches can\'t.':'A stronger Mental Coach (75+) can unstick players trapped in low morale — this one isn\'t quite there yet.'}</>}
              </div>
            </div>
          )}
          {coach.role==='social_media_manager'&&(
            <div className="rounded-xl p-5" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e'}}>{isPT?'Atributos':'Attributes'}</div>
              <StatRow label={isPT?'Envolvimento':'SM Engagement'}     value={coach.sm_engagement}         color="#db2777" tip={TIPS.sm_engagement} />
              <StatRow label={isPT?'Interação c/ Fãs':'Fan Interaction'} value={coach.fan_interaction}      color="#1d4ed8" tip={TIPS.fan_interaction} />
              <StatRow label={isPT?'Resp. Social':'Social Responsibility'} value={coach.social_responsibility} color="#15803d" tip={TIPS.social_responsibility} />
              {team&&(team as any).social_media_followers!=null&&(
                <div className="mt-4 p-3 rounded-lg text-sm" style={{background:'#eee8df',color:'#5c554e',lineHeight:1.5}}>
                  {isPT?'Seguidores atuais da equipa:':'Team\'s current followers:'} <strong style={{color:'#db2777'}}>{Number((team as any).social_media_followers).toLocaleString()}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="sec-hdr mb-4"><span className="sec-title"><i className="ti ti-receipt" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>{isPT?'Contrato':'Contract'}</span></div>
          <div className="rounded-xl overflow-hidden mb-5" style={{border:'1px solid #d4cdc5'}}>
            <div className="px-4 py-2.5" style={{background:'#eee8df',borderBottom:'1px solid #d4cdc5'}}>
              <div className="flex justify-between text-xs font-semibold" style={{color:'#5c554e'}}>
                <span>{isPT?'Época':'Season'}</span><span>{isPT?'Salário':'Salary'}</span>
              </div>
            </div>
            {contractYears.map((yr,i)=>(
              <div key={yr.season} className="flex justify-between items-center px-4 py-3" style={{borderBottom:i<contractYears.length-1?'1px solid #e2dcd5':'none',background:i===0?'#faf8f5':'#f5f1eb'}}>
                <div>
                  <span className="text-sm font-semibold" style={{color:'#1a1512'}}>{yr.season}</span>
                  {i===0&&<span className="ml-2 text-xs px-1.5 py-0.5 rounded font-bold" style={{background:'#c8102e',color:'#fff'}}>{isPT?'Atual':'Current'}</span>}
                </div>
                <span className="text-sm font-bold" style={{color:i===0?'#1a1512':'#5c554e'}}>${(yr.salary/1000000).toFixed(2)}M</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3" style={{background:'#eee8df',borderTop:'2px solid #d4cdc5'}}>
              <span className="text-sm font-bold" style={{color:'#1a1512'}}>{isPT?'Total':'Total'}</span>
              <span className="text-sm font-black" style={{color:'#c8102e'}}>${(contractYears.reduce((s,y)=>s+y.salary,0)/1000000).toFixed(1)}M</span>
            </div>
          </div>
          {coach.natural_role&&coach.natural_role!==coach.role&&(
            <div className="rounded-xl p-4" style={{background:'#fff8e8',border:'1px solid #b45309',borderLeft:'4px solid #b45309'}}>
              <div className="text-xs font-bold mb-1" style={{color:'#b45309'}}><i className="ti ti-alert-triangle" style={{marginRight:4}}></i>{isPT?'Incompatibilidade de Função':'Role Mismatch'}</div>
              <div className="text-sm" style={{color:'#5c554e'}}>
                {isPT?<>Função natural é <strong>{coach.natural_role.replace(/_/g,' ')}</strong>. A atribuição atual implica uma penalização de 30% na eficácia.</>:<>Natural role is <strong>{coach.natural_role.replace(/_/g,' ')}</strong>. Current assignment incurs a 30% effectiveness penalty.</>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

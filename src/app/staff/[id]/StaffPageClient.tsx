'use client'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'
import CoachPhotoUpload from './CoachPhotoUpload'

const TIPS_EN: Record<string,string> = {
  off_adjustment:'Offensive Adjustment — how well the coach reads the opponent defence and adapts the attack in real time.',
  def_adjustment:'Defensive Adjustment — ability to identify and neutralise the opponent offensive system.',
  substitutions:'Substitutions — making the right rotation at the right moment.',
  timeout_mgmt:'Timeout Management — knowing when to call a timeout and what to say.',
  off_development:'Offensive Development — how effectively this coach improves players offensive skills over time.',
  def_development:'Defensive Development — improves players defensive attributes each week.',
  tactical_dev:'Tactical Development — improves basketball IQ and team-play attributes.',
  physical_dev:'Physical Development — improves athletic conditioning attributes.',
  mental_dev:'Mental Development — builds psychological resilience.',
  conditioning:'Conditioning — reduces health loss per game and per training session.',
  recovery_boost:'Recovery — increases daily health recovery between games.',
  injury_prevent:'Injury Prevention — reduces the base probability of injuries occurring.',
  rehab_speed:'Rehab Speed — reduces the recovery time of injured players.',
  style_boost:'Style Match Boost — percentage bonus when GM tactics match this coach preferred style.',
  personality:'Coach Personality — affects player development and team chemistry.',
  scouting_evaluation:'Evaluation — raw talent-judging ability. Drives weekly scouting points.',
  scouting_network:'Network — contacts across college programs, agents and international leagues.',
  scouting_experience:'Experience — years spent evaluating talent.',
  morale_management:'Morale Management — speeds up (or unlocks, below 50) weekly morale recovery for every player on the roster.',
  team_cohesion:'Team Cohesion — real on-court chemistry: more assisted baskets, fewer unforced turnovers.',
  composure_coaching:'Composure — how much less a team tightens up in clutch, decisive, and rivalry moments.',
  sm_engagement:'Social Media Engagement — grows (or shrinks) the team\'s real follower count every week, which feeds into jersey/fame growth and a small attendance boost.',
  fan_interaction:'Team-Fan Interaction — chance each week of a meet & greet/autograph event, which grows the Loyal Fan share of your crowd and lifts one player\'s morale.',
  social_responsibility:'Social Responsibility — chance each week of a charity event, which lifts real franchise popularity and one player\'s fame.',
}
const TIPS_PT: Record<string,string> = {
  off_adjustment:'Ajuste Ofensivo — capacidade de ler a defesa adversária e adaptar o ataque em tempo real.',
  def_adjustment:'Ajuste Defensivo — capacidade de identificar e neutralizar o sistema ofensivo adversário.',
  substitutions:'Substituições — fazer a rotação certa no momento certo.',
  timeout_mgmt:'Gestão de Tempos — saber quando pedir tempo e o que dizer.',
  off_development:'Desenvolvimento Ofensivo — como este treinador melhora as capacidades ofensivas dos jogadores ao longo do tempo.',
  def_development:'Desenvolvimento Defensivo — melhora os atributos defensivos dos jogadores por semana.',
  tactical_dev:'Desenvolvimento Tático — melhora o QI de basquetebol e atributos de jogo de equipa.',
  physical_dev:'Desenvolvimento Físico — melhora os atributos de condicionamento atlético.',
  mental_dev:'Desenvolvimento Mental — desenvolve resiliência psicológica.',
  conditioning:'Condicionamento — reduz a perda de saúde por jogo e por sessão de treino.',
  recovery_boost:'Recuperação — aumenta a recuperação diária de saúde entre jogos.',
  injury_prevent:'Prevenção de Lesões — reduz a probabilidade base de lesões em jogos e treinos.',
  rehab_speed:'Velocidade de Reabilitação — reduz o tempo de recuperação de jogadores lesionados.',
  style_boost:'Bónus de Estilo — bónus percentual quando as táticas do GM correspondem ao estilo preferido deste treinador.',
  personality:'Personalidade do Treinador — afecta o desenvolvimento dos jogadores e a química de equipa.',
  scouting_evaluation:'Avaliação — capacidade bruta de julgamento de talento. Impulsiona os pontos de scouting semanais.',
  scouting_network:'Rede de Contactos — contactos em programas universitários, agentes e ligas internacionais.',
  scouting_experience:'Experiência — anos passados a avaliar talento.',
  morale_management:'Gestão de Moral — acelera (ou desbloqueia, abaixo de 50) a recuperação semanal de moral de todo o plantel.',
  team_cohesion:'Coesão de Equipa — química real em campo: mais cestos assistidos, menos perdas de bola.',
  composure_coaching:'Gestão de Pressão — quanto menos a equipa se contrai em momentos clutch, decisivos e de rivalidade.',
  sm_engagement:'Social Media Engagement — faz crescer (ou encolher) o número real de seguidores da equipa todas as semanas, o que alimenta o crescimento de fama/merchandising e um pequeno bónus de assistência.',
  fan_interaction:'Interação com Fãs — hipótese semanal de um evento meet & greet/autógrafos, que aumenta a fatia de Fãs Fiéis no teu público e sobe a moral de um jogador.',
  social_responsibility:'Responsabilidade Social — hipótese semanal de um evento de caridade, que sobe a popularidade real da equipa e a fama de um jogador.',
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
  const TIPS = isPT ? TIPS_PT : TIPS_EN
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

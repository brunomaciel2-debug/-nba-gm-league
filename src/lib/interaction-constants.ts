// Shared constants and bilingual text for the Player Interactions system.
// The reason pool itself lives in the player_interaction_types table (fixed
// game content, same pattern as injury_types); this file holds the numbers
// that aren't worth a DB round-trip and the text generators, which need
// per-interaction context (names, targets) the DB row alone doesn't carry.

export const MORAL_DISCONTENT_THRESHOLD = 40
export const WEEKLY_TRIGGER_CHANCE = 0.25
export const IMMEDIATE_AUTO_EXPIRE_WEEKS = 2

export type ResolutionType = 'monitored' | 'immediate'
export type InteractionStatus = 'pending_response' | 'monitoring' | 'resolved'
export type ResponseChoice = 'concede' | 'compromise' | 'dismiss'
export type MonitoredOutcome = 'met' | 'partial' | 'ignored'

export interface ComplaintCtx {
  playerName: string
  teamName?: string
  demandTarget?: number
  baselineValue?: number
  partnerName?: string
  deadlineWeek?: number
}

// The complaint itself — what the player says when the interaction is created.
export function buildComplaintText(reasonKey: string, lang: 'en'|'pt', ctx: ComplaintCtx): string {
  const p = ctx.playerName
  const t = (pt: string, en: string) => lang === 'pt' ? pt : en
  switch (reasonKey) {
    case 'wants_more_minutes':
      return t(
        `${p} está descontente com o tempo de jogo. Exige uma média de ${ctx.demandTarget} minutos/jogo nas próximas ${ctx.deadlineWeek ? 2 : 2} semanas (média atual: ${ctx.baselineValue} min).`,
        `${p} is unhappy with his playing time. He's demanding an average of ${ctx.demandTarget} min/game over the next 2 weeks (current average: ${ctx.baselineValue} min).`)
    case 'wants_starter_role':
      return t(`${p} sente que já mereceu ser titular e quer entrar no cinco inicial nas próximas 2 semanas.`,
        `${p} feels he's earned a starting spot and wants to be in the starting five over the next 2 weeks.`)
    case 'wants_more_touches':
      return t(`${p} sente-se secundário na equipa e quer ser uma das opções ofensivas prioritárias nas próximas 2 semanas.`,
        `${p} feels like an afterthought on offense and wants to be one of the priority scoring options over the next 2 weeks.`)
    case 'wants_clutch_role':
      return t(`${p} acha que merece a bola nos momentos decisivos e quer ser o Jogador de Clutch da equipa nas próximas 2 semanas.`,
        `${p} believes he's earned the ball in crunch time and wants to be the team's Clutch Player over the next 2 weeks.`)
    case 'wants_lockdown_role':
      return t(`${p} quer ser reconhecido como o defensor de referência da equipa — pede para ser designado Defensor de Marcação pelo menos uma vez nas próximas 2 semanas.`,
        `${p} wants to be recognized as the team's defensive stopper — he's asking to be assigned Lockdown Defender at least once over the next 2 weeks.`)
    case 'wants_more_rest':
      return t(`${p} sente-se fisicamente desgastado e pede uma redução na carga de treino/ritmo de jogo nas próximas 2 semanas.`,
        `${p} feels physically worn down and is asking for lighter training load/pace over the next 2 weeks.`)
    case 'wants_more_three_rate':
      return t(`${p} sente que a equipa não lhe dá lançamentos de 3 suficientes para o seu talento e pede mais liberdade de lançamento nas próximas 2 semanas.`,
        `${p} feels the team isn't feeding his 3-point shooting enough and wants more green light over the next 2 weeks.`)
    case 'wants_to_play_with_teammate':
      return t(`${p} sente uma boa ligação em campo com ${ctx.partnerName} e pede para serem titulares juntos com mais frequência nas próximas 2 semanas.`,
        `${p} feels real chemistry on the floor with ${ctx.partnerName} and is asking to start alongside him more often over the next 2 weeks.`)
    case 'conflict_with_teammate':
      return t(`Há tensão no balneário entre ${p} e ${ctx.partnerName}. ${p} quer que tomes uma posição sobre a situação.`,
        `There's locker room tension between ${p} and ${ctx.partnerName}. ${p} wants you to take a stance on it.`)
    case 'wants_veteran_mentor':
      return t(`${p} sente falta de orientação de um jogador mais experiente no plantel.`,
        `${p} feels like he's missing guidance from a more experienced player on the roster.`)
    case 'unhappy_with_team_record':
      return t(`${p} está frustrado com o registo da equipa e questiona a direção do projeto.`,
        `${p} is frustrated with the team's record and is questioning the direction of the project.`)
    case 'wants_leadership_recognition':
      return t(`${p} sente que o seu papel de liderança no balneário não é reconhecido.`,
        `${p} feels his leadership role in the locker room isn't being recognized.`)
    case 'wants_contract_extension_talks':
      return t(`${p} está preocupado com o futuro contratual dele e quer garantias sobre uma extensão.`,
        `${p} is anxious about his contract situation and wants assurances about an extension.`)
    case 'feels_underpaid':
      return t(`${p} acha que o salário dele não reflete o valor real dele para a equipa.`,
        `${p} feels his salary doesn't reflect his real value to the team.`)
    case 'feels_development_neglected':
      return t(`${p} sente que o seu desenvolvimento tem sido negligenciado pela equipa técnica.`,
        `${p} feels his development has been neglected by the coaching staff.`)
    case 'wants_specialist_for_injury':
      return t(`${p} está frustrado com a lentidão da recuperação e pede que a equipa invista num especialista externo.`,
        `${p} is frustrated with how slowly he's recovering and is asking the team to invest in an outside specialist.`)
    case 'homesickness_family':
      return t(`${p} está a passar por saudades de casa/família e isso está a afetar o seu bem-estar.`,
        `${p} is dealing with homesickness/family matters, and it's affecting his well-being.`)
    case 'media_pressure_stress':
      return t(`${p} sente-se sob pressão excessiva da imprensa e do escrutínio público.`,
        `${p} feels under excessive pressure from the media and public scrutiny.`)
    case 'personal_crisis':
      return t(`${p} está a atravessar um momento pessoal difícil e precisa de compreensão da parte da organização.`,
        `${p} is going through a difficult personal moment and needs understanding from the organization.`)
    case 'wants_front_office_aggression':
      return t(`${p} quer ver a direção a ser mais agressiva no mercado (contratações/trocas) para reforçar a equipa.`,
        `${p} wants to see the front office be more aggressive in the market (signings/trades) to strengthen the team.`)
    default:
      return t(`${p} está genericamente descontente e quer falar contigo sobre a situação dele na equipa.`,
        `${p} is generally unhappy and wants to talk to you about his situation on the team.`)
  }
}

// Live progress line shown in the Interactions tab while a monitored demand is open.
export function buildProgressText(lang: 'en'|'pt', demandTarget: number, currentProgress: number, deadlineWeek: number, currentWeek: number): string {
  const weeksLeft = Math.max(0, deadlineWeek - currentWeek)
  return lang === 'pt'
    ? `Pediu ${demandTarget} · registo atual: ${currentProgress} · faltam ${weeksLeft} semana${weeksLeft!==1?'s':''}`
    : `Asked for ${demandTarget} · current tracking: ${currentProgress} · ${weeksLeft} week${weeksLeft!==1?'s':''} left`
}

export function buildResolutionText(lang: 'en'|'pt', playerName: string, outcome: MonitoredOutcome | ResponseChoice, moralDelta: number, reasonKey?: string): string {
  const sign = moralDelta >= 0 ? '+' : ''
  const outcomeLabel: Record<string, {pt:string,en:string}> = {
    met:        { pt: 'Cumpriste o que ele pediu', en: 'You delivered on what he asked' },
    partial:    { pt: 'Cumpriste só em parte', en: 'You only partially delivered' },
    ignored:    { pt: 'Não cumpriste o pedido dele', en: "You didn't follow through" },
    concede:    { pt: 'Decidiste ceder ao pedido dele', en: 'You decided to give in to his request' },
    compromise: { pt: 'Optaste por um meio-termo', en: 'You chose a middle ground' },
    dismiss:    { pt: 'Decidiste não ceder', en: 'You decided not to give in' },
  }
  const label = outcomeLabel[outcome]
  let extra = ''
  // "Concede" here is a real commitment (an agreement to talk), never a
  // guaranteed contract change — it doesn't bypass the real negotiation in
  // ContractExtensionPanel, which still checks fairness/ambition/loyalty on
  // its own. Point the GM at the actual mechanism instead of implying this
  // click alone changed his deal.
  if (outcome === 'concede' && (reasonKey === 'wants_contract_extension_talks' || reasonKey === 'feels_underpaid')) {
    extra = lang === 'pt'
      ? ' Isto é só a conversa — vai à página dele e usa a Extensão de Contrato para fazeres uma proposta real.'
      : " This is just the conversation — go to his player page and use Contract Extension to make a real offer."
  }
  return lang === 'pt'
    ? `${label?.pt || outcome} com ${playerName}. Moral: ${sign}${moralDelta}.${extra}`
    : `${label?.en || outcome} with ${playerName}. Morale: ${sign}${moralDelta}.${extra}`
}

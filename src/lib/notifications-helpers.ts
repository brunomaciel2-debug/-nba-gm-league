// Helper para gerar notificações bilingues
// Lê o idioma do GM a partir do gm_profiles.language

import { createClient } from '@supabase/supabase-js'
import { formatSimMonthName } from './season-week-helper'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cache de idiomas por equipa para não fazer N queries desnecessárias numa simulação
const langCache: Record<string, 'en' | 'pt'> = {}

export async function getTeamLang(teamId: string): Promise<'en' | 'pt'> {
  if (langCache[teamId]) return langCache[teamId]
  const { data } = await supabase
    .from('gm_profiles')
    .select('language')
    .eq('team_id', teamId)
    .single()
  const lang = (data?.language === 'pt' ? 'pt' : 'en') as 'en' | 'pt'
  langCache[teamId] = lang
  return lang
}

export function clearLangCache() {
  Object.keys(langCache).forEach(k => delete langCache[k])
}

export function notifWelcome(lang: 'en'|'pt', teamName: string) {
  return {
    subject: lang === 'pt' ? `🏀 Bem-vindo aos ${teamName}!` : `🏀 Welcome to the ${teamName}!`,
    body: lang === 'pt'
      ? `A Direção deseja-te as boas-vindas à liga. Antes da próxima simulação, escolhe os teus patrocinadores no separador Patrocínios, define as tuas ordens semanais e explora a tua equipa. Boa sorte!`
      : `Ownership welcomes you to the league. Before the next simulation, pick your sponsors in the Sponsors tab, set your weekly orders, and explore your team. Good luck!`,
  }
}

// ── Notification text generators ────────────────────────
// Each function returns subject + body in the correct language

export function notifTradeAccepted(lang: 'en'|'pt', team: string, proposalId: string) {
  return {
    subject: lang === 'pt' ? `✅ Trade aceite pelos ${team}` : `✅ Trade accepted by ${team}`,
    body: lang === 'pt'
      ? `A tua proposta de trade foi aceite pelos ${team}. A negociação já foi processada — verifica o teu plantel para veres os jogadores atualizados.`
      : `Your trade proposal has been accepted by ${team}. The trade has been processed — check your roster for the updated players.`,
  }
}

export function notifTradeRejected(lang: 'en'|'pt', team: string, reason?: string) {
  const reasonText = reason ? (lang === 'pt' ? `\n\nMotivo: ${reason}` : `\n\nReason: ${reason}`) : ''
  return {
    subject: lang === 'pt' ? `❌ Trade rejeitada pelos ${team}` : `❌ Trade rejected by ${team}`,
    body: lang === 'pt'
      ? `A tua proposta de trade foi rejeitada pelos ${team}.${reasonText}\n\nPodes submeter uma proposta revista ou procurar outros parceiros de trade.`
      : `Your trade proposal has been rejected by ${team}.${reasonText}\n\nYou can submit a revised offer or look for other trade partners.`,
  }
}

export function notifPlayerArrival(lang: 'en'|'pt', player: string, fromTeam: string) {
  return {
    subject: lang === 'pt' ? `🤝 ${player} juntou-se à tua equipa!` : `🤝 ${player} has joined your team!`,
    body: lang === 'pt'
      ? `${player} chegou via trade dos ${fromTeam}. Já está no teu plantel ativo — revê a tua rotação para o integrar.`
      : `${player} has arrived via trade from ${fromTeam}. They're now on your active roster — review your depth chart to integrate them into your rotation.`,
  }
}

export function notifFAWon(lang: 'en'|'pt', player: string) {
  return {
    subject: lang === 'pt' ? `✅ Contrataste o ${player}!` : `✅ Signed ${player}!`,
    body: lang === 'pt'
      ? `O ${player} aceitou a tua proposta e assinou um contrato de 1 ano por 650K$.`
      : `${player} has accepted your offer and signed a 1-year, $650K contract.`,
  }
}

export function notifFALost(lang: 'en'|'pt', player: string) {
  return {
    subject: lang === 'pt' ? `❌ Perdeste o ${player}` : `❌ Missed out on ${player}`,
    body: lang === 'pt'
      ? `O ${player} assinou por outra equipa. A tua proposta não foi escolhida desta vez — continua atento ao mercado de free agency para outras oportunidades.`
      : `${player} has signed elsewhere. Your offer was not selected this time — keep an eye on the free agent pool for other opportunities.`,
  }
}

export function notifFanInteractionEvent(lang: 'en'|'pt', playerName: string) {
  return {
    subject: lang === 'pt' ? `📱 Meet & Greet organizado pelo teu Social Media Manager` : `📱 Meet & greet organized by your Social Media Manager`,
    body: lang === 'pt'
      ? `O teu Social Media Manager organizou uma sessão de meet & greet/autógrafos com os adeptos, com ${playerName} em destaque. Isto sobe a fatia de Fãs Fiéis no teu público e a moral de ${playerName} subiu.`
      : `Your Social Media Manager organized a meet & greet/autograph session with fans, featuring ${playerName}. This grows the Loyal Fan share of your crowd, and ${playerName}'s morale went up.`,
  }
}

export function notifSocialResponsibilityEvent(lang: 'en'|'pt', playerName: string) {
  return {
    subject: lang === 'pt' ? `🤝 Evento de caridade organizado pelo teu Social Media Manager` : `🤝 Charity event organized by your Social Media Manager`,
    body: lang === 'pt'
      ? `O teu Social Media Manager organizou um evento de responsabilidade social, com ${playerName} em destaque. A popularidade da equipa subiu, e a fama de ${playerName} também.`
      : `Your Social Media Manager organized a social responsibility/charity event, featuring ${playerName}. Team popularity went up, and so did ${playerName}'s fame.`,
  }
}

export function notifDeadCapCleared(lang: 'en'|'pt', player: string, amount: number) {
  const fmt = (n: number) => `${(n/1_000_000).toFixed(1)}M$`
  return {
    subject: lang === 'pt' ? `💰 Salário morto removido — ${player} assinou noutro lado` : `💰 Dead cap cleared — ${player} signed elsewhere`,
    body: lang === 'pt'
      ? `O ${player} assinou por outra equipa. O salário morto de ${fmt(amount)} foi removido da tua folha salarial.`
      : `${player} has signed with another team. The $${(amount/1_000_000).toFixed(1)}M dead cap charge has been removed from your salary cap.`,
  }
}

const ROLE_LABEL_EN: Record<string,string> = { head_coach:'Head Coach', assistant_coach:'Assistant Coach', trainer:'Trainer', physio:'Physio' }
const ROLE_LABEL_PT: Record<string,string> = { head_coach:'Head Coach', assistant_coach:'Assistante Treinador', trainer:'Preparador Físico', physio:'Fisioterapeuta' }

export function notifStaffOfferWon(lang: 'en'|'pt', name: string, role: string, salary: number, years: number) {
  const roleLabel = (lang==='pt'?ROLE_LABEL_PT:ROLE_LABEL_EN)[role] || role
  const fmt = (n: number) => `$${(n/1_000_000).toFixed(2)}M`
  return {
    subject: lang === 'pt' ? `✅ Contrataste ${name}!` : `✅ Signed ${name}!`,
    body: lang === 'pt'
      ? `${name} aceitou a tua proposta e assinou como ${roleLabel} por ${fmt(salary)}/ano × ${years} ano${years!==1?'s':''}.`
      : `${name} has accepted your offer and signed as ${roleLabel} for ${fmt(salary)}/yr × ${years} year${years!==1?'s':''}.`,
  }
}

export function notifStaffOfferLost(lang: 'en'|'pt', name: string) {
  return {
    subject: lang === 'pt' ? `❌ Perdeste ${name}` : `❌ Missed out on ${name}`,
    body: lang === 'pt'
      ? `${name} assinou por outra equipa. A tua proposta não foi escolhida desta vez.`
      : `${name} has signed elsewhere. Your offer was not selected this time.`,
  }
}

export function notifFAMarketWon(lang: 'en'|'pt', name: string, salary: number, years: number) {
  const fmt = (n: number) => `$${(n/1_000_000).toFixed(2)}M`
  return {
    subject: lang === 'pt' ? `✅ Contrataste ${name}!` : `✅ Signed ${name}!`,
    body: lang === 'pt'
      ? `${name} escolheu a tua proposta durante a Free Agency e assinou por ${fmt(salary)}/ano × ${years} ano${years!==1?'s':''}.`
      : `${name} picked your offer during Free Agency and signed for ${fmt(salary)}/yr × ${years} year${years!==1?'s':''}.`,
  }
}

export function notifFAMarketLost(lang: 'en'|'pt', name: string) {
  return {
    subject: lang === 'pt' ? `❌ Perdeste ${name}` : `❌ Missed out on ${name}`,
    body: lang === 'pt'
      ? `${name} escolheu outra proposta durante a Free Agency. A tua não foi a selecionada desta vez.`
      : `${name} picked a different offer during Free Agency. Yours wasn't the one selected this time.`,
  }
}

export function notifDraftSubmissionOpen(lang: 'en'|'pt', round: 1|2, pickCount: number) {
  return {
    subject: lang === 'pt' ? `🎓 Submissão do Draft aberta — Ronda ${round}` : `🎓 Draft submission open — Round ${round}`,
    body: lang === 'pt'
      ? `Já podes submeter a tua lista de prioridades para a Ronda ${round} do Draft. A tua equipa tem ${pickCount} escolha${pickCount!==1?'s':''} nesta ronda — vai à Draft Board para ordenar os teus prospectos preferidos.`
      : `You can now submit your priority list for Round ${round} of the Draft. Your team has ${pickCount} pick${pickCount!==1?'s':''} in this round — head to the Draft Board to rank your preferred prospects.`,
  }
}

export function notifDraftPickResult(lang: 'en'|'pt', prospectName: string, pickNumber: number, round: 1|2, salary: number) {
  const fmt = (n: number) => `$${(n/1_000_000).toFixed(2)}M`
  return {
    subject: lang === 'pt' ? `🎓 Escolheste ${prospectName}! (Pick #${pickNumber})` : `🎓 You drafted ${prospectName}! (Pick #${pickNumber})`,
    body: lang === 'pt'
      ? `Com a escolha #${pickNumber} (Ronda ${round}), a tua equipa selecionou ${prospectName}. Contrato de rookie: ${fmt(salary)}/ano × 2 anos garantidos. Já podes ver os atributos completos na página do jogador — tens 7 dias para confirmar o contrato ou ele torna-se agente livre.`
      : `With pick #${pickNumber} (Round ${round}), your team selected ${prospectName}. Rookie contract: ${fmt(salary)}/yr × 2 guaranteed years. Full attributes are now visible on the player page — you have 7 days to confirm the contract or he becomes a free agent.`,
  }
}

export function notifDraftLotteryResult(lang: 'en'|'pt', pickNumber: number, originalSeed: number, oddsPct: number) {
  const movedUp = pickNumber < originalSeed
  return {
    subject: lang === 'pt' ? `🎱 Draft Lottery — vais escolher em #${pickNumber}` : `🎱 Draft Lottery — you'll pick #${pickNumber}`,
    body: lang === 'pt'
      ? `O sorteio da draft foi realizado. Tinhas ${oddsPct.toFixed(1)}% de hipótese na 1ª escolha (lugar de partida: #${originalSeed}) e vais escolher na posição #${pickNumber}.${movedUp ? ' Subiste na ordem — sorte tua!' : pickNumber > originalSeed ? ' Desceste alguns lugares em relação ao teu lugar de partida.' : ' Ficaste exatamente no teu lugar de partida.'}`
      : `The draft lottery has been drawn. You had a ${oddsPct.toFixed(1)}% chance at the #1 pick (starting position #${originalSeed}), and you'll pick #${pickNumber}.${movedUp ? " You moved up — lucky draw!" : pickNumber > originalSeed ? ' You slid down a few spots from your starting position.' : ' You stayed exactly at your starting position.'}`,
  }
}

export function notifDraftConfirmExpired(lang: 'en'|'pt', name: string) {
  return {
    subject: lang === 'pt' ? `⏰ Prazo expirado — ${name}` : `⏰ Confirmation window expired — ${name}`,
    body: lang === 'pt'
      ? `Não confirmaste o contrato de ${name} dentro do prazo de 7 dias. Tornou-se agente livre.`
      : `You didn't confirm ${name}'s contract within the 7-day window. He's now a free agent.`,
  }
}

export function notifRookieOptionEligible(lang: 'en'|'pt', name: string, stage: 'Y3'|'Y4', amount: number, deadline: Date) {
  const fmt = (n: number) => `$${(n/1_000_000).toFixed(2)}M`
  const deadlineStr = deadline.toLocaleDateString(lang==='pt'?'pt-PT':'en-US', { day:'numeric', month:'short', year:'numeric' })
  return {
    subject: lang === 'pt' ? `📋 Team Option disponível — ${name}` : `📋 Team Option available — ${name}`,
    body: lang === 'pt'
      ? `A opção de equipa do ano ${stage==='Y3'?'3':'4'} de ${name} já pode ser exercida — ${fmt(amount)}/ano. Decide até ${deadlineStr} ou ele torna-se agente livre.`
      : `${name}'s Year ${stage==='Y3'?'3':'4'} team option is now available to exercise — ${fmt(amount)}/yr. Decide by ${deadlineStr} or he becomes a free agent.`,
  }
}

export function notifRookieOptionAutoDeclined(lang: 'en'|'pt', name: string) {
  return {
    subject: lang === 'pt' ? `⏰ Team Option expirada — ${name}` : `⏰ Team Option expired — ${name}`,
    body: lang === 'pt'
      ? `Não exerceste a Team Option de ${name} dentro do prazo. Tornou-se agente livre.`
      : `You didn't exercise ${name}'s Team Option within the deadline. He's now a free agent.`,
  }
}

export function notifScoutTier(lang: 'en'|'pt', scoutName: string, tier: number, revealCount: number, creditCost: number, maintenance: number) {
  const maint = maintenance > 0 ? (lang === 'pt' ? `\n\nManter este tier custa ${maintenance/1000}K$/semana, debitados automaticamente do teu saldo.` : `\n\nHolding this tier costs $${maintenance/1000}K/week, billed automatically from your balance.`) : ''
  return {
    subject: lang === 'pt' ? `🔍 Tier ${tier} de Scouting desbloqueado!` : `🔍 Scouting Tier ${tier} unlocked!`,
    body: lang === 'pt'
      ? `O ${scoutName} atingiu a capacidade de Tier ${tier}! Já podes revelar até ${revealCount} atributos por sessão por ${creditCost} créditos — uma melhor relação créditos/atributo do que nos tiers anteriores.${maint}\n\nVai ao separador Scouting para começar a avaliar os prospectos do draft.`
      : `${scoutName} has reached Tier ${tier} scouting capability! You can now reveal up to ${revealCount} attributes per session for ${creditCost} credits (a better credits-per-attribute ratio than lower tiers).${maint}\n\nVisit the Scouting tab to start evaluating draft prospects.`,
  }
}

export function notifScoutMaintenanceNegative(lang: 'en'|'pt', tier: number, maintenance: number, balance: number) {
  return {
    subject: lang === 'pt' ? `⚠️ Manutenção de scouting levou o teu saldo a negativo` : `⚠️ Scouting maintenance pushed your balance negative`,
    body: lang === 'pt'
      ? `A tua operação de Scouting de Tier ${tier} custa ${maintenance/1000}K$/semana. Este débito levou o teu saldo a ${(balance/1_000_000).toFixed(2)}M$. Considera a tua situação financeira antes de gastar mais.`
      : `Your Tier ${tier} scouting operation costs $${maintenance/1000}K/week. This week's charge brought your balance to $${(balance/1_000_000).toFixed(2)}M. Consider your financial situation before further spending.`,
  }
}

export function notifWeeklyResults(lang: 'en'|'pt', teamName: string, wins: number, losses: number, lastGame: {opp: string, score: string, won: boolean}) {
  return {
    subject: lang === 'pt' ? `📊 Resultados da Semana — ${teamName}` : `📊 Weekly Results — ${teamName}`,
    body: lang === 'pt'
      ? `Último jogo: ${lastGame.won ? '✅ Vitória' : '❌ Derrota'} vs ${lastGame.opp} (${lastGame.score})\n\nRegisto atual: ${wins}V - ${losses}D`
      : `Last game: ${lastGame.won ? '✅ Win' : '❌ Loss'} vs ${lastGame.opp} (${lastGame.score})\n\nCurrent record: ${wins}W - ${losses}L`,
  }
}

// occurredIn mirrors injury_log.occurred_in — 'game', 'preseason_game'
// (real-game generator), plus 'practice' and 'off_court' (see
// src/lib/practice-injuries.ts). Left optional so any unrecognized value
// degrades to the generic "in a game" phrasing instead of breaking.
// gameContext (e.g. "vs Miami Heat, 99-96") only applies to occurredIn==='game'
// or 'preseason_game' — practice/off-court injuries have no opponent or score.
export function notifInjury(lang: 'en'|'pt', player: string, injuryType: string, gamesOut: number, occurredIn?: string, gameContext?: string) {
  const where = occurredIn === 'preseason_game'
    ? (lang === 'pt' ? ` num jogo amigável${gameContext ? ' '+gameContext : ''}` : ` in a friendly game${gameContext ? ' '+gameContext : ''}`)
    : occurredIn === 'practice'
    ? (lang === 'pt' ? ' num treino' : ' in practice')
    : occurredIn === 'off_court'
    ? (lang === 'pt' ? ' fora do ambiente profissional' : ' off the court')
    : (lang === 'pt' ? ` num jogo${gameContext ? ' '+gameContext : ''}` : ` in a game${gameContext ? ' '+gameContext : ''}`)
  return {
    subject: lang === 'pt' ? `🏥 Lesão — ${player}` : `🏥 Injury — ${player}`,
    body: lang === 'pt'
      ? `O ${player} sofreu uma ${injuryType}${where} e deverá falhar aproximadamente ${gamesOut} jogo${gamesOut !== 1 ? 's' : ''}.`
      : `${player} suffered a ${injuryType}${where} and is expected to miss approximately ${gamesOut} game${gamesOut !== 1 ? 's' : ''}.`,
  }
}

export function notifSpecialistUsed(lang: 'en'|'pt', player: string, cost: number, boostMultiplier: number) {
  const fmt = (n: number) => `$${(n/1000).toFixed(0)}K`
  const pct = Math.round((boostMultiplier - 1) * 100)
  return {
    subject: lang === 'pt' ? `🩺 Especialista visto — ${player}` : `🩺 Specialist consulted — ${player}`,
    body: lang === 'pt'
      ? `Pagaste ${fmt(cost)} para levar ${player} a um especialista externo. A recuperação dele vai ser ${pct}% mais rápida a partir de agora, até estar totalmente recuperado.`
      : `You paid ${fmt(cost)} to send ${player} to an outside specialist. His recovery will be ${pct}% faster from now on, until he's fully healed.`,
  }
}

export function notifTechnicalFoul(
  lang: 'en'|'pt', player: string, seasonTechs: number, techsUntilNextSuspension: number,
  gamesSuspendedNow: number, isPostseason: boolean
) {
  const phase = isPostseason ? (lang === 'pt' ? 'playoffs' : 'postseason') : (lang === 'pt' ? 'época regular' : 'regular season')
  if (gamesSuspendedNow > 0) {
    return {
      subject: lang === 'pt' ? `🚫 Suspensão — ${player}` : `🚫 Suspension — ${player}`,
      body: lang === 'pt'
        ? `O ${player} atingiu ${seasonTechs} faltas técnicas na ${phase} e foi suspenso por ${gamesSuspendedNow} jogo${gamesSuspendedNow !== 1 ? 's' : ''}.\n\nPróxima suspensão daqui a ${techsUntilNextSuspension} falta${techsUntilNextSuspension !== 1 ? 's' : ''} técnica${techsUntilNextSuspension !== 1 ? 's' : ''}.`
        : `${player} reached ${seasonTechs} technical fouls in the ${phase} and has been suspended for ${gamesSuspendedNow} game${gamesSuspendedNow !== 1 ? 's' : ''}.\n\nNext suspension in ${techsUntilNextSuspension} more technical${techsUntilNextSuspension !== 1 ? 's' : ''}.`,
    }
  }
  return {
    subject: lang === 'pt' ? `🟨 Falta Técnica — ${player}` : `🟨 Technical Foul — ${player}`,
    body: lang === 'pt'
      ? `O ${player} recebeu uma falta técnica — a nº${seasonTechs} da ${phase}.\n\nDaqui a ${techsUntilNextSuspension} falta${techsUntilNextSuspension !== 1 ? 's' : ''} técnica${techsUntilNextSuspension !== 1 ? 's' : ''}, o jogador é automaticamente suspenso por 1 jogo.`
      : `${player} picked up a technical foul — #${seasonTechs} of the ${phase}.\n\n${techsUntilNextSuspension} more technical${techsUntilNextSuspension !== 1 ? 's' : ''} will trigger an automatic 1-game suspension.`,
  }
}

export function notifDroppedOutPlayoffs(lang: 'en'|'pt', conference: string) {
  return {
    subject: lang === 'pt' ? `📉 Caíste fora dos playoffs` : `📉 You dropped out of the playoffs`,
    body: lang === 'pt'
      ? `Estás atualmente fora dos lugares de playoff na Conferência ${conference === 'Eastern' ? 'Este' : 'Oeste'}. Precisas de ganhar jogos urgentemente.`
      : `You have dropped out of playoff position in the ${conference} Conference. You need to win games urgently to get back in.`,
  }
}

export function notifLeadingConference(lang: 'en'|'pt', conference: string, wins: number, losses: number) {
  return {
    subject: lang === 'pt' ? `🥇 Lideras a tua conferência!` : `🥇 You lead your conference!`,
    body: lang === 'pt'
      ? `Estás em #1 na Conferência ${conference === 'Eastern' ? 'Este' : 'Oeste'} com um registo de ${wins}V-${losses}D. Continua assim.`
      : `You are #1 in the ${conference} Conference with a ${wins}-${losses} record. Keep it up.`,
  }
}

export function notifWinStreak(lang: 'en'|'pt', teamName: string, streak: number) {
  return {
    subject: lang === 'pt' ? `🔥 Série de ${streak} vitórias!` : `🔥 ${streak}-game winning streak!`,
    body: lang === 'pt'
      ? `Os ${teamName} estão em chama com ${streak} vitórias consecutivas. Boa altura para manteres a pressão.`
      : `The ${teamName} are on fire with ${streak} consecutive wins. This is the time to stay aggressive.`,
  }
}

export function notifLossStreak(lang: 'en'|'pt', teamName: string, streak: number) {
  return {
    subject: lang === 'pt' ? `❄️ Série de ${streak} derrotas` : `❄️ ${streak}-game losing streak`,
    body: lang === 'pt'
      ? `Os ${teamName} perderam ${streak} jogos consecutivos. Considera ajustar as tuas ordens semanais, rotação ou fazer um movimento para mudar a dinâmica.`
      : `The ${teamName} have lost ${streak} games in a row. Consider adjusting your weekly orders, rotation or making a move to shake things up.`,
  }
}

export function notifRivalWin(lang: 'en'|'pt', rivalName: string) {
  return {
    subject: lang === 'pt' ? `⚔️ Vitória contra o rival ${rivalName}!` : `⚔️ Rivalry win vs ${rivalName}!`,
    body: lang === 'pt'
      ? `Derrotaste o teu rival ${rivalName} esta semana. Verifica os teus objetivos de patrocínio — pode ter ativado um bónus!`
      : `You defeated your rival ${rivalName} this week. Check your sponsor objectives — this may have triggered a bonus!`,
  }
}

export function notifPlayerDiscontent(lang: 'en'|'pt', player: string, complaintText: string) {
  return {
    subject: lang === 'pt' ? `😟 ${player} quer falar contigo` : `😟 ${player} wants to talk`,
    body: lang === 'pt'
      ? `${complaintText}\n\nVê o separador "Interações com Jogadores" da tua equipa para responder.`
      : `${complaintText}\n\nCheck your team's "Player Interactions" tab to respond.`,
  }
}

export function notifInteractionResolved(lang: 'en'|'pt', player: string, resolutionText: string) {
  return {
    subject: lang === 'pt' ? `📋 Interação com ${player} resolvida` : `📋 Interaction with ${player} resolved`,
    body: resolutionText,
  }
}

export function notifSummerLeagueRosters(lang: 'en'|'pt', teamName: string) {
  return {
    subject: lang === 'pt' ? `🏀 Roster da Summer League definido` : `🏀 Summer League roster set`,
    body: lang === 'pt'
      ? `Já sabemos quem representa os ${teamName} na Summer League de Las Vegas — os teus Rookies e Sophomores lideram a equipa, completada com jovens agentes livres. Vê o separador Summer League para o calendário e os jogos.`
      : `We know who's representing the ${teamName} at the Las Vegas Summer League — your Rookies and Sophomores lead the team, filled out with young free agents. Check the Summer League tab for the schedule and games.`,
  }
}

export function notifSummerLeagueResult(lang: 'en'|'pt', teamName: string, resultText: string) {
  return {
    subject: lang === 'pt' ? `🏀 Summer League — resultado` : `🏀 Summer League — result`,
    body: resultText,
  }
}

export function notifDevelopment(lang: 'en'|'pt', player: string, attributes: string[]) {
  return {
    subject: lang === 'pt' ? `📈 ${player} evoluiu!` : `📈 ${player} has developed!`,
    body: lang === 'pt'
      ? `O ${player} melhorou esta semana: ${attributes.join(', ')}.`
      : `${player} improved this week: ${attributes.join(', ')}.`,
  }
}

export function notifLowMorale(lang: 'en'|'pt', player: string, morale: number) {
  return {
    subject: lang === 'pt' ? `😟 Moral baixa — ${player}` : `😟 Low morale — ${player}`,
    body: lang === 'pt'
      ? `O ${player} tem uma moral de ${morale}/100. Jogadores com baixa moral têm pior consistência e podem recusar renovações. Considera o tempo de jogo e os resultados recentes.`
      : `${player} has a morale of ${morale}/100. Low morale affects consistency and may cause players to reject contract extensions. Consider their playing time and recent results.`,
  }
}

export function notifContractExpiring(lang: 'en'|'pt', player: string) {
  return {
    subject: lang === 'pt' ? `⏰ Contrato a expirar — ${player}` : `⏰ Contract expiring — ${player}`,
    body: lang === 'pt'
      ? `O contrato do ${player} expira no final desta época. Se não renovares, passará a free agent. Vai ao separador de Contratos para agir.`
      : `${player}'s contract expires at the end of this season. If not renewed, they will become a free agent. Visit the Contracts tab to act.`,
  }
}

export function notifArenaConstruction(lang: 'en'|'pt', section: string, completed: boolean) {
  return {
    subject: lang === 'pt'
      ? completed ? `🏗️ Construção concluída — ${section}` : `🏗️ Construção quase pronta — ${section}`
      : completed ? `🏗️ Construction completed — ${section}` : `🏗️ Construction nearly complete — ${section}`,
    body: lang === 'pt'
      ? completed
        ? `A secção ${section} do teu pavilhão foi concluída. Vai ao separador Instalações para ver o impacto.`
        : `A construção da secção ${section} está quase concluída. Deverá ficar pronta na próxima semana.`
      : completed
        ? `The ${section} section of your arena has been completed. Visit the Facilities tab to see the impact.`
        : `Construction on the ${section} section is nearly complete. It should be ready next week.`,
  }
}

export function notifTrainingCredits(lang: 'en'|'pt', totalCredits: number, slotCount: number, slotNames: string) {
  return {
    subject: lang === 'pt' ? `🏋️ Créditos de treino prontos — ${totalCredits} créditos!` : `🏋️ Training credits ready — ${totalCredits} credits!`,
    body: lang === 'pt'
      ? `Tens ${totalCredits} créditos de treino disponíveis em ${slotCount} slot${slotCount > 1 ? 's' : ''}:\n\n${slotNames}\n\nGasta-os no separador Treino para desenvolver os teus jogadores. Os slots não acumulam mais depois de cheios — não desperdices a capacidade!`
      : `You have ${totalCredits} training credits available across ${slotCount} slot${slotCount > 1 ? 's' : ''}:\n\n${slotNames}\n\nSpend them in the Training tab to develop your players. Slots won't fill further until you spend — don't waste the capacity!`,
  }
}

export function notifOrdersReminder(lang: 'en'|'pt') {
  return {
    subject: lang === 'pt' ? `📋 Lembrete — Ordens Semanais` : `📋 Reminder — Weekly Orders`,
    body: lang === 'pt'
      ? `Não te esqueças de submeter as tuas ordens semanais antes da próxima simulação. Define a tua rotação, táticas e intensidade de treino para maximizar os resultados da tua equipa.`
      : `Don't forget to submit your weekly orders before the next simulation. Set your rotation, tactics and training intensity to maximise your team's results.`,
  }
}

export function notifSponsorPayment(lang: 'en'|'pt', amount: number) {
  const fmt = (n: number) => `${(n/1_000_000).toFixed(2)}M$`
  return {
    subject: lang === 'pt' ? `💰 Pagamento mensal de patrocínio recebido` : `💰 Monthly sponsor payment received`,
    body: lang === 'pt'
      ? `Recebeste o teu pagamento mensal de patrocínio de ${fmt(amount)}. Verifica o separador Finanças para o detalhe completo.`
      : `You received your monthly sponsor payment of $${(amount/1_000_000).toFixed(2)}M. Check the Finances tab for the full breakdown.`,
  }
}

export function notifSeasonEnd(lang: 'en'|'pt', weeksLeft: number) {
  return {
    subject: lang === 'pt' ? `🏁 O fim da época está a aproximar-se` : `🏁 Season end approaching`,
    body: lang === 'pt'
      ? `Faltam apenas ${weeksLeft} semanas para o final da época regular. Aproveita para resolver contratos, finalizar trades e preparar a equipa para os playoffs.`
      : `Only ${weeksLeft} weeks remain in the regular season. Use this time to resolve contracts, finalise trades and prepare your team for the playoffs.`,
  }
}

export function notifGLeagueStart(lang: 'en'|'pt') {
  return {
    subject: lang === 'pt' ? `🏀 A G-League está prestes a começar` : `🏀 The G-League is about to start`,
    body: lang === 'pt'
      ? `A época da G-League arranca a 27 de Dezembro. Se ainda não o fizeste, considera atribuir jogadores da tua equipa à tua afiliada da G-League antes do início — dá-lhes minutos e desenvolvimento que não teriam no plantel principal.`
      : `The G-League season tips off on December 27. If you haven't already, consider assigning players from your roster down to your G-League affiliate before it starts — it gives them minutes and development they wouldn't get on the main roster.`,
  }
}

export function notifGMInactivity(lang: 'en'|'pt', name: string, days: number) {
  return {
    subject: lang === 'pt' ? `⚠️ Não estás ativo há ${days} dias` : `⚠️ You haven't been active for ${days} days`,
    body: lang === 'pt'
      ? `Olá ${name} — não iniciaste sessão há ${days} dias.\n\nA tua equipa precisa de atenção:\n• As ordens semanais podem estar em falta\n• Os créditos de treino podem estar cheios\n• Pode haver oportunidades de patrocínio à espera\n\nInicia sessão e verifica a tua franquia!`
      : `Hi ${name} — you haven't logged in for ${days} days.\n\nYour team needs attention:\n• Weekly orders may be missing\n• Training credits may be full\n• Sponsor opportunities may be waiting\n\nLog in and check your franchise!`,
  }
}

export function notifAward(lang: 'en'|'pt', player: string, award: string, isAllStar: boolean) {
  return {
    subject: lang === 'pt'
      ? isAllStar ? `⭐ ${player} selecionado para o All-Star!` : `🏆 ${player} venceu o prémio de ${award}!`
      : isAllStar ? `⭐ ${player} selected as All-Star!` : `🏆 ${player} wins ${award}!`,
    body: lang === 'pt'
      ? isAllStar
        ? `Parabéns! O ${player} foi selecionado para o jogo All-Star. Uma grande honra para a tua franquia.`
        : `O ${player} foi distinguido com o prémio de ${award}. Um marco histórico para a tua franquia.`
      : isAllStar
        ? `Congratulations! ${player} has been selected for the All-Star game. A great honour for your franchise.`
        : `${player} has been awarded ${award}. A landmark achievement for your franchise.`,
  }
}

export function notifCapCritical(lang: 'en'|'pt', remaining: number, pct: number) {
  return {
    subject: lang === 'pt' ? `⚠️ Margem salarial criticamente baixa` : `⚠️ Cap space critically low`,
    body: lang === 'pt'
      ? `A tua equipa tem apenas ${(remaining/1_000_000).toFixed(1)}M$ de margem salarial (${pct.toFixed(0)}% do tecto de 180M$ utilizado). Cuidado com novas contratações — pode ser necessário um movimento de plantel para manteres a conformidade.`
      : `Your team has only $${(remaining/1_000_000).toFixed(1)}M in cap space remaining (${pct.toFixed(0)}% of the $180M cap used). Be careful with further signings — you may need to make a roster move to stay compliant.`,
  }
}

export function notifRosterMinimumRisk(lang: 'en'|'pt', rosterSize: number, spotsNeeded: number, capSpace: number, minRoster: number) {
  return {
    subject: lang === 'pt' ? `⚠️ Risco de ficar abaixo do mínimo de plantel` : `⚠️ Risk of falling below roster minimum`,
    body: lang === 'pt'
      ? `A tua equipa tem ${rosterSize} jogadores e apenas ${(capSpace/1_000_000).toFixed(1)}M$ de margem salarial. Precisas de mais ${spotsNeeded} jogador${spotsNeeded !== 1 ? 'es' : ''} para atingir o mínimo de ${minRoster}, e a tua margem pode não chegar para os contratar ao salário mínimo.`
      : `Your team has ${rosterSize} players and only $${(capSpace/1_000_000).toFixed(1)}M in cap space. You need ${spotsNeeded} more player${spotsNeeded !== 1 ? 's' : ''} to reach the ${minRoster}-player minimum, and your remaining cap space may not be enough.`,
  }
}

const TACTICAL_SYSTEM_LABELS: Record<string, { en: string, pt: string }> = {
  motion:     { en: 'Motion Offense', pt: 'Motion Offense' },
  pickroll:   { en: 'Pick & Roll',    pt: 'Pick & Roll' },
  transition: { en: 'Fast Break',     pt: 'Contra-ataque' },
  iso:        { en: 'Isolation',      pt: 'Isolamento' },
  post:       { en: 'Post-Up',        pt: 'Poste' },
}

// Fires every sim while the team's active offensive system has no valid
// focus tech chosen — per design, that system's Tactical Familiarity makes
// literally zero progress until the GM actively picks one (no auto-pick
// fallback), so this keeps nagging instead of leaving it silently stalled.
export function notifTacticalFocusNeeded(lang: 'en'|'pt', system: string) {
  const label = TACTICAL_SYSTEM_LABELS[system]?.[lang] || system
  return {
    subject: lang === 'pt' ? `🧠 Escolhe a próxima tech a desenvolver` : `🧠 Choose your next tech to develop`,
    body: lang === 'pt'
      ? `A tua equipa está a jogar ${label} mas ainda não escolheste qual a próxima tech a desenvolver — sem essa escolha, a Familiaridade Tática deste sistema não avança nenhuma semana. Vai ao separador Sistemas Táticos e escolhe uma tech desbloqueada.`
      : `Your team is running ${label} but you haven't picked which tech to develop next — without that choice, this system's Tactical Familiarity won't progress at all this week. Head to the Tactical Systems tab and pick an unlocked tech.`,
  }
}

export function notifMonthlySettlement(lang: 'en'|'pt', subsidy: number, coaching: number, utilities: number, insurance: number, net: number) {
  const fmt = (n: number) => '$' + (n/1000).toFixed(0) + 'K'
  return {
    subject: lang === 'pt' ? `💵 Acerto Financeiro Mensal` : `💵 Monthly Financial Settlement`,
    body: lang === 'pt'
      ? `Acerto mensal processado:\n\n💰 Subsídio NBA: +${fmt(subsidy)}\n👔 Staff Técnico: -${fmt(coaching)}\n⚡ Utilidades: -${fmt(utilities)}\n🛡️ Seguros: -${fmt(insurance)}\n\nResultado líquido: ${net>=0?'+':''}${fmt(net)}\n\nVê o Extrato no separador Finanças para o detalhe completo.`
      : `Monthly settlement processed:\n\n💰 NBA Subsidy: +${fmt(subsidy)}\n👔 Coaching Staff: -${fmt(coaching)}\n⚡ Utilities: -${fmt(utilities)}\n🛡️ Insurance: -${fmt(insurance)}\n\nNet result: ${net>=0?'+':''}${fmt(net)}\n\nCheck the Balance Sheet in the Finances tab for the full detail.`,
  }
}

export function notifJerseySalesReport(lang: 'en'|'pt', monthNum: number, topPlayerName: string, topPlayerRevenue: number, totalRevenue: number) {
  const fmt = (n: number) => '$' + (n >= 1000000 ? (n/1000000).toFixed(1)+'M' : (n/1000).toFixed(0)+'K')
  return {
    subject: lang === 'pt' ? `👕 Relatório de Merchandising — ${formatSimMonthName(monthNum,'pt-PT')}` : `👕 Merchandising Report — ${formatSimMonthName(monthNum,'en-US')}`,
    body: lang === 'pt'
      ? `A equipa faturou ${fmt(totalRevenue)} em venda de jerseys este mês. ${topPlayerName} liderou as vendas, sozinho responsável por ${fmt(topPlayerRevenue)}.`
      : `The team made ${fmt(totalRevenue)} in jersey sales this month. ${topPlayerName} led the way, alone responsible for ${fmt(topPlayerRevenue)}.`,
  }
}

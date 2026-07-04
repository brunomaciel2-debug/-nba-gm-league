// Helper para gerar notificações bilingues
// Lê o idioma do GM a partir do gm_profiles.language

import { createClient } from '@supabase/supabase-js'

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

export function notifDeadCapCleared(lang: 'en'|'pt', player: string, amount: number) {
  const fmt = (n: number) => `${(n/1_000_000).toFixed(1)}M$`
  return {
    subject: lang === 'pt' ? `💰 Salário morto removido — ${player} assinou noutro lado` : `💰 Dead cap cleared — ${player} signed elsewhere`,
    body: lang === 'pt'
      ? `O ${player} assinou por outra equipa. O salário morto de ${fmt(amount)} foi removido da tua folha salarial.`
      : `${player} has signed with another team. The $${(amount/1_000_000).toFixed(1)}M dead cap charge has been removed from your salary cap.`,
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

export function notifInjury(lang: 'en'|'pt', player: string, injuryType: string, gamesOut: number) {
  return {
    subject: lang === 'pt' ? `🏥 Lesão — ${player}` : `🏥 Injury — ${player}`,
    body: lang === 'pt'
      ? `O ${player} sofreu uma ${injuryType} e deverá falhar aproximadamente ${gamesOut} jogo${gamesOut !== 1 ? 's' : ''}.`
      : `${player} suffered a ${injuryType} and is expected to miss approximately ${gamesOut} game${gamesOut !== 1 ? 's' : ''}.`,
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

export function notifPlayoffBubble(lang: 'en'|'pt', conference: string, rank: number) {
  return {
    subject: lang === 'pt' ? `⚠️ Estás na bolha dos playoffs` : `⚠️ You are on the playoff bubble`,
    body: lang === 'pt'
      ? `Estás atualmente em #${rank} na Conferência ${conference === 'Eastern' ? 'Este' : 'Oeste'} — o último lugar dos playoffs. Uma má semana pode tirarte da corrida.`
      : `You are currently #${rank} in the ${conference} Conference — the last playoff spot. One bad week could drop you to the play-in.`,
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

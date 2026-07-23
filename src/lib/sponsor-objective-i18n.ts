// Sponsor objective descriptions are stored in English only in
// sponsor_objectives.description (used verbatim in emails/inbox messages,
// which stay English-canonical). This maps each exact string to its PT
// rendering for the GM-facing UI (SponsorsTab). Keyed by the literal
// English text rather than objective_type+threshold because a few
// objective_types have more than one distinct real-world phrasing across
// different sponsor templates (e.g. two different wordings both checking
// cap_utilization).
const PT_BY_EN: Record<string, string> = {
  'Average home attendance above 85%': 'Assistência média em casa acima de 85%',
  'Home attendance above 80% across season': 'Assistência em casa acima de 80% durante a época',
  'Win the championship': 'Vencer o campeonato',
  'Build at least 5 concession amenities in your arena': 'Construir pelo menos 5 comodidades de restauração no teu pavilhão',
  'Achieve fan satisfaction score above 70': 'Atingir uma satisfação dos adeptos acima de 70',
  'Build a Jumbotron in your arena': 'Construir um Jumbotron no teu pavilhão',
  'No player misses 20+ games through injury': 'Nenhum jogador falha 20+ jogos por lesão',
  'Have at least 1 player selected for All-Star': 'Ter pelo menos 1 jogador selecionado para o All-Star',
  'Rookie or sophomore improves OVR by 5+ points': 'Um rookie ou jogador no 2º ano melhora o OVR em 5+ pontos',
  'Have at least 1 player improve OVR by 3+ points': 'Ter pelo menos 1 jogador a melhorar o OVR em 3+ pontos',
  'Average 118+ points per game': 'Média de 118+ pontos por jogo',
  'Reach conference finals': 'Chegar à final de conferência',
  'Reach the NBA Finals': 'Chegar às Finais da NBA',
  'Qualify for the playoffs': 'Qualificar para os playoffs',
  'Finish top 6 in your conference': 'Terminar no top 6 da tua conferência',
  'Finish top 2 in your division': 'Terminar no top 2 da tua divisão',
  'Have at least 2 players score 20+ PPG on the season': 'Ter pelo menos 2 jogadores com 20+ pontos por jogo na época',
  '2 players finish top 10 in league scoring': '2 jogadores terminam no top 10 de pontuadores da liga',
  'Win 8+ games by 20+ point margin': 'Vencer 8+ jogos por margem de 20+ pontos',
  'Win 20+ games by double digits': 'Vencer 20+ jogos por dupla dígito de diferença',
  'Win 8+ consecutive home games': 'Vencer 8+ jogos consecutivos em casa',
  'Win 18 or more home games': 'Vencer 18 ou mais jogos em casa',
  'Win 22 or more home games': 'Vencer 22 ou mais jogos em casa',
  'Beat your divisional rival 3+ times this season': 'Vencer o teu rival de divisão 3+ vezes esta época',
  'Win streak of 7+ consecutive games': 'Série de 7+ vitórias consecutivas',
  'Win 42 or more regular season games': 'Vencer 42 ou mais jogos da época regular',
  'Defeat 3+ top-5 teams in the standings': 'Derrotar 3+ equipas do top-5 da classificação',
  'Average home attendance above 82%': 'Assistência média em casa acima de 82%',
  'Win streak of 5+ consecutive games': 'Série de 5+ vitórias consecutivas',
}

export function translateObjectiveDescription(description: string, isPT: boolean): string {
  if (!isPT) return description
  return PT_BY_EN[description] || description
}

// Covers both the English and Portuguese generic-rival phrasing so the
// rival-name substitution keeps working regardless of which language the
// description was just translated into.
export const RIVAL_PLACEHOLDER_PATTERN = /your divisional rival|your rival|o teu rival de divisão|o teu rival/gi

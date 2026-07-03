// src/lib/elo-helper.ts
// Elo rating system for game odds calculation

export const ELO_K = 20       // sensitivity (standard NBA value)
export const HOME_ADV = 100   // home court advantage in Elo points

/** Win probability for team A given Elo differential */
export function eloWinProb(eloDiff: number): number {
  return 1 / (1 + Math.pow(10, -eloDiff / 400))
}

/** Expected win probability for home team */
export function homeWinProb(homeElo: number, awayElo: number): number {
  return eloWinProb(homeElo - awayElo + HOME_ADV)
}

/** Updated Elo after a game */
export function updateElo(elo: number, won: boolean, expected: number): number {
  return Math.round(elo + ELO_K * ((won ? 1 : 0) - expected))
}

/** Format probability as percentage string e.g. "67%" */
export function fmtPct(prob: number): string {
  return Math.round(prob * 100) + '%'
}

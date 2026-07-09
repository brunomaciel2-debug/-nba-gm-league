// Pure aggregator for the trade proposal builder. Turns "who sends what,
// and where does each piece go" into the per-team players_in/players_out
// rows the trade_proposal_teams table (and /api/trade/respond's dynamic
// destination-matching) expects. Generalizes cleanly from 2 to N teams —
// a 2-team trade is just the N=2 case where every asset's destination is
// the other team.
export type TradeAssetSend = {
  fromTeam: string
  players: string[]
  picks: string[]
  playerSalaries: Record<string, number>
  destinations: Record<string, string> // assetId -> destination team id
  defaultDest: string // used when an asset has no explicit destination set
}

export type TradeTeamRow = {
  team_id: string
  players_out: string[]
  players_in: string[]
  picks_out: string[]
  picks_in: string[]
  salary_out: number
  salary_in: number
}

export function buildTradeTeamRows(sends: TradeAssetSend[]): TradeTeamRow[] {
  const rows: Record<string, TradeTeamRow> = {}
  const ensure = (id: string) => {
    if (!rows[id]) rows[id] = { team_id: id, players_out: [], players_in: [], picks_out: [], picks_in: [], salary_out: 0, salary_in: 0 }
    return rows[id]
  }

  for (const s of sends) {
    if (!s.fromTeam) continue
    ensure(s.fromTeam)
    for (const pid of s.players) {
      const dest = s.destinations[pid] || s.defaultDest
      if (!dest) continue
      ensure(dest)
      const salary = s.playerSalaries[pid] || 0
      rows[s.fromTeam].players_out.push(pid)
      rows[s.fromTeam].salary_out += salary
      rows[dest].players_in.push(pid)
      rows[dest].salary_in += salary
    }
    for (const pk of s.picks) {
      const dest = s.destinations[pk] || s.defaultDest
      if (!dest) continue
      ensure(dest)
      rows[s.fromTeam].picks_out.push(pk)
      rows[dest].picks_in.push(pk)
    }
  }
  return Object.values(rows)
}

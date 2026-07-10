import { SupabaseClient } from '@supabase/supabase-js'

// The legacy 'transactions' table backs the site-wide /transactions news
// feed. Before this, only injury/suspension code paths ever wrote to it —
// trades, signings, cuts and draft picks always happened silently, so the
// feed always looked "quiet" no matter how much roster activity was going on.
const LEGACY_TYPE: Record<string, string> = { trade: 'trade', fa_signing: 'signing', cut: 'waiver', draft: 'signing' }

// Single insert point for every player_transactions row, so trade/FA/cut/
// draft code paths all produce the exact same shape — used by both the
// player page's "Transfer History" panel and the team page's
// "Transferências" tab. Also mirrors a human-readable entry into the
// legacy 'transactions' table for non-trade moves, which really are one
// event per player. Trades are NOT mirrored here — a single trade calls
// this once per player moved, which would otherwise produce one near-
// duplicate legacy row per player instead of one row for the whole trade;
// see recordTradeLegacyTransaction, called once after all legs execute.
export async function recordPlayerTransaction(
  admin: SupabaseClient,
  args: {
    playerId: number | string
    type: 'trade' | 'fa_signing' | 'cut' | 'draft'
    fromTeamId?: string | null
    toTeamId?: string | null
    season: string
    week?: number | null
    proposalId?: string | null
  }
) {
  await admin.from('player_transactions').insert({
    player_id: args.playerId,
    type: args.type,
    from_team_id: args.fromTeamId ?? null,
    to_team_id: args.toTeamId ?? null,
    season: args.season,
    week_number: args.week ?? null,
    proposal_id: args.proposalId ?? null,
  })

  if (args.type === 'trade') return

  try {
    const [{ data: player }, { data: teams }] = await Promise.all([
      admin.from('players').select('name').eq('id', args.playerId).single(),
      admin.from('teams').select('id,name').in('id', [args.fromTeamId, args.toTeamId].filter(Boolean) as string[]),
    ])
    const teamNameMap: Record<string, string> = {}
    for (const t of (teams || [])) teamNameMap[t.id] = t.name
    const playerName = player?.name || `Player #${args.playerId}`
    const fromName = args.fromTeamId ? (teamNameMap[args.fromTeamId] || args.fromTeamId) : 'free agency'
    const toName = args.toTeamId ? (teamNameMap[args.toTeamId] || args.toTeamId) : 'free agency'

    const description =
      args.type === 'fa_signing' ? `${playerName} signed by ${toName}${args.fromTeamId ? ` (previously ${fromName})` : ''}` :
      args.type === 'cut' ? `${playerName} waived by ${fromName}` :
      `${playerName} drafted by ${toName}`

    await admin.from('transactions').insert({
      type: LEGACY_TYPE[args.type] || args.type,
      description,
      teams: [args.fromTeamId, args.toTeamId].filter(Boolean),
      players: [playerName],
      status: 'completed',
      week_number: args.week ?? null,
    })
  } catch (legacyErr) { console.warn('Failed to mirror into legacy transactions feed', legacyErr) }
}

// Builds ONE legacy 'transactions' row for a whole trade — every team's
// full send list (players AND picks) in a single entry — instead of the
// one-row-per-player-leg approach recordPlayerTransaction uses for
// simpler moves. Call once, after every team's players/picks have already
// been moved for this proposal.
export async function recordTradeLegacyTransaction(admin: SupabaseClient, proposalId: string, week?: number | null) {
  try {
    const { data: teamRows } = await admin.from('trade_proposal_teams').select('*').eq('proposal_id', proposalId)
    if (!teamRows || teamRows.length === 0) return

    const teamIds = teamRows.map((t: any) => t.team_id)
    const allPlayerIds = Array.from(new Set(teamRows.flatMap((t: any) => [...(t.players_out || []), ...(t.players_in || [])])))
    const allPickIds = Array.from(new Set(teamRows.flatMap((t: any) => [...(t.picks_out || []), ...(t.picks_in || [])])))

    const [{ data: teamRecords }, { data: players }, { data: picks }] = await Promise.all([
      admin.from('teams').select('id,name').in('id', teamIds),
      allPlayerIds.length ? admin.from('players').select('id,name').in('id', allPlayerIds) : Promise.resolve({ data: [] as any[] }),
      allPickIds.length ? admin.from('draft_picks').select('id,season,round').in('id', allPickIds) : Promise.resolve({ data: [] as any[] }),
    ])
    const teamNameMap: Record<string, string> = {}
    for (const t of (teamRecords || [])) teamNameMap[t.id] = t.name
    const playerNameMap: Record<string, string> = {}
    for (const p of (players || [])) playerNameMap[p.id] = p.name
    const pickLabelMap: Record<string, string> = {}
    for (const pk of (picks || [])) pickLabelMap[pk.id] = `${pk.season} R${pk.round} pick`

    const parts = teamRows.map((t: any) => {
      const sent = [
        ...(t.players_out || []).map((id: any) => playerNameMap[id]).filter(Boolean),
        ...(t.picks_out || []).map((id: any) => pickLabelMap[id]).filter(Boolean),
      ]
      return `${teamNameMap[t.team_id] || t.team_id} sends ${sent.length ? sent.join(', ') : 'nothing'}`
    })

    await admin.from('transactions').insert({
      type: 'trade',
      description: parts.join(' · '),
      teams: teamIds,
      players: allPlayerIds.map((id: any) => playerNameMap[id]).filter(Boolean),
      status: 'completed',
      week_number: week ?? null,
    })
  } catch (legacyErr) { console.warn('Failed to record trade legacy transaction', legacyErr) }
}

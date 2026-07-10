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
// legacy 'transactions' table so it shows up on the site-wide feed too.
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
      args.type === 'trade' ? `${playerName} traded from ${fromName} to ${toName}` :
      args.type === 'fa_signing' ? `${playerName} signed by ${toName}${args.fromTeamId ? ` (previously ${fromName})` : ''}` :
      args.type === 'cut' ? `${playerName} waived by ${fromName}` :
      `${playerName} drafted by ${toName}`

    await admin.from('transactions').insert({
      type: LEGACY_TYPE[args.type] || args.type,
      description,
      teams: [args.fromTeamId, args.toTeamId].filter(Boolean),
      players: [playerName],
      status: 'completed',
    })
  } catch (legacyErr) { console.warn('Failed to mirror into legacy transactions feed', legacyErr) }
}

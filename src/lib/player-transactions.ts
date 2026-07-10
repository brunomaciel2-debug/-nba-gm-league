import { SupabaseClient } from '@supabase/supabase-js'

// Single insert point for every player_transactions row, so trade/FA/cut/
// draft code paths all produce the exact same shape — used by both the
// player page's "Transfer History" panel and the team page's
// "Transferências" tab.
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
}

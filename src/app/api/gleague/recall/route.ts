import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const playerId = body.get('playerId') as string

  // Fetch BEFORE clearing gleague_team_id — need it for the transaction
  // description below, and it's about to be nulled out.
  const { data: player } = await admin.from('players').select('name,team_id,gleague_team_id').eq('id', playerId).single()

  await admin.from('players').update({
    on_gleague_assignment: false,
    gleague_team_id: null
  }).eq('id', playerId)

  // Mirror into the site-wide Transactions feed — see assign/route.ts for
  // why this previously showed up nowhere at all.
  try {
    const playerName = player?.name || `Player #${playerId}`
    const { data: glTeam } = player?.gleague_team_id
      ? await admin.from('gleague_teams').select('name').eq('id', player.gleague_team_id).single()
      : { data: null }
    const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
    await admin.from('transactions').insert({
      type: 'gleague_recall', category: 'player',
      description: `${playerName} recalled from the G-League${glTeam?.name ? ` (${glTeam.name})` : ''}`,
      teams: player?.team_id ? [player.team_id] : [], players: [playerName], player_ids: [playerId],
      status: 'completed', week_number: cfg?.current_week ?? null,
      // Structured from/to so the Transactions feed can draw a real
      // logo-to-logo arrow instead of just naming one team in prose.
      details: { from: { kind: 'gleague_team', id: player?.gleague_team_id || null }, to: { kind: 'nba_team', id: player?.team_id || null } },
    })
  } catch (legacyErr) { console.warn('Failed to record G-League recall transaction', legacyErr) }

  const referer = req.headers.get('referer') || '/'
  return NextResponse.redirect(new URL(referer, req.url))
}

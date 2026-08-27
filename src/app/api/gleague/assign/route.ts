import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const playerId = body.get('playerId') as string
  const teamId   = body.get('teamId') as string

  // Find the G-League affiliate for this team
  const { data: glTeam } = await admin.from('gleague_teams').select('id,name').eq('nba_affiliate', teamId).single()
  if (!glTeam) return NextResponse.redirect(new URL('/', req.url))

  await admin.from('players').update({
    on_gleague_assignment: true,
    gleague_team_id: glTeam.id
  }).eq('id', playerId)

  // Mirror into the site-wide Transactions feed — this move previously
  // happened completely silently, so /transactions never showed any sign
  // a player had ever been sent down or brought back up.
  try {
    const [{ data: player }, { data: cfg }] = await Promise.all([
      admin.from('players').select('name').eq('id', playerId).single(),
      admin.from('season_config').select('current_week').eq('id', 1).single(),
    ])
    const playerName = player?.name || `Player #${playerId}`
    const week = cfg?.current_week ?? null
    await admin.from('transactions').insert({
      type: 'gleague_assign', category: 'player',
      description: `${playerName} assigned to the G-League (${glTeam.name})`,
      teams: [teamId], players: [playerName], player_ids: [playerId],
      status: 'completed', week_number: week,
      // Structured from/to so the Transactions feed can draw a real
      // logo-to-logo arrow instead of just naming one team in prose.
      details: { from: { kind: 'nba_team', id: teamId }, to: { kind: 'gleague_team', id: glTeam.id } },
    })
    // Also mirror into player_transactions — this is what powers the
    // player page's Transfer History panel and the team page's
    // Transactions tab, both of which only ever read this table and never
    // showed a G-League move at all before this, since it only ever wrote
    // to the legacy feed above.
    await admin.from('player_transactions').insert({
      player_id: playerId, type: 'gleague_assign',
      from_team_id: teamId, to_team_id: glTeam.id,
      season: '2025-26', week_number: week,
    })
  } catch (legacyErr) { console.warn('Failed to record G-League assignment transaction', legacyErr) }

  const referer = req.headers.get('referer') || '/'
  return NextResponse.redirect(new URL(referer, req.url))
}

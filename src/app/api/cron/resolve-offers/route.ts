import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { data: offers } = await admin
    .from('fa_offers')
    .select('player_id, team_id, players(name, team_id, on_gleague_assignment)')
    .order('created_at')

  if (!offers || offers.length === 0) return NextResponse.json({ resolved: 0 })

  const byPlayer: Record<number, any[]> = {}
  for (const o of offers) {
    const p = o.player_id
    if (!byPlayer[p]) byPlayer[p] = []
    byPlayer[p].push(o)
  }

  let resolved = 0

  for (const [playerIdStr, playerOffers] of Object.entries(byPlayer)) {
    const playerId = Number(playerIdStr)
    const player = (playerOffers[0] as any).players
    if (player.team_id) { await admin.from('fa_offers').delete().eq('player_id', playerId); continue }

    const chosen = playerOffers[Math.floor(Math.random() * playerOffers.length)]
    const teamId = chosen.team_id

    await admin.from('players').update({
      team_id: teamId, salary: 650000, gleague_team_id: null, on_gleague_assignment: false
    }).eq('id', playerId)

    await admin.from('contracts').insert({
      player_id: playerId, player_name: player.name,
      season: '2025-26', salary: 650000, type: 'one-year', notes: 'FA signing - 1yr $650k'
    })

    await admin.from('fa_offers').delete().eq('player_id', playerId)
    resolved++
  }

  return NextResponse.json({ resolved })
}

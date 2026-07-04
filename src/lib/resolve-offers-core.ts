import { createClient } from '@supabase/supabase-js'
import { getTeamLang, notifFAWon, notifFALost, notifDeadCapCleared } from './notifications-helpers'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const CAP_LIMIT = 180_000_000
const MAX_ROSTER = 15

// The flat $650K/1yr FA pickup pool (active every week except Free Agency
// week and the roster-freeze window before the play-in). Extracted from
// the old /api/cron/resolve-offers route so it can be called directly from
// the consolidated daily cron without an extra HTTP round-trip — Vercel's
// Hobby plan only allows 2 cron jobs total, so every recurring "resolve X"
// concern now gets called from one shared entry point instead of its own
// schedule.
export async function resolveOffers() {
  const { data: offers } = await admin
    .from('fa_offers')
    .select('player_id, team_id, players(name, team_id, on_gleague_assignment, salary, previous_team_id, dead_cap_amount)')
    .order('created_at')
  if (!offers || offers.length === 0) return { resolved: 0 }

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

    // Already on a team — stale offer, discard
    if (player.team_id) {
      await admin.from('fa_offers').delete().eq('player_id', playerId)
      continue
    }

    const oldTeamId: string | null = (player as any).previous_team_id || null
    const deadCapAmount: number = (player as any).dead_cap_amount || 0

    // Filter out offers from teams that don't have cap room or roster space
    const validOffers: any[] = []
    for (const offer of playerOffers) {
      const { data: team } = await admin.from('teams').select('cap_used').eq('id', offer.team_id).single()
      const { count: rosterCount } = await admin
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', offer.team_id)
        .eq('status', 'active')

      const newCapUsed = (team?.cap_used || 0) + 650_000
      const rosterOk = (rosterCount ?? 0) < MAX_ROSTER
      const capOk = newCapUsed <= CAP_LIMIT

      if (rosterOk && capOk) validOffers.push(offer)
    }

    if (validOffers.length === 0) {
      // No valid offers — all teams were over cap or roster full
      await admin.from('fa_offers').delete().eq('player_id', playerId)
      continue
    }

    const chosen = validOffers[Math.floor(Math.random() * validOffers.length)]
    const teamId = chosen.team_id

    await admin.from('players').update({
      team_id: teamId, salary: 650000, contract_years: 1,
      gleague_team_id: null, on_gleague_assignment: false,
      previous_team_id: null, dead_cap_amount: 0,
    }).eq('id', playerId)

    await admin.from('contracts').insert({
      player_id: playerId, player_name: player.name,
      season: '2025-26', salary: 650000, type: 'one-year', notes: 'FA signing - 1yr $650k'
    })

    // Update new team's cap_used
    const { data: newTeam } = await admin.from('teams').select('cap_used').eq('id', teamId).single()
    await admin.from('teams').update({
      cap_used: (newTeam?.cap_used || 0) + 650_000,
    }).eq('id', teamId)

    // Release dead cap from the team that originally cut this player
    if (oldTeamId && deadCapAmount > 0) {
      const { data: oldTeam } = await admin.from('teams').select('cap_used').eq('id', oldTeamId).single()
      if (oldTeam) {
        await admin.from('teams').update({
          cap_used: Math.max(0, (oldTeam.cap_used || 0) - deadCapAmount),
        }).eq('id', oldTeamId)
        const oldLang = await getTeamLang(oldTeamId)
        const deadNotif = notifDeadCapCleared(oldLang, player.name, deadCapAmount)
        await admin.from('inbox_messages').insert({
          to_team_id: oldTeamId, type: 'contract',
          subject: deadNotif.subject, body: deadNotif.body,
          read: false, metadata: { player_id: playerId, cap_freed: deadCapAmount },
        })
      }
    }

    // Notify new team
    const winnerLang = await getTeamLang(teamId)
    const wonNotif = notifFAWon(winnerLang, player.name)
    await admin.from('inbox_messages').insert({
      to_team_id: teamId, type: 'fa',
      subject: wonNotif.subject, body: wonNotif.body,
      read: false, metadata: { player_id: playerId },
    })

    // Notify losing teams (valid offers that weren't chosen)
    const losingTeamIds = validOffers.map((o: any) => o.team_id).filter((id: string) => id !== teamId)
    for (const losingTeamId of losingTeamIds) {
      const loserLang = await getTeamLang(losingTeamId)
      const lostNotif = notifFALost(loserLang, player.name)
      await admin.from('inbox_messages').insert({
        to_team_id: losingTeamId, type: 'fa',
        subject: lostNotif.subject, body: lostNotif.body,
        read: false, metadata: { player_id: playerId, winning_team_id: teamId },
      })
    }

    await admin.from('fa_offers').delete().eq('player_id', playerId)
    resolved++
  }

  return { resolved }
}

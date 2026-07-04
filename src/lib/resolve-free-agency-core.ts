import { createClient } from '@supabase/supabase-js'
import { getStatusForWeek } from './season-week-helper'
import { getTeamLang, notifFAMarketWon, notifFAMarketLost } from './notifications-helpers'
import { salaryScore, ambitionScore, popularityScore, staffQualityScore, weightedOfferScore, decisionDays } from './fa-market-scoring'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const CAP_LIMIT = 180_000_000
const MAX_ROSTER = 15
const DAY_MS = 24 * 60 * 60 * 1000

// Resolves the real, GM-negotiated contract offers made during Free Agency
// week (season week 1) — distinct from resolve-offers-core.ts, which
// handles the flat $650K/1yr pickup pool used the rest of the year.
// Each free agent picks the highest-SCORING offer (not a random pick —
// see src/lib/fa-market-scoring.ts) once their personal 1-or-2-day decision
// window has passed. `force=true` bypasses that wait (used by the admin
// manual-trigger button so Bruno can test without waiting real days).
// Extracted from the old /api/cron/resolve-free-agency route so it can be
// called directly from the consolidated daily cron (Vercel Hobby caps
// recurring cron jobs at 2 total).
export async function resolveFreeAgencyMarket(force: boolean) {
  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  const nextWeek = (cfg?.current_week || 0) + 1
  const phase = getStatusForWeek(nextWeek)
  // Once Free Agency week has ended, flush every remaining pending group
  // immediately with whatever offers exist, so nobody is stuck forever.
  const forceResolveAll = force || phase !== 'free-agency'

  const { data: offers } = await admin
    .from('fa_market_offers')
    .select('*, players(name,team_id,real_ovr,ambition,previous_team_id,dead_cap_amount)')
    .eq('status', 'pending')
    .order('created_at')
  if (!offers || offers.length === 0) return { resolved: 0 }

  const byPlayer: Record<string, any[]> = {}
  for (const o of offers) {
    if (!byPlayer[o.player_id]) byPlayer[o.player_id] = []
    byPlayer[o.player_id].push(o)
  }

  // Batch-fetch every team/coach/roster involved once, instead of per-offer.
  const allTeamIds = Array.from(new Set(offers.map((o: any) => o.team_id)))
  const [{ data: teamsData }, { data: coachesData }, { data: rosterData }] = await Promise.all([
    admin.from('teams').select('id,cap_used,elo,popularity').in('id', allTeamIds),
    admin.from('coaches').select('team_id,role,off_adjustment,def_adjustment,off_development,def_development,tactical_dev').in('team_id', allTeamIds),
    admin.from('players').select('id,team_id,real_ovr').in('team_id', allTeamIds).eq('status', 'active'),
  ])
  const teamMap: Record<string, any> = {}
  ;(teamsData || []).forEach((t: any) => { teamMap[t.id] = t })
  const coachesByTeam: Record<string, any[]> = {}
  ;(coachesData || []).forEach((c: any) => { if (!coachesByTeam[c.team_id]) coachesByTeam[c.team_id] = []; coachesByTeam[c.team_id].push(c) })
  const rosterCountByTeam: Record<string, number> = {}
  const rosterOvrsByTeam: Record<string, number[]> = {}
  ;(rosterData || []).forEach((p: any) => {
    rosterCountByTeam[p.team_id] = (rosterCountByTeam[p.team_id] || 0) + 1
    if (!rosterOvrsByTeam[p.team_id]) rosterOvrsByTeam[p.team_id] = []
    if (p.real_ovr) rosterOvrsByTeam[p.team_id].push(p.real_ovr)
  })

  let resolved = 0

  for (const [playerIdStr, playerOffers] of Object.entries(byPlayer)) {
    const playerId = Number(playerIdStr)
    const player = (playerOffers[0] as any).players

    if (!player || player.team_id) {
      // Player object missing, or already on a team by the time this runs — stale.
      await admin.from('fa_market_offers').update({ status: 'expired' }).eq('player_id', playerId).eq('status', 'pending')
      continue
    }

    const validOffers = playerOffers.filter((o: any) => {
      const team = teamMap[o.team_id]
      if (!team) return false
      const newCap = (team.cap_used || 0) + o.salary
      const rosterOk = (rosterCountByTeam[o.team_id] || 0) < MAX_ROSTER
      return newCap <= CAP_LIMIT && rosterOk
    })

    const scored = validOffers.map((o: any) => {
      const team = teamMap[o.team_id]
      const rosterOvrs = rosterOvrsByTeam[o.team_id] || []
      const coaches = coachesByTeam[o.team_id] || []
      const hc = coaches.find((c: any) => c.role === 'head_coach') || null
      const ac = coaches.find((c: any) => c.role === 'assistant_coach') || null
      const maxSalary = Math.max(...validOffers.map((v: any) => v.salary))
      const s = salaryScore(o.salary, maxSalary)
      const amb = ambitionScore(player.ambition, player.real_ovr, rosterOvrs, team.elo || 1500)
      const pop = popularityScore(team.popularity)
      const staff = staffQualityScore(hc, ac, rosterOvrs)
      const total = weightedOfferScore({ salaryScore: s, ambitionScore: amb, popularityScore: pop, staffQualityScore: staff })
      return { ...o, score: total }
    }).sort((a: any, b: any) => b.score - a.score)

    // Persist scores for transparency even if not resolving yet this round.
    for (const o of scored) {
      await admin.from('fa_market_offers').update({ score: o.score }).eq('id', o.id)
    }

    if (scored.length === 0) {
      if (forceResolveAll) {
        await admin.from('fa_market_offers').update({ status: 'expired' }).eq('player_id', playerId).eq('status', 'pending')
      }
      // else: no valid bidder yet, but might become valid before the deadline — leave pending.
      continue
    }

    const firstOfferAt = Math.min(...validOffers.map((o: any) => new Date(o.created_at).getTime()))
    const days = decisionDays(scored.map((o: any) => o.score))
    const deadline = firstOfferAt + days * DAY_MS

    if (!forceResolveAll && Date.now() < deadline) continue // not yet time to decide

    const winner = scored[0]
    const losers = scored.slice(1)
    const invalidOfferIds = playerOffers.filter((o: any) => !validOffers.includes(o)).map((o: any) => o.id)

    await admin.from('players').update({
      team_id: winner.team_id, salary: winner.salary, contract_years: winner.years,
      gleague_team_id: null, on_gleague_assignment: false,
      previous_team_id: null, dead_cap_amount: 0,
    }).eq('id', playerId)

    await admin.from('contracts').insert({
      player_id: playerId, player_name: player.name, season: '2025-26',
      salary: winner.salary, type: winner.years === 1 ? 'one-year' : 'multi-year',
      notes: `FA Week signing - ${winner.years}yr $${winner.salary}`,
    })

    const winTeam = teamMap[winner.team_id]
    await admin.from('teams').update({ cap_used: (winTeam?.cap_used || 0) + winner.salary }).eq('id', winner.team_id)

    // Release dead cap from the player's old team, same as the flat-rate resolver.
    const oldTeamId = player.previous_team_id
    const deadCapAmount = player.dead_cap_amount || 0
    if (oldTeamId && deadCapAmount > 0) {
      const { data: oldTeam } = await admin.from('teams').select('cap_used').eq('id', oldTeamId).single()
      if (oldTeam) {
        await admin.from('teams').update({ cap_used: Math.max(0, (oldTeam.cap_used || 0) - deadCapAmount) }).eq('id', oldTeamId)
      }
    }

    const winnerLang = await getTeamLang(winner.team_id)
    const wonNotif = notifFAMarketWon(winnerLang, player.name, winner.salary, winner.years)
    await admin.from('inbox_messages').insert({
      to_team_id: winner.team_id, type: 'fa', subject: wonNotif.subject, body: wonNotif.body,
      read: false, metadata: { player_id: playerId, salary: winner.salary, years: winner.years },
    })

    for (const loser of losers) {
      const loserLang = await getTeamLang(loser.team_id)
      const lostNotif = notifFAMarketLost(loserLang, player.name)
      await admin.from('inbox_messages').insert({
        to_team_id: loser.team_id, type: 'fa', subject: lostNotif.subject, body: lostNotif.body,
        read: false, metadata: { player_id: playerId, winning_team_id: winner.team_id },
      })
    }

    const now = new Date().toISOString()
    await admin.from('fa_market_offers').update({ status: 'won', score: winner.score, resolved_at: now }).eq('id', winner.id)
    for (const loser of losers) {
      await admin.from('fa_market_offers').update({ status: 'lost', score: loser.score, resolved_at: now }).eq('id', loser.id)
    }
    if (invalidOfferIds.length > 0) {
      await admin.from('fa_market_offers').update({ status: 'expired', resolved_at: now }).in('id', invalidOfferIds)
    }

    resolved++
  }

  return { resolved }
}

import { createClient } from '@supabase/supabase-js'
import { getTeamLang, notifStaffOfferWon, notifStaffOfferLost } from './notifications-helpers'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function weightedPick<T>(items: { item: T, weight: number }[]): T {
  const total = items.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const x of items) { r -= x.weight; if (r <= 0) return x.item }
  return items[items.length - 1].item
}

// Coaches weigh offers by salary, the hiring team's on-court record (a proxy
// for "prestige"/"roster quality"), and whether the role offered matches
// their natural role (a mismatch is the same 30%-effectiveness-penalty
// situation shown on the offer screen — coaches are less keen to take a
// job that plays against their strengths).
function scoreOffer(offer: any, team: any, naturalRole: string) {
  const salaryScore = (offer.salary || 0) / 1_000_000
  const games = (team?.wins || 0) + (team?.losses || 0)
  const winPct = games > 0 ? (team.wins || 0) / games : 0.5
  const roleMatch = offer.role === naturalRole
  const weight = salaryScore * 3 + winPct * 40 + (roleMatch ? 20 : -10)
  return Math.max(1, weight)
}

// Extracted from the old /api/cron/resolve-staff-offers route so it can be
// called directly from the consolidated daily cron (see resolve-offers-core.ts
// for why — Vercel's Hobby plan caps recurring cron jobs at 2 total).
export async function resolveStaffOffers() {
  const { data: offers } = await admin
    .from('staff_offers')
    .select('*, coaches(name,team_id,natural_role)')
    .eq('status', 'pending')
    .order('created_at')
  if (!offers || offers.length === 0) return { resolved: 0 }

  const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
  const currentWeek = (cfg?.current_week || 0) + 1

  const byCoach: Record<string, any[]> = {}
  for (const o of offers) {
    if (!byCoach[o.coach_id]) byCoach[o.coach_id] = []
    byCoach[o.coach_id].push(o)
  }

  let resolved = 0

  for (const [coachId, coachOffers] of Object.entries(byCoach)) {
    const coach = (coachOffers[0] as any).coaches
    if (!coach) { await admin.from('staff_offers').delete().eq('coach_id', coachId); continue }

    // Already employed elsewhere by the time this resolves — stale offers, discard.
    if (coach.team_id) {
      await admin.from('staff_offers').delete().eq('coach_id', coachId)
      continue
    }

    const teamIds = coachOffers.map((o: any) => o.team_id)
    const { data: teamsData } = await admin.from('teams').select('id,name,wins,losses').in('id', teamIds)
    const teamMap: Record<string, any> = {}
    ;(teamsData || []).forEach((t: any) => { teamMap[t.id] = t })

    const weighted = coachOffers.map((o: any) => ({
      item: o,
      weight: scoreOffer(o, teamMap[o.team_id], coach.natural_role),
    }))
    const chosen = weightedPick(weighted)
    const teamId = chosen.team_id

    await admin.from('coaches').update({
      team_id: teamId, role: chosen.role, salary: chosen.salary, contract_years: chosen.years,
    }).eq('id', coachId)

    await admin.from('transactions').insert({
      type: 'signing', category: 'staff',
      description: `${coach.name} hired as ${chosen.role.replace('_', ' ')} by ${teamMap[teamId]?.name || teamId}`,
      teams: [teamId], players: [], status: 'completed', week_number: currentWeek,
    })

    const winnerLang = await getTeamLang(teamId)
    const wonNotif = notifStaffOfferWon(winnerLang, coach.name, chosen.role, chosen.salary, chosen.years)
    await admin.from('inbox_messages').insert({
      to_team_id: teamId, type: 'staff',
      subject: wonNotif.subject, body: wonNotif.body,
      read: false, metadata: { coach_id: coachId, role: chosen.role, salary: chosen.salary, years: chosen.years },
    })

    const losingTeamIds = coachOffers.map((o: any) => o.team_id).filter((id: string) => id !== teamId)
    for (const losingTeamId of losingTeamIds) {
      const loserLang = await getTeamLang(losingTeamId)
      const lostNotif = notifStaffOfferLost(loserLang, coach.name)
      await admin.from('inbox_messages').insert({
        to_team_id: losingTeamId, type: 'staff',
        subject: lostNotif.subject, body: lostNotif.body,
        read: false, metadata: { coach_id: coachId, winning_team_id: teamId },
      })
    }

    await admin.from('staff_offers').delete().eq('coach_id', coachId)
    resolved++
  }

  return { resolved }
}

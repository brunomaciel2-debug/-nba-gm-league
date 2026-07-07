import { createClient } from '@supabase/supabase-js'
import { getTeamLang, notifDraftPickResult, notifDraftConfirmExpired, notifRookieOptionAutoDeclined } from './notifications-helpers'
import { NEXT_DRAFT, rookieYear1Salary } from './draft-constants'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Every attribute column shared between `prospects` and `players` — copied
// verbatim when a prospect becomes a real player. Anything NOT in this list
// (team_id, salary, contract_years, status, health, moral, etc.) gets a
// fresh team-assignment value instead, set separately below.
const SHARED_ATTRS = [
  'three','layup','dunk','mid','ft','siq','draw_foul','blk','stl','idef','pdef',
  'def_reb','off_reb','stamina','durability','ball_hdl','pass_vis','pass_iq',
  'assist_role','pressure','consistency','crowd_effect','streaky','agility',
  'speed','strength','close_shot','standing_dunk','trash_talk','usage',
  'pot_three','pot_layup','pot_dunk','pot_mid','pot_ft','pot_siq','pot_draw_foul',
  'pot_blk','pot_stl','pot_idef','pot_pdef','pot_def_reb','pot_off_reb',
  'pot_stamina','pot_durability','pot_ball_hdl','pot_pass_vis','pot_pass_iq',
  'pot_assist_role','pot_pressure','pot_consistency','pot_speed','pot_agility',
  'pot_strength','pot_close_shot','pot_standing_dunk','potential_grade','dev_rate',
]

// Resolves one round of the real draft: sorts that round's picks worst-record-first
// (the exact same sort already shown in DraftSection.tsx's Mock Draft tab, so the
// real order never surprises anyone), walks each team's single combined priority
// list (draft_orders), falls back to a random pick if a team never submitted or
// their list runs out, and converts the chosen prospect into a real player row.
export async function resolveDraftRound(round: 1 | 2, force: boolean): Promise<{ resolved: number, alreadyDone?: boolean }> {
  const { data: picks } = await admin
    .from('draft_picks')
    .select('id,team_id,original_team_id,status')
    .eq('season', NEXT_DRAFT).eq('round', round)

  const ownedPicks = (picks || []).filter((p: any) => p.status === 'owned')
  const usedCount = (picks || []).filter((p: any) => p.status === 'used').length

  if (ownedPicks.length === 0) {
    // Nothing left to resolve — either already fully done, or no picks exist for this round/season.
    return { resolved: 0, alreadyDone: usedCount > 0 }
  }

  if (!force) {
    const { data: cfg } = await admin.from('season_config').select('current_week').eq('id', 1).single()
    const nextWeek = (cfg?.current_week || 0) + 1
    const requiredWeek = round === 1 ? 51 : 52
    if (nextWeek !== requiredWeek) return { resolved: 0 }
  }

  const { data: teamsData } = await admin.from('teams').select('id,wins,losses')
  const teamMap: Record<string, any> = {}
  ;(teamsData || []).forEach((t: any) => { teamMap[t.id] = t })

  // Round 1 order comes from the real Draft Lottery (src/lib/draft-lottery.ts)
  // when it has run — only the top 4 picks are actually shuffled by the
  // weighted draw, so most of the order still tracks the standings closely.
  // Falls back to plain worst-record-first (identical to the Mock Draft
  // preview) if the lottery hasn't resolved yet, so this never regresses.
  let pickNumberByTeam: Record<string, number> | null = null
  if (round === 1) {
    const { data: lotteryRows } = await admin.from('draft_lottery_results').select('team_id,resulting_pick').eq('season', NEXT_DRAFT)
    if (lotteryRows?.length) {
      pickNumberByTeam = {}
      lotteryRows.forEach((r: any) => { pickNumberByTeam![r.team_id] = r.resulting_pick })
    }
  }

  const sortedPicks = [...ownedPicks].sort((a: any, b: any) => {
    if (pickNumberByTeam) {
      const pa = pickNumberByTeam[a.original_team_id], pb = pickNumberByTeam[b.original_team_id]
      // Lottery only covers the 14 non-playoff teams — playoff teams (picks
      // 15-30) have no lottery row, so they fall back to worst-record-first
      // among themselves, same as before.
      if (pa != null || pb != null) return (pa ?? 999) - (pb ?? 999)
    }
    const ta = teamMap[a.original_team_id], tb = teamMap[b.original_team_id]
    return ((ta?.wins ?? 0) - (tb?.wins ?? 0)) || ((tb?.losses ?? 0) - (ta?.losses ?? 0))
  })

  const { data: orders } = await admin.from('draft_orders').select('team_id,preferences').eq('season', NEXT_DRAFT).eq('round', round)
  const ordersByTeam: Record<string, number[]> = {}
  ;(orders || []).forEach((o: any) => { ordersByTeam[o.team_id] = o.preferences?.ranked_prospect_ids || [] })
  const cursorByTeam: Record<string, number> = {}

  const { data: prospectsData } = await admin.from('prospects').select('*').eq('season', NEXT_DRAFT).eq('drafted', false)
  const availableIds = new Set((prospectsData || []).map((p: any) => p.id))
  const prospectMap: Record<string, any> = {}
  ;(prospectsData || []).forEach((p: any) => { prospectMap[p.id] = p })

  let pickNumber = round === 1 ? 1 : 31
  let resolved = 0

  for (const pick of sortedPicks) {
    const list = ordersByTeam[pick.team_id] || []
    let cursor = cursorByTeam[pick.team_id] ?? 0
    let chosenId: string | null = null

    while (cursor < list.length) {
      const candidate = String(list[cursor])
      cursor++
      if (availableIds.has(candidate)) { chosenId = candidate; break }
    }
    cursorByTeam[pick.team_id] = cursor

    if (!chosenId) {
      const pool = Array.from(availableIds)
      if (pool.length === 0) { pickNumber++; continue }
      chosenId = pool[Math.floor(Math.random() * pool.length)]
    }

    availableIds.delete(chosenId)
    const prospect = prospectMap[chosenId as string]

    await admin.from('draft_results').insert({
      season: NEXT_DRAFT, pick_number: pickNumber, round, team_id: pick.team_id, prospect_id: chosenId,
    })

    const newPlayer: Record<string, any> = {
      name: prospect.name, pos: prospect.pos, age: prospect.age, nationality: prospect.nationality,
      college: prospect.college, photo_url: prospect.photo_url, real_ovr: prospect.overall,
      team_id: pick.team_id, status: 'draft_pending',
      salary: rookieYear1Salary(round, pickNumber), contract_years: 2,
      is_rookie_contract: true, rookie_draft_season: NEXT_DRAFT, rookie_draft_round: round, rookie_draft_pick: pickNumber,
      rookie_years_elapsed: 0, rookie_option_status: null,
      draft_confirm_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      health: 100, moral: 80, games_missed: 0, nba_experience: 0,
      on_gleague_assignment: false, ambition: 50, greediness: 50, loyalty: 50,
    }
    for (const attr of SHARED_ATTRS) if (prospect[attr] != null) newPlayer[attr] = prospect[attr]

    const { data: insertedPlayer } = await admin.from('players').insert(newPlayer).select('id').single()

    await admin.from('prospects').update({
      drafted: true, drafted_by_team_id: pick.team_id, resulting_player_id: insertedPlayer?.id,
    }).eq('id', chosenId)

    await admin.from('draft_picks').update({ status: 'used' }).eq('id', pick.id)

    const lang = await getTeamLang(pick.team_id)
    const notif = notifDraftPickResult(lang, prospect.name, pickNumber, round, rookieYear1Salary(round, pickNumber))
    await admin.from('inbox_messages').insert({
      to_team_id: pick.team_id, type: 'draft', subject: notif.subject, body: notif.body,
      read: false, metadata: { player_id: insertedPlayer?.id, prospect_id: chosenId, pick_number: pickNumber },
    })

    pickNumber++
    resolved++
  }

  return { resolved }
}

// Anyone who let their 7-day post-draft confirmation window lapse without
// deciding becomes a normal free agent — same fate as explicitly declining.
export async function sweepExpiredDraftConfirmations(): Promise<{ expired: number }> {
  const { data: pending } = await admin
    .from('players').select('id,name,team_id,draft_confirm_deadline')
    .eq('status', 'draft_pending').not('draft_confirm_deadline', 'is', null)
  const nowMs = Date.now()
  let expired = 0
  for (const p of (pending || [])) {
    if (new Date(p.draft_confirm_deadline).getTime() > nowMs) continue
    const oldTeamId = p.team_id
    await admin.from('players').update({
      team_id: null, status: 'active', draft_confirm_deadline: null,
      is_rookie_contract: false, rookie_option_status: null, rookie_option_deadline: null,
    }).eq('id', p.id)
    const lang = await getTeamLang(oldTeamId)
    const notif = notifDraftConfirmExpired(lang, p.name)
    await admin.from('inbox_messages').insert({
      to_team_id: oldTeamId, type: 'draft', subject: notif.subject, body: notif.body,
      read: false, metadata: { player_id: p.id },
    })
    expired++
  }
  return { expired }
}

// Anyone who let a pending Team Option's deadline lapse without exercising
// it is auto-declined — same fate as an explicit decline (becomes a free agent).
export async function sweepExpiredRookieOptions(): Promise<{ expired: number }> {
  const { data: pending } = await admin
    .from('players').select('id,name,team_id,rookie_option_status,rookie_option_deadline,salary')
    .not('rookie_option_status', 'is', null).like('rookie_option_status', 'pending_%')
    .not('rookie_option_deadline', 'is', null)
  const nowMs = Date.now()
  let expired = 0
  for (const p of (pending || [])) {
    if (new Date(p.rookie_option_deadline).getTime() > nowMs) continue
    const oldTeamId = p.team_id
    const { data: team } = await admin.from('teams').select('cap_used').eq('id', oldTeamId).single()
    if (team) await admin.from('teams').update({ cap_used: Math.max(0, (team.cap_used || 0) - (p.salary || 0)) }).eq('id', oldTeamId)
    await admin.from('players').update({
      team_id: null, status: 'active', rookie_option_status: null, rookie_option_deadline: null,
      is_rookie_contract: false,
    }).eq('id', p.id)
    const lang = await getTeamLang(oldTeamId)
    const notif = notifRookieOptionAutoDeclined(lang, p.name)
    await admin.from('inbox_messages').insert({
      to_team_id: oldTeamId, type: 'draft', subject: notif.subject, body: notif.body,
      read: false, metadata: { player_id: p.id },
    })
    expired++
  }
  return { expired }
}

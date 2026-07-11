import { supabaseAdmin } from '@/lib/supabase'
import { simulateGame } from '@/lib/game-simulator'
import { getTeamLang } from '@/lib/notifications-helpers'
import { notify } from '@/lib/notifications'
import { notifSummerLeagueRosters } from '@/lib/notifications-helpers'

const NON_REAL_TEAMS = ['ALL', 'RVS', 'ROO', 'SOP']
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']
const ROSTER_SIZE = 9

// The 11-day window Bruno described (Jul 10-20) — used only to label games
// with a display date, spread evenly across the 7 rounds. Actual resolution
// happens instantly, one stage per call to resolveSummerLeague().
const TOURNAMENT_START = new Date('2025-07-10T00:00:00')
const ROUND_DAY_OFFSET: Record<string, number> = {
  prelim1: 0, prelim2: 2, prelim3: 4, prelim4: 6, consolation: 7, semifinal: 8, final: 10,
}

function dateForRound(roundLabel: string): string {
  const d = new Date(TOURNAMENT_START)
  d.setDate(d.getDate() + (ROUND_DAY_OFFSET[roundLabel] ?? 0))
  return d.toISOString().slice(0, 10)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function getCurrentSeason(): Promise<string> {
  const { data } = await supabaseAdmin.from('season_config').select('season').eq('id', 1).single()
  return data?.season || '2025-26'
}

// The rookie draft class isn't tracked by the league-season string
// ('2025-26') — it's a bare draft-class year on players.rookie_draft_season
// (see draft-resolver.ts's NEXT_DRAFT constant). Derive "current" and
// "previous" draft classes from whatever's actually in the data rather than
// trusting a manually-bumped constant, so this works correctly regardless
// of exactly when that constant gets bumped after a draft resolves.
async function getRookieAndSophomoreClasses(): Promise<{ rookieClass: string | null, sophomoreClass: string | null }> {
  const { data } = await supabaseAdmin.from('players').select('rookie_draft_season').eq('is_rookie_contract', true).not('rookie_draft_season', 'is', null)
  const classes = (Array.from(new Set((data || []).map((p: any) => p.rookie_draft_season as string))) as string[]).sort((a, b) => Number(b) - Number(a))
  return { rookieClass: classes[0] || null, sophomoreClass: classes[1] || null }
}

// Builds the gm_orders-shaped object game-simulator.ts already knows how to
// read (depth_chart + priorities + clutch + pace/style) — same mechanism
// used for GM-less teams in admin/auto-orders/route.ts — except the
// per-position pool is sorted Rookies-first, Sophomores-second, fillers
// last, instead of by raw usage. That's how "no tactical control, but
// Rookies/Sophomores must play heavy minutes" gets enforced for free: the
// simulator doesn't need to change at all.
function buildSummerOrders(roster: { player: any, role: string }[]) {
  const roleRank: Record<string, number> = { rookie: 0, sophomore: 1, filler: 2 }
  const byPos: Record<string, { player: any, role: string }[]> = { PG: [], SG: [], SF: [], PF: [], C: [] }
  for (const entry of roster) {
    const pos = (entry.player.pos || '').toUpperCase()
    if (byPos[pos]) byPos[pos].push(entry)
    else if (['PG', 'SG'].includes(pos)) { byPos.PG.push(entry); byPos.SG.push(entry) }
    else if (['SF', 'PF'].includes(pos)) { byPos.SF.push(entry); byPos.PF.push(entry) }
    else byPos.SF.push(entry)
  }

  const depth_chart: Record<string, any> = {}
  const usedMins: Record<number, number> = {}
  for (const pos of POSITIONS) {
    const pool = [...(byPos[pos] || [])]
      .sort((a, b) => (roleRank[a.role] - roleRank[b.role]) || ((b.player.usage || 0) - (a.player.usage || 0)))
      .filter(e => (usedMins[e.player.id] || 0) < 32)
    if (!pool.length) continue
    const starter = pool[0], sub1 = pool[1] || pool[0], sub2 = pool[2] || pool[0]
    depth_chart[pos] = {
      s: { name: starter.player.name, mins: 24 },
      b1: { name: sub1.player.name, mins: 16 },
      b2: { name: sub2.player.name, mins: 8 },
    }
    usedMins[starter.player.id] = (usedMins[starter.player.id] || 0) + 24
    usedMins[sub1.player.id] = (usedMins[sub1.player.id] || 0) + 16
    usedMins[sub2.player.id] = (usedMins[sub2.player.id] || 0) + 8
  }

  // A roster with zero natural players at some position used to just leave
  // that slot out of the depth chart entirely — only 4 of 5 starter slots
  // got built, so that position's minutes vanished instead of being played
  // by anyone. Now the least-used remaining player fills the gap instead;
  // the existing out-of-position penalty in game-simulator.ts's
  // applyDC/pS/simP already makes that a real disadvantage.
  for (const pos of POSITIONS) {
    if (depth_chart[pos]) continue
    const pool = roster.filter(e => (usedMins[e.player.id] || 0) < 32)
      .sort((a, b) => (roleRank[a.role] - roleRank[b.role]) || ((usedMins[a.player.id] || 0) - (usedMins[b.player.id] || 0)))
    if (!pool.length) continue
    const starter = pool[0], sub1 = pool[1] || pool[0], sub2 = pool[2] || pool[0]
    depth_chart[pos] = {
      s: { name: starter.player.name, mins: 24 },
      b1: { name: sub1.player.name, mins: 16 },
      b2: { name: sub2.player.name, mins: 8 },
    }
    usedMins[starter.player.id] = (usedMins[starter.player.id] || 0) + 24
    usedMins[sub1.player.id] = (usedMins[sub1.player.id] || 0) + 16
    usedMins[sub2.player.id] = (usedMins[sub2.player.id] || 0) + 8
  }

  const priorityOrder = [...roster].sort((a, b) => (roleRank[a.role] - roleRank[b.role]) || ((b.player.usage || 0) - (a.player.usage || 0)))
  const top3 = priorityOrder.slice(0, 3)

  return {
    depth_chart,
    priority_1: top3[0]?.player.name || null,
    priority_2: top3[1]?.player.name || null,
    priority_3: top3[2]?.player.name || null,
    clutch_player: top3[0]?.player.name || null,
    pace: 74,
    three_rate: 38,
    atk_style: 'motion',
    def_style: 'man',
  }
}

// ── Stage 1: roster generation ──────────────────────────────────────────
async function generateRosters(season: string) {
  const { data: teams } = await supabaseAdmin.from('teams').select('id,name').not('id', 'in', `(${NON_REAL_TEAMS.join(',')})`)
  if (!teams || teams.length === 0) return { created: 0 }

  const { rookieClass, sophomoreClass } = await getRookieAndSophomoreClasses()

  const usedFillerIds = new Set<number>()
  let created = 0

  for (const team of teams) {
    const { data: rookies } = rookieClass
      ? await supabaseAdmin.from('players').select('*').eq('team_id', team.id).eq('rookie_draft_season', rookieClass)
      : { data: [] as any[] }
    const { data: sophomores } = sophomoreClass
      ? await supabaseAdmin.from('players').select('*').eq('team_id', team.id).eq('rookie_draft_season', sophomoreClass)
      : { data: [] as any[] }

    let squad: { player: any, role: string }[] = [
      ...(rookies || []).sort((a: any, b: any) => (a.rookie_draft_pick || 999) - (b.rookie_draft_pick || 999)).map((p: any) => ({ player: p, role: 'rookie' })),
      ...(sophomores || []).map((p: any) => ({ player: p, role: 'sophomore' })),
    ]
    if (squad.length > ROSTER_SIZE) squad = squad.slice(0, ROSTER_SIZE)

    if (squad.length < ROSTER_SIZE) {
      const coveredPositions = new Set(squad.map(e => (e.player.pos || '').toUpperCase()))
      const missingPositions = POSITIONS.filter(p => !coveredPositions.has(p))

      for (const ageCap of [26, 28, 100]) {
        if (squad.length >= ROSTER_SIZE) break
        const { data: pool } = await supabaseAdmin.from('players').select('*')
          .is('team_id', null).eq('status', 'active').lte('age', ageCap)
        const available: any[] = (pool || []).filter((p: any) => !usedFillerIds.has(p.id))
        if (!available.length) continue

        // Position-aware first pass: fill gaps the rookies/sophomores didn't cover.
        for (const pos of missingPositions) {
          if (squad.length >= ROSTER_SIZE) break
          const candidate = shuffle(available.filter((p: any) => (p.pos || '').toUpperCase() === pos && !usedFillerIds.has(p.id)))[0]
          if (candidate) { squad.push({ player: candidate, role: 'filler' }); usedFillerIds.add(candidate.id) }
        }
        // Then fill the rest semi-randomly regardless of position.
        const remaining = shuffle(available.filter((p: any) => !usedFillerIds.has(p.id)))
        for (const candidate of remaining) {
          if (squad.length >= ROSTER_SIZE) break
          squad.push({ player: candidate, role: 'filler' }); usedFillerIds.add(candidate.id)
        }
      }
    }

    if (!squad.length) continue

    await supabaseAdmin.from('summer_league_rosters').insert(
      squad.map(e => ({ season, team_id: team.id, player_id: e.player.id, role: e.role }))
    )
    created++

    const lang = await getTeamLang(team.id)
    const notif = notifSummerLeagueRosters(lang, team.name)
    await notify(team.id, 'summer_league', notif.subject, notif.body, {})
  }

  return { created }
}

async function loadTeamRoster(season: string, teamId: string): Promise<{ player: any, role: string }[]> {
  const { data: rows } = await supabaseAdmin.from('summer_league_rosters').select('player_id,role').eq('season', season).eq('team_id', teamId)
  if (!rows || !rows.length) return []
  const { data: players } = await supabaseAdmin.from('players').select('*').in('id', rows.map((r: any) => r.player_id))
  const byId: Record<number, any> = {}
  ;(players || []).forEach((p: any) => { byId[p.id] = p })
  return rows.map((r: any) => ({ player: byId[r.player_id], role: r.role })).filter((e: any) => e.player)
}

async function simulateAndStore(season: string, round: string, gameNumber: number | null, homeTeamId: string, awayTeamId: string) {
  const [homeRoster, awayRoster, { data: homeTeam }, { data: awayTeam }] = await Promise.all([
    loadTeamRoster(season, homeTeamId), loadTeamRoster(season, awayTeamId),
    supabaseAdmin.from('teams').select('id,name').eq('id', homeTeamId).single(),
    supabaseAdmin.from('teams').select('id,name').eq('id', awayTeamId).single(),
  ])
  if (!homeRoster.length || !awayRoster.length) return null

  const homeOrders = buildSummerOrders(homeRoster)
  const awayOrders = buildSummerOrders(awayRoster)
  const hp = homeRoster.map(e => ({ ...e.player }))
  const ap = awayRoster.map(e => ({ ...e.player }))

  const result = simulateGame(homeTeam || { id: homeTeamId, name: homeTeamId }, awayTeam || { id: awayTeamId, name: awayTeamId }, hp, ap, homeOrders, awayOrders)

  const roundDisplayKey = round === 'prelim' ? `prelim${gameNumber}` : round
  const { data: game } = await supabaseAdmin.from('summer_league_games').insert({
    season, round, game_number: gameNumber, home_team: homeTeamId, away_team: awayTeamId,
    home_score: result.homeScore, away_score: result.awayScore, status: 'final',
    scheduled_date: dateForRound(roundDisplayKey),
  }).select().single()
  if (!game) return null

  const boxRows = [
    ...result.homeBox.map((b: any) => ({ ...b, game_id: game.id, team_id: homeTeamId })),
    ...result.awayBox.map((b: any) => ({ ...b, game_id: game.id, team_id: awayTeamId })),
  ]
  if (boxRows.length) await supabaseAdmin.from('summer_league_box_scores').insert(boxRows)

  return game
}

// ── Standings (computed live, no stored table) ──────────────────────────
export async function getSummerLeagueStandings(season: string) {
  const { data: games } = await supabaseAdmin.from('summer_league_games').select('*').eq('season', season).eq('round', 'prelim')
  const { data: teams } = await supabaseAdmin.from('teams').select('id,name,color,logo_url').not('id', 'in', `(${NON_REAL_TEAMS.join(',')})`)

  const rec: Record<string, { wins: number, losses: number, pointDiff: number, h2h: Record<string, 'W' | 'L'> }> = {}
  ;(teams || []).forEach((t: any) => { rec[t.id] = { wins: 0, losses: 0, pointDiff: 0, h2h: {} } })

  for (const g of (games || [])) {
    if (g.home_score == null || g.away_score == null) continue
    const homeWon = g.home_score > g.away_score
    if (rec[g.home_team]) {
      rec[g.home_team].wins += homeWon ? 1 : 0
      rec[g.home_team].losses += homeWon ? 0 : 1
      rec[g.home_team].pointDiff += g.home_score - g.away_score
      rec[g.home_team].h2h[g.away_team] = homeWon ? 'W' : 'L'
    }
    if (rec[g.away_team]) {
      rec[g.away_team].wins += homeWon ? 0 : 1
      rec[g.away_team].losses += homeWon ? 1 : 0
      rec[g.away_team].pointDiff += g.away_score - g.home_score
      rec[g.away_team].h2h[g.home_team] = homeWon ? 'L' : 'W'
    }
  }

  const standings = (teams || []).map((t: any) => ({
    ...t, ...rec[t.id], winPct: (rec[t.id].wins + rec[t.id].losses) > 0 ? rec[t.id].wins / (rec[t.id].wins + rec[t.id].losses) : 0,
  }))

  standings.sort((a: any, b: any) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct
    const h2h = a.h2h[b.id]
    if (h2h) return h2h === 'W' ? -1 : 1
    return b.pointDiff - a.pointDiff
  })

  return standings
}

// ── The state machine — one stage per call, safe to call repeatedly ────
export async function resolveSummerLeague(): Promise<{ stage: string, detail?: any }> {
  const season = await getCurrentSeason()

  const { count: rosterCount } = await supabaseAdmin.from('summer_league_rosters').select('*', { count: 'exact', head: true }).eq('season', season)
  if (!rosterCount) {
    const result = await generateRosters(season)
    return { stage: 'rosters_generated', detail: result }
  }

  const { data: prelimGames } = await supabaseAdmin.from('summer_league_games').select('game_number').eq('season', season).eq('round', 'prelim')
  const roundsPlayed = new Set((prelimGames || []).map((g: any) => g.game_number))

  if (roundsPlayed.size < 4) {
    const nextRound = [1, 2, 3, 4].find(n => !roundsPlayed.has(n))!
    const { data: teams } = await supabaseAdmin.from('teams').select('id').not('id', 'in', `(${NON_REAL_TEAMS.join(',')})`)
    const teamIds: string[] = shuffle((teams || []).map((t: any) => t.id as string))
    const gamesPlayed: any[] = []
    for (let i = 0; i < teamIds.length; i += 2) {
      const home = teamIds[i], away = teamIds[i + 1]
      if (!home || !away) continue
      const g = await simulateAndStore(season, 'prelim', nextRound, home, away)
      if (g) gamesPlayed.push(g)
    }
    return { stage: `prelim_round_${nextRound}`, detail: { games: gamesPlayed.length } }
  }

  const { data: semis } = await supabaseAdmin.from('summer_league_games').select('id').eq('season', season).eq('round', 'semifinal')
  if (!semis || !semis.length) {
    const standings = await getSummerLeagueStandings(season)
    const top4 = standings.slice(0, 4)
    const rest = standings.slice(4)

    const semiGames: any[] = []
    if (top4.length === 4) {
      semiGames.push(await simulateAndStore(season, 'semifinal', 1, top4[0].id, top4[3].id))
      semiGames.push(await simulateAndStore(season, 'semifinal', 2, top4[1].id, top4[2].id))
    }

    const restIds: string[] = shuffle(rest.map((t: any) => t.id as string))
    let consolationCount = 0
    for (let i = 0; i < restIds.length; i += 2) {
      const home = restIds[i], away = restIds[i + 1]
      if (!home || !away) continue
      await simulateAndStore(season, 'consolation', null, home, away)
      consolationCount++
    }
    return { stage: 'semifinals_and_consolation', detail: { semifinals: semiGames.filter(Boolean).length, consolation: consolationCount } }
  }

  const { data: final } = await supabaseAdmin.from('summer_league_games').select('id').eq('season', season).eq('round', 'final')
  if (!final || !final.length) {
    const { data: semiGames } = await supabaseAdmin.from('summer_league_games').select('*').eq('season', season).eq('round', 'semifinal').order('game_number')
    const winners = (semiGames || []).map((g: any) => g.home_score > g.away_score ? g.home_team : g.away_team)
    if (winners.length === 2) {
      const g = await simulateAndStore(season, 'final', null, winners[0], winners[1])
      return { stage: 'final_played', detail: { winner: g && g.home_score > g.away_score ? g.home_team : g?.away_team } }
    }
    return { stage: 'waiting_on_semifinals' }
  }

  return { stage: 'complete' }
}

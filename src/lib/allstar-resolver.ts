import { supabaseAdmin } from '@/lib/supabase'
import { VOTING_CLOSES_WEEK, ANNOUNCE_WEEK, minGamesByWeek } from '@/lib/allstar-constants'
export * from '@/lib/allstar-constants'

const SEASON = '2025-26'
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']
const CONFS = ['Eastern', 'Western']

// Idempotency guard — safe to call every week from the cron; only actually
// resolves once, at VOTING_CLOSES_WEEK, and only if not already announced.
export async function resolveAllStarWeekend(): Promise<{ skipped: boolean, total?: number, auto_votes?: number }> {
  const { data: sc } = await supabaseAdmin.from('season_config').select('current_week').eq('id', 1).single()
  const currentWeek = sc?.current_week || 0
  if (currentWeek < VOTING_CLOSES_WEEK) return { skipped: true }

  // Atomically claim the announcement — this function runs unconditionally
  // on every simulate call, and a single real week is processed across two
  // separate half-1/half-2 invocations. The old check ("SELECT the flag,
  // decide to proceed, set the flag true only at the very end") left a real
  // race window: both halves could read roster_announced=false before
  // either had written true, so both ran the full delete+insert — a real
  // incident that doubled every single roster row. A conditional UPDATE
  // only ever succeeds for whichever call gets there first; the loser sees
  // 0 rows affected and bails out immediately, before doing any real work.
  const { data: claimed } = await supabaseAdmin.from('allstar_config')
    .update({ roster_announced: true }).eq('id', 1).eq('roster_announced', false).select('id')
  if (!claimed || claimed.length === 0) return { skipped: true }

  const minGames = minGamesByWeek(currentWeek)

  const { data: allTeams } = await supabaseAdmin.from('teams').select('id,conference')
  const teamConf: Record<string, string> = {}
  ;(allTeams || []).forEach((t: any) => { teamConf[t.id] = t.conference })

  const { data: playersRaw } = await supabaseAdmin
    .from('players').select('id,name,pos,team_id,status')
    .eq('status', 'active')

  // player_stats holds one row per player PER SEASON (multi-year history) —
  // a naive players(...player_stats(...)) embed with no season filter grabs
  // whichever row PostgREST returns first (often an old, empty season), so
  // this fetches the CURRENT season's rows separately and maps by player_id.
  const { data: statsRows } = await supabaseAdmin.from('player_stats')
    .select('player_id,games,pts,reb,ast').eq('season', SEASON)
  const statsByPlayer: Record<string, any> = {}
  ;(statsRows || []).forEach((s: any) => { statsByPlayer[s.player_id] = s })
  const players = (playersRaw || []).map((p: any) => ({ ...p, player_stats: [statsByPlayer[p.id] || {}] }))

  const eligible = players.filter((p: any) => (p.player_stats?.[0]?.games || 0) >= minGames)

  // Auto-vote for GMs who didn't vote
  const { data: existingVotes } = await supabaseAdmin.from('allstar_votes').select('gm_team_id').eq('season', SEASON)
  const votedTeams = new Set((existingVotes || []).map((v: any) => v.gm_team_id))
  const autoRows: any[] = []

  for (const conf of CONFS) {
    const confEl = eligible.filter((p: any) => teamConf[p.team_id] === conf)
    for (const pos of POSITIONS) {
      const top2 = confEl
        .filter((p: any) => p.pos === pos || (pos === 'SF' && p.pos === 'PF') || (pos === 'PF' && p.pos === 'SF'))
        .map((p: any) => { const s = p.player_stats?.[0] || {}; const gp = Math.max(1, s.games || 1); return { ...p, score: (s.pts / gp) * 0.5 + (s.reb / gp) * 0.25 + (s.ast / gp) * 0.25 } })
        .sort((a: any, b: any) => b.score - a.score).slice(0, 2)
      for (const t of (allTeams || []).filter((t: any) => !['ALL', 'RVS'].includes(t.id) && !votedTeams.has(t.id))) {
        for (const p of top2) {
          autoRows.push({ gm_team_id: t.id, season: SEASON, conference: conf, position: pos, player_id: p.id, is_auto: true })
        }
      }
    }
  }
  if (autoRows.length > 0) await supabaseAdmin.from('allstar_votes').upsert(autoRows, { onConflict: 'gm_team_id,season,conference,position,player_id' })

  // Tally
  const { data: allVotes } = await supabaseAdmin.from('allstar_votes').select('*').eq('season', SEASON)
  const tally: Record<string, Record<string, Record<string, number>>> = {}
  ;(allVotes || []).forEach((v: any) => {
    if (!tally[v.conference]) tally[v.conference] = {}
    if (!tally[v.conference][v.position]) tally[v.conference][v.position] = {}
    tally[v.conference][v.position][v.player_id] = (tally[v.conference][v.position][v.player_id] || 0) + 1
  })

  // Build roster
  // NOTE: object keys (from tally[conf][pos][player_id] = ...) are always
  // coerced to strings by JS, even when player_id is numeric — every pid
  // extracted via Object.entries() below must be converted back to Number
  // before comparing against players.id, or every `===` check silently
  // fails and the roster comes out empty (the real bug found live: 608
  // auto-votes tallied, 0 roster spots built).
  const rosterRows: any[] = []
  for (const conf of CONFS) {
    const starters: number[] = []
    const allCands: { pid: number, votes: number, pos: string }[] = []
    for (const pos of POSITIONS) {
      const posV = tally[conf]?.[pos] || {}
      const sorted = Object.entries(posV).map(([pid, cnt]) => [Number(pid), cnt] as [number, number]).sort((a, b) => b[1] - a[1])
      for (const [pid, cnt] of sorted) {
        if (!starters.includes(pid) && eligible.find((p: any) => p.id === pid)) {
          starters.push(pid)
          rosterRows.push({ season: SEASON, conference: conf, player_id: pid, position: pos, is_starter: true, vote_count: cnt, is_injured: false })
          break
        }
      }
      for (const [pid, cnt] of sorted) if (!allCands.find(c => c.pid === pid)) allCands.push({ pid, votes: cnt, pos })
    }

    // Guarantee exactly 5 starters per conference. A position can come up
    // with zero eligible candidates (sparse manual voting + no auto-votes
    // needed there, since auto-votes only fill for teams that never
    // voted) — this is the real gap found live (Eastern only got 4
    // starters). Fill any remaining slot from the conference's best
    // not-yet-selected eligible player by season production, same
    // pts/reb/ast-weighted score already used for auto-votes above.
    const confElRanked = eligible.filter((p: any) => teamConf[p.team_id] === conf)
      .map((p: any) => { const s = p.player_stats?.[0] || {}; const gp = Math.max(1, s.games || 1); return { ...p, score: (s.pts / gp) * 0.5 + (s.reb / gp) * 0.25 + (s.ast / gp) * 0.25 } })
      .sort((a: any, b: any) => b.score - a.score)
    while (starters.length < 5) {
      const filler = confElRanked.find((p: any) => !starters.includes(p.id))
      if (!filler) break
      starters.push(filler.id)
      rosterRows.push({ season: SEASON, conference: conf, player_id: filler.id, position: filler.pos, is_starter: true, vote_count: 0, is_injured: false })
    }

    // Exactly 7 reserves per conference (5 starters + 7 reserves = 12,
    // matching the real NBA format). Same production-based fallback if
    // fewer than 7 candidates got any votes.
    const reserves: { pid: number, votes: number, pos: string }[] =
      allCands.filter(c => !starters.includes(c.pid)).sort((a, b) => b.votes - a.votes).slice(0, 7)
    while (reserves.length < 7) {
      const filler = confElRanked.find((p: any) => !starters.includes(p.id) && !reserves.some((r) => r.pid === p.id))
      if (!filler) break
      reserves.push({ pid: filler.id, votes: 0, pos: filler.pos })
    }
    for (const r of reserves) rosterRows.push({ season: SEASON, conference: conf, player_id: r.pid, position: r.pos, is_starter: false, vote_count: r.votes, is_injured: false })
  }

  // Injury replacements — check real, currently-open injuries (injury_log),
  // not players.status (which is roster/employment status, not health — a
  // player can be status='active' on his team AND out with an injury).
  const { data: activeInjuries } = await supabaseAdmin.from('injury_log').select('player_id').eq('status', 'active')
  const injuredIds = new Set((activeInjuries || []).map((i: any) => i.player_id))

  // Was a .flatMap with each row computing its own replacement independently
  // off a fixed "already on roster" snapshot — with only ever 1 injured
  // player per conference in practice that never showed a problem, but with
  // several injured at once (the real case found live: 4 in one conference)
  // two different injured slots could pick the exact same healthy
  // replacement twice, and a replaced STARTER always got logged as a
  // reserve (losing a starting spot instead of keeping it). Rewritten as an
  // imperative loop with one running "already used" set, and a replacement
  // now inherits the replaced player's is_starter flag.
  const usedPlayerIds = new Set(rosterRows.map((r: any) => r.player_id))
  const finalRoster: any[] = []
  for (const row of rosterRows) {
    if (injuredIds.has(row.player_id)) {
      const rep = eligible.filter((p: any) => teamConf[p.team_id] === row.conference && !usedPlayerIds.has(p.id) && !injuredIds.has(p.id))
        .map((p: any) => { const s = p.player_stats?.[0] || {}; const gp = Math.max(1, s.games || 1); return { ...p, score: (s.pts / gp) * 0.5 + (s.reb / gp) * 0.25 + (s.ast / gp) * 0.25 } })
        .sort((a: any, b: any) => b.score - a.score)[0]
      if (rep) {
        usedPlayerIds.add(rep.id)
        finalRoster.push({ ...row, is_injured: true, replaced_by: rep.id })
        finalRoster.push({ season: SEASON, conference: row.conference, player_id: rep.id, position: row.position, is_starter: row.is_starter, vote_count: 0, is_injured: false })
        continue
      }
    }
    finalRoster.push(row)
  }

  await supabaseAdmin.from('allstar_roster').delete().eq('season', SEASON)
  await supabaseAdmin.from('allstar_roster').insert(finalRoster)
  // roster_announced was already claimed atomically above — no need to set it again.

  // Create the actual award record every selected player was missing —
  // sponsor objective "player_allstar" and the award notification both
  // depend on this existing, and neither ever fired before.
  const selectedPlayers = finalRoster.filter((r: any) => !r.is_injured)
  const awardRows = selectedPlayers.map((r: any) => {
    const pl = players?.find((p: any) => p.id === r.player_id)
    const s = pl?.player_stats?.[0] || {}
    const gp = Math.max(1, s.games || 1)
    return {
      season: SEASON,
      award_type: r.conference === 'Eastern' ? 'all_star_east' : 'all_star_west',
      // awards' unique constraint is (season, award_type, period) — every
      // All-Star shares the same season+award_type, so period must be
      // per-player here (unlike weekly/monthly awards where one period
      // maps to exactly one winner) or the batch insert violates it.
      period: `season_p${r.player_id}`,
      conference: r.conference,
      player_id: r.player_id,
      team_id: pl?.team_id || null,
      score: r.vote_count,
      stats_context: { ppg: +(s.pts / gp).toFixed(1), rpg: +(s.reb / gp).toFixed(1), apg: +(s.ast / gp).toFixed(1), games: s.games || 0 },
      notes: r.is_starter ? `${r.conference} All-Star Starter (${r.position})` : `${r.conference} All-Star Reserve (${r.position})`,
    }
  })
  if (awardRows.length) {
    // awards' unique constraint is (season, award_type, period) — a single
    // period value ('season') is shared by every All-Star, unlike weekly/
    // monthly awards, so this can't be an upsert on that constraint. Delete
    // any prior All-Star awards for the season first (matches the same
    // delete-then-insert pattern already used for allstar_roster above).
    await supabaseAdmin.from('awards').delete().eq('season', SEASON).in('award_type', ['all_star_east', 'all_star_west'])
    const { error: awardErr } = await supabaseAdmin.from('awards').insert(awardRows)
    if (awardErr) console.error('All-Star awards insert failed:', awardErr)
  }

  return { skipped: false, total: finalRoster.length, auto_votes: autoRows.length }
}

// Rookies vs Sophomores ("Rising Stars") — unlike the East/West game, this
// roster is entirely system-selected: top 12 by average Game Score in each
// group (nba_experience 0 = Rookies, 1 = Sophomores), top 5 of each as
// starters. Same idempotency pattern as resolveAllStarWeekend() (atomic
// conditional UPDATE on its own flag) since this also runs unconditionally
// every cron invocation.
export async function resolveRisingStars(): Promise<{ skipped: boolean, rookies?: number, sophomores?: number }> {
  const { data: sc } = await supabaseAdmin.from('season_config').select('current_week').eq('id', 1).single()
  const currentWeek = sc?.current_week || 0
  if (currentWeek < ANNOUNCE_WEEK) return { skipped: true }

  const { data: claimed } = await supabaseAdmin.from('allstar_config')
    .update({ rising_stars_announced: true }).eq('id', 1).eq('rising_stars_announced', false).select('id')
  if (!claimed || claimed.length === 0) return { skipped: true }

  const { data: activeInjuries } = await supabaseAdmin.from('injury_log').select('player_id').eq('status', 'active')
  const injuredIds = new Set((activeInjuries || []).map((i: any) => i.player_id))

  const { data: playersRaw } = await supabaseAdmin
    .from('players').select('id,name,team_id,status,nba_experience')
    .eq('status', 'active').in('nba_experience', [0, 1])

  // Game Score is a LINEAR combination of box-score counting stats, so the
  // average per game over a season is just the same formula applied to the
  // season's TOTALS (from player_stats) divided by games played — no need
  // to walk every individual box_scores row.
  const { data: statsRows } = await supabaseAdmin.from('player_stats')
    .select('player_id,games,pts,fgm,fga,ftm,fta,off_reb,def_reb,stl,ast,blk,fouls,turnovers')
    .eq('season', SEASON)
  const statsByPlayer: Record<string, any> = {}
  ;(statsRows || []).forEach((s: any) => { statsByPlayer[s.player_id] = s })

  const gameScoreAvg = (s: any) => {
    if (!s || !s.games) return -Infinity
    const total = (s.pts || 0) + 0.4 * (s.fgm || 0) - 0.7 * (s.fga || 0) - 0.4 * ((s.fta || 0) - (s.ftm || 0))
      + 0.7 * (s.off_reb || 0) + 0.3 * (s.def_reb || 0) + (s.stl || 0) + 0.7 * (s.ast || 0) + 0.7 * (s.blk || 0)
      - 0.4 * (s.fouls || 0) - (s.turnovers || 0)
    return total / s.games
  }

  const buildGroup = (expYears: number) => (playersRaw || [])
    .filter((p: any) => p.nba_experience === expYears && !injuredIds.has(p.id))
    .map((p: any) => ({ ...p, gs: gameScoreAvg(statsByPlayer[p.id]) }))
    .filter((p: any) => Number.isFinite(p.gs))
    .sort((a: any, b: any) => b.gs - a.gs)
    .slice(0, 12)

  const rookies = buildGroup(0)
  const sophomores = buildGroup(1)

  const rows: any[] = []
  ;[{ group: rookies, team: 'ROO' }, { group: sophomores, team: 'SOP' }].forEach(({ group, team }) => {
    group.forEach((p: any, idx: number) => {
      rows.push({ season: SEASON, team_id: team, player_id: p.id, is_starter: idx < 5, game_score: +p.gs.toFixed(2) })
    })
  })

  await supabaseAdmin.from('rising_stars_roster').delete().eq('season', SEASON)
  if (rows.length) await supabaseAdmin.from('rising_stars_roster').insert(rows)

  // Same milestone-visibility need as the All-Star awards above — Starter
  // vs Reserve per squad, surfaced via awards.notes on the player page.
  const awardRows = rows.map((r: any) => ({
    season: SEASON,
    award_type: r.team_id === 'ROO' ? 'rising_stars_rookie' : 'rising_stars_sophomore',
    period: `season_p${r.player_id}`,
    team_id: r.team_id,
    player_id: r.player_id,
    score: r.game_score,
    notes: r.is_starter ? 'Rising Stars Starter' : 'Rising Stars Reserve',
  }))
  if (awardRows.length) {
    await supabaseAdmin.from('awards').delete().eq('season', SEASON).in('award_type', ['rising_stars_rookie', 'rising_stars_sophomore'])
    const { error } = await supabaseAdmin.from('awards').insert(awardRows)
    if (error) console.error('Rising Stars awards insert failed:', error)
  }

  return { skipped: false, rookies: rookies.length, sophomores: sophomores.length }
}

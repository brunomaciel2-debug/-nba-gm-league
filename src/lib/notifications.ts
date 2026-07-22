import { createClient } from '@supabase/supabase-js'
import { getStatusForWeek, getWeekDates, formatWeekRange } from './season-week-helper'
import { getTeamLang, clearLangCache, notifWeeklyResults, notifInjury, notifTechnicalFoul, notifDroppedOutPlayoffs, notifLeadingConference, notifWinStreak, notifLossStreak, notifRivalWin, notifDevelopment, notifLowMorale, notifContractExpiring, notifArenaConstruction, notifTrainingCredits, notifOrdersReminder, notifSponsorPayment, notifSeasonEnd, notifGMInactivity, notifAward, notifCapCritical, notifRosterMinimumRisk, notifGLeagueStart, notifTacticalFocusNeeded, notifMonthlySettlement } from './notifications-helpers'
import { medicalCostAfterInsurance, isSpecialistEligible, SPECIALIST_COST_BY_SEVERITY, SPECIALIST_BOOST_MULTIPLIER_BY_SEVERITY, InjurySeverity } from './injury-constants'
import { OffSystem, nodesForSystem, isNodeUnlocked } from './tactical-constants'
import { NBA_SUBSIDY_MONTHLY, UTILITIES_MONTHLY, INSURANCE_MONTHLY } from './finance-constants'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Central notification sender ──────────────────────────
export async function notify(
  teamId: string,
  type: string,
  subject: string,
  body: string,
  metadata: Record<string, any> = {}
) {
  await supabase.from('inbox_messages').insert({
    to_team_id: teamId,
    type,
    subject,
    body,
    read: false,
    metadata,
  })
}

// ── Brevo email sender ────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.BREVO_API_KEY) return
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'NBA GM League', email: 'noreply@nbagmleague.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15_000),
  })
}

function fmt(n: number) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M'
  if (n >= 1000) return '$' + (n/1000).toFixed(0) + 'K'
  return '$' + n
}

// ══════════════════════════════════════════════════════════
// POST-SIMULATION NOTIFICATIONS
// Called after every simulation cycle
// ══════════════════════════════════════════════════════════

type TechFoulEvent = { playerId:string, name:string, teamId:string, seasonTechs:number, techsUntilNextSuspension:number, gamesAdded:number }

export async function runPostSimNotifications(week: number, gamesCreated: string[], techFoulEvents: TechFoulEvent[] = []) {
  const [
    { data: teams },
    { data: games },
    { data: injuries },
    { data: players },
    { data: awards },
    { data: contracts },
    { data: sponsorContracts },
    { data: constructions },
  ] = await Promise.all([
    supabase.from('teams').select('id,name,wins,losses,conference,rival_team_id,cap_used').not('id','in','(ALL,RVS,ROO,SOP)'),
    supabase.from('games').select('*,home:teams!games_home_team_fkey(name),away:teams!games_away_team_fkey(name)').in('id', gamesCreated),
    supabase.from('injury_log').select('*,players!inner(name,team_id)').eq('season','2025-26').eq('status','active').eq('week_number', week),
    // NOTE: real column is "contract_years" (years REMAINING on the deal),
    // not "contract_years_left" — the wrong name here silently broke this
    // query (and the LOW MORALE + CONTRACTS EXPIRING sections below) forever.
    supabase.from('players').select('id,name,team_id,real_ovr,moral,age,contract_years,salary').eq('status','active').not('team_id','is',null),
    supabase.from('awards').select('*,players!inner(name,team_id)').eq('season','2025-26').in('period',[`week_${week}`]),
    supabase.from('players').select('id,name,team_id,contract_years,salary').eq('status','active').not('team_id','is',null).lte('contract_years',1),
    supabase.from('sponsor_contracts').select('*,template:sponsor_templates(company_name,tier)').eq('season','2025-26').eq('status','active'),
    supabase.from('construction_queue').select('*').eq('status','in_progress'),
  ])

  const teamMap: Record<string,any> = {}
  ;(teams||[]).forEach((t:any) => teamMap[t.id] = t)
  const gameById: Record<string,any> = {}
  ;(games||[]).forEach((g:any) => gameById[g.id] = g)

  // Clear language cache at start of each simulation run
  clearLangCache()

  // ── 1. WEEKLY RESULTS SUMMARY ─────────────────────────
  for (const team of (teams||[])) {
    const teamGames = (games||[]).filter((g:any) =>
      g.home_team === team.id || g.away_team === team.id
    )
    if (!teamGames.length) continue

    const results = teamGames.map((g:any) => {
      const isHome = g.home_team === team.id
      const teamScore = isHome ? g.home_score : g.away_score
      const oppScore = isHome ? g.away_score : g.home_score
      const opp = isHome ? g.away?.name : g.home?.name
      const won = teamScore > oppScore
      return `${won ? '✓' : '✗'} ${isHome ? 'vs' : '@'} ${opp} ${teamScore}-${oppScore}`
    })

    const wins = results.filter(r => r.startsWith('✓')).length
    const losses = results.filter(r => r.startsWith('✗')).length
    const lang = await getTeamLang(team.id)

    const lastGame = teamGames[teamGames.length - 1]
    const isHome = lastGame.home_team === team.id
    const opp = isHome ? lastGame.away?.name : lastGame.home?.name
    const ts = isHome ? lastGame.home_score : lastGame.away_score
    const os = isHome ? lastGame.away_score : lastGame.home_score

    const notif = notifWeeklyResults(lang, team.name, team.wins, team.losses, { opp, score: `${ts}-${os}`, won: ts > os })
    const allResults = lang === 'pt'
      ? `Resultados de ${formatWeekRange(week,'pt-PT')}:\n\n${results.join('\n')}\n\nRegisto da época: ${team.wins}V-${team.losses}D`
      : `Your ${formatWeekRange(week,'en-US')} results:\n\n${results.join('\n')}\n\nSeason record: ${team.wins}W-${team.losses}L`

    await notify(team.id, 'results', notif.subject, allResults, { week, wins, losses })
  }

  // ── 2. INJURIES ────────────────────────────────────────
  const injuriesByTeam: Record<string,any[]> = {}
  for (const inj of (injuries||[])) {
    const teamId = inj.players?.team_id
    if (!teamId) continue
    if (!injuriesByTeam[teamId]) injuriesByTeam[teamId] = []
    injuriesByTeam[teamId].push(inj)
  }

  for (const [teamId, teamInjuries] of Object.entries(injuriesByTeam)) {
    const lang = await getTeamLang(teamId)
    for (const inj of teamInjuries) {
      const severity = inj.severity
      const emoji = severity === 'career_threatening' ? '🚨' : severity === 'severe' ? '🔴' : severity === 'serious' ? '🟠' : '🟡'
      // Opponent + final score for the specific game the injury happened in —
      // previously the notification just said "in a game" with no way to
      // tell which one without opening the Injury Report separately.
      const injGame = inj.game_id ? gameById[inj.game_id] : null
      let gameContext: string | undefined
      if (injGame) {
        const isHome = injGame.home_team === teamId
        const opp = isHome ? injGame.away?.name : injGame.home?.name
        const ts = isHome ? injGame.home_score : injGame.away_score
        const os = isHome ? injGame.away_score : injGame.home_score
        gameContext = `${isHome ? 'vs' : '@'} ${opp}, ${ts}-${os}`
      }
      const notif = notifInjury(lang, inj.players?.name, inj.injury_type, inj.games_out, inj.occurred_in, gameContext)
      const recurring = inj.is_recurring ? (lang === 'pt' ? '\n⚠️ Esta é uma lesão recorrente.' : '\n⚠️ This is a recurring injury.') : ''
      const medCost = medicalCostAfterInsurance(severity as InjurySeverity)
      const medLine = lang === 'pt' ? `\n💵 Despesas médicas: $${(medCost/1000).toFixed(0)}K após seguro (já debitadas)` : `\n💵 Medical bill: $${(medCost/1000).toFixed(0)}K after insurance (already charged)`
      const eligible = isSpecialistEligible(severity)
      const specialistCost = eligible ? SPECIALIST_COST_BY_SEVERITY[severity as InjurySeverity] || 0 : 0
      const specialistBoostPct = eligible ? Math.round(((SPECIALIST_BOOST_MULTIPLIER_BY_SEVERITY[severity as InjurySeverity] || 1) - 1) * 100) : 0
      const specialistLine = eligible
        ? (lang === 'pt'
            ? `\n\n🩺 Podes levar ${inj.players?.name} a um especialista externo por $${(specialistCost/1000).toFixed(0)}K para acelerar a recuperação dele em ${specialistBoostPct}% (não cura na hora) — vê o Relatório de Lesões da tua equipa.`
            : `\n\n🩺 You can send ${inj.players?.name} to an outside specialist for $${(specialistCost/1000).toFixed(0)}K to speed up his recovery by ${specialistBoostPct}% (not an instant cure) — check your team's Injury Report.`)
        : ''
      const detail = inj.notes ? `\n${inj.notes}` : ''
      const bodyPart = lang === 'pt' ? `Zona afetada: ${inj.body_part}${detail}\nRecuperação estimada: ${inj.games_out} jogos (aprox. ${Math.ceil(inj.games_out/4)} semanas)${recurring}` : `Body part: ${inj.body_part}${detail}\nEstimated recovery: ${inj.games_out} games (approx. ${Math.ceil(inj.games_out/4)} weeks)${recurring}`
      await notify(teamId, 'injury', `${emoji} ${notif.subject.replace('🏥 Injury — ', '').replace('🏥 Lesão — ', '')}`, `${notif.body}\n\n${bodyPart}${medLine}${specialistLine}`, {
        player_id: inj.player_id, injury_type: inj.injury_type, severity, games_out: inj.games_out,
        specialist_eligible: eligible, specialist_cost: specialistCost, specialist_used: false,
        game_id: inj.game_id || undefined,
      })
    }
  }

  // ── 2b. TECHNICAL FOULS + SUSPENSIONS ─────────────────
  if (techFoulEvents.length > 0) {
    const isPostseason = ['play-in','playoffs'].includes(getStatusForWeek(week))
    for (const ev of techFoulEvents) {
      const lang = await getTeamLang(ev.teamId)
      const notif = notifTechnicalFoul(lang, ev.name, ev.seasonTechs, ev.techsUntilNextSuspension, ev.gamesAdded, isPostseason)
      await notify(ev.teamId, ev.gamesAdded > 0 ? 'suspension' : 'technical_foul', notif.subject, notif.body, {
        player_id: ev.playerId, season_techs: ev.seasonTechs,
        techs_until_next_suspension: ev.techsUntilNextSuspension, games_suspended: ev.gamesAdded,
      })
    }
  }

  // ── 3. PLAYOFF POSITION CHANGES ───────────────────────
  for (const team of (teams||[])) {
    const confTeams = (teams||[])
      .filter((t:any) => t.conference === team.conference)
      .sort((a:any,b:any) => b.wins - a.wins)
    const rank = confTeams.findIndex((t:any) => t.id === team.id) + 1
    const lang = await getTeamLang(team.id)

    if (rank === 9) {
      const notif = notifDroppedOutPlayoffs(lang, team.conference)
      await notify(team.id, 'standings', notif.subject, notif.body, { rank })
    } else if (rank === 1) {
      const notif = notifLeadingConference(lang, team.conference, team.wins, team.losses)
      await notify(team.id, 'standings', notif.subject, notif.body, { rank })
    }
  }

  // ── 4. WIN/LOSS STREAKS ────────────────────────────────
  // A trailing 5-game streak needs the team's real recent history — NOT just
  // this week's newly-simulated games. (A team only plays ~2-4 games in a
  // single simulated week, so computing "5 in a row" from that small batch
  // alone could never actually reach 5 — this was a standing bug.)
  for (const team of (teams||[])) {
    const { data: recentGames } = await supabase.from('games')
      .select('home_team,away_team,home_score,away_score,played_at')
      .or(`home_team.eq.${team.id},away_team.eq.${team.id}`)
      .eq('status','final')
      .order('played_at', { ascending:false })
      .limit(5)

    let streak = 0, streakType = ''
    for (const g of (recentGames||[])) {
      const won = (g.home_team===team.id&&g.home_score>g.away_score)||(g.away_team===team.id&&g.away_score>g.home_score)
      const result = won ? 'W' : 'L'
      if (!streakType) { streakType = result; streak = 1 }
      else if (result === streakType) streak++
      else break
    }

    const lang = await getTeamLang(team.id)

    if (streak >= 5 && streakType === 'W') {
      const notif = notifWinStreak(lang, team.name, streak)
      await notify(team.id, 'streak', notif.subject, notif.body, { streak, type: 'win' })
    } else if (streak >= 5 && streakType === 'L') {
      const notif = notifLossStreak(lang, team.name, streak)
      await notify(team.id, 'streak', notif.subject, notif.body, { streak, type: 'loss' })
    }

    // Rivalry win check only cares about THIS week's games, which is what
    // the gamesCreated-scoped `games` variable correctly represents.
    if (team.rival_team_id) {
      const teamGamesThisWeek = (games||[]).filter((g:any) => g.home_team === team.id || g.away_team === team.id)
      const rivalGame = teamGamesThisWeek.find((g:any) =>
        (g.home_team===team.id&&g.away_team===team.rival_team_id)||(g.away_team===team.id&&g.home_team===team.rival_team_id)
      )
      if (rivalGame) {
        const won = (rivalGame.home_team===team.id&&rivalGame.home_score>rivalGame.away_score)||(rivalGame.away_team===team.id&&rivalGame.away_score>rivalGame.home_score)
        const rival = teamMap[team.rival_team_id]
        if (won) {
          const notif = notifRivalWin(lang, rival?.name)
          await notify(team.id, 'rivalry', notif.subject, notif.body, { rival_id: team.rival_team_id })
        }
      }
    }
  }

  // ── 5. PLAYER DEVELOPMENT ─────────────────────────────
  const { data: devLogs } = await supabase
    .from('attribute_development')
    .select('*,players!inner(name,team_id)')
    .eq('season','2025-26')
    .eq('week_number', week)
    .gte('change', 3)

  const devByTeam: Record<string,any[]> = {}
  for (const log of (devLogs||[])) {
    const teamId = log.players?.team_id
    if (!teamId) continue
    if (!devByTeam[teamId]) devByTeam[teamId] = []
    devByTeam[teamId].push(log)
  }
  for (const [teamId, logs] of Object.entries(devByTeam)) {
    const lang = await getTeamLang(teamId)
    const summary = logs.map((l:any) => `${l.players?.name}: +${l.change} ${l.attribute}`).join('\n')
    const notif = notifDevelopment(lang, logs[0].players?.name, logs.map((l:any) => l.attribute))
    const title = lang === 'pt' ? `📈 Desenvolvimento de jogadores esta semana` : `📈 Player development this week`
    const body = lang === 'pt' ? `Melhorias notáveis do teu plantel esta semana:\n\n${summary}` : `Notable improvements from your roster this week:\n\n${summary}`
    await notify(teamId, 'development', title, body, { logs })
  }

  // ── 6. LOW MORALE ALERTS ──────────────────────────────
  // Players who already have an open Player Interaction get the specific,
  // actionable notification from that system instead — showing both here
  // too would just be redundant noise for the same player.
  const { data: openInteractionPlayers } = await supabase.from('player_interactions').select('player_id').in('status', ['pending_response','monitoring'])
  const openInteractionPlayerIds = new Set((openInteractionPlayers||[]).map((i:any) => i.player_id))
  const lowMoralePlayers = (players||[]).filter((p:any) => p.moral < 40 && !openInteractionPlayerIds.has(p.id))
  const lowMoraleByTeam: Record<string,any[]> = {}
  for (const p of lowMoralePlayers) {
    if (!lowMoraleByTeam[p.team_id]) lowMoraleByTeam[p.team_id] = []
    lowMoraleByTeam[p.team_id].push(p)
  }
  for (const [teamId, unhappy] of Object.entries(lowMoraleByTeam)) {
    const names = unhappy.map((p:any) => `${p.name} (moral: ${p.moral}/100)`).join('\n')
    await notify(teamId, 'morale', `😟 Low morale alert`, `The following players are unhappy and may underperform:\n\n${names}\n\nConsider adjusting training intensity or making roster moves.`, { players: unhappy.map((p:any)=>p.id) })
  }

  // ── 7. CONTRACTS EXPIRING ─────────────────────────────
  if (week === 32) { // ~8 weeks before end of the Regular Season (ends week 40)
    const expiringByTeam: Record<string,any[]> = {}
    for (const p of (contracts||[])) {
      if (!expiringByTeam[p.team_id]) expiringByTeam[p.team_id] = []
      expiringByTeam[p.team_id].push(p)
    }
    for (const [teamId, expiring] of Object.entries(expiringByTeam)) {
      const names = expiring.map((p:any) => `${p.name} — ${fmt(p.salary)}`).join('\n')
      await notify(teamId, 'contract', `📝 Contracts expiring at end of season`, `The following players will be free agents after this season:\n\n${names}\n\nConsider extending them now before they hit the open market.`, { count: expiring.length })
    }
  }

  // ── 8. CONSTRUCTION QUEUE (arena sections + practice facility upgrades) ──
  const ARENA_EXPANSION_RATE = 0.6
  const NEW_SECTION_BASE_SEATS = 3000
  const GYM_NEXT_GRADE: Record<string,string> = { F:'E', E:'D', D:'C', C:'B', B:'A' }

  for (const item of (constructions||[])) {
    const endDate = new Date(item.ends_at)
    const today = new Date()
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000*60*60*24))
    const lang = await getTeamLang(item.team_id)
    const notif = notifArenaConstruction(lang, item.name, daysLeft <= 0)

    if (daysLeft <= 0) {
      await notify(item.team_id, 'construction', notif.subject, notif.body, { name: item.name })
      if (item.construction_type === 'arena_section') {
        const { data: sec } = await supabase.from('arena_sections').select('capacity').eq('id', item.reference_id).single()
        const oldCapacity = sec?.capacity || 0
        const delta = Math.round((oldCapacity > 0 ? oldCapacity : NEW_SECTION_BASE_SEATS) * ARENA_EXPANSION_RATE)
        await supabase.from('arena_sections').update({ under_construction: false, capacity: oldCapacity + delta }).eq('id', item.reference_id)
      } else if (item.construction_type === 'practice_facility') {
        const { data: fac } = await supabase.from('practice_facilities').select('gym_grade').eq('id', item.reference_id).single()
        const nextGrade = fac?.gym_grade ? GYM_NEXT_GRADE[fac.gym_grade] : null
        await supabase.from('practice_facilities').update({
          gym_under_construction: false, ...(nextGrade ? { gym_grade: nextGrade } : {}),
        }).eq('id', item.reference_id)
      }
      await supabase.from('construction_queue').update({ status: 'completed' }).eq('id', item.id)
    } else if (daysLeft <= 7) {
      await notify(item.team_id, 'construction', notif.subject, notif.body, { name: item.name, days_left: daysLeft })
    }
  }

  // ── 9. PLAYER OF THE WEEK ─────────────────────────────
  for (const award of (awards||[])) {
    if (!award.award_type?.startsWith('potw_')) continue
    const teamId = award.players?.team_id
    if (!teamId) continue
    const lang = await getTeamLang(teamId)
    const conf = award.award_type.includes('eastern') ? 'Eastern' : 'Western'
    const stats = `${award.stats_context?.ppg} PPG · ${award.stats_context?.rpg} RPG · ${award.stats_context?.apg} APG`
    const subject = lang === 'pt' ? `🌟 Jogador da Semana — ${award.players?.name}!` : `🌟 Player of the Week — ${award.players?.name}!`
    const body = lang === 'pt'
      ? `O ${award.players?.name} foi nomeado Jogador da Semana (${formatWeekRange(week,'pt-PT')}) da Conferência ${conf === 'Eastern' ? 'Este' : 'Oeste'}.\n\nEstatísticas: ${stats} em ${award.stats_context?.games} jogos.`
      : `${award.players?.name} has been named ${conf} Conference Player of the Week for ${formatWeekRange(week,'en-US')}.\n\nStats: ${stats} in ${award.stats_context?.games} games.`
    await notify(teamId, 'award', subject, body, { player_id: award.player_id, award_type: award.award_type })
  }

  // ── 10. WEEKLY ORDERS DEADLINE REMINDER ───────────────
  for (const team of (teams||[])) {
    if (week % 2 === 0) {
      const lang = await getTeamLang(team.id)
      const notif = notifOrdersReminder(lang)
      await notify(team.id, 'reminder', notif.subject, notif.body, { week: week + 1 })
    }
  }

  // ── 11. SPONSOR MONTHLY PAYMENT ───────────────────────
  if (week % 4 === 0) {
    for (const contract of (sponsorContracts||[])) {
      const description = `Monthly sponsor payment — ${(contract.template as any)?.company_name}`
      // Idempotency guard — this same week gets processed twice in practice
      // (once per half, both halves share the same `week` number), which
      // was silently double-paying every sponsor contract every 4 weeks.
      const { data: existing } = await supabase.from('franchise_transactions').select('id')
        .eq('team_id', contract.team_id).eq('category', 'sponsor').eq('week_number', week).eq('description', description).maybeSingle()
      if (existing) continue

      const lang = await getTeamLang(contract.team_id)
      const notif = notifSponsorPayment(lang, contract.fixed_monthly)
      await notify(contract.team_id, 'sponsor', notif.subject, notif.body, { amount: contract.fixed_monthly, company: (contract.template as any)?.company_name })
      await supabase.rpc('increment_balance', { p_team_id: contract.team_id, p_amount: contract.fixed_monthly })
      await supabase.from('franchise_transactions').insert({
        team_id: contract.team_id, type: 'revenue', category: 'sponsor',
        amount: contract.fixed_monthly,
        description,
        season: '2025-26', week_number: week,
      })
    }
  }

  // ── 11b. MONTHLY FINANCIAL SETTLEMENT ─────────────────
  // NBA Subsidy, Coaching Staff salaries, Utilities and Insurance used to
  // only exist as guessed numbers in Finances > Projections — nothing in
  // the real simulation ever actually paid or charged them, which is why
  // the real Balance Sheet and the Projections estimate could show wildly
  // contradictory results. Same real-transaction treatment already given to
  // ticket revenue/concessions/travel/game-ops above.
  // Self-heals like Player/Rookie of the Month elsewhere: sweeps every
  // 4-week checkpoint up through the most recent one, not just the exact
  // `week` passed in — a checkpoint that already passed before this feature
  // existed (week 28 did, the week this was built) stayed permanently
  // missing under a plain `week % 4 === 0` check on just the current call.
  {
    const lastCheckpoint = Math.floor(week / 4) * 4
    if (lastCheckpoint >= 4) {
      const { data: allCoaches } = await supabase.from('coaches').select('team_id,salary').not('team_id', 'is', null)
      const coachSalaryByTeam: Record<string, number> = {}
      ;(allCoaches || []).forEach((c: any) => { coachSalaryByTeam[c.team_id] = (coachSalaryByTeam[c.team_id] || 0) + (c.salary || 0) })

      for (const team of (teams || [])) {
        for (let cp = 4; cp <= lastCheckpoint; cp += 4) {
          // Idempotency guard — same checkpoint can be swept again on a
          // later call (both halves of a week, or a future week's sweep
          // re-checking it), and this keeps it from being paid twice.
          const { data: existing } = await supabase.from('franchise_transactions').select('id')
            .eq('team_id', team.id).eq('category', 'nba_subsidy').eq('week_number', cp).maybeSingle()
          if (existing) continue

          const coachingMonthly = Math.round((coachSalaryByTeam[team.id] || 0) / 12)
          const netMonthly = NBA_SUBSIDY_MONTHLY - coachingMonthly - UTILITIES_MONTHLY - INSURANCE_MONTHLY

          const { data: fin } = await supabase.from('franchise_finances').select('balance').eq('team_id', team.id).single()
          if (!fin) continue
          await supabase.from('franchise_finances').update({ balance: (fin.balance || 0) + netMonthly }).eq('team_id', team.id)

          const rows: any[] = [
            { team_id: team.id, type: 'revenue', category: 'nba_subsidy', amount: NBA_SUBSIDY_MONTHLY, description: 'Monthly NBA revenue-sharing subsidy', season: '2025-26', week_number: cp },
            { team_id: team.id, type: 'expense', category: 'utilities', amount: UTILITIES_MONTHLY, description: 'Monthly arena utilities (power, water, HVAC)', season: '2025-26', week_number: cp },
            { team_id: team.id, type: 'expense', category: 'insurance', amount: INSURANCE_MONTHLY, description: 'Monthly liability & property insurance', season: '2025-26', week_number: cp },
          ]
          if (coachingMonthly > 0) rows.push({ team_id: team.id, type: 'expense', category: 'staff', amount: coachingMonthly, description: 'Monthly coaching staff salaries', season: '2025-26', week_number: cp })
          await supabase.from('franchise_transactions').insert(rows)

          // Only notify for the checkpoint matching this call's real,
          // current period — older backfilled checkpoints settle silently,
          // the same way a bank catches up a missed statement without
          // re-notifying separately for each past month.
          if (cp === lastCheckpoint) {
            const lang = await getTeamLang(team.id)
            const notif = notifMonthlySettlement(lang, NBA_SUBSIDY_MONTHLY, coachingMonthly, UTILITIES_MONTHLY, INSURANCE_MONTHLY, netMonthly)
            await notify(team.id, 'finance', notif.subject, notif.body, { net: netMonthly })
          }
        }
      }
    }
  }

  // ── 12. SEASON END APPROACHING ────────────────────────
  if (week === 36) { // 4 weeks before end of the Regular Season (ends week 40)
    for (const team of (teams||[])) {
      const lang = await getTeamLang(team.id)
      const notif = notifSeasonEnd(lang, 4)
      await notify(team.id, 'reminder', notif.subject, notif.body, { weeks_left: 4 })
    }
  }

  // ── 12b. G-LEAGUE STARTING SOON ────────────────────────
  // The G-League has its own real-calendar schedule (season starts Dec 27),
  // completely separate from the NBA week counter — same date-based
  // approach as the G-League game simulation itself, rather than trying to
  // pin this to one exact NBA week number. Fires once, ~2 weeks ahead of
  // the G-League's actual tip-off, guarded by checking whether it's already
  // gone out this season so a date range that stays true across several
  // calls doesn't resend it.
  const gleagueStart = new Date('2025-12-27T00:00:00Z')
  const noticeWindowStart = new Date(gleagueStart)
  noticeWindowStart.setDate(noticeWindowStart.getDate() - 14)
  if (getWeekDates(week).start >= noticeWindowStart) {
    const { data: alreadySent } = await supabase.from('inbox_messages').select('id').eq('type','gleague_start').limit(1).maybeSingle()
    if (!alreadySent) {
      for (const team of (teams||[])) {
        const lang = await getTeamLang(team.id)
        const notif = notifGLeagueStart(lang)
        await notify(team.id, 'gleague_start', notif.subject, notif.body, {})
      }
    }
  }

  // ── 13. TRAINING CREDITS FULL ────────────────────────
  const { data: trainingSlots } = await supabase
    .from('training_slots')
    .select('team_id,slot_type,credits_available')
    .eq('locked', false)
    .gt('credits_available', 0)

  const trainingByTeam: Record<string, any[]> = {}
  for (const slot of (trainingSlots||[])) {
    if (!trainingByTeam[slot.team_id]) trainingByTeam[slot.team_id] = []
    trainingByTeam[slot.team_id].push(slot)
  }

  for (const [teamId, readySlots] of Object.entries(trainingByTeam)) {
    const lang = await getTeamLang(teamId)
    const totalCredits = readySlots.reduce((s: number, sl: any) => s + sl.credits_available, 0)
    const labelsEN: Record<string,string> = { offense:'Offense', defense:'Defense', physical:'Physical', playmaking:'Playmaking', mental:'Mental', recovery:'Recovery', shooting:'Shooting Lab', analytics:'Analytics' }
    const labelsPT: Record<string,string> = { offense:'Ataque', defense:'Defesa', physical:'Físico', playmaking:'Jogo de Equipa', mental:'Mental', recovery:'Recuperação', shooting:'Treino de Lançamento', analytics:'Análise' }
    const labels = lang === 'pt' ? labelsPT : labelsEN
    const slotNames = readySlots.map((sl: any) => `${labels[sl.slot_type]||sl.slot_type} (${sl.credits_available}cr)`).join(', ')
    const notif = notifTrainingCredits(lang, totalCredits, readySlots.length, slotNames)
    await notify(teamId, 'training', notif.subject, notif.body, { total_credits: totalCredits, slots: readySlots.length })
  }

  // ── 14. NEW AWARDS (All-Star, MVP, DPOY, ROY, etc.) ────
  const { data: recentAwards } = await supabase
    .from('awards')
    .select('player_id,team_id,award_type,players(name,team_id)')
    .gte('created_at', new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString())

  const AWARD_LABELS_EN: Record<string,string> = {
    mvp:'Most Valuable Player', dpoy:'Defensive Player of the Year', roy:'Rookie of the Year',
    coy:'Coach of the Year', mip:'Most Improved Player', finals_mvp:'Finals MVP',
    all_nba_1:'1st Team All-NBA', all_nba_2:'2nd Team All-NBA', all_nba_3:'3rd Team All-NBA',
    all_rookie_1:'1st Rookie Team', all_rookie_2:'2nd Rookie Team',
    all_star_east:'Eastern Conference All-Star', all_star_west:'Western Conference All-Star',
  }
  const AWARD_LABELS_PT: Record<string,string> = {
    mvp:'MVP', dpoy:'Melhor Defesa da Liga', roy:'Melhor Rookiee da Época',
    coy:'Melhor Treinador', mip:'Jogador Mais Melhorado', finals_mvp:'MVP das Finais',
    all_nba_1:'1º Quinteto All-NBA', all_nba_2:'2º Quinteto All-NBA', all_nba_3:'3º Quinteto All-NBA',
    all_rookie_1:'1º Quinteto de Rookies', all_rookie_2:'2º Quinteto de Rookies',
    all_star_east:'All-Star da Conferência Este', all_star_west:'All-Star da Conferência Oeste',
  }

  for (const award of (recentAwards||[])) {
    const playerTeamId = (award.players as any)?.team_id || award.team_id
    const playerName = (award.players as any)?.name || 'A player'
    if (!playerTeamId) continue
    const lang = await getTeamLang(playerTeamId)
    const label = lang === 'pt' ? (AWARD_LABELS_PT[award.award_type] || award.award_type) : (AWARD_LABELS_EN[award.award_type] || award.award_type)
    const isAllStar = award.award_type.startsWith('all_star')
    const notif = notifAward(lang, playerName, label, isAllStar)
    await notify(playerTeamId, 'awards', notif.subject, notif.body, { player_name: playerName, award_type: award.award_type })
  }

  // ── 15. DRAFT PICKS MADE ───────────────────────────────
  const { data: recentPicks } = await supabase
    .from('draft_results')
    .select('team_id,pick_number,round,prospects(name)')
    .gte('created_at', new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString())

  for (const pick of (recentPicks||[])) {
    const prospectName = (pick.prospects as any)?.name || 'A prospect'
    const lang = await getTeamLang(pick.team_id)
    const subject = lang === 'pt' ? `🎓 Escolha do Draft #${pick.pick_number}: ${prospectName}` : `🎓 Draft Pick #${pick.pick_number}: ${prospectName}`
    const body = lang === 'pt'
      ? `Com a escolha #${pick.pick_number} (Ronda ${pick.round}), a tua equipa selecionou o ${prospectName}. Já foi adicionado ao teu plantel — verifica a sua página de jogador para veres os atributos completos.`
      : `With the #${pick.pick_number} pick (Round ${pick.round}), your team has selected ${prospectName}. They've been added to your roster — check their full attribute breakdown on their player page.`
    await notify(pick.team_id, 'fa', subject, body, { pick_number: pick.pick_number, round: pick.round, prospect_name: prospectName })
  }

  // ── 16. CAP SPACE WARNINGS ──────────────────────────────
  const CAP_LIMIT = 180_000_000
  const MIN_ROSTER = 12
  for (const team of (teams||[])) {
    const capUsed = team.cap_used || 0
    const capSpace = CAP_LIMIT - capUsed
    const pctUsed = capUsed / CAP_LIMIT
    const lang = await getTeamLang(team.id)

    if (pctUsed >= 0.97) {
      const notif = notifCapCritical(lang, capSpace, pctUsed * 100)
      await notify(team.id, 'contract', notif.subject, notif.body, { cap_used: capUsed, remaining: capSpace })
    }

    const { count: rosterCount } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('status', 'active')

    if ((rosterCount ?? 0) < MIN_ROSTER) {
      const spotsNeeded = MIN_ROSTER - (rosterCount ?? 0)
      if (capSpace < spotsNeeded * 1_000_000) {
        const notif = notifRosterMinimumRisk(lang, rosterCount ?? 0, spotsNeeded, capSpace, MIN_ROSTER)
        await notify(team.id, 'contract', notif.subject, notif.body, { roster_size: rosterCount, cap_space: capSpace })
      }
    }
  }

  // ── 16b. TACTICAL FOCUS NOT SET ────────────────────────
  // No auto-pick fallback in tactical-resolver.ts anymore — an active
  // system with no valid focus tech makes zero progress until the GM
  // actively picks one, so this checks live state every sim and keeps
  // nagging instead of leaving it silently stalled.
  {
    const { data: activeOrders } = await supabase.from('gm_orders').select('team_id,atk_style').eq('week_number', week)
    const activeSystemByTeam: Record<string, OffSystem> = {}
    ;(activeOrders||[]).forEach((o:any) => { activeSystemByTeam[o.team_id] = (o.atk_style as OffSystem) || 'motion' })

    const teamIds = (teams||[]).map((t:any)=>t.id)
    const { data: focusRows } = await supabase.from('tactical_focus').select('*').in('team_id', teamIds)
    const focusByKey: Record<string,string> = {}
    ;(focusRows||[]).forEach((f:any) => { focusByKey[`${f.team_id}|${f.system}`] = f.node_id })

    const { data: tacticalProgressRows } = await supabase.from('tactical_familiarity').select('*').in('team_id', teamIds)
    const progressByKey: Record<string, Record<string,number>> = {}
    ;(tacticalProgressRows||[]).forEach((r:any) => { (progressByKey[`${r.team_id}|${r.system}`] ||= {})[r.node_id] = r.progress })

    for (const team of (teams||[])) {
      const activeSystem = activeSystemByTeam[team.id] || 'motion'
      const key = `${team.id}|${activeSystem}`
      const focusNodeId = focusByKey[key]
      const progressByNodeId = progressByKey[key] || {}
      const focusNode = focusNodeId ? nodesForSystem(activeSystem).find(n=>n.id===focusNodeId) : null
      const focusValid = focusNode && (progressByNodeId[focusNode.id]||0) < 100 && isNodeUnlocked(focusNode, progressByNodeId)
      if (!focusValid) {
        const lang = await getTeamLang(team.id)
        const notif = notifTacticalFocusNeeded(lang, activeSystem)
        await notify(team.id, 'reminder', notif.subject, notif.body, { system: activeSystem })
      }
    }
  }

  // ── 17. GM INACTIVITY ────────────────────────────────
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('team_id,display_name,last_seen')
    .not('team_id','is',null)
    .not('last_seen','is',null)

  const now = new Date()
  for (const profile of (allProfiles||[])) {
    const lastSeen = new Date(profile.last_seen)
    const daysSinceActive = Math.floor((now.getTime() - lastSeen.getTime()) / (1000*60*60*24))
    if (daysSinceActive >= 7) {
      const lang = await getTeamLang(profile.team_id)
      const notif = notifGMInactivity(lang, profile.display_name || 'GM', daysSinceActive)
      await notify(profile.team_id, 'reminder', notif.subject, notif.body, { days_inactive: daysSinceActive })
    }
  }

  return { notificationsSent: true }
}

// ═══════════════════════════════════════════════════════════
// ADDITIONAL NOTIFICATION HELPERS (called from other routes)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// FREE AGENCY — notify teams that lost the FA race
// ═══════════════════════════════════════════════════════════
export async function notifyFALosers(
  playerId: number,
  playerName: string,
  winningTeamId: string,
  losingTeamIds: string[]
) {
  for (const teamId of losingTeamIds) {
    if (teamId === winningTeamId) continue
    await notify(
      teamId,
      'fa',
      `❌ Missed out on ${playerName}`,
      `${playerName} has signed elsewhere. Your offer was not selected this time — keep an eye on the free agent pool for other opportunities.`,
      { player_id: playerId, winning_team_id: winningTeamId }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// TRADES — accepted / rejected / player arrival
// ═══════════════════════════════════════════════════════════
export async function notifyTradeProposed(
  proposalId: string,
  teamId: string,
  initiatorTeamName: string,
  sendNames: string,
  recvNames: string,
  notes?: string
) {
  await notify(
    teamId,
    'trade',
    `🔄 Trade proposal from ${initiatorTeamName}`,
    `${initiatorTeamName} has proposed a trade.\n→ You send: ${sendNames || 'picks only'}\n← You receive: ${recvNames || 'picks only'}${notes ? `\n\n"${notes}"` : ''}\n\nReview and respond from the Trade Center.`,
    { proposal_id: proposalId }
  )
}

export async function notifyTradeAccepted(
  proposalId: string,
  initiatorTeamId: string,
  respondingTeamId: string,
  respondingTeamName: string
) {
  await notify(
    initiatorTeamId,
    'trade',
    `✅ Trade accepted by ${respondingTeamName}`,
    `Your trade proposal has been accepted by ${respondingTeamName}. The trade has been processed — check your roster for the updated players.`,
    { proposal_id: proposalId }
  )
}

export async function notifyTradeRejected(
  proposalId: string,
  initiatorTeamId: string,
  respondingTeamId: string,
  respondingTeamName: string,
  reason?: string
) {
  await notify(
    initiatorTeamId,
    'trade',
    `❌ Trade rejected by ${respondingTeamName}`,
    `Your trade proposal has been rejected by ${respondingTeamName}.${reason ? `\n\nReason: ${reason}` : ''}\n\nYou can submit a revised offer or look for other trade partners.`,
    { proposal_id: proposalId }
  )
}

export async function notifyPlayerArrival(
  teamId: string,
  playerName: string,
  fromTeamName: string
) {
  await notify(
    teamId,
    'trade',
    `🤝 ${playerName} has joined your team!`,
    `${playerName} has arrived via trade from ${fromTeamName}. They're now on your active roster — review your depth chart to integrate them into your rotation.`,
    { player_name: playerName }
  )
}

// ═══════════════════════════════════════════════════════════
// AWARDS & ALL-STAR
// ═══════════════════════════════════════════════════════════
export async function notifyAllStarSelection(
  teamId: string,
  playerName: string,
  conference: 'eastern' | 'western'
) {
  await notify(
    teamId,
    'awards',
    `⭐ ${playerName} selected as All-Star!`,
    `Congratulations! ${playerName} has been selected for the ${conference === 'eastern' ? 'Eastern' : 'Western'} Conference All-Star team. A great honour for your franchise.`,
    { player_name: playerName, conference }
  )
}

const AWARD_LABELS: Record<string, string> = {
  mvp: 'Most Valuable Player',
  dpoy: 'Defensive Player of the Year',
  roy: 'Rookie of the Year',
  coy: 'Coach of the Year',
  mip: 'Most Improved Player',
  finals_mvp: 'Finals MVP',
  all_nba_1: '1st Team All-NBA',
  all_nba_2: '2nd Team All-NBA',
  all_nba_3: '3rd Team All-NBA',
  all_rookie_1: '1st Rookie Team',
  all_rookie_2: '2nd Rookie Team',
}

export async function notifySeasonAward(
  teamId: string,
  playerName: string,
  awardType: string
) {
  const label = AWARD_LABELS[awardType] || awardType
  await notify(
    teamId,
    'awards',
    `🏆 ${playerName} wins ${label}!`,
    `${playerName} has been awarded ${label} for the 2025-26 season. A landmark achievement for your franchise.`,
    { player_name: playerName, award_type: awardType }
  )
}

// ═══════════════════════════════════════════════════════════
// PLAYOFFS & SEASON END
// ═══════════════════════════════════════════════════════════
export async function notifyPlayoffElimination(
  teamId: string,
  eliminatedBy: string,
  round: string
) {
  await notify(
    teamId,
    'standings',
    `🏁 Eliminated from the playoffs`,
    `Your season has come to an end — eliminated by ${eliminatedBy} in the ${round}. Time to regroup and start planning for next season: free agency, the draft, and roster moves are ahead.`,
    { eliminated_by: eliminatedBy, round }
  )
}

export async function notifyChampionship(teamId: string, opponentName: string) {
  await notify(
    teamId,
    'standings',
    `🏆 CHAMPIONS! 🏆`,
    `Congratulations — your team has won the championship, defeating ${opponentName}! A historic achievement for the franchise.`,
    { opponent: opponentName }
  )
}

export async function notifyRunnerUp(teamId: string, championName: string) {
  await notify(
    teamId,
    'standings',
    `🥈 Runner-Up`,
    `Your team made it to the Finals but fell short, losing to ${championName}. A strong season overall — building blocks are in place for another run.`,
    { champion: championName }
  )
}

// ═══════════════════════════════════════════════════════════
// DRAFT
// ═══════════════════════════════════════════════════════════
export async function notifyDraftPickMade(
  teamId: string,
  pickNumber: number,
  round: number,
  prospectName: string
) {
  await notify(
    teamId,
    'fa',
    `🎓 Draft Pick #${pickNumber}: ${prospectName}`,
    `With the #${pickNumber} pick (Round ${round}), your team has selected ${prospectName}. They've been added to your roster — check their full attribute breakdown on their player page.`,
    { pick_number: pickNumber, round, prospect_name: prospectName }
  )
}

// ═══════════════════════════════════════════════════════════
// CAP SPACE WARNINGS
// ═══════════════════════════════════════════════════════════
export async function notifyCapSpaceCritical(
  teamId: string,
  capUsed: number,
  capLimit: number
) {
  const remaining = capLimit - capUsed
  await notify(
    teamId,
    'contract',
    `⚠️ Cap space critically low`,
    `Your team has only $${(remaining / 1_000_000).toFixed(1)}M in cap space remaining (${((capUsed / capLimit) * 100).toFixed(0)}% of the $${(capLimit / 1_000_000).toFixed(0)}M cap used). Be careful with further signings — you may need to make a roster move to stay compliant.`,
    { cap_used: capUsed, cap_limit: capLimit, remaining }
  )
}

export async function notifyCapSpaceForRosterMinimum(
  teamId: string,
  rosterSize: number,
  capSpace: number,
  minRoster: number
) {
  const spotsNeeded = minRoster - rosterSize
  await notify(
    teamId,
    'contract',
    `⚠️ Risk of falling below roster minimum`,
    `Your team has ${rosterSize} players and only $${(capSpace / 1_000_000).toFixed(1)}M in cap space. You need ${spotsNeeded} more player${spotsNeeded !== 1 ? 's' : ''} to reach the ${minRoster}-player minimum, and your remaining cap space may not be enough to sign them all at minimum salary.`,
    { roster_size: rosterSize, cap_space: capSpace }
  )
}

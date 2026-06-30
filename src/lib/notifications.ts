import { createClient } from '@supabase/supabase-js'
import { getTeamLang, clearLangCache, notifWeeklyResults, notifInjury, notifPlayoffBubble, notifDroppedOutPlayoffs, notifLeadingConference, notifWinStreak, notifLossStreak, notifRivalWin, notifDevelopment, notifLowMorale, notifContractExpiring, notifArenaConstruction, notifTrainingCredits, notifOrdersReminder, notifSponsorPayment, notifSeasonEnd, notifGMInactivity, notifAward, notifCapCritical, notifRosterMinimumRisk } from './notifications-helpers'

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

export async function runPostSimNotifications(week: number, gamesCreated: string[]) {
  const [
    { data: teams },
    { data: profiles },
    { data: games },
    { data: injuries },
    { data: players },
    { data: glBoxes },
    { data: awards },
    { data: contracts },
    { data: sponsorContracts },
    { data: constructions },
  ] = await Promise.all([
    supabase.from('teams').select('id,name,wins,losses,conference,rival_team_id,cap_used').not('id','in','(ALL,RVS,ROO,SOP)'),
    supabase.from('profiles').select('team_id,email,full_name').not('team_id','is',null),
    supabase.from('games').select('*,home:teams!games_home_team_fkey(name),away:teams!games_away_team_fkey(name)').in('id', gamesCreated),
    supabase.from('injury_log').select('*,players!inner(name,team_id)').eq('season','2025-26').eq('status','active').in('game_id', gamesCreated),
    supabase.from('players').select('id,name,team_id,real_ovr,moral,age,contract_years_left,salary').eq('status','active').not('team_id','is',null),
    supabase.from('gleague_player_stats').select('*,players!inner(name,team_id,on_gleague_assignment)').eq('season','2025-26').in('game_id', gamesCreated ?? []),
    supabase.from('awards').select('*,players!inner(name,team_id)').eq('season','2025-26').in('period',[`week_${week}`]),
    supabase.from('players').select('id,name,team_id,contract_years_left,salary').eq('status','active').not('team_id','is',null).lte('contract_years_left',1),
    supabase.from('sponsor_contracts').select('*,template:sponsor_templates(company_name,tier)').eq('season','2025-26').eq('status','active'),
    supabase.from('arena_sections').select('team_id,section,construction_ends_at,under_construction').eq('under_construction',true),
  ])

  const profileMap: Record<string,any> = {}
  ;(profiles||[]).forEach((p:any) => { if(p.team_id) profileMap[p.team_id] = p })

  const teamMap: Record<string,any> = {}
  ;(teams||[]).forEach((t:any) => teamMap[t.id] = t)

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
      ? `Resultados da semana ${week}:\n\n${results.join('\n')}\n\nRegisto da época: ${team.wins}V-${team.losses}D`
      : `Your week ${week} results:\n\n${results.join('\n')}\n\nSeason record: ${team.wins}W-${team.losses}L`

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
      const notif = notifInjury(lang, inj.players?.name, inj.injury_type, inj.games_out)
      const recurring = inj.is_recurring ? (lang === 'pt' ? '\n⚠️ Esta é uma lesão recorrente.' : '\n⚠️ This is a recurring injury.') : ''
      const bodyPart = lang === 'pt' ? `Zona afetada: ${inj.body_part}\nRecuperação estimada: ${inj.games_out} jogos (aprox. ${Math.ceil(inj.games_out/4)} semanas)${recurring}` : `Body part: ${inj.body_part}\nEstimated recovery: ${inj.games_out} games (approx. ${Math.ceil(inj.games_out/4)} weeks)${recurring}`
      await notify(teamId, 'injury', `${emoji} ${notif.subject.replace('🏥 Injury — ', '').replace('🏥 Lesão — ', '')}`, `${notif.body}\n\n${bodyPart}`, { player_id: inj.player_id, injury_type: inj.injury_type, severity, games_out: inj.games_out })
    }
  }

  // ── 3. PLAYOFF POSITION CHANGES ───────────────────────
  for (const team of (teams||[])) {
    const confTeams = (teams||[])
      .filter((t:any) => t.conference === team.conference)
      .sort((a:any,b:any) => b.wins - a.wins)
    const rank = confTeams.findIndex((t:any) => t.id === team.id) + 1
    const lang = await getTeamLang(team.id)

    if (rank === 8) {
      const notif = notifPlayoffBubble(lang, team.conference, rank)
      await notify(team.id, 'standings', notif.subject, notif.body, { rank })
    } else if (rank === 9) {
      const notif = notifDroppedOutPlayoffs(lang, team.conference)
      await notify(team.id, 'standings', notif.subject, notif.body, { rank })
    } else if (rank === 1) {
      const notif = notifLeadingConference(lang, team.conference, team.wins, team.losses)
      await notify(team.id, 'standings', notif.subject, notif.body, { rank })
    }
  }

  // ── 4. WIN/LOSS STREAKS ────────────────────────────────
  for (const team of (teams||[])) {
    const teamGames = (games||[])
      .filter((g:any) => g.home_team === team.id || g.away_team === team.id)
      .sort((a:any,b:any) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
      .slice(0,5)

    let streak = 0, streakType = ''
    for (const g of teamGames) {
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

    if (team.rival_team_id) {
      const rivalGame = teamGames.find((g:any) =>
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
  const lowMoralePlayers = (players||[]).filter((p:any) => p.moral < 40)
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
  if (week === 18) { // ~8 weeks before end of season
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

  // ── 8. ARENA CONSTRUCTION COMPLETED ──────────────────
  for (const section of (constructions||[])) {
    const endDate = new Date(section.construction_ends_at)
    const today = new Date()
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000*60*60*24))
    const lang = await getTeamLang(section.team_id)
    const notif = notifArenaConstruction(lang, section.section, daysLeft <= 0)
    if (daysLeft <= 0) {
      await notify(section.team_id, 'construction', notif.subject, notif.body, { section: section.section })
      await supabase.from('arena_sections').update({ under_construction: false }).eq('team_id', section.team_id).eq('section', section.section)
    } else if (daysLeft <= 7) {
      await notify(section.team_id, 'construction', notif.subject, notif.body, { section: section.section, days_left: daysLeft })
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
      ? `O ${award.players?.name} foi nomeado Jogador da Semana ${week} da Conferência ${conf === 'Eastern' ? 'Este' : 'Oeste'}.\n\nEstatísticas: ${stats} em ${award.stats_context?.games} jogos.`
      : `${award.players?.name} has been named ${conf} Conference Player of the Week for Week ${week}.\n\nStats: ${stats} in ${award.stats_context?.games} games.`
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
      const lang = await getTeamLang(contract.team_id)
      const notif = notifSponsorPayment(lang, contract.fixed_monthly)
      await notify(contract.team_id, 'sponsor', notif.subject, notif.body, { amount: contract.fixed_monthly, company: (contract.template as any)?.company_name })
      await supabase.rpc('increment_balance', { p_team_id: contract.team_id, p_amount: contract.fixed_monthly })
      await supabase.from('franchise_transactions').insert({
        team_id: contract.team_id, type: 'revenue', category: 'sponsor',
        amount: contract.fixed_monthly,
        description: `Monthly sponsor payment — ${(contract.template as any)?.company_name}`,
        season: '2025-26', week_number: week,
      })
    }
  }

  // ── 12. SEASON END APPROACHING ────────────────────────
  if (week === 22) {
    for (const team of (teams||[])) {
      const lang = await getTeamLang(team.id)
      const notif = notifSeasonEnd(lang, 4)
      await notify(team.id, 'reminder', notif.subject, notif.body, { weeks_left: 4 })
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

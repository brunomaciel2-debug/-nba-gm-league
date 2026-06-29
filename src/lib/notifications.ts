import { createClient } from '@supabase/supabase-js'

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
    supabase.from('teams').select('id,name,wins,losses,conference,rival_team_id').not('id','in','(ALL,RVS,ROO,SOP)'),
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

    await notify(
      team.id,
      'results',
      `📊 Week ${week} Results — ${wins}W ${losses}L`,
      `Your week ${week} results:\n\n${results.join('\n')}\n\nSeason record: ${team.wins}W-${team.losses}L`,
      { week, wins, losses }
    )
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
    for (const inj of teamInjuries) {
      const severity = inj.severity
      const emoji = severity === 'career_threatening' ? '🚨' : severity === 'severe' ? '🔴' : severity === 'serious' ? '🟠' : '🟡'
      await notify(
        teamId,
        'injury',
        `${emoji} Injury Alert — ${inj.players?.name}`,
        `${inj.players?.name} has suffered a ${inj.injury_type} (${severity}).\n\nBody part: ${inj.body_part}\nEstimated recovery: ${inj.games_out} games (approx. ${Math.ceil(inj.games_out/4)} weeks)\n${inj.is_recurring ? '⚠️ This is a recurring injury.' : ''}`,
        { player_id: inj.player_id, injury_type: inj.injury_type, severity, games_out: inj.games_out }
      )
    }
  }

  // ── 3. PLAYOFF POSITION CHANGES ───────────────────────
  for (const team of (teams||[])) {
    const confTeams = (teams||[])
      .filter((t:any) => t.conference === team.conference)
      .sort((a:any,b:any) => b.wins - a.wins)
    const rank = confTeams.findIndex((t:any) => t.id === team.id) + 1

    if (rank === 8) {
      await notify(team.id, 'standings', '⚠️ You are on the playoff bubble', `You are currently #8 in the ${team.conference} Conference — the last playoff spot. One bad week could drop you to the play-in.`, { rank })
    } else if (rank === 9) {
      await notify(team.id, 'standings', '📉 You dropped out of the playoffs', `You are currently #9 in the ${team.conference} Conference. You need to win games urgently to get back into playoff position.`, { rank })
    } else if (rank === 1) {
      await notify(team.id, 'standings', '🥇 You lead your conference!', `You are #1 in the ${team.conference} Conference with a ${team.wins}-${team.losses} record. Keep it up.`, { rank })
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

    if (streak >= 5 && streakType === 'W') {
      await notify(team.id, 'streak', `🔥 ${streak}-game winning streak!`, `The ${team.name} are on fire with ${streak} consecutive wins. Your team is building momentum — this is the time to stay aggressive.`, { streak, type: 'win' })
    } else if (streak >= 5 && streakType === 'L') {
      await notify(team.id, 'streak', `❄️ ${streak}-game losing streak`, `The ${team.name} have lost ${streak} games in a row. Consider adjusting your weekly orders, rotation or making a move to shake things up.`, { streak, type: 'loss' })
    }

    // Rival defeated notification
    if (team.rival_team_id) {
      const rivalGame = teamGames.find((g:any) =>
        (g.home_team===team.id&&g.away_team===team.rival_team_id)||(g.away_team===team.id&&g.home_team===team.rival_team_id)
      )
      if (rivalGame) {
        const won = (rivalGame.home_team===team.id&&rivalGame.home_score>rivalGame.away_score)||(rivalGame.away_team===team.id&&rivalGame.away_score>rivalGame.home_score)
        const rival = teamMap[team.rival_team_id]
        if (won) {
          await notify(team.id, 'rivalry', `⚔️ Rivalry win vs ${rival?.name}!`, `You defeated your rival ${rival?.name} this week. Check your sponsor objectives — this may have triggered a bonus!`, { rival_id: team.rival_team_id })
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
    const summary = logs.map((l:any) => `${l.players?.name}: +${l.change} ${l.attribute}`).join('\n')
    await notify(teamId, 'development', `📈 Player development this week`, `Notable improvements from your roster this week:\n\n${summary}`, { logs })
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
    if (daysLeft <= 0) {
      await notify(section.team_id, 'construction', `🏗️ Construction completed — Section ${section.section}`, `Section ${section.section} construction has been completed. Your arena capacity has increased!`, { section: section.section })
      await supabase.from('arena_sections').update({ under_construction: false }).eq('team_id', section.team_id).eq('section', section.section)
    } else if (daysLeft <= 7) {
      await notify(section.team_id, 'construction', `🏗️ Construction almost done — Section ${section.section}`, `Section ${section.section} will be ready in ${daysLeft} days.`, { section: section.section, days_left: daysLeft })
    }
  }

  // ── 9. PLAYER OF THE WEEK ─────────────────────────────
  for (const award of (awards||[])) {
    if (!award.award_type?.startsWith('potw_')) continue
    const teamId = award.players?.team_id
    if (!teamId) continue
    const conf = award.award_type.includes('eastern') ? 'Eastern' : 'Western'
    await notify(teamId, 'award', `🌟 Player of the Week — ${award.players?.name}!`, `${award.players?.name} has been named ${conf} Conference Player of the Week for Week ${week}.\n\nStats: ${award.stats_context?.ppg} PPG · ${award.stats_context?.rpg} RPG · ${award.stats_context?.apg} APG in ${award.stats_context?.games} games.`, { player_id: award.player_id, award_type: award.award_type })
  }

  // ── 10. WEEKLY ORDERS DEADLINE REMINDER ───────────────
  // Notify every week — orders for next week close in 3 days
  for (const team of (teams||[])) {
    if (week % 2 === 0) { // Every other week to avoid spam
      await notify(team.id, 'reminder', `⏰ Weekly orders due — Week ${week + 1}`, `Don't forget to submit your weekly orders for Week ${week + 1}. Set your rotation, training intensity and pace before the deadline.`, { week: week + 1 })
    }
  }

  // ── 11. SPONSOR MONTHLY PAYMENT ───────────────────────
  if (week % 4 === 0) { // Monthly
    for (const contract of (sponsorContracts||[])) {
      await notify(contract.team_id, 'sponsor', `💰 Monthly sponsor payment received`, `Your ${(contract.template as any)?.company_name} ${(contract.template as any)?.tier} sponsor has paid ${fmt(contract.fixed_monthly)} this month. Amount credited to your balance.`, { amount: contract.fixed_monthly, company: (contract.template as any)?.company_name })
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
      await notify(team.id, 'reminder', `🏁 4 weeks left in the regular season`, `The regular season ends in 4 weeks. Make your final push for the playoffs — or position yourself for the best draft pick. Check your sponsor objectives and expiring contracts.`, { weeks_left: 4 })
    }
  }

  // ── 13. TRAINING CREDITS FULL ────────────────────────
  // Notify when any slot has credits available (= slot was full and earned credits)
  const { data: trainingSlots } = await supabase
    .from('training_slots')
    .select('team_id,slot_type,credits_available')
    .eq('locked', false)
    .gt('credits_available', 0)

  // Group by team
  const trainingByTeam: Record<string, any[]> = {}
  for (const slot of (trainingSlots||[])) {
    if (!trainingByTeam[slot.team_id]) trainingByTeam[slot.team_id] = []
    trainingByTeam[slot.team_id].push(slot)
  }

  for (const [teamId, readySlots] of Object.entries(trainingByTeam)) {
    const totalCredits = readySlots.reduce((s: number, sl: any) => s + sl.credits_available, 0)
    const slotNames = readySlots.map((sl: any) => {
      const labels: Record<string,string> = { offense:'Offense', defense:'Defense', physical:'Physical', playmaking:'Playmaking', mental:'Mental', recovery:'Recovery', shooting:'Shooting Lab', analytics:'Analytics' }
      return `${labels[sl.slot_type]||sl.slot_type} (${sl.credits_available}cr)`
    }).join(', ')

    await notify(
      teamId,
      'training',
      `🏋️ Training credits ready — ${totalCredits} credits to spend!`,
      `You have ${totalCredits} training credits available across ${readySlots.length} slot${readySlots.length > 1 ? 's' : ''}:\n\n${slotNames}\n\nSpend them in the Training tab to develop your players. Slots won't fill further until you spend — don't waste the capacity!`,
      { total_credits: totalCredits, slots: readySlots.length }
    )
  }

  // ── 14. GM INACTIVITY ────────────────────────────────
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
      await notify(
        profile.team_id,
        'reminder',
        `⚠️ You haven't been active for ${daysSinceActive} days`,
        `Hi ${profile.display_name || 'GM'} — you haven't logged in for ${daysSinceActive} days.\n\nYour team needs attention:\n• Weekly orders may be missing\n• Training credits may be full\n• Sponsor opportunities may be waiting\n\nLog in and check your franchise!`,
        { days_inactive: daysSinceActive }
      )
    }
  }

  return { notificationsSent: true }
}

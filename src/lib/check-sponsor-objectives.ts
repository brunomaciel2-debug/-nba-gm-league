import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendEmail(to: string, subject: string, html: string) {
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'NBA GM League', email: 'noreply@nbagmleague.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
}

function fmtM(n: number) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M'
  if (n >= 1000) return '$' + (n/1000).toFixed(0) + 'K'
  return '$' + n
}

export async function checkSponsorObjectives() {
  const { data: trackings } = await supabase
    .from('sponsor_objective_tracking')
    .select(`*, objective:sponsor_objectives(*), contract:sponsor_contracts(*, template:sponsor_templates(*))`)
    .eq('season', '2025-26')
    .eq('achieved', false)

  if (!trackings?.length) return { checked: 0, achieved: 0 }

  // Pre-fetch all teams for rival lookup
  const { data: allTeams } = await supabase.from('teams').select('id,name,rival_team_id,wins,losses,division')
  const teamMap: Record<string, any> = {}
  ;(allTeams||[]).forEach((t:any) => teamMap[t.id] = t)

  let achieved = 0

  for (const tracking of trackings) {
    const obj = tracking.objective
    const teamId = tracking.team_id
    if (!obj) continue

    let currentValue = 0
    let isAchieved = false

    switch (obj.objective_type) {

      case 'wins_total': {
        const { data: games } = await supabase.from('games')
          .select('id,home_team,away_team,home_score,away_score')
          .eq('season','2025-26').eq('status','final')
          .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
        currentValue = (games||[]).filter(g=>
          (g.home_team===teamId&&g.home_score>g.away_score)||
          (g.away_team===teamId&&g.away_score>g.home_score)
        ).length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'wins_home_total': {
        const { data: games } = await supabase.from('games')
          .select('home_score,away_score')
          .eq('season','2025-26').eq('status','final')
          .eq('home_team', teamId)
        currentValue = (games||[]).filter(g=>g.home_score>g.away_score).length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'wins_streak': {
        const { data: games } = await supabase.from('games')
          .select('home_team,away_team,home_score,away_score,played_at')
          .eq('season','2025-26').eq('status','final')
          .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
          .order('played_at', {ascending:false})
        let streak = 0, maxStreak = 0
        for (const g of (games||[])) {
          const won = (g.home_team===teamId&&g.home_score>g.away_score)||(g.away_team===teamId&&g.away_score>g.home_score)
          if (won) { streak++; maxStreak=Math.max(maxStreak,streak) } else streak=0
        }
        currentValue = maxStreak
        isAchieved = maxStreak >= obj.threshold
        break
      }

      case 'wins_home_streak': {
        const { data: games } = await supabase.from('games')
          .select('home_score,away_score,played_at')
          .eq('season','2025-26').eq('status','final')
          .eq('home_team', teamId)
          .order('played_at', {ascending:false})
        let streak = 0, maxStreak = 0
        for (const g of (games||[])) {
          if (g.home_score>g.away_score) { streak++; maxStreak=Math.max(maxStreak,streak) } else streak=0
        }
        currentValue = maxStreak
        isAchieved = maxStreak >= obj.threshold
        break
      }

      case 'wins_rivalry': {
        const rival = teamMap[teamId]?.rival_team_id
        if (!rival) break
        const { data: games } = await supabase.from('games')
          .select('home_score,away_score,home_team,away_team')
          .eq('season','2025-26').eq('status','final')
          .or(`and(home_team.eq.${teamId},away_team.eq.${rival}),and(home_team.eq.${rival},away_team.eq.${teamId})`)
        currentValue = (games||[]).filter(g=>
          (g.home_team===teamId&&g.home_score>g.away_score)||
          (g.away_team===teamId&&g.away_score>g.home_score)
        ).length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'wins_vs_top5': {
        // Top 5 teams by wins
        const sorted = (allTeams||[])
          .filter((t:any)=>!['ALL','RVS','ROO','SOP'].includes(t.id)&&t.id!==teamId)
          .sort((a:any,b:any)=>b.wins-a.wins).slice(0,5).map((t:any)=>t.id)
        let winsVsTop = 0
        for (const oppId of sorted) {
          const { data: games } = await supabase.from('games')
            .select('home_score,away_score,home_team,away_team')
            .eq('season','2025-26').eq('status','final')
            .or(`and(home_team.eq.${teamId},away_team.eq.${oppId}),and(home_team.eq.${oppId},away_team.eq.${teamId})`)
          winsVsTop += (games||[]).filter(g=>
            (g.home_team===teamId&&g.home_score>g.away_score)||
            (g.away_team===teamId&&g.away_score>g.home_score)
          ).length
        }
        currentValue = winsVsTop
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'win_margin': {
        const { data: games } = await supabase.from('games')
          .select('home_score,away_score,home_team,away_team')
          .eq('season','2025-26').eq('status','final')
          .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
        const bigWins = (games||[]).filter(g=>{
          const ts = g.home_team===teamId?g.home_score:g.away_score
          const os = g.home_team===teamId?g.away_score:g.home_score
          return ts-os >= 20
        })
        currentValue = bigWins.length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'wins_by_double_digits': {
        const { data: games } = await supabase.from('games')
          .select('home_score,away_score,home_team,away_team')
          .eq('season','2025-26').eq('status','final')
          .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
        const ddWins = (games||[]).filter(g=>{
          const ts = g.home_team===teamId?g.home_score:g.away_score
          const os = g.home_team===teamId?g.away_score:g.home_score
          return ts-os >= 10
        })
        currentValue = ddWins.length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'attendance_avg': {
        const { data: games } = await supabase.from('games')
          .select('attendance,home_score,away_score')
          .eq('season','2025-26').eq('status','final')
          .eq('home_team', teamId)
          .not('attendance','is',null)
        if (games?.length) {
          const { data: ff } = await supabase.from('franchise_finances')
            .select('*').eq('team_id',teamId).single()
          const cap = (ff as any)?.arena_capacity || 18000
          const avg = (games||[]).reduce((t,g)=>t+((g.attendance||0)/cap*100),0)/games.length
          currentValue = Math.round(avg)
          isAchieved = currentValue >= obj.threshold
        }
        break
      }

      case 'top_conference': {
        const team = teamMap[teamId]
        const conf = team?.conference
        const confTeams = (allTeams||[])
          .filter((t:any)=>t.conference===conf&&!['ALL','RVS','ROO','SOP'].includes(t.id))
          .sort((a:any,b:any)=>b.wins-a.wins)
        const rank = confTeams.findIndex((t:any)=>t.id===teamId) + 1
        currentValue = rank || 99
        isAchieved = rank > 0 && rank <= obj.threshold
        break
      }

      case 'top_division': {
        const team = teamMap[teamId]
        const div = team?.division
        const divTeams = (allTeams||[])
          .filter((t:any)=>t.division===div&&!['ALL','RVS','ROO','SOP'].includes(t.id))
          .sort((a:any,b:any)=>b.wins-a.wins)
        const rank = divTeams.findIndex((t:any)=>t.id===teamId) + 1
        currentValue = rank || 99
        isAchieved = rank > 0 && rank <= obj.threshold
        break
      }

      case 'reach_playoffs': {
        const team = teamMap[teamId]
        const conf = team?.conference
        const confTeams = (allTeams||[])
          .filter((t:any)=>t.conference===conf&&!['ALL','RVS','ROO','SOP'].includes(t.id))
          .sort((a:any,b:any)=>b.wins-a.wins)
        const rank = confTeams.findIndex((t:any)=>t.id===teamId) + 1
        isAchieved = rank > 0 && rank <= 8
        currentValue = isAchieved ? 1 : 0
        break
      }

      case 'reach_conf_finals': {
        const { data: playoff } = await supabase.from('playoff_results')
          .select('round_reached').eq('team_id',teamId).eq('season','2025-26').single()
        isAchieved = (playoff?.round_reached||0) >= 3
        currentValue = playoff?.round_reached || 0
        break
      }

      case 'reach_finals': {
        const { data: playoff } = await supabase.from('playoff_results')
          .select('round_reached').eq('team_id',teamId).eq('season','2025-26').single()
        isAchieved = (playoff?.round_reached||0) >= 4
        currentValue = playoff?.round_reached || 0
        break
      }

      case 'champion': {
        const { data: playoff } = await supabase.from('playoff_results')
          .select('champion').eq('team_id',teamId).eq('season','2025-26').single()
        isAchieved = playoff?.champion === true
        currentValue = isAchieved ? 1 : 0
        break
      }

      case 'ppg_avg': {
        const { data: boxes } = await supabase.from('box_scores')
          .select('pts,game_id,games!inner(home_team,away_team,season)')
          .eq('games.season','2025-26')
          .eq('team_id', teamId)
        if (boxes?.length) {
          const gameIds = [...new Set((boxes||[]).map((b:any)=>b.game_id))]
          const totalPts = (boxes||[]).reduce((t:number,b:any)=>t+(b.pts||0),0)
          currentValue = Math.round(totalPts / Math.max(1,gameIds.length))
          isAchieved = currentValue >= obj.threshold
        }
        break
      }

      case 'top_scorer_count': {
        const { data: stats } = await supabase.from('player_stats')
          .select('player_id,pts,games').eq('season','2025-26').gte('games',20)
        const { data: roster } = await supabase.from('players').select('id').eq('team_id',teamId)
        const rosterIds = new Set((roster||[]).map((p:any)=>p.id))
        const scorers = (stats||[])
          .map((s:any)=>({id:s.player_id,ppg:s.pts/Math.max(1,s.games)}))
          .filter((s:any)=>rosterIds.has(s.id)&&s.ppg>=20)
        currentValue = scorers.length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'player_allstar': {
        const { data: allstars } = await supabase.from('awards')
          .select('player_id').eq('season','2025-26')
          .in('award_type',['all_star_east','all_star_west','potm_eastern','potm_western'])
        const { data: roster } = await supabase.from('players').select('id').eq('team_id',teamId)
        const rosterIds = new Set((roster||[]).map((p:any)=>p.id))
        currentValue = (allstars||[]).filter(a=>rosterIds.has(a.player_id)).length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'player_ovr_improvement': {
        const { data: players } = await supabase.from('players')
          .select('id,real_ovr,ovr_start_season').eq('team_id',teamId)
        const improvements = (players||[]).map((p:any)=>(p.real_ovr||0)-(p.ovr_start_season||p.real_ovr||0))
        currentValue = improvements.length ? Math.max(...improvements) : 0
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'no_major_injury': {
        const { data: roster } = await supabase.from('players').select('id').eq('team_id',teamId)
        const rosterIds = new Set((roster||[]).map((p:any)=>p.id))
        const { data: injuries } = await supabase.from('injury_log')
          .select('games_out,player_id').eq('season','2025-26')
        const major = (injuries||[]).filter(i=>rosterIds.has(i.player_id)&&i.games_out>=obj.threshold)
        isAchieved = major.length === 0
        currentValue = isAchieved ? 1 : 0
        break
      }

      case 'jumbotron_built': {
        const { data: arena } = await supabase.from('arena_concessions')
          .select('jumbotron').eq('team_id',teamId).single()
        isAchieved = (arena?.jumbotron||0) > 0
        currentValue = isAchieved ? 1 : 0
        break
      }

      case 'concessions_built': {
        const { data: arena } = await supabase.from('arena_concessions').select('*').eq('team_id',teamId).single()
        if (arena) {
          const fields = ['food_stall_basic_north','food_stall_basic_south','food_stall_basic_east',
            'food_stall_basic_west','food_stall_premium_north','food_stall_premium_south',
            'bar_east','bar_west','vending_north','vending_south','vending_east','vending_west',
            'restaurant_vip','franchise_store','corporate_suites','club_seats',
            'courtside_lounge','jumbotron','fan_zone','mascot']
          currentValue = fields.reduce((t,f)=>t+((arena as any)[f]||0),0)
          isAchieved = currentValue >= obj.threshold
        }
        break
      }

      case 'fan_satisfaction': {
        const { data: ff } = await supabase.from('franchise_finances')
          .select('fan_satisfaction').eq('team_id',teamId).single()
        currentValue = ff?.fan_satisfaction || 0
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'cap_utilization': {
        const { data: players } = await supabase.from('players')
          .select('salary').eq('team_id',teamId).eq('status','active')
        const totalSalary = (players||[]).reduce((t:number,p:any)=>t+(p.salary||0),0)
        const salaryCap = 140000000
        currentValue = Math.round((totalSalary/salaryCap)*100)
        isAchieved = currentValue >= obj.threshold
        break
      }

      default:
        continue
    }

    // Update progress
    await supabase.from('sponsor_objective_tracking')
      .update({ current_value: currentValue, ...(isAchieved ? { achieved: true, achieved_at: new Date().toISOString() } : {}) })
      .eq('id', tracking.id)

    if (isAchieved) {
      achieved++
      const bonusAmount = obj.bonus_amount

      await supabase.from('franchise_transactions').insert({
        team_id: teamId, type: 'revenue', category: 'sponsor',
        amount: bonusAmount, description: `Sponsor bonus: ${obj.description}`,
        season: '2025-26', week_number: 99,
      })

      await supabase.rpc('increment_balance', { p_team_id: teamId, p_amount: bonusAmount })
      await supabase.from('sponsor_objective_tracking').update({ paid: true }).eq('id', tracking.id)

      const { data: gm } = await supabase.from('profiles')
        .select('email,full_name').eq('team_id', teamId).single()

      if (gm?.email) {
        const tierLabel = tracking.contract?.tier === 'jersey' ? 'Jersey Patch'
          : tracking.contract?.tier === 'court' ? 'Court Logo' : 'Courtside Panels'
        const companyName = tracking.contract?.template?.company_name || 'your sponsor'

        await sendEmail(
          gm.email,
          `🎉 Sponsor Bonus Achieved — ${fmtM(bonusAmount)} credited!`,
          `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <h2 style="color:#15803d;margin-bottom:8px;">Sponsor Bonus Achieved! 🏆</h2>
            <p>Hi ${gm.full_name || 'GM'},</p>
            <p>Congratulations! You've achieved a sponsor objective:</p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
              <div style="font-size:13px;color:#15803d;font-weight:600;margin-bottom:4px;">${tierLabel} · ${companyName}</div>
              <div style="font-size:15px;color:#1a1512;margin-bottom:8px;">✓ ${obj.description}</div>
              <div style="font-size:22px;font-weight:800;color:#15803d;">${fmtM(bonusAmount)} credited</div>
            </div>
            <p style="color:#5c554e;font-size:13px;">This amount has been added to your franchise balance automatically.</p>
            <p style="color:#8a8279;font-size:11px;">NBA GM League · 2025-26 Season</p>
          </div>`
        )
      }
    }
  }

  return { checked: trackings.length, achieved }
}

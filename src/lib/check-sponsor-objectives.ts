import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Send email via Brevo
async function sendEmail(to: string, subject: string, html: string) {
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
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
    .select(`
      *,
      objective:sponsor_objectives(*),
      contract:sponsor_contracts(*, template:sponsor_templates(*))
    `)
    .eq('season', '2025-26')
    .eq('achieved', false)

  if (!trackings?.length) return { checked: 0, achieved: 0 }

  let achieved = 0

  for (const tracking of trackings) {
    const obj = tracking.objective
    const teamId = tracking.team_id
    if (!obj) continue

    let currentValue = 0
    let isAchieved = false

    switch (obj.objective_type) {

      case 'wins_total': {
        const { data: wins } = await supabase.from('games')
          .select('id,home_team,away_team,home_score,away_score')
          .eq('season', '2025-26').eq('status', 'final')
          .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
        currentValue = (wins||[]).filter(g =>
          (g.home_team===teamId && g.home_score>g.away_score) ||
          (g.away_team===teamId && g.away_score>g.home_score)
        ).length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'wins_streak': {
        const { data: games } = await supabase.from('games')
          .select('id,home_team,away_team,home_score,away_score,played_at')
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
          .select('id,home_team,away_team,home_score,away_score,played_at')
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

      case 'attendance_avg': {
        const { data: games } = await supabase.from('games')
          .select('attendance,capacity')
          .eq('season','2025-26').eq('status','final')
          .eq('home_team', teamId)
        if (games?.length) {
          const avg = games.reduce((t,g)=>t+((g.attendance||0)/(g.capacity||1)*100),0)/games.length
          currentValue = Math.round(avg)
          isAchieved = currentValue >= obj.threshold
        }
        break
      }

      case 'top_conference': {
        const { data: standings } = await supabase.from('standings')
          .select('rank_conference')
          .eq('team_id', teamId).eq('season','2025-26').single()
        currentValue = standings?.rank_conference || 99
        isAchieved = currentValue <= obj.threshold
        break
      }

      case 'top_division': {
        const { data: standings } = await supabase.from('standings')
          .select('rank_division')
          .eq('team_id', teamId).eq('season','2025-26').single()
        currentValue = standings?.rank_division || 99
        isAchieved = currentValue <= obj.threshold
        break
      }

      case 'reach_playoffs': {
        const { data: standings } = await supabase.from('standings')
          .select('rank_conference')
          .eq('team_id', teamId).eq('season','2025-26').single()
        isAchieved = (standings?.rank_conference||99) <= 8
        currentValue = isAchieved ? 1 : 0
        break
      }

      case 'reach_conf_finals': {
        const { data: playoff } = await supabase.from('playoff_results')
          .select('round_reached')
          .eq('team_id', teamId).eq('season','2025-26').single()
        isAchieved = (playoff?.round_reached||0) >= 3
        currentValue = playoff?.round_reached || 0
        break
      }

      case 'reach_finals': {
        const { data: playoff } = await supabase.from('playoff_results')
          .select('round_reached')
          .eq('team_id', teamId).eq('season','2025-26').single()
        isAchieved = (playoff?.round_reached||0) >= 4
        currentValue = playoff?.round_reached || 0
        break
      }

      case 'champion': {
        const { data: playoff } = await supabase.from('playoff_results')
          .select('champion')
          .eq('team_id', teamId).eq('season','2025-26').single()
        isAchieved = playoff?.champion === true
        currentValue = isAchieved ? 1 : 0
        break
      }

      case 'ppg_avg': {
        const { data: stats } = await supabase.from('team_stats')
          .select('ppg').eq('team_id', teamId).eq('season','2025-26').single()
        currentValue = stats?.ppg || 0
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'player_allstar': {
        const { data: allstars } = await supabase.from('awards')
          .select('player_id')
          .eq('season','2025-26')
          .in('award_type',['all_star_east','all_star_west'])
        const { data: roster } = await supabase.from('players')
          .select('id').eq('team_id', teamId)
        const rosterIds = (roster||[]).map((p:any)=>p.id)
        currentValue = (allstars||[]).filter(a=>rosterIds.includes(a.player_id)).length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'player_ovr_improvement': {
        const { data: players } = await supabase.from('players')
          .select('id,real_ovr,ovr_start_season')
          .eq('team_id', teamId)
        const maxImprovement = Math.max(...(players||[]).map((p:any)=>(p.real_ovr||0)-(p.ovr_start_season||0)))
        currentValue = maxImprovement
        isAchieved = maxImprovement >= obj.threshold
        break
      }

      case 'gleague_callup_games': {
        const { data: callups } = await supabase.from('gleague_callup_log')
          .select('games_played')
          .eq('team_id', teamId).eq('season','2025-26')
        const maxGames = Math.max(...(callups||[]).map((c:any)=>c.games_played||0), 0)
        currentValue = maxGames
        isAchieved = maxGames >= obj.threshold
        break
      }

      case 'jumbotron_built': {
        const { data: arena } = await supabase.from('arena_concessions')
          .select('jumbotron').eq('team_id', teamId).single()
        isAchieved = (arena?.jumbotron||0) > 0
        currentValue = isAchieved ? 1 : 0
        break
      }

      case 'fan_satisfaction': {
        const { data: ff } = await supabase.from('franchise_finances')
          .select('fan_satisfaction').eq('team_id', teamId).single()
        currentValue = ff?.fan_satisfaction || 0
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'cap_utilization': {
        const { data: cap } = await supabase.from('cap_room')
          .select('used,total').eq('team_id', teamId).single()
        if (cap) {
          currentValue = Math.round((cap.used/cap.total)*100)
          isAchieved = currentValue >= obj.threshold
        }
        break
      }

      case 'no_major_injury': {
        const { data: injuries } = await supabase.from('injury_log')
          .select('games_out,player_id')
          .eq('season','2025-26')
        const { data: roster } = await supabase.from('players')
          .select('id').eq('team_id', teamId)
        const rosterIds = (roster||[]).map((p:any)=>p.id)
        const majorInjuries = (injuries||[]).filter(i=>rosterIds.includes(i.player_id)&&i.games_out>=obj.threshold)
        isAchieved = majorInjuries.length === 0
        currentValue = isAchieved ? 1 : 0
        break
      }

      case 'win_margin': {
        const { data: games } = await supabase.from('games')
          .select('home_score,away_score,home_team,away_team')
          .eq('season','2025-26').eq('status','final')
          .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
        const bigWins = (games||[]).filter(g=>{
          const teamScore = g.home_team===teamId?g.home_score:g.away_score
          const oppScore = g.home_team===teamId?g.away_score:g.home_score
          return teamScore-oppScore >= 20
        })
        currentValue = bigWins.length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'wins_rivalry': {
        const { data: games } = await supabase.from('games')
          .select('home_score,away_score,home_team,away_team,is_rivalry')
          .eq('season','2025-26').eq('status','final').eq('is_rivalry',true)
          .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
        const rivalryWins = (games||[]).filter(g=>
          (g.home_team===teamId&&g.home_score>g.away_score)||
          (g.away_team===teamId&&g.away_score>g.home_score)
        )
        currentValue = rivalryWins.length
        isAchieved = currentValue >= obj.threshold
        break
      }

      default:
        continue
    }

    await supabase.from('sponsor_objective_tracking')
      .update({ current_value: currentValue, ...(isAchieved ? { achieved: true, achieved_at: new Date().toISOString() } : {}) })
      .eq('id', tracking.id)

    if (isAchieved) {
      achieved++
      const bonusAmount = obj.bonus_amount

      await supabase.from('franchise_transactions').insert({
        team_id: teamId,
        type: 'revenue',
        category: 'sponsor',
        amount: bonusAmount,
        description: `Sponsor bonus: ${obj.description}`,
        season: '2025-26',
        week_number: 99,
      })

      await supabase.rpc('increment_balance', { p_team_id: teamId, p_amount: bonusAmount })

      await supabase.from('sponsor_objective_tracking')
        .update({ paid: true }).eq('id', tracking.id)

      const { data: gm } = await supabase.from('profiles')
        .select('email,full_name').eq('team_id', teamId).single()

      if (gm?.email) {
        const tierLabel = tracking.contract?.tier === 'jersey' ? 'Jersey Patch'
          : tracking.contract?.tier === 'court' ? 'Court Logo' : 'Courtside Panels'
        const companyName = tracking.contract?.template?.company_name || 'your sponsor'

        await sendEmail(
          gm.email,
          `🎉 Sponsor Bonus Achieved — ${fmtM(bonusAmount)} credited!`,
          `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
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
            </div>
          `
        )
      }
    }
  }

  return { checked: trackings.length, achieved }
}
import { createClient } from '@supabase/supabase-js'
import { getStatusForWeek } from './season-week-helper'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendEmail(to: string, subject: string, html: string) {
  // This runs inside the weekly simulation, once per team that just achieved
  // a sponsor objective — a single stalled response here had no ceiling at
  // all and could block the entire run indefinitely (this was the actual
  // cause of a real "stuck simulating" report, right after the identical gap
  // in generate-power-rankings.ts's own external call was already fixed).
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'NBA GM League', email: 'noreply@nbagmleague.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15_000),
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
  const { data: allTeams } = await supabase.from('teams').select('id,name,major_rival_team_ids,minor_rival_team_ids,wins,losses,division')
  const teamMap: Record<string, any> = {}
  ;(allTeams||[]).forEach((t:any) => teamMap[t.id] = t)

  // Shared by wins_vs_top5 below — every final game this season, in date
  // order, so "was this opponent top-5 at the time" can be computed instead
  // of against today's standings. Fetched once here (not per-team inside
  // the loop) since it's the same league-wide log for everyone.
  // game_type='regular' only — every one of these win-counting objectives
  // is a REGULAR SEASON count by description ("Win 42 or more regular
  // season games", etc.). Real incident found during a full audit: none of
  // the wins_* queries in this file filtered by game_type at all, so the
  // 34 preseason friendly wins already in the DB this season were being
  // counted toward these totals right now, and playoff wins would have
  // started leaking in too the moment the playoffs began.
  const { data: allSeasonGames } = await supabase.from('games')
    .select('home_team,away_team,home_score,away_score,scheduled_date')
    .eq('season','2025-26').eq('status','final').eq('game_type','regular')
    .order('scheduled_date')

  // reach_playoffs/top_conference/top_division are FINAL-standings
  // objectives — "current rank right now" is meaningless (and was getting
  // credited) while the regular season still has months left to shuffle
  // the standings. Only conclusive once the regular season has actually
  // ended (getStatusForWeek moves past 'regular-season' into play-in).
  const { data: seasonCfg } = await supabase.from('season_config').select('current_week').eq('id', 1).single()
  const regularSeasonOver = getStatusForWeek((seasonCfg?.current_week || 0) + 1) !== 'regular-season'

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
          .eq('season','2025-26').eq('status','final').eq('game_type','regular')
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
          .eq('season','2025-26').eq('status','final').eq('game_type','regular')
          .eq('home_team', teamId)
        currentValue = (games||[]).filter(g=>g.home_score>g.away_score).length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'wins_streak': {
        // Ordered by scheduled_date (the simulated in-game date), not
        // played_at — played_at is stamped with the REAL wall-clock moment
        // the row was written, which is whenever this ran in real time, not
        // the simulated game date. Whenever a whole week (or more) gets
        // simulated in one batch, every one of those games gets a played_at
        // within the same few real seconds, in whatever order the batch
        // happened to process them — not necessarily the actual in-season
        // sequence. Same root cause already fixed for box scores/player
        // last-5-games earlier this project; missed here.
        const { data: games } = await supabase.from('games')
          .select('home_team,away_team,home_score,away_score,scheduled_date')
          .eq('season','2025-26').eq('status','final').eq('game_type','regular')
          .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
          .order('scheduled_date', {ascending:false})
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
        // Same played_at -> scheduled_date fix as wins_streak above.
        const { data: games } = await supabase.from('games')
          .select('home_score,away_score,scheduled_date')
          .eq('season','2025-26').eq('status','final').eq('game_type','regular')
          .eq('home_team', teamId)
          .order('scheduled_date', {ascending:false})
        let streak = 0, maxStreak = 0
        for (const g of (games||[])) {
          if (g.home_score>g.away_score) { streak++; maxStreak=Math.max(maxStreak,streak) } else streak=0
        }
        currentValue = maxStreak
        isAchieved = maxStreak >= obj.threshold
        break
      }

      case 'wins_rivalry': {
        // Counts wins against ANY researched rival, Major or Minor — the
        // objective itself doesn't distinguish tier, just "did you beat
        // your rival(s) enough times."
        const rivals = [...(teamMap[teamId]?.major_rival_team_ids||[]), ...(teamMap[teamId]?.minor_rival_team_ids||[])]
        if (!rivals.length) break
        const rivalOr = rivals.map((r:string) => `and(home_team.eq.${teamId},away_team.eq.${r}),and(home_team.eq.${r},away_team.eq.${teamId})`).join(',')
        const { data: games } = await supabase.from('games')
          .select('home_score,away_score,home_team,away_team')
          .eq('season','2025-26').eq('status','final').eq('game_type','regular')
          .or(rivalOr)
        currentValue = (games||[]).filter(g=>
          (g.home_team===teamId&&g.home_score>g.away_score)||
          (g.away_team===teamId&&g.away_score>g.home_score)
        ).length
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'wins_vs_top5': {
        // "Top 5" used to mean today's standings applied retroactively to
        // every game all season — a team that was briefly top-5 in week 3
        // and fell to 15th by week 20 kept counting forever, AND (the
        // reverse bug) a team that only climbed into the top 5 much later
        // credited a win against them back when they weren't good yet.
        // Rebuilt as a running per-team win total advanced strictly in
        // scheduled_date order, so each of THIS team's wins is checked
        // against the standings as they genuinely were on that date.
        const allTeamIds = (allTeams||[]).filter((t:any)=>!['ALL','RVS','ROO','SOP'].includes(t.id)).map((t:any)=>t.id)
        const winsAsOf: Record<string, number> = {}
        let winsVsTop = 0
        for (const g of (allSeasonGames||[])) {
          if (g.home_team === teamId || g.away_team === teamId) {
            const won = (g.home_team===teamId && g.home_score>g.away_score) || (g.away_team===teamId && g.away_score>g.home_score)
            if (won) {
              const oppId = g.home_team===teamId ? g.away_team : g.home_team
              const rankedAsOf = allTeamIds
                .filter((id:string)=>id!==teamId)
                .map((id:string)=>({ id, wins: winsAsOf[id]||0 }))
                .sort((a,b)=>b.wins-a.wins)
                .slice(0,5)
                .map((t:any)=>t.id)
              if (rankedAsOf.includes(oppId)) winsVsTop++
            }
          }
          const winnerId = g.home_score > g.away_score ? g.home_team : g.away_team
          winsAsOf[winnerId] = (winsAsOf[winnerId]||0) + 1
        }
        currentValue = winsVsTop
        isAchieved = currentValue >= obj.threshold
        break
      }

      case 'win_margin': {
        const { data: games } = await supabase.from('games')
          .select('home_score,away_score,home_team,away_team')
          .eq('season','2025-26').eq('status','final').eq('game_type','regular')
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
          .eq('season','2025-26').eq('status','final').eq('game_type','regular')
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
        // game_type='regular' — preseason friendlies also have attendance
        // recorded (real incident: confirmed values around 10-12K already
        // in the DB) and were dragging this "average home attendance"
        // objective away from what a real regular-season crowd number
        // should be.
        const { data: games } = await supabase.from('games')
          .select('attendance,home_score,away_score')
          .eq('season','2025-26').eq('status','final').eq('game_type','regular')
          .eq('home_team', teamId)
          .not('attendance','is',null)
        if (games?.length) {
          const { data: ff } = await supabase.from('franchise_finances')
            .select('*').eq('team_id',teamId).single()
          const cap = (ff as any)?.arena_capacity || 18000
          const avg = (games||[]).reduce((t,g)=>t+((g.attendance||0)/cap*100),0)/games.length
          currentValue = Math.round(avg)
          // Same drifts-both-ways reasoning as ppg_avg/top_scorer_count/
          // fan_satisfaction above — a handful of early sellouts can clear
          // the bar long before a real season's worth of attendance swings
          // (a losing streak, a cold winter month) has a chance to pull it
          // back down.
          isAchieved = regularSeasonOver && currentValue >= obj.threshold
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
        // Current standing shown as progress either way, but only a FINAL
        // standing (regular season actually over) can mark this achieved.
        isAchieved = regularSeasonOver && rank > 0 && rank <= obj.threshold
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
        isAchieved = regularSeasonOver && rank > 0 && rank <= obj.threshold
        break
      }

      case 'reach_playoffs': {
        const team = teamMap[teamId]
        const conf = team?.conference
        const confTeams = (allTeams||[])
          .filter((t:any)=>t.conference===conf&&!['ALL','RVS','ROO','SOP'].includes(t.id))
          .sort((a:any,b:any)=>b.wins-a.wins)
        const rank = confTeams.findIndex((t:any)=>t.id===teamId) + 1
        isAchieved = regularSeasonOver && rank > 0 && rank <= 8
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
        // game_type='regular' — box_scores has preseason friendly rows too
        // (this join only filtered by season), which were pulling this
        // "points per game" average away from real regular-season pace.
        const { data: boxes } = await supabase.from('box_scores')
          .select('pts,game_id,games!inner(home_team,away_team,season,game_type)')
          .eq('games.season','2025-26').eq('games.game_type','regular')
          .eq('team_id', teamId)
        if (boxes?.length) {
          const gameIdSet: Record<string,boolean> = {}
          ;(boxes||[]).forEach((b:any)=>{ if(b.game_id) gameIdSet[b.game_id]=true })
          const gameIds = Object.keys(gameIdSet)
          const totalPts = (boxes||[]).reduce((t:number,b:any)=>t+(b.pts||0),0)
          currentValue = Math.round(totalPts / Math.max(1,gameIds.length))
          // Same reasoning as reach_playoffs/top_conference/no_major_injury/
          // fan_satisfaction above — a scoring average drifts both ways over
          // the season (an early hot streak can inflate it well past the
          // target long before the sample size is real), so a mid-season
          // snapshot clearing the bar isn't conclusive. Missed in the
          // original pass that added the guard to the other drifting
          // objectives; same bug, same fix.
          isAchieved = regularSeasonOver && currentValue >= obj.threshold
        }
        break
      }

      case 'top_scorer_count': {
        // Two different sponsor templates share this same objective_type —
        // "Have at least N players score X+ PPG" (a flat per-player cutoff)
        // and "N players finish top 10 in league scoring" (a LEAGUE-WIDE
        // RANKING, not a fixed number) — distinguished only by their
        // description text since there's no separate column for it. Real
        // incident: both were being evaluated with the exact same flat
        // "ppg>=20" check, so "top 10 in league scoring" never actually
        // checked league rank at all — a team could clear it (or miss it)
        // for reasons having nothing to do with whether their players were
        // really top-10 league-wide (some seasons the 10th-best scorer is
        // at 24 PPG, others at 19).
        const isTopTenVariant = /top\s*10/i.test(obj.description || '')
        const { data: stats } = await supabase.from('player_stats')
          .select('player_id,pts,games').eq('season','2025-26').gte('games',20)
        const { data: roster } = await supabase.from('players').select('id').eq('team_id',teamId)
        const rosterIds = new Set((roster||[]).map((p:any)=>p.id))
        const allScorers = (stats||[]).map((s:any)=>({id:s.player_id,ppg:s.pts/Math.max(1,s.games)}))
        if (isTopTenVariant) {
          const top10Ids = new Set(
            [...allScorers].sort((a,b)=>b.ppg-a.ppg).slice(0,10).map(s=>s.id)
          )
          currentValue = allScorers.filter(s=>rosterIds.has(s.id)&&top10Ids.has(s.id)).length
        } else {
          currentValue = allScorers.filter(s=>rosterIds.has(s.id)&&s.ppg>=20).length
        }
        // Same "drifts both ways, needs the full season" reasoning as
        // ppg_avg/attendance_avg/fan_satisfaction above — a player's PPG
        // (and league-wide rank) through a partial season isn't the final
        // word, and league rank in particular can only be meaningfully
        // computed once everyone's sample size is real.
        isAchieved = regularSeasonOver && currentValue >= obj.threshold
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
        // Two different sponsor templates share this type — a generic "any
        // player +3" and a "rookie or sophomore +5" that's supposed to be
        // restricted to nba_experience 0/1 — same shared-type-different-
        // description issue as top_scorer_count above. The code never
        // actually filtered by experience for the second variant, so ANY
        // veteran's improvement could satisfy an objective explicitly meant
        // for young players.
        const isYoungVariant = /rookie|sophomore/i.test(obj.description || '')
        const { data: players } = await supabase.from('players')
          .select('id,real_ovr,ovr_start_season,nba_experience').eq('team_id',teamId)
        const pool = isYoungVariant ? (players||[]).filter((p:any)=>[0,1].includes(p.nba_experience)) : (players||[])
        const improvements = pool.map((p:any)=>(p.real_ovr||0)-(p.ovr_start_season||p.real_ovr||0))
        currentValue = improvements.length ? Math.max(...improvements) : 0
        // OVR isn't monotonic — the age-based development rules add real
        // decline from 31+, so an early-season improvement can legitimately
        // erode back down later. Same "drifts both ways" reasoning as
        // ppg_avg/attendance_avg/fan_satisfaction above; missed in the
        // original pass since this objective type predates that pass.
        isAchieved = regularSeasonOver && currentValue >= obj.threshold
        break
      }

      case 'no_major_injury': {
        const { data: roster } = await supabase.from('players').select('id').eq('team_id',teamId)
        const rosterIds = new Set((roster||[]).map((p:any)=>p.id))
        // Only injuries from real games (regular season + playoffs) count —
        // preseason friendlies, practice, and off-court incidents aren't
        // "official" per Bruno, and used to sneak this objective past teams
        // whose only long-term injury happened in a friendly.
        const { data: injuries } = await supabase.from('injury_log')
          .select('games_out,player_id').eq('season','2025-26').eq('occurred_in','game')
        const major = (injuries||[]).filter(i=>rosterIds.has(i.player_id)&&i.games_out>=obj.threshold)
        // Same reasoning as reach_playoffs/top_conference/top_division above
        // — "no one's hit 20+ games out YET" is trivially true after a
        // handful of games just because there hasn't been enough season
        // left for any injury to reach that threshold. Only conclusive once
        // the regular season is actually over.
        isAchieved = regularSeasonOver && major.length === 0
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
        // Unlike wins (only ever go up), satisfaction drifts both ways —
        // touching the target for one moment and then sliding back down
        // shouldn't lock in the reward forever, same reasoning as
        // reach_playoffs/top_conference/no_major_injury above.
        isAchieved = regularSeasonOver && currentValue >= obj.threshold
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

      // Inbox notification
      const tierLabel = tracking.contract?.tier === 'jersey' ? 'Jersey Patch'
        : tracking.contract?.tier === 'court' ? 'Court Logo' : 'Courtside Panels'
      const companyName = tracking.contract?.template?.company_name || 'Sponsor'
      await supabase.from('inbox_messages').insert({
        to_team_id: teamId,
        type: 'sponsor',
        subject: `🎯 Sponsor objective achieved — ${fmtM(bonusAmount)} credited!`,
        body: `Your ${tierLabel} sponsor (${companyName}) has credited a bonus of ${fmtM(bonusAmount)} to your account.\n\nObjective: "${obj.description}"\n\nThe amount has been added to your franchise balance automatically.`,
        read: false,
        metadata: {
          objective_type: obj.objective_type,
          bonus_amount: bonusAmount,
          tier: tracking.contract?.tier,
          company_name: companyName,
        },
      })

      const { data: gm } = await supabase.from('profiles')
        .select('email,full_name').eq('team_id', teamId).single()

      if (gm?.email) {
        const tierLabel = tracking.contract?.tier === 'jersey' ? 'Jersey Patch'
          : tracking.contract?.tier === 'court' ? 'Court Logo' : 'Courtside Panels'
        const companyName = tracking.contract?.template?.company_name || 'your sponsor'

        try {
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
        } catch (emailErr) {
          // The inbox notification + balance credit above already happened —
          // a slow/failed email is cosmetic, not a reason to abort processing
          // the remaining teams' objectives this run.
          console.warn('Sponsor bonus email failed:', emailErr)
        }
      }
    }
  }

  return { checked: trackings.length, achieved }
}

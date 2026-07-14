import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Generates automatic weekly orders for teams without a GM
// Called by admin before simulation, or can be integrated into the simulate cron

export async function POST(req: NextRequest) {
  try {
    const { secret, week_number } = await req.json()
    if (secret !== process.env.ADMIN_SECRET && secret !== 'nba-admin-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all real teams
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, wins, losses')
      .not('id', 'in', '(ALL,RVS,ROO,SOP)')

    // Get teams that already have a GM
    const { data: gms } = await supabaseAdmin
      .from('gm_profiles')
      .select('team_id')
      .eq('role', 'gm')
      .not('team_id', 'is', null)

    const gmTeams = new Set((gms || []).map((g: any) => g.team_id))

    // Get the week number from season_config if not provided
    let week = week_number
    if (!week) {
      const { data: cfg } = await supabaseAdmin
        .from('season_config').select('current_week').eq('id', 1).single()
      week = (cfg?.current_week || 0) + 1
    }

    // Get existing orders for this week (don't overwrite GM orders)
    const { data: existingOrders } = await supabaseAdmin
      .from('gm_orders')
      .select('team_id')
      .eq('week_number', week)

    const alreadyHasOrders = new Set((existingOrders || []).map((o: any) => o.team_id))

    let generated = 0
    let carriedForward = 0
    const errors: string[] = []

    // A real GM's Weekly Orders used to only ever exist for the exact week
    // they were submitted — with no standing default, the very next week
    // (or any week a GM simply didn't resubmit for) silently fell back to
    // this route's generic usage-sorted auto lineup, discarding a real
    // GM's actual rotation/tactics/priorities even though nothing was
    // "changed." A real coach's rotation stays the same until they change
    // it — so a GM team with no order yet for this week now gets their own
    // most recent real submission copied forward (unlocked, so they can
    // still edit it before the deadline) instead of a generic fallback.
    for (const team of (teams || [])) {
      if (!gmTeams.has(team.id) || alreadyHasOrders.has(team.id)) continue
      const { data: lastOrder } = await supabaseAdmin
        .from('gm_orders').select('*')
        .eq('team_id', team.id).lt('week_number', week)
        .order('week_number', { ascending: false }).limit(1).maybeSingle()
      if (!lastOrder) continue
      // .upsert() resolves with { error }, it doesn't throw — a wrapping
      // try/catch here silently believed every write succeeded even when it
      // didn't, which is exactly how this route's real bug (see below) went
      // undetected all season.
      const { error: cfErr } = await supabaseAdmin.from('gm_orders').upsert({
        ...lastOrder, id: undefined, week_number: week, locked: false,
      }, { onConflict: 'team_id,week_number' })
      if (cfErr) errors.push(`${team.id} (carry-forward): ${cfErr.message}`)
      else carriedForward++
    }

    for (const team of (teams || [])) {
      // Skip if team has a GM or already has orders
      if (gmTeams.has(team.id) || alreadyHasOrders.has(team.id)) continue

      // Get players for this team ordered by usage
      const { data: players } = await supabaseAdmin
        .from('players')
        .select('id, name, pos, usage, stamina, three, layup, dunk, mid, ft, siq, idef, pdef, ball_hdl, pass_vis')
        .eq('team_id', team.id)
        .eq('status', 'active')
        .order('usage', { ascending: false })

      if (!players || players.length === 0) continue

      // Sort by position for depth chart
      const byPos: Record<string, any[]> = { PG: [], SG: [], SF: [], PF: [], C: [] }
      for (const p of players) {
        const pos = p.pos?.toUpperCase()
        if (byPos[pos]) byPos[pos].push(p)
        else {
          // Assign flex players to needed positions
          if (['PG','SG'].includes(pos)) { byPos.PG.push(p); byPos.SG.push(p) }
          else if (['SF','PF'].includes(pos)) { byPos.SF.push(p); byPos.PF.push(p) }
        }
      }

      // Build depth chart — 48 mins per position
      const depth_chart: Record<string, any> = {}
      const usedMins: Record<string, number> = {}

      for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
        const pool = byPos[pos]?.filter((p: any) => (usedMins[p.id] || 0) < 36) || []
        if (pool.length === 0) continue

        const starter = pool[0]
        const sub1 = pool[1] || pool[0]
        const sub2 = pool[2] || pool[0]

        depth_chart[pos] = {
          s:  { name: starter.name, mins: 24 },
          b1: { name: sub1.name,   mins: 16 },
          b2: { name: sub2.name,   mins: 8  },
        }

        usedMins[starter.id] = (usedMins[starter.id] || 0) + 24
        usedMins[sub1.id]    = (usedMins[sub1.id]    || 0) + 16
        usedMins[sub2.id]    = (usedMins[sub2.id]    || 0) + 8
      }

      // A roster with zero natural players at some position used to just
      // leave that slot out of the depth chart entirely — only 4 of 5
      // starter slots got built, so that position's minutes vanished
      // instead of being played by anyone. Now the least-used remaining
      // player fills the gap instead; the existing out-of-position penalty
      // in game-simulator.ts's applyDC/pS/simP already makes that a real
      // disadvantage, so this plays a real (if worse) 5-man rotation
      // instead of a phantom 4-on-5.
      for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
        if (depth_chart[pos]) continue
        const pool = players.filter((p: any) => (usedMins[p.id] || 0) < 36)
          .sort((a: any, b: any) => (usedMins[a.id] || 0) - (usedMins[b.id] || 0))
        if (pool.length === 0) continue

        const starter = pool[0]
        const sub1 = pool[1] || pool[0]
        const sub2 = pool[2] || pool[0]

        depth_chart[pos] = {
          s:  { name: starter.name, mins: 24 },
          b1: { name: sub1.name,   mins: 16 },
          b2: { name: sub2.name,   mins: 8  },
        }

        usedMins[starter.id] = (usedMins[starter.id] || 0) + 24
        usedMins[sub1.id]    = (usedMins[sub1.id]    || 0) + 16
        usedMins[sub2.id]    = (usedMins[sub2.id]    || 0) + 8
      }

      // Top 3 scorers as priorities
      const top3 = [...players].sort((a: any, b: any) => b.usage - a.usage).slice(0, 3)

      // Determine style based on roster strengths
      const avg3PT = players.reduce((s: number, p: any) => s + (p.three || 50), 0) / players.length
      const avgSize = players.filter((p: any) => ['PF','C'].includes(p.pos)).length
      const three_rate = avg3PT > 65 ? 45 : avg3PT > 55 ? 40 : 35
      const atk_style = avgSize >= 3 ? 'post' : avg3PT > 60 ? 'motion' : 'pickroll'

      // Training intensity based on team record
      const winPct = team.wins / Math.max(1, team.wins + team.losses)
      const training_intensity = winPct < 0.35 ? 'intense' : winPct > 0.65 ? 'normal' : 'normal'

      // Clutch player — highest pressure stat
      const clutchPlayer = [...players].sort((a: any, b: any) =>
        (b.siq + b.ft) - (a.siq + a.ft)
      )[0]

      // ball_roles/is_auto used to be written as top-level columns that
      // don't exist on gm_orders (ball_roles actually lives inside
      // depth_chart.ball_roles, same convention every other caller uses —
      // see orderMap[...]?.depth_chart?.ball_roles in cron/simulate/run.ts
      // and preseason-simulator.ts). Supabase's upsert() resolves with
      // { error } rather than throwing, so the surrounding try/catch never
      // saw it: every auto-order write for a no-GM team silently failed
      // all season while this route still reported success and incremented
      // `generated`. Simulation itself was never actually broken by this —
      // simulateGame()'s own depth-chart validation covers a missing order
      // — but the DB never had a real Weekly Orders row for these teams to
      // show anywhere in the UI.
      const { error: genErr } = await supabaseAdmin.from('gm_orders').upsert({
        team_id: team.id,
        week_number: week,
        depth_chart: { ...depth_chart, ball_roles: {} },
        priority_1: top3[0]?.name || null,
        priority_2: top3[1]?.name || null,
        priority_3: top3[2]?.name || null,
        clutch_player: clutchPlayer?.name || top3[0]?.name || null,
        pace: 70,
        three_rate,
        atk_style,
        def_style: 'man',
        training_intensity,
        locked: false,
      }, { onConflict: 'team_id,week_number' })
      if (genErr) errors.push(`${team.id}: ${genErr.message}`)
      else generated++
    }

    return NextResponse.json({ success: true, week, generated, carriedForward, errors })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

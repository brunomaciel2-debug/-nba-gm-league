import { supabaseAdmin } from '@/lib/supabase'
import { getWeekForDate } from '@/lib/season-week-helper'
import { getGymGradeBonus } from '@/lib/facility-constants'
import { physioRecoveryMultiplier, SPECIALIST_BOOST_MULTIPLIER_BY_SEVERITY, InjurySeverity } from '@/lib/injury-constants'
import { resolvePlayoffDay } from '@/lib/playoff-resolver'
import { resolveDailyTacticalDevelopment } from '@/lib/tactical-resolver'
import { fetchAllRows } from '@/lib/paginate'

// Health recovery used to run once per simulated WEEK (really once per
// half-2 call), gated by an odd `isMonday = new Date().getDay()===1` check
// against the REAL wall-clock day the cron happened to execute on — not
// the simulated day at all. That's also why an injury's "13 days out"
// forecast never actually meant anything: recovery only got evaluated
// once a week regardless, so a player who crossed the 50-health threshold
// mid-week just sat there until the next batch caught up. Bruno confirmed
// health should stay the real trigger (return_week/games_out remain
// display-only estimates) — this just checks it every simulated day
// instead of once a week. The per-tick gain below (3*1*mod*...) is scaled
// to "1 day's worth", so 7 daily ticks add up to the same weekly total the
// old 3-or-4-day lump sums used to.
export async function resolveDailyHealthRecovery(simDate: string) {
  // Paginated fetch is required — 1163 active players exceeds PostgREST's
  // hard 1000-row-per-request cap (see src/lib/paginate.ts), which (no
  // ORDER BY here) was silently skipping an arbitrary ~160 real players'
  // daily health recovery every single day.
  const allP = await fetchAllRows((from,to)=>supabaseAdmin.from('players').select('id,health,team_id,status,durability').in('status', ['active', 'injured']).range(from,to))
  if (!allP?.length) return

  const week = getWeekForDate(simDate)
  const { data: ords } = await supabaseAdmin.from('gm_orders').select('team_id,training_intensity').eq('week_number', week)
  const iMap: Record<string, string> = {}
  ;(ords || []).forEach((o: any) => { iMap[o.team_id] = o.training_intensity || 'normal' })
  const IMOD: Record<string, number> = { rest: 1.5, light: 1.25, normal: 1.0, intense: 0.5, very_intense: 0.25 }

  const { data: physios } = await supabaseAdmin.from('coaches').select('team_id,rehab_speed').eq('role', 'physio')
  const physioMap: Record<string, number> = {}
  ;(physios || []).forEach((c: any) => { physioMap[c.team_id] = c.rehab_speed })

  const { data: facilitiesForRecovery } = await supabaseAdmin.from('practice_facilities').select('team_id,gym_grade')
  const facilityRecoveryMap: Record<string, number> = {}
  ;(facilitiesForRecovery || []).forEach((f: any) => { facilityRecoveryMap[f.team_id] = getGymGradeBonus(f.gym_grade).recovery })

  const injuredIds = (allP || []).filter((p: any) => p.status === 'injured').map((p: any) => p.id)
  const { data: openInjuries } = injuredIds.length > 0 ? await supabaseAdmin
    .from('injury_log').select('player_id,severity,specialist_used').eq('status', 'active').in('player_id', injuredIds) : { data: [] as any[] }
  const boostMap: Record<string, number> = {}
  ;(openInjuries || []).forEach((inj: any) => {
    if (inj.specialist_used) boostMap[inj.player_id] = SPECIALIST_BOOST_MULTIPLIER_BY_SEVERITY[inj.severity as InjurySeverity] || 1
  })

  const recoveryUpdates: { id: string, fields: Record<string, any>, recovered: boolean }[] = []
  for (const p of (allP || [])) {
    const mod = IMOD[iMap[p.team_id] || 'normal'] || 1.0
    const durB = ((p.durability || 75) - 75) / 100 * 0.5
    const facilityRecoveryB = (facilityRecoveryMap[p.team_id] || 0) / 100
    let hGain = 3 * 1 * mod * (1 + durB) * (1 + facilityRecoveryB)
    if (p.status === 'injured') hGain *= physioRecoveryMultiplier(physioMap[p.team_id]) * (boostMap[p.id] || 1)
    const nh = Math.min(100, Math.round((p.health || 100) + hGain))
    const recovered = p.status === 'injured' && nh >= 50
    if (nh !== (p.health || 100) || recovered) {
      recoveryUpdates.push({ id: p.id, fields: { health: nh, ...(recovered ? { status: 'active' } : {}) }, recovered })
    }
  }

  for (let i = 0; i < recoveryUpdates.length; i += 50) {
    const chunk = recoveryUpdates.slice(i, i + 50)
    await Promise.all(chunk.map(u => supabaseAdmin.from('players').update(u.fields).eq('id', u.id)))
  }

  const recoveredIds = recoveryUpdates.filter(u => u.recovered).map(u => u.id)
  if (recoveredIds.length > 0) {
    // A player's `status` is single-valued, so once he's back to 'active'
    // every injury_log row still marked 'active' for him is stale, not
    // just the most recent one (same fix as the original weekly step).
    const { data: openInjs } = await supabaseAdmin.from('injury_log').select('id')
      .in('player_id', recoveredIds).eq('status', 'active')
    const injIds: string[] = (openInjs || []).map((inj: any) => inj.id)
    for (let i = 0; i < injIds.length; i += 50) {
      const chunk = injIds.slice(i, i + 50)
      await Promise.all(chunk.map((id: string) => supabaseAdmin.from('injury_log').update({ status: 'resolved', healed_at: new Date().toISOString(), healed_week: week }).eq('id', id)))
    }
  }
}

// Called once per simulated calendar day (see run.ts, before the half-1
// early return so it runs on every call regardless of phase) — daily
// health recovery always applies; playoff-day resolution is a cheap no-op
// outside play-in/playoffs (resolvePlayoffDay just finds zero open series).
export async function resolveDailyTicks(dates: string[]): Promise<{ playoffGamesProcessed: number }> {
  let playoffGamesProcessed = 0
  for (const simDate of dates) {
    try { await resolveDailyHealthRecovery(simDate) } catch (e) { console.warn(`Daily health recovery failed for ${simDate}:`, e) }
    try {
      const { processed } = await resolvePlayoffDay(simDate)
      playoffGamesProcessed += processed
    } catch (e) { console.warn(`Playoff day resolution failed for ${simDate}:`, e) }
    // Tactical System Familiarity — see tactical-resolver.ts for why this
    // moved from a once-a-week tick to once a day (a weekly tick could only
    // ever land the full 15-node tree on a multiple of 15 weeks; Bruno
    // wanted 15/20/25 depending on staff quality, which needed the finer
    // daily granularity).
    try { await resolveDailyTacticalDevelopment(simDate) } catch (e) { console.warn(`Daily tactical development failed for ${simDate}:`, e) }
  }
  return { playoffGamesProcessed }
}

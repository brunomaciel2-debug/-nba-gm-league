// Builds a full 5-position depth chart (starter + 2 subs per position) purely
// from roster usage — no GM input needed. Used in two places: (1) teams with
// no GM / "Rest of the World" opponents in friendlies, who never submit
// Weekly Orders of their own, and (2) game-simulator.ts's own safety net,
// which falls back to this whenever a real submitted depth chart is
// incomplete (e.g. real player names assigned to every position but minutes
// only actually set for one of them) and would otherwise field fewer than 5
// players.
// Real NBA teams give a genuinely talented bench scorer real minutes — a
// "6th man" — instead of the flat "backup = 16 minutes, no matter who he
// is" every auto-generated rotation used to apply regardless of ability.
// Confirmed real gap: out of 425 real rostered players this season, only 4
// fit the 6th-man profile (15+ PPG at under 26 minutes), and the one clean
// case (Damian Lillard) only worked because he happened to be double-
// booked across two different positions' backup slots, not because the
// auto-rotation logic ever intentionally created that role. Triggers off
// the backup's OWN scoring ability (not a gap to the starter — a real 6th
// man is often clearly worse than the starter and still very much worth
// real minutes), pulling time mostly from the 3rd-string slot rather than
// the starter, the same way a real coach shortens the deep bench to feed
// a scorer, not the starter's own workload.
export function sixthManMinutes(starter: any, sub1: any): [number, number, number] {
  if (sub1 && sub1 !== starter && (sub1.scoring ?? 50) >= 65) return [22, 24, 6]
  return [24, 16, 8]
}
export function buildAutoDepthChart(players: any[]) {
  const byPos: Record<string, any[]> = { PG: [], SG: [], SF: [], PF: [], C: [] }
  const sorted = [...players].sort((a: any, b: any) => (b.usage || 0) - (a.usage || 0))
  for (const p of sorted) {
    const pos = (p.pos || '').toUpperCase()
    if (byPos[pos]) byPos[pos].push(p)
    else if (['PG', 'SG'].includes(pos)) { byPos.PG.push(p); byPos.SG.push(p) }
    else if (['SF', 'PF'].includes(pos)) { byPos.SF.push(p); byPos.PF.push(p) }
  }
  const depth_chart: Record<string, any> = {}
  const usedMins: Record<string, number> = {}
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
    const pool = (byPos[pos] || []).filter((p: any) => (usedMins[p.id] || 0) < 36)
    if (!pool.length) continue
    const starter = pool[0], sub1 = pool[1] || pool[0], sub2 = pool[2] || pool[0]
    const [starterMins, sub1Mins, sub2Mins] = sixthManMinutes(starter, sub1)
    depth_chart[pos] = { s: { name: starter.name, mins: starterMins }, b1: { name: sub1.name, mins: sub1Mins }, b2: { name: sub2.name, mins: sub2Mins } }
    usedMins[starter.id] = (usedMins[starter.id] || 0) + starterMins
    usedMins[sub1.id] = (usedMins[sub1.id] || 0) + sub1Mins
    usedMins[sub2.id] = (usedMins[sub2.id] || 0) + sub2Mins
  }
  // A roster with zero natural players at some position — real gap, seen on
  // roughly a third of World-team rosters (e.g. Red Star Belgrade has no
  // natural SG) — used to just leave that slot out of the depth chart
  // entirely: only 4 of 5 starter slots got built, so that position's
  // minutes vanished instead of being played by anyone. Now the
  // least-used remaining player on the roster fills the gap instead; the
  // existing out-of-position penalty in game-simulator.ts's
  // applyDC/pS/simP already makes that a real disadvantage, so a club
  // actually missing a position plays a real (if worse) 5-man rotation
  // instead of a phantom 4-on-5.
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
    if (depth_chart[pos]) continue
    const pool = sorted.filter((p: any) => (usedMins[p.id] || 0) < 36)
      .sort((a: any, b: any) => (usedMins[a.id] || 0) - (usedMins[b.id] || 0))
    if (!pool.length) continue
    const starter = pool[0], sub1 = pool[1] || pool[0], sub2 = pool[2] || pool[0]
    const [starterMins, sub1Mins, sub2Mins] = sixthManMinutes(starter, sub1)
    depth_chart[pos] = { s: { name: starter.name, mins: starterMins }, b1: { name: sub1.name, mins: sub1Mins }, b2: { name: sub2.name, mins: sub2Mins } }
    usedMins[starter.id] = (usedMins[starter.id] || 0) + starterMins
    usedMins[sub1.id] = (usedMins[sub1.id] || 0) + sub1Mins
    usedMins[sub2.id] = (usedMins[sub2.id] || 0) + sub2Mins
  }
  return depth_chart
}

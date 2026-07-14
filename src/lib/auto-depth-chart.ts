// Builds a full 5-position depth chart (starter + 2 subs per position) purely
// from roster usage — no GM input needed. Used in two places: (1) teams with
// no GM / "Rest of the World" opponents in friendlies, who never submit
// Weekly Orders of their own, and (2) game-simulator.ts's own safety net,
// which falls back to this whenever a real submitted depth chart is
// incomplete (e.g. real player names assigned to every position but minutes
// only actually set for one of them) and would otherwise field fewer than 5
// players.
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
    depth_chart[pos] = { s: { name: starter.name, mins: 24 }, b1: { name: sub1.name, mins: 16 }, b2: { name: sub2.name, mins: 8 } }
    usedMins[starter.id] = (usedMins[starter.id] || 0) + 24
    usedMins[sub1.id] = (usedMins[sub1.id] || 0) + 16
    usedMins[sub2.id] = (usedMins[sub2.id] || 0) + 8
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
    depth_chart[pos] = { s: { name: starter.name, mins: 24 }, b1: { name: sub1.name, mins: 16 }, b2: { name: sub2.name, mins: 8 } }
    usedMins[starter.id] = (usedMins[starter.id] || 0) + 24
    usedMins[sub1.id] = (usedMins[sub1.id] || 0) + 16
    usedMins[sub2.id] = (usedMins[sub2.id] || 0) + 8
  }
  return depth_chart
}

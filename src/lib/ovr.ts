/**
 * Calculate Overall Rating (OVR) for a player.
 * Single source of truth — used everywhere.
 */
export function calcOvr(p: any): number {
  if (!p) return 0
  return Math.round(
    (p.usage     || 0) * 0.15 +
    (p.siq       || 0) * 0.12 +
    (p.consistency||0) * 0.10 +
    (p.pressure  || 0) * 0.08 +
    ((p.layup||0) + (p.dunk||0)) / 2 * 0.10 +
    (p.three     || 0) * 0.08 +
    (p.idef      || 0) * 0.08 +
    (p.pdef      || 0) * 0.07 +
    (p.stamina   || 0) * 0.05 +
    (p.ball_hdl  || 0) * 0.07 +
    (p.pass_iq   || 0) * 0.05 +
    (p.def_reb   || 0) * 0.05
  )
}

export function ovrColor(ovr: number): string {
  if (ovr >= 85) return '#b45309'   // amber — elite
  if (ovr >= 75) return '#15803d'   // green — good
  if (ovr >= 65) return '#1d4ed8'   // blue — average
  return '#6b6258'                   // muted — below average
}

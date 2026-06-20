/**
 * Calculate Overall Rating (OVR) for a player.
 * Single source of truth — used everywhere.
 * Weights defined by user via OVR_Formula_Builder.xlsx
 * Total: 100%
 */
export function calcOvr(p: any): number {
  if (!p) return 0
  return Math.round(
    (p.usage      || 0) * 0.04 +
    (p.siq        || 0) * 0.04 +
    (p.layup      || 0) * 0.08 +
    (p.dunk       || 0) * 0.06 +
    (p.three      || 0) * 0.08 +
    (p.mid        || 0) * 0.06 +
    (p.ft         || 0) * 0.06 +
    (p.draw_foul  || 0) * 0.08 +
    (p.blk        || 0) * 0.05 +
    (p.stl        || 0) * 0.05 +
    (p.idef       || 0) * 0.04 +
    (p.pdef       || 0) * 0.05 +
    (p.def_reb    || 0) * 0.05 +
    (p.off_reb    || 0) * 0.06 +
    (p.stamina    || 0) * 0.04 +
    (p.ball_hdl   || 0) * 0.07 +
    (p.pass_vis   || 0) * 0.04 +
    (p.pass_iq    || 0) * 0.04 +
    (p.assist_role|| 0) * 0.01
  )
}

export function ovrColor(ovr: number): string {
  if (ovr >= 85) return '#b45309'   // amber — elite
  if (ovr >= 75) return '#15803d'   // green — good
  if (ovr >= 65) return '#1d4ed8'   // blue — average
  return '#6b6258'                   // muted — below average
}

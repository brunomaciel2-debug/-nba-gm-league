/**
 * calcOvr — uses real_ovr (stored 2K26 OVR) when available.
 * For players without real_ovr, estimates from attributes.
 * This ensures display OVR matches NBA 2K26 exactly for all known players.
 */
export function calcOvr(p: any): number {
  if (!p) return 0

  // Use real 2K26 OVR if stored
  if (p.real_ovr && p.real_ovr > 0) return p.real_ovr

  // Fallback: weighted estimate from available attributes
  // Weights derived from correlation analysis of 2K26 data
  return Math.round(
    (p.close_shot    || 0) * 0.0806 +
    (p.usage         || 0) * 0.0788 +
    (p.draw_foul     || 0) * 0.0744 +
    (p.layup         || 0) * 0.0717 +
    (p.siq           || 0) * 0.0702 +
    (p.pass_iq       || 0) * 0.0595 +
    (p.mid           || 0) * 0.0546 +
    (p.pass_vis      || 0) * 0.0537 +
    (p.standing_dunk || 0) * 0.0504 +
    (p.speed         || 0) * 0.0496 +
    (p.dunk          || 0) * 0.0491 +
    (p.ball_hdl      || 0) * 0.0488 +
    (p.agility       || 0) * 0.0474 +
    (p.stamina       || 0) * 0.0433 +
    (p.ft            || 0) * 0.0427 +
    (p.pdef          || 0) * 0.0348 +
    (p.three         || 0) * 0.0286 +
    (p.strength      || 0) * 0.0254 +
    (p.stl           || 0) * 0.0209 +
    (p.blk           || 0) * 0.0070 +
    (p.idef          || 0) * 0.0059 +
    (p.def_reb       || 0) * 0.0019 +
    (p.off_reb       || 0) * 0.0008
  )
}

export function ovrColor(ovr: number): string {
  if (ovr >= 93) return '#b45309'   // amber  — superstar (2K 93+)
  if (ovr >= 85) return '#15803d'   // green  — star (2K 85+)
  if (ovr >= 78) return '#1d4ed8'   // blue   — starter (2K 78+)
  return '#6b6258'                   // muted  — role player
}

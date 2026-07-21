// Shared G-League box-score generator — extracted from cron/simulate/run.ts
// so the playoff resolver can reuse the exact same formula as the regular
// season instead of drifting from it. Same shape as the NBA per-36 curves
// (volume scaled by minutes and Usage, quality scaled by the shooting
// attributes), just far simpler since the G-League doesn't need
// play-by-play, matchups, or fatigue.
export const buildTeamBox = (roster: any[], teamId: string) => {
  const active = roster.filter((p: any) => p.status !== 'injured')
  if (!active.length) return []
  // An NBA player sent down on assignment (on_gleague_assignment) is
  // Bruno's explicit first option for as long as he's down there — sorted
  // ahead of the whole rest of the roster regardless of his own usage
  // attribute, so he lands in the starter/top-minutes tier below. Several
  // assigned players all rank above every non-assigned one, ordered by
  // usage among themselves same as before.
  const ranked = [...active].sort((a, b) => {
    const assignDiff = (b.on_gleague_assignment ? 1 : 0) - (a.on_gleague_assignment ? 1 : 0)
    if (assignDiff !== 0) return assignDiff
    return (b.usage || 50) - (a.usage || 50)
  })
  // Rough starters/rotation/bench minutes tiers, then normalized so the
  // whole roster's minutes sum to a real team-game total (240 = 5 x 48).
  const tierMins = ranked.map((_, i) => i < 5 ? 26 + Math.random() * 8 : i < 9 ? 10 + Math.random() * 10 : 2 + Math.random() * 6)
  const totalTier = tierMins.reduce((s, v) => s + v, 0)
  // Capped at a real individual-game ceiling (42 — no actual NBA/G-League
  // game produces more) as well as the usual 240-total target, whichever
  // scale factor is smaller. A real incident: Maine Celtics had only 2
  // players ever assigned to its G-League roster, so force-dividing a full
  // team's 240 minutes across just those 2 gave each of them 124 minutes —
  // a 53-point, 29-rebound box line for a "team of 2". The roster gap
  // itself was fixed separately (every team topped up to at least 10
  // players), but this cap means a team that's ever short-handed again
  // plays fewer total team-minutes instead of producing fictional games,
  // same principle as never letting a single NBA player's box line run away
  // in game-simulator.ts's own taper functions.
  const scale = totalTier > 0 ? Math.min(240 / totalTier, 42 / Math.max(...tierMins)) : 0
  return ranked.map((p: any, i: number) => {
    const mins = Math.round(tierMins[i] * scale)
    if (mins <= 0) return null
    const three = p.three ?? 50, layup = p.layup ?? 50, mid = p.mid ?? 50, ft = p.ft ?? 50, usage = p.usage ?? 50
    const fga = Math.max(1, Math.round((mins / 36) * (10 + usage / 100 * 10) * (0.85 + Math.random() * 0.3)))
    const threeShare = Math.min(0.65, Math.max(0.05, 0.2 + (three - 50) / 100 * 0.3))
    const tpa = Math.round(fga * threeShare)
    const twoAtt = fga - tpa
    const twoPct = Math.min(0.68, Math.max(0.30, 0.46 + ((layup + mid) / 2 - 50) / 100 * 0.15))
    const threePct = Math.min(0.55, Math.max(0.15, 0.32 + (three - 50) / 100 * 0.15))
    const twoM = Math.min(twoAtt, Math.round(twoAtt * twoPct * (0.85 + Math.random() * 0.3)))
    const threeM = Math.min(tpa, Math.round(tpa * threePct * (0.85 + Math.random() * 0.3)))
    const fgm = twoM + threeM
    const fta = Math.round(fga * (0.15 + Math.random() * 0.25))
    const ftPct = Math.min(0.92, Math.max(0.55, 0.68 + (ft - 50) / 100 * 0.2))
    const ftm = Math.min(fta, Math.round(fta * ftPct * (0.85 + Math.random() * 0.3)))
    const pts = twoM * 2 + threeM * 3 + ftm
    const reb = Math.round((mins / 36) * (4 + Math.random() * 6))
    const offReb = Math.round(reb * 0.28)
    return {
      player_id: p.id, gleague_team_id: teamId, mins, pts, fgm, fga, tpm: threeM, tpa,
      ftm, fta, reb, ast: Math.round((mins / 36) * (2 + Math.random() * 5)),
      turnovers: Math.round((mins / 36) * (1 + Math.random() * 2.5)),
      stl: Math.round((mins / 36) * (0.5 + Math.random() * 1.5)), blk: Math.round((mins / 36) * (0.3 + Math.random() * 1.2)),
      off_reb: offReb, def_reb: reb - offReb, pf: Math.round(Math.random() * 4), is_starter: i < 5,
    }
  }).filter(Boolean) as any[]
}

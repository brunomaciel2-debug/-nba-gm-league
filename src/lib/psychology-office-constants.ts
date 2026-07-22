// Psychology Office — 3 per-team slots where a GM assigns a player to
// private weekly sessions with the Mental Coach, accelerating morale
// recovery toward a floor (60 normally, 75 with Extra Hours) at a real
// weekly cost. Single source of truth for the numbers, shared by the UI
// (PsychologyOfficeTab.tsx) and the weekly resolver.
export const SLOT_BASE_COST: Record<1 | 2 | 3, number> = { 1: 0, 2: 45_000, 3: 80_000 }
export const SLOT_EXTRA_HOURS_COST: Record<1 | 2 | 3, number> = { 1: 30_000, 2: 40_000, 3: 50_000 }
export const NORMAL_TARGET_MORALE = 60
export const EXTRA_HOURS_TARGET_MORALE = 75

export function weeklyCost(slot: 1 | 2 | 3, extraHours: boolean): number {
  return SLOT_BASE_COST[slot] + (extraHours ? SLOT_EXTRA_HOURS_COST[slot] : 0)
}

export function targetMorale(extraHours: boolean): number {
  return extraHours ? EXTRA_HOURS_TARGET_MORALE : NORMAL_TARGET_MORALE
}

// Same idea as run.ts's driftRate for natural morale drift, but a
// dedicated (faster) curve for these paid private sessions — 15% of the
// remaining gap per week with a poor Mental Coach, up to 45% with a great
// one, so coach quality genuinely matters here too.
export function sessionBoostRate(moraleManagement: number | null | undefined): number {
  const mm = moraleManagement ?? 60
  return Math.min(0.45, Math.max(0.15, 0.15 + (mm / 100) * 0.30))
}

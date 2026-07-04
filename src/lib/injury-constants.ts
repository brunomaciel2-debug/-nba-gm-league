// Shared constants for the injury system: medical bills, the "See a
// Specialist" pay-to-heal feature, and the Physio's real effect on recovery.
// All dollar figures here are flat, pre-decided lookups by severity — never
// a percentage of anything else.

export type InjurySeverity = 'minor' | 'moderate' | 'serious' | 'severe' | 'career_threatening'

// Charged automatically to the team's balance every time a player gets hurt.
export const MEDICAL_COST_BY_SEVERITY: Record<InjurySeverity, number> = {
  minor: 8_000,
  moderate: 20_000,
  serious: 45_000,
  severe: 90_000,
  career_threatening: 180_000,
}

// Only serious/severe/career_threatening injuries are worth flying in a specialist for.
export const SPECIALIST_ELIGIBLE_SEVERITIES: InjurySeverity[] = ['serious', 'severe', 'career_threatening']

export const SPECIALIST_COST_BY_SEVERITY: Partial<Record<InjurySeverity, number>> = {
  serious: 60_000,
  severe: 150_000,
  career_threatening: 350_000,
}

export const SPECIALIST_HEALTH_BONUS_BY_SEVERITY: Partial<Record<InjurySeverity, number>> = {
  serious: 20,
  severe: 30,
  career_threatening: 40,
}

export function isSpecialistEligible(severity: string): severity is InjurySeverity {
  return SPECIALIST_ELIGIBLE_SEVERITIES.includes(severity as InjurySeverity)
}

// The Physio's rehab_speed attribute — same formula already advertised in
// StaffPageClient.tsx ("reduces recovery time by ~X%"), now actually applied
// to weekly health regen for players currently out with an injury. Capped at
// ±30% so a maxed-out Physio can't trivialize recovery, and a terrible one
// can't stall it forever either.
export function physioRecoveryMultiplier(rehabSpeed?: number | null): number {
  const rs = rehabSpeed ?? 50
  const raw = (rs - 50) / 50 * 0.3
  const clamped = Math.max(-0.3, Math.min(0.3, raw))
  return 1 + clamped
}

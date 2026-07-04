// Shared constants for the injury system: medical bills, the "See a
// Specialist" pay-to-heal feature, the Physio's real effect on recovery, and
// the reinjury-risk window. All dollar figures here are flat, pre-decided
// lookups by severity — never a percentage of anything else.

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

// The specialist does NOT instantly heal the player — it speeds up the
// normal weekly recovery for as long as the injury stays open, on top of
// whatever the Physio already contributes. Bigger boost on worse injuries,
// since that's where expedited treatment matters most.
export const SPECIALIST_BOOST_MULTIPLIER_BY_SEVERITY: Partial<Record<InjurySeverity, number>> = {
  serious: 1.4,
  severe: 1.7,
  career_threatening: 2.0,
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

// How many weeks a player stays "fragile" (elevated reinjury risk) to the
// same body part after recovering from an injury there, driven directly by
// that injury type's own recurrence_risk value (5-60 in the data). A risk of
// 60 (e.g. Hamstring Strain) gives a 6-week window; a risk of 10 gives 1 week.
export function recurrenceWindowWeeks(recurrenceRisk: number): number {
  return Math.max(1, Math.round(recurrenceRisk / 10))
}

// Extra weight multiplier applied to injury types matching a player's
// currently-fragile body part when rolling a new injury — reuses the type's
// own recurrence_risk as the bias strength (risk 60 -> x2.2, risk 10 -> x1.2).
export function recurrenceBodyPartWeightBoost(recurrenceRisk: number): number {
  return 1 + recurrenceRisk / 50
}

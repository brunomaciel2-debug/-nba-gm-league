// Practice Facility grade bonuses — single source of truth for the numbers
// FacilitiesTab.tsx displays AND the real formulas that consume them
// (training speed, weekly health recovery, injury risk, free-agency
// attractiveness). Previously these were only ever shown in the UI and
// never actually read by any formula.
export type GymGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A'
export type GymGradeBonus = { speed: number, recovery: number, risk: number, fa: number }
export const GYM_GRADE_BONUSES: Record<GymGrade, GymGradeBonus> = {
  F: { speed: 5, recovery: -5, risk: 0, fa: 0 },
  E: { speed: 7, recovery: 0, risk: 0, fa: 0 },
  D: { speed: 9, recovery: 3, risk: 0, fa: 0 },
  C: { speed: 12, recovery: 7, risk: -5, fa: 0 },
  B: { speed: 15, recovery: 13, risk: -10, fa: 5 },
  A: { speed: 19, recovery: 20, risk: -18, fa: 12 },
}

export function getGymGradeBonus(grade: GymGrade | string | undefined | null): GymGradeBonus {
  return GYM_GRADE_BONUSES[(grade as GymGrade) || 'F'] || GYM_GRADE_BONUSES.F
}

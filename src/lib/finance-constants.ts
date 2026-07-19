// Shared between the monthly settlement (src/lib/notifications.ts, actually
// posts these to franchise_finances/franchise_transactions) and the
// Finances > Projections estimate (src/app/team/[id]/FinancesTab.tsx) so
// the two can never drift apart the way they used to — Projections showed
// these same numbers as a guess while nothing in the real simulation ever
// actually charged or paid them.
export const NBA_SUBSIDY_MONTHLY = 500_000
export const UTILITIES_MONTHLY = 80_000
export const INSURANCE_MONTHLY = 40_000

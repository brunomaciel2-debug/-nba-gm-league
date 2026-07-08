// Imports the pure market-tier file directly (NOT merchandising.ts) — this
// file is used inside client components (ArenaView.tsx), and merchandising.ts
// transitively imports server-only notify helpers that crash the browser
// bundle (unconditional createClient with the service-role key). See
// market-tiers.ts's own comment for the full incident.
import { marketMultiplier, followersBonus } from './market-tiers'

// ── AUDIENCE SEGMENTS ─────────────────────────────────────────────
// Formalizes the demographic flavor text ArenaBlueprint.tsx's concession
// slots already implied (mascot -> "Kid/family segment", VIP Restaurant ->
// "unlocks corporate sponsor tiers", Premium Food's "Ticket >$150 -> -5%"
// penalty) into a real economic model: each segment has its own price
// tolerance, seat-tier preference, and concession spending pattern.
export type TierId = 'lower' | 'upper' | 'courtside'
export type SegmentId = 'family' | 'young_adult' | 'loyal_fan' | 'corporate'

export type Segment = {
  id: SegmentId
  label: string
  baseShare: number // league-average population share, sums to 1 across all 4
  tier: TierId // the one seat tier this segment actually attends (v1: no cross-tier overflow)
  comfortablePrice: number // at/below this, price has zero effect on attendance
  // Relative propensity to buy each concession slot, calibrated so a
  // league-average crowd (baseShare mix) reproduces each slot's existing
  // adoption_rate from ArenaBlueprint.tsx — >1 means this segment overindexes.
  concessionMultiplier: Partial<Record<string, number>>
}

export const SEGMENTS: Segment[] = [
  {
    id: 'family', label: 'Family/Casual', baseShare: 0.35, tier: 'upper', comfortablePrice: 50,
    concessionMultiplier: { food_stall_basic: 1.5, vending: 1.4, mascot: 3.0, fan_zone: 2.2, franchise_store: 0.7, food_stall_premium: 0.3, bar: 0.2, restaurant_vip: 0.05 },
  },
  {
    id: 'young_adult', label: 'Young Adult/Social', baseShare: 0.25, tier: 'lower', comfortablePrice: 90,
    concessionMultiplier: { bar: 2.2, food_stall_premium: 1.2, food_stall_basic: 0.9, vending: 0.8, franchise_store: 0.9, mascot: 0.2, fan_zone: 0.6, restaurant_vip: 0.3 },
  },
  {
    id: 'loyal_fan', label: 'Loyal Fan/Enthusiast', baseShare: 0.28, tier: 'lower', comfortablePrice: 100,
    concessionMultiplier: { franchise_store: 1.8, food_stall_premium: 1.3, food_stall_basic: 1.0, bar: 0.9, vending: 0.9, mascot: 0.5, fan_zone: 0.8, restaurant_vip: 0.4 },
  },
  {
    id: 'corporate', label: 'Corporate/Wealthy', baseShare: 0.12, tier: 'courtside', comfortablePrice: 600,
    concessionMultiplier: { restaurant_vip: 3.5, food_stall_premium: 1.5, franchise_store: 0.6, food_stall_basic: 0.2, bar: 0.6, vending: 0.1, mascot: 0.05, fan_zone: 0.1 },
  },
]

const TIER_CAPACITY_SHARE: Record<TierId, number> = { lower: 0.50, upper: 0.35, courtside: 0.02 }

function clamp01(v: number): number { return Math.min(1, Math.max(0, v)) }

// Per-team segment mix — reuses the two real, already-established signals
// for "how wealthy/corporate is this team's fanbase" instead of inventing a
// new one: media-market size (src/lib/merchandising.ts) and brand strength
// (teams.popularity, 0-100). Big/popular markets skew toward Corporate and
// Young Adult; small markets skew toward Family and Loyal Fan.
// `modifiers` is the live, real-only-once-a-Social-Media-Manager-runs-a-
// fan-interaction-event contents of arena_audience_modifiers (see
// src/lib/social-media-resolver.ts) — starts all-zero (no effect) and is a
// pure additive nudge on top of the market/popularity-derived baseline.
export type AudienceModifiers = Partial<Record<SegmentId, number>>

export function getTeamSegmentMix(teamId: string, popularity: number, modifiers?: AudienceModifiers): Record<SegmentId, number> {
  const market = marketMultiplier(teamId) // 0.8 (small) / 1.1 (mid) / 1.5 (large)
  const popNorm = clamp01((popularity - 50) / 50) // 0 at popularity 50, 1 at popularity 100
  const marketTilt = (market - 1.1) / 0.4 // -0.75 (small) .. 0 (mid) .. 1.0 (large)

  const raw: Record<SegmentId, number> = {
    family: 0.35 - marketTilt * 0.05 + (modifiers?.family || 0),
    young_adult: 0.25 + marketTilt * 0.03 + popNorm * 0.02 + (modifiers?.young_adult || 0),
    loyal_fan: 0.28 - marketTilt * 0.02 + (modifiers?.loyal_fan || 0),
    corporate: 0.12 + marketTilt * 0.04 + popNorm * 0.04 + (modifiers?.corporate || 0),
  }
  const total = Object.values(raw).reduce((s, v) => s + Math.max(0, v), 0)
  const out = {} as Record<SegmentId, number>
  for (const s of SEGMENTS) out[s.id] = Math.max(0, raw[s.id]) / total
  return out
}

// price==comfortable -> 1; price==2x comfortable -> 0; above comfortable and
// below 2x -> straight-line taper. This is what makes an absurd price (e.g.
// $1,000,000/ticket) actually collapse attendance instead of selling out
// regardless of price, and what makes a fair price a non-factor (no bonus
// for going cheap — real fans don't attend twice as often at half price).
export function priceFactor(price: number, comfortablePrice: number): number {
  if (price <= comfortablePrice) return 1
  return clamp01(1 - (price - comfortablePrice) / comfortablePrice)
}

export type SegmentAttendance = { segment: SegmentId, tier: TierId, count: number }

export type AttendanceInput = {
  teamId: string
  popularity: number
  capacity: number
  winPct: number // this team's own win% — same real driver used today
  isRivalry: boolean
  isMarquee: boolean
  prices: { lower: number, upper: number, courtside: number }
  randomJitter?: number // -0.03..0.03, same spread cron/simulate already applies
  followers?: number // teams.social_media_followers — real online buzz, real curiosity to attend
  audienceModifiers?: AudienceModifiers // live arena_audience_modifiers row, if any
}

export type AttendanceResult = {
  attendance: number
  attRate: number
  segments: SegmentAttendance[]
}

// Replaces the old baseAttRate/attRate/attendance calc in
// cron/simulate/route.ts (previously: 0.65 + winPct*0.20 + rivalry*0.08 +
// marquee*0.15, with ZERO price input). Same overall-interest driver as
// before — now allocated across segments and gated by real ticket prices,
// still collapsing to one attRate/attendance number so game-simulator.ts's
// existing crowd-boost consumption needs no changes.
export function computeGameAttendance(input: AttendanceInput): AttendanceResult {
  // Real online following adds modest extra curiosity to attend — same
  // capped log-scale bonus merchandising.ts uses for fame, small relative to
  // the existing win%/rivalry/marquee drivers (buzz brings people out, it
  // doesn't replace wanting to see a good team play).
  const overallInterest = Math.min(0.98,
    0.65 + input.winPct * 0.20 + (input.isRivalry ? 0.08 : 0) + (input.isMarquee ? 0.15 : 0)
    + followersBonus(input.followers) * 0.05
    + (input.randomJitter ?? 0))

  const mix = getTeamSegmentMix(input.teamId, input.popularity, input.audienceModifiers)
  const tierPrice: Record<TierId, number> = { lower: input.prices.lower, upper: input.prices.upper, courtside: input.prices.courtside }
  const tierCapacity: Record<TierId, number> = {
    lower: input.capacity * TIER_CAPACITY_SHARE.lower,
    upper: input.capacity * TIER_CAPACITY_SHARE.upper,
    courtside: input.capacity * TIER_CAPACITY_SHARE.courtside,
  }

  // Loyal fans' price tolerance rises with team quality — success buys
  // patience for a price hike, the one segment-specific quality effect.
  const loyalFanComfort = (SEGMENTS.find(s => s.id === 'loyal_fan')!.comfortablePrice) * (1 + input.winPct * 0.5)

  const rawDemand: Record<SegmentId, number> = {} as any
  for (const s of SEGMENTS) {
    const comfortable = s.id === 'loyal_fan' ? loyalFanComfort : s.comfortablePrice
    const pf = priceFactor(tierPrice[s.tier], comfortable)
    rawDemand[s.id] = overallInterest * mix[s.id] * input.capacity * pf
  }

  // Segments sharing a tier (young_adult + loyal_fan both prefer 'lower')
  // compete for the same seats — scale down proportionally if combined
  // demand exceeds that tier's real capacity, same as any sold-out section.
  const demandByTier: Record<TierId, number> = { lower: 0, upper: 0, courtside: 0 }
  for (const s of SEGMENTS) demandByTier[s.tier] += rawDemand[s.id]

  const segments: SegmentAttendance[] = []
  let attendance = 0
  for (const s of SEGMENTS) {
    const tierDemand = demandByTier[s.tier]
    const tierCap = tierCapacity[s.tier]
    const scale = tierDemand > tierCap && tierDemand > 0 ? tierCap / tierDemand : 1
    const count = Math.round(rawDemand[s.id] * scale)
    segments.push({ segment: s.id, tier: s.tier, count })
    attendance += count
  }

  return { attendance, attRate: input.capacity > 0 ? attendance / input.capacity : 0, segments }
}

// ── CONCESSIONS ───────────────────────────────────────────────────
// Single source of truth for adoption_rate/avg_spend/fixed_per_game, moved
// out of ArenaBlueprint.tsx so the server-side revenue calc and the client
// display use the exact same numbers.
export type SlotEconomics = { adoptionRate: number, avgSpend: number, fixedPerGame?: number, cost: number, monthly: number, maxTotal: number }
export const SLOT_ECONOMICS: Record<string, SlotEconomics> = {
  food_stall_basic: { adoptionRate: 25, avgSpend: 8, cost: 500000, monthly: 5000, maxTotal: 6 },
  food_stall_premium: { adoptionRate: 18, avgSpend: 18, cost: 1500000, monthly: 12000, maxTotal: 2 },
  bar: { adoptionRate: 15, avgSpend: 14, cost: 800000, monthly: 8000, maxTotal: 2 },
  vending: { adoptionRate: 20, avgSpend: 4, cost: 200000, monthly: 1000, maxTotal: 6 },
  restaurant_vip: { adoptionRate: 4, avgSpend: 65, cost: 3000000, monthly: 20000, maxTotal: 1 },
  franchise_store: { adoptionRate: 12, avgSpend: 35, cost: 2000000, monthly: 10000, maxTotal: 1 },
  fan_zone: { adoptionRate: 10, avgSpend: 20, cost: 2500000, monthly: 12000, maxTotal: 1 },
  corporate_suites: { adoptionRate: 100, avgSpend: 0, fixedPerGame: 8000, cost: 5000000, monthly: 30000, maxTotal: 3 },
  club_seats: { adoptionRate: 100, avgSpend: 0, fixedPerGame: 40000, cost: 3000000, monthly: 15000, maxTotal: 1 },
  courtside_lounge: { adoptionRate: 100, avgSpend: 0, fixedPerGame: 120000, cost: 8000000, monthly: 50000, maxTotal: 1 },
  jumbotron: { adoptionRate: 0, avgSpend: 0, fixedPerGame: 15000, cost: 4000000, monthly: 20000, maxTotal: 1 },
  mascot: { adoptionRate: 0, avgSpend: 0, fixedPerGame: 5000, cost: 500000, monthly: 3000, maxTotal: 1 },
}

// Concession slot variant columns (arena_concessions table) grouped by base
// slot id — mirrors ArenaBlueprint.tsx's SLOTS[].variants[].key list.
export const SLOT_VARIANT_KEYS: Record<string, string[]> = {
  food_stall_basic: ['food_stall_basic_north', 'food_stall_basic_south', 'food_stall_basic_east', 'food_stall_basic_west'],
  food_stall_premium: ['food_stall_premium_north', 'food_stall_premium_south'],
  bar: ['bar_east', 'bar_west'],
  vending: ['vending_north', 'vending_south', 'vending_east', 'vending_west'],
  restaurant_vip: ['restaurant_vip'],
  franchise_store: ['franchise_store'],
  fan_zone: ['fan_zone'],
  corporate_suites: ['corporate_suites'],
  club_seats: ['club_seats'],
  courtside_lounge: ['courtside_lounge'],
  jumbotron: ['jumbotron'],
  mascot: ['mascot'],
}

// Per-variant build cap — mirrors ArenaBlueprint.tsx's SLOTS[].variants[].max
// (e.g. food_stall_basic_north caps at 2, food_stall_basic_east caps at 1 —
// NOT a uniform per-slot limit, so this can't be derived from maxTotal alone).
export const SLOT_VARIANT_MAX: Record<string, number> = {
  food_stall_basic_north: 2, food_stall_basic_south: 2, food_stall_basic_east: 1, food_stall_basic_west: 1,
  food_stall_premium_north: 1, food_stall_premium_south: 1,
  bar_east: 1, bar_west: 1,
  vending_north: 2, vending_south: 2, vending_east: 1, vending_west: 1,
  restaurant_vip: 1, franchise_store: 1, fan_zone: 1,
  corporate_suites: 3, club_seats: 1, courtside_lounge: 1, jumbotron: 1, mascot: 1,
}

export type ConcessionRevenueResult = { total: number, bySlot: Record<string, number> }

// Variable cost of goods sold — restocking food/drink/merchandise from
// suppliers, as a share of that slot's own real revenue (so it rises and
// falls with actual consumption, which already varies by who's really in
// the building that night — not a flat number). Food/drink runs a typical
// ~28-35% cost-of-goods ratio; physical merchandise (jerseys, gear) runs
// notably higher (~55%) since it's a manufactured good, not a markup on a
// cheap ingredient. Fixed_per_game slots (suites/lounge/jumbotron/mascot)
// are rental/advertising/experience fees, not goods sold — no COGS.
export const COGS_RATE: Record<string, number> = {
  food_stall_basic: 0.32,
  food_stall_premium: 0.32,
  bar: 0.28,
  vending: 0.25,
  restaurant_vip: 0.35,
  franchise_store: 0.55,
  fan_zone: 0.20,
}

// Real per-game supply cost — deducted alongside the concession revenue it's
// tied to (see ConcessionRevenueResult.bySlot), same game, same cadence.
export function computeConcessionSupplyCost(concessionRevenue: ConcessionRevenueResult): { total: number, bySlot: Record<string, number> } {
  const bySlot: Record<string, number> = {}
  let total = 0
  for (const [slotId, revenue] of Object.entries(concessionRevenue.bySlot)) {
    const rate = COGS_RATE[slotId]
    if (!rate) continue // fixed_per_game slots: no COGS
    bySlot[slotId] = Math.round(revenue * rate)
    total += bySlot[slotId]
  }
  return { total, bySlot }
}

// Real per-game concession revenue — replaces ArenaBlueprint.tsx's client-side
// estimate (which assumed a flat 13,000 fans regardless of the team's real
// arena size or this game's actual attendance) with this game's real
// segment-weighted attendance.
export function computeGameConcessionRevenue(
  segments: SegmentAttendance[],
  concessionCounts: Record<string, number>, // slot id -> built quantity (summed across variants)
): ConcessionRevenueResult {
  const bySlot: Record<string, number> = {}
  let total = 0
  for (const [slotId, qty] of Object.entries(concessionCounts)) {
    if (!qty) continue
    const econ = SLOT_ECONOMICS[slotId]
    if (!econ) continue

    let revenue = (econ.fixedPerGame || 0) * qty

    if (econ.adoptionRate > 0 && econ.avgSpend > 0) {
      // Weight each segment's attendance by its relative propensity for this
      // slot, normalized so a league-average crowd mix reproduces the base
      // adoption_rate (no double-counting vs. the slot's own tuned rate).
      let weightedAttendance = 0, weightTotal = 0
      for (const s of SEGMENTS) {
        const mult = s.concessionMultiplier[slotId] ?? 1
        weightTotal += s.baseShare * mult
      }
      for (const sa of segments) {
        const seg = SEGMENTS.find(s => s.id === sa.segment)!
        const mult = seg.concessionMultiplier[slotId] ?? 1
        weightedAttendance += sa.count * (mult / (weightTotal || 1))
      }
      revenue += (econ.adoptionRate / 100) * econ.avgSpend * weightedAttendance * qty
    }

    bySlot[slotId] = Math.round(revenue)
    total += bySlot[slotId]
  }
  return { total, bySlot }
}

export function computeGameTicketRevenue(segments: SegmentAttendance[], prices: { lower: number, upper: number, courtside: number }): number {
  const tierPrice: Record<TierId, number> = { lower: prices.lower, upper: prices.upper, courtside: prices.courtside }
  return Math.round(segments.reduce((sum, s) => sum + s.count * tierPrice[s.tier], 0))
}

// Game-day operations — security, ushers/stewards, ticket-office staff,
// cleaning crew, electricians, sound/light techs, in-game entertainment
// (cheerleaders/mascot performers/DJ). Real per-game cost, not a flat
// monthly guess: a bigger building needs a bigger baseline crew regardless
// of turnout (BASE_RATE_PER_SEAT x real capacity), plus extra stewards/
// security for however many fans actually show up (VARIABLE_RATE_PER_FAN x
// real attendance) — same "fixed overhead + real demand" split already
// used for concession supply costs above.
const GAME_OPS_BASE_RATE_PER_SEAT = 2.5
const GAME_OPS_VARIABLE_RATE_PER_FAN = 1.5
export function computeGameOperationsCost(capacity: number, attendance: number): number {
  return Math.round(capacity * GAME_OPS_BASE_RATE_PER_SEAT + attendance * GAME_OPS_VARIABLE_RATE_PER_FAN)
}

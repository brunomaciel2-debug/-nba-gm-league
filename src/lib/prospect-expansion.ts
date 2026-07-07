// Draft Class upload — Bruno provides the Draft Class himself via a CSV he
// fills in Excel, not a fictional auto-generator. Since a human filling one
// row per prospect can't realistically hand-enter all 54 internal engine
// attributes (SHARED_ATTRS in draft-resolver.ts, including 24 `pot_*`
// potential shadows and dev_rate/potential_grade), the template only asks
// for what a real scout would actually judge — identity fields plus 6
// category ratings — and expandProspectRow() below fleshes that out into
// the full attribute block the existing resolver already consumes
// unchanged.

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'
export type PotentialTier = 'Elite' | 'High' | 'Medium' | 'Low'

export const TEMPLATE_COLUMNS = [
  'name', 'pos', 'age', 'nationality', 'college', 'height_in', 'weight_lbs',
  'overall', 'potential_tier', 'three', 'finishing', 'playmaking', 'defense', 'rebounding', 'mental',
] as const

export const TEMPLATE_EXAMPLE_ROWS: Record<string, string>[] = [
  { name: 'Jalen Whitfield', pos: 'PG', age: '19', nationality: 'USA', college: 'Duke', height_in: '75', weight_lbs: '185',
    overall: '78', potential_tier: 'Elite', three: '72', finishing: '65', playmaking: '85', defense: '60', rebounding: '40', mental: '68' },
  { name: 'Marko Ivanovic', pos: 'C', age: '20', nationality: 'Serbia', college: '', height_in: '84', weight_lbs: '245',
    overall: '70', potential_tier: 'Medium', three: '35', finishing: '78', playmaking: '45', defense: '72', rebounding: '80', mental: '60' },
]

const REQUIRED_COLUMNS = ['name', 'pos', 'age', 'overall', 'potential_tier', 'three', 'finishing', 'playmaking', 'defense', 'rebounding', 'mental']
const VALID_POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
const VALID_TIERS: PotentialTier[] = ['Elite', 'High', 'Medium', 'Low']

export interface TemplateRow {
  name: string; pos: Position; age: number
  nationality?: string; college?: string; height_in?: number; weight_lbs?: number
  overall: number; potential_tier: PotentialTier
  three: number; finishing: number; playmaking: number; defense: number; rebounding: number; mental: number
}

export function validateRow(raw: Record<string, string>, rowIndex: number): { row?: TemplateRow, errors: string[] } {
  const errors: string[] = []
  for (const col of REQUIRED_COLUMNS) {
    if (!raw[col] || !String(raw[col]).trim()) errors.push(`Row ${rowIndex}: missing required column "${col}"`)
  }
  if (errors.length) return { errors }

  const pos = String(raw.pos).trim().toUpperCase() as Position
  if (!VALID_POSITIONS.includes(pos)) errors.push(`Row ${rowIndex}: invalid position "${raw.pos}" (must be PG/SG/SF/PF/C)`)
  const tier = String(raw.potential_tier).trim() as PotentialTier
  if (!VALID_TIERS.includes(tier)) errors.push(`Row ${rowIndex}: invalid potential_tier "${raw.potential_tier}" (must be Elite/High/Medium/Low)`)

  const numFields = ['age', 'overall', 'three', 'finishing', 'playmaking', 'defense', 'rebounding', 'mental'] as const
  const nums: Record<string, number> = {}
  for (const f of numFields) {
    const n = Number(raw[f])
    if (!Number.isFinite(n)) { errors.push(`Row ${rowIndex}: "${f}" must be a number`); continue }
    const [lo, hi] = f === 'age' ? [16, 40] : [0, 99]
    if (n < lo || n > hi) errors.push(`Row ${rowIndex}: "${f}" must be between ${lo} and ${hi}`)
    nums[f] = n
  }
  if (errors.length) return { errors }

  return {
    errors: [],
    row: {
      name: String(raw.name).trim(), pos, age: nums.age,
      nationality: raw.nationality?.trim() || 'USA', college: raw.college?.trim() || undefined,
      height_in: raw.height_in ? Number(raw.height_in) : undefined, weight_lbs: raw.weight_lbs ? Number(raw.weight_lbs) : undefined,
      overall: nums.overall, potential_tier: tier,
      three: nums.three, finishing: nums.finishing, playmaking: nums.playmaking,
      defense: nums.defense, rebounding: nums.rebounding, mental: nums.mental,
    },
  }
}

const clamp = (v: number) => Math.max(0, Math.min(99, Math.round(v)))
const jitter = (v: number, spread = 6) => v + (Math.random() * spread * 2 - spread)

// Position-aware offsets — a small nudge on top of the category anchor,
// reflecting real archetype tendencies (bigs finish above the rim and
// protect it, guards handle/pass/defend the perimeter).
const POS_OFFSET: Record<Position, Partial<Record<string, number>>> = {
  PG: { ball_hdl: 8, pass_iq: 8, pass_vis: 6, speed: 6, agility: 6, strength: -6, off_reb: -10, standing_dunk: -10 },
  SG: { three: 4, speed: 3, agility: 3, idef: -2 },
  SF: {},
  PF: { off_reb: 6, def_reb: 6, strength: 6, standing_dunk: 4, speed: -3, three: -4 },
  C: { off_reb: 10, def_reb: 10, idef: 8, standing_dunk: 10, strength: 10, speed: -8, agility: -6, three: -12, ball_hdl: -8 },
}

const TIER_GAP: Record<PotentialTier, [number, number]> = {
  Elite: [15, 20], High: [8, 14], Medium: [3, 7], Low: [0, 2],
}
const TIER_DEV_RATE: Record<PotentialTier, [number, number]> = {
  Elite: [1.3, 1.5], High: [1.0, 1.2], Medium: [0.8, 1.0], Low: [0.6, 0.8],
}

function withOffset(base: number, pos: Position, attr: string): number {
  return clamp(jitter(base + (POS_OFFSET[pos][attr] || 0)))
}

// Expands a scout's-eye-view template row into the full 54-attribute
// SHARED_ATTRS block draft-resolver.ts already consumes unchanged.
export function expandProspectRow(row: TemplateRow) {
  const { pos, overall, three, finishing, playmaking, defense, rebounding, mental } = row

  const base: Record<string, number> = {
    three: withOffset(three, pos, 'three'),
    layup: withOffset(finishing, pos, 'layup'),
    dunk: withOffset(finishing, pos, 'dunk'),
    close_shot: withOffset(finishing, pos, 'close_shot'),
    standing_dunk: withOffset(finishing, pos, 'standing_dunk'),
    ball_hdl: withOffset(playmaking, pos, 'ball_hdl'),
    pass_vis: withOffset(playmaking, pos, 'pass_vis'),
    pass_iq: withOffset(playmaking, pos, 'pass_iq'),
    assist_role: withOffset(playmaking, pos, 'assist_role'),
    idef: withOffset(defense, pos, 'idef'),
    pdef: withOffset(defense, pos, 'pdef'),
    blk: withOffset(defense, pos, 'blk'),
    stl: withOffset(defense, pos, 'stl'),
    off_reb: withOffset(rebounding, pos, 'off_reb'),
    def_reb: withOffset((defense + rebounding) / 2, pos, 'def_reb'),
    pressure: withOffset(mental, pos, 'pressure'),
    consistency: withOffset(mental, pos, 'consistency'),
    streaky: withOffset(100 - mental, pos, 'streaky'), // higher mental = steadier, less streaky
    durability: withOffset(mental, pos, 'durability'),
    crowd_effect: clamp(jitter(50, 15)), // neutral-anchored, real variance not tied to a scouted category
    // No dedicated scouting category — sensible position/overall-scaled defaults.
    mid: withOffset(overall * 0.8, pos, 'mid'),
    ft: withOffset(overall * 0.85, pos, 'ft'),
    siq: withOffset(overall * 0.8, pos, 'siq'),
    draw_foul: withOffset(overall * 0.75, pos, 'draw_foul'),
    stamina: withOffset(70, pos, 'stamina'),
    agility: withOffset(70, pos, 'agility'),
    speed: withOffset(70, pos, 'speed'),
    strength: withOffset(60, pos, 'strength'),
    trash_talk: clamp(jitter(50, 20)),
    usage: withOffset(overall * 0.7, pos, 'usage'),
  }
  const [gapLo, gapHi] = TIER_GAP[row.potential_tier]
  const gap = () => gapLo + Math.random() * (gapHi - gapLo)
  const pot: Record<string, number> = {}
  for (const key of ['three', 'layup', 'dunk', 'mid', 'ft', 'siq', 'draw_foul', 'blk', 'stl', 'idef', 'pdef',
    'def_reb', 'off_reb', 'stamina', 'durability', 'ball_hdl', 'pass_vis', 'pass_iq', 'assist_role',
    'pressure', 'consistency', 'speed', 'agility', 'strength', 'close_shot', 'standing_dunk']) {
    pot[`pot_${key}`] = clamp((base[key] ?? 60) + gap())
  }

  const [devLo, devHi] = TIER_DEV_RATE[row.potential_tier]
  const dev_rate = +(devLo + Math.random() * (devHi - devLo)).toFixed(2)
  const potential_grade = row.potential_tier === 'Elite' ? 'A' : row.potential_tier === 'High' ? (Math.random() < 0.5 ? 'A' : 'B') : null

  return { ...base, ...pot, potential_grade, dev_rate }
}

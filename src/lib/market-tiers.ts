// Pure market-size/reach formulas — deliberately zero imports (no
// supabaseAdmin, no notify helpers) so this file is safe to import from
// BOTH server code (merchandising.ts) AND client components
// (audience-segments.ts is used inside ArenaView.tsx). Importing these
// straight from merchandising.ts pulled in notifications.ts's unconditional
// `createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)` at module
// scope, which crashed every team page client-side ("supabaseKey is
// required") the moment TeamPageTabs.tsx's static import of ArenaView.tsx
// evaluated that chain in the browser, where the service-role key is never
// inlined.

// Real NBA media-market size — a star's jersey sales depend heavily on
// market reach, not just talent (LeBron in LA outsells an equally good
// player in Memphis by miles). Tiered from real Nielsen DMA/metro rankings:
// Large = the traditional top-8 US media markets plus Toronto (the only
// Canadian team — unique national-reach status of its own).
export const LARGE_MARKETS = new Set(['LAL','LAC','NYK','BKN','CHI','GSW','BOS','DAL','TOR'])
export const SMALL_MARKETS = new Set(['ORL','CHA','SAS','IND','CLE','MIL','UTA','NOP','MEM','OKC'])
// Everything else (PHI, HOU, MIA, ATL, WAS, PHX, DET, MIN, DEN, SAC, POR) is mid-market.

// Amplifies star power specifically — a scrub sitting near the fame floor
// barely moves regardless of market, but the bonus a real star earns from
// quality/form/awards gets multiplied up in a big market and dampened in a
// small one.
export function marketMultiplier(teamId: string): number {
  if (LARGE_MARKETS.has(teamId)) return 1.5
  if (SMALL_MARKETS.has(teamId)) return 0.8
  return 1.1
}

// Truly transcendent talent (think LeBron, Doncic, Ant Edwards, Curry —
// real_ovr in the low-to-mid 90s+) carries its own fame wherever it goes —
// these players make the FRANCHISE popular, not the other way around, so
// their market multiplier has a real floor instead of being dragged down
// by a small market the way a merely-very-good player's would be.
const TRANSCENDENT_OVR = 93

// Real online/social following on top of the base media-market — same
// premise jersey sales already runs on ("national reach, not just the
// arena — a lot of sales are online"). Log-scaled so it takes real,
// sustained follower growth to matter: negligible below 50K, capped out
// around 5M (a top-tier global fanbase), not a runaway multiplier.
export function followersBonus(followers: number | null | undefined): number {
  if (!followers || followers <= 50000) return 0
  return Math.min(1, Math.log10(followers / 50000) / 2)
}

export function effectiveMarketMultiplier(realOvr: number, teamId: string, followers?: number | null): number {
  const base = marketMultiplier(teamId) * (1 + followersBonus(followers) * 0.15)
  return realOvr >= TRANSCENDENT_OVR ? Math.max(base, 1.3) : base
}

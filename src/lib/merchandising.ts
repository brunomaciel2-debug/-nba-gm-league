import { supabaseAdmin } from '@/lib/supabase'
import { notify } from '@/lib/notifications'
import { getTeamLang, notifJerseySalesReport } from '@/lib/notifications-helpers'
import { legacyFameFloor } from '@/lib/merchandising-legacy-rank'
// Pure market-tier formulas live in market-tiers.ts (zero server imports) so
// audience-segments.ts — used inside client components like ArenaView.tsx —
// can use them without pulling in this file's server-only notify imports.
// Re-exported here so every existing call site importing from
// '@/lib/merchandising' keeps working unchanged.
import { marketMultiplier, followersBonus, effectiveMarketMultiplier } from '@/lib/market-tiers'
export { marketMultiplier, followersBonus, effectiveMarketMultiplier }

const SEASON = '2025-26'

// Jersey sales are online/national reach (already the whole premise of this
// system) — for an international player that reach extends to a home
// country that often follows him more intensely than the NBA's own US fans
// do (Doncic in Slovenia, Jokic in Serbia, Giannis in Greece — basketball
// is close to a national religion in these places). This is a REAL, distinct
// driver from US team market size, so it applies on top of it, not instead
// of it. Tiered by real basketball culture/passion relative to population,
// not just country size — a huge but basketball-indifferent nation gets
// nothing here, a small basketball-mad one gets a big multiplier.
const NATIONALITY_BOOST: Record<string, number> = {
  'Slovenia': 1.4, 'Serbia': 1.3, 'Lithuania': 1.3, 'Greece': 1.3, 'Latvia': 1.3,
  'Montenegro': 1.25, 'Canada': 1.25, 'France': 1.2, 'Croatia': 1.2, 'Japan': 1.2,
  'Turkey': 1.15, 'Spain': 1.15, 'Australia': 1.15, 'Germany': 1.15,
  'Cameroon': 1.15, 'Nigeria': 1.15, 'Dominican Republic': 1.15, 'Puerto Rico': 1.15, 'Argentina': 1.15,
  'Senegal': 1.1, 'Bahamas': 1.1, 'Italy': 1.1, 'Israel': 1.1, 'Brazil': 1.1,
  'Great Britain': 1.05, 'New Zealand': 1.05, 'Georgia': 1.05, 'Czech Republic': 1.05, 'Finland': 1.05,
}
// Real player data uses a few different spellings for the same country
// (e.g. seeded from different sources at different times) — normalize the
// known ones so the boost still applies regardless of which spelling a
// given player record happens to use.
const NATIONALITY_ALIASES: Record<string, string> = {
  'Dominican Rep.': 'Dominican Republic',
  'England': 'Great Britain', 'United Kingdom': 'Great Britain',
}
export function nationalityMultiplier(nationality: string | null | undefined): number {
  if (!nationality) return 1.0
  const canonical = NATIONALITY_ALIASES[nationality] || nationality
  return NATIONALITY_BOOST[canonical] || 1.0
}

// Quality-driven star power — the PRIMARY, dominant driver of fame. This
// league's best players cluster tightly in real_ovr 92-98, yet real-world
// popularity spreads MUCH wider across that same narrow band (a 94-ovr
// All-Star and a 98-ovr generational talent are not equally famous) — so
// the curve steepens hard past 90, while staying gentle below it (a merely-
// very-good starter, ~85 ovr, must never out-rank a genuine superstar, ~96
// ovr, just because of a bigger market or a hotter recent week — quality is
// the foundation, market/form/awards only modulate on top of it).
function starPower(realOvr: number): number {
  if (realOvr <= 55) return 0
  if (realOvr <= 80) return (realOvr - 55) * 1.0
  if (realOvr <= 90) return 25 + (realOvr - 80) * 2.0
  if (realOvr <= 95) return 45 + (realOvr - 90) * 5.0
  return 70 + (realOvr - 95) * 8.0
}

// Jersey sales are real-world power-law distributed — a bench player is
// background noise, a top-10-15 seller (Kawhi tier, fame ~75-85) moves a
// few thousand to ~10K units/month, and a true global superstar (LeBron/
// Curry/Wemby tier, fame ~90+) moves tens of thousands/month — in line
// with real reported NBA jersey sales volumes.
const UNITS_BASE = 3.6
const UNITS_K = 0.095
// The team's real NET cut per jersey sold (post manufacturer/league
// royalty split — NOT the ~$120 retail price a fan pays), calibrated so a
// superstar's jersey income is a serious but not absurd revenue stream
// next to the ~$450K/mo the existing Finances projections use for tickets.
const NET_REVENUE_PER_JERSEY = 14

export function jerseyUnitsSold(fame: number): number {
  return Math.round(UNITS_BASE * Math.exp(UNITS_K * fame))
}
export function jerseyRevenue(fame: number): number {
  return jerseyUnitsSold(fame) * NET_REVENUE_PER_JERSEY
}

// Deserved monthly fame target — quality is the dominant term; recent form
// vs. the player's own season average (same comparison already built for
// Power Rankings/morale, generalized here), team win%, a recent award bump,
// and market size all modulate it by a smaller amount on top — they can
// push a great player further into stardom or hold a modest one back a
// little, but they can never flip the ranking between two players of
// clearly different quality tiers.
//
// fame is a HIDDEN attribute (never shown to the GM directly — only its
// real-world effect, jersey sales, is observable) and moves in small,
// residual monthly steps (see DRIFT_RATE below) — a single hot month barely
// registers; real fan-favorite status only builds from sustained
// consistency over many months, same as in real life.
export function fameTarget(opts: {
  realOvr: number, recentAvgPts: number | null, seasonAvgPts: number | null,
  winPct: number, hasRecentAward: boolean, marketMultiplier: number, nationalityMultiplier?: number,
  legacyFloor?: number | null,
}): number {
  const base = starPower(opts.realOvr)
  let modul = 0
  if (opts.recentAvgPts != null && opts.seasonAvgPts != null && opts.seasonAvgPts >= 2) {
    modul += Math.max(-6, Math.min(6, (opts.recentAvgPts / opts.seasonAvgPts - 1) * 15))
  }
  if (opts.hasRecentAward) modul += 6
  modul += (opts.winPct - 0.5) * 6
  // Market (US team reach) and nationality (home-country reach) are
  // distinct, independent audiences, so they combine multiplicatively —
  // a small-market player with a huge home-country following (or vice
  // versa) still gets real credit for the audience he does have.
  const reachMultiplier = opts.marketMultiplier * (opts.nationalityMultiplier || 1)
  const marketBonus = (reachMultiplier - 1) * base * 0.25
  const qualityTarget = 8 + base + marketBonus + modul
  // A real-world legacy/name-recognition floor (see merchandising-legacy-
  // rank.ts) — a player is at least as famous as his real reputation says,
  // but genuine in-game brilliance can still push him higher.
  const target = opts.legacyFloor != null ? Math.max(qualityTarget, opts.legacyFloor) : qualityTarget
  return Math.max(3, Math.min(99, target))
}

// Initial seed — same formula as the monthly target, evaluated with neutral
// inputs (no form/award/win-record data yet). Kept as one shared formula so
// the day-one fame value and the ongoing drift target can never diverge.
export function initialFame(realOvr: number, teamMarketMultiplier: number, nationalityMult: number = 1, legacyFloor: number | null = null): number {
  return Math.round(fameTarget({
    realOvr, recentAvgPts: null, seasonAvgPts: null, winPct: 0.5,
    hasRecentAward: false, marketMultiplier: teamMarketMultiplier, nationalityMultiplier: nationalityMult, legacyFloor,
  }))
}

// Residual monthly movement — deliberately slow. A single great or bad
// month should barely move the needle; real fan-favorite status has to be
// earned through sustained performance over many months.
const DRIFT_RATE = 0.07

// Ad campaign — spends money to run ads/promo using a player's image to
// sell MORE JERSEYS for one month. This does NOT touch the player's
// underlying (hidden) fame — it's a temporary sales push, not a way to buy
// popularity. Whether it actually works still depends on real timing: the
// player has to still be performing when the campaign runs, or the money's
// wasted. This is also how a GM "tests" whether a surprising breakout
// player is genuinely marketable, without it ever changing his real,
// slow-moving fame number.
// New-team jersey hype — real fans want the new jersey the moment a player
// lands somewhere, especially a popular one (a superstar traded to a new
// team is a real, well-known jersey-sales spike; a bench player picked up
// off waivers barely registers). Scales with fame (the same hidden
// popularity driver as normal sales) so it can never make a nobody outsell
// an actual star, it just adds real curiosity-buying on top for however
// famous he already is. Peaks the month he actually joined, roughly halves
// the month after, then fades — same "first weeks" window Bruno described.
const ACQUISITION_BOOST_BASE = 0.15
const ACQUISITION_BOOST_FAME_SCALE = 1.6
function acquisitionBoostMultiplier(fame: number, monthsSinceAcquired: number): number {
  const peak = ACQUISITION_BOOST_BASE + (fame / 100) * ACQUISITION_BOOST_FAME_SCALE
  if (monthsSinceAcquired === 0) return 1 + peak
  if (monthsSinceAcquired === 1) return 1 + peak * 0.4
  return 1
}

function resolveCampaignSalesBoost(campaign: any, hadGamesThisMonth: boolean, stillGood: boolean): { multiplier: number, status: string, note: string } {
  if (hadGamesThisMonth && stillGood) {
    return { multiplier: 1 + campaign.sales_boost_pct / 100, status: 'completed', note: 'Ad campaign landed — real sales bump this month.' }
  }
  if (!hadGamesThisMonth) {
    return { multiplier: 1, status: 'backfired', note: "Ad campaign backfired — player barely played, the ads had nothing to sell." }
  }
  return { multiplier: 1, status: 'backfired', note: 'Ad campaign backfired — player slumped well below his season form.' }
}

// Month-end resolver: drifts every active player's hidden fame toward its
// deserved target, resolves any ad campaign that started this month into a
// real sales boost or a wasted-money backfire, records a real jersey-sales
// report per player (units + revenue — what the GM actually sees), rolls
// the team total into a real franchise_transactions/balance update (same
// pattern as the existing medical-bill expense insert in
// cron/simulate/route.ts), and notifies each team of the month's top seller.
export async function resolveMonthlyMerchandising(week: number): Promise<{ teams: number, players: number }> {
  const monthNum = Math.floor(week / 4)

  // Idempotency guard — if this month was already resolved (e.g. the cron
  // fired twice), bail out instead of double-posting revenue to every team's
  // balance. This was a real bug: month 4 was processed twice and credited
  // every team's jersey revenue in duplicate before this guard existed.
  const { count: alreadyDone } = await supabaseAdmin.from('jersey_sales_reports')
    .select('id', { count: 'exact', head: true }).eq('season', SEASON).eq('month_num', monthNum)
  if (alreadyDone && alreadyDone > 0) {
    console.log(`Merchandising for month ${monthNum} already resolved (${alreadyDone} reports) — skipping.`)
    return { teams: 0, players: 0 }
  }

  const monthStartWeek = (monthNum - 1) * 4 + 1
  const monthEndWeek = monthNum * 4

  const { data: players } = await supabaseAdmin.from('players')
    .select('id,name,team_id,real_ovr,fame,nationality').eq('status', 'active').not('team_id', 'is', null)
  if (!players?.length) return { teams: 0, players: 0 }
  const playerIds = players.map((p: any) => p.id)

  const { data: teams } = await supabaseAdmin.from('teams').select('id,wins,losses,social_media_followers')
    .not('id', 'in', '(ALL,RVS,ROO,SOP)')
  const winPctByTeam: Record<string, number> = {}
  const followersByTeam: Record<string, number> = {}
  ;(teams || []).forEach((t: any) => {
    const gp = (t.wins||0)+(t.losses||0); winPctByTeam[t.id] = gp > 0 ? (t.wins||0)/gp : 0.5
    followersByTeam[t.id] = t.social_media_followers || 0
  })

  // This month's games only — same window the Awards block already uses
  // for Player of the Month, so "recent form" here means "this month".
  // `games` has no `season` column (single-season table, confirmed live) —
  // filtering on it silently returns nothing and was found live while
  // testing this exact query shape, copied from the Awards block below,
  // which had the same bug.
  const { data: monthGames } = await supabaseAdmin.from('games').select('id')
    .gte('week_number', monthStartWeek).lte('week_number', monthEndWeek)
  const monthGameIds = (monthGames || []).map((g: any) => g.id)
  const { data: monthBoxes } = monthGameIds.length ? await supabaseAdmin.from('box_scores')
    .select('player_id,pts').in('player_id', playerIds).in('game_id', monthGameIds) : { data: [] as any[] }
  const monthPtsByPlayer: Record<string, { sum: number, games: number }> = {}
  ;(monthBoxes || []).forEach((b: any) => {
    const r = (monthPtsByPlayer[b.player_id] ||= { sum: 0, games: 0 })
    r.sum += b.pts || 0; r.games++
  })

  const { data: seasonStats } = await supabaseAdmin.from('player_stats')
    .select('player_id,pts,games').eq('season', SEASON).in('player_id', playerIds)
  const seasonAvgByPlayer: Record<string, number> = {}
  ;(seasonStats || []).forEach((s: any) => { if (s.games > 0) seasonAvgByPlayer[s.player_id] = s.pts / s.games })

  const { data: recentAwards } = await supabaseAdmin.from('awards')
    .select('player_id').eq('season', SEASON).in('player_id', playerIds)
    .or(`period.eq.month_${monthNum},period.in.(${Array.from({length:4},(_,i)=>`week_${monthStartWeek+i}`).join(',')})`)
  const awardedPlayerSet = new Set((recentAwards || []).map((a: any) => a.player_id))

  const { data: activeCampaigns } = await supabaseAdmin.from('marketing_campaigns')
    .select('*').eq('status', 'active').in('player_id', playerIds)
  const campaignByPlayer: Record<string, any> = {}
  ;(activeCampaigns || []).forEach((c: any) => { campaignByPlayer[c.player_id] = c })

  // Most recent trade/signing/draft landing each player on his CURRENT team
  // — only that matters for "just joined" hype, not his whole transfer
  // history. Ordered so .find() below picks the latest one per player.
  const { data: acquisitions } = await supabaseAdmin.from('player_transactions')
    .select('player_id,to_team_id,type,week_number').in('player_id', playerIds)
    .in('type', ['trade', 'fa_signing', 'draft']).order('week_number', { ascending: false })
  const latestAcquisitionByPlayer: Record<string, any> = {}
  ;(acquisitions || []).forEach((a: any) => { if (!latestAcquisitionByPlayer[a.player_id]) latestAcquisitionByPlayer[a.player_id] = a })

  const revenueByTeam: Record<string, number> = {}
  const topSellerByTeam: Record<string, { name: string, revenue: number }> = {}
  const reportRows: any[] = []
  const campaignUpdates: { id: string, status: string, result_note: string }[] = []
  const playerFameUpdates: { id: string, fame: number }[] = []

  for (const p of players) {
    const monthStat = monthPtsByPlayer[p.id]
    const recentAvgPts = monthStat && monthStat.games > 0 ? monthStat.sum / monthStat.games : null
    const seasonAvgPts = seasonAvgByPlayer[p.id] ?? null
    const winPct = winPctByTeam[p.team_id] ?? 0.5
    const hasRecentAward = awardedPlayerSet.has(p.id)

    // Fame itself — quality/form/wins/awards/market only. No campaign
    // influence here: an ad campaign sells more jerseys, it doesn't buy
    // popularity.
    const target = fameTarget({
      realOvr: p.real_ovr || 70, recentAvgPts, seasonAvgPts, winPct, hasRecentAward,
      marketMultiplier: effectiveMarketMultiplier(p.real_ovr || 70, p.team_id, followersByTeam[p.team_id]),
      nationalityMultiplier: nationalityMultiplier(p.nationality),
      legacyFloor: legacyFameFloor(p.name),
    })
    const newFame = Math.round(Math.max(0, Math.min(100, (p.fame ?? 50) + (target - (p.fame ?? 50)) * DRIFT_RATE)))
    playerFameUpdates.push({ id: p.id, fame: newFame })

    let units = jerseyUnitsSold(newFame)
    let campaignNote: string | null = null
    let acquisitionNote: string | null = null

    // New-team jersey hype — only counts an acquisition that actually
    // landed him on the team he's CURRENTLY on (a since-reversed old trade
    // shouldn't keep boosting him forever), and only within its first two
    // months.
    const acquisition = latestAcquisitionByPlayer[p.id]
    if (acquisition && acquisition.to_team_id === p.team_id && acquisition.week_number != null) {
      const acquisitionMonth = Math.floor(acquisition.week_number / 4)
      const monthsSinceAcquired = monthNum - acquisitionMonth
      if (monthsSinceAcquired >= 0 && monthsSinceAcquired <= 1) {
        const boostMult = acquisitionBoostMultiplier(newFame, monthsSinceAcquired)
        units = Math.round(units * boostMult)
        acquisitionNote = monthsSinceAcquired === 0
          ? 'New team jersey hype — just joined this month.'
          : 'New team jersey hype fading — joined last month.'
      }
    }

    // A campaign only resolves if it actually started THIS month (a fresh
    // campaign started mid-month elsewhere would still be "active" but not
    // due for resolution yet) — matches the 1-month campaign duration.
    const campaign = campaignByPlayer[p.id]
    const campaignDueThisMonth = campaign && campaign.start_week >= monthStartWeek && campaign.start_week <= monthEndWeek
    if (campaignDueThisMonth) {
      const hadGamesThisMonth = !!(monthStat && monthStat.games > 0)
      const stillGood = recentAvgPts != null && seasonAvgPts != null && seasonAvgPts >= 2
        ? recentAvgPts >= seasonAvgPts * 0.9
        : true
      const { multiplier, status, note } = resolveCampaignSalesBoost(campaign, hadGamesThisMonth, stillGood)
      units = Math.round(units * multiplier)
      campaignNote = note
      campaignUpdates.push({ id: campaign.id, status, result_note: note })
    }

    const revenue = units * NET_REVENUE_PER_JERSEY
    reportRows.push({
      season: SEASON, month_num: monthNum, team_id: p.team_id, player_id: p.id,
      units_sold: units, revenue, fame_at_time: newFame, campaign_note: campaignNote,
      acquisition_note: acquisitionNote,
    })
    revenueByTeam[p.team_id] = (revenueByTeam[p.team_id] || 0) + revenue
    if (!topSellerByTeam[p.team_id] || revenue > topSellerByTeam[p.team_id].revenue) {
      topSellerByTeam[p.team_id] = { name: p.name, revenue }
    }
  }

  for (const u of playerFameUpdates) await supabaseAdmin.from('players').update({ fame: u.fame }).eq('id', u.id)
  if (reportRows.length) await supabaseAdmin.from('jersey_sales_reports').insert(reportRows)
  for (const c of campaignUpdates) await supabaseAdmin.from('marketing_campaigns').update({ status: c.status, result_note: c.result_note }).eq('id', c.id)

  for (const [teamId, revenue] of Object.entries(revenueByTeam)) {
    if (revenue <= 0) continue
    const { data: fin } = await supabaseAdmin.from('franchise_finances').select('balance').eq('team_id', teamId).single()
    if (!fin) continue
    await supabaseAdmin.from('franchise_finances').update({ balance: (fin.balance || 0) + revenue }).eq('team_id', teamId)
    await supabaseAdmin.from('franchise_transactions').insert({
      team_id: teamId, type: 'revenue', category: 'merchandise', amount: revenue,
      description: `Jersey sales — Month ${monthNum}`, season: SEASON, week_number: week,
    })

    const top = topSellerByTeam[teamId]
    if (top) {
      const lang = await getTeamLang(teamId)
      const notif = notifJerseySalesReport(lang, monthNum, top.name, top.revenue, revenue)
      await notify(teamId, 'jersey_sales_report', notif.subject, notif.body, { monthNum, totalRevenue: revenue, topSeller: top.name })
    }
  }

  return { teams: Object.keys(revenueByTeam).length, players: players.length }
}

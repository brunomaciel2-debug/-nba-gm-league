import { supabaseAdmin } from '@/lib/supabase'
import { notify } from '@/lib/notifications'
import { getTeamLang, notifJerseySalesReport } from '@/lib/notifications-helpers'

const SEASON = '2025-26'

// Real NBA media-market size — a star's jersey sales depend heavily on
// market reach, not just talent (LeBron in LA outsells an equally good
// player in Memphis by miles). Tiered from real Nielsen DMA/metro rankings:
// Large = the traditional top-8 US media markets plus Toronto (the only
// Canadian team — unique national-reach status of its own).
const LARGE_MARKETS = new Set(['LAL','LAC','NYK','BKN','CHI','GSW','BOS','DAL','TOR'])
const SMALL_MARKETS = new Set(['ORL','CHA','SAS','IND','CLE','MIL','UTA','NOP','MEM','OKC'])
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
function effectiveMarketMultiplier(realOvr: number, teamId: string): number {
  const base = marketMultiplier(teamId)
  return realOvr >= TRANSCENDENT_OVR ? Math.max(base, 1.3) : base
}

// Jersey sales are real-world power-law distributed — a handful of
// megastars account for most of the money, everyone else is a rounding
// error. fame 40 -> ~$1.1K/mo (nobody buys the 12th man's jersey),
// fame 70 -> ~$25K/mo (good starter), fame 85 -> ~$115K/mo (real star),
// fame 97+ -> ~$400K+/mo (global superstar) — genuinely significant,
// comparable to the ~$450K/mo the existing Finances projections already
// use for ticket sales.
export function jerseyRevenue(fame: number): number {
  return Math.round(410 * Math.exp(0.1 * (fame - 30)))
}

// Deserved monthly fame target — quality, recent form vs. the player's own
// season average (same comparison already built for Power Rankings/morale,
// generalized here), team win%, and a recent award bump — all of that
// "star power" (except team win%) is scaled by real market size, since
// that's specifically what makes a market big or small: how far a star's
// name travels, not how good a bench player looks locally.
//
// fame is a HIDDEN attribute (never shown to the GM directly — only its
// real-world effect, jersey sales, is observable) and moves in small,
// residual monthly steps (see DRIFT_RATE below) — a single hot month barely
// registers; real fan-favorite status only builds from sustained
// consistency over many months, same as in real life.
export function fameTarget(opts: {
  realOvr: number, recentAvgPts: number | null, seasonAvgPts: number | null,
  winPct: number, hasRecentAward: boolean, marketMultiplier: number,
}): number {
  let starBonus = Math.max(0, opts.realOvr - 60) * 1.1
  if (opts.recentAvgPts != null && opts.seasonAvgPts != null && opts.seasonAvgPts >= 2) {
    starBonus += Math.max(-10, Math.min(10, (opts.recentAvgPts / opts.seasonAvgPts - 1) * 25))
  }
  if (opts.hasRecentAward) starBonus += 12
  const target = 20 + starBonus * opts.marketMultiplier + (opts.winPct - 0.5) * 12
  return Math.max(5, Math.min(99, target))
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
  const monthStartWeek = (monthNum - 1) * 4 + 1
  const monthEndWeek = monthNum * 4

  const { data: players } = await supabaseAdmin.from('players')
    .select('id,name,team_id,real_ovr,fame').eq('status', 'active').not('team_id', 'is', null)
  if (!players?.length) return { teams: 0, players: 0 }
  const playerIds = players.map((p: any) => p.id)

  const { data: teams } = await supabaseAdmin.from('teams').select('id,wins,losses')
    .not('id', 'in', '(ALL,RVS,ROO,SOP)')
  const winPctByTeam: Record<string, number> = {}
  ;(teams || []).forEach((t: any) => { const gp = (t.wins||0)+(t.losses||0); winPctByTeam[t.id] = gp > 0 ? (t.wins||0)/gp : 0.5 })

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
      marketMultiplier: effectiveMarketMultiplier(p.real_ovr || 70, p.team_id),
    })
    const newFame = Math.round(Math.max(0, Math.min(100, (p.fame ?? 50) + (target - (p.fame ?? 50)) * DRIFT_RATE)))
    playerFameUpdates.push({ id: p.id, fame: newFame })

    let revenue = jerseyRevenue(newFame)
    let campaignNote: string | null = null

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
      revenue = Math.round(revenue * multiplier)
      campaignNote = note
      campaignUpdates.push({ id: campaign.id, status, result_note: note })
    }

    const units = Math.round(revenue / 35)
    reportRows.push({
      season: SEASON, month_num: monthNum, team_id: p.team_id, player_id: p.id,
      units_sold: units, revenue, fame_at_time: newFame, campaign_note: campaignNote,
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

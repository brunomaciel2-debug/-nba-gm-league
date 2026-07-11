import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkSponsorObjectives } from '@/lib/check-sponsor-objectives'
import { generatePowerRankings } from '@/lib/generate-power-rankings'
import { runPostSimNotifications } from '@/lib/notifications'
import { generateWeeklyScoutPoints } from '@/lib/scouting'
import { homeWinProb, updateElo } from '@/lib/elo-helper'
import { getStatusForWeek, getHalfWeekDates } from '@/lib/season-week-helper'
import { simulateGame } from '@/lib/game-simulator'
import { simulatePreseasonGame } from '@/lib/preseason-simulator'
import { getTeamLang, notifRookieOptionEligible } from '@/lib/notifications-helpers'
import { rookieOptionSalary } from '@/lib/draft-constants'
import { MEDICAL_COST_BY_SEVERITY, physioRecoveryMultiplier, SPECIALIST_BOOST_MULTIPLIER_BY_SEVERITY, recurrenceWindowWeeks, recurrenceBodyPartWeightBoost, InjurySeverity } from '@/lib/injury-constants'
import { checkForNewInteractions, refreshMonitoredProgress, resolveMonitoredInteractions } from '@/lib/player-interactions'
import { resolveSummerLeague } from '@/lib/summer-league'
import { resolvePlayoffSeries } from '@/lib/playoff-resolver'
import { assignRefereesToScheduledGames, rateRefereePerformance } from '@/lib/referees'
import { resolveMonthlyMerchandising } from '@/lib/merchandising'
import { resolveAllStarWeekend } from '@/lib/allstar-resolver'
import { resolveWeeklyTacticalDevelopment, getAllTeamsTacticalState } from '@/lib/tactical-resolver'
import { computeFamiliarity, computeTacticalMods, OffSystem } from '@/lib/tactical-constants'
import { getMarqueeWeekInfo, getMarqueeInfoForDate } from '@/lib/marquee-dates'
import { computeRosterQuality, normalizeRosterQuality } from '@/lib/roster-quality'
import { computeGameAttendance, computeGameTicketRevenue, computeGameConcessionRevenue, computeConcessionSupplyCost, computeGameOperationsCost, SLOT_VARIANT_KEYS } from '@/lib/audience-segments'
import { getGymGradeBonus } from '@/lib/facility-constants'
import { cityDistanceMiles, computeAwayTravelCost } from '@/lib/travel-constants'
import { resolveWeeklySocialMedia } from '@/lib/social-media-resolver'
import { resolveWeeklyGmSatisfaction } from '@/lib/gm-satisfaction'

// Supabase/PostgREST silently caps any unpaginated query at db.max_rows
// (1000 on this project) — a full week now has ~1700+ box_scores rows
// (60 games × ~28 players), so every plain `.in('game_id', gamesCreated)`
// query below was silently dropping ~40% of the week's box scores with
// no error, no warning, just fewer rows back. That corrupted technical
// foul counts, injury/health-loss rolls, Weekly Highlights, and Player of
// the Week/Month stats depending on which rows happened to land in the
// first 1000. Every such query now goes through this helper, which pages
// with .range() until a short page confirms there's nothing left.
async function fetchAllRows<T>(queryFactory: (from: number, to: number) => any): Promise<T[]> {
const PAGE = 1000
let all: T[] = []
let from = 0
while (true) {
const { data, error } = await queryFactory(from, from + PAGE - 1)
if (error) { console.warn('fetchAllRows: paginated query failed', error); break }
all = all.concat((data as T[]) || [])
if (!data || data.length < PAGE) break
from += PAGE
}
return all
}

// The actual simulation logic, importable directly so callers in the same
// deployment (e.g. the admin manual-trigger route) don't have to bounce
// through an extra HTTP self-call — that extra hop had no timeout of its
// own and could leave the caller hanging indefinitely if this took too long.
export async function runWeeklySimulation() {
try {
const { data: cfg } = await supabaseAdmin.from('season_config').select('*').eq('id',1).single()
const week = (cfg?.current_week || 0) + 1
// The season is only truly "done" once every week has been simulated —
// checking a stored `status` column here (as this used to) is fragile: that
// column is just a display mirror of getStatusForWeek(week) written back
// below, and drifts out of sync with current_week after any manual rewind
// (e.g. the commissioner rewinding current_week to revisit an interval),
// which then wrongly blocked simulation entirely. week vs total_weeks is
// the one value nothing else can desync it from.
if (!cfg || week > (cfg.total_weeks || 52)) return NextResponse.json({ message: 'Season not active' })
// Pre-Season weeks (per the same calendar shown in the UI) are for testing
// tactics/rotations only — injuries/fatigue still happen, but nothing here
// should count toward standings, player season stats, or awards.
const isPreseason = getStatusForWeek(week) === 'pre-season'
// A Regular-Season week has too much work (30 teams' worth of real games +
// injuries + the full once-per-week aftermath) to reliably fit in a single
// invocation, so every week — regardless of phase — is now simulated in 2
// steps: half 1 covers the week's first 3 days (rounds 0-1), half 2 the
// remaining 4 days (rounds 2-3) plus the once-per-week aftermath — see
// getHalfWeekDates(). Bruno wants this cadence consistent across every
// phase (not just Regular Season), even though lighter phases (Pre-Season,
// Free Agency, Draft, etc.) have no day-scoped games of their own — half 1
// for those is simply a quick pass with nothing to simulate yet.
const half: 1 | 2 = cfg.next_sim_half === 2 ? 2 : 1

let gamesSimulated = 0
let friendliesSimulated = 0
const gamesCreated: string[] = []
const weekGamesByTeam: Record<string, number> = {}

// Regular Season games are never invented — they must already exist in the
// real schedule (created ahead of time, e.g. via a schedule generator) as
// `games` rows with status='scheduled' for this exact week_number. Only
// Pre-Season friendlies (resolved below) are the exception, since GMs
// schedule those manually as they go.
if (!isPreseason) {

const { data: teams } = await supabaseAdmin.from('teams').select('*').not('id','in','(ALL,RVS,ROO,SOP)')
if (!teams || teams.length < 2) return NextResponse.json({ error: 'Not enough teams' }, { status:500 })
const teamMap: Record<string,any> = {}
teams.forEach((t:any) => teamMap[t.id] = t)

// Real NBA arena capacities as fallback
const arenaCapacityMap: Record<string,number> = {
ATL:20000,BOS:19156,BKN:17732,CHA:19077,CHI:20917,CLE:19432,DAL:19200,DEN:19520,
DET:20332,GSW:18064,HOU:18055,IND:17923,LAC:19068,LAL:19068,MEM:17794,MIA:19600,
MIL:17341,MIN:18978,NOP:16867,NYK:19812,OKC:18203,ORL:18846,PHI:20478,PHX:18422,
POR:19393,SAC:17583,SAS:18418,TOR:19800,UTA:18306,WAS:20356,
}

const { data: orders } = await supabaseAdmin.from('gm_orders').select('*').eq('week_number', week)
const orderMap: Record<string, any> = {}
;(orders||[]).forEach((o:any) => orderMap[o.team_id] = o)

// Real arena economy — ticket prices + built concessions per team, used to
// compute segmented attendance and post real per-game revenue below (see
// src/lib/audience-segments.ts). Previously attendance ignored price
// entirely and ticket/concession revenue was never posted anywhere.
const { data: ticketConfigs } = await supabaseAdmin.from('franchise_config').select('*')
const ticketConfigMap: Record<string, any> = {}
;(ticketConfigs||[]).forEach((c:any) => ticketConfigMap[c.team_id] = c)
const { data: allConcessions } = await supabaseAdmin.from('arena_concessions').select('*')
const concessionsMap: Record<string, any> = {}
;(allConcessions||[]).forEach((c:any) => concessionsMap[c.team_id] = c)
// Live Social Media Manager effect on segment mix (see src/lib/social-media-resolver.ts)
// — starts all-zero (no effect) until a fan-interaction event actually fires.
const { data: allAudienceModifiers } = await supabaseAdmin.from('arena_audience_modifiers').select('*')
const audienceModifiersMap: Record<string, any> = {}
;(allAudienceModifiers||[]).forEach((m:any) => audienceModifiersMap[m.team_id] = m)

// Referees are pre-assigned to scheduled games ahead of time (so they show
// up on the calendar before the game is played) — see src/lib/referees.ts.
// This call is just a safety net for anything that slipped through without
// one; the real assignment already happened earlier.
await assignRefereesToScheduledGames()
const { data: refereesPool } = await supabaseAdmin.from('referees').select('*')
const refereeById: Record<string, any> = {}
;(refereesPool||[]).forEach((r:any) => refereeById[r.id] = r)

// Head Coach off_adjustment/def_adjustment sharpen or dull the atk/def style
// matchup and Double Team swings inside simulateGame() — attach them to each
// team's order object so no extra function signature is needed. substitutions
// (back-to-back fatigue management) and timeout_mgmt (decisive-moment
// pressure) ride along the same way.
const { data: headCoaches } = await supabaseAdmin.from('coaches').select('team_id,off_adjustment,def_adjustment,substitutions,timeout_mgmt').eq('role','head_coach')
;(headCoaches||[]).forEach((c:any) => {
if (orderMap[c.team_id]) {
orderMap[c.team_id].off_adjustment = c.off_adjustment
orderMap[c.team_id].def_adjustment = c.def_adjustment
orderMap[c.team_id].substitutions = c.substitutions
orderMap[c.team_id].timeout_mgmt = c.timeout_mgmt
}
})

// Mental Coach — team_cohesion/composure_coaching ride along on the same
// orderMap object, same mechanism as the Head Coach adjustments above, so
// they flow into hOrd/aOrd (and from there into simP()) with no extra
// plumbing. Applied even to a team with no submitted orders — an empty
// {} is created for them so the bonus still lands.
const { data: mentalCoachesGame } = await supabaseAdmin.from('coaches').select('team_id,team_cohesion,composure_coaching').eq('role','mental_coach')
;(mentalCoachesGame||[]).forEach((c:any) => {
orderMap[c.team_id] = orderMap[c.team_id] || {}
orderMap[c.team_id].cohesion = c.team_cohesion
orderMap[c.team_id].composure = c.composure_coaching
})

// Tactical System Familiarity — weekly tech-tree fill/decay per team (see
// src/lib/tactical-resolver.ts), then attach each team's CURRENT active
// system's familiarity + mastered-node effects onto orderMap so they flow
// into simP() the same way cohesion/composure do above. The actual weekly
// tick only runs on half 1 (the invocation that starts a new week) — it
// used to fire on BOTH halves of every week (and even during phases with
// no games at all), silently applying two weeks' worth of progress/decay
// for one real week. The read below still runs every invocation so both
// halves' games see the current state.
try {
if (half === 1) await resolveWeeklyTacticalDevelopment(week)
const tacticalState = await getAllTeamsTacticalState()
for (const teamId of Object.keys(orderMap)) {
const activeSystem: OffSystem = orderMap[teamId]?.atk_style || 'motion'
const progressByNodeId = tacticalState[teamId]?.[activeSystem] || {}
orderMap[teamId].tacticalFamiliarity = computeFamiliarity(progressByNodeId, activeSystem)
orderMap[teamId].tacticalMods = computeTacticalMods(progressByNodeId, activeSystem)
}
} catch (tacticalErr) { console.warn('Tactical development resolution failed:', tacticalErr) }

// Social Media Manager — weekly follower drift + fan-interaction/social-
// responsibility events (see src/lib/social-media-resolver.ts). Real,
// no-op-safe for any team without one hired yet. Same once-per-week fix as
// tactical development above — this used to fire on every invocation
// (both halves, every phase), double-applying follower drift and rolling
// event dice twice for one real week.
if (half === 1) {
try {
const smResult = await resolveWeeklySocialMedia(week)
if (smResult.teamsProcessed > 0) console.log(`Social media resolved: ${smResult.teamsProcessed} teams, ${smResult.eventsResolved} events`)
} catch (smErr) { console.warn('Social media resolution failed:', smErr) }
}

// Conference standings — used to detect "decisive" games. Playoffs/play-in
// always count. In the regular season, this reflects the real Play-In
// Tournament structure: ranks 7-10 (of 15) ARE the Play-In zone itself —
// always high-stakes. Ranks 4-6 are fighting to avoid falling into it,
// ranks 11-13 are fighting to climb into it. 1-3 are settled enough and
// 14-15 are mathematically buried — neither counts as decisive.
const simPhase = getStatusForWeek(week)
const isPlayoffPhase = simPhase === 'playoffs' || simPhase === 'play-in'
const byConf: Record<string, any[]> = {}
teams.forEach((t:any) => { if (!byConf[t.conference]) byConf[t.conference] = []; byConf[t.conference].push(t) })
const inFightSet = new Set<string>()
Object.values(byConf).forEach((confTeams:any[]) => {
const ranked = [...confTeams].sort((a,b) => {
const aPct = (a.wins||0)/Math.max(1,(a.wins||0)+(a.losses||0))
const bPct = (b.wins||0)/Math.max(1,(b.wins||0)+(b.losses||0))
return bPct - aPct
})
ranked.forEach((t, i) => { const rank = i+1; if (rank>=4 && rank<=13) inFightSet.add(t.id) })
})

// Marquee NBA calendar weeks (Christmas, MLK Day, Thanksgiving, Opening
// Night, NBA Cup Championship, Presidents' Day) — nationally televised,
// consistently sold-out. Fallback only, for a game row with no real
// scheduled_date — real regular-season games are checked per-game below
// via getMarqueeInfoForDate(), since a whole week's games no longer all
// share the same marquee status now that each has its own real date.
const marquee = getMarqueeWeekInfo(week)

// Only the games actually scheduled for this week — nothing invented.
// Every week is further split by scheduled_date into whichever half is
// next (see half above), so a single invocation only ever has to simulate
// ~half the week's games. Harmless for phases with no day-scoped games at
// all (Free Agency, Draft, etc.) — the filter just matches nothing there.
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const { start: halfStart, end: halfEnd } = getHalfWeekDates(week, half)
const { data: weekGames } = await supabaseAdmin.from('games').select('*').eq('week_number', week).eq('status','scheduled')
.gte('scheduled_date', ymdLocal(halfStart)).lte('scheduled_date', ymdLocal(halfEnd))

for (const sg of (weekGames||[])) {
const ht = teamMap[sg.home_team], at = teamMap[sg.away_team]
if (!ht || !at) continue
const [{ data: hp }, { data: ap }] = await Promise.all([
supabaseAdmin.from('players').select('*').eq('team_id', ht.id).eq('status','active'),
supabaseAdmin.from('players').select('*').eq('team_id', at.id).eq('status','active'),
])
if (!hp || !ap) continue

// Ball Role (Dominant/Balanced/Off-Ball) is a per-player GM choice stored
// in gm_orders.depth_chart.ball_roles, keyed by player name — stamp it
// directly onto each player object so simulateGame() can read p.ball_role.
const hBallRoles = orderMap[ht.id]?.depth_chart?.ball_roles || {}
const aBallRoles = orderMap[at.id]?.depth_chart?.ball_roles || {}
hp.forEach((p:any) => { p.ball_role = hBallRoles[p.name] })
ap.forEach((p:any) => { p.ball_role = aBallRoles[p.name] })

// Attendance/rivalry/decisive computed BEFORE the game now, so home crowd,
// rivalry intensity, and decisive-game clutch can actually feed into the
// simulation itself — not just the post-game revenue figure like before.
// Built as fresh objects (not mutating orderMap directly) since a team can
// play several different opponents this same week — each game needs its
// own attRate/isRivalry/decisive, not whatever the last game happened to set.
const isRivalry = ht.rival_team_id === at.id || at.rival_team_id === ht.id
const htWinPct = (ht.wins||0) / Math.max(1, (ht.wins||0)+(ht.losses||0))
// Per-game marquee check (falls back to the whole-week check only if this
// row somehow has no real scheduled_date) — this is what actually fixes
// "every game in the marquee week gets the boost", not just the week label.
const gMarquee = sg.scheduled_date ? getMarqueeInfoForDate(sg.scheduled_date, week) : marquee
// Real segmented audience model (src/lib/audience-segments.ts) — replaces
// the old flat 0.65+winPct*0.20+... formula, which had zero price input (a
// team could charge $1,000,000/ticket and still sell out). Same overall
// win%/rivalry/marquee driver as before, now allocated across 4 fan
// segments and gated by each segment's real price tolerance for the tier
// they'd actually sit in — still collapses to one attRate/attendance number
// so nothing downstream (simulateGame's crowd boost, etc.) needs to change.
const ticketPrices = ticketConfigMap[ht.id] || { ticket_lower: 80, ticket_upper: 45, ticket_courtside: 500 }
const attendanceResult = computeGameAttendance({
teamId: ht.id, popularity: ht.popularity ?? 50,
capacity: ht.arena_capacity || arenaCapacityMap[ht.id] || 18000,
winPct: htWinPct, isRivalry, isMarquee: gMarquee.marquee,
prices: { lower: ticketPrices.ticket_lower, upper: ticketPrices.ticket_upper, courtside: ticketPrices.ticket_courtside },
randomJitter: Math.random() * 0.06 - 0.03,
followers: ht.social_media_followers,
audienceModifiers: audienceModifiersMap[ht.id] ? {
family: audienceModifiersMap[ht.id].family_modifier, young_adult: audienceModifiersMap[ht.id].young_adult_modifier,
loyal_fan: audienceModifiersMap[ht.id].loyal_fan_modifier, corporate: audienceModifiersMap[ht.id].corporate_modifier,
} : undefined,
})
const attendance = attendanceResult.attendance
const attRate = attendanceResult.attRate
const decisive = isPlayoffPhase || gMarquee.marquee || (inFightSet.has(ht.id) && inFightSet.has(at.id))

// Genuine back-to-back detection, now that games carry a real scheduled_date:
// did this team already have a game the calendar day right before this one?
// Checked per side since only one team may be on the second half of a
// back-to-back — feeds an extra fatigue hit in simulateGame()'s fat[] seed.
let htBackToBack = false, atBackToBack = false
if (sg.scheduled_date) {
const prevDate = new Date(sg.scheduled_date + 'T00:00:00')
prevDate.setDate(prevDate.getDate() - 1)
const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}-${String(prevDate.getDate()).padStart(2,'0')}`
const [{ data: htPrev }, { data: atPrev }] = await Promise.all([
supabaseAdmin.from('games').select('id').eq('scheduled_date', prevDateStr).or(`home_team.eq.${ht.id},away_team.eq.${ht.id}`).limit(1),
supabaseAdmin.from('games').select('id').eq('scheduled_date', prevDateStr).or(`home_team.eq.${at.id},away_team.eq.${at.id}`).limit(1),
])
htBackToBack = !!(htPrev && htPrev.length)
atBackToBack = !!(atPrev && atPrev.length)
}

// Double Team / Lockdown Defender are set PER OPPONENT (a team can face
// several different teams in one week and reasonably wants a different
// special assignment against each), stored in gm_orders.special_assignments
// keyed by opponent team_id — look up the assignment for THIS specific matchup.
const htAssign = orderMap[ht.id]?.special_assignments?.[at.id] || {}
const atAssign = orderMap[at.id]?.special_assignments?.[ht.id] || {}

// Already assigned ahead of time by assignRefereesToScheduledGames() above —
// just read it. Random fallback only for the rare case a game still has none.
const referee = sg.referee_id
? refereeById[sg.referee_id]
: (refereesPool||[])[Math.floor(Math.random() * Math.max(1,(refereesPool||[]).length))]

const hOrd = { ...(orderMap[ht.id]||{}), attRate, isRivalry, decisive, referee, backToBack: htBackToBack,
double_team_target: htAssign.double_team_target, lockdown_target: htAssign.lockdown_target, lockdown_defender: htAssign.lockdown_defender }
const aOrd = { ...(orderMap[at.id]||{}), attRate, isRivalry, decisive, referee, backToBack: atBackToBack,
double_team_target: atAssign.double_team_target, lockdown_target: atAssign.lockdown_target, lockdown_defender: atAssign.lockdown_defender }
const result = simulateGame(ht, at, hp, ap, hOrd, aOrd)

// Officials Ranking — graded from what actually happened in this game
// (foul symmetry, total fouls, technicals), not from the referee's hidden
// trait numbers directly; see rateRefereePerformance() in src/lib/referees.ts.
const refereeIdForGame = referee?.id || sg.referee_id || null
const refereeRating = refereeIdForGame ? rateRefereePerformance(result.homeBox, result.awayBox, isRivalry, decisive) : null

const { data: gameRec } = await supabaseAdmin.from('games').update({
home_score: result.homeScore, away_score: result.awayScore,
status: 'final', played_at: new Date().toISOString(),
attendance, is_rivalry: isRivalry, referee_id: refereeIdForGame, referee_rating: refereeRating,
period_scores: result.periods,
}).eq('id', sg.id).select().single()
if (!gameRec) continue
gamesSimulated++
gamesCreated.push(gameRec.id)
weekGamesByTeam[ht.id] = (weekGamesByTeam[ht.id]||0) + 1
weekGamesByTeam[at.id] = (weekGamesByTeam[at.id]||0) + 1

await supabaseAdmin.from('box_scores').insert([
...result.homeBox.map((b:any) => ({
...b, game_id: gameRec.id, team_id: ht.id,
is_triple_double: [b.pts||0,b.reb||0,b.ast||0,b.stl||0,b.blk||0].filter((v:number)=>v>=10).length >= 3
})),
...result.awayBox.map((b:any) => ({
...b, game_id: gameRec.id, team_id: at.id,
is_triple_double: [b.pts||0,b.reb||0,b.ast||0,b.stl||0,b.blk||0].filter((v:number)=>v>=10).length >= 3
})),
])
if (result.pbp.length > 0) {
await supabaseAdmin.from('play_by_play').insert(result.pbp.map((p:any) => ({ ...p, game_id: gameRec.id })))
}

// Real per-game ticket + concession revenue — previously neither was ever
// posted anywhere (the "$450K Ticket Sales"/"$0 Concessions" shown in
// FinancesTab were hardcoded placeholders, identical for every team).
try {
const ticketRevenue = computeGameTicketRevenue(attendanceResult.segments, {
lower: ticketPrices.ticket_lower, upper: ticketPrices.ticket_upper, courtside: ticketPrices.ticket_courtside,
})
const homeConcessions = concessionsMap[ht.id]
const concessionCounts: Record<string, number> = {}
if (homeConcessions) {
for (const [slotId, variantKeys] of Object.entries(SLOT_VARIANT_KEYS)) {
concessionCounts[slotId] = variantKeys.reduce((s, k) => s + (homeConcessions[k] || 0), 0)
}
}
const concessionResult = computeGameConcessionRevenue(attendanceResult.segments, concessionCounts)
// Variable cost of goods sold — restocking food/drink/merchandise, scaled
// to this game's REAL concession revenue (which already reflects who's
// actually in the building), not a flat number. Deducted the same game it's
// earned, alongside monthly fixed utility costs (handled separately).
const supplyCost = computeConcessionSupplyCost(concessionResult)
// Game-day operations — security, ushers, ticket-office staff, cleaning
// crew, electricians, sound/light techs, in-game entertainment. Real per-
// game cost: a fixed baseline sized to the real arena capacity (you can't
// run a bigger building with a smaller crew regardless of turnout) plus a
// variable part sized to this game's real attendance.
const gameOpsCost = computeGameOperationsCost(ht.arena_capacity || arenaCapacityMap[ht.id] || 18000, attendance)
const totalGameRevenue = ticketRevenue + concessionResult.total - supplyCost.total - gameOpsCost

if (totalGameRevenue !== 0) {
const { data: fin } = await supabaseAdmin.from('franchise_finances').select('balance').eq('team_id', ht.id).single()
if (fin) {
await supabaseAdmin.from('franchise_finances').update({ balance: (fin.balance||0) + totalGameRevenue }).eq('team_id', ht.id)
const rows = []
if (ticketRevenue > 0) rows.push({
team_id: ht.id, type: 'revenue', category: 'tickets', amount: ticketRevenue,
description: `Ticket sales vs ${at.name}`, season: '2025-26', week_number: week,
})
if (concessionResult.total > 0) rows.push({
team_id: ht.id, type: 'revenue', category: 'concessions', amount: concessionResult.total,
description: `Concessions vs ${at.name}`, season: '2025-26', week_number: week,
})
if (supplyCost.total > 0) rows.push({
team_id: ht.id, type: 'expense', category: 'supplies', amount: supplyCost.total,
description: `Concession supply restock vs ${at.name}`, season: '2025-26', week_number: week,
})
if (gameOpsCost > 0) rows.push({
team_id: ht.id, type: 'expense', category: 'operational', amount: gameOpsCost,
description: `Game operations vs ${at.name} (security, ushers, staff)`, season: '2025-26', week_number: week,
})
if (rows.length) await supabaseAdmin.from('franchise_transactions').insert(rows)
}
}

// Away travel — real distance-based charter/hotel/per-diem cost for the
// visiting team, previously a flat "$200K/month" guess never actually
// posted anywhere. Only the traveling team pays (the home team already
// has its own real game-ops cost above).
const travelDistance = cityDistanceMiles(ht.id, at.id)
const travel = computeAwayTravelCost(travelDistance)
if (travel.total > 0) {
const { data: awayFin } = await supabaseAdmin.from('franchise_finances').select('balance').eq('team_id', at.id).single()
if (awayFin) {
await supabaseAdmin.from('franchise_finances').update({ balance: (awayFin.balance||0) - travel.total }).eq('team_id', at.id)
await supabaseAdmin.from('franchise_transactions').insert({
team_id: at.id, type: 'expense', category: 'travel', amount: travel.total,
description: `Away travel to ${ht.name} (${Math.round(travelDistance)}mi) — flight $${travel.flight}, hotel $${travel.hotel}, meals $${travel.meals}, ground transport $${travel.groundTransport}, security $${travel.security}`,
season: '2025-26', week_number: week,
})
}
}
} catch (arenaRevErr) { console.warn('Arena revenue posting failed:', arenaRevErr) }

const hWon = result.homeScore > result.awayScore
const htElo = ht.elo || 1500
const atElo = at.elo || 1500
const hExpected = homeWinProb(htElo, atElo)
const htNewElo = updateElo(htElo, hWon, hExpected)
const atNewElo = updateElo(atElo, !hWon, 1 - hExpected)
const htNewWins = ht.wins+(hWon?1:0), htNewLosses = ht.losses+(hWon?0:1)
const atNewWins = at.wins+(hWon?0:1), atNewLosses = at.losses+(hWon?1:0)
const htNewPtsFor = ht.pts_for+result.homeScore, htNewPtsAgainst = ht.pts_against+result.awayScore
const atNewPtsFor = at.pts_for+result.awayScore, atNewPtsAgainst = at.pts_against+result.homeScore
await Promise.all([
supabaseAdmin.from('teams').update({
wins: htNewWins, losses: htNewLosses,
pts_for: htNewPtsFor, pts_against: htNewPtsAgainst,
elo: htNewElo,
}).eq('id', ht.id),
supabaseAdmin.from('teams').update({
wins: atNewWins, losses: atNewLosses,
pts_for: atNewPtsFor, pts_against: atNewPtsAgainst,
elo: atNewElo,
}).eq('id', at.id),
])
// A team can play several games in the same invocation (up to 2 rounds
// per half) — keep teamMap's in-memory copy in sync after every game, or
// the next game for this same team would compute its wins/losses/elo off
// the stale pre-week numbers and silently overwrite this game's update
// instead of accumulating on top of it.
teamMap[ht.id] = { ...ht, wins: htNewWins, losses: htNewLosses, pts_for: htNewPtsFor, pts_against: htNewPtsAgainst, elo: htNewElo }
teamMap[at.id] = { ...at, wins: atNewWins, losses: atNewLosses, pts_for: atNewPtsFor, pts_against: atNewPtsAgainst, elo: atNewElo }

// Accumulate player stats — DNP rows (mins=0) don't count as a game played.
// Tagged with the team he actually suited up for THIS game (not his current
// players.team_id, which may have moved on by the time this cron runs) and
// upserted per (player, season, team) instead of per (player, season) — a
// trade now starts a brand-new season row for the new team instead of
// silently folding post-trade games into the old team's row forever.
const allBox = [
...result.homeBox.map((b:any) => ({...b, team_id: ht.id})),
...result.awayBox.map((b:any) => ({...b, team_id: at.id})),
].filter((b:any) => (b.mins||0) > 0)
for (const box of allBox) {
const isTD = [box.pts||0,box.reb||0,box.ast||0,box.stl||0,box.blk||0].filter((v:number)=>v>=10).length >= 3
const { data: ex } = await supabaseAdmin.from('player_stats')
.select('*').eq('player_id', box.player_id).eq('season','2025-26').eq('team_id', box.team_id).maybeSingle()
if (ex) {
await supabaseAdmin.from('player_stats').update({
games: ex.games+1, pts: ex.pts+box.pts, reb: ex.reb+box.reb,
off_reb: (ex.off_reb||0)+(box.off_reb||0), def_reb: (ex.def_reb||0)+(box.def_reb||0),
ast: ex.ast+box.ast, stl: ex.stl+box.stl, blk: ex.blk+box.blk,
fgm: ex.fgm+box.fgm, fga: ex.fga+box.fga,
tpm: ex.tpm+box.tpm, tpa: ex.tpa+box.tpa,
ftm: ex.ftm+box.ftm, fta: ex.fta+box.fta,
turnovers: ex.turnovers+box.turnovers,
fouls: (ex.fouls||0)+(box.pf||0), tech_fouls: (ex.tech_fouls||0)+(box.tech_fouls||0),
triple_doubles: (ex.triple_doubles||0)+(isTD?1:0),
}).eq('id', ex.id)
} else {
await supabaseAdmin.from('player_stats').insert({
player_id: box.player_id, season: '2025-26', team_id: box.team_id,
games: 1, pts: box.pts||0, reb: box.reb||0, ast: box.ast||0, stl: box.stl||0, blk: box.blk||0,
off_reb: box.off_reb||0, def_reb: box.def_reb||0,
fgm: box.fgm||0, fga: box.fga||0, tpm: box.tpm||0, tpa: box.tpa||0, ftm: box.ftm||0, fta: box.fta||0,
turnovers: box.turnovers||0, fouls: box.pf||0, tech_fouls: box.tech_fouls||0,
triple_doubles: isTD?1:0,
})
}
}
}
} // end if (!isPreseason) — random round-robin block

// ── TECHNICAL FOUL SUSPENSIONS ────────────────────────
// Real NBA rule: 16 technicals in a regular season = 1-game suspension,
// then another 1-game suspension every 2 additional technicals. In the
// postseason the threshold resets and is stricter: 7 technicals, then
// every 2 more. (2-technicals-in-one-game ejection is handled live inside
// the sim engine itself, see game-simulator.ts's rollTechs/ejected.)
type TechFoulEvent = { playerId:string, name:string, teamId:string, seasonTechs:number, techsUntilNextSuspension:number, gamesAdded:number }
const techFoulEvents: TechFoulEvent[] = []
try {
const isPostseasonWeek = ['play-in','playoffs'].includes(getStatusForWeek(week))
const threshold = isPostseasonWeek ? 7 : 16
// Only regular-season/playoff games count toward suspensions — friendlies
// never count toward anything, same rule as everywhere else in this sim.
const gameTypeFilter = isPostseasonWeek ? 'playoff' : 'regular'

// 1. Serve out suspensions for players whose team played this week.
const { data: suspendedNow } = await supabaseAdmin.from('players')
.select('id,team_id,suspended_games_remaining').eq('status','suspended')
for (const p of (suspendedNow||[])) {
const gamesPlayedThisWeek = weekGamesByTeam[p.team_id] || 0
if (!gamesPlayedThisWeek) continue
const remaining = Math.max(0, (p.suspended_games_remaining||1) - gamesPlayedThisWeek)
if (remaining <= 0) {
await supabaseAdmin.from('players').update({ status:'active', suspended_games_remaining:0 }).eq('id', p.id)
} else {
await supabaseAdmin.from('players').update({ suspended_games_remaining: remaining }).eq('id', p.id)
}
}

// 2. Notify + apply suspensions for every player who picked up a technical this week.
if (gamesCreated.length > 0) {
const weekTechBoxes = await fetchAllRows<any>((from,to) => supabaseAdmin.from('box_scores')
.select('player_id,tech_fouls,games!inner(game_type)')
.in('game_id', gamesCreated).eq('games.game_type', gameTypeFilter).gt('tech_fouls', 0).range(from,to))

const weekTechsByPlayer: Record<string,number> = {}
for (const b of weekTechBoxes) weekTechsByPlayer[b.player_id] = (weekTechsByPlayer[b.player_id]||0) + (b.tech_fouls||0)

for (const [playerId, weekTechs] of Object.entries(weekTechsByPlayer)) {
const allBoxes = await fetchAllRows<any>((from,to) => supabaseAdmin.from('box_scores')
.select('tech_fouls,games!inner(game_type)')
.eq('player_id', playerId).eq('games.game_type', gameTypeFilter).range(from,to))
const totalTechs = allBoxes.reduce((s:number,b:any)=>s+(b.tech_fouls||0),0)
const priorTechs = totalTechs - weekTechs

let crossings = 0
for (let t = priorTechs+1; t <= totalTechs; t++) {
if (t === threshold || (t > threshold && (t-threshold) % 2 === 0)) crossings++
}
let nextTrigger = threshold
while (nextTrigger <= totalTechs) nextTrigger += 2

const { data: pl } = await supabaseAdmin.from('players').select('id,name,team_id,suspended_games_remaining').eq('id',playerId).single()
if (!pl) continue

if (crossings > 0) {
await supabaseAdmin.from('players').update({
status:'suspended',
suspended_games_remaining: (pl.suspended_games_remaining||0) + crossings,
}).eq('id', pl.id)
await supabaseAdmin.from('transactions').insert({
type:'suspension',
description:`${pl.name} (${pl.team_id}) — ${totalTechs} technical fouls (${isPostseasonWeek?'postseason':'regular season'}). Suspended ${crossings} game${crossings!==1?'s':''}.`,
teams:[pl.team_id], players:[pl.name], status:'completed', week_number: week,
})
}

techFoulEvents.push({
playerId, name:pl.name, teamId:pl.team_id, seasonTechs:totalTechs,
techsUntilNextSuspension: nextTrigger - totalTechs, gamesAdded: crossings,
})
}
}
} catch(techErr) { console.warn('Technical foul suspension step failed:', techErr) }

// ── HEALTH LOSS + INJURY GENERATION ──────────────────────
const { data: allPlayers } = await supabaseAdmin
.from('players').select('id,name,health,moral,durability,team_id,status,games_missed,injury_type')
const playerMap: Record<string,any> = {}
;(allPlayers||[]).forEach((p:any) => playerMap[p.id] = p)

const { data: injTypes } = await supabaseAdmin.from('injury_types').select('*')
const SMOD: Record<string,number> = {minor:1.1,moderate:1.25,serious:1.5,severe:1.75,career_threatening:2.0}
const SWEIGHTS: Record<string,number> = {minor:40,moderate:25,serious:15,severe:8,career_threatening:2}

// Practice Facility grade's "Injury risk" reduction (previously purely
// decorative) — real, physiotherapy/prevention-equipped facilities (grade
// C+) genuinely lower how often a player gets hurt.
const { data: facilitiesForInjury } = await supabaseAdmin.from('practice_facilities').select('team_id,gym_grade')
const facilityInjuryRiskMap: Record<string,number> = {}
;(facilitiesForInjury||[]).forEach((f:any) => facilityInjuryRiskMap[f.team_id] = getGymGradeBonus(f.gym_grade).risk)

// Trainer's injury_prevent — same ±30%/50-center dampen shape as the
// Physio's rehab_speed → physioRecoveryMultiplier() effect on recovery,
// mirrored here for prevention instead of recovery.
const { data: trainersForInjury } = await supabaseAdmin.from('coaches').select('team_id,injury_prevent').eq('role','trainer')
const injuryPreventMultByTeam: Record<string,number> = {}
;(trainersForInjury||[]).forEach((c:any) => {
const dampen = Math.max(-0.3, Math.min(0.3, ((c.injury_prevent ?? 50) - 50) / 50 * 0.3))
injuryPreventMultByTeam[c.team_id] = 1 - dampen
})

const weekBoxes = gamesCreated.length > 0 ? await fetchAllRows<any>((from,to) => supabaseAdmin
.from('box_scores').select('player_id,mins,team_id,game_id')
.in('game_id', gamesCreated).range(from,to)) : []

const { data: weekOrders } = await supabaseAdmin.from('gm_orders').select('team_id,pace,training_intensity,def_style,atk_style').eq('week_number',week)
const paceMap: Record<string,number> = {}
const defStyleMap: Record<string,string> = {}
const atkStyleMap: Record<string,string> = {}
;(weekOrders||[]).forEach((o:any) => { paceMap[o.team_id]=o.pace||70; defStyleMap[o.team_id]=o.def_style||'man'; atkStyleMap[o.team_id]=o.atk_style||'motion' })

// Opponent lookup per game, so an opponent's own tempo/aggressiveness can
// also raise a player's injury risk — not just their own team's Pace order.
const { data: weekGamesForOpp } = gamesCreated.length > 0 ? await supabaseAdmin
.from('games').select('id,home_team,away_team').in('id', gamesCreated) : { data: [] as any[] }
const gameTeamsMap: Record<string,{home:string,away:string}> = {}
;(weekGamesForOpp||[]).forEach((g:any) => { gameTeamsMap[g.id] = { home:g.home_team, away:g.away_team } })

const opponentAggro = (teamId: string, gameId: string): number => {
const teams = gameTeamsMap[gameId]
if (!teams) return 1.0
const oppId = teams.home === teamId ? teams.away : teams.home
if (!oppId) return 1.0
let a = 1.0
if ((paceMap[oppId]||70) > 80) a *= 1.15
if (defStyleMap[oppId] === 'press') a *= 1.15
if (atkStyleMap[oppId] === 'iso' || atkStyleMap[oppId] === 'post') a *= 1.08
return a
}

const healthUpdates: Record<string,{health:number,moral:number,wins:number,losses:number}> = {}
const oppAggroAccum: Record<string,{sum:number,count:number}> = {}
for (const box of (weekBoxes||[])) {
const p = playerMap[box.player_id]
if (!p) continue
if (!healthUpdates[p.id]) healthUpdates[p.id] = { health:p.health??100, moral:p.moral??80, wins:0, losses:0 }
const pace = paceMap[box.team_id]||70
const pacePenalty = pace > 80 ? 0.5 : 0
const healthLoss = (box.mins / 10) * (1 + pacePenalty)
healthUpdates[p.id].health = Math.max(0, healthUpdates[p.id].health - healthLoss)
if (!oppAggroAccum[p.id]) oppAggroAccum[p.id] = { sum:0, count:0 }
oppAggroAccum[p.id].sum += opponentAggro(box.team_id, box.game_id)
oppAggroAccum[p.id].count += 1
}

// Reinjury window — a player who recently recovered from an injury is more
// prone to getting hurt again, especially to the same body part. Driven by
// each injury type's own recurrence_risk (5-60), already in injury_types.
const healedPids = Object.keys(healthUpdates)
const { data: recentlyHealed } = healedPids.length > 0 ? await supabaseAdmin
.from('injury_log').select('player_id,injury_type,healed_week')
.eq('status','resolved').in('player_id', healedPids).not('healed_week','is',null)
.gte('healed_week', week - 6) : { data: [] as any[] }
const injTypeByName: Record<string,any> = {}
;(injTypes||[]).forEach((t:any) => injTypeByName[t.name] = t)
const fragileMap: Record<string,{bodyPart:string,risk:number}> = {}
;(recentlyHealed||[]).forEach((r:any) => {
const t = injTypeByName[r.injury_type]
if (!t) return
const windowWeeks = recurrenceWindowWeeks(t.recurrence_risk||10)
if (week - r.healed_week <= windowWeeks) fragileMap[r.player_id] = { bodyPart:t.body_part, risk:t.recurrence_risk||10 }
})

for (const [pid, upd] of Object.entries(healthUpdates)) {
const p = playerMap[pid]
if (!p) continue
const newHealth = Math.round(Math.max(0, upd.health))

const durFactor = (p.durability||75) / 100
const hFactor = newHealth < 70 ? 1.5 : newHealth < 85 ? 1.2 : 1.0
const pace = paceMap[p.team_id]||70
const accum = oppAggroAccum[pid]
const avgOppAggro = accum && accum.count > 0 ? accum.sum/accum.count : 1.0
const fragile = fragileMap[pid]
const facilityRiskMod = 1 + (facilityInjuryRiskMap[p.team_id]||0)/100
const injuryPreventMod = injuryPreventMultByTeam[p.team_id] ?? 1
const injChance = 0.018 * (1/durFactor) * hFactor * (pace>80?1.3:1.0) * avgOppAggro * (fragile?1.2:1.0) * facilityRiskMod * injuryPreventMod

if (Math.random() < injChance && injTypes && injTypes.length > 0) {
const weights = (injTypes as any[]).map(t => ({
t, w:(SWEIGHTS[t.severity]||10)*t.game_probability*((fragile&&t.body_part===fragile.bodyPart)?recurrenceBodyPartWeightBoost(fragile.risk):1)
}))
const totalW = weights.reduce((s,x)=>s+x.w,0)
let r = Math.random()*totalW, chosen = weights[0].t
for (const {t,w} of weights) { r-=w; if(r<=0){chosen=t;break} }

const { data: prev } = await supabaseAdmin.from('injury_log')
.select('id').eq('player_id',pid).eq('injury_type',chosen.name).eq('season','2025-26')
const isRec = (prev||[]).length > 0
const recMod = isRec ? 1.5 : 1.0
const daysOut = Math.round((chosen.days_min + Math.random()*(chosen.days_max-chosen.days_min))*recMod)
const gamesOut = Math.max(1, Math.round(daysOut/3.5))
const hImpact = Math.round(chosen.health_impact_min + Math.random()*(chosen.health_impact_max-chosen.health_impact_min))

await supabaseAdmin.from('injury_log').insert({
player_id:pid, season:'2025-26', week_number:week,
injury_type:chosen.name, injury_category:chosen.category,
body_part:chosen.body_part, severity:chosen.severity,
occurred_in:'game', health_at_injury:newHealth,
health_impact:hImpact, moral_impact:chosen.moral_impact||0,
days_out:daysOut, games_out:gamesOut,
return_week:week+Math.ceil(gamesOut/2),
is_recurring:isRec, can_play:newHealth>=50,
play_risk:newHealth<65?75:newHealth<75?40:15, status:'active'
})

// Medical bill — every injury costs the team money, scaled by severity
const medicalCost = MEDICAL_COST_BY_SEVERITY[chosen.severity as InjurySeverity] || 0
if (medicalCost > 0 && p.team_id) {
const { data: fin } = await supabaseAdmin.from('franchise_finances')
.select('balance').eq('team_id',p.team_id).single()
if (fin) {
await supabaseAdmin.from('franchise_finances').update({ balance:(fin.balance||0)-medicalCost }).eq('team_id',p.team_id)
await supabaseAdmin.from('franchise_transactions').insert({
team_id:p.team_id, type:'expense', category:'medical', amount:medicalCost,
description:`Medical bill — ${p.name}: ${chosen.name}`,
season:'2025-26', week_number:week,
})
}
}

const injHealth = Math.max(0, newHealth-hImpact)
const injMoral = Math.max(0, (upd.moral||80)-(chosen.moral_impact||0))
await supabaseAdmin.from('players').update({
health:injHealth, moral:injMoral,
status:injHealth<50?'injured':'active',
injury_type:chosen.name,
games_missed:(p.games_missed||0)+1,
}).eq('id',pid)

if (chosen.severity!=='minor') {
await supabaseAdmin.from('transactions').insert({
type:'injury',
description:`${p.name} (${p.team_id}) — ${chosen.name}. Est. ${gamesOut} games out.`,
teams:[p.team_id], players:[p.name], status:'completed', week_number: week,
})
}
} else {
await supabaseAdmin.from('players').update({ health:newHealth }).eq('id',pid)
}
}

// Keep season_config.status consistent with the same calendar the UI shows.
// Half 1 of any week does NOT advance current_week yet — the week isn't
// done until half 2 (the remaining 4 days) also completes. Must be the full
// getStatusForWeek(week) here, not a preseason/regular-season binary — this
// collapsed offseason, free-agency, summer-league, play-in, playoffs, and
// draft weeks all into 'regular-season', which then also broke anything
// downstream reading the stored status (e.g. TeamSchedule.tsx's Pre-Season
// friendly scheduler, which only shows once status==='pre-season').
const newStatus = getStatusForWeek(week)
if (half !== 1) {
await supabaseAdmin.from('season_config').update({ current_week: week, status: newStatus, next_sim_half: 1 }).eq('id',1)
}
await supabaseAdmin.from('gm_orders').update({ locked: true }).eq('week_number', week)

// ── FRIENDLY / PRE-SEASON GAMES ────────────────────────
// Friendlies have their own scheduled_date (set by whichever GM booked
// them) and are simulated strictly within the half whose date range
// actually contains that date — same rule as real games, no retroactive
// catch-up. A friendly whose date has already been passed by current_week
// stays unresolved until the commissioner explicitly rewinds current_week
// to revisit that interval; it is never silently swept into a later,
// unrelated half just because it's overdue.
try {
const ymdFriendly = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const { start: friendlyStart, end: friendlyEnd } = getHalfWeekDates(week, half)
const { data: pendingFriendlies } = await supabaseAdmin
.from('preseason_games').select('id').eq('season','2025-26').in('status',['scheduled','accepted'])
.gte('scheduled_date', ymdFriendly(friendlyStart)).lte('scheduled_date', ymdFriendly(friendlyEnd))
for (const pf of (pendingFriendlies||[])) {
const r = await simulatePreseasonGame(pf.id)
if (r.success) friendliesSimulated++
}
} catch(friendlyErr) { console.warn('Friendly games step failed:', friendlyErr) }

if (half === 1) {
// Half 1 done — give GMs a recap of just these games now (half 2 will
// send its own recap when the week actually finishes), then stop here.
// Everything below (attribute development, awards, power rankings, GM
// satisfaction, full-week notifications, scouting points, etc.) is a
// once-per-week step and only runs once the whole week is simulated.
// For phases with no day-scoped games (Free Agency, Draft, etc.) this is
// just a quick, mostly-empty pass — kept consistent on purpose so every
// week always takes exactly 2 sim actions, same cadence throughout.
try { await runPostSimNotifications(week, gamesCreated, techFoulEvents) } catch (notifErr) { console.warn('Half-1 notifications failed:', notifErr) }
await supabaseAdmin.from('season_config').update({ next_sim_half: 2 }).eq('id',1)
return NextResponse.json({
success: true, week, half: 1, games_simulated: gamesSimulated, friendlies_simulated: friendliesSimulated,
message: gamesSimulated > 0 || friendliesSimulated > 0
? `Semana ${week} — dias 1-3 simulados (${gamesSimulated} jogos, ${friendliesSimulated} amigável(is)). Corre outra vez para simular os dias 4-7.`
: `Semana ${week} — dias 1-3 (sem jogos nesta fase). Corre outra vez para simular os dias 4-7.`
})
}

// ── ATTRIBUTE DEVELOPMENT ─────────────────────────────
try {
const { data: allPlayers3 } = await supabaseAdmin
.from('players').select('id,name,age,health,moral,dev_rate,team_id,'+
'three,layup,dunk,mid,ft,siq,draw_foul,blk,stl,idef,pdef,def_reb,off_reb,'+
'stamina,durability,ball_hdl,pass_vis,pass_iq,pressure,consistency,assist_role,'+
'pot_three,pot_layup,pot_dunk,pot_mid,pot_ft,pot_siq,pot_draw_foul,pot_blk,pot_stl,'+
'pot_idef,pot_pdef,pot_def_reb,pot_off_reb,pot_stamina,pot_durability,'+
'pot_ball_hdl,pot_pass_vis,pot_pass_iq,pot_pressure,pot_consistency,pot_assist_role')

// Was querying columns that don't exist on `coaches` (player_dev, specialty,
// specialty_boost) — Supabase returned a 400 on every single call, so this
// whole coach-quality bonus was silently a no-op forever (every player got
// the same neutral 60-baseline regardless of actual coaching staff).
const { data: coaches3 } = await supabaseAdmin.from('coaches').select('team_id,role,player_development,offense_iq,defense_iq,offense_dev,defense_dev,shooting_dev,conditioning')

const coachBonus: Record<string,{dev:number,off:number,def:number,conditioning:number,specialties:Record<string,number>}> = {}
for (const c of (coaches3||[])) {
if (!c.team_id) continue
if (!coachBonus[c.team_id]) coachBonus[c.team_id] = {dev:60,off:60,def:60,conditioning:60,specialties:{}}
if (c.role==='head_coach') {
coachBonus[c.team_id].dev = c.player_development||60
coachBonus[c.team_id].off = c.offense_iq||60
coachBonus[c.team_id].def = c.defense_iq||60
}
if (c.role==='assistant_coach') {
if ((c.offense_dev||60) > 65) coachBonus[c.team_id].specialties['offense'] = c.offense_dev-60
if ((c.defense_dev||60) > 65) coachBonus[c.team_id].specialties['defense'] = c.defense_dev-60
if ((c.shooting_dev||60) > 65) coachBonus[c.team_id].specialties['shooting'] = c.shooting_dev-60
}
if (c.role==='trainer') {
coachBonus[c.team_id].conditioning = Math.max(coachBonus[c.team_id].conditioning, c.conditioning||60)
}
}

const TRAIN_DEV: Record<string,number> = {rest:-0.5,light:0.5,normal:1.0,intense:1.5,very_intense:1.8}

const ATTRS = ['three','layup','dunk','mid','ft','siq','draw_foul','blk','stl',
'idef','pdef','def_reb','off_reb','stamina','durability',
'ball_hdl','pass_vis','pass_iq','pressure','consistency','assist_role']

const OFF_ATTRS = new Set(['three','layup','dunk','mid','ft','siq','draw_foul'])
const DEF_ATTRS = new Set(['blk','stl','idef','pdef'])
const PHYS_ATTRS = new Set(['stamina','durability','def_reb','off_reb'])

const SPECIALTY_MAP: Record<string,string[]> = {
offense: ['three','mid','layup','dunk','siq'],
defense: ['blk','stl','idef','pdef'],
shooting: ['three','mid','ft'],
playmaking: ['ball_hdl','pass_vis','pass_iq','assist_role'],
bigs: ['blk','def_reb','off_reb','idef','dunk'],
}

const { data: weekOrds3 } = await supabaseAdmin.from('gm_orders').select('team_id,training_intensity,pace').eq('week_number',week)
const ordMap3: Record<string,any> = {}
;(weekOrds3||[]).forEach((o:any) => ordMap3[o.team_id]=o)

// Every player's update/insert used to be awaited one at a time inside
// this loop — with ~1150+ active players that's 1150+ sequential DB
// round-trips (~100ms each on Supabase's network) for a step that runs
// EVERY week regardless of whether any real games were played, which is
// exactly what made a zero-game offseason week still take ~2 minutes to
// simulate. Now every player's math runs in memory first, then the writes
// go out in batches of 50 concurrently (same chunking pattern as the
// aging step further down), cutting this to a handful of round-trips.
const allPlayerUpdates: { id:string, updates:Record<string,number> }[] = []
const allDevLogs: any[] = []

for (const p of (allPlayers3||[])) {
const ord = ordMap3[p.team_id] || {training_intensity:'normal'}
const coach = coachBonus[p.team_id] || {dev:60,off:60,def:60,conditioning:60,specialties:{}}
const trainMod = TRAIN_DEV[ord.training_intensity||'normal'] || 1.0
const coachDevMod = (coach.dev - 60) / 100
const moralMod = ((p.moral||80) - 80) / 200
const ageFactor = p.age <= 22 ? 1.5 : p.age <= 25 ? 1.2 : p.age <= 28 ? 1.0 : p.age <= 31 ? 0.7 : p.age <= 34 ? 0.3 : 0.0
const healthMod = (p.health||100) < 60 ? 0 : (p.health||100) < 80 ? 0.5 : 1.0
const devRate = (p.dev_rate||1.0) * ageFactor * healthMod

const updates: Record<string,number> = {}
const devLogs: any[] = []

for (const attr of ATTRS) {
const curr = (p as any)[attr] || 0
const pot = (p as any)[`pot_${attr}`] || curr
if (curr >= pot) continue

let growthChance = 0.15 * trainMod * (1 + coachDevMod) * devRate

const specialty = Object.entries(coach.specialties).find(([sp]) => SPECIALTY_MAP[sp]?.includes(attr))
if (specialty) growthChance *= (1 + specialty[1]/100)

if (OFF_ATTRS.has(attr)) growthChance *= (1 + (coach.off-60)/200)
if (DEF_ATTRS.has(attr)) growthChance *= (1 + (coach.def-60)/200)
if (PHYS_ATTRS.has(attr)) growthChance *= (1 + (coach.conditioning-60)/200)

growthChance *= (1 + moralMod)

if (Math.random() < growthChance) {
const gain = Math.min(2, Math.max(1, Math.round(devRate * trainMod)))
const newVal = Math.min(pot, curr + gain)
if (newVal > curr) {
updates[attr] = newVal
devLogs.push({ player_id:p.id, season:'2025-26', week_number:week, attribute:attr, old_value:curr, new_value:newVal, change:newVal-curr, reason:`training_${ord.training_intensity||'normal'}` })
}
}

if (p.age > 34 && Math.random() < 0.08) {
const newVal = Math.max(30, curr - 1)
if (newVal < curr) {
updates[attr] = newVal
devLogs.push({ player_id:p.id, season:'2025-26', week_number:week, attribute:attr, old_value:curr, new_value:newVal, change:-1, reason:'age_decline' })
}
}
}

if (Object.keys(updates).length > 0) {
allPlayerUpdates.push({ id: p.id, updates })
}
if (devLogs.length > 0) {
allDevLogs.push(...devLogs)
}
}

for (let i = 0; i < allPlayerUpdates.length; i += 50) {
const chunk = allPlayerUpdates.slice(i, i + 50)
await Promise.all(chunk.map(u => supabaseAdmin.from('players').update(u.updates).eq('id', u.id)))
}
for (let i = 0; i < allDevLogs.length; i += 500) {
await supabaseAdmin.from('attribute_development').insert(allDevLogs.slice(i, i + 500))
}
} catch(devErr) { console.warn('Development step failed', devErr) }

// ── PLAYER INTERACTIONS ────────────────────────────────
// Real, actionable morale system: an unhappy player raises a specific,
// credible reason instead of a silent "low morale" stat. See
// src/lib/player-interactions.ts for the eligibility/monitoring logic.
try {
await resolveMonitoredInteractions(week)
await refreshMonitoredProgress(week)
await checkForNewInteractions(week)
} catch(interErr) { console.warn('Player interactions step failed', interErr) }

// ── SUMMER LEAGUE ──────────────────────────────────────
// Weeks 2-3 (Jul 11-24): 30 teams field Rookies + Sophomores + young FAs in
// an 11-day side tournament — never touches real stats/cap. One stage
// (roster gen, then each round) advances per tick; see src/lib/summer-league.ts.
if (getStatusForWeek(week) === 'summer-league') {
  try { await resolveSummerLeague() } catch (slErr) { console.warn('Summer League step failed', slErr) }
}

// ── PLAYOFF BRACKET ────────────────────────────────────
// The bracket page/playoff_series rows already existed as a live-updating
// PREVIEW of seeding — nothing ever actually created real playoff games or
// advanced the bracket. Advances every still-open series by one game per
// tick (play-in included); see src/lib/playoff-resolver.ts.
if (['play-in', 'playoffs'].includes(getStatusForWeek(week))) {
  try {
    const poResult = await resolvePlayoffSeries(week)
    console.log(`Playoff bracket — games simulated: ${poResult.processed}`)
  } catch (poErr) { console.warn('Playoff bracket step failed', poErr) }
}

// ── TRAINING SLOT FILL + UNLOCK ───────────────────────
// Fills each unlocked training_slots row a little every week. The fill
// rate blends the whole relevant coaching staff, not just one person:
// Head Coach + Assistant Coach share the 6 "skill" categories (the Head
// Coach sets the overall program, the Assistant Coach's specialty fields
// — offense_dev/defense_dev/shooting_dev/tactical_dev/mental_dev/analytics
// — represent their specific focus), while the Trainer leads Physical and
// Recovery (their actual domain) with the Head Coach as a smaller
// secondary contributor everywhere via general oversight. At 100% the
// slot pays out 10 credits (per TrainingTab.tsx's UI copy) and rolls over
// any overflow into the next fill cycle. Locked slots unlock once their
// facility/coach requirement is actually met.
try {
const { data: allSlots } = await supabaseAdmin.from('training_slots').select('id,team_id,slot_type,fill_pct,credits_available,locked')
const { data: slotCoaches } = await supabaseAdmin.from('coaches')
.select('team_id,role,off_development,def_development,mental_dev,physical_dev,shooting_dev,analytics,recovery_boost,offense_dev,defense_dev,tactical_dev')
.not('team_id','is',null)
const { data: allFacilities } = await supabaseAdmin.from('practice_facilities').select('team_id,gym_grade,has_pool,has_sauna,has_shooting_machine')

const coachByTeamRole: Record<string, Record<string, any>> = {}
for (const c of (slotCoaches||[])) {
if (!coachByTeamRole[c.team_id]) coachByTeamRole[c.team_id] = {}
coachByTeamRole[c.team_id][c.role] = c
}
const facilityByTeam: Record<string, any> = {}
for (const f of (allFacilities||[])) facilityByTeam[f.team_id] = f

const trainingFillRate = (slotType: string, teamId: string): number => {
const hc = coachByTeamRole[teamId]?.head_coach
const ac = coachByTeamRole[teamId]?.assistant_coach
const trainer = coachByTeamRole[teamId]?.trainer
const g = (v: number | undefined | null) => v ?? 60

let quality: number
if (slotType === 'physical') quality = 0.7*g(trainer?.physical_dev) + 0.3*g(hc?.physical_dev)
else if (slotType === 'recovery') quality = 0.7*g(trainer?.recovery_boost) + 0.3*g(hc?.recovery_boost)
else if (slotType === 'offense') quality = 0.6*g(hc?.off_development) + 0.4*g(ac?.offense_dev)
else if (slotType === 'defense') quality = 0.6*g(hc?.def_development) + 0.4*g(ac?.defense_dev)
else if (slotType === 'shooting') quality = 0.6*g(hc?.shooting_dev) + 0.4*g(ac?.shooting_dev)
else if (slotType === 'playmaking') quality = 0.6*g(hc?.tactical_dev) + 0.4*g(ac?.tactical_dev)
else if (slotType === 'mental') quality = 0.6*g(hc?.mental_dev) + 0.4*g(ac?.mental_dev)
else if (slotType === 'analytics') quality = 0.6*g(hc?.analytics) + 0.4*g(ac?.analytics)
else quality = 60

const coachDrivenGain = Math.max(2, Math.min(15, 5 + (quality-60)*0.3))
// Practice Facility grade adds a real, secondary boost on top of the
// coach-driven gain — the coaching staff is still the primary lever, the
// gym grade (previously a purely decorative "+5% to +19%/wk" UI number)
// now contributes a real fraction of it.
const facilityBonus = getGymGradeBonus(facilityByTeam[teamId]?.gym_grade).speed * 0.3
return coachDrivenGain + facilityBonus
}

const trainingUnlockMet = (slotType: string, teamId: string): boolean => {
const fac = facilityByTeam[teamId]
const hc = coachByTeamRole[teamId]?.head_coach
if (slotType==='playmaking') return !!fac && ['D','C','B','A'].includes(fac.gym_grade)
if (slotType==='mental') return (hc?.mental_dev||0) >= 70
if (slotType==='recovery') return !!fac && (fac.has_pool || fac.has_sauna)
if (slotType==='shooting') return !!fac && !!fac.has_shooting_machine
if (slotType==='analytics') return !!fac && fac.gym_grade === 'A'
return true
}

for (const slot of (allSlots||[])) {
if (slot.locked) {
if (trainingUnlockMet(slot.slot_type, slot.team_id)) {
await supabaseAdmin.from('training_slots').update({ locked: false }).eq('id', slot.id)
}
continue
}
const gain = trainingFillRate(slot.slot_type, slot.team_id)
let newFill = (slot.fill_pct||0) + gain
let newCredits = slot.credits_available||0
while (newFill >= 100) { newCredits += 10; newFill -= 100 }
if (newFill !== slot.fill_pct || newCredits !== slot.credits_available) {
await supabaseAdmin.from('training_slots').update({ fill_pct: newFill, credits_available: newCredits }).eq('id', slot.id)
}
}
} catch(trainSlotErr) { console.warn('Training slot fill step failed:', trainSlotErr) }

// ── WEEKLY HIGHLIGHTS ─────────────────────────
if (!isPreseason) {
try {
const weekBoxes2 = await fetchAllRows<any>((from,to) => supabaseAdmin
.from('box_scores').select('player_id,game_id,team_id,mins,pts,reb,ast,stl,blk')
.in('game_id', gamesCreated).range(from,to))

let potwScore = 0, potwBox: any = null
for (const box of (weekBoxes2||[])) {
const score = (box.pts||0)*1.0 + (box.reb||0)*1.2 + (box.ast||0)*1.5 + (box.stl||0)*3 + (box.blk||0)*3
if (score > potwScore && box.mins >= 15) { potwScore = score; potwBox = box }
}

let uotwGame: any = null, uotwOdds = 0.5
const { data: weekGames2 } = await supabaseAdmin.from('games').select('*').in('id',gamesCreated)
const { data: eloSnap } = await supabaseAdmin.from('teams').select('id,elo')
const eloMap: Record<string,number> = Object.fromEntries((eloSnap||[]).map((t:any)=>[t.id, t.elo||1500]))
for (const g of (weekGames2||[])) {
const hProb = homeWinProb(eloMap[g.home_team]||1500, eloMap[g.away_team]||1500)
const homeWin = (g.home_score||0) > (g.away_score||0)
const winnerProb = homeWin ? hProb : (1 - hProb)
if (winnerProb < uotwOdds) { uotwOdds = winnerProb; uotwGame = g }
}

const { data: allRecentGames } = await supabaseAdmin.from('games').select('*').eq('status','final').order('played_at',{ascending:false}).limit(100)
const streaks: Record<string,{count:number,games:string[]}> = {}
for (const g of (allRecentGames||[])) {
const hw = (g.home_score||0)>(g.away_score||0)
const wt2 = hw?g.home_team:g.away_team
const lt = hw?g.away_team:g.home_team
if (!streaks[wt2]) streaks[wt2]={count:0,games:[]}
if (!streaks[lt]) streaks[lt]={count:0,games:[]}
streaks[wt2].count++
streaks[wt2].games.push(g.id)
streaks[lt].count=0
streaks[lt].games=[]
}
const hotTeam = Object.entries(streaks).sort((a,b)=>b[1].count-a[1].count)[0]

if (potwBox || uotwGame || hotTeam) {
await supabaseAdmin.from('weekly_highlights').upsert({
season:'2025-26', week_number:week,
potw_player_id: potwBox?.player_id || null,
potw_game_id: potwBox?.game_id || null,
potw_pts: potwBox?.pts || 0,
potw_reb: potwBox?.reb || 0,
potw_ast: potwBox?.ast || 0,
potw_stl: potwBox?.stl || 0,
potw_blk: potwBox?.blk || 0,
potw_score: potwScore,
uotw_game_id: uotwGame?.id || null,
uotw_winner_id: uotwGame ? ((uotwGame.home_score||0)>(uotwGame.away_score||0)?uotwGame.home_team:uotwGame.away_team) : null,
uotw_loser_id: uotwGame ? ((uotwGame.home_score||0)>(uotwGame.away_score||0)?uotwGame.away_team:uotwGame.home_team) : null,
uotw_score: uotwGame ? `${uotwGame.home_score}-${uotwGame.away_score}` : null,
uotw_odds: uotwOdds,
hstreak_team_id: hotTeam?.[0] || null,
hstreak_wins: hotTeam?.[1].count || 0,
hstreak_games: hotTeam?.[1].games.slice(0,5) || [],
},{onConflict:'season,week_number'})
}
} catch(hlErr) { console.warn('Highlights step failed', hlErr) }
}

// ── G-LEAGUE SIMULATION ────────────────────────────────
try {
const { data: glGames } = await supabaseAdmin
.from('gleague_games')
.select('*, home:gleague_teams!gleague_games_home_team_fkey(*), away:gleague_teams!gleague_games_away_team_fkey(*)')
.eq('week_number', week)
.eq('status', 'scheduled')
.eq('season', '2025-26')

for (const game of (glGames || [])) {
const homeAdv = 3
const base = 105 + Math.round(Math.random() * 20)
const homeScore = base + homeAdv + Math.round(Math.random() * 15)
const awayScore = base - homeAdv + Math.round(Math.random() * 15)
const hWon = homeScore > awayScore

await supabaseAdmin.from('gleague_games').update({
home_score: homeScore, away_score: awayScore, status: 'final'
}).eq('id', game.id)

await supabaseAdmin.from('gleague_teams').update({
wins: (game.home?.wins||0) + (hWon?1:0),
losses: (game.home?.losses||0) + (hWon?0:1),
}).eq('id', game.home_team)

await supabaseAdmin.from('gleague_teams').update({
wins: (game.away?.wins||0) + (hWon?0:1),
losses: (game.away?.losses||0) + (hWon?1:0),
}).eq('id', game.away_team)

const { data: assignedPlayers } = await supabaseAdmin
.from('players').select('*')
.eq('on_gleague_assignment', true)
.in('gleague_team_id', [game.home_team, game.away_team])

for (const p of (assignedPlayers || [])) {
const pts = Math.round(12 + Math.random() * 20 + (p.usage||50)/10)
const reb = Math.round(3 + Math.random() * 8)
const ast = Math.round(1 + Math.random() * 6)
const stl = Math.round(Math.random() * 3)
const blk = Math.round(Math.random() * 2)

const { data: existStat } = await supabaseAdmin
.from('gleague_player_stats').select('*')
.eq('player_id', p.id).eq('season','2025-26').single()

if (existStat) {
await supabaseAdmin.from('gleague_player_stats').update({
games: existStat.games + 1,
pts: existStat.pts + pts, reb: existStat.reb + reb,
ast: existStat.ast + ast, stl: existStat.stl + stl, blk: existStat.blk + blk,
}).eq('id', existStat.id)
} else {
await supabaseAdmin.from('gleague_player_stats').insert({
player_id: p.id, gleague_team_id: p.gleague_team_id,
season: '2025-26', games: 1,
pts, reb, ast, stl, blk
})
}

const devBoost = Math.random() < 0.15
if (devBoost) {
const attrs = ['three','layup','mid','ft','siq','ball_hdl','pass_vis','stamina','durability']
const attr = attrs[Math.floor(Math.random() * attrs.length)]
const cur = (p as any)[attr] || 60
if (cur < 90) {
await supabaseAdmin.from('players').update({ [attr]: cur + 1 }).eq('id', p.id)
}
}
}
}
} catch(glErr) { console.warn('G-League sim error:', glErr) }

// ── AWARDS ────────────────────────────────────────────
if (!isPreseason) {
try {
const isEndOfMonth = week % 4 === 0
// Must be exact equality, not >= — this same cron keeps running (and `week`
// keeps incrementing) all the way through play-in/playoffs/draft, so `>=`
// would re-fire season-end awards every single week from 40 through 52+
// instead of once. Awards themselves are upserted (harmless to repeat) but
// still wasteful and would spam repeat "new award" notifications; the
// aging/rookie-option blocks below share this exact bug fixed the same way.
const isEndOfSeason = week === 40 // last week of the Regular Season (see season-week-helper.ts)

const weekBoxesAw = await fetchAllRows<any>((from,to) => supabaseAdmin
.from('box_scores')
.select('player_id,game_id,pts,reb,ast,stl,blk,mins,team_id')
.in('game_id', gamesCreated).range(from,to))

const { data: weekGamesData } = await supabaseAdmin
.from('games').select('id,home_team,away_team,home_score,away_score')
.in('id', gamesCreated)

const gameResultMap: Record<string,{winner:string,loser:string}> = {}
for (const g of (weekGamesData||[])) {
const hw = (g.home_score||0) > (g.away_score||0)
gameResultMap[g.id] = { winner: hw ? g.home_team : g.away_team, loser: hw ? g.away_team : g.home_team }
}

// players!→teams has 2 possible FKs (team_id and previous_team_id) — an
// unqualified "teams!inner(...)" is ambiguous and Supabase rejects the
// query entirely, silently returning no rows, which made every player
// fall through to the 'Eastern' default below regardless of their real
// conference. Naming the FK explicitly (players_team_id_fkey) fixes it.
const { data: allPlayersAw } = await supabaseAdmin
.from('players').select('id,name,team_id,teams!players_team_id_fkey!inner(conference)')
.in('id', (weekBoxesAw||[]).map((b:any)=>b.player_id).filter(Boolean))

const playerConf: Record<string,string> = {}
const playerTeam: Record<string,string> = {}
for (const p of (allPlayersAw||[])) {
playerConf[p.id] = (p.teams as any)?.conference || 'Eastern'
playerTeam[p.id] = p.team_id
}

const playerWeekStats: Record<string,{pts:number,reb:number,ast:number,stl:number,blk:number,games:number,wins:number,teamId:string}> = {}
for (const b of (weekBoxesAw||[])) {
if (!b.player_id || (b.mins||0) < 10) continue
if (!playerWeekStats[b.player_id]) playerWeekStats[b.player_id] = {pts:0,reb:0,ast:0,stl:0,blk:0,games:0,wins:0,teamId:b.team_id}
const s = playerWeekStats[b.player_id]
s.pts+=b.pts||0; s.reb+=b.reb||0; s.ast+=b.ast||0; s.stl+=b.stl||0; s.blk+=b.blk||0; s.games++
if (gameResultMap[b.game_id]?.winner === b.team_id) s.wins++
}

const potwCandidates: {id:string,score:number,conf:string,stats:any}[] = []
for (const [pid, s] of Object.entries(playerWeekStats)) {
if (s.games < 2) continue
const g = s.games
const baseScore = (s.pts/g)*1.0 + (s.reb/g)*1.2 + (s.ast/g)*1.5 + (s.stl/g)*3 + (s.blk/g)*3
const winPct = s.wins / g
const winBonus = winPct >= 0.5 ? 1.2 : (s.pts/g >= 35 ? 1.1 : 1.0)
potwCandidates.push({
id: pid, score: baseScore * winBonus, conf: playerConf[pid] || 'Eastern',
stats: {ppg:(s.pts/g).toFixed(1),rpg:(s.reb/g).toFixed(1),apg:(s.ast/g).toFixed(1),games:g,wins:s.wins}
})
}

for (const conf of ['Eastern','Western']) {
const winner = potwCandidates.filter(c=>c.conf===conf).sort((a,b)=>b.score-a.score)[0]
if (winner) {
await supabaseAdmin.from('awards').upsert({
season:'2025-26', award_type:`potw_${conf.toLowerCase()}`,
period:`week_${week}`, conference: conf,
player_id: winner.id, team_id: playerTeam[winner.id],
score: winner.score, stats_context: winner.stats,
notes: `Week ${week} ${conf} Player of the Week`
}, {onConflict:'season,award_type,period'})
}
}

if (isEndOfMonth) {
const monthNum = Math.floor(week/4)
// `games` has no `season` column (single-season table) — the .eq('season',...)
// filter here silently matched zero rows every time, so Player of the
// Month never actually had any month-box data to work with. Found live
// while testing the merchandising month-end resolver, which copied this
// exact (broken) query shape.
const { data: monthGameIds } = await supabaseAdmin.from('games').select('id')
.gte('week_number', (monthNum-1)*4+1)
.lte('week_number', monthNum*4)
const monthBoxes = await fetchAllRows<any>((from,to) => supabaseAdmin
.from('box_scores').select('player_id,game_id,pts,reb,ast,stl,blk,mins,team_id')
.in('game_id', (monthGameIds||[]).map((g:any)=>g.id)).range(from,to))

const monthStats: Record<string,{pts:number,reb:number,ast:number,stl:number,blk:number,games:number,wins:number,teamId:string}> = {}
for (const b of (monthBoxes||[])) {
if (!b.player_id||(b.mins||0)<10) continue
if (!monthStats[b.player_id]) monthStats[b.player_id]={pts:0,reb:0,ast:0,stl:0,blk:0,games:0,wins:0,teamId:b.team_id}
const s=monthStats[b.player_id]
s.pts+=b.pts||0;s.reb+=b.reb||0;s.ast+=b.ast||0;s.stl+=b.stl||0;s.blk+=b.blk||0;s.games++
if(gameResultMap[b.game_id]?.winner===b.team_id) s.wins++
}

const potmCandidates = Object.entries(monthStats)
.filter(([,s])=>s.games>=6)
.map(([pid,s])=>{
const g=s.games
const score=(s.pts/g)*1.0+(s.reb/g)*1.2+(s.ast/g)*1.5+(s.stl/g)*3+(s.blk/g)*3
const winBonus=(s.wins/g)>=0.5?1.2:1.0
return {id:pid,score:score*winBonus,conf:playerConf[pid]||'Eastern',
stats:{ppg:(s.pts/g).toFixed(1),rpg:(s.reb/g).toFixed(1),apg:(s.ast/g).toFixed(1),games:g}}
})

for (const conf of ['Eastern','Western']) {
const winner = potmCandidates.filter(c=>c.conf===conf).sort((a,b)=>b.score-a.score)[0]
if (winner) {
await supabaseAdmin.from('awards').upsert({
season:'2025-26', award_type:`potm_${conf.toLowerCase()}`,
period:`month_${monthNum}`, conference:conf,
player_id:winner.id, team_id:playerTeam[winner.id],
score:winner.score, stats_context:winner.stats,
notes:`Month ${monthNum} ${conf} Player of the Month`
},{onConflict:'season,award_type,period'})
}
}

// ── FIXED FACILITY/CONCESSION MAINTENANCE (utilities) ────────────────
// practice_facilities.monthly_cost and arena_concessions.monthly_maintenance
// were real, editable numbers (rising every time a GM built something) but
// were never actually deducted from any team's balance — buildings and
// concession stands were effectively free to run forever. Real monthly
// deduction, same cadence as Player of the Month/Merchandising above.
try {
const { data: allFacilitiesMonthly } = await supabaseAdmin.from('practice_facilities').select('team_id,monthly_cost')
const { data: allConcessionsMonthly } = await supabaseAdmin.from('arena_concessions').select('team_id,monthly_maintenance')
const monthlyCostByTeam: Record<string, number> = {}
for (const f of (allFacilitiesMonthly||[])) monthlyCostByTeam[f.team_id] = (monthlyCostByTeam[f.team_id]||0) + (f.monthly_cost||0)
for (const c of (allConcessionsMonthly||[])) monthlyCostByTeam[c.team_id] = (monthlyCostByTeam[c.team_id]||0) + (c.monthly_maintenance||0)
for (const [teamId, cost] of Object.entries(monthlyCostByTeam)) {
if (cost <= 0) continue
const { data: fin } = await supabaseAdmin.from('franchise_finances').select('balance').eq('team_id', teamId).single()
if (!fin) continue
await supabaseAdmin.from('franchise_finances').update({ balance: (fin.balance||0) - cost }).eq('team_id', teamId)
await supabaseAdmin.from('franchise_transactions').insert({
team_id: teamId, type: 'expense', category: 'maintenance', amount: cost,
description: `Monthly facility/concession maintenance — Month ${monthNum}`, season: '2025-26', week_number: week,
})
}
} catch (maintErr) { console.warn('Monthly maintenance deduction failed:', maintErr) }

// ── MERCHANDISING (jersey sales) ────────────────────
// Same isEndOfMonth/monthNum cadence as Player of the Month above — fame
// drifts monthly toward a deserved target (quality/form/wins/awards/any
// active marketing campaign) and turns into real jersey revenue, posted
// straight to the balance sheet. See src/lib/merchandising.ts.
try {
const merchResult = await resolveMonthlyMerchandising(week)
console.log(`Merchandising resolved: ${merchResult.players} players, ${merchResult.teams} teams with revenue`)
} catch (merchErr) { console.warn('Merchandising resolution failed:', merchErr) }

// ── ALL-STAR WEEKEND ─────────────────────────────────
// Self-guarded (checks current week + allstar_config.roster_announced
// internally) — safe to call every week, only actually resolves once, right
// after voting closes. See src/lib/allstar-resolver.ts.
try {
const asResult = await resolveAllStarWeekend()
if (!asResult.skipped) console.log(`All-Star Weekend resolved: ${asResult.total} roster spots, ${asResult.auto_votes} auto-votes`)
} catch (asErr) { console.warn('All-Star Weekend resolution failed:', asErr) }
}

if (isEndOfSeason) {
const MIN_GAMES = 65
const { data: rawSeasonStats } = await supabaseAdmin
.from('player_stats').select('*,players!inner(id,name,pos,team_id,nba_experience,potential_grade,teams!players_team_id_fkey!inner(id,name,conference,wins,pts_against))')
.eq('season','2025-26')

// A trade splits a player's season across multiple team-stint rows (see
// cron simulate's per-game accumulation above) — fold them back into one
// season total per player before applying MIN_GAMES or computing
// per-game averages, otherwise someone who played 70 games total across
// two teams (40+30) would wrongly look like two separate non-qualifiers.
// players!inner is a live join to the CURRENT team, identical on every
// stint row for the same player, so team-based bonuses below still use
// whichever team he's on right now — no extra logic needed for that part.
const aggByPlayer: Record<string, any> = {}
for (const s of (rawSeasonStats||[])) {
const cur = aggByPlayer[s.player_id]
if (!cur) { aggByPlayer[s.player_id] = { ...s, games: s.games||0, pts: s.pts||0, reb: s.reb||0, ast: s.ast||0, stl: s.stl||0, blk: s.blk||0 }; continue }
cur.games += s.games||0; cur.pts += s.pts||0; cur.reb += s.reb||0; cur.ast += s.ast||0
cur.stl += s.stl||0; cur.blk += s.blk||0
}
const seasonStats = Object.values(aggByPlayer).filter((s:any) => s.games >= MIN_GAMES)

if (seasonStats && seasonStats.length > 0) {
const mvpScores = seasonStats.map((s:any) => {
const g = s.games||1
const base = (s.pts/g)*1.0+(s.reb/g)*1.2+(s.ast/g)*1.5+(s.stl/g)*3+(s.blk/g)*3
const teamWins = (s.players?.teams?.wins||0)/82
return {id:s.player_id,score:base*(1+teamWins*0.4),
stats:{ppg:(s.pts/g).toFixed(1),rpg:(s.reb/g).toFixed(1),apg:(s.ast/g).toFixed(1),games:g}}
}).sort((a:any,b:any)=>b.score-a.score)

if (mvpScores[0]) await supabaseAdmin.from('awards').upsert({
season:'2025-26',award_type:'mvp',period:'season',
player_id:mvpScores[0].id,score:mvpScores[0].score,
stats_context:mvpScores[0].stats,notes:'Most Valuable Player'
},{onConflict:'season,award_type,period'})

const { data: teamDef } = await supabaseAdmin
.from('teams').select('id,pts_against').not('id','in','(ALL,RVS,ROO,SOP)').order('pts_against',{ascending:true})
const topDefTeams = new Set((teamDef||[]).slice(0,10).map((t:any)=>t.id))
{
const dpoyScores = seasonStats.map((s:any)=>{
const g = s.games||1
const baseScore = ((s.blk||0)/g)*4 + ((s.stl||0)/g)*4
const defBonus = topDefTeams.has(s.players?.team_id) ? 1.15 : 1.0
return { id:s.player_id, score: baseScore * defBonus }
}).sort((a:any,b:any)=>b.score-a.score)
if (dpoyScores[0]) await supabaseAdmin.from('awards').upsert({
season:'2025-26',award_type:'dpoy',period:'season',
player_id:dpoyScores[0].id,score:dpoyScores[0].score,
notes:'Defensive Player of the Year'
},{onConflict:'season,award_type,period'})
}

const royScores = seasonStats
.filter((s:any) => (s.players?.nba_experience ?? 1) === 0)
.map((s:any) => {
const g = s.games||1
return {id:s.player_id, score:(s.pts/g)+(s.reb/g)*0.8+(s.ast/g)*1.2}
}).sort((a:any,b:any)=>b.score-a.score)
if (royScores[0]) await supabaseAdmin.from('awards').upsert({
season:'2025-26',award_type:'roy',period:'season',
player_id:royScores[0].id,score:royScores[0].score,
notes:'Rookie of the Year'
},{onConflict:'season,award_type,period'})

const allNBATeams: [string,number,number][] = [['all_nba_1',0,5],['all_nba_2',5,10],['all_nba_3',10,15]]
for (const [type,from,to] of allNBATeams) {
for (const m of mvpScores.slice(from,to)) {
await supabaseAdmin.from('awards').upsert({
season:'2025-26', award_type:type, period:`season_${m.id}`,
player_id:m.id, score:m.score, stats_context:m.stats
}, {onConflict:'season,award_type,period'})
}
}

// All-Rookie 1st/2nd Team — same royScores ranking already computed above
// for ROY, just split into two teams of 5 instead of only crowning #1.
const allRookieTeams: [string,number,number][] = [['all_rookie_1',0,5],['all_rookie_2',5,10]]
for (const [type,from,to] of allRookieTeams) {
for (const m of royScores.slice(from,to)) {
await supabaseAdmin.from('awards').upsert({
season:'2025-26', award_type:type, period:`season_${m.id}`,
player_id:m.id, score:m.score
}, {onConflict:'season,award_type,period'})
}
}

// Most Improved Player — this season's (PPG+RPG*0.8+APG*1.2) vs. the same
// player's most recent PRIOR season, min 20 games both seasons to avoid
// injury-shortened noise. Needs a real second season's player_stats to ever
// crown anyone — until this game rolls over past '2025-26', priorSeasonMap
// stays empty and this correctly awards no one, same as ROY finding no
// winner in a league with zero rookies (not a bug, an honest empty result).
const { data: priorSeasonStats } = await supabaseAdmin
.from('player_stats').select('player_id,season,pts,reb,ast,games')
.neq('season','2025-26').order('season',{ascending:false})
// Same team-stint fold as seasonStats above, keyed by player+season (a
// player traded during a PRIOR season would otherwise have that season's
// totals split across two rows too, and "first hit per player" could pick
// an arbitrary partial-season row instead of the true combined total).
const priorAgg: Record<string, {player_id:string,season:string,pts:number,reb:number,ast:number,games:number}> = {}
for (const s of (priorSeasonStats||[])) {
const key = `${s.player_id}:${s.season}`
const cur = priorAgg[key]
if (!cur) { priorAgg[key] = { player_id:s.player_id, season:s.season, pts:s.pts||0, reb:s.reb||0, ast:s.ast||0, games:s.games||0 }; continue }
cur.pts += s.pts||0; cur.reb += s.reb||0; cur.ast += s.ast||0; cur.games += s.games||0
}
const priorSeasonMap: Record<string,{pts:number,reb:number,ast:number,games:number}> = {}
for (const s of Object.values(priorAgg).filter(s => s.games >= 20)) {
if (!priorSeasonMap[s.player_id]) priorSeasonMap[s.player_id] = s // first hit per player = most recent prior season, since source was ordered desc
}
const mipScores = seasonStats
.map((s:any) => {
const prior = priorSeasonMap[s.player_id]
if (!prior) return null
const g = s.games||1, pg = prior.games||1
const thisScore = (s.pts/g)+(s.reb/g)*0.8+(s.ast/g)*1.2
const priorScore = (prior.pts/pg)+(prior.reb/pg)*0.8+(prior.ast/pg)*1.2
return { id:s.player_id, score: thisScore-priorScore,
stats:{ppg:(s.pts/g).toFixed(1),rpg:(s.reb/g).toFixed(1),apg:(s.ast/g).toFixed(1),games:g} }
})
.filter((x:any):x is {id:string,score:number,stats:any} => x !== null && x.score > 0)
.sort((a:any,b:any)=>b.score-a.score)
if (mipScores[0]) await supabaseAdmin.from('awards').upsert({
season:'2025-26',award_type:'mip',period:'season',
player_id:mipScores[0].id,score:mipScores[0].score,
stats_context:mipScores[0].stats,notes:'Most Improved Player'
},{onConflict:'season,award_type,period'})

// Coach of the Year — the head coach whose team's actual win% most exceeds
// what its on-paper roster talent alone would predict (computeRosterQuality,
// the same top-8 usage-weighted real_ovr formula Power Rankings uses).
// Real COY philosophy: reward overperforming a roster, not just winning the
// most with the most talent already in place.
const { data: coyTeams } = await supabaseAdmin.from('teams').select('id,wins,losses').not('id','in','(ALL,RVS,ROO,SOP)')
const { data: coyPlayers } = await supabaseAdmin.from('players').select('team_id,real_ovr,usage').eq('status','active').not('team_id','is',null)
const { data: headCoaches } = await supabaseAdmin.from('coaches').select('id,team_id').eq('role','head_coach').not('team_id','is',null)
const coyRosterByTeam: Record<string,{real_ovr:number,usage:number}[]> = {}
for (const p of (coyPlayers||[])) { (coyRosterByTeam[p.team_id] ||= []).push(p as any) }
const coyTeamMap: Record<string,{wins:number,losses:number}> = {}
for (const t of (coyTeams||[])) coyTeamMap[t.id] = { wins:t.wins||0, losses:t.losses||0 }
const coyScores = (headCoaches||[]).map((c:any) => {
const team = coyTeamMap[c.team_id]
const gamesPlayed = (team?.wins||0)+(team?.losses||0)
if (!team || gamesPlayed === 0) return null
const actualWinPct = team.wins/gamesPlayed
const rosterQualityNorm = normalizeRosterQuality(computeRosterQuality(coyRosterByTeam[c.team_id]||[]))
return { id:c.id, team_id:c.team_id, score: actualWinPct-rosterQualityNorm }
}).filter((x:any):x is {id:string,team_id:string,score:number} => x !== null)
.sort((a:any,b:any)=>b.score-a.score)
if (coyScores[0]) await supabaseAdmin.from('awards').upsert({
season:'2025-26',award_type:'coy',period:'season',
coach_id:coyScores[0].id,team_id:coyScores[0].team_id,score:coyScores[0].score,
notes:'Coach of the Year'
},{onConflict:'season,award_type,period'})
}
}
} catch(awardsErr) { console.warn('Awards step failed:', awardsErr) }
}

// ── END OF SEASON AGING ────────────────────────────────────
// Exact equality, not >= — see the isEndOfSeason comment above. Aging and
// rookie-year progression are ADDITIVE (age+1, rookie_years_elapsed+1), not
// idempotent upserts, so a `>=` gate would have incorrectly aged everyone by
// +13 (or more) instead of +1 once this cron kept running through play-in,
// playoffs, and the draft weeks — and would have skipped rookie option
// deadlines entirely (rookie_years_elapsed jumping straight past the exact
// 2/3 checks below instead of landing on them one week at a time).
if (week === 40) { // last week of the Regular Season (see season-week-helper.ts)
try {
const { data: everyPlayer } = await supabaseAdmin
.from('players').select('id,age,nba_experience,team_id,status').not('age','is',null)
if (everyPlayer) {
for (let i = 0; i < everyPlayer.length; i += 50) {
const chunk = everyPlayer.slice(i, i + 50)
await Promise.all(chunk.map((p:any) =>
supabaseAdmin.from('players').update({
age: (p.age || 20) + 1,
...(p.team_id && p.status === 'active'
? { nba_experience: (p.nba_experience || 0) + 1 }
: {})
}).eq('id', p.id)
))
}
}
} catch(ageErr) { console.warn('Aging step failed:', ageErr) }

// Coaches/staff, referees, and not-yet-drafted prospects are real people
// too — they were never aged anywhere before this, only players were.
try {
const { data: everyCoach } = await supabaseAdmin.from('coaches').select('id,age').not('age','is',null)
if (everyCoach) {
for (let i = 0; i < everyCoach.length; i += 50) {
const chunk = everyCoach.slice(i, i + 50)
await Promise.all(chunk.map((c:any) => supabaseAdmin.from('coaches').update({ age: (c.age||30) + 1 }).eq('id', c.id)))
}
}
} catch(coachAgeErr) { console.warn('Coach aging step failed:', coachAgeErr) }

// Note: referees have no age column in the DB (checked directly) — nothing
// to age there.

try {
const { data: everyProspect } = await supabaseAdmin.from('prospects').select('id,age').eq('drafted', false).not('age','is',null)
if (everyProspect) {
for (let i = 0; i < everyProspect.length; i += 50) {
const chunk = everyProspect.slice(i, i + 50)
await Promise.all(chunk.map((p:any) => supabaseAdmin.from('prospects').update({ age: (p.age||19) + 1 }).eq('id', p.id)))
}
}
} catch(prospectAgeErr) { console.warn('Prospect aging step failed:', prospectAgeErr) }

// ── ROOKIE TEAM OPTION PROGRESSION ──────────────────────
// Same once-a-season trigger as the aging step above — advances rookie
// contracts toward their next Team Option decision point.
try {
const { data: rookies } = await supabaseAdmin
.from('players').select('id,name,team_id,rookie_years_elapsed,rookie_option_status,rookie_draft_round,rookie_draft_pick')
.eq('is_rookie_contract', true).eq('status', 'active')
for (const r of (rookies||[])) {
const newElapsed = (r.rookie_years_elapsed||0) + 1
const update: any = { rookie_years_elapsed: newElapsed }
let newStage: 'y3'|'y4'|null = null
if (newElapsed === 2 && !r.rookie_option_status) { update.rookie_option_status = 'pending_y3'; newStage = 'y3' }
else if (newElapsed === 3 && r.rookie_option_status === 'exercised_y3') { update.rookie_option_status = 'pending_y4'; newStage = 'y4' }
if (newStage) {
const deadline = new Date(Date.now() + 14*24*60*60*1000)
update.rookie_option_deadline = deadline.toISOString()
const lang = await getTeamLang(r.team_id)
const amount = rookieOptionSalary(r.rookie_draft_round, r.rookie_draft_pick, newStage)
const notif = notifRookieOptionEligible(lang, r.name, newStage==='y3'?'Y3':'Y4', amount, deadline)
await supabaseAdmin.from('inbox_messages').insert({
to_team_id: r.team_id, type:'draft', subject: notif.subject, body: notif.body,
read:false, metadata:{ player_id: r.id, stage: newStage },
})
}
await supabaseAdmin.from('players').update(update).eq('id', r.id)
}
} catch(rookieErr) { console.warn('Rookie option progression failed:', rookieErr) }
}

// ── HEALTH RECOVERY ────────────────────────────────────
// Includes 'injured' players too — previously only 'active' players ever
// got health back, so a player who crossed into 'injured' (health<50) was
// stuck there forever with no way back to 'active'. The Physio's rehab_speed
// now genuinely speeds this up (or slows it down), only for the injured.
try {
const isMonday = new Date().getDay() === 1
const recDays = isMonday ? 3 : 2
const { data: allP2 } = await supabaseAdmin.from('players').select('id,health,moral,durability,team_id,status,usage').in('status',['active','injured'])
const { data: ords2 } = await supabaseAdmin.from('gm_orders').select('team_id,training_intensity').eq('week_number',week)
const iMap: Record<string,string> = {}
;(ords2||[]).forEach((o:any) => iMap[o.team_id]=o.training_intensity||'normal')
const IMOD: Record<string,number> = {rest:1.5,light:1.25,normal:1.0,intense:0.5,very_intense:0.25}

const { data: physios } = await supabaseAdmin.from('coaches').select('team_id,rehab_speed').eq('role','physio')
const physioMap: Record<string,number> = {}
;(physios||[]).forEach((c:any) => physioMap[c.team_id]=c.rehab_speed)

// Practice Facility grade's "Recovery" bonus (previously a purely decorative
// UI number) — a real, secondary multiplier on top of intensity/durability,
// same role a good Physio already plays.
const { data: facilitiesForRecovery } = await supabaseAdmin.from('practice_facilities').select('team_id,gym_grade')
const facilityRecoveryMap: Record<string,number> = {}
;(facilitiesForRecovery||[]).forEach((f:any) => facilityRecoveryMap[f.team_id] = getGymGradeBonus(f.gym_grade).recovery)

// Mental Coach — morale_management now scales how fast a player's morale
// drifts toward what it actually "deserves" each week (see moraleTarget()
// below), not just a one-way recovery. A strong Mental Coach settles a
// team on the right number faster, for better or worse.
const { data: mentalCoaches } = await supabaseAdmin.from('coaches').select('team_id,morale_management').eq('role','mental_coach')
const moraleMgmtMap: Record<string,number> = {}
;(mentalCoaches||[]).forEach((c:any) => moraleMgmtMap[c.team_id]=c.morale_management)

// Deserved morale target — winning, actually playing the minutes/role you
// deserve, and recent form above/below your own season average now all
// genuinely move morale every week. None of this touched morale before.
const { data: teamsForMorale } = await supabaseAdmin.from('teams').select('id,wins,losses').not('id','in','(ALL,RVS,ROO,SOP)')
const winPctMap: Record<string,number> = {}
;(teamsForMorale||[]).forEach((t:any) => { const gp=(t.wins||0)+(t.losses||0); winPctMap[t.id] = gp>0 ? (t.wins||0)/gp : 0.5 })

const activeIds = (allP2||[]).map((p:any) => p.id)
const rosterByTeam: Record<string, any[]> = {}
;(allP2||[]).forEach((p:any) => { (rosterByTeam[p.team_id] ||= []).push(p) })
// "Deserves to start" = top-5 by usage on their own roster — real, already-
// tracked role importance, not a separate invented ranking.
const deservedStarterSet = new Set<string>()
Object.values(rosterByTeam).forEach((roster: any[]) => {
[...roster].sort((a,b)=>(b.usage||0)-(a.usage||0)).slice(0,5).forEach((p:any)=>deservedStarterSet.add(p.id))
})

// box_scores has no timestamp of its own — order via the real games.played_at
// through the existing FK embed (same games!inner(...) pattern already used
// a few blocks up for technical-foul history), not a nonexistent column.
// .limit(3000) here used to silently come back capped at 1000 (Supabase's
// db.max_rows overrides any larger explicit .limit()) — .range() across up
// to 3 pages actually honors the intended 3000-row, most-recent-first cap.
let recentBoxAll: any[] = []
if (activeIds.length) {
for (let page = 0; page < 3; page++) {
const from = page * 1000
const { data } = await supabaseAdmin.from('box_scores')
.select('player_id,is_starter,pts,games!inner(played_at)').in('player_id',activeIds).eq('games.status','final')
.order('played_at',{foreignTable:'games',ascending:false}).range(from, from + 999)
recentBoxAll = recentBoxAll.concat(data || [])
if (!data || data.length < 1000) break
}
}
const recentByPlayer: Record<string, any[]> = {}
;(recentBoxAll||[]).forEach((b:any) => { const arr=(recentByPlayer[b.player_id] ||= []); if (arr.length<5) arr.push(b) })

const { data: seasonStatsAll } = activeIds.length ? await supabaseAdmin.from('player_stats')
.select('player_id,pts,games').eq('season','2025-26').in('player_id',activeIds) : { data: [] as any[] }
const seasonAvgById: Record<string, number> = {}
;(seasonStatsAll||[]).forEach((s:any) => { if (s.games>0) seasonAvgById[s.player_id] = s.pts/s.games })

// Neutral 50 baseline, shifted by team win% (±15), whether recent playing
// time actually matches the role this player's usage says they deserve
// (±12/+8), and recent scoring vs. their own season average (±12) — same
// "recent vs. season average" comparison already built for Power Rankings'
// player-form note, just applied to every player instead of just stars.
const moraleTarget = (p: any): number => {
const winPct = winPctMap[p.team_id] ?? 0.5
let target = 50 + (winPct - 0.5) * 30
const recent = recentByPlayer[p.id]
if (recent && recent.length >= 2) {
const starterRate = recent.filter((b:any) => b.is_starter).length / recent.length
const deserves = deservedStarterSet.has(p.id)
if (deserves && starterRate < 0.4) target -= 12
else if (!deserves && starterRate >= 0.6) target += 8
const recentAvgPts = recent.reduce((s:number,b:any) => s+(b.pts||0), 0) / recent.length
const seasonAvg = seasonAvgById[p.id]
if (seasonAvg && seasonAvg >= 2) {
target += Math.max(-12, Math.min(12, (recentAvgPts / seasonAvg - 1) * 30))
}
}
return Math.max(15, Math.min(92, target))
}

const injuredIds = (allP2||[]).filter((p:any) => p.status==='injured').map((p:any) => p.id)
const { data: openInjuries } = injuredIds.length > 0 ? await supabaseAdmin
.from('injury_log').select('player_id,severity,specialist_used').eq('status','active').in('player_id',injuredIds) : { data: [] as any[] }
const boostMap: Record<string,number> = {}
;(openInjuries||[]).forEach((inj:any) => {
if (inj.specialist_used) boostMap[inj.player_id] = SPECIALIST_BOOST_MULTIPLIER_BY_SEVERITY[inj.severity as InjurySeverity] || 1
})

// Same sequential-award-per-player trap as the Attribute Development step
// above — with ~1150+ active players getting a health/moral update almost
// every single week (health regen and morale drift both move by a
// non-zero amount nearly always), this was the other dominant cost behind
// a "2 minutes, zero games simulated" offseason week. Math stays in
// memory per player; writes go out in batches of 50 concurrently.
const recoveryUpdates: { id:string, fields:Record<string,any>, recovered:boolean }[] = []
for (const p of (allP2||[])) {
const mod = IMOD[iMap[p.team_id]||'normal']||1.0
const durB = ((p.durability||75)-75)/100*0.5
const facilityRecoveryB = (facilityRecoveryMap[p.team_id]||0)/100
let hGain = 3*recDays*mod*(1+durB)*(1+facilityRecoveryB)
if (p.status==='injured') hGain *= physioRecoveryMultiplier(physioMap[p.team_id]) * (boostMap[p.id]||1)
const moraleMgmt = moraleMgmtMap[p.team_id] ?? 60
const driftRate = Math.min(0.22, Math.max(0.06, 0.10 * (0.6 + moraleMgmt/100*0.8)))
const target = moraleTarget(p)
const nh = Math.min(100, Math.round((p.health||100)+hGain))
const nm = Math.max(0, Math.min(100, Math.round((p.moral||80) + (target-(p.moral||80))*driftRate)))
const recovered = p.status==='injured' && nh>=50
if (nh!==(p.health||100)||nm!==(p.moral||80)||recovered) {
recoveryUpdates.push({ id:p.id, fields:{ health:nh, moral:nm, ...(recovered?{status:'active'}:{}) }, recovered })
}
}

for (let i = 0; i < recoveryUpdates.length; i += 50) {
const chunk = recoveryUpdates.slice(i, i + 50)
await Promise.all(chunk.map(u => supabaseAdmin.from('players').update(u.fields).eq('id', u.id)))
}

const recoveredIds = recoveryUpdates.filter(u => u.recovered).map(u => u.id)
if (recoveredIds.length > 0) {
const { data: openInjs } = await supabaseAdmin.from('injury_log').select('id,player_id,created_at')
.in('player_id', recoveredIds).eq('status','active').order('created_at',{ascending:false})
const latestOpenInjByPlayer: Record<string,string> = {}
;(openInjs||[]).forEach((inj:any) => { if (!latestOpenInjByPlayer[inj.player_id]) latestOpenInjByPlayer[inj.player_id] = inj.id })
const injIds = Object.values(latestOpenInjByPlayer)
for (let i = 0; i < injIds.length; i += 50) {
const chunk = injIds.slice(i, i + 50)
await Promise.all(chunk.map(id => supabaseAdmin.from('injury_log').update({ status:'resolved', healed_at:new Date().toISOString(), healed_week:week }).eq('id', id)))
}
}
} catch(e) { console.warn('Recovery step failed',e) }

// ── SPONSOR OBJECTIVES ────────────────────────────────
try {
const sponsorResult = await checkSponsorObjectives()
console.log(`Sponsor objectives — checked: ${sponsorResult.checked}, achieved: ${sponsorResult.achieved}`)
} catch(sponsorErr) { console.warn('Sponsor objectives check failed:', sponsorErr) }

// ── POWER RANKINGS ────────────────────────────────────
try {
const prResult = await generatePowerRankings(week)
console.log(`Power Rankings generated: ${prResult.generated} teams`)
} catch(prErr) { console.warn('Power Rankings generation failed:', prErr) }

// ── FAN REPUTATION DRIFT (popularity + fan_satisfaction) ──
// Both were read elsewhere (popularity by fa-market-scoring.ts, 15% weight
// on FA decisions; fan_satisfaction by check-sponsor-objectives.ts as a
// sponsor-objective condition) but never written anywhere — permanently
// stuck at their seeded value. Nudge both toward a real win%-based target
// every week, same exponential-drift idea already used for Elo.
try {
const { data: allTeamsForRep } = await supabaseAdmin.from('teams').select('id,wins,losses,popularity').not('id','in','(ALL,RVS,ROO,SOP)')
const { data: allFinances } = await supabaseAdmin.from('franchise_finances').select('team_id,fan_satisfaction')
const financeMap: Record<string,number> = {}
;(allFinances||[]).forEach((f:any) => { financeMap[f.team_id] = f.fan_satisfaction ?? 50 })

const ranked = [...(allTeamsForRep||[])].sort((a,b) => (b.wins/(b.wins+b.losses||1)) - (a.wins/(a.wins+a.losses||1)))
const playoffPositionSet = new Set(ranked.slice(0, Math.ceil(ranked.length/2)).map((t:any) => t.id))

for (const t of (allTeamsForRep||[])) {
const played = (t.wins||0) + (t.losses||0)
const winPct = played > 0 ? (t.wins||0)/played : 0.5
const popTarget = Math.min(100, Math.max(0, 40 + winPct*45 + (playoffPositionSet.has(t.id) ? 15 : 0)))
const newPopularity = Math.round((t.popularity ?? 50) + (popTarget - (t.popularity ?? 50)) * 0.08)
await supabaseAdmin.from('teams').update({ popularity: newPopularity }).eq('id', t.id)

const satTarget = Math.min(100, Math.max(0, 50 + (winPct-0.5)*100))
const currentSat = financeMap[t.id] ?? 50
const newSat = Math.round(currentSat + (satTarget - currentSat) * 0.15)
await supabaseAdmin.from('franchise_finances').update({ fan_satisfaction: newSat }).eq('team_id', t.id)
}
console.log(`Fan reputation drift applied to ${(allTeamsForRep||[]).length} teams`)
} catch(repErr) { console.warn('Fan reputation drift failed:', repErr) }

// ── GM SATISFACTION EVALUATION (Fans/Owners/Sponsors) ─────
try {
const gmSatResult = await resolveWeeklyGmSatisfaction(week)
console.log(`GM satisfaction resolved for ${gmSatResult.teamsProcessed} teams`)
} catch(gmSatErr) { console.warn('GM satisfaction resolution failed:', gmSatErr) }

// ── POST-SIM NOTIFICATIONS ────────────────────────────
try {
await runPostSimNotifications(week, gamesCreated, techFoulEvents)
console.log('Post-sim notifications sent')
} catch(notifErr) { console.warn('Notifications failed:', notifErr) }

// ── WEEKLY SCOUTING POINTS ─────────────────────────────
try {
const scoutResult = await generateWeeklyScoutPoints()
console.log(`Scouting points generated for ${scoutResult.updated} teams`)
} catch(scoutErr) { console.warn('Scouting points generation failed:', scoutErr) }

return NextResponse.json({ success: true, week, half: 2, games_simulated: gamesSimulated, friendlies_simulated: friendliesSimulated })
} catch (err: any) {
return NextResponse.json({ error: err.message }, { status: 500 })
}
}

// Game engine now lives in @/lib/game-simulator so it can be reused by the
// preseason/friendly-game simulator without duplicating this logic.

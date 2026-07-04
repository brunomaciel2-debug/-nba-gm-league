import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkSponsorObjectives } from '@/lib/check-sponsor-objectives'
import { generatePowerRankings } from '@/lib/generate-power-rankings'
import { runPostSimNotifications } from '@/lib/notifications'
import { generateWeeklyScoutPoints } from '@/lib/scouting'
import { homeWinProb, updateElo } from '@/lib/elo-helper'
import { getStatusForWeek } from '@/lib/season-week-helper'
import { simulateGame } from '@/lib/game-simulator'
import { simulatePreseasonGame } from '@/lib/preseason-simulator'
import { getTeamLang, notifRookieOptionEligible } from '@/lib/notifications-helpers'
import { rookieOptionSalary } from '@/lib/draft-constants'
import { MEDICAL_COST_BY_SEVERITY, physioRecoveryMultiplier, InjurySeverity } from '@/lib/injury-constants'

// Called by Vercel Cron every Monday and Thursday at midnight Lisbon time
// Configure in vercel.json: {"crons": [{"path": "/api/cron/simulate", "schedule": "0 0 * * 1,4"}]}

export async function GET(req: NextRequest) {
const auth = req.headers.get('authorization')
if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
try {
const { data: cfg } = await supabaseAdmin.from('season_config').select('*').eq('id',1).single()
if (!cfg || !['active','regular-season','pre-season'].includes(cfg.status)) return NextResponse.json({ message: 'Season not active' })
const week = cfg.current_week + 1
// Pre-Season weeks (per the same calendar shown in the UI) are for testing
// tactics/rotations only — injuries/fatigue still happen, but nothing here
// should count toward standings, player season stats, or awards.
const isPreseason = getStatusForWeek(week) === 'pre-season'

let gamesSimulated = 0
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

// Only the games actually scheduled for this week — nothing invented
const { data: weekGames } = await supabaseAdmin.from('games').select('*').eq('week_number', week).eq('status','scheduled')

for (const sg of (weekGames||[])) {
const ht = teamMap[sg.home_team], at = teamMap[sg.away_team]
if (!ht || !at) continue
const [{ data: hp }, { data: ap }] = await Promise.all([
supabaseAdmin.from('players').select('*').eq('team_id', ht.id).eq('status','active'),
supabaseAdmin.from('players').select('*').eq('team_id', at.id).eq('status','active'),
])
if (!hp || !ap) continue

const result = simulateGame(ht, at, hp, ap, orderMap[ht.id], orderMap[at.id])

// Attendance: capacity × attendance rate (65-95% based on win% and rivalry)
const isRivalry = ht.rival_team_id === at.id || at.rival_team_id === ht.id
const htWinPct = (ht.wins||0) / Math.max(1, (ht.wins||0)+(ht.losses||0))
const baseAttRate = 0.65 + htWinPct * 0.20 + (isRivalry ? 0.08 : 0)
const attRate = Math.min(0.98, baseAttRate + (Math.random() * 0.06 - 0.03))
const attendance = Math.round((ht.arena_capacity || arenaCapacityMap[ht.id] || 18000) * attRate)

const { data: gameRec } = await supabaseAdmin.from('games').update({
home_score: result.homeScore, away_score: result.awayScore,
status: 'final', played_at: new Date().toISOString(),
attendance, is_rivalry: isRivalry,
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

// Update triple_doubles counter in player_stats
const tdBox = [...result.homeBox, ...result.awayBox]
for (const b of tdBox) {
const isTD = [b.pts||0,b.reb||0,b.ast||0,b.stl||0,b.blk||0].filter((v:number)=>v>=10).length >= 3
if (isTD && b.player_id) {
const { data: ps } = await supabaseAdmin.from('player_stats').select('triple_doubles').eq('player_id',b.player_id).eq('season','2025-26').single()
await supabaseAdmin.from('player_stats').update({ triple_doubles: ((ps as any)?.triple_doubles||0)+1 }).eq('player_id',b.player_id).eq('season','2025-26')
}
}

const hWon = result.homeScore > result.awayScore
const htElo = ht.elo || 1500
const atElo = at.elo || 1500
const hExpected = homeWinProb(htElo, atElo)
const htNewElo = updateElo(htElo, hWon, hExpected)
const atNewElo = updateElo(atElo, !hWon, 1 - hExpected)
await Promise.all([
supabaseAdmin.from('teams').update({
wins: ht.wins+(hWon?1:0), losses: ht.losses+(hWon?0:1),
pts_for: ht.pts_for+result.homeScore, pts_against: ht.pts_against+result.awayScore,
elo: htNewElo,
}).eq('id', ht.id),
supabaseAdmin.from('teams').update({
wins: at.wins+(hWon?0:1), losses: at.losses+(hWon?1:0),
pts_for: at.pts_for+result.awayScore, pts_against: at.pts_against+result.homeScore,
elo: atNewElo,
}).eq('id', at.id),
])

// Accumulate player stats — DNP rows (mins=0) don't count as a game played
const allBox = [...result.homeBox, ...result.awayBox].filter((b:any) => (b.mins||0) > 0)
for (const box of allBox) {
const { data: ex } = await supabaseAdmin.from('player_stats')
.select('*').eq('player_id', box.player_id).eq('season','2025-26').single()
if (ex) {
await supabaseAdmin.from('player_stats').update({
games: ex.games+1, pts: ex.pts+box.pts, reb: ex.reb+box.reb,
ast: ex.ast+box.ast, stl: ex.stl+box.stl, blk: ex.blk+box.blk,
fgm: ex.fgm+box.fgm, fga: ex.fga+box.fga,
tpm: ex.tpm+box.tpm, tpa: ex.tpa+box.tpa,
ftm: ex.ftm+box.ftm, fta: ex.fta+box.fta,
turnovers: ex.turnovers+box.turnovers,
fouls: (ex.fouls||0)+(box.pf||0), tech_fouls: (ex.tech_fouls||0)+(box.tech_fouls||0),
}).eq('player_id', box.player_id).eq('season','2025-26')
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
const { data: weekTechBoxes } = await supabaseAdmin.from('box_scores')
.select('player_id,tech_fouls,games!inner(game_type)')
.in('game_id', gamesCreated).eq('games.game_type', gameTypeFilter).gt('tech_fouls', 0)

const weekTechsByPlayer: Record<string,number> = {}
for (const b of (weekTechBoxes||[])) weekTechsByPlayer[b.player_id] = (weekTechsByPlayer[b.player_id]||0) + (b.tech_fouls||0)

for (const [playerId, weekTechs] of Object.entries(weekTechsByPlayer)) {
const { data: allBoxes } = await supabaseAdmin.from('box_scores')
.select('tech_fouls,games!inner(game_type)')
.eq('player_id', playerId).eq('games.game_type', gameTypeFilter)
const totalTechs = (allBoxes||[]).reduce((s:number,b:any)=>s+(b.tech_fouls||0),0)
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
teams:[pl.team_id], players:[pl.name], status:'completed',
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

const { data: weekBoxes } = gamesCreated.length > 0 ? await supabaseAdmin
.from('box_scores').select('player_id,mins,team_id,game_id')
.in('game_id', gamesCreated) : { data: [] as any[] }

const { data: weekOrders } = await supabaseAdmin.from('gm_orders').select('team_id,pace,training_intensity').eq('week_number',week)
const paceMap: Record<string,number> = {}
;(weekOrders||[]).forEach((o:any) => paceMap[o.team_id] = o.pace||70)

const healthUpdates: Record<string,{health:number,moral:number,wins:number,losses:number}> = {}
for (const box of (weekBoxes||[])) {
const p = playerMap[box.player_id]
if (!p) continue
if (!healthUpdates[p.id]) healthUpdates[p.id] = { health:p.health??100, moral:p.moral??80, wins:0, losses:0 }
const pace = paceMap[box.team_id]||70
const pacePenalty = pace > 80 ? 0.5 : 0
const healthLoss = (box.mins / 10) * (1 + pacePenalty)
healthUpdates[p.id].health = Math.max(0, healthUpdates[p.id].health - healthLoss)
}

for (const [pid, upd] of Object.entries(healthUpdates)) {
const p = playerMap[pid]
if (!p) continue
const newHealth = Math.round(Math.max(0, upd.health))

const durFactor = (p.durability||75) / 100
const hFactor = newHealth < 70 ? 1.5 : newHealth < 85 ? 1.2 : 1.0
const pace = paceMap[p.team_id]||70
const injChance = 0.018 * (1/durFactor) * hFactor * (pace>80?1.3:1.0)

if (Math.random() < injChance && injTypes && injTypes.length > 0) {
const weights = (injTypes as any[]).map(t => ({ t, w:(SWEIGHTS[t.severity]||10)*t.game_probability }))
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
teams:[p.team_id], players:[p.name], status:'completed',
})
}
} else {
await supabaseAdmin.from('players').update({ health:newHealth }).eq('id',pid)
}
}

// Keep season_config.status consistent with the same calendar the UI shows
const newStatus = isPreseason ? 'pre-season' : 'regular-season'
await supabaseAdmin.from('season_config').update({ current_week: week, status: newStatus }).eq('id',1)
await supabaseAdmin.from('gm_orders').update({ locked: true }).eq('week_number', week)

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
await supabaseAdmin.from('players').update(updates).eq('id', p.id)
}
if (devLogs.length > 0) {
await supabaseAdmin.from('attribute_development').insert(devLogs)
}
}
} catch(devErr) { console.warn('Development step failed', devErr) }

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

return Math.max(2, Math.min(15, 5 + (quality-60)*0.3))
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
const { data: weekBoxes2 } = await supabaseAdmin
.from('box_scores').select('player_id,game_id,team_id,mins,pts,reb,ast,stl,blk')
.in('game_id', gamesCreated)

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
const isEndOfSeason = week >= 40 // last week of the Regular Season (see season-week-helper.ts)

const { data: weekBoxesAw } = await supabaseAdmin
.from('box_scores')
.select('player_id,game_id,pts,reb,ast,stl,blk,mins,team_id')
.in('game_id', gamesCreated)

const { data: weekGamesData } = await supabaseAdmin
.from('games').select('id,home_team,away_team,home_score,away_score')
.in('id', gamesCreated)

const gameResultMap: Record<string,{winner:string,loser:string}> = {}
for (const g of (weekGamesData||[])) {
const hw = (g.home_score||0) > (g.away_score||0)
gameResultMap[g.id] = { winner: hw ? g.home_team : g.away_team, loser: hw ? g.away_team : g.home_team }
}

const { data: allPlayersAw } = await supabaseAdmin
.from('players').select('id,name,team_id,teams!inner(conference)')
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
const { data: monthGameIds } = await supabaseAdmin.from('games').select('id')
.eq('season','2025-26')
.gte('week_number', (monthNum-1)*4+1)
.lte('week_number', monthNum*4)
const { data: monthBoxes } = await supabaseAdmin
.from('box_scores').select('player_id,game_id,pts,reb,ast,stl,blk,mins,team_id')
.in('game_id', (monthGameIds||[]).map((g:any)=>g.id))

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
}

if (isEndOfSeason) {
const MIN_GAMES = 65
const { data: seasonStats } = await supabaseAdmin
.from('player_stats').select('*,players!inner(id,name,pos,team_id,nba_experience,potential_grade,teams!inner(id,name,conference,wins,pts_allowed))')
.gte('games', MIN_GAMES)

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

const { data: defStats } = await supabaseAdmin
.from('player_stats').select('player_id,blk,stl,games,players!inner(team_id,teams!inner(pts_allowed,wins))')
.gte('games', MIN_GAMES)
const { data: teamDef } = await supabaseAdmin
.from('teams').select('id,pts_allowed').not('id','in','(ALL,RVS)').order('pts_allowed',{ascending:true})
const topDefTeams = new Set((teamDef||[]).slice(0,10).map((t:any)=>t.id))
if (defStats) {
const dpoyScores = defStats.map((s:any)=>{
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

const { data: rookies } = await supabaseAdmin
.from('player_stats').select('player_id,pts,reb,ast,games,players!inner(nba_experience)')
.gte('games', MIN_GAMES)
const royScores = (rookies||[])
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
}
}
} catch(awardsErr) { console.warn('Awards step failed:', awardsErr) }
}

// ── END OF SEASON AGING ────────────────────────────────────
if (week >= 40) { // last week of the Regular Season (see season-week-helper.ts)
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
const { data: allP2 } = await supabaseAdmin.from('players').select('id,health,moral,durability,team_id,status').in('status',['active','injured'])
const { data: ords2 } = await supabaseAdmin.from('gm_orders').select('team_id,training_intensity').eq('week_number',week)
const iMap: Record<string,string> = {}
;(ords2||[]).forEach((o:any) => iMap[o.team_id]=o.training_intensity||'normal')
const IMOD: Record<string,number> = {rest:1.5,light:1.25,normal:1.0,intense:0.5,very_intense:0.25}

const { data: physios } = await supabaseAdmin.from('coaches').select('team_id,rehab_speed').eq('role','physio')
const physioMap: Record<string,number> = {}
;(physios||[]).forEach((c:any) => physioMap[c.team_id]=c.rehab_speed)

for (const p of (allP2||[])) {
const mod = IMOD[iMap[p.team_id]||'normal']||1.0
const durB = ((p.durability||75)-75)/100*0.5
let hGain = 3*recDays*mod*(1+durB)
if (p.status==='injured') hGain *= physioRecoveryMultiplier(physioMap[p.team_id])
const mGain = (p.moral||80)<50?0:0.5*recDays
const nh = Math.min(100, Math.round((p.health||100)+hGain))
const nm = Math.min(100, Math.round((p.moral||80)+mGain))
const recovered = p.status==='injured' && nh>=50
if (nh!==(p.health||100)||nm!==(p.moral||80)||recovered) {
await supabaseAdmin.from('players').update({
health:nh, moral:nm, ...(recovered?{status:'active'}:{}),
}).eq('id',p.id)
}
if (recovered) {
const { data: openInj } = await supabaseAdmin.from('injury_log').select('id')
.eq('player_id',p.id).eq('status','active').order('created_at',{ascending:false}).limit(1)
if (openInj && openInj.length > 0) {
await supabaseAdmin.from('injury_log').update({ status:'resolved', healed_at:new Date().toISOString() }).eq('id',openInj[0].id)
}
}
}
} catch(e) { console.warn('Recovery step failed',e) }

// ── FRIENDLY / PRE-SEASON GAMES ────────────────────────
// Resolve every pending friendly (preseason_games) alongside the week's real
// games, so the commissioner doesn't have to trigger each one individually.
let friendliesSimulated = 0
try {
const { data: pendingFriendlies } = await supabaseAdmin
.from('preseason_games').select('id').eq('season','2025-26').in('status',['scheduled','accepted'])
for (const pf of (pendingFriendlies||[])) {
const r = await simulatePreseasonGame(pf.id)
if (r.success) friendliesSimulated++
}
} catch(friendlyErr) { console.warn('Friendly games step failed:', friendlyErr) }

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

return NextResponse.json({ success: true, week, games_simulated: gamesSimulated, friendlies_simulated: friendliesSimulated })
} catch (err: any) {
return NextResponse.json({ error: err.message }, { status: 500 })
}
}

// Game engine now lives in @/lib/game-simulator so it can be reused by the
// preseason/friendly-game simulator without duplicating this logic.

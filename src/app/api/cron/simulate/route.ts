import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkSponsorObjectives } from '@/lib/check-sponsor-objectives'
import { generatePowerRankings } from '@/lib/generate-power-rankings'
import { runPostSimNotifications } from '@/lib/notifications'
import { generateWeeklyScoutPoints } from '@/lib/scouting'
import { homeWinProb, updateElo } from '@/lib/elo-helper'

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

const { data: teams } = await supabaseAdmin.from('teams').select('*')
if (!teams || teams.length < 2) return NextResponse.json({ error: 'Not enough teams' }, { status:500 })

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

// Round-robin: each team plays 4 games per week
const shuffled = [...teams].sort(() => Math.random() - 0.5)
const pairs: Array<[any,any]> = []
for (let i=0; i<shuffled.length-1; i+=2) pairs.push([shuffled[i], shuffled[i+1]])
const allPairs = [...pairs, ...pairs] // 4 games per team

let gamesSimulated = 0
const gamesCreated: string[] = []
for (let gi=0; gi<allPairs.length; gi++) {
const [ht, at] = allPairs[gi]
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

const { data: gameRec } = await supabaseAdmin.from('games').insert({
week_number: week, game_number: gi+1,
home_team: ht.id, away_team: at.id,
home_score: result.homeScore, away_score: result.awayScore,
status: 'final', played_at: new Date().toISOString(),
attendance, is_rivalry: isRivalry,
}).select().single()
if (!gameRec) continue
gamesSimulated++
gamesCreated.push(gameRec.id)

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
// Update triple_doubles counter in player_stats
const tdBox = [...result.homeBox, ...result.awayBox]
for (const b of tdBox) {
const isTD = [b.pts||0,b.reb||0,b.ast||0,b.stl||0,b.blk||0].filter((v:number)=>v>=10).length >= 3
if (isTD && b.player_id) {
const { data: ps } = await supabaseAdmin.from('player_stats').select('triple_doubles').eq('player_id',b.player_id).eq('season','2025-26').single()
await supabaseAdmin.from('player_stats').update({ triple_doubles: ((ps as any)?.triple_doubles||0)+1 }).eq('player_id',b.player_id).eq('season','2025-26')
}
}
if (result.pbp.length > 0) {
await supabaseAdmin.from('play_by_play').insert(result.pbp.map((p:any) => ({ ...p, game_id: gameRec.id })))
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

// Accumulate player stats
const allBox = [...result.homeBox, ...result.awayBox]
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
}).eq('player_id', box.player_id).eq('season','2025-26')
}
}
}

// ── HEALTH LOSS + INJURY GENERATION ──────────────────────
const { data: allPlayers } = await supabaseAdmin
.from('players').select('id,name,health,moral,durability,team_id,status,games_missed,injury_type')
const playerMap: Record<string,any> = {}
;(allPlayers||[]).forEach((p:any) => playerMap[p.id] = p)

const { data: injTypes } = await supabaseAdmin.from('injury_types').select('*')
const SMOD: Record<string,number> = {minor:1.1,moderate:1.25,serious:1.5,severe:1.75,career_threatening:2.0}
const SWEIGHTS: Record<string,number> = {minor:40,moderate:25,serious:15,severe:8,career_threatening:2}

const { data: weekBoxes } = await supabaseAdmin
.from('box_scores').select('player_id,mins,team_id,game_id')
.in('game_id', gamesCreated)

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
player_id:pid, season:'2025-26',
injury_type:chosen.name, injury_category:chosen.category,
body_part:chosen.body_part, severity:chosen.severity,
occurred_in:'game', health_at_injury:newHealth,
health_impact:hImpact, moral_impact:chosen.moral_impact||0,
days_out:daysOut, games_out:gamesOut,
return_week:week+Math.ceil(gamesOut/2),
is_recurring:isRec, can_play:newHealth>=50,
play_risk:newHealth<65?75:newHealth<75?40:15, status:'active'
})

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

// Auto-determine status based on week number
const newStatus = week >= 1 ? 'regular-season' : 'pre-season'
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

const { data: coaches3 } = await supabaseAdmin.from('coaches').select('team_id,role,player_dev,offense_iq,defense_iq,specialty,specialty_boost,conditioning')

const coachBonus: Record<string,{dev:number,off:number,def:number,conditioning:number,specialties:Record<string,number>}> = {}
for (const c of (coaches3||[])) {
if (!c.team_id) continue
if (!coachBonus[c.team_id]) coachBonus[c.team_id] = {dev:60,off:60,def:60,conditioning:60,specialties:{}}
if (c.role==='head_coach') {
coachBonus[c.team_id].dev = c.player_dev||60
coachBonus[c.team_id].off = c.offense_iq||60
coachBonus[c.team_id].def = c.defense_iq||60
}
if (c.role==='assistant_coach' && c.specialty) {
coachBonus[c.team_id].specialties[c.specialty] = (c.specialty_boost||10)
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

// ── WEEKLY HIGHLIGHTS ─────────────────────────
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
try {
const isEndOfMonth = week % 4 === 0
const isEndOfSeason = week >= 26

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

// ── END OF SEASON AGING ────────────────────────────────────
if (week >= 26) {
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
}

// ── HEALTH RECOVERY ────────────────────────────────────
try {
const isMonday = new Date().getDay() === 1
const recDays = isMonday ? 3 : 2
const { data: allP2 } = await supabaseAdmin.from('players').select('id,health,moral,durability,team_id').eq('status','active')
const { data: ords2 } = await supabaseAdmin.from('gm_orders').select('team_id,training_intensity').eq('week_number',week)
const iMap: Record<string,string> = {}
;(ords2||[]).forEach((o:any) => iMap[o.team_id]=o.training_intensity||'normal')
const IMOD: Record<string,number> = {rest:1.5,light:1.25,normal:1.0,intense:0.5,very_intense:0.25}
for (const p of (allP2||[])) {
const mod = IMOD[iMap[p.team_id]||'normal']||1.0
const durB = ((p.durability||75)-75)/100*0.5
const hGain = 3*recDays*mod*(1+durB)
const mGain = (p.moral||80)<50?0:0.5*recDays
const nh = Math.min(100, Math.round((p.health||100)+hGain))
const nm = Math.min(100, Math.round((p.moral||80)+mGain))
if (nh!==(p.health||100)||nm!==(p.moral||80))
await supabaseAdmin.from('players').update({health:nh,moral:nm}).eq('id',p.id)
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

// ── POST-SIM NOTIFICATIONS ────────────────────────────
try {
await runPostSimNotifications(week, gamesCreated)
console.log('Post-sim notifications sent')
} catch(notifErr) { console.warn('Notifications failed:', notifErr) }

// ── WEEKLY SCOUTING POINTS ─────────────────────────────
try {
const scoutResult = await generateWeeklyScoutPoints()
console.log(`Scouting points generated for ${scoutResult.updated} teams`)
} catch(scoutErr) { console.warn('Scouting points generation failed:', scoutErr) }

return NextResponse.json({ success: true, week, games_simulated: gamesSimulated })
} catch (err: any) {
return NextResponse.json({ error: err.message }, { status: 500 })
}
}

// ── Helpers
function rnd(a:number,b:number){return Math.floor(Math.random()*(b-a+1))+a}
function wt(pool:Array<{p:any,w:number}>){
const t=pool.reduce((s,x)=>s+x.w,0);let r=Math.random()*t
for(const x of pool){r-=x.w;if(r<=0)return x.p}
return pool[pool.length-1].p
}
function r3p(v:number){return(20+(v/100)*22)/100}
function fmt(tl:number){return Math.floor(tl/60)+":"+String(tl%60).padStart(2,"0")}

function simulateGame(ht:any,at:any,hp:any[],ap:any[],hOrd?:any,aOrd?:any){
const defOrd=(ps:any[])=>{const s=[...ps].sort((a,b)=>b.usage-a.usage);return{pris:[s[0]?.name,s[1]?.name,s[2]?.name],clutch:s[0]?.name,pace:70,three_rate:38,atk_style:"motion",def_style:"man"}}
const ho=hOrd||defOrd(hp),ao=aOrd||defOrd(ap)
if(ho.depth_chart)applyDC(hp,ho.depth_chart)
if(ao.depth_chart)applyDC(ap,ao.depth_chart)
const sc={home:0,away:0},st:Record<string,any>={},fat:Record<string,number>={},mom:Record<string,number>={},ls:Record<string,number[]>={},part={home:0,away:0}
const tol={home:{used:0,q:{0:0,1:0,2:0,3:0}} as any,away:{used:0,q:{0:0,1:0,2:0,3:0}} as any}
let isGT=false,gtW=""
const pbp:any[]=[],hb:any[]=[],ab:any[]=[]
;[...hp,...ap].forEach(p=>{st[p.id]={pts:0,or:0,dr:0,ast:0,stl:0,blk:0,fga:0,fgm:0,tpa:0,tpm:0,fta:0,ftm:0,pf:0,fd:0,to:0,reb:0,turnovers:0};fat[p.id]=100;mom[p.id]=0;ls[p.id]=[]})
const pa=(ho.pace+ao.pace)/2,ppq=Math.round(23+pa/100*4)
for(let q=0;q<4;q++){
part.home=0;part.away=0
let side="home"
for(let i=0;i<ppq*2;i++){
const tl=Math.max(0,Math.round(720*(1-i/(ppq*2))))
const diff=Math.abs(sc.home-sc.away)
if(q===3&&!isGT&&((tl<=120&&diff>=20)||(tl<=90&&diff>=15))){isGT=true;gtW=sc.home>sc.away?"home":"away";pbp.push({quarter:q+1,time_left:fmt(tl),team_id:null,event_type:"info",description:`🗑️ GARBAGE TIME — ${isGT&&gtW==="home"?ht.name:at.name} leads by ${diff}!`,home_score:sc.home,away_score:sc.away})}
const isC=q===3&&tl<=120&&diff<=5
const ops=side==="home"?(isGT&&side===gtW?hp.filter(p=>p.mins>0).slice(5):hp.filter(p=>p.mins>0)):(isGT&&side===gtW?ap.filter(p=>p.mins>0).slice(5):ap.filter(p=>p.mins>0))
const dps=side==="home"?ap.filter(p=>p.mins>0):hp.filter(p=>p.mins>0)
const oo=side==="home"?ho:ao,doo=side==="home"?ao:ho
const ot=side==="home"?ht:at,dt=side==="home"?at:ht
const os=side as "home"|"away",ds=(side==="home"?"away":"home") as "home"|"away"
if((part[ds] as number)>=8&&tol[os].q[q]<2&&tol[os].used<7){tol[os].q[q]++;tol[os].used++;part.home=0;part.away=0;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"timeout",description:`⏱ TIMEOUT — ${ot.name}`,home_score:sc.home,away_score:sc.away})}
simP(ot,dt,ops,dps,oo,doo,sc,st,fat,mom,ls,part,isC,os,ds,q,tl,pbp)
side=side==="home"?"away":"home"
}
}
hp.filter(p=>p.mins>0).forEach(p=>hb.push({player_id:p.id,mins:p.mins,...st[p.id],reb:(st[p.id].or||0)+(st[p.id].dr||0),turnovers:st[p.id].to||0,plus_minus:0}))
ap.filter(p=>p.mins>0).forEach(p=>ab.push({player_id:p.id,mins:p.mins,...st[p.id],reb:(st[p.id].or||0)+(st[p.id].dr||0),turnovers:st[p.id].to||0,plus_minus:0}))
return{homeScore:sc.home,awayScore:sc.away,homeBox:hb,awayBox:ab,pbp}
}

function applyDC(players:any[],dc:any){
players.forEach(p=>p.mins=0)
;["PG","SG","SF","PF","C"].forEach(pos=>{
const pd=dc[pos];if(!pd)return
;["s","b1","b2"].forEach(sl=>{const e=pd[sl];if(e?.name&&e.mins>0){const p=players.find((pl:any)=>pl.name===e.name);if(p)p.mins+=e.mins}})
})
}

function pS(ps:any[],ord:any,u3:boolean,ic:boolean,fat:Record<string,number>,mom:Record<string,number>){
if(ic&&ord.clutch){const cp=ps.find((p:any)=>p.name===ord.clutch);if(cp&&fat[cp.id]>40)return cp}
const pool=ps.filter((p:any)=>p.mins>0);if(!pool.length)return ps[0]
const pris=ord.pris||[ord.priority_1,ord.priority_2,ord.priority_3]
return wt(pool.map((p:any)=>{
const f=fat[p.id]/100;let w=u3?p.three*1.8+p.usage*.3:p.usage*1.4+(p.layup+p.dunk)/2*.4
if(u3&&p.three<50)w*=.2;const pi=pris.indexOf(p.name)
if(!u3){if(pi===0)w*=2.2;else if(pi===1)w*=1.55;else if(pi===2)w*=1.25}else{if(pi===0)w*=1.3;else if(pi===1)w*=1.15;else if(pi===2)w*=1.08}
return{p,w:Math.max(.5,w*(1+mom[p.id]*(p.streaky/100)*.15)*(.5+f*.5))}
}))
}

function simFT(p:any,n:number,fat:Record<string,number>){let m=0;for(let i=0;i<n;i++)if(Math.random()<p.ft/100*(.88+fat[p.id]/100*.12))m++;return m}

function simP(ot:any,dt:any,ops:any[],dps:any[],oo:any,doo:any,sc:any,st:any,fat:any,mom:any,ls:any,part:any,isC:boolean,os:"home"|"away",ds:"home"|"away",q:number,tl:number,pbp:any[]){
if(!ops.length||!dps.length)return
const u3=Math.random()<r3p(oo.three_rate||oo.threeRate||38)
const isMid=!u3&&Math.random()<.30,isPost=!u3&&!isMid&&Math.random()<.15
const sc2=pS(ops,oo,u3,isC,fat,mom),def=wt(dps.map(p=>({p,w:(p.idef+p.pdef)/2*.5+20})))
if(!sc2||!def)return
const ss=st[sc2.id],ds2=st[def.id],fs=fat[sc2.id]/100
fat[sc2.id]=Math.max(40,fat[sc2.id]-(14/sc2.stamina)*.7*1.2)
fat[def.id]=Math.max(40,fat[def.id]-(14/def.stamina)*.7)
if(Math.random()<.08+(100-(sc2.siq+sc2.pass_iq+sc2.ball_hdl)/3)*.0015){ss.to++;ss.turnovers++;const st3=wt(dps.map(p=>({p,w:p.stl*.5+20})));if(Math.random()<st3.stl/100*.7)st[st3.id].stl++;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"turnover",description:`${st3.name} steals from ${sc2.name}`,home_score:sc.home,away_score:sc.away});return}
if(!u3&&Math.random()<def.blk/100*.065*(doo.def_style==='zone23'?.5:1)){ds2.blk++;if(Math.random()<.14){ds2.pf++;ss.fd++;const f=simFT(sc2,2,fat);sc[os]+=f;ss.pts+=f;ss.ftm+=f;ss.fta+=2;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"freethrow",description:`Block foul on ${sc2.name} — ${f}/2 FTs`,home_score:sc.home,away_score:sc.away})}else pbp.push({quarter:q+1,time_left:fmt(tl),team_id:dt.id,event_type:"block",description:`BLOCK by ${def.name} on ${sc2.name}!`,home_score:sc.home,away_score:sc.away});return}
ss.fga++;if(u3)ss.tpa++
const acc=Math.min(.74,Math.max(.18,(u3?.30+(sc2.three-50)/100*.20:isPost?.44:isMid?.40+(sc2.mid-50)/100*.10:.50+(sc2.layup+sc2.dunk)/200*.18)*(.84+fs*.16)*(1-(u3?def.pdef:def.idef)/100*.14*(doo.def_style==="man"?1.1:.82))*(.9+(sc2.consistency/100)*.15)*(isC?(.82+(sc2.pressure/100)*.32):1)))
const makes=Math.random()<acc
const lsi=ls[sc2.id];lsi.push(makes?1:0);if(lsi.length>4)lsi.shift()
const r2=lsi.reduce((a:number,b:number)=>a+b,0),st4=sc2.streaky/100
if(lsi.length>=3){if(r2>=3)mom[sc2.id]=Math.min(3,mom[sc2.id]+(makes?1:0)*st4*2);else if(r2<=1)mom[sc2.id]=Math.max(-3,mom[sc2.id]+(makes?0:-1)*st4*2);else mom[sc2.id]*=.6}
if(Math.random()<sc2.draw_foul/100*.10){ds2.pf++;ss.fd++;if(makes){ss.fgm++;if(u3)ss.tpm++;const pts=u3?3:2;sc[os]+=pts;ss.pts+=pts;part[os]+=pts;(part as any)[ds]=0;const f=simFT(sc2,1,fat);sc[os]+=f;ss.pts+=f;ss.ftm+=f;ss.fta++;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"score",description:`${sc2.name} scores and draws foul! (${pts}+${f})`,home_score:sc.home,away_score:sc.away})}else{const fc=u3?3:2;const f=simFT(sc2,fc,fat);sc[os]+=f;ss.pts+=f;ss.ftm+=f;ss.fta+=fc;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"freethrow",description:`${sc2.name} to the line — ${f}/${fc}`,home_score:sc.home,away_score:sc.away})};return}
if(makes){ss.fgm++;if(u3)ss.tpm++;const pts=u3?3:2;sc[os]+=pts;ss.pts+=pts;part[os]+=pts;(part as any)[ds]=0;const ap2=ops.filter(p=>p.id!==sc2.id&&p.mins>0);if(ap2.length&&Math.random()<.55){const ast=wt(ap2.map(p=>({p,w:p.assist_role*2})));st[ast.id].ast++}const shot=u3?"three-pointer":isPost?"hook shot":isMid?"mid-range jump shot":mom[sc2.id]>=2?"slam dunk":"driving layup";pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"score",description:`${sc2.name} — ${shot}${mom[sc2.id]>=2.5?" 🔥 ON FIRE!":""}! ${pts}pts`,home_score:sc.home,away_score:sc.away})}
else{if(Math.random()<.27){const rb=wt(ops.filter(p=>p.mins>0).map(p=>({p,w:p.off_reb*.6+10})));st[rb.id].or++;st[rb.id].reb++;const re=pS(ops,oo,false,false,fat,mom);if(re){st[re.id].fga++;if(Math.random()<.5){st[re.id].fgm++;sc[os]+=2;st[re.id].pts+=2;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"score",description:`OFF rebound ${rb.name} → ${re.name} scores! 2pts`,home_score:sc.home,away_score:sc.away})}}}else{const rb=wt(dps.map(p=>({p,w:p.def_reb*.6+10})));st[rb.id].dr++;st[rb.id].reb++;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"miss",description:`${sc2.name} missed — DEF rebound ${rb.name}`,home_score:sc.home,away_score:sc.away})}}
}

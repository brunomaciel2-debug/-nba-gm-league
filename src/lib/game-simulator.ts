// Shared possession-by-possession game engine.
// Extracted from src/app/api/cron/simulate/route.ts so it can be reused
// by the preseason/friendly-game simulator without duplicating this logic.

import { familiarityBoost, TacticalMods } from './tactical-constants'
import { buildAutoDepthChart } from './auto-depth-chart'

const NEUTRAL_TACTICAL_MODS: TacticalMods = {
  toMult: 1, astMult: 1, midMult: 1, postMult: 1, threeMult: 1, rimMult: 1,
  offRebMult: 1, defRebMult: 1, foulDrawMult: 1, clutchMult: 1, paceMult: 1,
  vsManMult: 1, vsZoneMult: 1, vsPressMult: 1, vsPackMult: 1,
  bigThreeMult: 1, lobMult: 1,
}
// Games without tactical data attached (friendlies, or before the system
// existed for a save) fall back to a neutral-40 familiarity and no node
// bonuses at all — same "absent = neutral" convention as cohesion/composure.
function tacticalMatchupMult(oo: any, defStyle: string): number {
  const fam = oo.tacticalFamiliarity ?? 40
  const mods: TacticalMods = oo.tacticalMods || NEUTRAL_TACTICAL_MODS
  const vsKey = defStyle === 'man' ? 'vsManMult' : defStyle === 'zone23' ? 'vsZoneMult' : defStyle === 'press' ? 'vsPressMult' : defStyle === 'pack' ? 'vsPackMult' : null
  const vsMult = vsKey ? (mods as any)[vsKey] : 1
  return (1 + familiarityBoost(fam)) * vsMult
}

// Real position-fit penalty: a player slotted out of their real position in
// the Depth Chart is still allowed (small-ball/positionless lineups are a
// real thing) but genuinely performs worse — the further from their real
// spot, the bigger the hit. 5% per position-step, floored at 0.8 (PG at C
// or vice versa, the maximum possible distance).
const POSITION_ORDER = ['PG','SG','SF','PF','C']
function posFitMultiplier(avgDistance: number): number {
  return Math.max(0.8, 1 - avgDistance * 0.05)
}

// Scoring (hidden attribute, GM never sees it) is the one thing that decides
// HOW MANY points a player averages — the existing shot-mechanics attributes
// (three/layup/dunk/mid/etc.) still decide HOW those points get scored (shot
// type, make%), but no longer gate the volume. Calibrated at 36 minutes per
// the commissioner's own scoring table; breakpoints are the exact PPG/Scoring
// pairs from that table (Scoring is the upper bound of each PPG bucket).
const SCORING_BREAKPOINTS:[number,number][]=[
[0,0],[20,2],[28,4],[35,6],[41,8],[47,10],[53,12],[59,14],[65,16],[69,18],
[73,20],[77,22],[81,24],[85,26],[89,28],[91.5,30],[95,35],
]
function ppg36(scoring?:number):number{
const s=Math.max(0,Math.min(99,scoring??50))
const bp=SCORING_BREAKPOINTS
if(s<=bp[0][0])return bp[0][1]
for(let i=1;i<bp.length;i++){
if(s<=bp[i][0]){
const[s0,p0]=bp[i-1],[s1,p1]=bp[i]
return p0+(p1-p0)*(s-s0)/(s1-s0)
}
}
// Beyond the table's top breakpoint (95): extrapolate the last segment's
// slope, capped at a hard ceiling no real NBA workload realistically clears.
const[s0,p0]=bp[bp.length-2],[s1,p1]=bp[bp.length-1]
const slope=(p1-p0)/(s1-s0)
return Math.min(40,p1+slope*(s-s1))
}

// Three Attempt Rate (hidden) is the SOLE driver of how many threes a
// player is picked to take per game (36 min reference) — the existing
// "three" attribute still decides how well they shoot once picked (acc in
// simP()), same volume/quality split as Scoring vs three/layup/dunk above.
// Same piecewise shape as SCORING_BREAKPOINTS/ppg36(), this time for the
// commissioner's own 3PA table.
// Scaled ×1.575 (every breakpoint, plus the extrapolation cap) — Bruno
// reported real 2025-26 NBA per-team-per-game targets of 13.3 3PM / 37.0
// 3PA / 36.0% 3P%. The old curve's accuracy already matched real 3P%
// (35.4%, from the "three" attribute, untouched here), but volume was the
// real gap: the league's own three_attempt_rate average (47.9) only
// produced ~23.5 team 3PA/game against a real target of 37 — the curve was
// never actually calibrated against a real per-team-game table the way
// SCORING_BREAKPOINTS/FT_RATE_K were, just shaped plausibly. 1.575 is the
// exact ratio needed to bring the average case up to the real target;
// verified against real DB rosters afterward.
const THREE_RATE_BREAKPOINTS:[number,number][]=[
[0,0],[10,.8],[20,1.6],[28,2.4],[35,3.2],[42,3.9],[48,4.7],[54,5.5],[60,6.3],
[66,7.1],[72,7.9],[78,8.7],[83,9.5],[87,10.2],[90,11.0],[92,11.8],[93,12.6],[94,13.4],[95,17.0],
]
function tpa36(threeAttemptRate?:number):number{
const s=Math.max(0,Math.min(99,threeAttemptRate??50))
const bp=THREE_RATE_BREAKPOINTS
if(s<=bp[0][0])return bp[0][1]
for(let i=1;i<bp.length;i++){
if(s<=bp[i][0]){
const[s0,p0]=bp[i-1],[s1,p1]=bp[i]
return p0+(p1-p0)*(s-s0)/(s1-s0)
}
}
const[s0,p0]=bp[bp.length-2],[s1,p1]=bp[bp.length-1]
const slope=(p1-p0)/(s1-s0)
return Math.min(19,p1+slope*(s-s1))
}

// Steal Rate (hidden) is the SOLE driver of how many steals a player
// racks up per game (36 min reference) — "stl" (and speed/agility) still
// decide the quality/how of it (who's quick enough to actually be the one
// near the play), not how often. The commissioner only gave the table's
// upper half (79-95 rating -> 0.9-2.0 STL); everything below 79 is a
// straight line back to (0,0), same floor convention as every other rate
// table here.
const STEAL_RATE_BREAKPOINTS:[number,number][]=[
[0,0],[79,.9],[81,1.0],[83,1.1],[85,1.2],[87,1.3],[89,1.4],[90,1.5],
[91,1.6],[92,1.7],[93,1.8],[94,1.9],[95,2.0],
]
function spg36(stealRate?:number):number{
const s=Math.max(0,Math.min(99,stealRate??50))
const bp=STEAL_RATE_BREAKPOINTS
if(s<=bp[0][0])return bp[0][1]
for(let i=1;i<bp.length;i++){
if(s<=bp[i][0]){
const[s0,p0]=bp[i-1],[s1,p1]=bp[i]
return p0+(p1-p0)*(s-s0)/(s1-s0)
}
}
const[s0,p0]=bp[bp.length-2],[s1,p1]=bp[bp.length-1]
const slope=(p1-p0)/(s1-s0)
return Math.min(2.5,p1+slope*(s-s1))
}

// Free Throw Rate (hidden) is the SOLE driver of how often a player gets
// to the free throw line per game (36 min reference) — "ft" still decides
// FT% once there (unchanged), and draw_foul now plays the same secondary
// "quality" role stl/speed/agility play for Steal Rate (a real but smaller
// nudge on whether a given trip to the rim actually draws iron, not the
// volume itself). Breakpoints are the average FTA/rating pull from the
// commissioner's top-100 table (77-95 rating -> 2.3-10.1 FTA), same floor
// convention as every other rate table here (straight line back to 0,0
// below the table's lowest given rating).
const FT_RATE_BREAKPOINTS:[number,number][]=[
[0,0],[77,2.3],[79,2.7],[81,3.3],[83,3.7],[85,4.1],[87,4.7],[89,5.3],
[90,5.6],[91,6.2],[92,7.4],[93,8.2],[94,9.1],[95,10.1],
]
// Calibrated against real team-level FTA, not just one player in isolation —
// the commissioner reported team FTA looked low league-wide against the real
// 2025-26 NBA average (24.8 FTA/team/game). Backtested with real DB rosters
// (not synthetic dummies): summed across a full team, this K lands the
// simulated average at ~24.8 FTA/team/game. A single very high-usage star
// can still run well above his own individual per-36 target on a given
// night — real variance, same as an actual box score — but the team total
// this is actually calibrated against matches.
// Nudged .03->.032 to compensate for the new ftTaper/tighter SHOOTING_FOUL_CAP
// below pulling the team-level average down slightly below this real target.
const FT_RATE_K=0.039
// Real per-shot ceiling for a shooting foul — the previous ".55" cap was
// applied to the base frequency term BEFORE foulDrawQualityMult/refFoulMult/
// tacticalMods.foulDrawMult multiplied it further, so the real per-shot
// chance for a maxed-out player could climb past 90% (see the fix at the
// shooting-foul roll below, which now caps the FULLY-combined probability
// instead). ~0.22 keeps an elite free_throw_rate/draw_foul player's
// per-shot shooting-foul chance in a believable range.
// Tightened .18->.15 alongside the new ftTaper below — most shots sit well
// under this ceiling already (FT_RATE_K is tuned for the average, not the
// cap), so this mainly shaves the extreme tail (a maxed-out player plus a
// whistle-happy ref) rather than moving the calibrated team-level average.
const SHOOTING_FOUL_CAP=0.10
// Per-possession chance of a common/non-shooting foul (reach-in, illegal
// screen, loose ball) — independent of the shot itself, and NOT
// automatically a trip to the line (see the bonus/penalty check where this
// is used). Calibrated together with SHOOTING_FOUL_CAP/FT_RATE_K against
// real DB rosters to land team fouls at ~25/game (~23 FT-awarding) and team
// FTA at ~24.8/game — Bruno's real 2025-26 NBA reference numbers.
const NONSHOOTING_FOUL_CHANCE=0.15
function ftpg36(freeThrowRate?:number):number{
const s=Math.max(0,Math.min(99,freeThrowRate??50))
const bp=FT_RATE_BREAKPOINTS
if(s<=bp[0][0])return bp[0][1]
for(let i=1;i<bp.length;i++){
if(s<=bp[i][0]){
const[s0,p0]=bp[i-1],[s1,p1]=bp[i]
return p0+(p1-p0)*(s-s0)/(s1-s0)
}
}
const[s0,p0]=bp[bp.length-2],[s1,p1]=bp[bp.length-1]
const slope=(p1-p0)/(s1-s0)
return Math.min(12,p1+slope*(s-s1))
}
// FT_RATE_K/NONSHOOTING_FOUL_CHANCE above were already carefully calibrated
// to land the TEAM-level FTA average right on the real 2025-26 NBA target
// (~24.8/team/game) — and they do. The problem was never the average, it
// was the tail: nothing tapered a player's own shooting-foul-draw chance
// back down as he kept drawing them, the same gap rebTaper/astTaper/
// scoreTaper each closed for their own stat. Real incident: a single game
// with 76 combined FTA (both teams), well above the calibrated target, with
// several players individually posting real per-36 outliers. Same
// self-taper pattern, applied to shootingFoulChance below.
function ftTaper(ftaSoFar:number,mins:number):number{
const threshold=Math.max(1,(mins/36)*4)
return ftaSoFar<=threshold?1:Math.max(.05,1-(ftaSoFar-threshold)*.45)
}

// Same shape as SCORING_BREAKPOINTS/ppg36() above, this time for the hidden
// Assist Rate attribute — breakpoints are the exact Assists/Passing pairs
// from the commissioner's table. Existing pass attributes (pass_vis,
// pass_iq, ball_hdl, assist_role) still matter — they shape WHICH teammate
// gets credited when a basket gets assisted (quality/read) — but this is
// now the sole driver of HOW MANY assists a player racks up.
const ASSIST_BREAKPOINTS:[number,number][]=[
[0,0],[20,1],[32,2],[42,3],[50,4],[58,5],[66,6],[74,7],[80,8],[86,9],[91,10],[95,11],
]
function apg36(assistRate?:number):number{
const s=Math.max(0,Math.min(99,assistRate??50))
const bp=ASSIST_BREAKPOINTS
if(s<=bp[0][0])return bp[0][1]
for(let i=1;i<bp.length;i++){
if(s<=bp[i][0]){
const[s0,p0]=bp[i-1],[s1,p1]=bp[i]
return p0+(p1-p0)*(s-s0)/(s1-s0)
}
}
const[s0,p0]=bp[bp.length-2],[s1,p1]=bp[bp.length-1]
const slope=(p1-p0)/(s1-s0)
return Math.min(14,p1+slope*(s-s1))
}

// blk stays exactly what it always was — shot-blocking ability — but now
// directly defines the average blocks/game at 36 minutes via the
// commissioner's table, same piecewise shape as ppg36()/apg36() above,
// instead of an arbitrary flat "blk/100 * .065" per-shot chance with no
// real calibrated target.
const BLK_BREAKPOINTS:[number,number][]=[
[0,0],[15,.2],[28,.4],[40,.6],[50,.8],[58,1.0],[65,1.2],[72,1.5],[79,1.8],[85,2.1],[89,2.4],[92,2.7],[95,3.1],
]
function bpg36(blk?:number):number{
const s=Math.max(0,Math.min(99,blk??50))
const bp=BLK_BREAKPOINTS
if(s<=bp[0][0])return bp[0][1]
for(let i=1;i<bp.length;i++){
if(s<=bp[i][0]){
const[s0,p0]=bp[i-1],[s1,p1]=bp[i]
return p0+(p1-p0)*(s-s0)/(s1-s0)
}
}
const[s0,p0]=bp[bp.length-2],[s1,p1]=bp[bp.length-1]
const slope=(p1-p0)/(s1-s0)
return Math.min(4,p1+slope*(s-s1))
}

// Same "volume vs. type" split as Scoring/Assist Rate: reb_rate (hidden) is
// the sole driver of a player's TOTAL rebounds/game at 36 minutes via the
// commissioner's table. off_reb/def_reb still matter — they no longer set
// the total, but they do set the SPLIT of that total between offensive and
// defensive boards (see offReboundShare/defReboundShare below), and
// strength/technique still decide who wins a given contested ball.
// Recalibrated after fixing reb_rate's correlation with off_reb/def_reb —
// with that fix, the league's genuinely elite bigs (Sabonis, Gobert, Jokic,
// Giannis, Embiid...) now cluster around reb_rate 58-65, not up near 90+.
// The old curve was near-linear across the whole 0-95 range, so that
// cluster only translated to ~6-7 boards/36 — real elite bigs average
// 10-14. This doesn't touch total team rebounds at all (that's set by how
// many missed shots reach the rebound step, not by this curve) — it only
// reshapes the weighted pick AMONG a team's own rotation for who actually
// grabs each one, so the stars now pull far more of their team's boards
// instead of the total being smeared evenly across the roster.
const REB_BREAKPOINTS:[number,number][]=[
[0,0],[15,0.5],[20,1],[26,1.5],[30,2],[34,2.5],[40,3.5],[45,4.5],[53,6.5],[58,8],[64,10.5],[70,12],[80,13.5],[88,14.5],[95,15.5],
]
// A real elite rebounder's OWN game-to-game ceiling is nowhere near as
// unbounded as an uncorrected weighted draw makes it — the same handful of
// bigs were clearing 20+ boards (and Jokic-type reb_rate profiles averaging
// 17/game instead of a realistic 12-13) far more than real NBA rates (20+
// rebounds happens in roughly 1% of team-games, not 8%). This tapers a
// player's own rebound-draw weight down once HIS OWN total this game climbs
// past a normal-great-game level — realistic (the other team starts boxing
// him out harder, a teammate cleans up the carom instead) and it only
// redistributes his lost share to the same pool of teammates/opponents
// already competing for that exact rebound, so it never touches either
// team's total rebound count, only who ends up with them.
// The taper threshold itself has to scale with the player's OWN minutes —
// a flat "10 boards" trigger for everyone let a bench player logging 20
// minutes climb just as high before tapering as a 40-minute starter, since
// nothing else in this draw caps raw counting-stat volume by playing time
// (the mins-weight only shapes PROBABILITY per rebound, not how many total
// rebounds are up for grabs across the whole game). Scaled off a 36-minute
// reference (the level the flat "10" was originally tuned against).
function rebTaper(rebSoFar:number,mins:number):number{
const threshold=Math.max(3,(mins/36)*10)
return rebSoFar<=threshold?1:Math.max(.25,1-(rebSoFar-threshold)*.10)
}
// Same idea as rebTaper() above, applied to the assist weighted-draw: an
// elite passer's own assist total this game tapers his own draw weight down
// once it climbs past a normal-great-game level, so the extreme tail (16+
// assists) comes down toward the real NBA's ~1.4% rate without touching the
// team-wide assist total (it only redistributes the lost share to the same
// pool of teammates already on the floor). Same mins-scaled threshold as
// rebTaper above, for the same reason — a 20-minute player and a 40-minute
// starter can't fairly share one flat assist ceiling.
// Decay rate steepened from .11 to .20 — at the old rate, a player who'd
// already climbed 3 assists past his own threshold still kept 67% of his
// original weight, nowhere near tapered enough to stop MULTIPLE teammates
// from independently crossing 10+ assists in the same game (a real
// incident: 3 different players on one team all hit double-digit assists —
// real NBA games essentially never see even 2). At .20, a player is
// already down to the floor by 4 assists past threshold instead of
// drifting there slowly.
function astTaper(astSoFar:number,mins:number):number{
const threshold=Math.max(2,(mins/36)*7)
return astSoFar<=threshold?1:Math.max(.22,1-(astSoFar-threshold)*.20)
}
// Real "foul trouble" caution — a coach genuinely plays a player more
// carefully (or shifts defensive matchups away from him) once he's already
// picked up a few fouls, rather than letting the same heavy-minutes
// defender keep absorbing the team's whole foul total possession after
// possession until he fouls out almost every game. Tapers a player's own
// defender-selection weight down as HIS OWN personal fouls this game climb
// — the same self-taper pattern as rebTaper/astTaper/scoreTaper, so the
// team's total foul volume is unchanged, just who ends up picking them up.
function foulTaper(pfSoFar:number):number{return pfSoFar<=1?1:Math.max(.12,1-(pfSoFar-1)*.24)}
// Same idea again, this time on shot-selection weight (see pS() below) — a
// player's own field-goal-attempt count this game tapers his own shot
// weight down once it passes a normal monster-game volume, so the runaway
// hot-hand feedback loop (momentum boosts both weight and accuracy at once)
// can't push one player's FGA to unrealistic totals in a single game.
// Real incident that surfaced this: a flat "18 FGA" threshold applied
// equally to a 40-minute starter AND a 20-minute bench piece let low-minute
// players rack up starter-level shot counts (and, combined with hot-hand
// momentum, starter-level POINTS) inside a fraction of a starter's playing
// time — box scores showing 40+ points in the low 20s of minutes, an
// impossible scoring rate no real NBA game produces. Scaled off the same
// 36-minute reference as rebTaper/astTaper above (the level "18" was
// originally tuned against), so a bench player's own shot volume gets
// reined in much earlier, proportional to how little he's actually playing.
// Decay steepened .07->.14 and floor dropped .30->.15 — a real incident
// (two teammates both scoring 47 in ~31 minutes each, 94 combined points on
// one team; real NBA history has ZERO games with two teammates BOTH at 47+,
// and only 10 games ever with both at 40+, topping out at 91 combined)
// showed the old rate let a hot shooter's weight stay high enough, long
// enough, to keep out-competing bench weights all game even while
// "tapering". Same idea as astTaper's .11->.20 steepening earlier.
function scoreTaper(fgaSoFar:number,mins:number):number{
const threshold=Math.max(4,(mins/36)*18)
return fgaSoFar<=threshold?1:Math.max(.06,1-(fgaSoFar-threshold)*.24)
}
// scoreTaper above only throttles raw shot COUNT — and-1s, made 3s, and free
// throws all add points without necessarily adding to FGA, so a hot enough
// shooter could still keep his attempts under the taper threshold while his
// point total quietly runs away (a real incident: 45+ points inside 27
// minutes, an over-2x-real-NBA scoring rate no amount of FGA-capping alone
// stopped). This tapers a player's own shot-selection weight directly
// against his OWN points scored so far, relative to what his own mins
// allocation should realistically produce (via the same ppg36() curve that
// sets his baseline volume) — the direct fix for the actual symptom
// (points per minute), not just a proxy for it via shot count.
// Decay steepened .6->2.0 and floor dropped .20->.12, same real incident as
// scoreTaper above — dividing by "expected" diluted the decay too much for
// a genuine star (a big expected baseline meant the same raw point excess
// barely moved his weight), letting him keep climbing well past a real
// monster game instead of leveling off around one.
function pointsTaper(ptsSoFar:number,mins:number,scoring?:number):number{
const expected=Math.max(6,ppg36(scoring)*(mins/36))
const threshold=expected*1.3
return ptsSoFar<=threshold?1:Math.max(.05,1-(ptsSoFar-threshold)/expected*3.5)
}
// Real NBA "usage curve": a player who's carrying a much bigger share of
// the offense than normal doesn't just take more shots (scoreTaper above
// already tempers that within one game) — the shots themselves are tougher
// on average (more contested, later in the shot clock, worse looks), so
// true efficiency drifts down a little as sustained volume climbs. Modest
// by design (max ~15% haircut) — this is a real but secondary effect next
// to a player's own shooting ratings, not a hard cap.
function usageEffMult(fgaSoFar:number):number{return fgaSoFar<=15?1:Math.max(.85,1-(fgaSoFar-15)*.012)}
// Floor spacing: a shooter's real look quality depends on who's on the floor
// with him, not just his own ability — bad outside shooters let the defense
// sag off them and collapse onto whoever has the ball, while good shooters
// pull their defenders out to the arc and open things up. Modeled off the
// mins-weighted average "three" rating of the rest of the shot pool (the
// same pool pS() draws from), centered on a league-average teammate (three
// rating 50 => neutral) so this only ever helps or hurts relative to a
// normal supporting cast, never on its own.
function teamSpacingMult(shooter:any,pool:any[]):number{
const others=pool.filter(p=>p.id!==shooter.id&&(p.mins||0)>0)
if(!others.length)return 1
let wSum=0,mSum=0
others.forEach(p=>{const m=p.mins||0;wSum+=m;mSum+=(p.three??50)*m})
const avgThree=wSum>0?mSum/wSum:50
return Math.min(1.06,Math.max(.92,1+(avgThree-50)/50*.06))
}
function rpg36(rebRate?:number):number{
const s=Math.max(0,Math.min(99,rebRate??50))
const bp=REB_BREAKPOINTS
if(s<=bp[0][0])return bp[0][1]
for(let i=1;i<bp.length;i++){
if(s<=bp[i][0]){
const[s0,p0]=bp[i-1],[s1,p1]=bp[i]
return p0+(p1-p0)*(s-s0)/(s1-s0)
}
}
const[s0,p0]=bp[bp.length-2],[s1,p1]=bp[bp.length-1]
const slope=(p1-p0)/(s1-s0)
return Math.min(15,p1+slope*(s-s1))
}
// Normalized 0-1 lean toward offensive/defensive boards from a player's own
// off_reb/def_reb balance — multiplies the reb_rate volume base rather than
// competing with it, so a low-reb_rate player never out-rebounds a
// high-reb_rate one just because their split happens to favor one side.
function offReboundShare(p:any):number{const o=p.off_reb??50,d=p.def_reb??50;return o/Math.max(1,o+d)}
function defReboundShare(p:any):number{const o=p.off_reb??50,d=p.def_reb??50;return d/Math.max(1,o+d)}

function rnd(a:number,b:number){return Math.floor(Math.random()*(b-a+1))+a}
function wt(pool:Array<{p:any,w:number}>){
const t=pool.reduce((s,x)=>s+x.w,0);let r=Math.random()*t
for(const x of pool){r-=x.w;if(r<=0)return x.p}
return pool[pool.length-1].p
}
// Team-share cap for any weighted draw among teammates competing for a single
// credit (a shot, a rebound, an assist) — a real incident (LaMelo Ball taking
// 49 shots against a much-weaker supporting cast, then Matas Buzelis doing
// the same to rebounds) showed a plain weighted draw has no ceiling on how
// much of a shared pool one standout talent can absorb purely because
// everyone else in the pool is worse. Real basketball puts a soft ceiling on
// this regardless of talent gap (defenses adjust, teammates crowd the same
// space) — capped here at the pool level so it only ever activates when one
// player's raw share is already extreme; the excess is redistributed across
// the rest of the same pool, never removed from the team's total.
function wtCapped(pool:Array<{p:any,w:number}>,cap=.33){
if(pool.length>1){
const totalW=pool.reduce((s,x)=>s+x.w,0)
if(totalW>0){
let maxIdx=0
for(let i=1;i<pool.length;i++)if(pool[i].w>pool[maxIdx].w)maxIdx=i
const maxW=pool[maxIdx].w,others=totalW-maxW
if(maxW/totalW>cap&&others>0)pool[maxIdx].w=(cap/(1-cap))*others
}
}
return wt(pool)
}
function fmt(tl:number){return Math.floor(tl/60)+":"+String(tl%60).padStart(2,"0")}

// Real rock-paper-scissors matchups: every attacking style has exactly one
// defense that shuts it down and one it torches. Man denies Motion's ball
// movement but gets exposed 1-on-1 by Isolation; Zone clogs Post-Ups/Pick &
// Rolls but leaves Motion shooters open; Press creates chaos but is worst
// against Transition/Post (pulls defenders from the paint); Pack the Paint
// smothers Iso/Transition drives but concedes Pick & Roll/Post-Up looks.
const ATK_DEF_MATCHUP:Record<string,Record<string,number>>={
motion:     {man:0.90,zone23:1.05,press:1.00,pack:1.05},
pickroll:   {man:1.05,zone23:0.90,press:1.05,pack:0.95},
transition: {man:1.00,zone23:1.00,press:1.10,pack:0.90},
iso:        {man:1.10,zone23:1.00,press:1.05,pack:0.85},
post:       {man:1.00,zone23:0.85,press:1.10,pack:0.95},
}

// Pace tendencies: Transition/Press want a fast tempo, Iso/Post/Pack want a
// slow deliberate one. Motion, Pick & Roll, Man and Zone are pace-neutral —
// every system needs some options that work at any speed.
const PACE_PREF:Record<string,"high"|"low"|undefined>={
transition:"high",press:"high",iso:"low",post:"low",pack:"low",
}
function paceSynergy(style:string,pace:number):number{
const pref=PACE_PREF[style]
if(!pref)return 1.0
if(pref==="high")return pace>=75?1.06:pace<=55?0.94:1.0
return pace<=55?1.06:pace>=75?0.94:1.0
}

// Attack Style now genuinely shapes shot selection, not just the matchup
// multiplier. "mid" is the flat chance a non-3 shot is a mid-ranger; "post"
// is the chance of a post-up among what's left. Post-Up really generates
// post shots; Transition wants easy paint looks with almost no post-ups
// (no time to work the block); Isolation leans on self-created mid-range;
// Pick & Roll leans paint (the roll man) and mid (the pull-up jumper).
const SHOT_PROFILE_BY_ATK_STYLE:Record<string,{mid:number,post:number}>={
motion:     {mid:0.30,post:0.15},
post:       {mid:0.20,post:0.45},
iso:        {mid:0.40,post:0.20},
pickroll:   {mid:0.35,post:0.08},
transition: {mid:0.15,post:0.05},
}

// A Head Coach's off_adjustment/def_adjustment sharpens a matchup that
// already favors their side, or dulls one that doesn't — same ±30% cap
// pattern used for the Physio's rehab_speed effect on injury recovery.
function coachDampen(adj?:number):number{
const a=adj??50
return Math.max(-0.3,Math.min(0.3,(a-50)/50*0.3))
}

// Mental Coach — same capped-dampen shape as coachDampen() above, but
// centered on 60 (the neutral baseline every other coach attribute in this
// table defaults to, not 50). team_cohesion swings assist/turnover rates;
// composure_coaching swings how much clutch/decisive moments cost a team.
function cohesionDampen(cohesion?:number, cap=0.2):number{
const c=cohesion??60
return Math.max(-cap,Math.min(cap,(c-60)/40*cap))
}
function composureDampen(composure?:number):number{
const c=composure??60
return Math.max(-0.12,Math.min(0.12,(c-60)/40*0.12))
}

// Maps the in-memory sim state (which uses short internal names like or/dr/fd/to)
// to the actual box_scores column names. Mismatched names here fail an insert
// silently (PostgREST just drops the row) — keep this in sync with the schema.
function toBoxRow(p:any, s:any){
return {
player_id: p.id, mins: p.mins, is_starter: !!p.isStarter,
pts: s.pts||0, ast: s.ast||0, stl: s.stl||0, blk: s.blk||0,
fga: s.fga||0, fgm: s.fgm||0, tpa: s.tpa||0, tpm: s.tpm||0, fta: s.fta||0, ftm: s.ftm||0,
pf: s.pf||0, tech_fouls: s.tf||0, off_reb: s.or||0, def_reb: s.dr||0, reb: (s.or||0)+(s.dr||0),
turnovers: s.to||0, plus_minus: s.plus_minus||0,
// Whether the real foul-trouble protection actually fired for this player
// this game (see foulTroubleCheck) — NOT just "did he end up with 4 or 5
// personal fouls", which stayed true in every quarter and no longer
// matches the real mechanic (first-half only).
foul_trouble: !!p._foulTroubleApplied,
}
}

// Real basketball has exactly 5 players on the floor per side at any given
// moment — but this engine's `mins` is a whole-game eligibility weight (see
// `ops`/`dps` above), not a substitution clock, so there's no existing
// concept of "on the floor right now" to hang +/- off of. This reconstructs
// one, per possession, the same way every other uncertain outcome in this
// file is resolved: a weighted random draw (via wt()), one player per
// position, weighted by each player's own allocated mins — a player with
// 32 of a position's ~48 minutes is on the floor roughly 2/3 of the time,
// a bench player with 8 roughly 1/6, matching their real submitted rotation
// share instead of an invented number.
function onCourtFive(ps:any[]):any[]{
const byPos:Record<string,any[]>={}
ps.forEach(p=>{if(p.mins>0&&!p.ejected){const pos=p.pos||"SF";(byPos[pos]=byPos[pos]||[]).push(p)}})
const five:any[]=[]
for(const pos of ["PG","SG","SF","PF","C"]){
const pool=byPos[pos];if(!pool||!pool.length)continue
const picked=wt(pool.map(p=>({p,w:Math.max(1,p.mins)})))
if(picked)five.push(picked)
}
return five
}

// Real garbage time: once a game is truly decided, BOTH benches empty —
// not just a possession-selection trick that leaves the box score's MIN
// column looking exactly like it would have in a close game. This actually
// rewrites p.mins for the rest of the game — the team's 5 heaviest-minute
// players (its de facto starters, whether or not they were flagged as such)
// give up a chunk of their remaining planned minutes, and that same chunk
// gets handed to the 5 LEAST-used players on the roster, including anyone
// originally penciled in for 0 minutes — real bench call-ups nobody
// expected to see the floor tonight. Since every stat-crediting weight in
// this file already reads p.mins directly, this one mutation is all it
// takes to cascade correctly into shot volume, assists, rebounds, steals,
// and the final box score — no separate possession-pool hack needed.
// elapsed = how much game clock has already run (elapsedMinutes(q,tl) at the
// trigger point). A star who's played most of the game before garbage time
// hits has already been accumulating stats (points, rebounds...) at a pace
// consistent with that much real playing time — cutting his FINAL displayed
// mins below that, using only his original pregame allocation and the clock
// time left, could shrink it well under how long he'd actually been
// producing those stats for. A real incident: box scores showing a star's
// normal, unremarkable point total next to an artificially tiny minutes
// total (e.g., 24pts/9min), reading as an impossible per-minute rate even
// though the points themselves were earned at a normal pace over most of
// the game — the bug was in the DISPLAYED minutes, not the scoring.
function applyGarbageTimeSubs(players:any[],remainingMin:number,elapsed:number){
if(remainingMin<=0)return
// A player who already fouled out has a correct, final p.mins (his real
// elapsed time, set once by foulOutCheck) — he must never be touched again
// here in either direction. Without this guard, a foul-out early in the
// game leaves him with a low p.mins, which then makes him look like an
// unused bench player to the "who's played the least" deepBench pick below,
// handing him a chunk of garbage-time minutes on top of his already-correct
// total — the exact bug behind a "FOULED OUT" box score line still showing
// 45+ total minutes.
const active=[...players].filter(p=>p.mins>0&&!p.ejected).sort((a,b)=>b.mins-a.mins)
const stars=active.slice(0,5)
if(!stars.length)return
// The 5 who get pulled would all have played this exact same closing
// stretch simultaneously — each one individually loses up to the full
// clock time remaining, not a shared pool divided five ways. Their direct
// bench replacements (the 5 least-used players on the roster, including
// anyone originally at 0) each pick up that same real minutes swing.
const starIds=new Set(stars.map(p=>p.id))
const deepBench=[...players].filter(p=>!starIds.has(p.id)&&!p.ejected).sort((a,b)=>(a.mins||0)-(b.mins||0)).slice(0,stars.length)
stars.forEach((p,i)=>{
const taken=Math.min(remainingMin,p.mins*0.85)
const floorMins=Math.min(p.mins,elapsed)
p.mins=Math.round(Math.max(2,floorMins,p.mins-taken))
const replacement=deepBench[i]
// box_scores.mins is an integer column — this mid-game reallocation
// runs after applyDC()'s own rounding pass, so a fractional remainder
// here (remainingMin is minutes-left-on-the-clock, essentially never a
// whole number) would silently fail the box_scores insert for the
// entire game, the same failure mode already fixed once for the
// pre-game jitter step.
if(replacement)replacement.mins=Math.round((replacement.mins||0)+taken)
})
}

// A technical foul counts as a personal foul AND its own separate tally.
// A player's 2nd technical foul in the same game is an automatic ejection —
// same real-world NBA rule. Rolled once per quarter per active player,
// weighted by their trash_talk attribute (hot-headed players pick up more).
// The assigned referee's technical_impatience scales the whole base rate
// directly (impatient with complaining players = quick whistle); a rivalry/
// decisive game adds the same flat heat regardless of who's officiating.
function rollTechs(offense:any[],defense:any[],offSide:"home"|"away",defSide:"home"|"away",offTeam:any,sc:any,st:any,q:number,pbp:any[],referee?:any,chippy?:boolean){
const refTechMult=referee?.6+(referee.technical_impatience/100)*.8:1
const chippyMult=chippy?1.3:1
for(const p of offense){
if(p.mins<=0||p.ejected)continue
const chance=(0.003+((p.trash_talk??50)/100)*0.012)*refTechMult*chippyMult
if(Math.random()>=chance)continue
const s=st[p.id]
s.tf=(s.tf||0)+1;s.pf=(s.pf||0)+1
foulOutCheck(p,s,offTeam,offense,q,720,pbp,sc)
foulTroubleCheck(p,s,offTeam,offense,q,720,pbp,sc)
const activeOpp=defense.filter((o:any)=>o.mins>0&&!o.ejected)
if(activeOpp.length){
const shooter=wt(activeOpp.map((o:any)=>({p:o,w:(o.ft||70)})))
const os2=st[shooter.id]
os2.fta=(os2.fta||0)+1
if(Math.random()<(shooter.ft||70)/100){os2.ftm=(os2.ftm||0)+1;os2.pts=(os2.pts||0)+1;sc[defSide]+=1}
}
pbp.push({quarter:q+1,time_left:fmt(720),team_id:offTeam.id,event_type:"technical",description:`🟨 TECHNICAL FOUL — ${p.name}`,home_score:sc.home,away_score:sc.away})
if(s.tf>=2){
p.ejected=true
pbp.push({quarter:q+1,time_left:fmt(720),team_id:offTeam.id,event_type:"ejection",description:`⛔ ${p.name} EJECTED — 2nd technical foul!`,home_score:sc.home,away_score:sc.away})
}
}
}

// Real elapsed game time as of this exact moment, used to give a player who
// fouls out his TRUE minutes played instead of his full pre-game planned
// allocation. Regulation periods are 12 real minutes, overtime periods 5 —
// can't just do q*12 since a game that reaches OT mixes both period lengths.
function elapsedMinutes(q:number,tlSeconds:number):number{
const priorMinutes=q<4?q*12:48+(q-4)*5
const periodLen=q>=4?300:720
return priorMinutes+(periodLen-tlSeconds)/60
}

// A player disqualified for the rest of the game once his personal fouls
// reach 6 — the same real NBA rule already modeled for technical fouls (2nd
// tech = ejection) never existed for ordinary personal fouls, so a player
// could rack up 7, 8, 9+ fouls in a single game and keep playing. Reuses the
// same p.ejected flag the technical-foul ejection already sets, so a
// fouled-out player is automatically excluded from every future possession's
// player pool (ops/dps filters) with no other code changes needed.
// Also corrects his box-score minutes down to what he actually played (not
// his full pre-game planned allocation) and hands his remaining planned
// minutes to whichever teammate has played the least so far — a real
// substitution, same as a coach sending in the next man off the bench.
function foulOutCheck(p:any,s:any,team:any,teammates:any[],q:number,tlSeconds:number,pbp:any[],sc:any){
if((s.pf||0)>=6&&!p.ejected){
p.ejected=true
pbp.push({quarter:q+1,time_left:fmt(tlSeconds),team_id:team.id,event_type:"ejection",description:`⛔ ${p.name} FOULED OUT — 6th personal foul!`,home_score:sc.home,away_score:sc.away})
const elapsed=elapsedMinutes(q,tlSeconds)
const remaining=Math.max(0,(p.mins||0)-elapsed)
p.mins=Math.round(Math.max(0,elapsed))
if(remaining>0){
const sub=teammates.filter((o:any)=>o.id!==p.id&&!o.ejected).sort((a:any,b:any)=>(a.mins||0)-(b.mins||0))[0]
if(sub){
sub.mins=Math.round((sub.mins||0)+remaining)
pbp.push({quarter:q+1,time_left:fmt(tlSeconds),team_id:team.id,event_type:"substitution",description:`🔄 ${sub.name} checks in for ${p.name}`,home_score:sc.home,away_score:sc.away})
}
}
}
}

// Real "foul trouble" caution, distinct from foulTaper() above — foulTaper
// only shades WHO gets picked as the next defender possession-to-possession
// (a probabilistic nudge), it never actually shortens a player's game. This
// is the other real half of the same coaching decision: once a player is in
// real foul trouble (see the quarter-aware thresholds below), a coach
// genuinely plays him fewer of his remaining minutes as a protective
// measure — trimming a portion (35%) of his remaining planned minutes, not
// all of them (he isn't disqualified, just managed more carefully), and
// handing that portion to whichever teammate has played the least so far.
// Reuses the exact same elapsed-minutes math and substitute-selection
// pattern as foulOutCheck for consistency.
// Real "foul trouble" is an early-game read, not just "4 personal fouls"
// whenever it happens to occur — a coach worries about 3 fouls in the 1st
// quarter, or 4 fouls by the end of the 2nd (still enough game left that
// fouling out would cost real playing time), but by the 4th quarter there's
// too little game left for a preemptive bench move to make sense, so it no
// longer counts as foul trouble at all. The previous version fired on a
// flat "exactly 4 fouls" regardless of quarter, which could (and did)
// trigger deep into the 4th quarter of a close game — exactly backwards
// from the real basketball convention. Guarded by _foulTroubleApplied
// instead of an exact-count match, since two different thresholds (Q1's 3,
// Q1-2's 4) can both be crossed in the same game and this should only ever
// fire once.
function foulTroubleCheck(p:any,s:any,team:any,teammates:any[],q:number,tlSeconds:number,pbp:any[],sc:any){
if(p.ejected||p._foulTroubleApplied)return
const pf=s.pf||0
const inTrouble=(q===0&&pf>=3)||(q<=1&&pf>=4)
if(!inTrouble)return
p._foulTroubleApplied=true
const elapsed=elapsedMinutes(q,tlSeconds)
const remaining=Math.max(0,(p.mins||0)-elapsed)
const protectiveCut=remaining*0.35
if(protectiveCut<=0)return
p.mins=Math.round(Math.max(elapsed,(p.mins||0)-protectiveCut))
const sub=teammates.filter((o:any)=>o.id!==p.id&&!o.ejected).sort((a:any,b:any)=>(a.mins||0)-(b.mins||0))[0]
if(sub){
sub.mins=Math.round((sub.mins||0)+protectiveCut)
pbp.push({quarter:q+1,time_left:fmt(tlSeconds),team_id:team.id,event_type:"foul_trouble",description:`⚠️ ${p.name} in foul trouble (${pf} fouls, Q${q+1}) — ${sub.name} gets extra minutes`,home_score:sc.home,away_score:sc.away})
}
}

export function simulateGame(ht:any,at:any,hp:any[],ap:any[],hOrd?:any,aOrd?:any){
const defOrd=(ps:any[])=>{const s=[...ps].sort((a,b)=>b.usage-a.usage);return{pris:[s[0]?.name,s[1]?.name,s[2]?.name],clutch:s[0]?.name,pace:70,three_rate:47,atk_style:"motion",def_style:"man"}}
// Merged, not all-or-nothing: game-context fields (attRate/isRivalry/decisive)
// must apply even to a team that never submitted Weekly Orders, so a partial
// hOrd/aOrd (just those fields) still gets real pace/style defaults underneath.
const ho={...defOrd(hp),...(hOrd||{})},ao={...defOrd(ap),...(aOrd||{})}
ensurePlayableDepthChart(hp,ho.depth_chart)
ensurePlayableDepthChart(ap,ao.depth_chart)
// fat[] is seeded from each player's weekly health (not a flat 100) so a
// player who's still banged up starts the game already worn down — it then
// degrades further as the game itself wears on, same as before. A team
// coming off a real back-to-back (ho.backToBack/ao.backToBack, set from the
// game's actual scheduled_date in cron/simulate) takes an extra flat hit on
// top of that, seeded per-side since only one team may be on the second
// half of a back-to-back. The Head Coach's substitutions skill (same
// coachDampen() shape as off_adjustment/def_adjustment) cushions or worsens
// that flat hit by up to ±30% — good rotation management keeps tired legs
// fresher on the second night of a back-to-back.
const sc={home:0,away:0},st:Record<string,any>={},fat:Record<string,number>={},mom:Record<string,number>={},ls:Record<string,number[]>={},part={home:0,away:0}
const tol={home:{used:0,q:{0:0,1:0,2:0,3:0}} as any,away:{used:0,q:{0:0,1:0,2:0,3:0}} as any}
// Team foul count for the CURRENT quarter only (resets every period, same as
// the real NBA) — drives the bonus/penalty: once a team reaches 5 fouls in
// a quarter, the opponent shoots FT on every further non-shooting foul that
// quarter too, not just shooting fouls. Counts both foul types, since real
// team-foul totals do.
const teamFouls={home:0,away:0}
let isGT=false,gtW=""
const pbp:any[]=[],hb:any[]=[],ab:any[]=[]
const seed=(ps:any[],ord:any)=>ps.forEach(p=>{st[p.id]={pts:0,or:0,dr:0,ast:0,stl:0,blk:0,fga:0,fgm:0,tpa:0,tpm:0,fta:0,ftm:0,pf:0,tf:0,fd:0,to:0,reb:0,turnovers:0,plus_minus:0};fat[p.id]=Math.min(100,Math.max(40,(p.health??100)-(ord.backToBack?12*(1-coachDampen(ord.substitutions)):0)));mom[p.id]=0;ls[p.id]=[];p.ejected=false})
seed(hp,ho);seed(ap,ao)
const pa=(ho.pace+ao.pace)/2,ppq=Math.round(25+pa/100*4)
const gameReferee=ho.referee||ao.referee
const gameChippy=!!(ho.isRivalry||ao.isRivalry||ho.decisive||ao.decisive)
// Regulation is exactly 4 quarters, but basketball has no ties: if the
// score is level after Q4, keep playing 5-minute overtime periods (q=4,5,6…)
// until someone actually wins, same as real NBA rules.
let q=0
const periods:{quarter:number,home:number,away:number}[]=[]
let prevHome=0,prevAway=0
while(q<4||sc.home===sc.away){
const isOT=q>=4
const periodLen=isOT?300:720
const periodPoss=isOT?Math.max(6,Math.round(ppq*300/720)):ppq
part.home=0;part.away=0
teamFouls.home=0;teamFouls.away=0
let side="home"
rollTechs(hp,ap,"home","away",ht,sc,st,q,pbp,gameReferee,gameChippy)
rollTechs(ap,hp,"away","home",at,sc,st,q,pbp,gameReferee,gameChippy)
if(isOT)pbp.push({quarter:q+1,time_left:fmt(periodLen),team_id:null,event_type:"info",description:`⏱️ OVERTIME ${q-3}! ${sc.home}-${sc.away}`,home_score:sc.home,away_score:sc.away})
for(let i=0;i<periodPoss*2;i++){
const tl=Math.max(0,Math.round(periodLen*(1-i/(periodPoss*2))))
const diff=Math.abs(sc.home-sc.away)
// Widened beyond the old tight "2 minutes left, up 20" trigger — a real
// blowout gets conceded well before the final minutes, so a big-enough
// margin fires this much earlier. Both benches empty once it's truly
// decided, not just the leading team's — the losing side has no reason to
// keep running its stars into a lost cause either.
// Real incident: a 30+ point lead built up by the 3rd quarter still kept
// both teams' starters in for the whole 3rd AND most of the 4th, since
// this used to only ever check q===3 (4th quarter) — a genuinely decided
// game a full quarter early never got conceded until much too late, if at
// all. Widened to q>=2 (3rd quarter onward), with a new bigger-margin tier
// for how much game-time can possibly be left at that point, and
// totalRemainingSec (rest of THIS quarter plus every full quarter still to
// come) instead of just tl (time left in the current quarter alone) — a
// trigger in the 3rd quarter has a whole 4th quarter still ahead of it,
// which the old tl-only check had no way to account for.
const totalRemainingSec=tl+(3-q)*720
if(q>=2&&q<=3&&!isGT&&((diff>=30&&totalRemainingSec<=900)||(diff>=25&&totalRemainingSec<=360)||(diff>=20&&totalRemainingSec<=240)||(diff>=15&&totalRemainingSec<=120))){
isGT=true;gtW=sc.home>sc.away?"home":"away"
const remainingMin=totalRemainingSec/60
const elapsedNow=elapsedMinutes(q,tl)
applyGarbageTimeSubs(hp,remainingMin,elapsedNow)
applyGarbageTimeSubs(ap,remainingMin,elapsedNow)
pbp.push({quarter:q+1,time_left:fmt(tl),team_id:null,event_type:"info",description:`🗑️ GARBAGE TIME — ${gtW==="home"?ht.name:at.name} leads by ${diff}, both benches empty!`,home_score:sc.home,away_score:sc.away})
}
const oo=side==="home"?ho:ao,doo=side==="home"?ao:ho
const ot=side==="home"?ht:at,dt=side==="home"?at:ht
// Rivalry games: every 4th-quarter possession is pressure-relevant, not just
// the final 2 minutes. Decisive games (playoffs, or standings still in
// play): the clutch window widens too, though not as far as a rivalry.
// Overtime is always clutch — every possession can decide the game.
const isRivalryGame=!!(ho.isRivalry||ao.isRivalry)
const isDecisiveGame=!!(ho.decisive||ao.decisive)
const isC=isOT||(q===3&&(isRivalryGame||(isDecisiveGame?(tl<=240&&diff<=8):(tl<=120&&diff<=5))))
// Garbage time no longer needs a separate possession-pool carve-out here —
// applyGarbageTimeSubs() already rewrote p.mins for both teams the moment
// it triggered, so the normal mins>0 pool (and every mins-weighted stat
// formula downstream) naturally shifts toward whoever's actually in now.
const ops=side==="home"?hp.filter(p=>p.mins>0&&!p.ejected):ap.filter(p=>p.mins>0&&!p.ejected)
const dps=side==="home"?ap.filter(p=>p.mins>0&&!p.ejected):hp.filter(p=>p.mins>0&&!p.ejected)
const os=side as "home"|"away",ds=(side==="home"?"away":"home") as "home"|"away"
if((part[ds] as number)>=8&&(tol[os].q[q]||0)<2&&tol[os].used<7){tol[os].q[q]=(tol[os].q[q]||0)+1;tol[os].used++;part.home=0;part.away=0;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"timeout",description:`⏱ TIMEOUT — ${ot.name}`,home_score:sc.home,away_score:sc.away})}
// +/- — see onCourtFive() above for why this is a per-possession weighted
// draw rather than a real substitution clock. Only the attacking side's
// score can move inside simP(), so the possession's point swing applies as
// +delta to whoever's on the floor for the scoring side and -delta to
// whoever's on the floor for the side that just allowed it — same net
// margin real +/- tracks, just resolved probabilistically per possession
// instead of by a literal on/off-court clock.
const scBefore=sc[os]
const onCourtOff=onCourtFive(side==="home"?hp:ap)
const onCourtDef=onCourtFive(side==="home"?ap:hp)
simP(ot,dt,ops,dps,oo,doo,sc,st,fat,mom,ls,part,isC,os,ds,q,tl,pbp,teamFouls)
const pmDelta=sc[os]-scBefore
if(pmDelta!==0){
onCourtOff.forEach(p=>{st[p.id].plus_minus+=pmDelta})
onCourtDef.forEach(p=>{st[p.id].plus_minus-=pmDelta})
}
side=side==="home"?"away":"home"
}
periods.push({quarter:q+1,home:sc.home-prevHome,away:sc.away-prevAway})
prevHome=sc.home;prevAway=sc.away
q++
}
// Everyone gets a row now — 0-min players show up as DNP-Coach's Decision
// in the box score UI instead of silently vanishing.
hp.forEach(p=>hb.push(toBoxRow(p,st[p.id])))
ap.forEach(p=>ab.push(toBoxRow(p,st[p.id])))
return{homeScore:sc.home,awayScore:sc.away,homeBox:hb,awayBox:ab,pbp,periods}
}

// A submitted Weekly Order can be malformed in ways that still pass the UI's
// own save guard — e.g. real player names assigned to every position slot
// but minutes only actually typed in for one of them (everyone else left at
// 0). This used to be treated as all-or-nothing: any team that fell below 5
// players with real minutes had its ENTIRE depth chart discarded — including
// whichever positions WERE filled in correctly — and replaced with a fully
// auto-generated lineup, silently overriding a GM's real submitted rotation
// (a real incident: a team's depth chart had valid PG minutes but every
// other position left at 0 — the auto-fallback then benched the real PG
// starter in favor of a bench player it decided was the auto-starter,
// exactly what a GM would call "my orders were ignored"). Now only the
// positions that are actually broken (no real minutes anywhere in that
// position's 3 slots) get patched in from the auto-builder — every position
// the GM genuinely filled in stays exactly as submitted.
function ensurePlayableDepthChart(players:any[],dc:any){
const auto=buildAutoDepthChart(players)
const merged:any={}
;["PG","SG","SF","PF","C"].forEach(pos=>{
const pd=dc?.[pos]
const posHasMins=!!pd&&["s","b1","b2"].some(sl=>pd[sl]?.name&&(pd[sl]?.mins||0)>0)
merged[pos]=posHasMins?pd:auto[pos]
})
if(dc?.ball_roles)merged.ball_roles=dc.ball_roles
applyDC(players,merged)
// Final safety net — only reachable if even the merged chart (real + auto
// patched positions) somehow still leaves the team unplayable.
if(players.filter((p:any)=>p.mins>0).length<5)applyDC(players,auto)
}

function applyDC(players:any[],dc:any){
players.forEach(p=>{p.mins=0;p.isStarter=false;p.posFitMult=1;p._posFitWeightedDist=0})
// A real, intentional use of the Depth Chart: a versatile player listed as
// starter at ONE position and bench at a DIFFERENT position, so he gets
// most of his minutes in his primary slot but also plays some minutes
// alongside a different set of teammates — that's the only way to give a
// player minutes with a lineup other than the opening five. Those cross-
// position minutes must keep accumulating exactly as before.
// What's actually malformed is the SAME position listing the SAME player
// in more than one of its own 3 slots (a real incident: one player as his
// own position's starter, b1, AND b2 all at once) — that's never a real
// GM intent, just a bad save, and it let him silently absorb his whole
// position group's minutes (24+16+8=48) instead of just his own slot,
// showing up in the box score at 50 minutes in a game that never went to
// overtime. So the dedupe is scoped to within one position only — a
// player can still legitimately appear in two DIFFERENT positions, just
// not twice in the same one.
;["PG","SG","SF","PF","C"].forEach(pos=>{
const pd=dc[pos];if(!pd)return
const seenThisPosition=new Set<string|number>()
;["s","b1","b2"].forEach(sl=>{const e=pd[sl];if(e?.name&&e.mins>0){const p=players.find((pl:any)=>pl.name===e.name);if(p&&!seenThisPosition.has(p.id)){
seenThisPosition.add(p.id)
p.mins+=e.mins;if(sl==="s")p.isStarter=true
const dist=Math.abs(POSITION_ORDER.indexOf(pos)-POSITION_ORDER.indexOf(p.pos))
p._posFitWeightedDist+=dist*e.mins
}}})
})
// Minutes-weighted average position distance across every slot a player was
// assigned to this week, converted into one blended real performance hit.
players.forEach(p=>{if(p.mins>0)p.posFitMult=posFitMultiplier(p._posFitWeightedDist/p.mins)})
// Weekly Orders minutes are a target AVERAGE, not an identical number every
// single game — game flow, matchups, and foul trouble move a real
// rotation's minutes around night to night. Jitter each player's assigned
// minutes with a bell-ish factor (average of 3 uniform randoms, centered at
// 1.0) before renormalizing the whole team back to the same total the
// depth chart originally summed to, so no new team-wide invariant is
// introduced — only the per-player split varies. Flows straight into both
// the box score's MIN column and pS()'s shot-volume weighting, since both
// read p.mins directly and this is the only place it gets set.
const jittered=players.filter(p=>p.mins>0)
if(jittered.length){
const totalBefore=jittered.reduce((s,p)=>s+p.mins,0)
jittered.forEach(p=>{
const jitter=1+((Math.random()+Math.random()+Math.random())/3-0.5)*0.36
// A single player can never actually play more than a full 48-minute
// regulation game — the dedupe above already stops one player from being
// double/triple-booked across slots, but this is a second, unconditional
// backstop against any other future path that could push one player's
// pre-game plan past what's physically possible.
p.mins=Math.min(48,Math.max(2,p.mins*jitter))
})
const totalAfter=jittered.reduce((s,p)=>s+p.mins,0)
if(totalAfter>0){
const scale=totalBefore/totalAfter
jittered.forEach(p=>{p.mins=Math.min(48,Math.max(2,p.mins*scale))})
}
// box_scores.mins is an integer column — a fractional value here (e.g.
// 29.87) makes the DB insert fail outright with "invalid input syntax for
// type integer", silently wiping the box score for the whole game (no
// error was ever checked on that insert). Round to a whole number, same
// as any real box score already shows.
jittered.forEach(p=>{p.mins=Math.round(p.mins)})
}
}

function pS(ps:any[],ord:any,u3:boolean,ic:boolean,fat:Record<string,number>,mom:Record<string,number>,st?:Record<string,any>){
if(ic&&ord.clutch){const cp=ps.find((p:any)=>p.name===ord.clutch);if(cp&&fat[cp.id]>40)return cp}
const pool=ps.filter((p:any)=>p.mins>0);if(!pool.length)return ps[0]
const pris=ord.pris||[ord.priority_1,ord.priority_2,ord.priority_3]
const weighted=pool.map((p:any)=>{
const f=fat[p.id]/100
// Scoring (hidden) is now the SOLE driver of shot volume — three/layup/dunk
// no longer gate how often a player is picked to shoot, only how well they
// convert once picked (see acc in simP()). Keeping them out of the weight
// entirely is what makes Scoring, not shooting touch, decide points/game.
// Was a flat "-6" subtraction, floored at .3 — every player under roughly
// 47 Scoring (ppg36 <= 6) collapsed to that identical floor, with zero
// differentiation between them. On a roster where everyone sits in that
// range except one outlier (a real "Rest of the World" roster: 9 players
// at Scoring 19-22, one at 40), that lone outlier had nothing left to
// compete against and vacuumed up half the team's shots (49 of 97 FGA in
// 24 minutes). Scaling proportionally instead keeps real separation across
// the whole range; the .769/.65/3.0 constants are chosen so an elite
// Scoring=85 player lands on the same weight as before (already calibrated
// against real rosters), not a fresh guess.
const scoreVol=Math.max(.3,ppg36(p.scoring)*0.769)
// Three Attempt Rate (hidden) is the SOLE driver of how often a player is
// picked to shoot from deep — the existing "three" attribute no longer
// gates this (see acc in simP() for where it still decides make%), the
// same volume/quality split Scoring already has over three/layup/dunk.
const threeVol=Math.max(.15,tpa36(p.three_attempt_rate)*2.0)
let w=u3?threeVol:scoreVol*3.0
// Coming off the bench is a real, if modest, rhythm/role tax on shot
// volume — a bench player with identical ratings to a starter doesn't get
// the same number of touches (different role in the second unit, coming
// in cold). Accuracy (acc() in simP()) is untouched: a good bench scorer
// still shoots his real percentage, he's just selected for the shot
// slightly less often.
if(!p.isStarter)w*=0.90
const pi=pris.indexOf(p.name)
if(!u3){if(pi===0)w*=1.3;else if(pi===1)w*=1.15;else if(pi===2)w*=1.08}else{if(pi===0)w*=1.3;else if(pi===1)w*=1.15;else if(pi===2)w*=1.08}
// Ball Role (GM-set, per player): Dominant genuinely runs the ball through
// them more. Off-Ball trades shot volume for accuracy (below) — fewer
// touches here, a real 3PT accuracy bump in simP()'s acc formula.
if(p.ball_role==='dominant')w*=1.2
else if(p.ball_role==='off_ball')w*=0.85
// Out-of-position players are genuinely less likely to be the guy taking
// the shot, not just less accurate when they do (see posFitMult in acc too).
w*=(p.posFitMult??1)
// pS()'s pool is every player with mins>0 on the team, not just whoever
// onCourtFive() drew for this exact possession (that's a separate, cosmetic
// +/- bookkeeping draw) — so without this, an 8-minute bench player and a
// 48-minute starter competed for literally every possession of the whole
// game on equal footing. Floored (not zeroed) so a real 1-2 minute garbage-
// time cameo still gets an occasional look — but the floor used to be .35,
// which inflated a 2-minute player (true share 2/48=.04) up to a weight
// equivalent to a ~17-minute rotation player, producing box scores like
// 6 shot attempts in 2 minutes. .04 keeps mins genuinely proportional for
// anyone playing more than a couple of minutes.
w*=Math.max(.04,(p.mins||0)/48)
// A real incident: LaMelo Ball took 49 shot attempts in 34 minutes and
// scored 70 in one game — the momentum term just above (mom*streaky) is a
// self-reinforcing loop (hit shots -> more weight AND better acc() next
// possession -> hit more shots -> even more weight...) with nothing to
// stop it from running away for an entire game. Same fix as
// rebTaper/astTaper: taper a player's own shot-selection weight down once
// HIS OWN attempts this game climb past a normal monster-game level — a
// defense keys on a red-hot scorer harder as the game goes on. Only
// redistributes shots to the same on-court pool, never touches the team's
// total FGA.
w*=scoreTaper(st?.[p.id]?.fga||0,p.mins||0)
w*=pointsTaper(st?.[p.id]?.pts||0,p.mins||0,p.scoring)
// Points and assists were only ever tapered against THEMSELVES, so a
// player could independently max out both in the same game without either
// taper ever noticing the other — a real incident: 41 points AND 14
// assists in just 21 minutes, a combined scoring+playmaking rate no real
// NBA game produces (a player spending his touches creating shots for
// others isn't simultaneously the one taking 20+ of his own). Cross-
// applying astTaper here means a player who's already piling up assists
// this game becomes less likely to also be the shooter, the same shared-
// usage-budget idea real basketball roles already impose.
w*=astTaper(st?.[p.id]?.ast||0,p.mins||0)
// Coefficient cut from .15 to .08 — a maxed-out streaky=100 player sitting
// at mom=3 was getting a flat +45% shot-selection weight on top of an
// already-legit star's higher base weight AND his top-3-usage priority
// bump, compounding into a real shot monopoly on possession-picking, not
// just a hot-hand flavor bump. At .08 the same maxed case tops out at +24%
// (an average streaky=50 player, +12%) — still rewards a real streak,
// no longer able to crowd out the rest of the lineup's touches.
return{p,w:Math.max(.5,w*(1+mom[p.id]*(p.streaky/100)*.08)*(.5+f*.5))}
})
return wtCapped(weighted)
}

function simFT(p:any,n:number,fat:Record<string,number>){let m=0;for(let i=0;i<n;i++)if(Math.random()<p.ft/100*(.88+fat[p.id]/100*.12))m++;return m}

function simP(ot:any,dt:any,ops:any[],dps:any[],oo:any,doo:any,sc:any,st:any,fat:any,mom:any,ls:any,part:any,isC:boolean,os:"home"|"away",ds:"home"|"away",q:number,tl:number,pbp:any[],teamFouls:{home:number,away:number}){
if(!ops.length||!dps.length)return
// The GM-facing Three-Point Rate slider (0-80, gm/orders page) is labeled
// "% of possessions ending in a 3PT attempt" — but this used to run the
// value through r3p(v)=(20+v*0.22)/100 first, silently reinterpreting it
// (the default 38 became 28.4%, not 38%). Real incident: Bruno's real NBA
// reference (37 3PA / ~87 FGA = 42.6% of shots from three) vs. our
// simulated league's actual 27.1% — the accuracy (3P%) was already right,
// this frequency mismatch was the real gap. Now uses the slider value
// directly, matching what the UI already promises the GM.
const u3=Math.random()<(oo.three_rate||oo.threeRate||47)/100
const shotProfile=SHOT_PROFILE_BY_ATK_STYLE[oo.atk_style]||SHOT_PROFILE_BY_ATK_STYLE.motion
const isMid=!u3&&Math.random()<shotProfile.mid,isPost=!u3&&!isMid&&Math.random()<shotProfile.post
const sc2=pS(ops,oo,u3,isC,fat,mom,st)
if(!sc2)return
// Lockdown Defender: a GM-assigned individual matchup, no penalty elsewhere
// (unlike Double Team) — if the locked-down player has the ball and his
// assigned defender is actually on the floor, that defender guards him,
// full stop, instead of the usual random weighted pick.
const lockDef=doo.lockdown_target&&sc2.name===doo.lockdown_target?dps.find((p:any)=>p.name===doo.lockdown_defender&&p.mins>0&&!p.ejected):null
const def=lockDef||wt(dps.map(p=>({p,w:((p.idef+p.pdef)/2*.5+20)*Math.max(.04,(p.mins||0)/48)*foulTaper(st[p.id]?.pf||0)})))
if(!def)return
const ss=st[sc2.id],ds2=st[def.id],fs=fat[sc2.id]/100
fat[sc2.id]=Math.max(40,fat[sc2.id]-(14/sc2.stamina)*.7*1.2)
fat[def.id]=Math.max(40,fat[def.id]-(14/def.stamina)*.7)

// Common/non-shooting foul (reach-in, illegal screen, loose ball) — a real,
// distinct foul type from the shooting foul below. Real NBA rule: a common
// foul only sends the other team to the line once the fouling team is
// already in the bonus (5+ team fouls this quarter); before that it's just
// a whistle with no free throws, which the engine previously had no way to
// model at all (its only foul mechanic was the shooting foul, so ~every
// foul used to award FT). Rolled once per possession, independent of the
// shot itself — real refFoulMult (crew-chief tendency) still applies, same
// as every other foul roll here.
const refFoulMultForCommon=(oo.referee||doo.referee)?((oo.referee||doo.referee).foul_rate/100*.6+.7):1
if(Math.random()<NONSHOOTING_FOUL_CHANCE*refFoulMultForCommon){
teamFouls[ds]=(teamFouls[ds]||0)+1
ds2.pf++
foulOutCheck(def,ds2,dt,dps,q,tl,pbp,sc)
foulTroubleCheck(def,ds2,dt,dps,q,tl,pbp,sc)
if(teamFouls[ds]>=5){
// Who gets fouled here is picked flat by minutes played, not reusing sc2
// (this possession's already scoring-weighted shooter) — a common/reach-in
// foul happens to whoever's bringing the ball up or setting a screen, not
// disproportionately the primary scorer. Reusing sc2 here compounded with
// his already-elevated shooting-foul rate to produce real outliers (a
// 28-FTA game for a single high-usage star during calibration).
const fouled=wt(ops.filter((p:any)=>p.mins>0).map((p:any)=>({p,w:p.mins||1})))||sc2
const f=simFT(fouled,2,fat);sc[os]+=f;st[fouled.id].pts+=f;st[fouled.id].ftm+=f;st[fouled.id].fta+=2;st[fouled.id].fd++
pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"freethrow",description:`${dt.name} in the penalty — ${fouled.name} shoots 2 — ${f}/2 FTs`,home_score:sc.home,away_score:sc.away})
}else{
pbp.push({quarter:q+1,time_left:fmt(tl),team_id:dt.id,event_type:"foul",description:`Foul on ${def.name}`,home_score:sc.home,away_score:sc.away})
}
return
}

// Real matchup: this attacking style vs. this defensive style, adjusted by
// each side's Pace synergy and dampened/sharpened by each Head Coach's
// off_adjustment/def_adjustment.
const tacticalMods:TacticalMods=oo.tacticalMods||NEUTRAL_TACTICAL_MODS
// The defending side's OWN tactical development (their trained rebounding-
// related nodes) still shapes how well THEY box out on D, independent of
// which side is attacking this particular possession.
const defTacticalMods:TacticalMods=doo.tacticalMods||NEUTRAL_TACTICAL_MODS
const matchupBase=(ATK_DEF_MATCHUP[oo.atk_style]?.[doo.def_style]??1.0)*paceSynergy(oo.atk_style,(oo.pace||70)*tacticalMods.paceMult)*paceSynergy(doo.def_style,doo.pace||70)
const mDev=matchupBase-1
const offDamp=coachDampen(oo.off_adjustment),defDamp=coachDampen(doo.def_adjustment)
const dampenFactor=Math.max(0,1+(mDev>0?offDamp-defDamp:defDamp-offDamp))
// Tactical System Familiarity: how well-drilled the offense is in ITS OWN
// chosen system claws back (or, if neglected, gives up) a real chunk of the
// on-paper matchup — "even with a real counter" a highly-familiar team can
// partly overcome it, per src/lib/tactical-constants.ts.
const matchupMult=(1+mDev*dampenFactor)*tacticalMatchupMult(oo,doo.def_style)

// Double Team: a GM can commit extra defenders to the opponent's most
// dangerous player. Smothers him if he's the one shooting, but stretches
// the defense thin against everyone else — a real risk/reward, and wasted
// entirely if the named target isn't even on the floor.
const dtTarget=doo.double_team_target
const isDoubled=!!dtTarget&&sc2.name===dtTarget
const dtOnCourt=!!dtTarget&&ops.some((p:any)=>p.name===dtTarget&&p.mins>0&&!p.ejected)
const dtMult=isDoubled?0.80:(dtOnCourt?1.08:1.0)

// Home court: a structural edge for the home team that grows with a fuller
// arena (attRate 0-1, attached to the home side's order object). Crowd
// effect: a player's OWN crowd_effect (1-98) shifts them up or down from a
// neutral midpoint of 50 — players on either team can feed off a loud
// building, not just the home side.
const attRate=oo.attRate??doo.attRate??0.75
const homeBoost=os==="home"?1.00+attRate*0.12:1.0
const crowdMult=1+((sc2.crowd_effect??50)-50)/50*0.06*attRate
const decisive=!!(oo.decisive||doo.decisive)
// Mental Coach's composure_coaching dampens exactly how much clutch/decisive
// pressure costs the shooter's team — a great one keeps a team composed
// late in close games instead of tightening up. Tactical clutchMult (from
// mastered "closer instinct"/"4th quarter burst"-type nodes) sharpens the
// decisive-moment case specifically. The Head Coach's timeout_mgmt adds a
// second, real-time-management lever alongside composure — same capped
// shape and magnitude as composureDampen (reusing cohesionDampen's generic
// custom-cap signature rather than a near-duplicate function), representing
// smart timeout calls stabilizing the team when it matters most.
const pressureMult=isC?(decisive?(.75+(sc2.pressure/100)*.45)*tacticalMods.clutchMult:(.82+(sc2.pressure/100)*.32))+composureDampen(oo.composure)+cohesionDampen(oo.timeout_mgmt,0.12):1
// Referee crew chief (same one for both sides — assigned to the game ahead
// of time, not rolled per possession): foul_rate scales how often fouls
// actually get whistled, home_bias tilts that rate slightly toward whichever
// side is home, crowd_error_rate makes him call noticeably more once the
// building is genuinely packed (attRate>0.75) — real home-crowd data, not an
// invented number.
// refFoulRate span narrowed .7-1.3 -> .85-1.15 and refCrowdErr's coefficient
// halved 1.2->0.6 — this per-ref multiplier applies to EVERY shot for the
// WHOLE game for both teams, so the two compounding at their extremes (a
// whistle-happy ref like Scott Foster in a packed arena) pushed the entire
// game's foul-drawing chance up 30-40% across the board. SHOOTING_FOUL_CAP
// already caps any ONE shot's chance, but that doesn't stop MANY shots each
// getting pushed up toward that same cap — a real incident: 76-83 combined
// FTA in a single game (verified this was a testing gap, not a fixed bug —
// earlier verification never actually included a real assigned referee, so
// it never exercised this multiplier at all).
const ref=oo.referee||doo.referee
const refFoulRate=ref?(.85+(ref.foul_rate/100)*.3):1
const refHomeSkew=ref?((ref.home_bias-50)/50)*.08:0
const refCrowdErr=ref?1+Math.max(0,attRate-0.75)*(ref.crowd_error_rate/100)*.6:1
const refFoulMult=ref?refFoulRate*(1+(os==='home'?refHomeSkew:-refHomeSkew))*refCrowdErr:1
// An unhappy player is genuinely a worse shooter, not just a contract/morale
// abstraction — a real but modest effect (moral 0 -> 0.92x, moral 100 -> 1.00x),
// same calibration scale as every other multiplier here.
const moralMult=.92+(sc2.moral??80)/100*.08

if(Math.random()<(.115+(100-(sc2.siq+sc2.pass_iq+sc2.ball_hdl)/3)*.0021+(isDoubled?0.04:0))*(1-cohesionDampen(oo.cohesion,0.2))*tacticalMods.toMult){ss.to++;ss.turnovers++;const st3=wt(dps.map(p=>({p,w:(p.stl*.5+20)*Math.max(.04,(p.mins||0)/48)})));
// A forced turnover only becomes a real credited steal (vs. just a live-
// ball TO) if the defender converts it — Steal Rate (hidden) is now the
// SOLE driver of how often that happens, same volume/quality split as
// every other rate attribute here. stl/speed/agility (quality — being
// quick enough to actually close and jump the lane) stay a real but
// secondary multiplier instead of driving frequency themselves.
const stealVol=Math.max(.1,spg36(st3.steal_rate))
const stealQualityMult=0.7+((st3.stl??50)/100)*.2+(((st3.speed??50)+(st3.agility??50))/200)*.1
if(Math.random()<Math.min(1,stealVol/1.4)*1.0*stealQualityMult)st[st3.id].stl++;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"turnover",description:`${st3.name} steals from ${sc2.name}`,home_score:sc.home,away_score:sc.away});return}
if(!u3&&Math.random()<bpg36(def.blk)*.145*(doo.def_style==='zone23'?.5:1)*refFoulMult){ds2.blk++;if(Math.random()<.14){ds2.pf++;foulOutCheck(def,ds2,dt,dps,q,tl,pbp,sc);foulTroubleCheck(def,ds2,dt,dps,q,tl,pbp,sc);ss.fd++;teamFouls[ds]=(teamFouls[ds]||0)+1;const f=simFT(sc2,2,fat);sc[os]+=f;ss.pts+=f;ss.ftm+=f;ss.fta+=2;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"freethrow",description:`Block foul on ${sc2.name} — ${f}/2 FTs`,home_score:sc.home,away_score:sc.away})}else{
// A blocked shot almost always stays inbounds — real box scores still
// credit someone with the rebound, same OREB/DREB split as any other miss
// (mostly the defense, sometimes the shooting team recovers the carom).
// This used to just vanish (possession ends, nobody gets a rebound stat),
// quietly undercounting team REB by exactly the number of blocks in the game.
if(Math.random()<.27){const rb=wtCapped(ops.filter(p=>p.mins>0).map(p=>({p,w:(Math.max(.3,rpg36(p.reb_rate)-1)*(0.5+offReboundShare(p))*7*tacticalMods.offRebMult*(0.7+(p.strength??50)/100*.3)+2)*Math.max(.04,(p.mins||0)/48)*rebTaper(st[p.id]?.reb||0,p.mins||0)})),.45);st[rb.id].or++;st[rb.id].reb++}
else{const rb=wtCapped(dps.map(p=>({p,w:(Math.max(.3,rpg36(p.reb_rate)-1)*(0.5+defReboundShare(p))*7*defTacticalMods.defRebMult*(doo.lockdown_target&&p.name===doo.lockdown_defender?0.8:1)*(0.7+(p.strength??50)/100*.3)+2)*Math.max(.04,(p.mins||0)/48)*rebTaper(st[p.id]?.reb||0,p.mins||0)})),.45);st[rb.id].dr++;st[rb.id].reb++}
pbp.push({quarter:q+1,time_left:fmt(tl),team_id:dt.id,event_type:"block",description:`BLOCK by ${def.name} on ${sc2.name}!`,home_score:sc.home,away_score:sc.away})
};return}
ss.fga++;if(u3)ss.tpa++
const offBallMult=(u3&&sc2.ball_role==='off_ball')?1.08:1.0
// Tactical shot-zone bonus — which multiplier applies depends on shot type;
// bigThreeMult/lobMult add on top for a big man (C/PF) specifically, per
// the Pick & Pop / Lob to the Screener node themes.
const isBig=sc2.pos==='C'||sc2.pos==='PF'
const tacticalShotMult=u3?tacticalMods.threeMult*(isBig?tacticalMods.bigThreeMult:1):isPost?tacticalMods.postMult:isMid?tacticalMods.midMult:tacticalMods.rimMult*(isBig?tacticalMods.lobMult:1)
// Rim finishing blends layup/dunk with close_shot (floaters/short touch
// shots complementing them) — a third real finishing input, not just the
// two that already carried this term.
const rimSkill=(sc2.layup+sc2.dunk+(sc2.close_shot??sc2.layup))/300
// pointsTaper/scoreTaper above only ever throttle shot-selection WEIGHT
// (how often this player gets picked next) — accuracy was never touched, so
// on a short stint a player could still convert his handful of remaining
// looks at his full, undiminished shooting% even after tapering had already
// floored his weight. With so few total possessions in a short stint, that
// floored weight barely gets a chance to act before the game (for him) is
// over — a real incident: 12 points in 8 minutes (54 ppg36 pace), 31 in 18
// (62 ppg36), both from players who were already deep in taper territory by
// the time they got there. This adds a real, modest accuracy cost once a
// player is deep in his own points taper (defenses genuinely key harder on
// someone who's already well past his normal pace) — capped at a 12%
// haircut, not a hard shutoff, so a real hot game can still happen, just
// not an outright statistically-impossible one.
const hotHandAccDamp=0.80+0.20*pointsTaper(st[sc2.id]?.pts||0,sc2.mins||0,sc2.scoring)
const acc=Math.min(.74,Math.max(.18,(u3?.355+(sc2.three-50)/100*.20:isPost?.47:isMid?.43+(sc2.mid-50)/100*.10:.535+rimSkill*.18)*(.84+fs*.16)*(1-(u3?def.pdef:def.idef)/100*.14)*(.9+(sc2.consistency/100)*.15)*pressureMult*matchupMult*dtMult*homeBoost*crowdMult*offBallMult*moralMult*tacticalShotMult*(sc2.posFitMult??1)*usageEffMult(st[sc2.id]?.fga||0)*teamSpacingMult(sc2,ops)*hotHandAccDamp))
const makes=Math.random()<acc
const lsi=ls[sc2.id];lsi.push(makes?1:0);if(lsi.length>4)lsi.shift()
const r2=lsi.reduce((a:number,b:number)=>a+b,0),st4=sc2.streaky/100
if(lsi.length>=3){if(r2>=3)mom[sc2.id]=Math.min(3,mom[sc2.id]+(makes?1:0)*st4*2);else if(r2<=1)mom[sc2.id]=Math.max(-3,mom[sc2.id]+(makes?0:-1)*st4*2);else mom[sc2.id]*=.6}
// Free Throw Rate (hidden) is now the SOLE driver of how often a shot
// attempt turns into a trip to the line — draw_foul (secondary quality,
// same span as stealQualityMult below) still nudges it, but no longer
// sets the base rate on its own, same volume/quality split as every other
// rate attribute here.
const foulDrawQualityMult=0.85+(sc2.draw_foul/100)*.3
// The cap MUST wrap the fully-combined probability, not just the base
// frequency term — capping only ftpg36(...)*FT_RATE_K and then still
// multiplying the (already-capped) result by foulDrawQualityMult*
// refFoulMult*tacticalMods.foulDrawMult let the real per-shot chance climb
// well past the intended ceiling (a maxed-out free_throw_rate/draw_foul
// player with a whistle-happy ref could clear 90%+ per shot attempt —
// exactly how a single game produced 18 FTA in 32 minutes). Capped at
// SHOOTING_FOUL_CAP now, after every multiplier has already applied.
const shootingFoulChance=Math.min(SHOOTING_FOUL_CAP,ftpg36(sc2.free_throw_rate)*FT_RATE_K*foulDrawQualityMult*refFoulMult*tacticalMods.foulDrawMult*ftTaper(ss.fta||0,sc2.mins||0))
if(Math.random()<shootingFoulChance){ds2.pf++;foulOutCheck(def,ds2,dt,dps,q,tl,pbp,sc);foulTroubleCheck(def,ds2,dt,dps,q,tl,pbp,sc);ss.fd++;teamFouls[ds]=(teamFouls[ds]||0)+1;if(makes){ss.fgm++;if(u3)ss.tpm++;const pts=u3?3:2;sc[os]+=pts;ss.pts+=pts;part[os]+=pts;(part as any)[ds]=0;const ap2=ops.filter(p=>p.id!==sc2.id&&p.mins>0);if(ap2.length&&Math.random()<(.40+cohesionDampen(oo.cohesion,0.12))*tacticalMods.astMult){const ast=wtCapped(ap2.map(p=>({p,w:(Math.max(.3,apg36(p.assist_rate)-1)*(0.7+(p.assist_role??50)/100*.3+(p.pass_vis??50)/100*.3))*Math.max(.04,(p.mins||0)/48)*astTaper(st[p.id]?.ast||0,p.mins||0)*pointsTaper(st[p.id]?.pts||0,p.mins||0,p.scoring)})),.45);st[ast.id].ast++}const f=simFT(sc2,1,fat);sc[os]+=f;ss.pts+=f;ss.ftm+=f;ss.fta++;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"score",description:`${sc2.name} scores and draws foul! (${pts}+${f})`,home_score:sc.home,away_score:sc.away})}else{const fc=u3?3:2;const f=simFT(sc2,fc,fat);sc[os]+=f;ss.pts+=f;ss.ftm+=f;ss.fta+=fc;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"freethrow",description:`${sc2.name} to the line — ${f}/${fc}`,home_score:sc.home,away_score:sc.away})};return}
if(makes){ss.fgm++;if(u3)ss.tpm++;const pts=u3?3:2;sc[os]+=pts;ss.pts+=pts;part[os]+=pts;(part as any)[ds]=0;const ap2=ops.filter(p=>p.id!==sc2.id&&p.mins>0);if(ap2.length&&Math.random()<(.78+cohesionDampen(oo.cohesion,0.12))*tacticalMods.astMult){const ast=wtCapped(ap2.map(p=>({p,w:(Math.max(.3,apg36(p.assist_rate)-1)*(0.7+(p.assist_role??50)/100*.3+(p.pass_vis??50)/100*.3))*Math.max(.04,(p.mins||0)/48)*astTaper(st[p.id]?.ast||0,p.mins||0)*pointsTaper(st[p.id]?.pts||0,p.mins||0,p.scoring)})),.45);st[ast.id].ast++}const shot=u3?"three-pointer":isPost?"hook shot":isMid?"mid-range jump shot":mom[sc2.id]>=2?"slam dunk":"driving layup";pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"score",description:`${sc2.name} — ${shot}${mom[sc2.id]>=2.5?" 🔥 ON FIRE!":""}! ${pts}pts`,home_score:sc.home,away_score:sc.away})}
else{if(Math.random()<.27){
// Boxing out for an offensive rebound is a real strength contest, not just
// a skill (off_reb) roll — a secondary, smaller weight so off_reb still
// decides most of the time.
const rb=wtCapped(ops.filter(p=>p.mins>0).map(p=>({p,w:(Math.max(.3,rpg36(p.reb_rate)-1)*(0.5+offReboundShare(p))*7*tacticalMods.offRebMult*(0.7+(p.strength??50)/100*.3)+2)*Math.max(.04,(p.mins||0)/48)*rebTaper(st[p.id]?.reb||0,p.mins||0)})),.45);st[rb.id].or++;st[rb.id].reb++;const re=pS(ops,oo,false,false,fat,mom,st);if(re){st[re.id].fga++;
// Putback chance: whoever ends up with the loose ball finishes it better
// the more of a standing-dunk finisher they are — real range around the
// old flat 50%, not a fixed coin flip regardless of who's shooting.
if(Math.random()<.35+((re.standing_dunk??50)/100)*.30){st[re.id].fgm++;sc[os]+=2;st[re.id].pts+=2;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"score",description:`OFF rebound ${rb.name} → ${re.name} scores! 2pts`,home_score:sc.home,away_score:sc.away})}}}else{
// Lockdown Defender's real cost: locked onto one man all game, he crashes
// the defensive glass worse — the "unavailable for help and rebounds"
// tradeoff the rules page already promises.
const rb=wtCapped(dps.map(p=>({p,w:(Math.max(.3,rpg36(p.reb_rate)-1)*(0.5+defReboundShare(p))*7*defTacticalMods.defRebMult*(doo.lockdown_target&&p.name===doo.lockdown_defender?0.8:1)*(0.7+(p.strength??50)/100*.3)+2)*Math.max(.04,(p.mins||0)/48)*rebTaper(st[p.id]?.reb||0,p.mins||0)})),.45);st[rb.id].dr++;st[rb.id].reb++;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"miss",description:`${sc2.name} missed — DEF rebound ${rb.name}`,home_score:sc.home,away_score:sc.away})}}
}

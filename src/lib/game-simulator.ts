// Shared possession-by-possession game engine.
// Extracted from src/app/api/cron/simulate/route.ts so it can be reused
// by the preseason/friendly-game simulator without duplicating this logic.

function rnd(a:number,b:number){return Math.floor(Math.random()*(b-a+1))+a}
function wt(pool:Array<{p:any,w:number}>){
const t=pool.reduce((s,x)=>s+x.w,0);let r=Math.random()*t
for(const x of pool){r-=x.w;if(r<=0)return x.p}
return pool[pool.length-1].p
}
function r3p(v:number){return(20+(v/100)*22)/100}
function fmt(tl:number){return Math.floor(tl/60)+":"+String(tl%60).padStart(2,"0")}

// Maps the in-memory sim state (which uses short internal names like or/dr/fd/to)
// to the actual box_scores column names. Mismatched names here fail an insert
// silently (PostgREST just drops the row) — keep this in sync with the schema.
function toBoxRow(p:any, s:any){
return {
player_id: p.id, mins: p.mins, is_starter: !!p.isStarter,
pts: s.pts||0, ast: s.ast||0, stl: s.stl||0, blk: s.blk||0,
fga: s.fga||0, fgm: s.fgm||0, tpa: s.tpa||0, tpm: s.tpm||0, fta: s.fta||0, ftm: s.ftm||0,
pf: s.pf||0, tech_fouls: s.tf||0, off_reb: s.or||0, def_reb: s.dr||0, reb: (s.or||0)+(s.dr||0),
turnovers: s.to||0, plus_minus: 0,
}
}

// A technical foul counts as a personal foul AND its own separate tally.
// A player's 2nd technical foul in the same game is an automatic ejection —
// same real-world NBA rule. Rolled once per quarter per active player,
// weighted by their trash_talk attribute (hot-headed players pick up more).
function rollTechs(offense:any[],defense:any[],offSide:"home"|"away",defSide:"home"|"away",offTeam:any,sc:any,st:any,q:number,pbp:any[]){
for(const p of offense){
if(p.mins<=0||p.ejected)continue
const chance=0.003+((p.trash_talk??50)/100)*0.012
if(Math.random()>=chance)continue
const s=st[p.id]
s.tf=(s.tf||0)+1;s.pf=(s.pf||0)+1
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

export function simulateGame(ht:any,at:any,hp:any[],ap:any[],hOrd?:any,aOrd?:any){
const defOrd=(ps:any[])=>{const s=[...ps].sort((a,b)=>b.usage-a.usage);return{pris:[s[0]?.name,s[1]?.name,s[2]?.name],clutch:s[0]?.name,pace:70,three_rate:38,atk_style:"motion",def_style:"man"}}
const ho=hOrd||defOrd(hp),ao=aOrd||defOrd(ap)
if(ho.depth_chart)applyDC(hp,ho.depth_chart)
if(ao.depth_chart)applyDC(ap,ao.depth_chart)
const sc={home:0,away:0},st:Record<string,any>={},fat:Record<string,number>={},mom:Record<string,number>={},ls:Record<string,number[]>={},part={home:0,away:0}
const tol={home:{used:0,q:{0:0,1:0,2:0,3:0}} as any,away:{used:0,q:{0:0,1:0,2:0,3:0}} as any}
let isGT=false,gtW=""
const pbp:any[]=[],hb:any[]=[],ab:any[]=[]
;[...hp,...ap].forEach(p=>{st[p.id]={pts:0,or:0,dr:0,ast:0,stl:0,blk:0,fga:0,fgm:0,tpa:0,tpm:0,fta:0,ftm:0,pf:0,tf:0,fd:0,to:0,reb:0,turnovers:0};fat[p.id]=100;mom[p.id]=0;ls[p.id]=[];p.ejected=false})
const pa=(ho.pace+ao.pace)/2,ppq=Math.round(23+pa/100*4)
for(let q=0;q<4;q++){
part.home=0;part.away=0
let side="home"
rollTechs(hp,ap,"home","away",ht,sc,st,q,pbp)
rollTechs(ap,hp,"away","home",at,sc,st,q,pbp)
for(let i=0;i<ppq*2;i++){
const tl=Math.max(0,Math.round(720*(1-i/(ppq*2))))
const diff=Math.abs(sc.home-sc.away)
if(q===3&&!isGT&&((tl<=120&&diff>=20)||(tl<=90&&diff>=15))){isGT=true;gtW=sc.home>sc.away?"home":"away";pbp.push({quarter:q+1,time_left:fmt(tl),team_id:null,event_type:"info",description:`🗑️ GARBAGE TIME — ${isGT&&gtW==="home"?ht.name:at.name} leads by ${diff}!`,home_score:sc.home,away_score:sc.away})}
const isC=q===3&&tl<=120&&diff<=5
const ops=side==="home"?(isGT&&side===gtW?hp.filter(p=>p.mins>0&&!p.ejected).slice(5):hp.filter(p=>p.mins>0&&!p.ejected)):(isGT&&side===gtW?ap.filter(p=>p.mins>0&&!p.ejected).slice(5):ap.filter(p=>p.mins>0&&!p.ejected))
const dps=side==="home"?ap.filter(p=>p.mins>0&&!p.ejected):hp.filter(p=>p.mins>0&&!p.ejected)
const oo=side==="home"?ho:ao,doo=side==="home"?ao:ho
const ot=side==="home"?ht:at,dt=side==="home"?at:ht
const os=side as "home"|"away",ds=(side==="home"?"away":"home") as "home"|"away"
if((part[ds] as number)>=8&&tol[os].q[q]<2&&tol[os].used<7){tol[os].q[q]++;tol[os].used++;part.home=0;part.away=0;pbp.push({quarter:q+1,time_left:fmt(tl),team_id:ot.id,event_type:"timeout",description:`⏱ TIMEOUT — ${ot.name}`,home_score:sc.home,away_score:sc.away})}
simP(ot,dt,ops,dps,oo,doo,sc,st,fat,mom,ls,part,isC,os,ds,q,tl,pbp)
side=side==="home"?"away":"home"
}
}
// Everyone gets a row now — 0-min players show up as DNP-Coach's Decision
// in the box score UI instead of silently vanishing.
hp.forEach(p=>hb.push(toBoxRow(p,st[p.id])))
ap.forEach(p=>ab.push(toBoxRow(p,st[p.id])))
return{homeScore:sc.home,awayScore:sc.away,homeBox:hb,awayBox:ab,pbp}
}

function applyDC(players:any[],dc:any){
players.forEach(p=>{p.mins=0;p.isStarter=false})
;["PG","SG","SF","PF","C"].forEach(pos=>{
const pd=dc[pos];if(!pd)return
;["s","b1","b2"].forEach(sl=>{const e=pd[sl];if(e?.name&&e.mins>0){const p=players.find((pl:any)=>pl.name===e.name);if(p){p.mins+=e.mins;if(sl==="s")p.isStarter=true}}})
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

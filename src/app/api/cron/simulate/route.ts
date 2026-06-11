import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Called by Vercel Cron every Monday and Thursday at midnight Lisbon time
// Configure in vercel.json: {"crons": [{"path": "/api/cron/simulate", "schedule": "0 0 * * 1,4"}]}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { data: cfg } = await supabaseAdmin.from('season_config').select('*').eq('id',1).single()
    if (!cfg || cfg.status !== 'active') return NextResponse.json({ message: 'Season not active' })
    const week = cfg.current_week + 1

    const { data: teams } = await supabaseAdmin.from('teams').select('*')
    if (!teams || teams.length < 2) return NextResponse.json({ error: 'Not enough teams' }, { status:500 })

    const { data: orders } = await supabaseAdmin.from('gm_orders').select('*').eq('week_number', week)
    const orderMap: Record<string, any> = {}
    ;(orders||[]).forEach((o:any) => orderMap[o.team_id] = o)

    // Round-robin: each team plays 4 games per week
    const shuffled = [...teams].sort(() => Math.random() - 0.5)
    const pairs: Array<[any,any]> = []
    for (let i=0; i<shuffled.length-1; i+=2) pairs.push([shuffled[i], shuffled[i+1]])
    const allPairs = [...pairs, ...pairs]  // 4 games per team

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

      const { data: gameRec } = await supabaseAdmin.from('games').insert({
        week_number: week, game_number: gi+1,
        home_team: ht.id, away_team: at.id,
        home_score: result.homeScore, away_score: result.awayScore,
        status: 'final', played_at: new Date().toISOString(),
      }).select().single()
      if (!gameRec) continue
      gamesSimulated++
gamesCreated.push(gameRec.id)

      await supabaseAdmin.from('box_scores').insert([
        ...result.homeBox.map((b:any) => ({ ...b, game_id: gameRec.id, team_id: ht.id })),
        ...result.awayBox.map((b:any) => ({ ...b, game_id: gameRec.id, team_id: at.id })),
      ])
      if (result.pbp.length > 0) {
        await supabaseAdmin.from('play_by_play').insert(result.pbp.map((p:any) => ({ ...p, game_id: gameRec.id })))
      }

      const hWon = result.homeScore > result.awayScore
      await Promise.all([
        supabaseAdmin.from('teams').update({
          wins: ht.wins+(hWon?1:0), losses: ht.losses+(hWon?0:1),
          pts_for: ht.pts_for+result.homeScore, pts_against: ht.pts_against+result.awayScore,
        }).eq('id', ht.id),
        supabaseAdmin.from('teams').update({
          wins: at.wins+(hWon?0:1), losses: at.losses+(hWon?1:0),
          pts_for: at.pts_for+result.awayScore, pts_against: at.pts_against+result.homeScore,
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

    // Get injury types once
    const { data: injTypes } = await supabaseAdmin.from('injury_types').select('*')
    const SMOD: Record<string,number> = {minor:1.1,moderate:1.25,serious:1.5,severe:1.75,career_threatening:2.0}
    const SWEIGHTS: Record<string,number> = {minor:40,moderate:25,serious:15,severe:8,career_threatening:2}

    // Collect all box scores from this week's games
    const { data: weekBoxes } = await supabaseAdmin
      .from('box_scores').select('player_id,mins,team_id,game_id')
      .in('game_id', gamesCreated)

    // Get orders for pace info
    const { data: weekOrders } = await supabaseAdmin.from('gm_orders').select('team_id,pace,training_intensity').eq('week_number',week)
    const paceMap: Record<string,number> = {}
    ;(weekOrders||[]).forEach((o:any) => paceMap[o.team_id] = o.pace||70)

    // Process each player's boxes
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

    // Apply health updates and check for injuries
    for (const [pid, upd] of Object.entries(healthUpdates)) {
      const p = playerMap[pid]
      if (!p) continue
      const newHealth = Math.round(Math.max(0, upd.health))

      // Injury probability check
      const durFactor = (p.durability||75) / 100
      const hFactor = newHealth < 70 ? 1.5 : newHealth < 85 ? 1.2 : 1.0
      const pace = paceMap[p.team_id]||70
      const injChance = 0.018 * (1/durFactor) * hFactor * (pace>80?1.3:1.0)

      if (Math.random() < injChance && injTypes && injTypes.length > 0) {
        // Pick weighted random injury
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
        const injMoral  = Math.max(0, (upd.moral||80)-(chosen.moral_impact||0))
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
        // No new injury — just update health
        const moralDelta = 0  // morale handled separately
        await supabaseAdmin.from('players').update({ health:newHealth }).eq('id',pid)
      }
    }

    // Morale: starters (>20 mins) get +2 for win, -1 for loss
    for (const box of (weekBoxes||[])) {
      if (box.mins < 20) continue
      const p = playerMap[box.player_id]
      if (!p) continue
      // Determine if player's team won — find game result
      // (simplified: we track this via gamesCreated earlier — skip for now, handled per game)
    }

    // Call recovery API for days between games
    // (Mon sim = 3 rest days since Thu | handled by separate recovery cron)

    await supabaseAdmin.from('season_config').update({ current_week: week }).eq('id',1)
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

      // Build coach bonuses per team
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

      // Training intensity development modifier
      const TRAIN_DEV: Record<string,number> = {rest:-0.5,light:0.5,normal:1.0,intense:1.5,very_intense:1.8}

      const ATTRS = ['three','layup','dunk','mid','ft','siq','draw_foul','blk','stl',
        'idef','pdef','def_reb','off_reb','stamina','durability',
        'ball_hdl','pass_vis','pass_iq','pressure','consistency','assist_role']

      const OFF_ATTRS = new Set(['three','layup','dunk','mid','ft','siq','draw_foul'])
      const DEF_ATTRS = new Set(['blk','stl','idef','pdef'])
      const PHYS_ATTRS = new Set(['stamina','durability','def_reb','off_reb'])
      const PLAY_ATTRS = new Set(['ball_hdl','pass_vis','pass_iq','assist_role'])

      const SPECIALTY_MAP: Record<string,string[]> = {
        offense:     ['three','mid','layup','dunk','siq'],
        defense:     ['blk','stl','idef','pdef'],
        shooting:    ['three','mid','ft'],
        playmaking:  ['ball_hdl','pass_vis','pass_iq','assist_role'],
        bigs:        ['blk','def_reb','off_reb','idef','dunk'],
      }

      const { data: weekOrds3 } = await supabaseAdmin.from('gm_orders').select('team_id,training_intensity,pace').eq('week_number',week)
      const ordMap3: Record<string,any> = {}
      ;(weekOrds3||[]).forEach((o:any) => ordMap3[o.team_id]=o)

      for (const p of (allPlayers3||[])) {
        const ord = ordMap3[p.team_id] || {training_intensity:'normal'}
        const coach = coachBonus[p.team_id] || {dev:60,off:60,def:60,conditioning:60,specialties:{}}
        const trainMod = TRAIN_DEV[ord.training_intensity||'normal'] || 1.0
        const coachDevMod = (coach.dev - 60) / 100  // -0.4 to +0.4
        const moralMod = ((p.moral||80) - 80) / 200  // -0.4 to +0.1
        const ageFactor = p.age <= 22 ? 1.5 : p.age <= 25 ? 1.2 : p.age <= 28 ? 1.0 : p.age <= 31 ? 0.7 : p.age <= 34 ? 0.3 : 0.0
        const healthMod = (p.health||100) < 60 ? 0 : (p.health||100) < 80 ? 0.5 : 1.0
        const devRate = (p.dev_rate||1.0) * ageFactor * healthMod

        const updates: Record<string,number> = {}
        const devLogs: any[] = []

        for (const attr of ATTRS) {
          const curr = (p as any)[attr] || 0
          const pot  = (p as any)[`pot_${attr}`] || curr
          if (curr >= pot) continue  // already at ceiling

          // Base growth chance
          let growthChance = 0.15 * trainMod * (1 + coachDevMod) * devRate

          // Coach specialty bonus
          const specialty = Object.entries(coach.specialties).find(([sp]) => SPECIALTY_MAP[sp]?.includes(attr))
          if (specialty) growthChance *= (1 + specialty[1]/100)

          // Coach IQ bonus per category
          if (OFF_ATTRS.has(attr))  growthChance *= (1 + (coach.off-60)/200)
          if (DEF_ATTRS.has(attr))  growthChance *= (1 + (coach.def-60)/200)
          if (PHYS_ATTRS.has(attr)) growthChance *= (1 + (coach.conditioning-60)/200)

          // Morale affects development
          growthChance *= (1 + moralMod)

          if (Math.random() < growthChance) {
            const gain = Math.min(2, Math.max(1, Math.round(devRate * trainMod)))
            const newVal = Math.min(pot, curr + gain)
            if (newVal > curr) {
              updates[attr] = newVal
              devLogs.push({ player_id:p.id, season:'2025-26', week_number:week, attribute:attr, old_value:curr, new_value:newVal, change:newVal-curr, reason:`training_${ord.training_intensity||'normal'}` })
            }
          }

          // Age-related decline for old players
          if (p.age > 34 && Math.random() < 0.08) {
            const decline = -1
            const newVal = Math.max(30, curr + decline)
            if (newVal < curr) {
              updates[attr] = newVal
              devLogs.push({ player_id:p.id, season:'2025-26', week_number:week, attribute:attr, old_value:curr, new_value:newVal, change:decline, reason:'age_decline' })
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

    // Apply health recovery for days since last game
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
      // TO check
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

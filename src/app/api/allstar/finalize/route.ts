import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const SEASON = '2025-26'
  const POSITIONS = ['PG','SG','SF','PF','C']
  const CONFS = ['Eastern','Western']

  const { data: sc } = await supabaseAdmin.from('season_config').select('current_week').eq('id',1).single()
  const currentWeek = sc?.current_week || 0
  const expectedGames = Math.round((Math.min(currentWeek,13)/26)*82)
  const minGames = Math.floor(expectedGames*0.75)

  const { data: allTeams } = await supabaseAdmin.from('teams').select('id,conference')
  const teamConf: Record<string,string> = {}
  ;(allTeams||[]).forEach((t:any) => teamConf[t.id] = t.conference)

  const { data: players } = await supabaseAdmin
    .from('players').select('id,name,pos,team_id,status,player_stats(games,pts,reb,ast)')
    .eq('status','active')

  const eligible = (players||[]).filter((p:any) => (p.player_stats?.[0]?.games||0) >= minGames)

  // Auto-vote for GMs who didn't vote
  const { data: existingVotes } = await supabaseAdmin.from('allstar_votes').select('gm_team_id').eq('season',SEASON)
  const votedTeams = new Set((existingVotes||[]).map((v:any) => v.gm_team_id))
  const autoRows: any[] = []

  for (const conf of CONFS) {
    const confEl = eligible.filter((p:any) => teamConf[p.team_id]===conf)
    for (const pos of POSITIONS) {
      const top2 = confEl
        .filter((p:any) => p.pos===pos||(pos==='SF'&&p.pos==='PF')||(pos==='PF'&&p.pos==='SF'))
        .map((p:any) => { const s=p.player_stats?.[0]||{}; const gp=Math.max(1,s.games||1); return {...p,score:(s.pts/gp)*0.5+(s.reb/gp)*0.25+(s.ast/gp)*0.25} })
        .sort((a:any,b:any) => b.score-a.score).slice(0,2)
      for (const t of (allTeams||[]).filter((t:any)=>!['ALL','RVS'].includes(t.id)&&!votedTeams.has(t.id))) {
        for (const p of top2) {
          autoRows.push({ gm_team_id:t.id, season:SEASON, conference:conf, position:pos, player_id:p.id, is_auto:true })
        }
      }
    }
  }
  if (autoRows.length>0) await supabaseAdmin.from('allstar_votes').upsert(autoRows,{onConflict:'gm_team_id,season,conference,position,player_id'})

  // Tally
  const { data: allVotes } = await supabaseAdmin.from('allstar_votes').select('*').eq('season',SEASON)
  const tally: Record<string,Record<string,Record<string,number>>> = {}
  ;(allVotes||[]).forEach((v:any) => {
    if(!tally[v.conference])tally[v.conference]={}
    if(!tally[v.conference][v.position])tally[v.conference][v.position]={}
    tally[v.conference][v.position][v.player_id]=(tally[v.conference][v.position][v.player_id]||0)+1
  })

  // Build roster
  const rosterRows: any[] = []
  for (const conf of CONFS) {
    const starters: string[] = []
    const allCands: {pid:string,votes:number,pos:string}[] = []
    for (const pos of POSITIONS) {
      const posV = tally[conf]?.[pos]||{}
      const sorted = Object.entries(posV).sort((a,b)=>(b[1] as number)-(a[1] as number))
      for (const [pid,cnt] of sorted) {
        if (!starters.includes(pid) && eligible.find((p:any)=>p.id===pid)) {
          starters.push(pid)
          rosterRows.push({ season:SEASON,conference:conf,player_id:pid,position:pos,is_starter:true,vote_count:cnt,is_injured:false })
          break
        }
      }
      for (const [pid,cnt] of sorted) if (!allCands.find(c=>c.pid===pid)) allCands.push({pid,votes:cnt as number,pos})
    }
    const reserves = allCands.filter(c=>!starters.includes(c.pid)).sort((a,b)=>b.votes-a.votes).slice(0,7)
    for (const r of reserves) rosterRows.push({ season:SEASON,conference:conf,player_id:r.pid,position:r.pos,is_starter:false,vote_count:r.votes,is_injured:false })
  }

  // Injury replacements
  const finalRoster = rosterRows.flatMap(row => {
    const pl = players?.find((p:any)=>p.id===row.player_id)
    if (pl?.status!=='active') {
      const inR = new Set(rosterRows.map((r:any)=>r.player_id))
      const rep = eligible.filter((p:any)=>teamConf[p.team_id]===row.conference&&!inR.has(p.id))
        .map((p:any)=>{const s=p.player_stats?.[0]||{};const gp=Math.max(1,s.games||1);return{...p,score:(s.pts/gp)*0.5+(s.reb/gp)*0.25}})
        .sort((a:any,b:any)=>b.score-a.score)[0]
      if (rep) return [
        {...row,is_injured:true,replaced_by:rep.id},
        {season:SEASON,conference:row.conference,player_id:rep.id,position:row.position,is_starter:false,vote_count:0,is_injured:false}
      ]
    }
    return [row]
  })

  await supabaseAdmin.from('allstar_roster').delete().eq('season',SEASON)
  await supabaseAdmin.from('allstar_roster').insert(finalRoster)
  await supabaseAdmin.from('allstar_config').update({roster_announced:true}).eq('id',1)

  return NextResponse.json({ success:true, total:finalRoster.length, auto_votes:autoRows.length })
}

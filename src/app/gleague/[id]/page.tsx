'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcOvr, ovrColor } from '@/lib/ovr'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

type Tab = 'roster'|'schedule'

const ATTR_GROUPS = [
  {label:'Scoring',   color:'#b45309',attrs:['usage','three','layup','dunk','mid','ft','siq','draw_foul']},
  {label:'Defense',   color:'#15803d',attrs:['blk','stl','idef','pdef']},
  {label:'Playmaking',color:'#1d4ed8',attrs:['ball_hdl','pass_vis','pass_iq','assist_role']},
  {label:'Physical',  color:'#6d28d9',attrs:['stamina','durability','def_reb','off_reb']},
  {label:'Mental',    color:'#c2410c',attrs:['pressure','consistency','crowd_effect']},
]
const ATTR_LABEL: Record<string,string> = {
  usage:'USG',three:'3PT',layup:'LAY',dunk:'DNK',mid:'MID',ft:'FT',siq:'SIQ',draw_foul:'DF',
  blk:'BLK',stl:'STL',idef:'IDEF',pdef:'PDEF',
  ball_hdl:'BH',pass_vis:'PV',pass_iq:'PIQ',assist_role:'AR',
  stamina:'STA',durability:'DUR',def_reb:'DREB',off_reb:'OREB',
  pressure:'CLU',consistency:'CON',crowd_effect:'CE',
}
const ATTR_TIP_EN: Record<string,string> = {
  USG:'Usage Rate',OVR:'Overall rating',AGE:'Player age',EXP:'NBA seasons played',
  PPG:'Points Per Game (G-League)',RPG:'Rebounds Per Game (G-League)',APG:'Assists Per Game (G-League)',
}
const ATTR_TIP_PT: Record<string,string> = {
  USG:'Taxa de Uso',OVR:'Avaliação global',AGE:'Idade do jogador',EXP:'Épocas NBA jogadas',
  PPG:'Pontos Por Jogo (G-League)',RPG:'Ressaltos Por Jogo (G-League)',APG:'Assistências Por Jogo (G-League)',
}

function attrColor(v:number){if(v>=85)return'#b45309';if(v>=75)return'#15803d';if(v>=65)return'#1d4ed8';return'#8a8279'}

function Tip({text}:{text:string}){return(<span className="relative group inline-flex ml-0.5 cursor-help align-middle"><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:11,height:11,borderRadius:'50%',background:'#d4cdc5',color:'#5c554e',fontSize:7,fontWeight:700,lineHeight:1}}>i</span><span className="absolute left-0 top-full mt-1 z-50 px-2 py-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{background:'#1a1512',color:'#f5f1eb',width:180,whiteSpace:'normal',lineHeight:1.4,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.3)',position:'absolute'}}>{text}</span></span>)}

function ColTh({label,color,active,dir,onClick,attrTip}:{label:string,color:string,active?:boolean,dir?:string,onClick?:()=>void,attrTip?:Record<string,string>}){
  return(<th onClick={onClick} style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5',padding:'8px 4px',textAlign:'center',whiteSpace:'nowrap',color:active?'#c8102e':color,fontSize:10,fontWeight:700,letterSpacing:'0.3px',cursor:onClick?'pointer':'default',userSelect:'none'}}><span style={{display:'inline-flex',alignItems:'center',gap:1}}>{label}{attrTip?.[label]&&<Tip text={attrTip[label]}/>}{active&&<span style={{marginLeft:2}}>{dir==='desc'?'↓':'↑'}</span>}</span></th>)
}

export default function GLeagueTeamPage({params}:{params:{id:string}}) {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const ATTR_TIP = isPT ? ATTR_TIP_PT : ATTR_TIP_EN
  const [tab,setTab]=useState<Tab>('roster')
  const [team,setTeam]=useState<any>(null)
  const [players,setPlayers]=useState<any[]>([])
  const [games,setGames]=useState<any[]>([])
  const [coach,setCoach]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [sortKey,setSortKey]=useState('ovr')
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('desc')

  useEffect(()=>{
    Promise.all([
      supabase.from('gleague_teams').select('*, nba:teams!gleague_teams_nba_affiliate_fkey(id,name,logo_url,color)').eq('id',params.id).single(),
      supabase.from('players').select('*, gleague_player_stats(*)').eq('gleague_team_id',params.id).order('usage',{ascending:false}),
      supabase.from('gleague_games').select('*, home:gleague_teams!gleague_games_home_team_fkey(id,name,color,logo_url), away:gleague_teams!gleague_games_away_team_fkey(id,name,color,logo_url)').eq('season','2025-26').gt('week_number',0).or(`home_team.eq.${params.id},away_team.eq.${params.id}`).order('played_at'),
      supabase.from('coaches').select('*').eq('gleague_team_id',params.id).limit(1),
    ]).then(([{data:t},{data:pl},{data:g},{data:c}])=>{
      setTeam(t);setPlayers(pl||[]);setGames(g||[]);setCoach(c?.[0]||null);setLoading(false)
    })
  },[params.id])

  const handleSort=(key:string)=>{if(sortKey===key)setSortDir(d=>d==='desc'?'asc':'desc');else{setSortKey(key);setSortDir('desc')}}

  if(loading)return<div style={{textAlign:'center',padding:'48px',color:'#8a8279'}}>{t('common.loading')}</div>
  if(!team)return<div style={{textAlign:'center',padding:'48px',color:'#8a8279'}}>{isPT?'Equipa não encontrada.':'Team not found.'}</div>

  const tc=readableTeamColor(team.color||'#1d4ed8')
  const gp=team.wins+team.losses
  const pct=gp>0?(team.wins/gp).toFixed(3).replace(/^0/,''):'.000'
  const played=games.filter((g:any)=>g.status==='final')
  const upcoming=games.filter((g:any)=>g.status==='scheduled')

  const rows=players.map((p:any)=>{
    const ovr=calcOvr(p); const s=(p.gleague_player_stats||[])[0]; const gp2=s?.games||0
    const avg=(v:number)=>gp2>0?parseFloat((v/gp2).toFixed(1)):0
    return{...p,ovr,ppg:avg(s?.pts||0),rpg:avg(s?.reb||0),apg:avg(s?.ast||0)}
  }).sort((a:any,b:any)=>{const av=a[sortKey]??0,bv=b[sortKey]??0;return sortDir==='desc'?bv-av:av-bv})

  const coachInitials=coach?coach.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2):''

  return(
    <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 16px'}}>
      <Link href="/gleague" style={{fontSize:12,color:'#5c554e',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:4,marginBottom:16}}>
        ← G-League
      </Link>

      <div style={{background:'#e8e2d6',borderTop:`4px solid ${tc}`,border:'1px solid #d4cec3',borderRadius:16,padding:24,marginBottom:16}}>
        <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:24}}>
          <div style={{width:96,height:96,borderRadius:16,background:tc+'22',border:`2px solid ${tc}44`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
            {(team.logo_url||team.nba?.logo_url)?<img src={team.logo_url||team.nba?.logo_url} alt={team.name} style={{width:'100%',height:'100%',objectFit:'contain',padding:4}}/>:<span style={{fontSize:24,fontWeight:900,color:tc}}>{team.id}</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:tc,marginBottom:2}}>G-League · {isPT?team.conference==='Eastern'?'Conferência Este':'Conferência Oeste':team.conference+' Conference'}</div>
            <h1 style={{fontSize:28,fontWeight:700,color:'#1a1512',margin:'0 0 4px'}}>{team.name}</h1>
            <div style={{fontSize:13,color:'#6b5f4e'}}>{team.arena}{team.city?` · ${team.city}`:''}</div>
            {team.nba&&<Link href={`/team/${team.nba.id}`} style={{fontSize:12,fontWeight:600,color:tc,textDecoration:'none',display:'block',marginTop:4}}>→ {isPT?'Afiliado NBA:':'NBA Affiliate:'} {team.nba.name}</Link>}
          </div>
          <div style={{display:'flex',gap:24,flexShrink:0}}>
            {[{v:team.wins,l:'W',c:'#15803d'},{v:team.losses,l:'L',c:'#dc2626'},{v:pct,l:'PCT',c:'#1a1512'}].map((x:any)=>(
              <div key={x.l} style={{textAlign:'center'}}><div style={{fontSize:28,fontWeight:900,color:x.c}}>{x.v}</div><div style={{fontSize:11,color:'#6b5f4e'}}>{x.l}</div></div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'flex',gap:0,borderBottom:'2px solid #d4cdc5',marginBottom:20}}>
        {([
          {key:'roster',   labelEN:'Roster',  labelPT:'Plantel',    badge:`${players.length} ${isPT?'jogadores':'players'}`},
          {key:'schedule', labelEN:'Schedule', labelPT:'Calendário', badge:`${played.length} ${isPT?'jogados':'played'} · ${upcoming.length} ${isPT?'restantes':'remaining'}`},
        ] as const).map(tb=>(
          <button key={tb.key} type="button" onClick={()=>setTab(tb.key)}
            style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',fontSize:14,fontWeight:600,cursor:'pointer',background:'transparent',border:'none',borderBottom:tab===tb.key?'3px solid #c8102e':'3px solid transparent',marginBottom:-2,color:tab===tb.key?'#1a1512':'#5c554e'}}>
            {isPT?tb.labelPT:tb.labelEN}
            <span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:tab===tb.key?'#e8e2d8':'#f0ece5',color:'#5c554e'}}>{tb.badge}</span>
          </button>
        ))}
      </div>

      {tab==='roster'&&(
        <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{background:'#f0ece5'}}>
                  <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5',padding:'10px 12px',textAlign:'left',fontWeight:700,fontSize:11,color:'#5c554e',position:'sticky',left:0,zIndex:10,minWidth:150}}>{isPT?'Jogador':'Player'}</th>
                  <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5',padding:'8px',textAlign:'center',fontWeight:700,fontSize:11,color:'#5c554e'}}>POS</th>
                  <ColTh label="OVR" color="#1a1512" active={sortKey==='ovr'} dir={sortDir} onClick={()=>handleSort('ovr')} attrTip={ATTR_TIP}/>
                  <ColTh label="AGE" color="#5c554e" active={sortKey==='age'} dir={sortDir} onClick={()=>handleSort('age')} attrTip={ATTR_TIP}/>
                  <ColTh label="EXP" color="#5c554e" active={sortKey==='nba_experience'} dir={sortDir} onClick={()=>handleSort('nba_experience')} attrTip={ATTR_TIP}/>
                  {ATTR_GROUPS.map(g=>g.attrs.map(a=><ColTh key={a} label={ATTR_LABEL[a]} color={g.color} active={sortKey===a} dir={sortDir} onClick={()=>handleSort(a)} attrTip={ATTR_TIP}/>))}
                  <ColTh label="PPG" color="#b45309" active={sortKey==='ppg'} dir={sortDir} onClick={()=>handleSort('ppg')} attrTip={ATTR_TIP}/>
                  <ColTh label="RPG" color="#15803d" active={sortKey==='rpg'} dir={sortDir} onClick={()=>handleSort('rpg')} attrTip={ATTR_TIP}/>
                  <ColTh label="APG" color="#1d4ed8" active={sortKey==='apg'} dir={sortDir} onClick={()=>handleSort('apg')} attrTip={ATTR_TIP}/>
                </tr>
              </thead>
              <tbody>
                {rows.length===0?(<tr><td colSpan={30} style={{padding:'32px',textAlign:'center',color:'#8a8279'}}>{isPT?'Nenhum jogador atribuído.':'No players assigned.'}</td></tr>)
                :rows.map((p:any,i:number)=>{
                  const oc=ovrColor(p.ovr); const bg=i%2===0?'#faf8f5':'#f5f1eb'
                  return(
                    <tr key={p.id} style={{background:bg,borderBottom:'1px solid #e2dcd5'}}>
                      <td style={{padding:'8px 12px',position:'sticky',left:0,zIndex:5,background:bg,borderRight:'1px solid #e2dcd5',whiteSpace:'nowrap'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:22,height:22,borderRadius:4,flexShrink:0,overflow:'hidden',background:oc+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:8,fontWeight:900,color:oc}}>{p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</span>}
                          </div>
                          <Link href={`/player/${p.id}`} style={{fontWeight:600,color:'#1a1512',textDecoration:'none',fontSize:12}}>{p.name}</Link>
                          {p.on_gleague_assignment&&<span style={{background:'#c8102e',color:'#fff',fontSize:8,fontWeight:700,padding:'1px 4px',borderRadius:3}}>NBA</span>}
                        </div>
                      </td>
                      <td style={{padding:'6px 8px',textAlign:'center',borderRight:'1px solid #e2dcd5'}}><span style={{background:'#e8e2d8',color:'#3d3731',fontSize:10,fontWeight:600,padding:'2px 5px',borderRadius:4}}>{p.pos}</span></td>
                      <td style={{padding:'6px 4px',textAlign:'center',borderRight:'1px solid #e2dcd5'}}><span style={{fontWeight:900,fontSize:13,color:oc}}>{p.ovr}</span></td>
                      <td style={{padding:'6px 4px',textAlign:'center',color:'#5c554e',borderRight:'1px solid #e2dcd5'}}>{p.age||'—'}</td>
                      <td style={{padding:'6px 4px',textAlign:'center',borderRight:'1px solid #e2dcd5'}}><span style={{fontWeight:700,fontSize:11,color:'#5c554e'}}>{p.nba_experience??0}</span></td>
                      {ATTR_GROUPS.map(g=>g.attrs.map(a=><td key={a} style={{padding:'6px 4px',textAlign:'center',borderRight:'1px solid #e8e3db'}}><span style={{color:attrColor(p[a]||0),fontWeight:700,fontSize:11}}>{p[a]||0}</span></td>))}
                      <td style={{padding:'6px 4px',textAlign:'center',color:'#b45309',fontWeight:600}}>{p.ppg||'—'}</td>
                      <td style={{padding:'6px 4px',textAlign:'center',color:'#15803d'}}>{p.rpg||'—'}</td>
                      <td style={{padding:'6px 4px',textAlign:'center',color:'#1d4ed8'}}>{p.apg||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:'8px 16px',background:'#f5f1eb',borderTop:'1px solid #e2dcd5',fontSize:11,color:'#8a8279'}}>
            {players.length} {isPT?'jogadores':'players'} · NBA = {isPT?'em missão':'on assignment'} · EXP = {isPT?'épocas NBA':'NBA seasons played'} · {isPT?'Clica nas colunas para ordenar':'Click columns to sort'}
          </div>
        </div>
      )}

      {tab==='schedule'&&(
        <div>
          <div className="flex gap-4 mb-4 flex-wrap">
            {[
              {label:isPT?'Época Regular':'Regular Season',val:'Dec 27 – Mar 28'},
              {label:isPT?'Início dos Playoffs':'Playoffs Begin',val:'Mar 31'},
              {label:isPT?'Finais G-League':'G-League Finals',val:'Apr 7-11'},
              {label:isPT?'Jogos Realizados':'Games Played',val:`${played.length}`},
              {label:isPT?'Restantes':'Remaining',val:`${upcoming.length}`},
            ].map(item=>(
              <div key={item.label} className="px-3 py-2 rounded-lg" style={{background:'#f0ece5',border:'1px solid #d4cdc5'}}>
                <div className="text-xs" style={{color:'#8a8279'}}>{item.label}</div>
                <div className="text-sm font-bold" style={{color:'#1a1512'}}>{item.val}</div>
              </div>
            ))}
          </div>

          {played.length>0&&(
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',color:'#5c554e',marginBottom:12}}>{isPT?'Resultados':'Results'}</div>
              <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
                {played.slice().reverse().map((g:any,i:number)=>{
                  const isHome=g.home_team===params.id; const myScore=isHome?g.home_score:g.away_score; const opScore=isHome?g.away_score:g.home_score
                  const opp=isHome?g.away:g.home; const won=myScore>opScore; const otc=readableTeamColor(opp?.color||'#5c554e')
                  return(
                    <div key={g.id} style={{display:'flex',alignItems:'center',gap:16,padding:'10px 16px',background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,background:won?'#15803d':'#dc2626',color:'#fff',flexShrink:0}}>{won?(isPT?'V':'W'):(isPT?'D':'L')}</span>
                      <span style={{fontSize:11,color:'#8a8279',minWidth:48,flexShrink:0}}>{g.played_at?new Date(g.played_at).toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric'}):'—'}</span>
                      <Link href={`/gleague/${opp?.id}`} style={{flex:1,fontWeight:600,fontSize:13,color:otc,textDecoration:'none'}}>{isHome?'vs':'@'} {opp?.name||'—'}</Link>
                      <span style={{fontWeight:900,fontSize:14,color:won?'#15803d':'#dc2626',flexShrink:0}}>{myScore}–{opScore}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {upcoming.length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',color:'#5c554e',marginBottom:12}}>
                {isPT?`Próximos Jogos (${upcoming.length})`:`Upcoming (${upcoming.length} games)`}
              </div>
              <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
                {upcoming.map((g:any,i:number)=>{
                  const isHome=g.home_team===params.id; const opp=isHome?g.away:g.home; const otc=readableTeamColor(opp?.color||'#5c554e')
                  return(
                    <div key={g.id} style={{display:'flex',alignItems:'center',gap:16,padding:'10px 16px',background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,background:'#e8e2d8',color:'#5c554e',flexShrink:0}}>{isHome?(isPT?'CASA':'HOME'):(isPT?'FORA':'AWAY')}</span>
                      <span style={{fontSize:11,color:'#8a8279',minWidth:48,flexShrink:0}}>{g.played_at?new Date(g.played_at).toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric'}):`${isPT?'Sem':'Wk'} ${g.week_number}`}</span>
                      <div style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
                        {opp?.logo_url&&<img src={opp.logo_url} alt="" style={{width:20,height:20,objectFit:'contain'}}/>}
                        <Link href={`/gleague/${opp?.id}`} style={{fontWeight:600,fontSize:13,color:otc,textDecoration:'none'}}>{isHome?'vs':'@'} {opp?.name||'—'}</Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {played.length===0&&upcoming.length===0&&<div style={{textAlign:'center',padding:'32px',color:'#8a8279'}}>{isPT?'Nenhum jogo agendado.':'No games scheduled.'}</div>}
        </div>
      )}

      {coach&&(
        <div style={{marginTop:24,borderRadius:12,padding:20,background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',color:'#5c554e',marginBottom:12}}>{isPT?'HEAD COACH':'HEAD COACH'}</div>
          <Link href={`/staff/${coach.id}`} style={{textDecoration:'none'}}>
            <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'3px solid #b45309',borderRadius:12,padding:16,display:'inline-flex',alignItems:'center',gap:12,minWidth:220}}>
              <div style={{width:48,height:48,borderRadius:10,overflow:'hidden',flexShrink:0,background:'#b4530918',border:'2px solid #b4530933',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {coach.photo_url?<img src={coach.photo_url} alt={coach.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:14,fontWeight:800,color:'#b45309'}}>{coachInitials}</span>}
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:'#b45309',marginBottom:2}}>🏆 {isPT?'Head Coach':'Head Coach'}</div>
                <div style={{fontSize:16,fontWeight:700,color:'#1a1512'}}>{coach.name}</div>
                <div style={{fontSize:11,color:'#8a8279',marginTop:2}}>{coach.nationality}{coach.age?(isPT?` · Idade ${coach.age}`:` · Age ${coach.age}`):''}</div>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}

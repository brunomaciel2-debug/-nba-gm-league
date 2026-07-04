'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

function ScrollTable({ children }: { children: React.ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null)
  const botRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const top=topRef.current, bot=botRef.current, inner=innerRef.current
    if(!top||!bot||!inner)return
    const updateWidth=()=>{const w=inner.scrollWidth;top.firstElementChild&&((top.firstElementChild as HTMLElement).style.width=w+'px')}
    updateWidth(); const ro=new ResizeObserver(updateWidth); ro.observe(inner)
    const onTop=()=>{bot.scrollLeft=top.scrollLeft;inner.scrollLeft=top.scrollLeft}
    const onBot=()=>{top.scrollLeft=bot.scrollLeft;inner.scrollLeft=bot.scrollLeft}
    const onInner=()=>{top.scrollLeft=inner.scrollLeft;bot.scrollLeft=inner.scrollLeft}
    top.addEventListener('scroll',onTop); bot.addEventListener('scroll',onBot); inner.addEventListener('scroll',onInner)
    return()=>{ro.disconnect();top.removeEventListener('scroll',onTop);bot.removeEventListener('scroll',onBot);inner.removeEventListener('scroll',onInner)}
  },[])
  return (
    <>
      <div ref={topRef} style={{overflowX:'auto',overflowY:'hidden',height:10,background:'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}><div style={{height:1}}/></div>
      <div ref={botRef} style={{overflowX:'auto'}}><div ref={innerRef} style={{overflowX:'visible'}}>{children}</div></div>
    </>
  )
}

type DraftTab = 'class'|'mock'|'results'
const POS_COLOR: Record<string,string> = {PG:'#1d4ed8',SG:'#6d28d9',SF:'#15803d',PF:'#b45309',C:'#dc2626'}
const POSITIONS = ['All','PG','SG','SF','PF','C']
const TOOLTIPS_EN: Record<string,string> = {
  '3PT':'Three-Point Shooting (0-100)',LAY:'Layup (0-100)',DNK:'Dunk (0-100)',MID:'Mid-Range (0-100)',
  FT:'Free Throw (0-100)',SIQ:'Shot IQ (0-100)',DF:'Draw Foul (0-100)',BLK:'Block (0-100)',
  STL:'Steal (0-100)',IDEF:'Interior Defense (0-100)',PDEF:'Perimeter Defense (0-100)',
  DREB:'Def. Rebound (0-100)',OREB:'Off. Rebound (0-100)',STA:'Stamina (0-100)',DUR:'Durability (0-100)',
  BH:'Ball Handle (0-100)',PV:'Pass Vision (0-100)',PIQ:'Pass IQ (0-100)',AR:'Assist Role (0-100)',
  CLU:'Clutch (0-100)',CON:'Consistency (0-100)',CE:'Crowd Effect (0-100)',STR:'Streaky (0-100)',
  SPD:'Speed (0-100)',AGI:'Agility (0-100)',STR2:'Strength (0-100)',CS:'Close Shot (0-100)',
  SDNK:'Afundanço Estático (0-100)',TT:'Trash Talk (0-100)',USG:'Usage Rate (0-100)',
  OVR:'Overall rating (Commissioner only)',AGE:'Player age',
}
const TOOLTIPS_PT: Record<string,string> = {
  '3PT':'Lançamento de 3 Pontos (0-100)',LAY:'Layup (0-100)',DNK:'Afundanço (0-100)',MID:'Meia Distância (0-100)',
  FT:'Lances Livres (0-100)',SIQ:'Shot IQ (0-100)',DF:'Provoca Falta (0-100)',BLK:'Desarme de Lançamento (0-100)',
  STL:'Roubo de Bola (0-100)',IDEF:'Defesa Interior (0-100)',PDEF:'Defesa de Perímetro (0-100)',
  DREB:'Ressalto Defensivo (0-100)',OREB:'Ressalto Ofensivo (0-100)',STA:'Resistência (0-100)',DUR:'Durabilidade (0-100)',
  BH:'Drible (0-100)',PV:'Visão de Jogo (0-100)',PIQ:'Pass IQ (0-100)',AR:'Perfil de Assistência (0-100)',
  CLU:'Clutch/Pressão (0-100)',CON:'Consistência (0-100)',CE:'Influência do Público (0-100)',STR:'Irregular (0-100)',
  SPD:'Velocidade (0-100)',AGI:'Agilidade (0-100)',STR2:'Força (0-100)',CS:'Finalização no Cesto (0-100)',
  SDNK:'Afundanço Estático (0-100)',TT:'Trash Talk (0-100)',USG:'Taxa de Utilização (0-100)',
  OVR:'Avaliação global (só Comissário)',AGE:'Idade do jogador',
}
const ATTR_COLS = [
  {key:'three',label:'3PT'},{key:'layup',label:'LAY'},{key:'dunk',label:'DNK'},{key:'mid',label:'MID'},
  {key:'ft',label:'FT'},{key:'siq',label:'SIQ'},{key:'draw_foul',label:'DF'},{key:'usage',label:'USG'},
  {key:'blk',label:'BLK'},{key:'stl',label:'STL'},{key:'idef',label:'IDEF'},{key:'pdef',label:'PDEF'},
  {key:'def_reb',label:'DREB'},{key:'off_reb',label:'OREB'},{key:'stamina',label:'STA'},{key:'durability',label:'DUR'},
  {key:'speed',label:'SPD'},{key:'agility',label:'AGI'},{key:'strength',label:'STR2'},{key:'close_shot',label:'CS'},
  {key:'standing_dunk',label:'SDNK'},{key:'ball_hdl',label:'BH'},{key:'pass_vis',label:'PV'},{key:'pass_iq',label:'PIQ'},
  {key:'assist_role',label:'AR'},{key:'pressure',label:'CLU'},{key:'consistency',label:'CON'},
  {key:'crowd_effect',label:'CE'},{key:'streaky',label:'STR'},{key:'trash_talk',label:'TT'},
]
function attrColor(v:number){if(v>=90)return'#b45309';if(v>=80)return'#15803d';if(v>=70)return'#1d4ed8';if(v>=60)return'#1a1512';return'#8a8279'}
function Tip({text}:{text:string}){return(<span className="relative group inline-flex ml-1 cursor-help align-middle"><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12,borderRadius:'50%',background:'#d4cdc5',color:'#5c554e',fontSize:8,fontWeight:700,lineHeight:1}}>i</span><span className="absolute left-0 top-full mt-1 z-50 px-2 py-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{background:'#1a1512',color:'#f5f1eb',width:160,whiteSpace:'normal',lineHeight:1.4,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>{text}</span></span>)}
function SortTh({label,active,dir,onClick,tooltips}:{label:string,active:boolean,dir:string,onClick:()=>void,tooltips?:Record<string,string>}){return(<th onClick={onClick} className="px-2 py-2.5 text-center cursor-pointer select-none whitespace-nowrap" style={{background:'#f0ece5',color:active?'#c8102e':'#5c554e',fontSize:11,fontWeight:700,letterSpacing:'0.5px',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5'}}>{label}{tooltips?.[label]&&<Tip text={tooltips[label]}/>}{active&&<span style={{marginLeft:3}}>{dir==='desc'?'↓':'↑'}</span>}</th>)}

export default function DraftSection() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const TOOLTIPS = isPT ? TOOLTIPS_PT : TOOLTIPS_EN
  const [tab,setTab]=useState<DraftTab>('class')
  const [prospects,setProspects]=useState<any[]>([])
  const [standings,setStandings]=useState<any[]>([])
  const [results,setResults]=useState<any[]>([])
  const [teams,setTeams]=useState<Record<string,any>>({})
  const [draftPicks,setDraftPicks]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [isCommissioner,setIsCommissioner]=useState(false)
  const [myTeamId,setMyTeamId]=useState<string|null>(null)
  const [revealedSet,setRevealedSet]=useState<Set<string>>(new Set())
  const [pos,setPos]=useState('All')
  const [search,setSearch]=useState('')
  const [sortKey,setSortKey]=useState('name')
  const [sortDir,setSortDir]=useState<'desc'|'asc'>('asc')
  const NEXT_DRAFT='2027'

  useEffect(()=>{
    supabase.auth.getUser().then(async({data:{user}})=>{
      if(!user)return
      const{data:gm}=await supabase.from('gm_profiles').select('role,team_id').eq('id',user.id).single()
      if(!gm)return
      if(gm.role==='commissioner'){setIsCommissioner(true);return}
      setMyTeamId(gm.team_id)
      if(gm.team_id){
        const{data:reveals}=await supabase.from('scouting_reveals').select('prospect_id,attribute_name').eq('team_id',gm.team_id).eq('season','2025-26')
        setRevealedSet(new Set((reveals||[]).map((r:any)=>`${r.prospect_id}:${r.attribute_name}`)))
      }
    })
    Promise.all([
      supabase.from('prospects').select('*').eq('season',NEXT_DRAFT).order('overall',{ascending:false}),
      supabase.from('teams').select('id,name,logo_url,color,wins,losses').not('id','in','(ALL,RVS,ROO,SOP)'),
      supabase.from('draft_results').select('*, prospects(*), teams(id,name,logo_url,color)').eq('season',NEXT_DRAFT).order('pick_number'),
      supabase.from('draft_picks').select('*').eq('season',NEXT_DRAFT).eq('round',1).eq('status','owned'),
    ]).then(([{data:p},{data:t},{data:r},{data:dp}])=>{
      setProspects(p||[])
      setStandings([...(t||[])].sort((a,b)=>a.wins-b.wins||b.losses-a.losses))
      const map:Record<string,any>={};for(const team of(t||[]))map[team.id]=team;setTeams(map)
      setResults(r||[]); setDraftPicks(dp||[]); setLoading(false)
    })
  },[])

  const isRevealed=(prospectId:string,attr:string)=>isCommissioner||revealedSet.has(`${prospectId}:${attr}`)
  const handleSort=(key:string)=>{if(sortKey===key)setSortDir(d=>d==='desc'?'asc':'desc');else{setSortKey(key);setSortDir('desc')}}
  const filtered=prospects.filter(p=>pos==='All'||p.pos===pos).filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{
      if(sortKey==='name')return sortDir==='asc'?a.name.localeCompare(b.name):b.name.localeCompare(a.name)
      const av=isRevealed(a.id,sortKey)?(a[sortKey]??0):-1; const bv=isRevealed(b.id,sortKey)?(b[sortKey]??0):-1
      return sortDir==='desc'?bv-av:av-bv
    })
  const OVR_COLOR=(v:number)=>v>=85?'#b45309':v>=75?'#15803d':v>=65?'#1d4ed8':'#5c554e'
  const OVR_BG=(v:number)=>v>=85?'#fef3c7':v>=75?'#dcfce7':v>=65?'#dbeafe':'#f0ece5'

  const TABS = [
    {key:'class',   labelEN:'🎓 Draft Class',    labelPT:'🎓 Classe do Draft'},
    {key:'mock',    labelEN:'📊 Mock Draft',      labelPT:'📊 Simulação de Draft'},
    {key:'results', labelEN:'🏆 Draft Results',   labelPT:'🏆 Resultados do Draft'},
  ]

  return (
    <div className="mt-8">
      <div className="section-header mb-5">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{color:'#1a1612',letterSpacing:'1.5px'}}>
          <i className="ti ti-clipboard-list" style={{fontSize:14,marginRight:6,color:'#b45309'}}></i>
          Draft 2026-27
        </span>
      </div>

      {!isCommissioner&&(
        <div style={{marginBottom:16,padding:'12px 16px',borderRadius:10,background:'#ede9fe',border:'1px solid #c4b5fd',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
          <div style={{fontSize:12,color:'#5b21b6'}}>
            🔍 {isPT?<>Atributos marcados como <strong>???</strong> ainda não foram scouted. Usa o olheiro da tua equipa para os revelar.</>:<>Attributes shown as <strong>???</strong> haven't been scouted yet. Use your team's Scout to reveal them.</>}
          </div>
          <a href="/scouting" style={{fontSize:12,fontWeight:700,color:'#fff',background:'#6d28d9',padding:'6px 14px',borderRadius:8,textDecoration:'none'}}>
            {isPT?'Ir para Scouting →':'Go to Scouting →'}
          </a>
        </div>
      )}

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map((t:any)=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{background:tab===t.key?'#1a1512':'#e8e2d6',color:tab===t.key?'#f5f1eb':'#5c554e',border:'1px solid '+(tab===t.key?'#1a1512':'#d4cdc5')}}>
            {isPT?t.labelPT:t.labelEN}
          </button>
        ))}
      </div>

      {loading?<div className="text-center py-12" style={{color:'#8a8279'}}>{t('common.loading')}</div>:(
        <>
          {tab==='class'&&(
            <div>
              {prospects.length===0?(
                <div className="rounded-2xl p-12 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cdc5'}}>
                  <div className="text-5xl mb-4">🎓</div>
                  <h3 className="text-lg font-black mb-2" style={{color:'#1a1512'}}>{isPT?'Draft Class Ainda Não Disponível':'Draft Class Not Yet Available'}</h3>
                  <p className="text-sm" style={{color:'#6b5f4e'}}>{isPT?'A draft class de 2026-27 será revelada mais perto da data do draft.':'The 2026-27 draft class will be revealed closer to the draft date.'}</p>
                </div>
              ):(
                <>
                  <div className="rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-end" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
                    <div className="flex-1 min-w-36">
                      <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>{t('common.search')}</label>
                      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={isPT?'Nome do jogador...':'Player name...'}
                        className="w-full px-3 py-1.5 rounded-lg text-sm" style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>{isPT?'Posição':'Position'}</label>
                      <div className="flex gap-1 flex-wrap">
                        {POSITIONS.map(p=>(
                          <button key={p} onClick={()=>setPos(p)} className="text-xs font-bold px-2 py-1.5 rounded-lg"
                            style={{background:pos===p?'#1a1512':'#f0ece5',color:pos===p?'#fff':'#5c554e',border:'1px solid '+(pos===p?'#1a1512':'#d4cdc5')}}>
                            {p==='All'?(isPT?'Todos':'All'):p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs" style={{color:'#8a8279'}}>{filtered.length} {isPT?'prospectos':'prospects'}</span>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
                    <ScrollTable>
                      <table className="w-full" style={{borderCollapse:'collapse',fontSize:12}}>
                        <thead>
                          <tr style={{background:'#f0ece5'}}>
                            <th className="px-3 py-2.5 text-left sticky left-0 z-10" style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5',fontWeight:700,fontSize:11,color:'#5c554e',minWidth:160}}>
                              {isPT?'JOGADOR':'PLAYER'}
                            </th>
                            <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 8px',fontWeight:700,fontSize:11,color:'#5c554e',textAlign:'center',borderRight:'1px solid #e2dcd5'}}>POS</th>
                            <SortTh label="AGE" active={sortKey==='age'} dir={sortDir} onClick={()=>handleSort('age')} tooltips={TOOLTIPS}/>
                            <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 8px',fontWeight:700,fontSize:11,color:'#5c554e',textAlign:'center',borderRight:'1px solid #e2dcd5',whiteSpace:'nowrap'}}>{isPT?'ESCOLA':'FROM'}</th>
                            <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 8px',fontWeight:700,fontSize:11,color:'#5c554e',textAlign:'center',borderRight:'1px solid #e2dcd5'}}>HT</th>
                            <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 8px',fontWeight:700,fontSize:11,color:'#5c554e',textAlign:'center',borderRight:'1px solid #e2dcd5'}}>WT</th>
                            {isCommissioner&&<SortTh label="OVR" active={sortKey==='overall'} dir={sortDir} onClick={()=>handleSort('overall')} tooltips={TOOLTIPS}/>}
                            {ATTR_COLS.map(c=><SortTh key={c.key} label={c.label} active={sortKey===c.key} dir={sortDir} onClick={()=>handleSort(c.key)} tooltips={TOOLTIPS}/>)}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((p,i)=>(
                            <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e8e3db'}}>
                              <td className="px-3 py-2 sticky left-0 z-10 whitespace-nowrap" style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderRight:'1px solid #e2dcd5'}}>
                                <div className="flex items-center gap-2">
                                  {p.photo_url?<img src={p.photo_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0"/>
                                    :<div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'#e8e2d6',color:'#5c554e',fontSize:8,fontWeight:900}}>{p.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
                                  <a href={`/prospect/${p.id}`} className="font-semibold no-underline hover:underline" style={{color:'#1a1512'}}>{p.name}</a>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}>
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{background:(POS_COLOR[p.pos]||'#5c554e')+'22',color:POS_COLOR[p.pos]||'#5c554e'}}>{p.pos}</span>
                              </td>
                              <td className="px-2 py-2 text-center text-xs" style={{color:'#5c554e',borderRight:'1px solid #e2dcd5'}}>{p.age||'—'}</td>
                              <td className="px-2 py-2 text-center text-xs" style={{color:'#5c554e',borderRight:'1px solid #e2dcd5',whiteSpace:'nowrap'}}>{p.college||'—'}</td>
                              <td className="px-2 py-2 text-center text-xs" style={{color:'#5c554e',borderRight:'1px solid #e2dcd5',whiteSpace:'nowrap'}}>{p.height||'—'}</td>
                              <td className="px-2 py-2 text-center text-xs" style={{color:'#5c554e',borderRight:'1px solid #e2dcd5'}}>{p.weight||'—'}</td>
                              {isCommissioner&&<td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}><span className="text-xs font-black px-2 py-0.5 rounded" style={{background:OVR_BG(p.overall),color:OVR_COLOR(p.overall)}}>{p.overall}</span></td>}
                              {ATTR_COLS.map(c=>{
                                const revealed=isRevealed(p.id,c.key)
                                return(<td key={c.key} className="px-2 py-2 text-center" style={{borderRight:'1px solid #e8e3db'}}>
                                  {revealed?<span className="text-xs font-bold" style={{color:attrColor(p[c.key]||0)}}>{p[c.key]||0}</span>
                                    :<span className="text-xs font-bold" style={{color:'#c8c0b4'}} title={isPT?'Ainda não scouted':'Not yet scouted'}>???</span>}
                                </td>)
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollTable>
                    <div className="px-4 py-2 text-xs" style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5',color:'#8a8279'}}>
                      {isPT?'Clica nos cabeçalhos para ordenar · Passa o rato sobre i para definições':'Click column headers to sort · Hover i for attribute definitions'}
                      {!isCommissioner&&<span className="ml-3" style={{color:'#b45309'}}>⚠ {isPT?'OVR escondido — avalia com base nos atributos scouted':'OVR hidden — evaluate based on scouted attributes'}</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {tab==='mock'&&(
            <div>
              <p className="text-xs mb-4" style={{color:'#6b5f4e'}}>
                {isPT?'Pré-visualização baseada na classificação actual. Pior registo escolhe primeiro. A posse das escolhas reflecte os trades reais.':'Preview based on current standings. Worst record picks first. Pick ownership reflects actual trades.'}
              </p>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                      {[isPT?'Escolha':'Pick',isPT?'Dono':'Owner',isPT?'Equipa Original':'Original Team',isPT?'Prospecto':'Prospect','Pos',...(isCommissioner?['OVR']:[])].map((h,i)=>(
                        <th key={h} className={`px-3 py-2.5 font-bold text-xs ${i<=2?'text-left':'text-right'}`} style={{color:'#5c554e'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(()=>{
                      const sorted=[...draftPicks].sort((a,b)=>{const ta=teams[a.original_team_id],tb2=teams[b.original_team_id];return(ta?.wins??0)-(tb2?.wins??0)||((tb2?.losses??0)-(ta?.losses??0))})
                      const rows=sorted.length>0?sorted:standings.slice(0,30).map(t=>({team_id:t.id,original_team_id:t.id}))
                      return rows.map((pick:any,i:number)=>{
                        const owner=teams[pick.team_id]; const original=teams[pick.original_team_id]
                        const isOwn=pick.team_id===pick.original_team_id; const prospect=prospects[i]||null
                        return(
                          <tr key={i} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                            <td className="px-3 py-2.5 text-center font-black text-sm" style={{color:'#b45309'}}>{i+1}</td>
                            <td className="px-3 py-2.5"><div className="flex items-center gap-2">{owner?.logo_url&&<img src={owner.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0"/>}<span className="font-semibold text-xs" style={{color:'#1a1512'}}>{owner?.name||'—'}</span></div></td>
                            <td className="px-3 py-2.5">{!isOwn&&original?<div className="flex items-center gap-1.5">{original.logo_url&&<img src={original.logo_url} alt="" className="w-4 h-4 object-contain flex-shrink-0 opacity-60"/>}<span className="text-xs" style={{color:'#b45309'}}>via {original.name}</span></div>:<span className="text-xs" style={{color:'#b0a89e'}}>—</span>}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-xs" style={{color:'#1a1512'}}>{prospect?.name||'—'}</td>
                            <td className="px-3 py-2.5 text-right">{prospect?.pos&&<span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{background:(POS_COLOR[prospect.pos]||'#5c554e')+'22',color:POS_COLOR[prospect.pos]||'#5c554e'}}>{prospect.pos}</span>}</td>
                            {isCommissioner&&<td className="px-3 py-2.5 text-right">{prospect?.overall&&<span className="text-xs font-black px-2 py-0.5 rounded" style={{background:OVR_BG(prospect.overall),color:OVR_COLOR(prospect.overall)}}>{prospect.overall}</span>}</td>}
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab==='results'&&(
            <div>
              {results.length===0?(
                <div className="rounded-2xl p-12 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cdc5'}}>
                  <div className="text-5xl mb-4">🏆</div>
                  <h3 className="text-lg font-black mb-2" style={{color:'#1a1512'}}>{isPT?'Draft Ainda Não Realizado':'Draft Not Yet Completed'}</h3>
                  <p className="text-sm" style={{color:'#6b5f4e'}}>{isPT?'Os resultados oficiais do draft aparecerão aqui após o draft ser realizado.':'The official draft results will appear here after the draft takes place.'}</p>
                </div>
              ):(
                <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                        {[isPT?'Escolha':'Pick','Rnd',isPT?'Equipa':'Team',isPT?'Jogador':'Player','Pos',...(isCommissioner?['OVR']:[])].map((h,i)=>(
                          <th key={h} className={`px-3 py-2.5 font-bold text-xs ${i<=2?'text-left':'text-right'}`} style={{color:'#5c554e'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r,i)=>(
                        <tr key={r.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                          <td className="px-3 py-2.5 font-black text-sm" style={{color:'#b45309'}}>{r.pick_number}</td>
                          <td className="px-3 py-2.5 text-xs"><span className="font-bold px-1.5 py-0.5 rounded" style={{background:r.round===1?'#fef3c7':'#dbeafe',color:r.round===1?'#b45309':'#1d4ed8'}}>R{r.round}</span></td>
                          <td className="px-3 py-2.5"><div className="flex items-center gap-2">{r.teams?.logo_url&&<img src={r.teams.logo_url} alt="" className="w-5 h-5 object-contain flex-shrink-0"/>}<span className="text-xs font-semibold" style={{color:'#1a1512'}}>{r.teams?.name}</span></div></td>
                          <td className="px-3 py-2.5 font-bold text-right" style={{color:'#1a1512'}}>{r.prospects?.name||'—'}</td>
                          <td className="px-3 py-2.5 text-right">{r.prospects?.pos&&<span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{background:(POS_COLOR[r.prospects.pos]||'#5c554e')+'22',color:POS_COLOR[r.prospects.pos]||'#5c554e'}}>{r.prospects.pos}</span>}</td>
                          {isCommissioner&&r.prospects?.overall&&<td className="px-3 py-2.5 text-right"><span className="text-xs font-black px-2 py-0.5 rounded" style={{background:OVR_BG(r.prospects.overall),color:OVR_COLOR(r.prospects.overall)}}>{r.prospects.overall}</span></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

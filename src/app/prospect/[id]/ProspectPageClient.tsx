'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProspectPhotoUpload from './ProspectPhotoUpload'
import { useTranslation } from '@/components/I18nProvider'

const ATTR_GROUPS_EN = [
  { label:'Scoring',       color:'#b45309', attrs:[{key:'three',label:'Three Point'},{key:'layup',label:'Layup'},{key:'dunk',label:'Afundanço'},{key:'mid',label:'Mid-Range'},{key:'ft',label:'Free Throws'},{key:'siq',label:'Shot IQ'},{key:'draw_foul',label:'Draw Foul'},{key:'close_shot',label:'Close Shot'},{key:'standing_dunk',label:'Afundanço Estático'}]},
  { label:'Defense',       color:'#15803d', attrs:[{key:'blk',label:'Block'},{key:'stl',label:'Steal'},{key:'idef',label:'Interior Defense'},{key:'pdef',label:'Perimeter Defense'}]},
  { label:'Rebounding',    color:'#1d4ed8', attrs:[{key:'def_reb',label:'Def. Rebound'},{key:'off_reb',label:'Off. Rebound'}]},
  { label:'Athleticism',   color:'#6d28d9', attrs:[{key:'stamina',label:'Stamina'},{key:'durability',label:'Durability'},{key:'speed',label:'Speed'},{key:'agility',label:'Agility'},{key:'strength',label:'Strength'}]},
  { label:'Playmaking',    color:'#0e7490', attrs:[{key:'ball_hdl',label:'Ball Handle'},{key:'pass_vis',label:'Pass Vision'},{key:'pass_iq',label:'Pass IQ'},{key:'assist_role',label:'Assist Role'}]},
  { label:'Psychological', color:'#b45309', attrs:[{key:'pressure',label:'Clutch/Pressure'},{key:'consistency',label:'Consistency'},{key:'crowd_effect',label:'Crowd Effect'},{key:'streaky',label:'Streaky'},{key:'trash_talk',label:'Trash Talk'}]},
]
const ATTR_GROUPS_PT = [
  { label:'Ataque',           color:'#b45309', attrs:[{key:'three',label:'3 Pontos'},{key:'layup',label:'Layup'},{key:'dunk',label:'Afundanço'},{key:'mid',label:'Meia Distância'},{key:'ft',label:'Lances Livres'},{key:'siq',label:'Shot IQ'},{key:'draw_foul',label:'Provoca Falta'},{key:'close_shot',label:'Finalização no Cesto'},{key:'standing_dunk',label:'Afundanço Estático'}]},
  { label:'Defesa',           color:'#15803d', attrs:[{key:'blk',label:'Desarme de Lançamento'},{key:'stl',label:'Roubo de Bola'},{key:'idef',label:'Def. Interior'},{key:'pdef',label:'Def. Perímetro'}]},
  { label:'Ressaltos',        color:'#1d4ed8', attrs:[{key:'def_reb',label:'Ressalto Def.'},{key:'off_reb',label:'Ressalto Ofens.'}]},
  { label:'Atletismo',        color:'#6d28d9', attrs:[{key:'stamina',label:'Resistência'},{key:'durability',label:'Durabilidade'},{key:'speed',label:'Velocidade'},{key:'agility',label:'Agilidade'},{key:'strength',label:'Força'}]},
  { label:'Criação de Jogo',  color:'#0e7490', attrs:[{key:'ball_hdl',label:'Drible'},{key:'pass_vis',label:'Visão de Jogo'},{key:'pass_iq',label:'Pass IQ'},{key:'assist_role',label:'Perfil de Assistência'}]},
  { label:'Psicológico',      color:'#b45309', attrs:[{key:'pressure',label:'Clutch/Pressão'},{key:'consistency',label:'Consistência'},{key:'crowd_effect',label:'Influência do Público'},{key:'streaky',label:'Irregular'},{key:'trash_talk',label:'Trash Talk'}]},
]

const POS_COLOR: Record<string,string> = {PG:'#1d4ed8',SG:'#6d28d9',SF:'#15803d',PF:'#b45309',C:'#dc2626'}

function AttrTooltip({tip}:{tip:string}){return(<span className="relative group inline-flex ml-1 cursor-help align-middle"><span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-xs font-bold flex-shrink-0" style={{background:'#d4cdc5',color:'#5c554e',lineHeight:1,fontSize:9}}>i</span><span className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{background:'#1a1512',color:'#f5f1eb',width:220,whiteSpace:'normal',lineHeight:1.5,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>{tip}</span></span>)}

function AttrBar({value,color,revealed}:{value:number,color:string,revealed:boolean}){
  if(!revealed)return(<div className="flex items-center gap-2"><div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#e2dcd5'}}><div style={{width:'30%',height:'100%',borderRadius:9999,background:'repeating-linear-gradient(45deg,#d4cdc5,#d4cdc5 4px,#e2dcd5 4px,#e2dcd5 8px)'}}/></div><span className="text-xs font-bold w-7 text-right" style={{color:'#c8c0b4'}}>??</span></div>)
  const pct=Math.min(100,Math.max(0,value)); const barColor=value>=85?'#b45309':value>=70?color:value>=50?color+'99':'#dc2626'
  return(<div className="flex items-center gap-2"><div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#d4cdc5'}}><div className="h-full rounded-full" style={{width:pct+'%',background:barColor}}/></div><span className="text-xs font-bold w-7 text-right" style={{color:value>=85?'#b45309':value>=70?'#1a1512':value>=50?'#5c554e':'#dc2626'}}>{value}</span></div>)
}

export default function ProspectPageClient({prospectId}:{prospectId:string}) {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const ATTR_GROUPS = isPT ? ATTR_GROUPS_PT : ATTR_GROUPS_EN
  const [prospect,setProspect]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [isCommissioner,setIsCommissioner]=useState(false)
  const [myTeamId,setMyTeamId]=useState<string|null>(null)
  const [revealedAttrs,setRevealedAttrs]=useState<Set<string>>(new Set())

  useEffect(()=>{
    Promise.all([supabase.from('prospects').select('*').eq('id',prospectId).single(),supabase.auth.getUser()])
      .then(async([{data:pr},{data:{user}}])=>{
        setProspect(pr)
        if(user){
          const{data:gm}=await supabase.from('gm_profiles').select('role,team_id').eq('id',user.id).single()
          if(gm?.role==='commissioner'){setIsCommissioner(true)}
          else if(gm?.team_id){
            setMyTeamId(gm.team_id)
            const{data:reveals}=await supabase.from('scouting_reveals').select('attribute_name').eq('team_id',gm.team_id).eq('prospect_id',prospectId).eq('season','2025-26')
            setRevealedAttrs(new Set((reveals||[]).map((r:any)=>r.attribute_name)))
          }
        }
        setLoading(false)
      })
  },[prospectId])

  if(loading)return<div className="p-8 text-center" style={{color:'#5c554e'}}>{t('common.loading')}</div>
  if(!prospect)return<div className="p-8 text-center" style={{color:'#5c554e'}}>{isPT?'Prospecto não encontrado.':'Prospect not found.'}</div>

  const p=prospect; const posColor=POS_COLOR[p.pos]||'#5c554e'
  const isRevealed=(attr:string)=>isCommissioner||revealedAttrs.has(attr)
  const revealedCount=isCommissioner?30:revealedAttrs.size

  const infoItems = isPT
    ? [{label:'Altura',val:p.height||'—'},{label:'Peso',val:p.weight?p.weight+'lbs':'—'},{label:'Nacionalidade',val:p.nationality||'—'},{label:'Escola',val:p.college||'—'}]
    : [{label:'Height',val:p.height||'—'},{label:'Weight',val:p.weight?p.weight+'lbs':'—'},{label:'Nationality',val:p.nationality||'—'},{label:'School',val:p.college||'—'}]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <a href="/draft" className="inline-flex items-center gap-1.5 text-xs font-semibold mb-4 no-underline" style={{color:'#8a8279'}}>
        ← {isPT?'Voltar ao Draft':'Back to Draft'}
      </a>
      <div className="rounded-2xl p-6 mb-6" style={{background:'#faf8f5',borderTop:'4px solid '+posColor,border:'1px solid #d4cdc5'}}>
        <div className="flex gap-5 flex-wrap items-start">
          <div className="flex-shrink-0 flex flex-col gap-2">
            {p.photo_url?<img src={p.photo_url} alt={p.name} className="w-40 h-40 rounded-xl object-cover" style={{border:'2px solid '+posColor}}/>
              :<div className="w-40 h-40 rounded-xl flex items-center justify-center text-3xl font-black" style={{background:posColor+'18',color:posColor,border:'2px solid '+posColor+'33'}}>{p.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
            <ProspectPhotoUpload prospectId={p.id} currentPhoto={p.photo_url}/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{color:posColor,letterSpacing:'1px'}}>
                  {isPT?'Draft Class 2026-27':'2026-27 Draft Class'} · {p.pos}
                </div>
                <h1 className="text-3xl font-black mb-2" style={{color:'#1a1512'}}>{p.name}</h1>
                <div className="flex gap-3 text-sm flex-wrap items-center">
                  {p.nationality&&<span style={{color:'#5c554e'}}>{p.nationality}</span>}
                  {p.age&&<span style={{color:'#5c554e'}}>{isPT?'Idade':'Age'} {p.age}</span>}
                  {p.college&&<span style={{color:'#5c554e'}}>{p.college}</span>}
                  <span className="text-xs px-2 py-0.5 rounded font-bold" style={{background:posColor+'22',color:posColor}}>{p.pos}</span>
                </div>
              </div>
              {isCommissioner
                ?<div className="flex flex-col items-center justify-center rounded-xl p-3 min-w-[60px]" style={{background:'#fef3c7',border:'1px solid #b4530944'}}><span className="text-2xl font-black" style={{color:'#b45309'}}>{p.overall}</span><span className="text-xs font-semibold" style={{color:'#b45309'}}>OVR</span></div>
                :<div className="flex flex-col items-center justify-center rounded-xl p-3 min-w-[60px]" style={{background:'#f0ece5',border:'1px solid #d4cdc5'}}><span className="text-2xl font-black" style={{color:'#c8c0b4'}}>?</span><span className="text-xs font-semibold" style={{color:'#c8c0b4'}}>OVR</span></div>}
            </div>
            <div className="flex gap-6 mt-3 flex-wrap">
              {infoItems.map(item=><div key={item.label}><div className="text-xs" style={{color:'#8a8279'}}>{item.label}</div><div className="font-bold text-sm" style={{color:'#1a1512'}}>{item.val}</div></div>)}
            </div>
            {p.notes&&<div className="mt-3 text-sm px-3 py-2 rounded-lg" style={{background:'#f0ece5',color:'#5c554e',borderLeft:'3px solid '+posColor}}>{p.notes}</div>}
          </div>
        </div>
      </div>

      {!isCommissioner&&myTeamId&&(
        <div style={{marginBottom:20,padding:'12px 16px',borderRadius:10,background:'#ede9fe',border:'1px solid #c4b5fd',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
          <div style={{fontSize:12,color:'#5b21b6'}}>
            🔍 {isPT?<>Scouted: <strong>{revealedCount}/30</strong> atributos revelados para {p.name}</>:<>Scouted: <strong>{revealedCount}/30</strong> attributes revealed for {p.name}</>}
          </div>
          <a href="/scouting" style={{fontSize:12,fontWeight:700,color:'#fff',background:'#6d28d9',padding:'6px 14px',borderRadius:8,textDecoration:'none'}}>
            {isPT?'Fazer Scouting →':'Scout this player →'}
          </a>
        </div>
      )}

      <div className="sec-hdr mb-4"><span className="sec-title">{isPT?'Atributos':'Attributes'}</span></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {ATTR_GROUPS.map(group=>(
          <div key={group.label} className="rounded-xl p-4" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'2px solid '+group.color}}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:group.color,letterSpacing:'1px'}}>{group.label}</div>
            {group.attrs.map((attr:any)=>(
              <div key={attr.key} className="mb-2">
                <div className="text-xs mb-0.5 flex items-center" style={{color:'#5c554e'}}>{attr.label}</div>
                <AttrBar value={p[attr.key]||0} color={group.color} revealed={isRevealed(attr.key)}/>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

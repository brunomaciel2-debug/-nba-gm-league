'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BannerUpload from './BannerUpload'
import { useTranslation } from '@/components/I18nProvider'

// ── Translation hook bridge (used by sub-components via prop) ──
// Sub-components receive isPT as prop to avoid hook rules issues

function LogoRow({ item, table, onSave, saving, saved, isPT }: {
  item:any, table:string, onSave:(id:string,url:string,table:string)=>void,
  saving:string|null, saved:string|null, isPT:boolean
}) {
  const [url, setUrl] = React.useState(item.logo_url||'')
  const id = item.id
  return (
    <div style={{display:'flex',alignItems:'center',gap:16,padding:16,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12}}>
      <div style={{width:56,height:56,borderRadius:12,flexShrink:0,overflow:'hidden',background:'#f0ece5',border:'2px solid #d4cdc5',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {url?<img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'contain',padding:4}} onError={e=>(e.currentTarget.style.display='none')}/>
          :<span style={{fontSize:10,fontWeight:900,color:'#5c554e'}}>{id}</span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1a1512',marginBottom:6}}>{item.name}</div>
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder={isPT?'Cola o URL do logo aqui...':'Paste logo URL here...'}
          style={{width:'100%',fontSize:11,padding:'6px 10px',borderRadius:8,boxSizing:'border-box' as const,background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
      </div>
      <button onClick={()=>onSave(id,url,table)} disabled={saving===id}
        style={{fontSize:11,fontWeight:700,padding:'8px 16px',borderRadius:8,flexShrink:0,minWidth:80,border:'none',cursor:'pointer',opacity:saving===id?0.4:1,background:saved===id?'#15803d':'#1d4ed8',color:'#fff'}}>
        {saving===id?(isPT?'A guardar...':'Saving...'):saved===id?'✔ '+(isPT?'Guardado':'Saved'):(isPT?'Guardar':'Save')}
      </button>
    </div>
  )
}

function PhotoRow({ item, type, onSave, saving, saved, isPT }: {
  item:any, type:'player'|'staff'|'prospect'|'referee',
  onSave:(id:string,url:string,type:'player'|'staff'|'prospect'|'referee')=>void,
  saving:string|null, saved:string|null, isPT:boolean
}) {
  const [url, setUrl] = React.useState(item.photo_url||'')
  return (
    <div style={{display:'flex',alignItems:'center',gap:16,padding:12,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12}}>
      <div style={{width:48,height:48,borderRadius:8,flexShrink:0,overflow:'hidden',background:'#d4cdc5',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {url?<img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          :<span style={{fontSize:13,fontWeight:900,color:'#6b5f4e'}}>{item.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
          <span style={{fontSize:13,fontWeight:600,color:'#1a1512'}}>{item.name}</span>
          {(item.pos||item.role)&&<span style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'#d4cdc5',color:'#5c554e'}}>{item.pos||item.role?.replace(/_/g,' ')}</span>}
          {item.age!=null&&<span style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'#e8e2d6',color:'#8a8279'}}>{isPT?'Idade':'Age'} {item.age}</span>}
          {type==='prospect'&&item.college&&<span style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'#e8e2d6',color:'#8a8279'}}>{item.college}</span>}
        </div>
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder={isPT?'Cola o URL da foto...':'Paste photo URL...'}
          style={{width:'100%',fontSize:11,padding:'5px 8px',borderRadius:6,boxSizing:'border-box' as const,background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
      </div>
      <button onClick={()=>onSave(item.id,url,type)} disabled={saving===item.id}
        style={{fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:8,flexShrink:0,minWidth:72,border:'none',cursor:'pointer',opacity:saving===item.id?0.4:1,background:saved===item.id?'#15803d':'#1d4ed8',color:'#fff'}}>
        {saving===item.id?'...':saved===item.id?'✔':(isPT?'Guardar':'Save')}
      </button>
    </div>
  )
}

const SPONSOR_TIER_CONFIG = {
  jersey:{label:'Jersey',         labelPT:'Camisola',         icon:'👕',color:'#1d4ed8',aspect:'64px / 80px',fit:'contain' as const},
  court: {label:'Court Logo',     labelPT:'Logo no Campo',    icon:'🏀',color:'#b45309',aspect:'80px / 60px',fit:'contain' as const},
  panels:{label:'Courtside Panel',labelPT:'Painel de Bancada',icon:'📺',color:'#15803d',aspect:'80px / 40px',fit:'contain' as const},
}

function SponsorImageRow({ teamId, tier, option, existing, onSave, saving, saved, isPT }: {
  teamId:string, tier:string, option:number, existing:any|null,
  onSave:(teamId:string,tier:string,option:number,companyName:string,url:string,description:string)=>void,
  saving:string|null, saved:string|null, isPT:boolean
}) {
  const key=`${teamId}_${tier}_${option}`
  const [url,setUrl]=React.useState(existing?.jersey_url||'')
  const [company,setCompany]=React.useState(existing?.company_name||'')
  const [description,setDescription]=React.useState(existing?.company_description||'')
  const cfg=SPONSOR_TIER_CONFIG[tier as keyof typeof SPONSOR_TIER_CONFIG]||SPONSOR_TIER_CONFIG.jersey
  const tierLabel = isPT ? cfg.labelPT : cfg.label

  return (
    <div style={{display:'flex',alignItems:'flex-start',gap:12,padding:14,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12}}>
      <div style={{width:80,height:60,borderRadius:8,flexShrink:0,overflow:'hidden',background:'#f0ece5',border:`2px solid ${url?cfg.color:'#d4cdc5'}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
        {url?<img src={url} alt="" style={{width:'100%',height:'100%',objectFit:cfg.fit}} onError={e=>(e.currentTarget.style.display='none')}/>:<span style={{fontSize:20}}>{cfg.icon}</span>}
      </div>
      <div style={{width:28,height:28,borderRadius:8,background:cfg.color+'22',flexShrink:0,border:`1px solid ${cfg.color}44`,marginTop:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:cfg.color}}>{option}</div>
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
        <input value={company} onChange={e=>setCompany(e.target.value)}
          placeholder={isPT?'Nome da empresa (ex: Adobe)':'Company name (e.g. Adobe)'}
          style={{fontSize:11,padding:'5px 8px',borderRadius:6,background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder={isPT?`URL da imagem ${tierLabel}...`:`${tierLabel} image URL...`}
          style={{fontSize:11,padding:'5px 8px',borderRadius:6,background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        <textarea value={description} onChange={e=>setDescription(e.target.value)}
          placeholder={isPT?'Breve descrição da empresa (mostrada como tooltip aos GMs)...':'Brief company description (shown as tooltip to GMs)...'}
          rows={2}
          style={{fontSize:11,padding:'5px 8px',borderRadius:6,resize:'vertical',background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
      </div>
      <button onClick={()=>onSave(teamId,tier,option,company,url,description)}
        disabled={saving===key||!url.trim()||!company.trim()}
        style={{fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:8,flexShrink:0,minWidth:72,border:'none',cursor:url&&company?'pointer':'not-allowed',opacity:saving===key||!url||!company?0.4:1,background:saved===key?'#15803d':cfg.color,color:'#fff',marginTop:4}}>
        {saving===key?'...':saved===key?'✔':(isPT?'Guardar':'Save')}
      </button>
    </div>
  )
}

function ArenaPhotoRow({ item, onSave, saving, saved, isPT }: {
  item:any, onSave:(id:string,url:string)=>void, saving:string|null, saved:string|null, isPT:boolean
}) {
  const [url, setUrl] = React.useState(item.arena_photo_url||'')
  return (
    <div style={{display:'flex',alignItems:'center',gap:16,padding:16,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12}}>
      <div style={{width:80,height:56,borderRadius:10,flexShrink:0,overflow:'hidden',background:'#f0ece5',border:'2px solid #d4cdc5',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {url?<img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>(e.currentTarget.style.display='none')}/>
          :<span style={{fontSize:20}}>🏟️</span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1a1512',marginBottom:2}}>{item.name}</div>
        <div style={{fontSize:11,color:'#8a8279',marginBottom:6}}>{item.arena||'—'}</div>
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder={isPT?'Cola o URL da foto do pavilhão...':'Paste arena photo URL...'}
          style={{width:'100%',fontSize:11,padding:'6px 10px',borderRadius:8,boxSizing:'border-box' as const,background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
      </div>
      <button onClick={()=>onSave(item.id,url)} disabled={saving===item.id}
        style={{fontSize:11,fontWeight:700,padding:'8px 16px',borderRadius:8,flexShrink:0,minWidth:80,border:'none',cursor:'pointer',opacity:saving===item.id?0.4:1,background:saved===item.id?'#15803d':'#1d4ed8',color:'#fff'}}>
        {saving===item.id?(isPT?'A guardar...':'Saving...'):saved===item.id?'✔ '+(isPT?'Guardado':'Saved'):(isPT?'Guardar':'Save')}
      </button>
    </div>
  )
}

function GMPhotoRow({ item, onSave, saving, saved, isPT }: {
  item:any, onSave:(id:string,url:string)=>void, saving:string|null, saved:string|null, isPT:boolean
}) {
  const [url, setUrl] = React.useState(item.photo_url||'')
  return (
    <div style={{display:'flex',alignItems:'center',gap:16,padding:12,background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12}}>
      <div style={{width:48,height:48,borderRadius:'50%',flexShrink:0,overflow:'hidden',background:'#d4cdc5',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {url?<img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          :<span style={{fontSize:13,fontWeight:900,color:'#6b5f4e'}}>{(item.display_name||'?').split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
          <span style={{fontSize:13,fontWeight:600,color:'#1a1512'}}>{item.display_name}</span>
          <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'#d4cdc5',color:'#5c554e'}}>{item.team_name || item.team_id}</span>
        </div>
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder={isPT?'Cola o URL da foto...':'Paste photo URL...'}
          style={{width:'100%',fontSize:11,padding:'5px 8px',borderRadius:6,boxSizing:'border-box' as const,background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
      </div>
      <button onClick={()=>onSave(item.id,url)} disabled={saving===item.id}
        style={{fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:8,flexShrink:0,minWidth:72,border:'none',cursor:'pointer',opacity:saving===item.id?0.4:1,background:saved===item.id?'#15803d':'#1d4ed8',color:'#fff'}}>
        {saving===item.id?'...':saved===item.id?'✔':(isPT?'Guardar':'Save')}
      </button>
    </div>
  )
}

type MainTab = 'logos'|'photos'|'jerseys'|'arenas'|'gms'
type LogoSection = 'nba'|'gleague'|'world'|'others'
type PhotoSection = 'players'|'staff'|'referees'

export default function AdminMediaPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [mainTab,setMainTab]=useState<MainTab>('logos')
  const [logoSec,setLogoSec]=useState<LogoSection>('nba')
  const [photoSec,setPhotoSec]=useState<PhotoSection>('players')
  const [saving,setSaving]=useState<string|null>(null)
  const [saved,setSaved]=useState<string|null>(null)
  const [nbaTeams,setNbaTeams]=useState<any[]>([])
  const [glTeams,setGlTeams]=useState<any[]>([])
  const [worldTeams,setWorldTeams]=useState<any[]>([])
  const [selPlayerTeam,setSelPlayerTeam]=useState<string>('')
  const [selStaffTeam,setSelStaffTeam]=useState<string>('')
  const [selJerseyTeam,setSelJerseyTeam]=useState<string>('')
  const [jerseyTier,setJerseyTier]=useState<'jersey'|'court'|'panels'>('jersey')
  const [photoItems,setPhotoItems]=useState<any[]>([])
  const [staffItems,setStaffItems]=useState<any[]>([])
  const [prospectItems,setProspectItems]=useState<any[]>([])
  const [refereeItems,setRefereeItems]=useState<any[]>([])
  const [sponsorImages,setSponsorImages]=useState<any[]>([])
  const [gmItems,setGmItems]=useState<any[]>([])

  useEffect(()=>{
    supabase.from('teams').select('id,name,logo_url,arena,arena_photo_url').order('name').then(({data})=>{if(data)setNbaTeams(data)})
    supabase.from('gleague_teams').select('id,name,logo_url').order('name').then(({data})=>{if(data)setGlTeams(data)})
    supabase.from('world_teams').select('id,name,logo_url,continent').order('continent').order('name').then(({data})=>{if(data)setWorldTeams(data)})
    supabase.from('prospects').select('id,name,pos,age,college,photo_url,season').eq('season','2027').order('name').then(({data})=>{if(data)setProspectItems(data)})
    supabase.from('referees').select('id,name,photo_url').order('name').then(({data})=>{if(data)setRefereeItems(data)})
    supabase.from('gm_profiles').select('id,team_id,display_name,photo_url').eq('role','gm').order('display_name').then(({data})=>{if(data)setGmItems(data)})
  },[])

  useEffect(()=>{
    if(!selPlayerTeam){setPhotoItems([]);return}
    if(selPlayerTeam==='FA'){
      supabase.from('players').select('id,name,pos,age,photo_url').is('team_id',null).is('gleague_team_id',null).is('world_team_id',null).eq('status','active').order('name').then(({data})=>setPhotoItems(data||[]))
    } else if(selPlayerTeam.startsWith('GL_')){
      supabase.from('players').select('id,name,pos,age,photo_url').eq('gleague_team_id',selPlayerTeam.replace('GL_','')).order('name').then(({data})=>setPhotoItems(data||[]))
    } else if(selPlayerTeam.startsWith('W_')){
      supabase.from('players').select('id,name,pos,age,photo_url').eq('world_team_id',selPlayerTeam.replace('W_','')).order('name').then(({data})=>setPhotoItems(data||[]))
    } else {
      supabase.from('players').select('id,name,pos,age,photo_url').eq('team_id',selPlayerTeam).order('usage',{ascending:false}).then(({data})=>setPhotoItems(data||[]))
    }
  },[selPlayerTeam])

  useEffect(()=>{
    if(!selStaffTeam){setStaffItems([]);return}
    if(selStaffTeam==='FA'){
      supabase.from('coaches').select('id,name,role,age,photo_url').is('team_id',null).is('gleague_team_id',null).then(({data})=>setStaffItems(data||[]))
    } else if(selStaffTeam.startsWith('GL_')){
      supabase.from('coaches').select('id,name,role,age,photo_url').eq('gleague_team_id',selStaffTeam.replace('GL_','')).order('name').then(({data})=>setStaffItems(data||[]))
    } else {
      supabase.from('coaches').select('id,name,role,age,photo_url').eq('team_id',selStaffTeam).order('name').then(({data})=>setStaffItems(data||[]))
    }
  },[selStaffTeam])

  useEffect(()=>{
    if(!selJerseyTeam){setSponsorImages([]);return}
    supabase.from('sponsor_jersey_images').select('*').eq('team_id',selJerseyTeam).eq('season','2025-26').order('tier').order('option_number').then(({data})=>setSponsorImages(data||[]))
  },[selJerseyTeam,jerseyTier])

  const saveLogo=async(id:string,url:string,table:string)=>{
    if(!url.trim())return; setSaving(id)
    await supabase.from(table).update({logo_url:url}).eq('id',id)
    if(table==='teams')setNbaTeams(tt=>tt.map((x:any)=>x.id===id?{...x,logo_url:url}:x))
    if(table==='gleague_teams')setGlTeams(tt=>tt.map((x:any)=>x.id===id?{...x,logo_url:url}:x))
    if(table==='world_teams')setWorldTeams(tt=>tt.map((x:any)=>x.id===id?{...x,logo_url:url}:x))
    setSaving(null);setSaved(id);setTimeout(()=>setSaved(null),1500)
  }

  const savePhoto=async(id:string,url:string,type:'player'|'staff'|'prospect'|'referee')=>{
    setSaving(id)
    let ok = true
    if(type==='prospect'){
      const { error } = await supabase.from('prospects').update({photo_url:url}).eq('id',id)
      if(error){ok=false;alert((isPT?'Erro ao guardar: ':'Error saving: ')+error.message)}
      else setProspectItems(p=>p.map((x:any)=>x.id===id?{...x,photo_url:url}:x))
    } else if(type==='referee'){
      const { error } = await supabase.from('referees').update({photo_url:url}).eq('id',id)
      if(error){ok=false;alert((isPT?'Erro ao guardar: ':'Error saving: ')+error.message)}
      else setRefereeItems(p=>p.map((x:any)=>x.id===id?{...x,photo_url:url}:x))
    } else {
      const table=type==='player'?'players':'coaches'
      const res=await fetch('/api/admin/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({table,id:type==='player'?Number(id):id,photo_url:url})})
      const json=await res.json().catch(()=>({}))
      if(!res.ok||json.error){ok=false;alert((isPT?'Erro ao guardar: ':'Error saving: ')+(json.error||res.statusText))}
      else if(type==='player')setPhotoItems(p=>p.map((x:any)=>x.id===id?{...x,photo_url:url}:x))
      else setStaffItems(p=>p.map((x:any)=>x.id===id?{...x,photo_url:url}:x))
    }
    setSaving(null)
    if(ok){setSaved(id);setTimeout(()=>setSaved(null),1500)}
  }

  const saveArenaPhoto=async(id:string,url:string)=>{
    if(!url.trim())return; setSaving(id)
    await supabase.from('teams').update({arena_photo_url:url}).eq('id',id)
    setNbaTeams(tt=>tt.map((x:any)=>x.id===id?{...x,arena_photo_url:url}:x))
    setSaving(null);setSaved(id);setTimeout(()=>setSaved(null),1500)
  }

  const saveGMPhoto=async(id:string,url:string)=>{
    if(!url.trim())return; setSaving(id)
    await supabase.from('gm_profiles').update({photo_url:url}).eq('id',id)
    setGmItems(gg=>gg.map((x:any)=>x.id===id?{...x,photo_url:url}:x))
    setSaving(null);setSaved(id);setTimeout(()=>setSaved(null),1500)
  }

  const saveSponsorImage=async(teamId:string,tier:string,option:number,companyName:string,url:string,description:string)=>{
    const key=`${teamId}_${tier}_${option}`; setSaving(key)
    const existing=sponsorImages.find(j=>j.option_number===option&&j.tier===tier)
    if(existing){await supabase.from('sponsor_jersey_images').update({jersey_url:url,company_name:companyName,company_description:description||null}).eq('id',existing.id)}
    else{await supabase.from('sponsor_jersey_images').insert({team_id:teamId,option_number:option,company_name:companyName,jersey_url:url,company_description:description||null,season:'2025-26',tier})}
    setSponsorImages(prev=>{const idx=prev.findIndex(j=>j.option_number===option&&j.tier===tier);const updated={team_id:teamId,option_number:option,company_name:companyName,jersey_url:url,company_description:description,tier};if(idx>=0)return prev.map((j,i)=>i===idx?{...j,...updated}:j);return[...prev,updated]})
    setSaving(null);setSaved(key);setTimeout(()=>setSaved(null),1500)
  }

  const btnStyle=(active:boolean)=>({padding:'8px 18px',borderRadius:8,fontSize:13,fontWeight:600,border:'none',cursor:'pointer',background:active?'#1a1512':'#f0ece5',color:active?'#fff':'#5c554e'})
  const subBtnStyle=(active:boolean,color='#1d4ed8')=>({padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:600,border:'1px solid '+(active?color:'#d4cdc5'),cursor:'pointer',background:active?color:'#faf8f5',color:active?'#fff':'#5c554e'})
  const sideBtn=(active:boolean)=>({width:'100%',textAlign:'left' as const,padding:'6px 10px',marginBottom:2,borderRadius:6,border:'1px solid',cursor:'pointer',fontSize:12,borderColor:active?'#1d4ed8':'transparent',background:active?'#e8f0fe':'transparent',color:active?'#1d4ed8':'#5c554e',fontWeight:active?700:400})

  const continents=worldTeams.map((tt:any)=>tt.continent).filter((v:any,i:number,a:any[])=>v&&a.indexOf(v)===i)
  const nbaRegular=nbaTeams.filter((tt:any)=>!['ALL','RVS','ROO','SOP'].includes(tt.id))
  const nbaSpecial=nbaTeams.filter((tt:any)=>['ALL','RVS','ROO','SOP'].includes(tt.id))
  const specialLabels: Record<string,string> = isPT
    ? {ALL:'All-Stars Este',RVS:'All-Stars Oeste',ROO:'Equipa Caloiros',SOP:'Equipa Veteranos'}
    : {ALL:'All-Stars East',RVS:'All-Stars West',ROO:'Rookie Team',SOP:'Sophomore Team'}

  const TAB_LABELS_EN = {logos:'🏀 Logos', photos:'👤 Personnel Photos', jerseys:'🤝 Sponsors', arenas:'🏟️ Arenas', gms:'🧑‍💼 GMs'}
  const TAB_LABELS_PT = {logos:'🏀 Logos', photos:'👤 Fotos de Pessoal', jerseys:'🤝 Patrocinadores', arenas:'🏟️ Arenas', gms:'🧑‍💼 GMs'}
  const TAB_LABELS = isPT ? TAB_LABELS_PT : TAB_LABELS_EN

  const LOGO_SEC_EN = {nba:'NBA Teams', gleague:'G-League', world:'Rest of the World', others:'Others'}
  const LOGO_SEC_PT = {nba:'Equipas NBA', gleague:'G-League', world:'Resto do Mundo', others:'Outros'}
  const LOGO_SEC = isPT ? LOGO_SEC_PT : LOGO_SEC_EN

  return (
    <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 16px'}}>

      <div style={{borderRadius:12,padding:20,marginBottom:24,background:'#e8e2d6',border:'1px solid #d4cec3',borderTop:'3px solid #b45309'}}>
        <h2 style={{fontSize:13,fontWeight:700,color:'#b45309',marginBottom:4}}>🖼 {isPT?'Banner do Site':'Site Banner'}</h2>
        <p style={{fontSize:11,color:'#6b5f4e',marginBottom:12}}>{isPT?'Recomendado: 1200×280px · JPG ou PNG':'Recommended: 1200×280px · JPG or PNG'}</p>
        <BannerUpload />
      </div>

      <h1 style={{fontSize:22,fontWeight:700,color:'#1a1512',marginBottom:4}}>🖼 {isPT?'Gestor de Media':'Media Manager'}</h1>
      <p style={{fontSize:12,color:'#6b5f4e',marginBottom:24}}>
        {isPT?'Gerir logos, fotos e jerseys de patrocinadores. Cola qualquer URL de imagem pública e clica em Guardar.':'Manage logos, photos and sponsor jerseys. Paste any public image URL and click Save.'}
      </p>

      <div style={{display:'flex',gap:8,marginBottom:24,borderBottom:'2px solid #d4cdc5',paddingBottom:0}}>
        {(['logos','photos','jerseys','arenas','gms'] as const).map(tb=>(
          <button key={tb} onClick={()=>setMainTab(tb)} style={{...btnStyle(mainTab===tb),borderBottom:mainTab===tb?'3px solid #c8102e':'3px solid transparent',borderRadius:0,marginBottom:-2,background:'transparent',color:mainTab===tb?'#1a1512':'#5c554e',fontWeight:mainTab===tb?700:500}}>
            {TAB_LABELS[tb]}
          </button>
        ))}
      </div>

      {/* LOGOS TAB */}
      {mainTab==='logos'&&(
        <div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
            {(['nba','gleague','world','others'] as const).map(s=>(
              <button key={s} onClick={()=>setLogoSec(s)} style={subBtnStyle(logoSec===s)}>{LOGO_SEC[s]}</button>
            ))}
          </div>
          {logoSec==='nba'&&<div style={{display:'flex',flexDirection:'column',gap:10}}>{nbaRegular.map((tt:any)=><LogoRow key={tt.id} item={tt} table="teams" onSave={saveLogo} saving={saving} saved={saved} isPT={isPT}/>)}</div>}
          {logoSec==='gleague'&&<div style={{display:'flex',flexDirection:'column',gap:10}}>{glTeams.map((tt:any)=><LogoRow key={tt.id} item={tt} table="gleague_teams" onSave={saveLogo} saving={saving} saved={saved} isPT={isPT}/>)}</div>}
          {logoSec==='world'&&(
            <div>
              {continents.map((cont:any)=>(
                <div key={cont}>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',margin:'16px 0 8px'}}>{cont}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>{worldTeams.filter((tt:any)=>tt.continent===cont).map((tt:any)=><LogoRow key={tt.id} item={tt} table="world_teams" onSave={saveLogo} saving={saving} saved={saved} isPT={isPT}/>)}</div>
                </div>
              ))}
            </div>
          )}
          {logoSec==='others'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {nbaSpecial.map((tt:any)=>(
                <div key={tt.id} style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
                  <div style={{padding:'8px 12px',fontSize:11,fontWeight:700,background:'#f0ece5',color:'#1a1512',borderBottom:'1px solid #d4cdc5'}}>{specialLabels[tt.id]||tt.name}</div>
                  <div style={{padding:12,background:'#faf8f5'}}><LogoRow item={tt} table="teams" onSave={saveLogo} saving={saving} saved={saved} isPT={isPT}/></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PHOTOS TAB */}
      {mainTab==='photos'&&(
        <div>
          <div style={{display:'flex',gap:8,marginBottom:20}}>
            <button onClick={()=>setPhotoSec('players')} style={subBtnStyle(photoSec==='players','#c8102e')}>🏀 {isPT?'Jogadores':'Players'}</button>
            <button onClick={()=>setPhotoSec('staff')} style={subBtnStyle(photoSec==='staff','#c8102e')}>👔 {isPT?'Staff':'Staff'}</button>
            <button onClick={()=>setPhotoSec('referees')} style={subBtnStyle(photoSec==='referees','#c8102e')}>👨‍⚖️ {isPT?'Árbitros':'Referees'}</button>
          </div>
          <div style={{display:'flex',gap:20}}>
            <div style={{width:200,flexShrink:0,background:'#f5f1eb',borderRadius:10,padding:'12px 8px',maxHeight:'80vh',overflowY:'auto',border:'1px solid #d4cdc5'}}>
              {photoSec==='players'&&(
                <>
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',padding:'4px 6px',marginBottom:4}}>NBA</div>
                  {nbaRegular.map((tt:any)=><button key={tt.id} style={sideBtn(selPlayerTeam===tt.id)} onClick={()=>setSelPlayerTeam(tt.id)}>{tt.name}</button>)}
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',padding:'8px 6px 4px',marginTop:4}}>G-League</div>
                  {glTeams.map((tt:any)=><button key={tt.id} style={sideBtn(selPlayerTeam===`GL_${tt.id}`)} onClick={()=>setSelPlayerTeam(`GL_${tt.id}`)}>{tt.name}</button>)}
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',padding:'8px 6px 4px',marginTop:4}}>{isPT?'Resto do Mundo':'Rest of the World'}</div>
                  {continents.map((cont:any)=>(
                    <React.Fragment key={cont}>
                      <div style={{fontSize:9,fontWeight:700,color:'#a89f97',padding:'4px 6px 2px'}}>{cont}</div>
                      {worldTeams.filter((tt:any)=>tt.continent===cont).map((tt:any)=>
                        <button key={tt.id} style={sideBtn(selPlayerTeam===`W_${tt.id}`)} onClick={()=>setSelPlayerTeam(`W_${tt.id}`)}>{tt.name}</button>
                      )}
                    </React.Fragment>
                  ))}
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',padding:'8px 6px 4px',marginTop:4}}>{isPT?'Outros':'Other'}</div>
                  <button style={sideBtn(selPlayerTeam==='FA')} onClick={()=>setSelPlayerTeam('FA')}>{isPT?'Agentes Livres':'Free Agents'}</button>
                  <button style={sideBtn(selPlayerTeam==='DRAFT')} onClick={()=>setSelPlayerTeam('DRAFT')}>{isPT?`Draft (${prospectItems.length})`:`Draft Pool (${prospectItems.length})`}</button>
                </>
              )}
              {photoSec==='staff'&&(
                <>
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',padding:'4px 6px',marginBottom:4}}>NBA</div>
                  {nbaRegular.map((tt:any)=><button key={tt.id} style={sideBtn(selStaffTeam===tt.id)} onClick={()=>setSelStaffTeam(tt.id)}>{tt.name}</button>)}
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',padding:'8px 6px 4px',marginTop:4}}>G-League</div>
                  {glTeams.map((tt:any)=><button key={tt.id} style={sideBtn(selStaffTeam===`GL_${tt.id}`)} onClick={()=>setSelStaffTeam(`GL_${tt.id}`)}>{tt.name}</button>)}
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',padding:'8px 6px 4px',marginTop:4}}>{isPT?'Outros':'Other'}</div>
                  <button style={sideBtn(selStaffTeam==='FA')} onClick={()=>setSelStaffTeam('FA')}>{isPT?'Staff Livre':'Staff FA'}</button>
                </>
              )}
              {photoSec==='referees'&&(
                <div style={{fontSize:11,color:'#8a8279',padding:'6px 6px'}}>
                  {isPT?`Pool de ${refereeItems.length} árbitros — sem agrupamento por equipa.`:`Pool of ${refereeItems.length} referees — no team grouping.`}
                </div>
              )}
            </div>
            <div style={{flex:1}}>
              {photoSec==='referees'&&(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>{refereeItems.map(r=><PhotoRow key={r.id} item={r} type="referee" onSave={savePhoto} saving={saving} saved={saved} isPT={isPT}/>)}</div>
              )}
              {photoSec==='players'&&(
                <>
                  {!selPlayerTeam&&<div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13,background:'#faf8f5',borderRadius:10,border:'1px solid #d4cdc5'}}>{isPT?'Selecciona uma equipa na barra lateral':'Select a team in the sidebar'}</div>}
                  {selPlayerTeam==='DRAFT'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>{prospectItems.map((p:any)=><PhotoRow key={p.id} item={p} type="prospect" onSave={savePhoto} saving={saving} saved={saved} isPT={isPT}/>)}</div>}
                  {selPlayerTeam&&selPlayerTeam!=='DRAFT'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>{photoItems.map(p=><PhotoRow key={p.id} item={p} type="player" onSave={savePhoto} saving={saving} saved={saved} isPT={isPT}/>)}</div>}
                </>
              )}
              {photoSec==='staff'&&(
                <>
                  {!selStaffTeam&&<div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13,background:'#faf8f5',borderRadius:10,border:'1px solid #d4cdc5'}}>{isPT?'Selecciona uma equipa na barra lateral':'Select a team in the sidebar'}</div>}
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>{staffItems.map(s=><PhotoRow key={s.id} item={s} type="staff" onSave={savePhoto} saving={saving} saved={saved} isPT={isPT}/>)}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JERSEYS TAB */}
      {mainTab==='jerseys'&&(
        <div style={{display:'flex',gap:20}}>
          <div style={{width:200,flexShrink:0,background:'#f5f1eb',borderRadius:10,padding:'12px 8px',maxHeight:'80vh',overflowY:'auto',border:'1px solid #d4cdc5'}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',padding:'4px 6px',marginBottom:4}}>{isPT?'Equipas NBA':'NBA Teams'}</div>
            {nbaRegular.map((tt:any)=><button key={tt.id} style={sideBtn(selJerseyTeam===tt.id)} onClick={()=>setSelJerseyTeam(tt.id)}>{tt.name}</button>)}
          </div>
          <div style={{flex:1}}>
            {!selJerseyTeam?(
              <div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13,background:'#faf8f5',borderRadius:10,border:'1px solid #d4cdc5'}}>
                {isPT?'Selecciona uma equipa para gerir as imagens de patrocínio':'Select a team to manage their sponsor images'}
              </div>
            ):(
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'#1a1512',marginBottom:4}}>
                  {nbaRegular.find((tt:any)=>tt.id===selJerseyTeam)?.name} — {isPT?'Imagens de Patrocínio':'Sponsor Images'}
                </div>
                <div style={{fontSize:11,color:'#8a8279',marginBottom:12}}>
                  {isPT?'3 opções por tier · Os GMs vêem estas antes de escolher um patrocinador':'3 options per tier · GMs see these before choosing a sponsor'}
                </div>
                <div style={{display:'flex',gap:6,marginBottom:14,borderBottom:'2px solid #e2dcd5'}}>
                  {(['jersey','court','panels'] as const).map(tier=>{
                    const cfg=SPONSOR_TIER_CONFIG[tier]
                    return(
                      <button key={tier} onClick={()=>setJerseyTier(tier)}
                        style={{padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:'transparent',marginBottom:-2,borderBottom:`3px solid ${jerseyTier===tier?cfg.color:'transparent'}`,color:jerseyTier===tier?cfg.color:'#8a8279'}}>
                        {cfg.icon} {isPT?cfg.labelPT:cfg.label}
                      </button>
                    )
                  })}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {[1,2,3].map(opt=>(
                    <SponsorImageRow key={`${selJerseyTeam}_${jerseyTier}_${opt}`}
                      teamId={selJerseyTeam} tier={jerseyTier} option={opt}
                      existing={sponsorImages.find(j=>j.option_number===opt&&j.tier===jerseyTier)||null}
                      onSave={saveSponsorImage} saving={saving} saved={saved} isPT={isPT}/>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ARENAS TAB */}
      {mainTab==='arenas'&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {nbaRegular.map((tt:any)=><ArenaPhotoRow key={tt.id} item={tt} onSave={saveArenaPhoto} saving={saving} saved={saved} isPT={isPT}/>)}
        </div>
      )}

      {/* GMS TAB */}
      {mainTab==='gms'&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {gmItems.length===0&&<div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13,background:'#faf8f5',borderRadius:10,border:'1px solid #d4cdc5'}}>{isPT?'Nenhum GM ativo de momento':'No active GMs right now'}</div>}
          {gmItems.map(g=><GMPhotoRow key={g.id} item={{...g, team_name: nbaRegular.find((tt:any)=>tt.id===g.team_id)?.name || g.team_id}} onSave={saveGMPhoto} saving={saving} saved={saved} isPT={isPT}/>)}
        </div>
      )}
    </div>
  )
}

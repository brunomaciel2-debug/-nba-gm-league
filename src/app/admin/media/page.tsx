'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BannerUpload from './BannerUpload'

function LogoRow({ item, table, onSave, saving, saved }: {
  item: any, table: string,
  onSave: (id:string, url:string, table:string) => void,
  saving: string|null, saved: string|null
}) {
  const [url, setUrl] = React.useState(item.logo_url||'')
  const id = item.id
  return (
    <div style={{display:'flex',alignItems:'center',gap:16,padding:16,
                 background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12}}>
      <div style={{width:56,height:56,borderRadius:12,flexShrink:0,overflow:'hidden',
                   background:'#f0ece5',border:'2px solid #d4cdc5',display:'flex',
                   alignItems:'center',justifyContent:'center'}}>
        {url
          ? <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'contain',padding:4}}
                 onError={e=>(e.currentTarget.style.display='none')}/>
          : <span style={{fontSize:10,fontWeight:900,color:'#5c554e'}}>{id}</span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1a1512',marginBottom:6}}>{item.name}</div>
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder="Paste logo URL here..."
          style={{width:'100%',fontSize:11,padding:'6px 10px',borderRadius:8,boxSizing:'border-box' as const,
                  background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
      </div>
      <button onClick={()=>onSave(id,url,table)}
        disabled={saving===id}
        style={{fontSize:11,fontWeight:700,padding:'8px 16px',borderRadius:8,flexShrink:0,
                minWidth:80,border:'none',cursor:'pointer',opacity:saving===id?0.4:1,
                background:saved===id?'#15803d':'#1d4ed8',color:'#fff'}}>
        {saving===id?'Saving...':saved===id?'✔ Saved':'Save'}
      </button>
    </div>
  )
}

function PhotoRow({ item, type, onSave, saving, saved }: {
  item: any, type: 'player'|'staff'|'prospect',
  onSave: (id:string, url:string, type:'player'|'staff'|'prospect') => void,
  saving: string|null, saved: string|null
}) {
  const [url, setUrl] = React.useState(item.photo_url||'')
  return (
    <div style={{display:'flex',alignItems:'center',gap:16,padding:12,
                 background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12}}>
      <div style={{width:48,height:48,borderRadius:8,flexShrink:0,overflow:'hidden',
                   background:'#d4cdc5',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {url
          ? <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          : <span style={{fontSize:13,fontWeight:900,color:'#6b5f4e'}}>
              {item.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
            </span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
          <span style={{fontSize:13,fontWeight:600,color:'#1a1512'}}>{item.name}</span>
          {(item.pos||item.role) && (
            <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,
                          background:'#d4cdc5',color:'#5c554e'}}>
              {item.pos||item.role?.replace(/_/g,' ')}
            </span>
          )}
          {type==='prospect' && item.college && (
            <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,
                          background:'#e8e2d6',color:'#8a8279'}}>
              {item.college}
            </span>
          )}
        </div>
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder="Paste photo URL..."
          style={{width:'100%',fontSize:11,padding:'5px 8px',borderRadius:6,boxSizing:'border-box' as const,
                  background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
      </div>
      <button onClick={()=>onSave(item.id,url,type)}
        disabled={saving===item.id}
        style={{fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:8,flexShrink:0,
                minWidth:72,border:'none',cursor:'pointer',opacity:saving===item.id?0.4:1,
                background:saved===item.id?'#15803d':'#1d4ed8',color:'#fff'}}>
        {saving===item.id?'...':saved===item.id?'✔':'Save'}
      </button>
    </div>
  )
}

// ── SPONSOR IMAGE ROW ──
const SPONSOR_TIER_CONFIG = {
  jersey: { label: 'Jersey', icon: '👕', color: '#1d4ed8', aspect: '64px / 80px', fit: 'contain' as const },
  court:  { label: 'Court Logo', icon: '🏀', color: '#b45309', aspect: '80px / 60px', fit: 'contain' as const },
  panels: { label: 'Courtside Panel', icon: '📺', color: '#15803d', aspect: '80px / 40px', fit: 'contain' as const },
}

function SponsorImageRow({ teamId, tier, option, existing, onSave, saving, saved }: {
  teamId: string, tier: string, option: number,
  existing: any|null,
  onSave: (teamId:string, tier:string, option:number, companyName:string, url:string, description:string) => void,
  saving: string|null, saved: string|null
}) {
  const key = `${teamId}_${tier}_${option}`
  const [url, setUrl] = React.useState(existing?.jersey_url||'')
  const [company, setCompany] = React.useState(existing?.company_name||'')
  const [description, setDescription] = React.useState(existing?.company_description||'')
  const cfg = SPONSOR_TIER_CONFIG[tier as keyof typeof SPONSOR_TIER_CONFIG] || SPONSOR_TIER_CONFIG.jersey

  return (
    <div style={{display:'flex',alignItems:'flex-start',gap:12,padding:14,
                 background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12}}>
      {/* Preview */}
      <div style={{width:80,height:60,borderRadius:8,flexShrink:0,overflow:'hidden',
                   background:'#f0ece5',border:`2px solid ${url?cfg.color:'#d4cdc5'}`,
                   display:'flex',alignItems:'center',justifyContent:'center'}}>
        {url
          ? <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:cfg.fit}}
                 onError={e=>(e.currentTarget.style.display='none')}/>
          : <span style={{fontSize:20}}>{cfg.icon}</span>}
      </div>
      {/* Option badge */}
      <div style={{width:28,height:28,borderRadius:8,background:cfg.color+'22',flexShrink:0,
                   border:`1px solid ${cfg.color}44`,marginTop:4,
                   display:'flex',alignItems:'center',justifyContent:'center',
                   fontSize:13,fontWeight:800,color:cfg.color}}>
        {option}
      </div>
      {/* Fields */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
        <input value={company} onChange={e=>setCompany(e.target.value)}
          placeholder="Company name (e.g. Adobe)"
          style={{fontSize:11,padding:'5px 8px',borderRadius:6,
                  background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder={`${cfg.label} image URL...`}
          style={{fontSize:11,padding:'5px 8px',borderRadius:6,
                  background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        <textarea value={description} onChange={e=>setDescription(e.target.value)}
          placeholder="Brief company description (shown as tooltip to GMs)..."
          rows={2}
          style={{fontSize:11,padding:'5px 8px',borderRadius:6,resize:'vertical',
                  background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
      </div>
      <button onClick={()=>onSave(teamId, tier, option, company, url, description)}
        disabled={saving===key||!url.trim()||!company.trim()}
        style={{fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:8,flexShrink:0,
                minWidth:72,border:'none',cursor:url&&company?'pointer':'not-allowed',
                opacity:saving===key||!url||!company?0.4:1,
                background:saved===key?'#15803d':cfg.color,color:'#fff',marginTop:4}}>
        {saving===key?'...':saved===key?'✔':'Save'}
      </button>
    </div>
  )
}

type MainTab = 'logos'|'photos'|'jerseys'
type LogoSection = 'nba'|'gleague'|'world'|'others'
type PhotoSection = 'players'|'staff'

export default function AdminMediaPage() {
  const [mainTab, setMainTab]   = useState<MainTab>('logos')
  const [logoSec, setLogoSec]   = useState<LogoSection>('nba')
  const [photoSec, setPhotoSec] = useState<PhotoSection>('players')
  const [saving, setSaving]     = useState<string|null>(null)
  const [saved,  setSaved]      = useState<string|null>(null)

  const [nbaTeams,    setNbaTeams]    = useState<any[]>([])
  const [glTeams,     setGlTeams]     = useState<any[]>([])
  const [worldTeams,  setWorldTeams]  = useState<any[]>([])

  const [selPlayerTeam, setSelPlayerTeam] = useState<string>('')
  const [selStaffTeam,  setSelStaffTeam]  = useState<string>('')
  const [selJerseyTeam, setSelJerseyTeam] = useState<string>('')
  const [jerseyTier, setJerseyTier] = useState<'jersey'|'court'|'panels'>('jersey')
  const [photoItems,    setPhotoItems]    = useState<any[]>([])
  const [staffItems,    setStaffItems]    = useState<any[]>([])
  const [prospectItems, setProspectItems] = useState<any[]>([])
  const [sponsorImages, setSponsorImages] = useState<any[]>([])

  useEffect(() => {
    supabase.from('teams').select('id,name,logo_url').order('name')
      .then(({data}) => { if (data) setNbaTeams(data) })
    supabase.from('gleague_teams').select('id,name,logo_url').order('name')
      .then(({data}) => { if (data) setGlTeams(data) })
    supabase.from('world_teams').select('id,name,logo_url,continent').order('continent').order('name')
      .then(({data}) => { if (data) setWorldTeams(data) })
    supabase.from('prospects').select('id,name,pos,college,photo_url,season')
      .eq('season','2027').order('name')
      .then(({data}) => { if (data) setProspectItems(data) })
  }, [])

  useEffect(() => {
    if (!selPlayerTeam) { setPhotoItems([]); return }
    if (selPlayerTeam === 'FA') {
      supabase.from('players').select('id,name,pos,photo_url')
        .is('team_id',null).is('gleague_team_id',null).is('world_team_id',null)
        .eq('status','active').order('name')
        .then(({data}) => setPhotoItems(data||[]))
    } else if (selPlayerTeam.startsWith('GL_')) {
      const glId = selPlayerTeam.replace('GL_','')
      supabase.from('players').select('id,name,pos,photo_url')
        .eq('gleague_team_id',glId).order('name')
        .then(({data}) => setPhotoItems(data||[]))
    } else {
      supabase.from('players').select('id,name,pos,photo_url')
        .eq('team_id',selPlayerTeam).order('usage',{ascending:false})
        .then(({data}) => setPhotoItems(data||[]))
    }
  }, [selPlayerTeam])

  useEffect(() => {
    if (!selStaffTeam) { setStaffItems([]); return }
    if (selStaffTeam === 'FA') {
      supabase.from('coaches').select('id,name,role,photo_url')
        .is('team_id',null).is('gleague_team_id',null)
        .then(({data}) => setStaffItems(data||[]))
    } else if (selStaffTeam.startsWith('GL_')) {
      const glId = selStaffTeam.replace('GL_','')
      supabase.from('coaches').select('id,name,role,photo_url')
        .eq('gleague_team_id',glId).order('name')
        .then(({data}) => setStaffItems(data||[]))
    } else {
      supabase.from('coaches').select('id,name,role,photo_url')
        .eq('team_id',selStaffTeam).order('name')
        .then(({data}) => setStaffItems(data||[]))
    }
  }, [selStaffTeam])

  useEffect(() => {
    if (!selJerseyTeam) { setSponsorImages([]); return }
    supabase.from('sponsor_jersey_images')
      .select('*').eq('team_id', selJerseyTeam).eq('season','2025-26')
      .order('tier').order('option_number')
      .then(({data}) => setSponsorImages(data||[]))
  }, [selJerseyTeam, jerseyTier])

  const saveLogo = async (id:string, url:string, table:string) => {
    if (!url.trim()) return
    setSaving(id)
    await supabase.from(table).update({ logo_url: url }).eq('id', id)
    if (table==='teams') setNbaTeams(t=>t.map((x:any)=>x.id===id?{...x,logo_url:url}:x))
    if (table==='gleague_teams') setGlTeams(t=>t.map((x:any)=>x.id===id?{...x,logo_url:url}:x))
    if (table==='world_teams') setWorldTeams(t=>t.map((x:any)=>x.id===id?{...x,logo_url:url}:x))
    setSaving(null); setSaved(id); setTimeout(()=>setSaved(null),1500)
  }

  const savePhoto = async (id:string, url:string, type:'player'|'staff'|'prospect') => {
    setSaving(id)
    if (type === 'prospect') {
      await supabase.from('prospects').update({ photo_url: url }).eq('id', id)
      setProspectItems(p=>p.map((x:any)=>x.id===id?{...x,photo_url:url}:x))
    } else {
      const table = type==='player'?'players':'coaches'
      await fetch('/api/admin/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({table,id:type==='player'?Number(id):id,photo_url:url})})
      if (type==='player') setPhotoItems(p=>p.map((x:any)=>x.id===id?{...x,photo_url:url}:x))
      else setStaffItems(p=>p.map((x:any)=>x.id===id?{...x,photo_url:url}:x))
    }
    setSaving(null); setSaved(id); setTimeout(()=>setSaved(null),1500)
  }

  const saveSponsorImage = async (teamId:string, tier:string, option:number, companyName:string, url:string, description:string) => {
    const key = `${teamId}_${tier}_${option}`
    setSaving(key)
    const existing = sponsorImages.find(j=>j.option_number===option && j.tier===tier)
    if (existing) {
      await supabase.from('sponsor_jersey_images')
        .update({jersey_url:url, company_name:companyName, company_description:description||null})
        .eq('id', existing.id)
    } else {
      await supabase.from('sponsor_jersey_images')
        .insert({team_id:teamId, option_number:option, company_name:companyName, jersey_url:url, company_description:description||null, season:'2025-26', tier})
    }
    setSponsorImages(prev => {
      const idx = prev.findIndex(j=>j.option_number===option && j.tier===tier)
      const updated = {team_id:teamId, option_number:option, company_name:companyName, jersey_url:url, company_description:description, tier}
      if (idx>=0) return prev.map((j,i)=>i===idx?{...j,...updated}:j)
      return [...prev, updated]
    })
    setSaving(null); setSaved(key); setTimeout(()=>setSaved(null),1500)
  }

  const btnStyle = (active:boolean) => ({
    padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600,
    border:'none', cursor:'pointer',
    background: active ? '#1a1512' : '#f0ece5',
    color: active ? '#fff' : '#5c554e',
  })

  const subBtnStyle = (active:boolean, color='#1d4ed8') => ({
    padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:600,
    border:'1px solid '+(active?color:'#d4cdc5'), cursor:'pointer',
    background: active ? color : '#faf8f5',
    color: active ? '#fff' : '#5c554e',
  })

  const sideBtn = (active:boolean) => ({
    width:'100%', textAlign:'left' as const, padding:'6px 10px', marginBottom:2,
    borderRadius:6, border:'1px solid', cursor:'pointer', fontSize:12,
    borderColor: active ? '#1d4ed8' : 'transparent',
    background: active ? '#e8f0fe' : 'transparent',
    color: active ? '#1d4ed8' : '#5c554e',
    fontWeight: active ? 700 : 400,
  })

  const continents = worldTeams.map((t:any)=>t.continent).filter((v:any,i:number,a:any[])=>v&&a.indexOf(v)===i)
  const nbaRegular = nbaTeams.filter((t:any)=>!['ALL','RVS','ROO','SOP'].includes(t.id))
  const nbaSpecial = nbaTeams.filter((t:any)=>['ALL','RVS','ROO','SOP'].includes(t.id))
  const specialLabels: Record<string,string> = {ALL:'All-Stars East',RVS:'All-Stars West',ROO:'Rookie Team',SOP:'Sophomore Team'}

  return (
    <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 16px'}}>

      <div style={{borderRadius:12,padding:20,marginBottom:24,
                   background:'#e8e2d6',border:'1px solid #d4cec3',borderTop:'3px solid #b45309'}}>
        <h2 style={{fontSize:13,fontWeight:700,color:'#b45309',marginBottom:4}}>🖼 Site Banner</h2>
        <p style={{fontSize:11,color:'#6b5f4e',marginBottom:12}}>Recommended: 1200×280px · JPG or PNG</p>
        <BannerUpload />
      </div>

      <h1 style={{fontSize:22,fontWeight:700,color:'#1a1512',marginBottom:4}}>🖼 Media Manager</h1>
      <p style={{fontSize:12,color:'#6b5f4e',marginBottom:24}}>
        Manage logos, photos and sponsor jerseys. Paste any public image URL and click Save.
      </p>

      <div style={{display:'flex',gap:8,marginBottom:24,borderBottom:'2px solid #d4cdc5',paddingBottom:0}}>
        {(['logos','photos','jerseys'] as const).map(t => (
          <button key={t} onClick={()=>setMainTab(t)} style={{
            ...btnStyle(mainTab===t),
            borderBottom: mainTab===t ? '3px solid #c8102e' : '3px solid transparent',
            borderRadius:0, marginBottom:-2, background:'transparent',
            color: mainTab===t ? '#1a1512' : '#5c554e',
            fontWeight: mainTab===t ? 700 : 500,
          }}>
            {t==='logos' ? '🏀 Logos' : t==='photos' ? '👤 Personnel Photos' : '🤝 Sponsors'}
          </button>
        ))}
      </div>

      {/* LOGOS TAB */}
      {mainTab === 'logos' && (
        <div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
            {(['nba','gleague','world','others'] as const).map(s => (
              <button key={s} onClick={()=>setLogoSec(s)} style={subBtnStyle(logoSec===s)}>
                {s==='nba'?'NBA Teams':s==='gleague'?'G-League':s==='world'?'Rest of the World':'Others'}
              </button>
            ))}
          </div>
          {logoSec==='nba' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {nbaRegular.map((t:any) => (
                <LogoRow key={t.id} item={t} table="teams" onSave={saveLogo} saving={saving} saved={saved}/>
              ))}
            </div>
          )}
          {logoSec==='gleague' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {glTeams.map((t:any) => (
                <LogoRow key={t.id} item={t} table="gleague_teams" onSave={saveLogo} saving={saving} saved={saved}/>
              ))}
            </div>
          )}
          {logoSec==='world' && (
            <div>
              {continents.map((cont:any) => (
                <div key={cont}>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,
                               color:'#8a8279',margin:'16px 0 8px'}}>{cont}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {worldTeams.filter((t:any)=>t.continent===cont).map((t:any) => (
                      <LogoRow key={t.id} item={t} table="world_teams" onSave={saveLogo} saving={saving} saved={saved}/>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {logoSec==='others' && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {nbaSpecial.map((t:any) => (
                <div key={t.id} style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
                  <div style={{padding:'8px 12px',fontSize:11,fontWeight:700,
                               background:'#f0ece5',color:'#1a1512',borderBottom:'1px solid #d4cdc5'}}>
                    {specialLabels[t.id]||t.name}
                  </div>
                  <div style={{padding:12,background:'#faf8f5'}}>
                    <LogoRow item={t} table="teams" onSave={saveLogo} saving={saving} saved={saved}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PHOTOS TAB */}
      {mainTab === 'photos' && (
        <div>
          <div style={{display:'flex',gap:8,marginBottom:20}}>
            <button onClick={()=>setPhotoSec('players')} style={subBtnStyle(photoSec==='players','#c8102e')}>
              🏀 Players
            </button>
            <button onClick={()=>setPhotoSec('staff')} style={subBtnStyle(photoSec==='staff','#c8102e')}>
              👔 Staff
            </button>
          </div>

          <div style={{display:'flex',gap:20}}>
            <div style={{width:200,flexShrink:0,background:'#f5f1eb',borderRadius:10,
                         padding:'12px 8px',maxHeight:'80vh',overflowY:'auto',
                         border:'1px solid #d4cdc5'}}>
              {photoSec==='players' && (
                <>
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,
                               color:'#8a8279',padding:'4px 6px',marginBottom:4}}>NBA</div>
                  {nbaRegular.map((t:any) => (
                    <button key={t.id} style={sideBtn(selPlayerTeam===t.id)}
                            onClick={()=>setSelPlayerTeam(t.id)}>{t.name}</button>
                  ))}
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,
                               color:'#8a8279',padding:'8px 6px 4px',marginTop:4}}>G-League</div>
                  {glTeams.map((t:any) => (
                    <button key={t.id} style={sideBtn(selPlayerTeam===`GL_${t.id}`)}
                            onClick={()=>setSelPlayerTeam(`GL_${t.id}`)}>{t.name}</button>
                  ))}
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,
                               color:'#8a8279',padding:'8px 6px 4px',marginTop:4}}>Other</div>
                  <button style={sideBtn(selPlayerTeam==='FA')} onClick={()=>setSelPlayerTeam('FA')}>Free Agents</button>
                  <button style={sideBtn(selPlayerTeam==='DRAFT')} onClick={()=>setSelPlayerTeam('DRAFT')}>
                    Draft Pool ({prospectItems.length})
                  </button>
                </>
              )}
              {photoSec==='staff' && (
                <>
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,
                               color:'#8a8279',padding:'4px 6px',marginBottom:4}}>NBA</div>
                  {nbaRegular.map((t:any) => (
                    <button key={t.id} style={sideBtn(selStaffTeam===t.id)}
                            onClick={()=>setSelStaffTeam(t.id)}>{t.name}</button>
                  ))}
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,
                               color:'#8a8279',padding:'8px 6px 4px',marginTop:4}}>G-League</div>
                  {glTeams.map((t:any) => (
                    <button key={t.id} style={sideBtn(selStaffTeam===`GL_${t.id}`)}
                            onClick={()=>setSelStaffTeam(`GL_${t.id}`)}>{t.name}</button>
                  ))}
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,
                               color:'#8a8279',padding:'8px 6px 4px',marginTop:4}}>Other</div>
                  <button style={sideBtn(selStaffTeam==='FA')} onClick={()=>setSelStaffTeam('FA')}>Staff FA</button>
                </>
              )}
            </div>

            <div style={{flex:1}}>
              {photoSec==='players' && (
                <>
                  {!selPlayerTeam && (
                    <div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13,
                                 background:'#faf8f5',borderRadius:10,border:'1px solid #d4cdc5'}}>
                      Selecciona uma equipa na sidebar
                    </div>
                  )}
                  {selPlayerTeam==='DRAFT' && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {prospectItems.map((p:any) => (
                        <PhotoRow key={p.id} item={p} type="prospect" onSave={savePhoto} saving={saving} saved={saved}/>
                      ))}
                    </div>
                  )}
                  {selPlayerTeam && selPlayerTeam!=='DRAFT' && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {photoItems.map(p => (
                        <PhotoRow key={p.id} item={p} type="player" onSave={savePhoto} saving={saving} saved={saved}/>
                      ))}
                    </div>
                  )}
                </>
              )}
              {photoSec==='staff' && (
                <>
                  {!selStaffTeam && (
                    <div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13,
                                 background:'#faf8f5',borderRadius:10,border:'1px solid #d4cdc5'}}>
                      Selecciona uma equipa na sidebar
                    </div>
                  )}
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {staffItems.map(s => (
                      <PhotoRow key={s.id} item={s} type="staff" onSave={savePhoto} saving={saving} saved={saved}/>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JERSEYS TAB */}
      {mainTab === 'jerseys' && (
        <div style={{display:'flex',gap:20}}>
          {/* Sidebar */}
          <div style={{width:200,flexShrink:0,background:'#f5f1eb',borderRadius:10,
                       padding:'12px 8px',maxHeight:'80vh',overflowY:'auto',
                       border:'1px solid #d4cdc5'}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,
                         color:'#8a8279',padding:'4px 6px',marginBottom:4}}>NBA Teams</div>
            {nbaRegular.map((t:any) => (
              <button key={t.id} style={sideBtn(selJerseyTeam===t.id)}
                      onClick={()=>setSelJerseyTeam(t.id)}>
                {t.name}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{flex:1}}>
            {!selJerseyTeam ? (
              <div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13,
                           background:'#faf8f5',borderRadius:10,border:'1px solid #d4cdc5'}}>
                Select a team to manage their sponsor images
              </div>
            ) : (
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'#1a1512',marginBottom:4}}>
                  {nbaRegular.find((t:any)=>t.id===selJerseyTeam)?.name} — Sponsor Images
                </div>
                <div style={{fontSize:11,color:'#8a8279',marginBottom:12}}>
                  3 options per tier · GMs see these before choosing a sponsor
                </div>

                {/* Tier tabs */}
                <div style={{display:'flex',gap:6,marginBottom:14,borderBottom:'2px solid #e2dcd5'}}>
                  {(['jersey','court','panels'] as const).map(tier => {
                    const cfg = SPONSOR_TIER_CONFIG[tier]
                    return (
                      <button key={tier} onClick={()=>setJerseyTier(tier)}
                        style={{padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',
                                border:'none',background:'transparent',marginBottom:-2,
                                borderBottom:`3px solid ${jerseyTier===tier?cfg.color:'transparent'}`,
                                color:jerseyTier===tier?cfg.color:'#8a8279'}}>
                        {cfg.icon} {cfg.label}
                      </button>
                    )
                  })}
                </div>

                {/* Image slots */}
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {[1,2,3].map(opt => (
                    <SponsorImageRow
                      key={`${selJerseyTeam}_${jerseyTier}_${opt}`}
                      teamId={selJerseyTeam}
                      tier={jerseyTier}
                      option={opt}
                      existing={sponsorImages.find(j=>j.option_number===opt && j.tier===jerseyTier)||null}
                      onSave={saveSponsorImage}
                      saving={saving}
                      saved={saved}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

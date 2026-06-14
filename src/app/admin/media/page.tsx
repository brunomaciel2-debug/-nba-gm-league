'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BannerUpload from './BannerUpload'

function LogoRow({ item, table, idField='id', onSave, saving, saved }: {
  item: any, table: string, idField?: string,
  onSave: (id:string, url:string, table:string) => void,
  saving: string|null, saved: string|null
}) {
  const [url, setUrl] = React.useState(item.logo_url||'')
  const id = item[idField]
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
          style={{width:'100%',fontSize:11,padding:'6px 10px',borderRadius:8,boxSizing:'border-box',
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
  item: any, type: 'player'|'staff',
  onSave: (id:string, url:string, type:'player'|'staff') => void,
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
          <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,
                        background:'#d4cdc5',color:'#5c554e'}}>{item.pos||item.role?.replace(/_/g,' ')}</span>
        </div>
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder="Paste photo URL..."
          style={{width:'100%',fontSize:11,padding:'5px 8px',borderRadius:6,boxSizing:'border-box',
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

type LogoSection = 'nba'|'gleague'|'world'|'others'
type PhotoSection = 'players'|'staff'
type MainTab = 'logos'|'photos'

export default function AdminMediaPage() {
  const [mainTab,   setMainTab]   = useState<MainTab>('logos')
  const [logoSec,   setLogoSec]   = useState<LogoSection>('nba')
  const [photoSec,  setPhotoSec]  = useState<PhotoSection>('players')
  const [saving,    setSaving]    = useState<string|null>(null)
  const [saved,     setSaved]     = useState<string|null>(null)
  const [debugMsg,  setDebugMsg]  = useState<string>('')

  const [nbaTeams,   setNbaTeams]   = useState<any[]>([])
  const [glTeams,    setGlTeams]    = useState<any[]>([])
  const [worldTeams, setWorldTeams] = useState<any[]>([])
  const [nbaForFilter, setNbaForFilter] = useState<any[]>([])
  const [selTeam,    setSelTeam]    = useState<string>('')
  const [photoItems, setPhotoItems] = useState<any[]>([])
  const [staffItems, setStaffItems] = useState<any[]>([])
  const [selStaffTeam, setSelStaffTeam] = useState<string>('')

  useEffect(() => {
    supabase.from('teams').select('id,name,color,logo_url').order('name')
      .then(({data, error}) => {
        if (error) setDebugMsg('Teams error: ' + error.message)
        if (data) {
          setNbaTeams(data.filter((t:any) => !['ALL','RVS','ROO','SOP'].includes(t.id)))
          setNbaForFilter(data)
        }
      })
    supabase.from('gleague_teams').select('id,name,color,logo_url,conference').order('name')
      .then(({data, error}) => {
        if (error) setDebugMsg('GL error: ' + error.message)
        if (data) { setGlTeams(data) }
      })
    supabase.from('world_teams').select('id,name,color,logo_url,continent,country').order('continent').order('name')
      .then(({data, error}) => {
        if (error) setDebugMsg('World error: ' + error.message)
        if (data) setWorldTeams(data)
      })
  }, [])

  // Fetch players
  useEffect(() => {
    if (!selTeam) { setPhotoItems([]); return }
    if (selTeam === 'GLEAGUE') {
      supabase.from('players').select('id,name,pos,photo_url')
        .not('gleague_team_id','is',null).is('team_id',null)
        .order('usage',{ascending:false})
        .then(({data}) => setPhotoItems(data||[]))
    } else if (selTeam === 'FA') {
      supabase.from('players').select('id,name,pos,photo_url')
        .is('team_id',null).is('gleague_team_id',null).eq('status','active')
        .order('usage',{ascending:false})
        .then(({data}) => setPhotoItems(data||[]))
    } else {
      supabase.from('players').select('id,name,pos,photo_url')
        .eq('team_id',selTeam).order('usage',{ascending:false})
        .then(({data}) => setPhotoItems(data||[]))
    }
  }, [selTeam])

  // Fetch staff - usa service role via API para evitar problemas de RLS
  useEffect(() => {
    if (!selStaffTeam) { setStaffItems([]); return }
    setDebugMsg('A carregar staff para: ' + selStaffTeam)
    
    const loadStaff = async () => {
      const res = await fetch(`/api/admin/media?type=staff&team=${selStaffTeam}`)
      const json = await res.json()
      if (json.error) {
        setDebugMsg('Staff error: ' + json.error)
      } else {
        setDebugMsg('Staff carregado: ' + (json.staff?.length || 0) + ' membros')
        setStaffItems(json.staff || [])
      }
    }
    loadStaff()
  }, [selStaffTeam])

  const saveLogo = async (id:string, url:string, table:string) => {
    if (!url.trim()) return
    setSaving(id)
    const res = await fetch('/api/admin/media', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ table, id, field:'logo_url', value:url })
    })
    if (!res.ok) { setSaving(null); alert('Save failed'); return }
    if (table==='teams') {
      setNbaTeams(t=>t.map((x:any)=>x.id===id?{...x,logo_url:url}:x))
    } else if (table==='gleague_teams') {
      setGlTeams(t=>t.map((x:any)=>x.id===id?{...x,logo_url:url}:x))
    } else {
      setWorldTeams(t=>t.map((x:any)=>x.id===id?{...x,logo_url:url}:x))
    }
    setSaving(null); setSaved(id); setTimeout(()=>setSaved(null),1500)
  }

  const savePhoto = async (id:string, url:string, type:'player'|'staff') => {
    setSaving(id)
    const photoType = type==='player' ? 'player_photo' : 'staff_photo'
    const res = await fetch('/api/admin/media', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ type: photoType, id, url })
    })
    if (!res.ok) { setSaving(null); alert('Save failed'); return }
    if (type==='player') {
      setPhotoItems(p=>p.map((x:any)=>x.id===id?{...x,photo_url:url}:x))
    } else {
      setStaffItems(p=>p.map((x:any)=>x.id===id?{...x,photo_url:url}:x))
    }
    setSaving(null); setSaved(id); setTimeout(()=>setSaved(null),1500)
  }

  const playerTeamOptions = [
    {value:'', label:'— Select team —'},
    ...(nbaForFilter.filter((t:any)=>!['ALL','RVS','ROO','SOP'].includes(t.id)).map((t:any)=>({value:t.id,label:t.name}))),
    {value:'GLEAGUE', label:'── G-League Players ──'},
    {value:'FA', label:'── Free Agents ──'},
  ]

  const staffTeamOptions = [
    {value:'', label:'— Select team —'},
    ...(nbaForFilter.filter((t:any)=>!['ALL','RVS','ROO','SOP'].includes(t.id)).map((t:any)=>({value:t.id,label:t.name}))),
    {value:'GLEAGUE', label:'── G-League Staff ──'},
    {value:'FA', label:'── Staff Free Agents ──'},
  ]

  const LOGO_SECTIONS: {key:LogoSection, label:string}[] = [
    {key:'nba', label:'NBA Teams'},
    {key:'gleague', label:'G-League Teams'},
    {key:'world', label:'Rest of the World'},
    {key:'others', label:'Others'},
  ]
  const PHOTO_SECTIONS: {key:PhotoSection, label:string}[] = [
    {key:'players', label:'Players'},
    {key:'staff', label:'Staff'},
  ]

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

  return (
    <div style={{maxWidth:960,margin:'0 auto',padding:'24px 16px'}}>

      <div style={{borderRadius:12,padding:20,marginBottom:24,
                   background:'#e8e2d6',border:'1px solid #d4cec3',borderTop:'3px solid #b45309'}}>
        <h2 style={{fontSize:13,fontWeight:700,color:'#b45309',marginBottom:4}}>🖼 Site Banner</h2>
        <p style={{fontSize:11,color:'#6b5f4e',marginBottom:12}}>Recommended: 1200x280px · JPG or PNG</p>
        <BannerUpload />
      </div>

      <h1 style={{fontSize:22,fontWeight:700,color:'#1a1512',marginBottom:4}}>🖼 Media Manager</h1>
      <p style={{fontSize:12,color:'#6b5f4e',marginBottom:24}}>
        Manage logos and photos. Paste any public image URL and click Save.
      </p>

      {/* Debug message */}
      {debugMsg && (
        <div style={{background:'#fef3c7',border:'1px solid #f59e0b',borderRadius:8,
                     padding:'8px 12px',marginBottom:16,fontSize:12,color:'#92400e'}}>
          🔍 {debugMsg}
        </div>
      )}

      {/* MAIN TABS */}
      <div style={{display:'flex',gap:8,marginBottom:24,borderBottom:'2px solid #d4cdc5',paddingBottom:0}}>
        {(['logos','photos'] as const).map(t => (
          <button key={t} onClick={()=>setMainTab(t)} style={{
            ...btnStyle(mainTab===t),
            borderBottom: mainTab===t ? '3px solid #c8102e' : '3px solid transparent',
            borderRadius:0, marginBottom:-2, background:'transparent',
            color: mainTab===t ? '#1a1512' : '#5c554e',
            fontWeight: mainTab===t ? 700 : 500,
          }}>
            {t==='logos' ? '🏀 Logos' : '👤 Photos'}
          </button>
        ))}
      </div>

      {/* LOGOS */}
      {mainTab === 'logos' && (
        <div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
            {LOGO_SECTIONS.map(s => (
              <button key={s.key} onClick={()=>setLogoSec(s.key)} style={subBtnStyle(logoSec===s.key)}>
                {s.label}
              </button>
            ))}
          </div>

          {logoSec === 'nba' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {nbaTeams.map(t => (
                <LogoRow key={t.id} item={t} table="teams" onSave={saveLogo} saving={saving} saved={saved}/>
              ))}
            </div>
          )}

          {logoSec === 'gleague' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {glTeams.map(t => (
                <LogoRow key={t.id} item={t} table="gleague_teams" onSave={saveLogo} saving={saving} saved={saved}/>
              ))}
            </div>
          )}

          {logoSec === 'world' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {worldTeams.map((t:any) => (
                <LogoRow key={t.id} item={t} table="world_teams" onSave={saveLogo} saving={saving} saved={saved}/>
              ))}
            </div>
          )}

          {logoSec === 'others' && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {['ALL','RVS','ROO','SOP'].map(id => {
                const labels: Record<string,string> = {
                  ALL:'All-Stars East', RVS:'All-Stars West',
                  ROO:'Rookie Team', SOP:'Sophomore Team'
                }
                const found = nbaForFilter.find((t:any) => t.id === id)
                const item = found || { id, name: labels[id], logo_url: '' }
                return (
                  <div key={id} style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
                    <div style={{padding:'8px 12px',fontSize:11,fontWeight:700,background:'#f0ece5',color:'#1a1512'}}>
                      {labels[id]}
                    </div>
                    <div style={{padding:12,background:'#faf8f5'}}>
                      {found
                        ? <LogoRow item={item} table="teams" onSave={saveLogo} saving={saving} saved={saved}/>
                        : <div style={{fontSize:12,color:'#8a8279'}}>Not found in DB</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* PHOTOS */}
      {mainTab === 'photos' && (
        <div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
            {PHOTO_SECTIONS.map(s => (
              <button key={s.key} onClick={()=>setPhotoSec(s.key)} style={subBtnStyle(photoSec===s.key,'#c8102e')}>
                {s.label}
              </button>
            ))}
          </div>

          {/* PLAYERS */}
          {photoSec === 'players' && (
            <div>
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,fontWeight:700,textTransform:'uppercase',
                               letterSpacing:'1px',color:'#5c554e',display:'block',marginBottom:6}}>
                  Filter by Team
                </label>
                <select value={selTeam} onChange={e=>setSelTeam(e.target.value)}
                  style={{width:'100%',padding:'10px 12px',borderRadius:10,fontSize:13,
                          background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}}>
                  {playerTeamOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {!selTeam && (
                <div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13}}>
                  Select a team to manage player photos.
                </div>
              )}
              {selTeam && photoItems.length === 0 && (
                <div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13}}>No players found.</div>
              )}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {photoItems.map(p => (
                  <PhotoRow key={p.id} item={p} type="player" onSave={savePhoto} saving={saving} saved={saved}/>
                ))}
              </div>
            </div>
          )}

          {/* STAFF */}
          {photoSec === 'staff' && (
            <div>
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,fontWeight:700,textTransform:'uppercase',
                               letterSpacing:'1px',color:'#5c554e',display:'block',marginBottom:6}}>
                  Filter by Team
                </label>
                <select value={selStaffTeam} onChange={e=>setSelStaffTeam(e.target.value)}
                  style={{width:'100%',padding:'10px 12px',borderRadius:10,fontSize:13,
                          background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}}>
                  {staffTeamOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {!selStaffTeam && (
                <div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13}}>
                  Select a team to manage staff photos.
                </div>
              )}
              {selStaffTeam && staffItems.length === 0 && (
                <div style={{textAlign:'center',padding:32,color:'#8a8279',fontSize:13}}>No staff found.</div>
              )}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {staffItems.map(s => (
                  <PhotoRow key={s.id} item={s} type="staff" onSave={savePhoto} saving={saving} saved={saved}/>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

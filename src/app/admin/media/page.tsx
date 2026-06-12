'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BannerUpload from './BannerUpload'

export default function AdminMediaPage() {
  const [teams, setTeams]   = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [selTeam, setSelTeam] = useState('')
  const [tab, setTab] = useState<'logos'|'photos'>('logos')
  const [saving, setSaving] = useState<string|null>(null)
  const [saved,  setSaved]  = useState<string|null>(null)

  useEffect(() => {
    supabase.from('teams').select('id,name,color,logo_url').order('name').then(({data})=>data&&setTeams(data))
  }, [])

  useEffect(() => {
    if (!selTeam) return
    supabase.from('players').select('id,name,pos,photo_url').eq('team_id',selTeam)
      .order('usage',{ascending:false}).then(({data})=>data&&setPlayers(data))
  }, [selTeam])

  const saveLogo = async (teamId:string, url:string) => {
    setSaving(teamId)
    await supabase.from('teams').update({ logo_url: url }).eq('id', teamId)
    setTeams(t=>t.map(x=>x.id===teamId?{...x,logo_url:url}:x))
    setSaving(null);setSaved(teamId);setTimeout(()=>setSaved(null),1500)
  }

  const savePhoto = async (playerId:string, url:string) => {
    setSaving(playerId)
    await supabase.from('players').update({ photo_url: url }).eq('id', playerId)
    setPlayers(p=>p.map(x=>x.id===playerId?{...x,photo_url:url}:x))
    setSaving(null);setSaved(playerId);setTimeout(()=>setSaved(null),1500)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* BANNER UPLOAD */}
      <div className="rounded-xl p-5 mb-6" style={{background:'#e8e2d6',border:'1px solid #d4cec3',borderTop:'3px solid #ffd040'}}>
        <h2 className="text-sm font-bold mb-1" style={{color:'#b45309'}}>🖼️ Site Banner</h2>
        <p className="text-xs mb-3" style={{color:'#6b5f4e'}}>Recommended size: 1200×280px · JPG or PNG · Used at top of homepage</p>
        <BannerUpload />
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">🖼️ Media Manager</h1>
      <p className="text-sm mb-6" style={{ color:'#6b5f4e' }}>
        Upload team logos and player photos. Paste any public image URL (e.g. from ESPN, NBA.com, Wikipedia).
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['logos','photos'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className="px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
            style={{ background:tab===t?'#d4cdc5':'#faf8f5',
                     color:tab===t?'#60a0ff':'#5c554e',
                     border:'1px solid '+(tab===t?'#3a6a9f':'#d4cdc5') }}>
            {t==='logos'?'🏀 Team Logos':'👤 Player Photos'}
          </button>
        ))}
      </div>

      {/* LOGOS TAB */}
      {tab === 'logos' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs mb-2" style={{ color:'#6b5f4e' }}>
            Tip: Find logos on Wikipedia (right-click image → Copy image address) or wikimedia.org
          </p>
          {teams.map(team => (
            <div key={team.id} className="flex items-center gap-4 p-4 rounded-xl"
                 style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
              {/* Preview */}
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                   style={{ background:'#'+team.color+'22',border:'1px solid #'+team.color+'44' }}>
                {team.logo_url
                  ? <img src={team.logo_url} alt="" className="w-full h-full object-contain p-1" />
                  : <span className="text-xs font-black" style={{ color:'#'+team.color }}>{team.id}</span>
                }
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white mb-1">{team.name}</div>
                <input
                  defaultValue={team.logo_url||''}
                  onBlur={e=>saveLogo(team.id,e.target.value)}
                  placeholder="Paste logo URL here..."
                  className="w-full text-xs px-3 py-2 rounded-lg"
                  style={{ background:'#ddd7ca',border:'1px solid #d4cec3',color:'#1a1512',outline:'none' }}
                />
              </div>
              <span className="text-xs flex-shrink-0 w-16 text-center"
                    style={{ color:saved===team.id?'#40e080':saving===team.id?'#5c554e':'transparent' }}>
                {saved===team.id?'✓ Saved':saving===team.id?'Saving...':''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* PHOTOS TAB */}
      {tab === 'photos' && (
        <div>
          <div className="mb-4">
            <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color:'#6b5f4e' }}>
              Select Team
            </label>
            <select value={selTeam} onChange={e=>setSelTeam(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={{ background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1512',outline:'none' }}>
              <option value="">— Choose a team —</option>
              {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {selTeam && (
            <div className="flex flex-col gap-3">
              <p className="text-xs mb-1" style={{ color:'#6b5f4e' }}>
                Tip: Find headshots on ESPN (right-click → Copy image address) or cdn.nba.com
              </p>
              {players.map(p => (
                <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl"
                     style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
                  {/* Photo preview */}
                  <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden"
                       style={{ background:'#d4cdc5' }}>
                    {p.photo_url
                      ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-sm font-black"
                              style={{ color:'#6b5f4e' }}>
                          {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                        </div>
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{p.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background:'#d4cdc5',color:'#6b5f4e' }}>{p.pos}</span>
                    </div>
                    <input
                      defaultValue={p.photo_url||''}
                      onBlur={e=>savePhoto(p.id,e.target.value)}
                      placeholder="Paste photo URL..."
                      className="w-full text-xs px-3 py-1.5 rounded-lg"
                      style={{ background:'#ddd7ca',border:'1px solid #d4cec3',color:'#1a1512',outline:'none' }}
                    />
                  </div>
                  <span className="text-xs flex-shrink-0 w-16 text-center"
                        style={{ color:saved===p.id?'#40e080':saving===p.id?'#5c554e':'transparent' }}>
                    {saved===p.id?'✓ Saved':saving===p.id?'Saving...':''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

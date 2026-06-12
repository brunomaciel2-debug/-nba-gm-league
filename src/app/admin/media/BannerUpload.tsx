'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function BannerUpload() {
  const [url,     setUrl]     = useState('')
  const [current, setCurrent] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    supabase.from('site_config').select('banner_url').eq('id',1).single()
      .then(({data}) => { if(data?.banner_url) { setUrl(data.banner_url); setCurrent(data.banner_url) }})
  }, [])

  const save = async () => {
    setSaving(true)
    await supabase.from('site_config').update({banner_url:url,updated_at:new Date().toISOString()}).eq('id',1)
    setCurrent(url)
    setSaving(false); setSaved(true)
    setTimeout(()=>setSaved(false),2000)
  }

  return (
    <div>
      {current && (
        <div className="rounded-xl overflow-hidden mb-3" style={{height:120}}>
          <img src={current} alt="Current banner" className="w-full h-full object-cover"/>
        </div>
      )}
      <div className="flex gap-3">
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder="Paste banner image URL (1200×280px recommended)..."
          className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}}/>
        <button onClick={save} disabled={saving||!url}
          className="px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
          style={{background:saved?'#0a5a20':'#ffd040',color:saved?'#40e080':'#1a1610'}}>
          {saving?'...':saved?'✓ Saved':'Set Banner'}
        </button>
        {current && (
          <button onClick={async()=>{await supabase.from('site_config').update({banner_url:null}).eq('id',1);setCurrent('');setUrl('')}}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{background:'#fee2e2',color:'#dc2626'}}>
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

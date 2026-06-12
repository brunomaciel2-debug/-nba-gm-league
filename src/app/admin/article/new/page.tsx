'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

const POSITIONS = [
  {
    value: 'featured_1',
    label: '📌 Featured Left',
    desc: 'Left column highlight below the hero. Good for important news, injury reports, trade summaries.',
    preview: 'Left column · Below hero · 1 article max',
    color: '#60a0ff',
    bg: '#0a1a3a',
  },
  {
    value: 'featured_2',
    label: '📌 Featured Right',
    desc: 'Right column highlight below the hero. Good for standings updates, weekly recaps, GM moves.',
    preview: 'Right column · Below hero · 1 article max',
    color: '#40e080',
    bg: '#0a2a10',
  },
  {
    value: 'news',
    label: '📰 Latest News',
    desc: 'Regular news feed below the featured sections. Multiple articles can be here.',
    preview: 'News feed · Multiple articles · Chronological',
    color: '#5c554e',
    bg: '#e8e2d9',
  },
]

export default function NewArticlePage() {
  const { user, profile } = useAuth()
  const [title,    setTitle]    = useState('')
  const [excerpt,  setExcerpt]  = useState('')
  const [content,  setContent]  = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [tags,     setTags]     = useState('')
  const [position, setPosition] = useState('featured_1')
  const [published,setPublished]= useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')

  const save = async () => {
    if (!title || !content) { setError('Title and content are required.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('articles').insert({
      title, excerpt, content,
      cover_image: imageUrl,
      tags: tags.split(',').map(t=>t.trim()).filter(Boolean),
      published,
      position,
      // author_id handled by RLS
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + Date.now(),
    })
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); setSaved(true)
    setTimeout(()=>setSaved(false), 3000)
    if (published) {
      setTitle(''); setExcerpt(''); setContent(''); setImageUrl(''); setTags('')
    }
  }

  const selectedPos = POSITIONS.find(p=>p.value===position)!

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-xs no-underline" style={{color:'#6b5f4e'}}>← Admin</a>
        <h1 className="text-xl font-bold" style={{color:'#1a1612'}}>✍️ New Article</h1>
      </div>

      {/* Position selector */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-widest mb-3"
               style={{color:'#6b5f4e'}}>
          Where should this article appear?
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {POSITIONS.map(pos => (
            <button key={pos.value} onClick={() => setPosition(pos.value)}
              className="rounded-xl p-3 text-left transition-all"
              style={{background:position===pos.value?pos.bg:'#ede8df',
                      border:'2px solid '+(position===pos.value?pos.color:'#b8ae9e')}}>
              <div className="text-sm mb-1">{pos.label}</div>
              <div className="text-xs leading-tight" style={{color:position===pos.value?pos.color:'#9c8e7a'}}>
                {pos.preview}
              </div>
            </button>
          ))}
        </div>
        {/* Preview of selected position */}
        <div className="rounded-xl px-4 py-3 text-xs" style={{background:selectedPos.bg,border:'1px solid '+selectedPos.color+'44'}}>
          <span className="font-semibold" style={{color:selectedPos.color}}>{selectedPos.label} — </span>
          <span style={{color:'#6b5f4e'}}>{selectedPos.desc}</span>
        </div>
      </div>

      {/* Homepage preview */}
      <div className="mb-6 rounded-xl overflow-hidden" style={{border:'1px solid #d4cec3'}}>
        <div className="px-4 py-2 text-xs font-semibold" style={{background:'#ddd7ca',color:'#6b5f4e',borderBottom:'1px solid #d4cec3'}}>
          Homepage layout preview
        </div>
        <div className="p-3" style={{background:'#ede8de'}}>
          {/* Hero */}
          <div className="rounded-lg mb-2 p-2 text-center text-xs font-semibold"
               style={{background:position==='hero'?'#2a2000':'#ede8df',
                       border:'1px solid '+(position==='hero'?'#ffd040':'#d4cdc5'),
                       color:position==='hero'?'#ffd040':'#a89f97',height:48,
                       display:'flex',alignItems:'center',justifyContent:'center'}}>
            🏆 Hero Banner {position==='hero'&&'← This article'}
          </div>
          {/* Featured columns */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {['featured_1','featured_2'].map((pos,i) => (
              <div key={pos} className="rounded-lg p-2 text-center text-xs font-semibold"
                   style={{background:position===pos?POSITIONS.find(p=>p.value===pos)!.bg:'#ede8df',
                           border:'1px solid '+(position===pos?POSITIONS.find(p=>p.value===pos)!.color:'#b8ae9e'),
                           color:position===pos?POSITIONS.find(p=>p.value===pos)!.color:'#b8ae9e',height:36,
                           display:'flex',alignItems:'center',justifyContent:'center'}}>
                📌 Featured {i+1} {position===pos&&'← Here'}
              </div>
            ))}
          </div>
          {/* News feed */}
          <div className="rounded-lg p-2 text-center text-xs font-semibold"
               style={{background:position==='news'?'#e8e2d9':'#e8e2d9',
                       border:'1px solid '+(position==='news'?'#5c554e':'#d4cdc5'),
                       color:position==='news'?'#5c554e':'#a89f97',height:28,
                       display:'flex',alignItems:'center',justifyContent:'center'}}>
            📰 News Feed {position==='news'&&'← This article'}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl p-6" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
        {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{background:'#fee2e2',color:'#dc2626'}}>{error}</div>}

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>Title *</label>
          <input value={title} onChange={e=>setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}}
            placeholder="Article title..." />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>Excerpt</label>
          <input value={excerpt} onChange={e=>setExcerpt(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}}
            placeholder="Short summary shown on the homepage..." />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>Cover Image URL</label>
          <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}}
            placeholder="https://..." />
          {imageUrl && (
            <div className="mt-2 rounded-lg overflow-hidden h-32">
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>Tags (comma separated)</label>
          <input value={tags} onChange={e=>setTags(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}}
            placeholder="Trade, Injury, Week Recap..." />
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>Content *</label>
          <textarea value={content} onChange={e=>setContent(e.target.value)} rows={10}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
            style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612',lineHeight:1.6}}
            placeholder="Write your article here..." />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)} />
            <span className="text-sm" style={{color:'#6b5f4e'}}>Publish immediately</span>
          </label>
          <button onClick={save} disabled={saving}
            className="px-8 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 transition-all"
            style={{background:saved?'#0a5a20':'#3a8adf',color:saved?'#40e080':'#e8e2d6'}}>
            {saving?'Saving...':saved?'✓ Saved!':'Save Article'}
          </button>
        </div>
      </div>
    </div>
  )
}

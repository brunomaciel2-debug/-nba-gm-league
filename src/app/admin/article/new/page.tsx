'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

const POSITIONS = [
  {
    value: 'hero',
    label: '🏆 Hero Banner',
    desc: 'Large featured image at the top of the homepage. Best for major announcements, season previews, big trades.',
    preview: 'Full-width banner · 1 article max · Most visible',
    color: '#ffd040',
    bg: '#2a2000',
  },
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
    color: '#8a7a6a',
    bg: '#1a1610',
  },
]

export default function NewArticlePage() {
  const { user, profile } = useAuth()
  const [title,    setTitle]    = useState('')
  const [excerpt,  setExcerpt]  = useState('')
  const [content,  setContent]  = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [tags,     setTags]     = useState('')
  const [position, setPosition] = useState('hero')
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
      author_id: user?.id,
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
        <a href="/admin" className="text-xs no-underline" style={{color:'#8a7a6a'}}>← Admin</a>
        <h1 className="text-xl font-bold" style={{color:'#f0ebe0'}}>✍️ New Article</h1>
      </div>

      {/* Position selector */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-widest mb-3"
               style={{color:'#6a5a4a'}}>
          Where should this article appear?
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {POSITIONS.map(pos => (
            <button key={pos.value} onClick={() => setPosition(pos.value)}
              className="rounded-xl p-3 text-left transition-all"
              style={{background:position===pos.value?pos.bg:'#241f18',
                      border:'2px solid '+(position===pos.value?pos.color:'#3a3228')}}>
              <div className="text-sm mb-1">{pos.label}</div>
              <div className="text-xs leading-tight" style={{color:position===pos.value?pos.color:'#5a4a3a'}}>
                {pos.preview}
              </div>
            </button>
          ))}
        </div>
        {/* Preview of selected position */}
        <div className="rounded-xl px-4 py-3 text-xs" style={{background:selectedPos.bg,border:'1px solid '+selectedPos.color+'44'}}>
          <span className="font-semibold" style={{color:selectedPos.color}}>{selectedPos.label} — </span>
          <span style={{color:'#8a7a6a'}}>{selectedPos.desc}</span>
        </div>
      </div>

      {/* Homepage preview */}
      <div className="mb-6 rounded-xl overflow-hidden" style={{border:'1px solid #3a3228'}}>
        <div className="px-4 py-2 text-xs font-semibold" style={{background:'#120f0a',color:'#6a5a4a',borderBottom:'1px solid #3a3228'}}>
          Homepage layout preview
        </div>
        <div className="p-3" style={{background:'#1a1610'}}>
          {/* Hero */}
          <div className="rounded-lg mb-2 p-2 text-center text-xs font-semibold"
               style={{background:position==='hero'?'#2a2000':'#241f18',
                       border:'1px solid '+(position==='hero'?'#ffd040':'#3a3228'),
                       color:position==='hero'?'#ffd040':'#4a3a2a',height:48,
                       display:'flex',alignItems:'center',justifyContent:'center'}}>
            🏆 Hero Banner {position==='hero'&&'← This article'}
          </div>
          {/* Featured columns */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {['featured_1','featured_2'].map((pos,i) => (
              <div key={pos} className="rounded-lg p-2 text-center text-xs font-semibold"
                   style={{background:position===pos?POSITIONS.find(p=>p.value===pos)!.bg:'#241f18',
                           border:'1px solid '+(position===pos?POSITIONS.find(p=>p.value===pos)!.color:'#3a3228'),
                           color:position===pos?POSITIONS.find(p=>p.value===pos)!.color:'#4a3a2a',height:36,
                           display:'flex',alignItems:'center',justifyContent:'center'}}>
                📌 Featured {i+1} {position===pos&&'← Here'}
              </div>
            ))}
          </div>
          {/* News feed */}
          <div className="rounded-lg p-2 text-center text-xs font-semibold"
               style={{background:position==='news'?'#1a1610':'#1a1610',
                       border:'1px solid '+(position==='news'?'#8a7a6a':'#3a3228'),
                       color:position==='news'?'#8a7a6a':'#4a3a2a',height:28,
                       display:'flex',alignItems:'center',justifyContent:'center'}}>
            📰 News Feed {position==='news'&&'← This article'}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl p-6" style={{background:'#241f18',border:'1px solid #3a3228'}}>
        {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{background:'#2a0a0a',color:'#e04040'}}>{error}</div>}

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>Title *</label>
          <input value={title} onChange={e=>setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#1a1610',border:'1px solid #3a3228',color:'#f0ebe0'}}
            placeholder="Article title..." />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>Excerpt</label>
          <input value={excerpt} onChange={e=>setExcerpt(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#1a1610',border:'1px solid #3a3228',color:'#f0ebe0'}}
            placeholder="Short summary shown on the homepage..." />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>Cover Image URL</label>
          <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#1a1610',border:'1px solid #3a3228',color:'#f0ebe0'}}
            placeholder="https://..." />
          {imageUrl && (
            <div className="mt-2 rounded-lg overflow-hidden h-32">
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>Tags (comma separated)</label>
          <input value={tags} onChange={e=>setTags(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#1a1610',border:'1px solid #3a3228',color:'#f0ebe0'}}
            placeholder="Trade, Injury, Week Recap..." />
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>Content *</label>
          <textarea value={content} onChange={e=>setContent(e.target.value)} rows={10}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
            style={{background:'#1a1610',border:'1px solid #3a3228',color:'#f0ebe0',lineHeight:1.6}}
            placeholder="Write your article here..." />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)} />
            <span className="text-sm" style={{color:'#8a7a6a'}}>Publish immediately</span>
          </label>
          <button onClick={save} disabled={saving}
            className="px-8 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 transition-all"
            style={{background:saved?'#0a5a20':'#3a8adf',color:saved?'#40e080':'#fff'}}>
            {saving?'Saving...':saved?'✓ Saved!':'Save Article'}
          </button>
        </div>
      </div>
    </div>
  )
}

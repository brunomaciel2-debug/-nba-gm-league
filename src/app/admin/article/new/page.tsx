'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function NewArticlePage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [tags, setTags] = useState('')
  const [published, setPublished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') + '-' + Date.now()

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('articles').insert({
      title, content, excerpt, cover_image: coverImage,
      tags: tags.split(',').map(t=>t.trim()).filter(Boolean),
      published, slug,
    })
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(()=>setSaved(false),2000) }
    else alert('Error: ' + error.message)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">✍️ New Article</h1>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color:'#7090b0' }}>Title *</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Article headline..."
            className="w-full px-4 py-3 rounded-xl text-white text-base"
            style={{ background:'#0f1e33',border:'1px solid #1e3a5f',outline:'none' }} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color:'#7090b0' }}>Excerpt</label>
          <input value={excerpt} onChange={e=>setExcerpt(e.target.value)} placeholder="Short summary (shown on home page)..."
            className="w-full px-4 py-3 rounded-xl text-white"
            style={{ background:'#0f1e33',border:'1px solid #1e3a5f',outline:'none' }} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color:'#7090b0' }}>Cover Image URL</label>
          <input value={coverImage} onChange={e=>setCoverImage(e.target.value)} placeholder="https://..."
            className="w-full px-4 py-3 rounded-xl text-white"
            style={{ background:'#0f1e33',border:'1px solid #1e3a5f',outline:'none' }} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color:'#7090b0' }}>Tags (comma separated)</label>
          <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="Trade, Injury, Week Recap..."
            className="w-full px-4 py-3 rounded-xl text-white"
            style={{ background:'#0f1e33',border:'1px solid #1e3a5f',outline:'none' }} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color:'#7090b0' }}>Content *</label>
          <textarea value={content} onChange={e=>setContent(e.target.value)}
            rows={16} placeholder="Write your article here... HTML is supported."
            className="w-full px-4 py-3 rounded-xl text-white text-sm font-mono"
            style={{ background:'#0f1e33',border:'1px solid #1e3a5f',outline:'none',resize:'vertical' }} />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm" style={{ color:'#c0ccd8' }}>Publish immediately</span>
          </label>
          <button onClick={save} disabled={saving||!title||!content}
            className="px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
            style={{ background: saved?'#0a5a20':'#1e3a5f', color:saved?'#40e080':'#60a0ff' }}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Article'}
          </button>
        </div>
      </div>
    </div>
  )
}

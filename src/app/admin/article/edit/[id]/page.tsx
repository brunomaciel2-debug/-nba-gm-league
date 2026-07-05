'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/I18nProvider'

export default function EditArticlePage({ params }: { params: { id: string } }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const router = useRouter()
  const [title,     setTitle]     = useState('')
  const [excerpt,   setExcerpt]   = useState('')
  const [content,   setContent]   = useState('')
  const [imageUrl,  setImageUrl]  = useState('')
  const [tags,      setTags]      = useState('')
  const [position,  setPosition]  = useState('news')
  const [published, setPublished] = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [loading,   setLoading]   = useState(true)

  const POSITIONS = [
    {value:'featured_1', label:isPT?'📌 Destaque Esquerda':'📌 Featured Left',  color:'#1e40af'},
    {value:'featured_2', label:isPT?'📌 Destaque Direita':'📌 Featured Right', color:'#166534'},
    {value:'news',       label:isPT?'📰 Últimas Notícias':'📰 Latest News',    color:'#6b5f4e'},
  ]

  useEffect(() => {
    supabase.from('articles').select('*').eq('id', params.id).single().then(({data}) => {
      if (data) {
        setTitle(data.title||'')
        setExcerpt(data.excerpt||'')
        setContent(data.content||'')
        setImageUrl(data.cover_image||'')
        setTags((data.tags||[]).join(', '))
        setPosition(['featured_1','featured_2','news'].includes(data.position) ? data.position : 'news')
        setPublished(data.published??true)
      }
      setLoading(false)
    })
  }, [params.id])

  const save = async () => {
    setSaving(true)
    await supabase.from('articles').update({
      title, excerpt, content,
      cover_image: imageUrl,
      tags: tags.split(',').map(t=>t.trim()).filter(Boolean),
      published, position,
    }).eq('id', params.id)
    setSaving(false); setSaved(true)
    setTimeout(()=>setSaved(false), 2000)
  }

  if (loading) return <div className="p-8 text-center" style={{color:'#6b5f4e'}}>{t('common.loading')}</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin/articles" className="text-xs no-underline" style={{color:'#6b5f4e'}}>← {isPT?'Artigos':'Articles'}</a>
        <h1 className="text-xl font-bold" style={{color:'#1a1612'}}>✏️ {isPT?'Editar Artigo':'Edit Article'}</h1>
      </div>

      {/* Position selector */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {POSITIONS.map(pos => (
          <button key={pos.value} onClick={()=>setPosition(pos.value)}
            className="rounded-xl p-2.5 text-center text-xs font-semibold transition-all"
            style={{background:position===pos.value?pos.color+'22':'#faf8f5',
                    border:'2px solid '+(position===pos.value?pos.color:'#b8ae9e'),
                    color:position===pos.value?pos.color:'#6b5f4e'}}>
            {pos.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl p-6" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>{isPT?'Título':'Title'}</label>
          <input value={title} onChange={e=>setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}} />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>{isPT?'Resumo':'Excerpt'}</label>
          <input value={excerpt} onChange={e=>setExcerpt(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}} />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>{isPT?'URL da Imagem de Capa':'Cover Image URL'}</label>
          <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}} />
          {imageUrl && <div className="mt-2 h-28 rounded-lg overflow-hidden"><img src={imageUrl} alt="" className="w-full h-full object-cover"/></div>}
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>{isPT?'Etiquetas':'Tags'}</label>
          <input value={tags} onChange={e=>setTags(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}} />
        </div>
        <div className="mb-6">
          <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>{isPT?'Conteúdo':'Content'}</label>
          <textarea value={content} onChange={e=>setContent(e.target.value)} rows={12}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
            style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612',lineHeight:1.6}} />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)} />
            <span className="text-sm" style={{color:'#6b5f4e'}}>{isPT?'Publicado':'Published'}</span>
          </label>
          <button onClick={save} disabled={saving}
            className="px-8 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
            style={{background:saved?'#0a5a20':'#1d4ed8',color:saved?'#15803d':'#e8e2d6'}}>
            {saving?(isPT?'A guardar...':'Saving...'):saved?(isPT?'✓ Guardado!':'✓ Saved!'):(isPT?'Guardar Alterações':'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  )
}

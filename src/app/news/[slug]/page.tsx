'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [loading, setLoading] = useState(true)
  const [article, setArticle] = useState<any>(null)

  useEffect(() => {
    supabase.from('articles').select('*').eq('slug', params.slug).eq('published', true).single()
      .then(({ data }) => { setArticle(data); setLoading(false) })
  }, [params.slug])

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-12 text-center" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  if (!article) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-sm" style={{ color: '#8a8279' }}>{isPT ? 'Artigo não encontrado.' : 'Article not found.'}</p>
      </div>
    )
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(isPT ? 'pt-PT' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/" className="text-xs no-underline mb-6 block" style={{ color: '#8a8279' }}>← {isPT ? 'Início' : 'Home'}</Link>

      {article.cover_image && (
        <img src={article.cover_image} alt="" className="w-full rounded-2xl mb-6" style={{ maxHeight: 360, objectFit: 'cover' }} />
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {(article.tags || []).map((tag: string) => (
          <span key={tag} className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#e8e2d6', color: '#6b5f4e' }}>{tag}</span>
        ))}
      </div>

      <h1 className="text-2xl font-black mb-3" style={{ color: '#1a1512' }}>{article.title}</h1>
      <p className="text-xs mb-6" style={{ color: '#8a8279' }}>{fmtDate(article.created_at)}</p>

      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#2a231e' }}>
        {article.content}
      </div>
    </div>
  )
}

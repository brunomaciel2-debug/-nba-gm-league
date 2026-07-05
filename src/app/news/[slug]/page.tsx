import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', params.slug)
    .eq('published', true)
    .single()

  if (!article) notFound()

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/" className="text-xs no-underline mb-6 block" style={{ color: '#8a8279' }}>← Home</Link>

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

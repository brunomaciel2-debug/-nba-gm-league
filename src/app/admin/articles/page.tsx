'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

const POSITION_LABELS: Record<string,{label:string,color:string}> = {
  hero:       {label:'🏆 Hero',         color:'#b45309'},
  featured_1: {label:'📌 Featured L',   color:'#1e40af'},
  featured_2: {label:'📌 Featured R',   color:'#166534'},
  news:       {label:'📰 News',         color:'#6b5f4e'},
}

export default function ManageArticlesPage() {
  const { user } = useAuth()
  const [articles, setArticles] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState<string|null>(null)
  const [toggling, setToggling] = useState<string|null>(null)

  const load = async () => {
    const { data } = await supabase.from('articles').select('*').order('created_at',{ascending:false})
    setArticles(data||[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const togglePublished = async (id: string, current: boolean) => {
    setToggling(id)
    await supabase.from('articles').update({published:!current}).eq('id',id)
    setArticles(a => a.map(x => x.id===id ? {...x,published:!current} : x))
    setToggling(null)
  }

  const deleteArticle = async (id: string) => {
    if (!confirm('Delete this article? This cannot be undone.')) return
    setDeleting(id)
    await supabase.from('articles').delete().eq('id',id)
    setArticles(a => a.filter(x => x.id!==id))
    setDeleting(null)
  }

  const posStyle = (pos: string) => POSITION_LABELS[pos] || {label:'📰 News',color:'#6b5f4e'}

  if (loading) return <div className="p-8 text-center" style={{color:'#6b5f4e'}}>Loading...</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{color:'#1a1612'}}>📋 Manage Articles</h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>{articles.length} articles total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/article/new"
            className="text-sm font-bold px-4 py-2 rounded-lg no-underline"
            style={{background:'#1d4ed8',color:'#e8e2d6'}}>
            ✍️ New Article
          </Link>
          <Link href="/admin"
            className="text-xs px-3 py-2 rounded-lg no-underline"
            style={{background:'#d4cdc5',color:'#6b5f4e'}}>
            ← Admin
          </Link>
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <p style={{color:'#6b5f4e'}}>No articles yet. Write your first one!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {articles.map(a => {
            const ps = posStyle(a.position||'news')
            return (
              <div key={a.id} className="rounded-xl overflow-hidden"
                   style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="flex items-start gap-4 p-4">
                  {/* Cover thumbnail */}
                  {a.cover_image && (
                    <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={a.cover_image} alt="" className="w-full h-full object-cover"/>
                    </div>
                  )}
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded"
                            style={{background:ps.color+'22',color:ps.color}}>
                        {ps.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-semibold"
                            style={{background:a.published?'#0a2a10':'#2a0a0a',
                                    color:a.published?'#15803d':'#dc2626'}}>
                        {a.published?'Published':'Draft'}
                      </span>
                    </div>
                    <div className="font-bold text-sm mb-0.5" style={{color:'#1a1612'}}>{a.title}</div>
                    {a.excerpt && (
                      <div className="text-xs truncate mb-1" style={{color:'#6b5f4e'}}>{a.excerpt}</div>
                    )}
                    <div className="text-xs" style={{color:'#9c8e7a'}}>
                      {new Date(a.created_at).toLocaleDateString('en-US',{
                        year:'numeric',month:'short',day:'numeric',
                        hour:'2-digit',minute:'2-digit'
                      })}
                      {a.tags?.length>0 && (
                        <span className="ml-2">
                          {a.tags.map((t:string) => (
                            <span key={t} className="mr-1 px-1.5 py-0.5 rounded text-xs"
                                  style={{background:'#d4cdc5',color:'#6b5f4e'}}>{t}</span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Link href={`/admin/article/edit/${a.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg no-underline text-center font-semibold"
                          style={{background:'#1d4ed8',color:'#fff'}}>
                      ✏️ Edit
                    </Link>
                    <button onClick={() => togglePublished(a.id, a.published)}
                      disabled={toggling===a.id}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40"
                      style={{background:a.published?'#2a0a0a':'#0a2a10',
                              color:a.published?'#dc2626':'#15803d'}}>
                      {toggling===a.id?'...':a.published?'Unpublish':'Publish'}
                    </button>
                    <button onClick={() => deleteArticle(a.id)}
                      disabled={deleting===a.id}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40"
                      style={{background:'#fee2e2',color:'#dc2626'}}>
                      {deleting===a.id?'...':'🗑️ Delete'}
                    </button>
                  </div>
                </div>
                {/* Preview link */}
                {a.published && a.slug && (
                  <div className="px-4 pb-3">
                    <Link href={`/news/${a.slug}`}
                          className="text-xs no-underline" style={{color:'#9c8e7a'}}>
                      🔗 /news/{a.slug}
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

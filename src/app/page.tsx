import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Article, Game, Team, Transaction } from '@/lib/types'
import { readableTeamColor } from '@/lib/color'

function teamColor(t?: Team) { return t ? readableTeamColor(t.color) : '#3a8adf' }

export const revalidate = 60  // revalidate every minute

export default async function HomePage() {
  const [{ data: articles }, { data: recentGames }, { data: transactions }, { data: teams }] =
    await Promise.all([
      supabase.from('articles').select('*').eq('published', true)
        .order('created_at', { ascending: false }).limit(6),
      supabase.from('games').select('*').eq('status', 'final')
        .order('played_at', { ascending: false }).limit(8),
      supabase.from('transactions').select('*')
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('teams').select('*').not('id','in','(ALL,RVS)'),
    ])

  const teamMap = Object.fromEntries((teams||[]).map((t:Team) => [t.id, t]))
  const hero       = articles?.find((a:any) => a.position === 'hero')       || articles?.[0]
  const featured1  = articles?.find((a:any) => a.position === 'featured_1') || articles?.[1]
  const featured2  = articles?.find((a:any) => a.position === 'featured_2') || articles?.[2]
  const newsItems  = articles?.filter((a:any) => a.position === 'news' || !['hero','featured_1','featured_2'].includes(a.position)) || []

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">

      {/* HERO */}
      {hero ? (
        <Link href={`/news/${hero.slug}`} className="no-underline block mb-8">
          <div className="relative rounded-2xl overflow-hidden"
               style={{ background: '#241f18', border: '1px solid #3a3228', minHeight: 260 }}>
            {hero.cover_image && (
              <img src={hero.cover_image} alt=""
                   className="absolute inset-0 w-full h-full object-cover opacity-30" />
            )}
            <div className="relative p-8">
              <div className="flex gap-2 mb-3 flex-wrap">
                {hero.tags?.map((tag:string) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: '#3a3228', color: '#60a0ff' }}>{tag}</span>
                ))}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
                {hero.title}
              </h1>
              {hero.excerpt && (
                <p className="text-sm md:text-base" style={{ color: '#8a7a6a', maxWidth: 600 }}>
                  {hero.excerpt}
                </p>
              )}
              <div className="mt-4 text-xs" style={{ color: '#6a5a4a' }}>
                {new Date(hero.created_at).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="rounded-2xl p-8 mb-8 text-center"
             style={{ background: '#241f18', border: '1px solid #3a3228' }}>
          <div className="text-4xl mb-4">🏀</div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to NBA GM League 2025-26</h1>
          <p style={{ color: '#8a7a6a' }}>Season coverage, trade news, and standings — all in one place.</p>
          <Link href="/admin" className="inline-block mt-4 px-6 py-2 rounded-lg font-semibold text-sm no-underline"
                style={{ background: '#3a3228', color: '#60a0ff' }}>
            Commissioner: write first article →
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">

        {/* ARTICLES GRID */}
        <div className="md:col-span-2">
          {/* FEATURED COLUMNS */}
          {(featured1||featured2) && (
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {[featured1,featured2].map((art,i) => art && (
                <a key={art.id} href={`/news/${art.slug}`} className="no-underline group">
                  <div className="rounded-xl overflow-hidden transition-all group-hover:brightness-110"
                       style={{background:'#241f18',border:'1px solid #3a3228'}}>
                    {art.cover_image && <div className="h-32 overflow-hidden"><img src={art.cover_image} alt="" className="w-full h-full object-cover"/></div>}
                    <div className="p-3">
                      <div className="text-xs mb-1 font-semibold" style={{color:i===0?'#60a0ff':'#40e080'}}>📌 Featured</div>
                      <div className="font-bold text-sm mb-1" style={{color:'#f0ebe0'}}>{art.title}</div>
                      {art.excerpt&&<div className="text-xs" style={{color:'#8a7a6a'}}>{art.excerpt}</div>}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4"
              style={{ color: '#6a5a4a' }}>Latest News</h2>
          {newsItems.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {rest.map((a:Article) => (
                <Link key={a.id} href={`/news/${a.slug}`} className="no-underline group">
                  <div className="rounded-xl overflow-hidden h-full"
                       style={{ background: '#241f18', border: '1px solid #3a3228' }}>
                    {a.cover_image && (
                      <img src={a.cover_image} alt="" className="w-full h-36 object-cover" />
                    )}
                    <div className="p-4">
                      <p className="font-semibold text-sm text-white leading-snug mb-1 group-hover:text-blue-400 transition-colors">
                        {a.title}
                      </p>
                      {a.excerpt && <p className="text-xs line-clamp-2" style={{ color: '#8a7a6a' }}>{a.excerpt}</p>}
                      <p className="text-xs mt-2" style={{ color: '#5a4a3a' }}>
                        {new Date(a.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center mb-6"
                 style={{ background: '#241f18', border: '1px solid #3a3228' }}>
              <p style={{ color: '#6a5a4a' }} className="text-sm">No articles yet. Commissioner can add news from the admin panel.</p>
            </div>
          )}

          {/* RECENT RESULTS */}
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4"
              style={{ color: '#6a5a4a' }}>Recent Results</h2>
          <div className="flex flex-col gap-2">
            {(recentGames||[]).length > 0 ? (recentGames||[]).map((g:Game) => {
              const home = teamMap[g.home_team]
              const away = teamMap[g.away_team]
              const winner = (g.home_score||0) > (g.away_score||0) ? 'home' : 'away'
              return (
                <Link key={g.id} href={`/game/${g.id}`} className="no-underline">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                       style={{ background: '#241f18', border: '1px solid #3a3228' }}>
                    <span className="text-xs w-6 font-semibold" style={{ color: '#6a5a4a' }}>W{g.week_number}</span>
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-xs font-semibold" style={{ color: winner==='home' ? '#fff' : '#8a7a6a' }}>
                        <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: teamColor(home) }}></span>
                        {home?.id||g.home_team}
                      </span>
                      <span className="text-sm font-bold" style={{ color: winner==='home' ? '#fff' : '#6a5a4a' }}>{g.home_score}</span>
                      <span className="text-xs" style={{ color: '#4a3a2a' }}>–</span>
                      <span className="text-sm font-bold" style={{ color: winner==='away' ? '#fff' : '#6a5a4a' }}>{g.away_score}</span>
                      <span className="text-xs font-semibold" style={{ color: winner==='away' ? '#fff' : '#8a7a6a' }}>
                        {away?.id||g.away_team}
                        <span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: teamColor(away) }}></span>
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: '#4a3a2a' }}>PBP →</span>
                  </div>
                </Link>
              )
            }) : (
              <div className="rounded-xl p-4 text-center"
                   style={{ background: '#241f18', border: '1px solid #3a3228' }}>
                <p className="text-sm" style={{ color: '#6a5a4a' }}>No games played yet. Season starts soon!</p>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-6">

          {/* STANDINGS PREVIEW */}
          <div className="rounded-xl p-4" style={{ background: '#241f18', border: '1px solid #3a3228' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6a5a4a' }}>Standings</h3>
              <Link href="/standings" className="text-xs no-underline" style={{ color: '#3a8adf' }}>Full →</Link>
            </div>
            {['Eastern','Western'].map(conf => (
              <div key={conf} className="mb-3">
                <p className="text-xs font-semibold mb-1" style={{ color: '#3a8adf' }}>{conf}</p>
                {(teams||[]).filter((t:Team)=>t.conference===conf)
                  .sort((a:Team,b:Team) => b.wins-a.wins || (b.pts_for-b.pts_against)-(a.pts_for-a.pts_against))
                  .slice(0,5).map((t:Team,i:number) => (
                  <div key={t.id} className="flex items-center gap-2 py-1">
                    <span className="text-xs w-4 text-right" style={{ color: '#5a4a3a' }}>{i+1}</span>
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#'+t.color }}></span>
                    <span className="text-xs flex-1 font-medium text-white">{t.id}</span>
                    <span className="text-xs font-bold" style={{ color: t.wins>t.losses?'#40e080':'#e04040' }}>{t.wins}</span>
                    <span className="text-xs" style={{ color: '#5a4a3a' }}>-</span>
                    <span className="text-xs" style={{ color: '#8a7a6a' }}>{t.losses}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* TRANSACTIONS FEED */}
          <div className="rounded-xl p-4" style={{ background: '#241f18', border: '1px solid #3a3228' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6a5a4a' }}>Transactions</h3>
              <Link href="/transactions" className="text-xs no-underline" style={{ color: '#3a8adf' }}>All →</Link>
            </div>
            {(transactions||[]).length > 0 ? (transactions||[]).map((tx:Transaction) => (
              <div key={tx.id} className="py-2" style={{ borderBottom: '1px solid #3a3228' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: tx.type==='trade'?'#2a2010':tx.type==='signing'?'#0a2a10':'#1a0a0a',
                                 color: tx.type==='trade'?'#ffa040':tx.type==='signing'?'#40e080':'#e04040' }}>
                    {tx.type.toUpperCase()}
                  </span>
                  <span className="text-xs" style={{ color: '#5a4a3a' }}>
                    {new Date(tx.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#e8e0d0' }}>{tx.description}</p>
              </div>
            )) : (
              <p className="text-xs" style={{ color: '#5a4a3a' }}>No transactions yet.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

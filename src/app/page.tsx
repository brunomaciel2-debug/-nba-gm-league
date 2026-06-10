import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Article, Game, Team, Transaction } from '@/lib/types'

function teamColor(t?: Team) { return t ? '#'+t.color : '#3a8adf' }

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
      supabase.from('teams').select('*'),
    ])

  const teamMap = Object.fromEntries((teams||[]).map((t:Team) => [t.id, t]))
  const featured = articles?.[0]
  const rest = articles?.slice(1) || []

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">

      {/* HERO */}
      {featured ? (
        <Link href={`/news/${featured.slug}`} className="no-underline block mb-8">
          <div className="relative rounded-2xl overflow-hidden"
               style={{ background: '#0f1e33', border: '1px solid #1e3a5f', minHeight: 260 }}>
            {featured.cover_image && (
              <img src={featured.cover_image} alt=""
                   className="absolute inset-0 w-full h-full object-cover opacity-30" />
            )}
            <div className="relative p-8">
              <div className="flex gap-2 mb-3 flex-wrap">
                {featured.tags?.map((tag:string) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: '#1e3a5f', color: '#60a0ff' }}>{tag}</span>
                ))}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
                {featured.title}
              </h1>
              {featured.excerpt && (
                <p className="text-sm md:text-base" style={{ color: '#7090b0', maxWidth: 600 }}>
                  {featured.excerpt}
                </p>
              )}
              <div className="mt-4 text-xs" style={{ color: '#506070' }}>
                {new Date(featured.created_at).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="rounded-2xl p-8 mb-8 text-center"
             style={{ background: '#0f1e33', border: '1px solid #1e3a5f' }}>
          <div className="text-4xl mb-4">🏀</div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to NBA GM League 2025-26</h1>
          <p style={{ color: '#7090b0' }}>Season coverage, trade news, and standings — all in one place.</p>
          <Link href="/admin" className="inline-block mt-4 px-6 py-2 rounded-lg font-semibold text-sm no-underline"
                style={{ background: '#1e3a5f', color: '#60a0ff' }}>
            Commissioner: write first article →
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">

        {/* ARTICLES GRID */}
        <div className="md:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4"
              style={{ color: '#506070' }}>Latest News</h2>
          {rest.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {rest.map((a:Article) => (
                <Link key={a.id} href={`/news/${a.slug}`} className="no-underline group">
                  <div className="rounded-xl overflow-hidden h-full"
                       style={{ background: '#0f1e33', border: '1px solid #1e3a5f' }}>
                    {a.cover_image && (
                      <img src={a.cover_image} alt="" className="w-full h-36 object-cover" />
                    )}
                    <div className="p-4">
                      <p className="font-semibold text-sm text-white leading-snug mb-1 group-hover:text-blue-400 transition-colors">
                        {a.title}
                      </p>
                      {a.excerpt && <p className="text-xs line-clamp-2" style={{ color: '#7090b0' }}>{a.excerpt}</p>}
                      <p className="text-xs mt-2" style={{ color: '#405060' }}>
                        {new Date(a.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center mb-6"
                 style={{ background: '#0f1e33', border: '1px solid #1e3a5f' }}>
              <p style={{ color: '#506070' }} className="text-sm">No articles yet. Commissioner can add news from the admin panel.</p>
            </div>
          )}

          {/* RECENT RESULTS */}
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4"
              style={{ color: '#506070' }}>Recent Results</h2>
          <div className="flex flex-col gap-2">
            {(recentGames||[]).length > 0 ? (recentGames||[]).map((g:Game) => {
              const home = teamMap[g.home_team]
              const away = teamMap[g.away_team]
              const winner = (g.home_score||0) > (g.away_score||0) ? 'home' : 'away'
              return (
                <Link key={g.id} href={`/game/${g.id}`} className="no-underline">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                       style={{ background: '#0f1e33', border: '1px solid #1e3a5f' }}>
                    <span className="text-xs w-6 font-semibold" style={{ color: '#506070' }}>W{g.week_number}</span>
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-xs font-semibold" style={{ color: winner==='home' ? '#fff' : '#7090b0' }}>
                        <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: teamColor(home) }}></span>
                        {home?.id||g.home_team}
                      </span>
                      <span className="text-sm font-bold" style={{ color: winner==='home' ? '#fff' : '#506070' }}>{g.home_score}</span>
                      <span className="text-xs" style={{ color: '#304050' }}>–</span>
                      <span className="text-sm font-bold" style={{ color: winner==='away' ? '#fff' : '#506070' }}>{g.away_score}</span>
                      <span className="text-xs font-semibold" style={{ color: winner==='away' ? '#fff' : '#7090b0' }}>
                        {away?.id||g.away_team}
                        <span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: teamColor(away) }}></span>
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: '#304050' }}>PBP →</span>
                  </div>
                </Link>
              )
            }) : (
              <div className="rounded-xl p-4 text-center"
                   style={{ background: '#0f1e33', border: '1px solid #1e3a5f' }}>
                <p className="text-sm" style={{ color: '#506070' }}>No games played yet. Season starts soon!</p>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-6">

          {/* STANDINGS PREVIEW */}
          <div className="rounded-xl p-4" style={{ background: '#0f1e33', border: '1px solid #1e3a5f' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#506070' }}>Standings</h3>
              <Link href="/standings" className="text-xs no-underline" style={{ color: '#3a8adf' }}>Full →</Link>
            </div>
            {['Eastern','Western'].map(conf => (
              <div key={conf} className="mb-3">
                <p className="text-xs font-semibold mb-1" style={{ color: '#3a8adf' }}>{conf}</p>
                {(teams||[]).filter((t:Team)=>t.conference===conf)
                  .sort((a:Team,b:Team) => b.wins-a.wins || (b.pts_for-b.pts_against)-(a.pts_for-a.pts_against))
                  .slice(0,5).map((t:Team,i:number) => (
                  <div key={t.id} className="flex items-center gap-2 py-1">
                    <span className="text-xs w-4 text-right" style={{ color: '#405060' }}>{i+1}</span>
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#'+t.color }}></span>
                    <span className="text-xs flex-1 font-medium text-white">{t.id}</span>
                    <span className="text-xs font-bold" style={{ color: t.wins>t.losses?'#40e080':'#e04040' }}>{t.wins}</span>
                    <span className="text-xs" style={{ color: '#405060' }}>-</span>
                    <span className="text-xs" style={{ color: '#7090b0' }}>{t.losses}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* TRANSACTIONS FEED */}
          <div className="rounded-xl p-4" style={{ background: '#0f1e33', border: '1px solid #1e3a5f' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#506070' }}>Transactions</h3>
              <Link href="/transactions" className="text-xs no-underline" style={{ color: '#3a8adf' }}>All →</Link>
            </div>
            {(transactions||[]).length > 0 ? (transactions||[]).map((tx:Transaction) => (
              <div key={tx.id} className="py-2" style={{ borderBottom: '1px solid #1e3a5f' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: tx.type==='trade'?'#2a1a00':tx.type==='signing'?'#0a2a10':'#1a0a0a',
                                 color: tx.type==='trade'?'#ffa040':tx.type==='signing'?'#40e080':'#e04040' }}>
                    {tx.type.toUpperCase()}
                  </span>
                  <span className="text-xs" style={{ color: '#405060' }}>
                    {new Date(tx.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#c0ccd8' }}>{tx.description}</p>
              </div>
            )) : (
              <p className="text-xs" style={{ color: '#405060' }}>No transactions yet.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

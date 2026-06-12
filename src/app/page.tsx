import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Article, Game, Team, Transaction } from '@/lib/types'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60

function teamColor(t?: Team) { return t ? readableTeamColor(t.color) : '#3a8adf' }

export default async function HomePage() {
  const [
    { data: articles },
    { data: teams },
    { data: recentGames },
    { data: siteConfig },
    { data: highlight },
  ] = await Promise.all([
    supabase.from('articles').select('*').eq('published', true).order('created_at', { ascending: false }),
    supabase.from('teams').select('*').not('id','in','(ALL,RVS)'),
    supabase.from('games').select('*, home:teams!games_home_team_fkey(*), away:teams!games_away_team_fkey(*)')
      .eq('status', 'final').order('played_at', { ascending: false }).limit(6),
    supabase.from('site_config').select('*').eq('id', 1).single(),
    supabase.from('weekly_highlights')
      .select('*, potw:players!weekly_highlights_potw_player_id_fkey(id,name,pos,photo_url,team_id), uotw_winner:teams!weekly_highlights_uotw_winner_id_fkey(id,name,color,logo_url), uotw_loser:teams!weekly_highlights_uotw_loser_id_fkey(id,name,color,logo_url), hstreak_team:teams!weekly_highlights_hstreak_team_id_fkey(id,name,color,logo_url), uotw_game:games!weekly_highlights_uotw_game_id_fkey(id,home_score,away_score), potw_game:games!weekly_highlights_potw_game_id_fkey(id,home_team,away_team)')
      .order('week_number', { ascending: false }).limit(1).single(),
  ])

  const teamMap = Object.fromEntries((teams||[]).map((t:Team) => [t.id, t]))
  const hero      = articles?.find((a:any) => a.position === 'hero')
  const featured1 = articles?.find((a:any) => a.position === 'featured_1')
  const featured2 = articles?.find((a:any) => a.position === 'featured_2')
  const newsItems = articles?.filter((a:any) => a.position === 'news' || !['hero','featured_1','featured_2'].includes(a.position)) || []
  const bannerUrl = (siteConfig as any)?.banner_url
  const hl = highlight as any

  // Hot streak: find team with most consecutive wins
  const teamRecords: Record<string,{wins:number,streak:number,last:Game[]}> = {}
  ;(teams||[]).forEach((t:Team) => { teamRecords[t.id] = {wins:0,streak:0,last:[]} })
  const sortedGames = [...(recentGames||[])].sort((a:any,b:any) => new Date(b.played_at).getTime()-new Date(a.played_at).getTime())

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* ── BANNER ─────────────────────────────────── */}
      {bannerUrl ? (
        <div className="rounded-2xl overflow-hidden mb-6" style={{height:280}}>
          <img src={bannerUrl} alt="NBA GM League" className="w-full h-full object-cover"/>
        </div>
      ) : (
        <div className="rounded-2xl mb-6 flex items-center justify-center"
             style={{height:280,background:'linear-gradient(135deg,#1a1610 0%,#2a2218 50%,#1a1610 100%)',
                     border:'1px solid #3a3228'}}>
          <div className="text-center">
            <div className="text-5xl mb-3">🏀</div>
            <h1 className="text-4xl font-black mb-2" style={{color:'#f0ebe0'}}>NBA GM League</h1>
            <p className="text-lg" style={{color:'#8a7a6a'}}>2025-26 Season</p>
            <p className="text-xs mt-2" style={{color:'#4a3a2a'}}>
              Commissioner: upload a banner in the admin panel (recommended: 1200×280px)
            </p>
          </div>
        </div>
      )}

      {/* ── FEATURED ARTICLES ──────────────────────── */}
      {(featured1 || featured2) && (
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          {[featured1, featured2].map((art, i) => art && (
            <Link key={art.id} href={`/news/${art.slug}`} className="no-underline group">
              <div className="rounded-2xl overflow-hidden h-full transition-all group-hover:brightness-110"
                   style={{background:'#241f18',border:'1px solid #3a3228'}}>
                {art.cover_image && (
                  <div className="h-56 overflow-hidden">
                    <img src={art.cover_image} alt="" className="w-full h-full object-cover"/>
                  </div>
                )}
                <div className="p-5">
                  <div className="text-xs font-bold mb-2 uppercase tracking-widest"
                       style={{color:i===0?'#60a0ff':'#40e080'}}>📌 Featured</div>
                  <h2 className="text-xl font-black mb-2 leading-tight" style={{color:'#f0ebe0'}}>
                    {art.title}
                  </h2>
                  {art.excerpt && (
                    <p className="text-base" style={{color:'#8a7a6a',lineHeight:1.6}}>{art.excerpt}</p>
                  )}
                  <p className="text-sm mt-3" style={{color:'#5a4a3a'}}>
                    {new Date(art.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── WEEKLY HIGHLIGHTS ──────────────────────── */}
      <div className="grid md:grid-cols-3 gap-5 mb-8">

        {/* Performance of the Week */}
        <div className="rounded-2xl p-5" style={{background:'#241f18',border:'1px solid #3a3228',borderTop:'3px solid #ffd040'}}>
          <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#ffd040'}}>
            ⭐ Performance of the Week
          </div>
          {hl?.potw ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0"
                     style={{background:teamColor(teamMap[hl.potw.team_id])+'22',
                             border:'2px solid '+teamColor(teamMap[hl.potw.team_id])+'44'}}>
                  {hl.potw.photo_url
                    ?<img src={hl.potw.photo_url} alt="" className="w-full h-full object-cover"/>
                    :<div className="w-full h-full flex items-center justify-center font-black"
                          style={{color:teamColor(teamMap[hl.potw.team_id])}}>
                       {hl.potw.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                     </div>}
                </div>
                <div>
                  <div className="font-black text-lg" style={{color:'#f0ebe0'}}>{hl.potw.name}</div>
                  <div className="text-sm" style={{color:teamColor(teamMap[hl.potw.team_id])}}>
                    {hl.potw.pos} · {teamMap[hl.potw.team_id]?.name}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[['PTS',hl.potw_pts,'#ffa040'],['REB',hl.potw_reb,'#60a0ff'],['AST',hl.potw_ast,'#40e080']].map(([l,v,c])=>(
                  <div key={l as string} className="rounded-xl p-2 text-center" style={{background:'#1a1610'}}>
                    <div className="text-xl font-black" style={{color:c as string}}>{v}</div>
                    <div className="text-xs" style={{color:'#6a5a4a'}}>{l}</div>
                  </div>
                ))}
              </div>
              {hl.potw_game && (
                <Link href={`/game/${hl.potw_game.id}`}
                      className="block text-center text-xs no-underline py-2 rounded-lg font-semibold"
                      style={{background:'#2a2000',color:'#ffd040'}}>
                  View Box Score →
                </Link>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">⭐</div>
              <p className="text-sm" style={{color:'#6a5a4a'}}>Available after first simulation</p>
            </div>
          )}
        </div>

        {/* Upset of the Week */}
        <div className="rounded-2xl p-5" style={{background:'#241f18',border:'1px solid #3a3228',borderTop:'3px solid #e04040'}}>
          <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#e04040'}}>
            💥 Upset of the Week
          </div>
          {hl?.uotw_winner ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-xl overflow-hidden"
                       style={{background:teamColor(hl.uotw_winner)+'22'}}>
                    {hl.uotw_winner.logo_url
                      ?<img src={hl.uotw_winner.logo_url} alt="" className="w-full h-full object-contain p-1"/>
                      :<div className="w-full h-full flex items-center justify-center font-black text-sm"
                            style={{color:teamColor(hl.uotw_winner)}}>{hl.uotw_winner.id}</div>}
                  </div>
                  <div className="text-xs font-bold text-center" style={{color:'#40e080'}}>WIN</div>
                  <div className="text-xs text-center" style={{color:'#f0ebe0'}}>{hl.uotw_winner.name}</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black" style={{color:'#e04040'}}>💥</div>
                  <div className="text-base font-black" style={{color:'#f0ebe0'}}>{hl.uotw_score}</div>
                  <div className="text-xs" style={{color:'#5a4a3a'}}>
                    {hl.uotw_odds ? `${Math.round(hl.uotw_odds*100)}% underdog` : ''}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-xl overflow-hidden"
                       style={{background:teamColor(hl.uotw_loser)+'22'}}>
                    {hl.uotw_loser?.logo_url
                      ?<img src={hl.uotw_loser.logo_url} alt="" className="w-full h-full object-contain p-1"/>
                      :<div className="w-full h-full flex items-center justify-center font-black text-sm"
                            style={{color:teamColor(hl.uotw_loser)}}>{hl.uotw_loser?.id}</div>}
                  </div>
                  <div className="text-xs font-bold text-center" style={{color:'#e04040'}}>LOSS</div>
                  <div className="text-xs text-center" style={{color:'#8a7a6a'}}>{hl.uotw_loser?.name}</div>
                </div>
              </div>
              {hl.uotw_notes && <p className="text-sm mb-3" style={{color:'#8a7a6a'}}>{hl.uotw_notes}</p>}
              {hl.uotw_game && (
                <Link href={`/game/${hl.uotw_game.id}`}
                      className="block text-center text-xs no-underline py-2 rounded-lg font-semibold"
                      style={{background:'#2a0a0a',color:'#e04040'}}>
                  View Box Score →
                </Link>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">💥</div>
              <p className="text-sm" style={{color:'#6a5a4a'}}>Available after first simulation</p>
            </div>
          )}
        </div>

        {/* Hot Streak */}
        <div className="rounded-2xl p-5" style={{background:'#241f18',border:'1px solid #3a3228',borderTop:'3px solid #ffa040'}}>
          <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#ffa040'}}>
            🔥 Hot Streak
          </div>
          {hl?.hstreak_team ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                     style={{background:teamColor(hl.hstreak_team)+'22',border:'2px solid '+teamColor(hl.hstreak_team)+'44'}}>
                  {hl.hstreak_team.logo_url
                    ?<img src={hl.hstreak_team.logo_url} alt="" className="w-full h-full object-contain p-1.5"/>
                    :<div className="w-full h-full flex items-center justify-center font-black"
                          style={{color:teamColor(hl.hstreak_team)}}>{hl.hstreak_team.id}</div>}
                </div>
                <div>
                  <div className="font-black text-lg" style={{color:'#f0ebe0'}}>{hl.hstreak_team.name}</div>
                  <div className="text-2xl font-black" style={{color:'#ffa040'}}>
                    {'🔥'.repeat(Math.min(hl.hstreak_wins,5))} {hl.hstreak_wins}W streak
                  </div>
                </div>
              </div>
              {/* Recent games */}
              {(hl.hstreak_games||[]).slice(0,4).map((gid:string) => {
                const g = (recentGames||[]).find((x:any)=>x.id===gid) as any
                if (!g) return null
                const isHome = g.home_team === hl.hstreak_team_id
                const us = isHome?g.home_score:g.away_score
                const them = isHome?g.away_score:g.home_score
                const opp = isHome?g.away:g.home
                return (
                  <Link key={gid} href={`/game/${gid}`} className="no-underline">
                    <div className="flex items-center gap-2 py-1.5 text-xs"
                         style={{borderBottom:'1px solid #3a3228'}}>
                      <span className="font-bold px-1.5 py-0.5 rounded"
                            style={{background:'#0a2a10',color:'#40e080'}}>W</span>
                      <span style={{color:'#8a7a6a'}}>{isHome?'vs':'@'} {opp?.name}</span>
                      <span className="ml-auto font-bold" style={{color:'#40e080'}}>{us}–{them}</span>
                    </div>
                  </Link>
                )
              })}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🔥</div>
              <p className="text-sm" style={{color:'#6a5a4a'}}>Available after first simulation</p>
            </div>
          )}
        </div>
      </div>

      {/* ── LATEST NEWS ────────────────────────────── */}
      {newsItems.length > 0 && (
        <>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{color:'#6a5a4a'}}>
            Latest News
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {newsItems.map((a:Article) => (
              <Link key={a.id} href={`/news/${a.slug}`} className="no-underline group">
                <div className="rounded-2xl overflow-hidden h-full transition-all group-hover:brightness-110"
                     style={{background:'#241f18',border:'1px solid #3a3228'}}>
                  {a.cover_image && (
                    <img src={a.cover_image} alt="" className="w-full h-48 object-cover"/>
                  )}
                  <div className="p-4">
                    <p className="font-bold text-base text-white leading-snug mb-2 group-hover:text-blue-400 transition-colors">
                      {a.title}
                    </p>
                    {a.excerpt && (
                      <p className="text-sm line-clamp-2" style={{color:'#8a7a6a'}}>{a.excerpt}</p>
                    )}
                    <p className="text-sm mt-3" style={{color:'#5a4a3a'}}>
                      {new Date(a.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── RECENT RESULTS ─────────────────────────── */}
      {(recentGames||[]).length > 0 && (
        <>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{color:'#6a5a4a'}}>
            Recent Results
          </h2>
          <div className="flex flex-col gap-2">
            {(recentGames||[]).map((g:any) => {
              const home = g.home as Team
              const away = g.away as Team
              const winner = (g.home_score||0) > (g.away_score||0) ? 'home' : 'away'
              return (
                <Link key={g.id} href={`/game/${g.id}`} className="no-underline">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                       style={{background:'#241f18',border:'1px solid #3a3228'}}>
                    <span className="text-xs w-6 font-semibold" style={{color:'#6a5a4a'}}>W{g.week_number}</span>
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-sm font-semibold" style={{color:winner==='home'?'#fff':'#8a7a6a'}}>
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{background:teamColor(home)}}></span>
                        {home?.name||g.home_team}
                      </span>
                      <span className="text-base font-black" style={{color:winner==='home'?'#fff':'#6a5a4a'}}>{g.home_score}</span>
                      <span className="text-sm" style={{color:'#4a3a2a'}}>–</span>
                      <span className="text-base font-black" style={{color:winner==='away'?'#fff':'#6a5a4a'}}>{g.away_score}</span>
                      <span className="text-sm font-semibold" style={{color:winner==='away'?'#fff':'#8a7a6a'}}>
                        {away?.name||g.away_team}
                        <span className="inline-block w-2 h-2 rounded-full ml-1.5" style={{background:teamColor(away)}}></span>
                      </span>
                    </div>
                    <span className="text-xs" style={{color:'#4a3a2a'}}>Box Score →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Article, Game, Team, Transaction } from '@/lib/types'
import { readableTeamColor } from '@/lib/color'
import LeagueLeadersMini from './LeagueLeadersMini'
import { WeeklyHighlightsHeader, HighlightCardTitle, HighlightEmpty, ViewBoxScore, WinStreakLabel, FeaturedHeader, FeaturedLabel, UnderdogLabel, UotwWinLoss, WinBadge, SeasonBadge, ArticleDate } from './HomePageClient'
export const revalidate = 60

function teamColor(t?: Team) { return t ? readableTeamColor(t.color) : '#1d4ed8' }

export default async function HomePage() {
  const [
    { data: articles },
    { data: teams },
    { data: recentGames },
    { data: siteConfig },
    { data: highlight },
  ] = await Promise.all([
    supabase.from('articles').select('*').eq('published', true).order('created_at', { ascending: false }),
    supabase.from('teams').select('*').not('id','in','(ALL,RVS,ROO,SOP)'),
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">

      {/* BANNER */}
      {bannerUrl ? (
        <div className="rounded-2xl overflow-hidden mb-6" style={{height:280}}>
          <img src={bannerUrl} alt="NBA GM League" className="w-full h-full object-cover"/>
        </div>
      ) : (
        <div className="rounded-2xl mb-6 flex items-center justify-center"
             style={{height:280,background:'linear-gradient(135deg,#1a1610 0%,#2a2218 50%,#1a1610 100%)',
                     border:'1px solid #d4cec3'}}>
          <div className="text-center">
            <div className="text-5xl mb-3">🏀</div>
            <h1 className="text-4xl font-black mb-2" style={{color:'#1a1612'}}>NBA GM League</h1>
            <SeasonBadge />
          </div>
        </div>
      )}

      {/* FEATURED ARTICLES */}
      {(featured1 || featured2) && (
        <>
        <FeaturedHeader />
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          {[featured1, featured2].map((art, i) => art && (
            <Link key={art.id} href={`/news/${art.slug}`} className="no-underline group">
              <div className="rounded-2xl overflow-hidden h-full transition-all group-hover:brightness-110"
                   style={{background:'#e8e2d6',border:'1px solid #d4cec3',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                {art.cover_image && (
                  <div className="h-56 overflow-hidden">
                    <img src={art.cover_image} alt="" className="w-full h-full object-cover"/>
                  </div>
                )}
                <div className="p-5">
                  <FeaturedLabel color={i===0?'#1d4ed8':'#15803d'} />
                  <h2 className="text-xl font-black mb-2 leading-tight" style={{color:'#1a1612'}}>
                    {art.title}
                  </h2>
                  {art.excerpt && (
                    <p className="text-sm" style={{color:'#3d3529',lineHeight:1.6}}>{art.excerpt}</p>
                  )}
                  <ArticleDate date={art.created_at} />
                </div>
              </div>
            </Link>
          ))}
        </div>
        </>
      )}

      {/* WEEKLY HIGHLIGHTS */}
      <WeeklyHighlightsHeader />
      <div className="grid md:grid-cols-3 gap-5 mb-8">

        {/* Performance of the Week */}
        <div className="rounded-2xl p-5" style={{background:'#e8e2d6',border:'1px solid #d4cdc5',borderTop:'3px solid #f59e0b',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <HighlightCardTitle icon='ti-award' color='#d97706' textEN='Performance of the Week' textPT='Performance da Semana' />
          {hl?.potw ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0"
                     style={{background:teamColor(teamMap[hl.potw.team_id])+'22',
                             border:'2px solid '+teamColor(teamMap[hl.potw.team_id])+'44'}}>
                  {hl.potw.photo_url
                    ?<img src={hl.potw.photo_url} alt="" className="w-full h-full object-cover"/>
                    :<div className="w-full h-full flex items-center justify-center font-black text-2xl"
                          style={{color:teamColor(teamMap[hl.potw.team_id])}}>
                       {hl.potw.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                     </div>}
                </div>
                <div>
                  <div className="font-black text-lg" style={{color:'#1a1612'}}>{hl.potw.name}</div>
                  <div className="text-sm" style={{color:teamColor(teamMap[hl.potw.team_id])}}>
                    {hl.potw.pos} · {teamMap[hl.potw.team_id]?.name}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[['PTS',hl.potw_pts,'#b45309'],['REB',hl.potw_reb,'#1d4ed8'],['AST',hl.potw_ast,'#15803d']].map(([l,v,c])=>(
                  <div key={l as string} className="rounded-xl p-2 text-center" style={{background:'#ede8de'}}>
                    <div className="text-xl font-black" style={{color:c as string}}>{v}</div>
                    <div className="text-xs" style={{color:'#6b5f4e'}}>{l}</div>
                  </div>
                ))}
              </div>
              {hl.potw_game && <ViewBoxScore gameId={hl.potw_game.id} />}
            </>
          ) : (
            <HighlightEmpty icon='⏳' textEN='Available after first simulation' textPT='Disponível após a primeira simulação' />
          )}
        </div>

        {/* Upset of the Week */}
        <div className="rounded-2xl p-5" style={{background:'#e8e2d6',border:'1px solid #d4cdc5',borderTop:'3px solid #dc2626',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <HighlightCardTitle icon='ti-bolt' color='#dc2626' textEN='Upset of the Week' textPT='Surpresa da Semana' />
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
                  <UotwWinLoss isWin={true} />
                  <div className="text-xs text-center" style={{color:'#1a1612'}}>{hl.uotw_winner.name}</div>
                  {hl.uotw_odds != null && <UnderdogLabel pct={Math.round(hl.uotw_odds*100)} role="underdog" />}
                </div>
                <div className="text-center">
                  <div className="text-lg font-black" style={{color:'#dc2626'}}>🆚</div>
                  <div className="text-base font-black" style={{color:'#1a1612'}}>{hl.uotw_score}</div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-xl overflow-hidden"
                       style={{background:teamColor(hl.uotw_loser)+'22'}}>
                    {hl.uotw_loser?.logo_url
                      ?<img src={hl.uotw_loser.logo_url} alt="" className="w-full h-full object-contain p-1"/>
                      :<div className="w-full h-full flex items-center justify-center font-black text-sm"
                            style={{color:teamColor(hl.uotw_loser)}}>{hl.uotw_loser?.id}</div>}
                  </div>
                  <UotwWinLoss isWin={false} />
                  <div className="text-xs text-center" style={{color:'#6b5f4e'}}>{hl.uotw_loser?.name}</div>
                  {hl.uotw_odds != null && <UnderdogLabel pct={Math.round(hl.uotw_odds*100)} role="favorite" />}
                </div>
              </div>
              {hl.uotw_notes && <p className="text-sm mb-3" style={{color:'#6b5f4e'}}>{hl.uotw_notes}</p>}
              {hl.uotw_game && <ViewBoxScore gameId={hl.uotw_game.id} red />}
            </>
          ) : (
            <HighlightEmpty icon='🆚' textEN='Available after first simulation' textPT='Disponível após a primeira simulação' />
          )}
        </div>

        {/* Hot Streak */}
        <div className="rounded-2xl p-5" style={{background:'#e8e2d6',border:'1px solid #d4cdc5',borderTop:'3px solid #c2410c',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <HighlightCardTitle icon='ti-flame' color='#c2410c' textEN='Hot Streak' textPT='Série Quente' />
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
                  <div className="font-black text-lg" style={{color:'#1a1612'}}>{hl.hstreak_team.name}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <i className="ti ti-flame" style={{fontSize:16,color:'#c2410c'}}></i>
                    <WinStreakLabel wins={hl.hstreak_wins} />
                  </div>
                </div>
              </div>
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
                         style={{borderBottom:'1px solid #d4cec3'}}>
                      <WinBadge />
                      <span style={{color:'#6b5f4e'}}>{isHome?'vs':'@'} {opp?.name}</span>
                      <span className="ml-auto font-bold" style={{color:'#166534'}}>{us}-{them}</span>
                    </div>
                  </Link>
                )
              })}
            </>
          ) : (
            <HighlightEmpty icon='🔥' textEN='Available after first simulation' textPT='Disponível após a primeira simulação' />
          )}
        </div>
      </div>

      {/* LEAGUE LEADERS MINI */}
      <LeagueLeadersMini />

    </div>
  )
}

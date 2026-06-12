import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'

async function getLeaders(stat: 'pts' | 'ast' | 'reb', minGamesRatio = 0.70) {
  // Get current week to calculate min games
  const { data: sc } = await supabase.from('season_config').select('current_week').eq('id',1).single()
  const week = (sc as any)?.current_week || 0
  const expectedGames = Math.max(1, Math.round((week / 26) * 82))
  const minGames = Math.floor(expectedGames * minGamesRatio)

  const { data } = await supabase
    .from('player_stats')
    .select('player_id, games, pts, ast, reb, players(id, name, pos, photo_url, team_id, teams(id, name, color))')
    .gte('games', Math.max(1, minGames))
    .order(stat === 'pts' ? 'pts' : stat === 'ast' ? 'ast' : 'reb', { ascending: false })
    .limit(5)

  return (data || []).map((s: any) => {
    const gp = s.games || 1
    return {
      ...s.players,
      gp,
      ppg: (s.pts / gp).toFixed(1),
      apg: (s.ast / gp).toFixed(1),
      rpg: (s.reb / gp).toFixed(1),
      statValue: stat === 'pts' ? (s.pts/gp).toFixed(1) : stat === 'ast' ? (s.ast/gp).toFixed(1) : (s.reb/gp).toFixed(1),
    }
  })
}

const CATS = [
  { key: 'pts' as const, label: 'Points',   unit: 'PPG', color: '#d97706', icon: 'ti-ball-basketball' },
  { key: 'ast' as const, label: 'Assists',  unit: 'APG', color: '#0891b2', icon: 'ti-arrows-exchange' },
  { key: 'reb' as const, label: 'Rebounds', unit: 'RPG', color: '#1d4ed8', icon: 'ti-arrow-bounce' },
]

export default async function LeagueLeadersMini() {
  const [pts, ast, reb] = await Promise.all([
    getLeaders('pts'),
    getLeaders('ast'),
    getLeaders('reb'),
  ])

  const lists = [pts, ast, reb]

  return (
    <div className="mb-8">
      <div className="section-header mb-5">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{color:'#111827',letterSpacing:'1.5px'}}>
          <i className="ti ti-chart-bar" style={{fontSize:14,marginRight:6,color:'#F5A623'}}></i>League Leaders
        </span>
        <Link href="/league-leaders" className="text-xs no-underline font-semibold" style={{color:'#F5A623'}}>
          Full Leaders →
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {CATS.map((cat, ci) => {
          const leaders = lists[ci]
          const leader = leaders[0]
          const tc = leader?.teams ? readableTeamColor((leader.teams as any).color) : '#6b7280'

          return (
            <div key={cat.key} className="rounded-2xl overflow-hidden"
                 style={{background:'#fff',border:'1px solid #e5e1d8',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderTop:'3px solid '+cat.color}}>
              {/* Header */}
              <div className="px-5 py-3 flex items-center justify-between"
                   style={{borderBottom:'1px solid #3a3228'}}>
                <span className="text-xs font-bold uppercase tracking-widest" style={{color:cat.color}}>
                  <i className={`ti ${cat.icon}`} style={{fontSize:14,marginRight:6}}></i>{cat.label} Leaders
                </span>
                <span className="text-xs font-bold" style={{color:cat.color}}>{cat.unit}</span>
              </div>

              {leaders.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm" style={{color:'#9ca3af'}}>Available after games are played</p>
                </div>
              ) : (
                <div>
                  {/* #1 Leader — big display */}
                  {leader && (
                    <Link href={`/player/${leader.id}`} className="no-underline group">
                      <div className="p-5 flex items-center gap-4 transition-all group-hover:brightness-110"
                           style={{borderBottom:'1px solid #2a2218'}}>
                        <div className="relative flex-shrink-0">
                          <div className="w-16 h-16 rounded-full overflow-hidden"
                               style={{background:tc+'22',border:'2px solid '+tc+'55'}}>
                            {leader.photo_url
                              ?<img src={leader.photo_url} alt="" className="w-full h-full object-cover"/>
                              :<div className="w-full h-full flex items-center justify-center font-black text-lg"
                                    style={{color:tc}}>
                                 {leader.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                               </div>}
                          </div>
                          <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black"
                               style={{background:cat.color,color:'#f8f7f4'}}>1</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-base truncate" style={{color:'#111827'}}>{leader.name}</div>
                          <div className="text-xs" style={{color:tc}}>
                            {leader.pos} · {(leader.teams as any)?.name}
                          </div>
                          <div className="text-xs mt-0.5" style={{color:'#9ca3af'}}>{leader.gp} GP</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-3xl font-black" style={{color:cat.color}}>{leader.statValue}</div>
                          <div className="text-xs" style={{color:'#9ca3af'}}>{cat.unit}</div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {/* #2-5 */}
                  {leaders.slice(1).map((p, i) => {
                    const ptc = p?.teams ? readableTeamColor((p.teams as any).color) : '#6b7280'
                    return (
                      <Link key={p.id} href={`/player/${p.id}`} className="no-underline group">
                        <div className="flex items-center gap-3 px-5 py-2.5 transition-all group-hover:brightness-125"
                             style={{borderBottom: i < 3 ? '1px solid #1e1a14' : 'none'}}>
                          <span className="text-sm font-bold w-4 flex-shrink-0" style={{color:'#d1d5db'}}>{i+2}</span>
                          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                               style={{background:ptc+'22'}}>
                            {p.photo_url
                              ?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                              :<div className="w-full h-full flex items-center justify-center text-xs font-black"
                                    style={{color:ptc}}>
                                 {p.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                               </div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate" style={{color:'#e8e0d0'}}>{p.name}</div>
                            <div className="text-xs" style={{color:'#9ca3af'}}>{(p.teams as any)?.id}</div>
                          </div>
                          <div className="font-bold text-sm flex-shrink-0" style={{color:cat.color}}>{p.statValue}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

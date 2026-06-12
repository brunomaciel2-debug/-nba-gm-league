import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Game, Team } from '@/lib/types'
export const revalidate = 60

export default async function SchedulePage() {
  const [{ data: games }, { data: teams }] = await Promise.all([
    supabase.from('games').select('*').order('week_number').order('game_number'),
    supabase.from('teams').select('id,name,color'),
  ])
  const teamMap = Object.fromEntries((teams||[]).map((t:any)=>[t.id,t]))
  const byWeek: Record<number,Game[]> = {}
  ;(games||[]).forEach((g:Game) => {
    if(!byWeek[g.week_number]) byWeek[g.week_number]=[]
    byWeek[g.week_number].push(g)
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">📅 Schedule & Results — 2025-26</h1>
      {Object.keys(byWeek).length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
          <p style={{ color:'#6b5f4e' }}>Schedule will appear here once the season begins.</p>
        </div>
      ) : Object.entries(byWeek).map(([week,wgames]) => (
        <div key={week} className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3"
              style={{ color:'#6b5f4e' }}>Week {week}</h2>
          <div className="flex flex-col gap-2">
            {wgames.map((g:Game) => {
              const home = teamMap[g.home_team]
              const away = teamMap[g.away_team]
              const final = g.status==='final'
              const winner = final ? ((g.home_score||0)>(g.away_score||0)?'home':'away') : null
              return (
                <div key={g.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                     style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
                  <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{ background:final?'#0a2a10':'#2a2218',
                                 color:final?'#40e080':'#6a5a4a' }}>
                    {final?'FINAL':'SCHEDULED'}
                  </span>
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-sm font-semibold"
                          style={{ color: winner==='home'?'#e8e2d6':'#8a7a6a' }}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                            style={{ background: home?'#'+home.color:'#333' }}></span>
                      {home?.name||g.home_team}
                    </span>
                    {final && <>
                      <span className="text-base font-bold"
                            style={{ color:winner==='home'?'#e8e2d6':'#6a5a4a' }}>{g.home_score}</span>
                      <span style={{ color:'#b8ae9e' }}>–</span>
                      <span className="text-base font-bold"
                            style={{ color:winner==='away'?'#e8e2d6':'#6a5a4a' }}>{g.away_score}</span>
                    </>}
                    <span className="text-sm font-semibold"
                          style={{ color:winner==='away'?'#e8e2d6':'#8a7a6a' }}>
                      {away?.name||g.away_team}
                      <span className="inline-block w-2.5 h-2.5 rounded-full ml-1.5"
                            style={{ background: away?'#'+away.color:'#333' }}></span>
                    </span>
                  </div>
                  {final && (
                    <Link href={`/game/${g.id}`} className="text-xs no-underline px-3 py-1 rounded"
                          style={{ background:'#3a3228',color:'#1e40af' }}>
                      Box Score →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

import { supabase } from '@/lib/supabase'
import Link from 'next/link'
export const revalidate = 60

export default async function TeamPage({ params }: { params: { id: string } }) {
  const teamId = params.id.toUpperCase()
  const [{ data: team }, { data: players }, { data: games }] = await Promise.all([
    supabase.from('teams').select('*').eq('id', teamId).single(),
    supabase.from('players').select('*, player_stats(*)').eq('team_id', teamId)
      .eq('status','active').order('usage', { ascending: false }),
    supabase.from('games')
      .select('*, home:teams!games_home_team_fkey(id,name,color,logo_url), away:teams!games_away_team_fkey(id,name,color,logo_url)')
      .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
      .eq('status','final').order('played_at', { ascending: false }).limit(8),
  ])
  if (!team) return <div className="p-8 text-center" style={{ color:'#7090b0' }}>Team not found.</div>

  const t = team as any
  const color = '#'+t.color
  const cap = t.salary_cap, used = t.cap_used, space = cap - used
  const capFmt = (n:number) => '$'+Math.round(n/1000000).toFixed(1)+'M'
  const gp = t.wins + t.losses
  const pct = gp > 0 ? (t.wins/gp).toFixed(3) : '—'
  const pct2 = (m:number,a:number) => a>0?(m/a*100).toFixed(1)+'%':'—'

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* HEADER */}
      <div className="rounded-2xl p-6 mb-6"
           style={{ background:'#0f1e33', borderTop:'4px solid '+color, border:'1px solid #1e3a5f' }}>
        <div className="flex flex-wrap items-center gap-6">
          {/* Logo */}
          <div className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
               style={{ background:color+'22', border:'2px solid '+color+'44' }}>
            {t.logo_url
              ? <img src={t.logo_url} alt={t.name} className="w-full h-full object-contain p-2" />
              : <span className="text-2xl font-black" style={{ color }}>{t.id}</span>
            }
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold mb-1" style={{ color }}>
              {t.conference} · {t.division}
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">{t.name}</h1>
            <div className="text-sm" style={{ color:'#7090b0' }}>{t.arena} · {t.city}</div>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-3xl font-black" style={{ color:'#40e080' }}>{t.wins}</div>
              <div className="text-xs" style={{ color:'#506070' }}>W</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black" style={{ color:'#e04040' }}>{t.losses}</div>
              <div className="text-xs" style={{ color:'#506070' }}>L</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{pct}</div>
              <div className="text-xs" style={{ color:'#506070' }}>PCT</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">

          {/* ROSTER with photos */}
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:'#506070' }}>Roster</h2>
          <div className="rounded-xl overflow-hidden mb-6" style={{ border:'1px solid #1e3a5f' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background:'#060c18',borderBottom:'1px solid #1e3a5f' }}>
                  {['Player','Pos','PPG','RPG','APG','FG%','Salary'].map(h=>(
                    <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color:'#7090b0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(players||[]).map((p:any,i:number) => {
                  const s = p.player_stats?.[0]||{}
                  const gp2 = s.games||0
                  const avg = (v:number) => gp2>0?(v/gp2).toFixed(1):'—'
                  return (
                    <tr key={p.id}
                        style={{ background:i%2===0?'#0f1e33':'#0c1a2c',borderBottom:'1px solid #0a1628' }}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {/* Photo or initials */}
                          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                               style={{ background:color+'22' }}>
                            {p.photo_url
                              ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-xs font-black"
                                     style={{ color }}>
                                  {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                                </div>
                            }
                          </div>
                          <Link href={`/player/${p.id}`}
                                className="font-semibold text-white no-underline hover:text-blue-400 transition-colors">
                            {p.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-2" style={{ color:'#7090b0' }}>{p.pos}</td>
                      <td className="px-3 py-2 font-bold" style={{ color:'#ffa040' }}>{avg(s.pts)}</td>
                      <td className="px-3 py-2" style={{ color:'#40e080' }}>{avg(s.reb)}</td>
                      <td className="px-3 py-2" style={{ color:'#60a0ff' }}>{avg(s.ast)}</td>
                      <td className="px-3 py-2">{pct2(s.fgm,s.fga)}</td>
                      <td className="px-3 py-2" style={{ color:'#7090b0' }}>{capFmt(p.salary)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* RECENT GAMES */}
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:'#506070' }}>Recent Results</h2>
          <div className="flex flex-col gap-2">
            {(games||[]).map((g:any) => {
              const isHome = g.home_team === teamId
              const us = isHome ? g.home_score : g.away_score
              const them = isHome ? g.away_score : g.home_score
              const opp = isHome ? g.away : g.home
              const win = us > them
              return (
                <Link key={g.id} href={`/game/${g.id}`} className="no-underline">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                       style={{ background:'#0f1e33',border:'1px solid #1e3a5f' }}>
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{ background:win?'#0a2a10':'#2a0a0a',color:win?'#40e080':'#e04040' }}>
                      {win?'W':'L'}
                    </span>
                    <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0">
                      {opp?.logo_url
                        ? <img src={opp.logo_url} alt="" className="w-full h-full object-contain" />
                        : <div className="w-full h-full flex items-center justify-center text-xs font-black"
                               style={{ background:'#'+opp?.color+'22',color:'#'+opp?.color }}>
                            {opp?.id?.slice(0,2)}
                          </div>
                      }
                    </div>
                    <span className="text-xs flex-1" style={{ color:'#7090b0' }}>
                      {isHome?'vs':'@'} {opp?.name}
                    </span>
                    <span className="text-sm font-bold" style={{ color:win?'#40e080':'#e04040' }}>
                      {us}–{them}
                    </span>
                    <span className="text-xs px-2 py-1 rounded" style={{ background:'#1e3a5f',color:'#60a0ff' }}>
                      Box →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl p-4" style={{ background:'#0f1e33',border:'1px solid #1e3a5f' }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:'#506070' }}>Cap Room</h3>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color:'#7090b0' }}>Used</span>
              <span className="font-semibold text-white">{capFmt(used)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background:'#1e3a5f' }}>
              <div className="h-full rounded-full" style={{ width:Math.min(100,used/cap*100)+'%',
                background:space>0?'#3a8adf':'#e04040' }}></div>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color:'#7090b0' }}>Cap: {capFmt(cap)}</span>
              <span style={{ color:space>0?'#40e080':'#e04040' }}>
                {space>0?'+':''}{capFmt(space)}
              </span>
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background:'#0a2a10',border:'1px solid #1a5a2a' }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color:'#40e080' }}>GM Panel</h3>
            <p className="text-xs mb-3" style={{ color:'#7090b0' }}>Submit weekly orders before Sunday 23:59.</p>
            <Link href={`/gm/orders/${teamId}`}
                  className="block text-center text-xs font-bold py-2 rounded-lg no-underline"
                  style={{ background:'#0a5a20',color:'#40e080' }}>
              Set Weekly Orders →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

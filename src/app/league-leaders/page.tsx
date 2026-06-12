import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60

export default async function LeagueLeadersPage() {
  const { data: stats } = await supabase
    .from('player_stats')
    .select('*, players(id,name,pos,team_id,photo_url,teams(color,logo_url))')
    .eq('season','2025-26').gt('games',0)
    .order('pts',{ ascending:false }).limit(300)

  const rows = (stats||[]).map((s:any) => ({
    ...s,
    pid:   s.players?.id,
    name:  s.players?.name||'—',
    pos:   s.players?.pos||'—',
    team:  s.players?.team_id||'—',
    photo: s.players?.photo_url,
    teamColor: s.players?.teams?.color,
    ppg: s.games>0?(s.pts/s.games).toFixed(1):'—',
    rpg: s.games>0?(s.reb/s.games).toFixed(1):'—',
    apg: s.games>0?(s.ast/s.games).toFixed(1):'—',
    spg: s.games>0?(s.stl/s.games).toFixed(1):'—',
    bpg: s.games>0?(s.blk/s.games).toFixed(1):'—',
    fgpct: s.fga>0?(s.fgm/s.fga*100).toFixed(1)+'%':'—',
    tppct: s.tpa>0?(s.tpm/s.tpa*100).toFixed(1)+'%':'—',
  }))

  const cats = [
    {label:'Points Per Game',  key:'ppg',  sortKey:'pts', color:'#c2410c'},
    {label:'Rebounds Per Game',key:'rpg',  sortKey:'reb', color:'#166534'},
    {label:'Assists Per Game', key:'apg',  sortKey:'ast', color:'#1e40af'},
    {label:'Steals Per Game',  key:'spg',  sortKey:'stl', color:'#7c3aed'},
    {label:'Blocks Per Game',  key:'bpg',  sortKey:'blk', color:'#ff6040'},
    {label:'FG%',              key:'fgpct',sortKey:'fgm', color:'#0e7490'},
    {label:'3-Point %',        key:'tppct',sortKey:'tpm', color:'#b45309'},
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">📊 League Leaders — 2025-26</h1>
      {rows.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
          <p style={{ color:'#6b5f4e' }}>Stats will appear here once the season begins.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {cats.map(cat => {
            const sorted = [...rows]
              .sort((a:any,b:any)=>(parseFloat(b[cat.key])||0)-(parseFloat(a[cat.key])||0))
              .slice(0,10)
            return (
              <div key={cat.key} className="rounded-xl overflow-hidden"
                   style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
                <div className="px-4 py-3" style={{ background:'#ddd7ca',borderBottom:'1px solid #d4cec3' }}>
                  <h3 className="font-bold text-sm" style={{ color:cat.color }}>{cat.label}</h3>
                </div>
                <div>
                  {sorted.map((p:any,i:number) => (
                    <Link key={p.id} href={`/player/${p.pid}`} className="no-underline">
                      <div className="flex items-center gap-3 px-3 py-2.5 hover:brightness-110 transition-all"
                           style={{ background:i%2===0?'#ece7dd':'#e8e2d6',
                                    borderBottom:'1px solid #16120d' }}>
                        <span className="text-xs font-bold w-5 text-right flex-shrink-0"
                              style={{ color:i===0?cat.color:'#9c8e7a' }}>{i+1}</span>
                        {/* Photo */}
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                             style={{ background:readableTeamColor(p.teamColor||'555')+'22' }}>
                          {p.photo
                            ? <img src={p.photo} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-xs font-black"
                                   style={{ color:readableTeamColor(p.teamColor||'555') }}>
                                {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                              </div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{p.name}</div>
                          <div className="text-xs" style={{ color:'#6b5f4e' }}>{p.team} · {p.pos}</div>
                        </div>
                        <span className="text-sm font-black flex-shrink-0"
                              style={{ color:i===0?cat.color:'#1a1512' }}>{p[cat.key]}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

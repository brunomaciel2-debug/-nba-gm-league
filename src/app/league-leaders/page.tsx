import { supabase } from '@/lib/supabase'
export const revalidate = 60

export default async function LeagueLeadersPage() {
  const { data: stats } = await supabase
    .from('player_stats')
    .select('*, players(name, pos, team_id)')
    .eq('season','2025-26')
    .gt('games', 0)
    .order('pts', { ascending: false })
    .limit(200)

  const rows = (stats||[]).map((s:any) => ({
    ...s,
    name: s.players?.name || '—',
    pos:  s.players?.pos  || '—',
    team: s.players?.team_id || '—',
    ppg:  s.games > 0 ? (s.pts/s.games).toFixed(1) : '—',
    rpg:  s.games > 0 ? (s.reb/s.games).toFixed(1) : '—',
    apg:  s.games > 0 ? (s.ast/s.games).toFixed(1) : '—',
    spg:  s.games > 0 ? (s.stl/s.games).toFixed(1) : '—',
    bpg:  s.games > 0 ? (s.blk/s.games).toFixed(1) : '—',
    fgpct: s.fga > 0 ? (s.fgm/s.fga*100).toFixed(1)+'%' : '—',
    tppct: s.tpa > 0 ? (s.tpm/s.tpa*100).toFixed(1)+'%' : '—',
  }))

  const cats = [
    { label:'Points', key:'ppg', color:'#ffa040' },
    { label:'Rebounds', key:'rpg', color:'#40e080' },
    { label:'Assists', key:'apg', color:'#60a0ff' },
    { label:'Steals', key:'spg', color:'#c040ff' },
    { label:'Blocks', key:'bpg', color:'#ff6040' },
    { label:'FG%', key:'fgpct', color:'#40d0d0' },
    { label:'3P%', key:'tppct', color:'#ffd040' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">📊 League Leaders — 2025-26</h1>
      {rows.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background:'#0f1e33',border:'1px solid #1e3a5f' }}>
          <p style={{ color:'#506070' }}>Stats will appear here once the season begins.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {cats.map(cat => {
            const sorted = [...rows].sort((a:any,b:any)=>parseFloat(b[cat.key])||0 - parseFloat(a[cat.key])||0).slice(0,10)
            return (
              <div key={cat.key} className="rounded-xl overflow-hidden"
                   style={{ background:'#0f1e33', border:'1px solid #1e3a5f' }}>
                <div className="px-4 py-3" style={{ background:'#060c18', borderBottom:'1px solid #1e3a5f' }}>
                  <h3 className="font-bold text-sm" style={{ color:cat.color }}>{cat.label}</h3>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {sorted.map((p:any,i:number)=>(
                      <tr key={p.id} style={{ borderBottom:'1px solid #0a1628',
                        background:i%2===0?'#0f1e33':'#0c1a2c' }}>
                        <td className="px-3 py-2 font-bold w-6" style={{ color:'#405060' }}>{i+1}</td>
                        <td className="px-2 py-2 font-semibold text-white">{p.name}</td>
                        <td className="px-2 py-2" style={{ color:'#7090b0' }}>{p.team}</td>
                        <td className="px-2 py-2" style={{ color:'#506070' }}>{p.pos}</td>
                        <td className="px-3 py-2 text-right font-bold" style={{ color:cat.color }}>{p[cat.key]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

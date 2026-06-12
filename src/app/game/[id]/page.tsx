import { supabase } from '@/lib/supabase'
export const revalidate = 60

export default async function GamePage({ params }: { params: { id: string } }) {
  const [{ data: game }, { data: pbp }, { data: boxes }] = await Promise.all([
    supabase.from('games')
      .select('*, home:teams!games_home_team_fkey(*), away:teams!games_away_team_fkey(*)')
      .eq('id', params.id).single(),
    supabase.from('play_by_play').select('*').eq('game_id', params.id)
      .order('quarter').order('id'),
    supabase.from('box_scores').select('*, players(name,pos)').eq('game_id', params.id),
  ])
  if (!game) return <div className="p-8 text-center" style={{ color:'#6b5f4e' }}>Game not found.</div>

  const home = (game as any).home
  const away = (game as any).away
  const homeBox = (boxes||[]).filter((b:any)=>b.team_id===home.id)
  const awayBox = (boxes||[]).filter((b:any)=>b.team_id===away.id)
  const pct = (m:number,a:number) => a>0?(m/a*100).toFixed(1)+'%':'—'
  const winner = (game.home_score||0)>(game.away_score||0)?'home':'away'

  const BoxTable = ({ rows, team }: { rows: any[], team: any }) => {
    const tot = rows.reduce((acc:any,r:any)=>{
      ;['pts','reb','ast','stl','blk','fgm','fga','tpm','tpa','ftm','fta','turnovers'].forEach(k=>acc[k]=(acc[k]||0)+(r[k]||0))
      return acc
    }, {})
    return (
      <div className="mb-6">
        <div className="px-4 py-2 font-bold text-sm" style={{ background:'#ddd7ca', borderBottom:'1px solid #d4cec3', color:'#'+team.color }}>
          {team.name}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[540px]">
            <thead>
              <tr style={{ background:'#ddd7ca', borderBottom:'1px solid #d4cec3' }}>
                {['Player','MIN','PTS','REB','AST','STL','BLK','FG','FG%','3P','3P%','FT','FT%','TO'].map(h=>(
                  <th key={h} className="px-2 py-2 text-right font-semibold first:text-left" style={{ color:'#6b5f4e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r:any,i:number)=>(
                <tr key={r.id} style={{ background:i%2===0?'#ece7dd':'#e8e2d6', borderBottom:'1px solid #16120d' }}>
                  <td className="px-2 py-2 font-medium text-white">{r.players?.name||'—'} <span style={{ color:'#6b5f4e' }}>{r.players?.pos}</span></td>
                  <td className="px-2 py-2 text-right" style={{ color:'#6b5f4e' }}>{r.mins}</td>
                  <td className="px-2 py-2 text-right font-bold" style={{ color:'#c2410c' }}>{r.pts}</td>
                  <td className="px-2 py-2 text-right" style={{ color:'#166534' }}>{r.reb}</td>
                  <td className="px-2 py-2 text-right" style={{ color:'#1e40af' }}>{r.ast}</td>
                  <td className="px-2 py-2 text-right" style={{ color:'#7c3aed' }}>{r.stl}</td>
                  <td className="px-2 py-2 text-right" style={{ color:'#ff6040' }}>{r.blk}</td>
                  <td className="px-2 py-2 text-right">{r.fgm}/{r.fga}</td>
                  <td className="px-2 py-2 text-right">{pct(r.fgm,r.fga)}</td>
                  <td className="px-2 py-2 text-right">{r.tpm}/{r.tpa}</td>
                  <td className="px-2 py-2 text-right">{pct(r.tpm,r.tpa)}</td>
                  <td className="px-2 py-2 text-right">{r.ftm}/{r.fta}</td>
                  <td className="px-2 py-2 text-right">{pct(r.ftm,r.fta)}</td>
                  <td className="px-2 py-2 text-right">{r.turnovers}</td>
                </tr>
              ))}
              <tr style={{ background:'#ddd7ca', borderTop:'1px solid #3a3228' }}>
                <td className="px-2 py-2 font-bold text-white" colSpan={2}>TOTALS</td>
                <td className="px-2 py-2 text-right font-bold" style={{ color:'#c2410c' }}>{tot.pts}</td>
                <td className="px-2 py-2 text-right font-bold" style={{ color:'#166534' }}>{tot.reb}</td>
                <td className="px-2 py-2 text-right font-bold" style={{ color:'#1e40af' }}>{tot.ast}</td>
                <td className="px-2 py-2 text-right">{tot.stl}</td>
                <td className="px-2 py-2 text-right">{tot.blk}</td>
                <td className="px-2 py-2 text-right">{tot.fgm}/{tot.fga}</td>
                <td className="px-2 py-2 text-right">{pct(tot.fgm,tot.fga)}</td>
                <td className="px-2 py-2 text-right">{tot.tpm}/{tot.tpa}</td>
                <td className="px-2 py-2 text-right">{pct(tot.tpm,tot.tpa)}</td>
                <td className="px-2 py-2 text-right">{tot.ftm}/{tot.fta}</td>
                <td className="px-2 py-2 text-right">{pct(tot.ftm,tot.fta)}</td>
                <td className="px-2 py-2 text-right">{tot.turnovers}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Scoreboard */}
      <div className="flex items-center rounded-2xl overflow-hidden mb-6"
           style={{ background:'#e8e2d6', border:'1px solid #d4cec3' }}>
        {[{t:home,sc:game.home_score,side:'home'},{t:away,sc:game.away_score,side:'away'}].map(({t,sc,side},i)=>(
          <div key={side} className="flex-1 p-6 text-center" style={i===0?{borderRight:'1px solid #3a3228'}:{}}>
            <div className="text-xs font-bold mb-1" style={{ color:'#'+t.color }}>{t.id}</div>
            <div className="text-sm font-medium mb-2" style={{ color:'#1a1512' }}>{t.name}</div>
            <div className="text-5xl font-black"
                 style={{ color: winner===side?'#e8e2d6':'#5c554e' }}>{sc??'—'}</div>
          </div>
        ))}
      </div>

      {/* Tabs — box + PBP */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color:'#6b5f4e' }}>Box Score</h2>
        <div className="rounded-xl overflow-hidden" style={{ border:'1px solid #d4cec3' }}>
          <BoxTable rows={homeBox} team={home} />
          <BoxTable rows={awayBox} team={away} />
        </div>
      </div>

      {/* PBP */}
      {(pbp||[]).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color:'#6b5f4e' }}>Play-by-Play</h2>
          <div className="rounded-xl overflow-hidden" style={{ border:'1px solid #d4cec3' }}>
            {[1,2,3,4].map(q=>{
              const qPlays = (pbp||[]).filter((p:any)=>p.quarter===q)
              if(!qPlays.length) return null
              return (
                <div key={q}>
                  <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest"
                       style={{ background:'#ddd7ca',borderBottom:'1px solid #d4cec3',color:'#6b5f4e' }}>
                    Q{q}
                  </div>
                  {qPlays.map((p:any,i:number)=>(
                    <div key={p.id} className="flex gap-3 px-4 py-2 text-xs"
                         style={{ background:i%2===0?'#ece7dd':'#e8e2d6', borderBottom:'1px solid #16120d' }}>
                      <span className="min-w-[36px] font-mono" style={{ color:'#9c8e7a' }}>{p.time_left}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0"
                            style={{ background:p.team_id===home.id?'#'+home.color+'22':'#'+away.color+'22',
                                     color:p.team_id===home.id?'#'+home.color:'#'+away.color }}>
                        {p.team_id||'—'}
                      </span>
                      <span className="flex-1 text-white">{p.description}</span>
                      <span className="font-bold" style={{ color:'#6b5f4e' }}>{p.home_score}–{p.away_score}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

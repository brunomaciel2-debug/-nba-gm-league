import { supabase } from '@/lib/supabase'
import type { Team } from '@/lib/types'
export const revalidate = 60

export default async function StandingsPage() {
  const { data: teams } = await supabase.from('teams').select('*')
  const sorted = (teams||[]).sort((a:Team,b:Team)=>b.wins-a.wins||(b.pts_for-b.pts_against)-(a.pts_for-a.pts_against))
  const byConf: Record<string, Record<string, Team[]>> = {}
  sorted.forEach((t:Team)=>{
    if(!byConf[t.conference]) byConf[t.conference]={}
    if(!byConf[t.conference][t.division]) byConf[t.conference][t.division]=[]
    byConf[t.conference][t.division].push(t)
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">🏆 Standings — 2025-26</h1>
      {['Eastern','Western'].map(conf => (
        <div key={conf} className="mb-8">
          <h2 className="text-lg font-bold mb-4" style={{ color: conf==='Eastern'?'#e04040':'#3a8adf' }}>
            {conf} Conference
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e3a5f' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#060c18', borderBottom: '1px solid #1e3a5f' }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: '#7090b0' }}>Team</th>
                  {['W','L','PCT','GB','PF','PA','+/-'].map(h=>(
                    <th key={h} className="px-3 py-3 font-semibold text-right" style={{ color: '#7090b0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.filter((t:Team)=>t.conference===conf).map((t:Team,i:number) => {
                  const gp = t.wins+t.losses
                  const pct = gp>0?(t.wins/gp).toFixed(3):'—'
                  const diff = t.pts_for-t.pts_against
                  const isPlayoff = i<8
                  return (
                    <tr key={t.id} style={{ background: i%2===0?'#0f1e33':'#0c1a2c', borderBottom:'1px solid #0a1628' }}
                        className="hover:brightness-110 transition-all cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-5 text-right font-bold"
                                style={{ color: isPlayoff?'#40e080':'#506070' }}>{i+1}</span>
                          <span className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                                style={{ background: '#'+t.color }}></span>
                          <span className="font-semibold text-white">{t.name}</span>
                          {isPlayoff && <span className="text-xs px-1.5 rounded" style={{ background:'#0a2a10',color:'#40e080' }}>P</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold" style={{ color: '#40e080' }}>{t.wins}</td>
                      <td className="px-3 py-3 text-right" style={{ color: '#7090b0' }}>{t.losses}</td>
                      <td className="px-3 py-3 text-right" style={{ color: '#c0ccd8' }}>{pct}</td>
                      <td className="px-3 py-3 text-right" style={{ color: '#506070' }}>—</td>
                      <td className="px-3 py-3 text-right" style={{ color: '#7090b0' }}>{t.pts_for}</td>
                      <td className="px-3 py-3 text-right" style={{ color: '#7090b0' }}>{t.pts_against}</td>
                      <td className="px-3 py-3 text-right font-semibold"
                          style={{ color: diff>=0?'#40e080':'#e04040' }}>
                        {diff>=0?'+':''}{diff}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

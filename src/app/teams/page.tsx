import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Team } from '@/lib/types'
export const revalidate = 60

export default async function TeamsPage() {
  const { data: teams } = await supabase.from('teams').select('*')
  const byConf: Record<string,Record<string,Team[]>> = {}
  ;(teams||[]).forEach((t:Team)=>{
    if(!byConf[t.conference]) byConf[t.conference]={}
    if(!byConf[t.conference][t.division]) byConf[t.conference][t.division]=[]
    byConf[t.conference][t.division].push(t)
  })
  const capFmt = (n:number) => '$'+Math.round(n/1000000).toLocaleString()+'M'
  const space = (t:Team) => t.salary_cap - t.cap_used

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">🏀 All 30 Teams</h1>
      {['Eastern','Western'].map(conf=>(
        <div key={conf} className="mb-8">
          <h2 className="text-lg font-bold mb-4" style={{ color:conf==='Eastern'?'#e04040':'#3a8adf' }}>
            {conf} Conference
          </h2>
          {Object.entries(byConf[conf]||{}).map(([div,divTeams])=>(
            <div key={div} className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color:'#6a5a4a' }}>{div} Division</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {(divTeams as Team[]).map((t:Team)=>(
                  <Link key={t.id} href={`/team/${t.id}`} className="no-underline group">
                    <div className="rounded-xl p-4 h-full transition-all"
                         style={{ background:'#241f18', border:'1px solid #3a3228',
                                  borderTop:'3px solid #'+t.color }}>
                      <div className="text-xs font-bold mb-1" style={{ color:'#'+t.color }}>{t.id}</div>
                      <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors leading-tight mb-2">
                        {t.name}
                      </div>
                      <div className="text-xs" style={{ color:'#6a5a4a' }}>{t.arena}</div>
                      <div className="flex gap-3 mt-2">
                        <span className="text-xs font-bold" style={{ color:'#40e080' }}>{t.wins}W</span>
                        <span className="text-xs" style={{ color:'#8a7a6a' }}>{t.losses}L</span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: space(t)>0?'#40e080':'#e04040' }}>
                        Cap: {capFmt(space(t))} {space(t)>0?'space':'over'}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

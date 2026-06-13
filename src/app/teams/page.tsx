import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Team } from '@/lib/types'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60

export default async function TeamsPage() {
  const { data: teams } = await supabase.from('teams').select('*').not('id','in','(ALL,RVS)')
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
      <h1 className="text-2xl font-bold mb-6" style={{color:'#1a1612'}}>🏀 All 30 Teams</h1>
      {['Eastern','Western'].map(conf=>(
        <div key={conf} className="mb-8">
          <h2 className="text-lg font-bold mb-4"
              style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>{conf} Conference</h2>
          {Object.entries(byConf[conf]||{}).map(([div,divTeams])=>(
            <div key={div} className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{color:'#6b5f4e'}}>{div} Division</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {(divTeams as Team[]).map((t:Team)=>{
                  const tc = readableTeamColor(t.color)
                  return (
                    <Link key={t.id} href={`/team/${t.id}`} className="no-underline group">
                      <div className="rounded-xl p-4 h-full transition-all"
                           style={{background:'#e8e2d6',border:'1px solid #d4cec3',
                                   borderTop:'3px solid '+tc}}>
                        <div className="flex justify-center mb-3">
                          <div className="w-16 h-16 flex items-center justify-center overflow-hidden rounded-xl"
                               style={{background:tc+'15'}}>
                            {t.logo_url
                              ?<img src={t.logo_url} alt="" className="w-full h-full object-contain p-1"/>
                              :<span className="text-2xl font-black" style={{color:tc}}>{t.id}</span>
                            }
                          </div>
                        </div>
                        <div className="text-sm font-semibold group-hover:brightness-125 transition-all leading-tight mb-2"
                             style={{color:'#1a1612'}}>
                          {t.name}
                        </div>
                        <div className="text-xs" style={{color:'#6b5f4e'}}>{t.arena}</div>
                        <div className="flex gap-3 mt-2">
                          <span className="text-xs font-bold" style={{color:'#166534'}}>{t.wins}W</span>
                          <span className="text-xs" style={{color:'#6b5f4e'}}>{t.losses}L</span>
                        </div>
                        <div className="text-xs mt-1"
                             style={{color:space(t)>0?'#15803d':'#dc2626'}}>
                          {space(t)>0?'Cap space: '+capFmt(space(t)):'Over cap'}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Team } from '@/lib/types'
import { readableTeamColor } from '@/lib/color'
export const dynamic = 'force-dynamic'

export default async function TeamsPage() {
  const [{ data: teams }, { data: worldTeams }] = await Promise.all([
    supabase.from('teams').select('*').not('id','in','(ALL,RVS,ROO,SOP)'),
    supabase.from('world_teams').select('*').order('continent').order('country').order('name'),
  ])
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

      {/* ── INTERNATIONAL TEAMS ──────────────────────────── */}
      {(worldTeams||[]).length > 0 && (
        <div style={{marginTop:48,paddingTop:32,borderTop:'2px solid #d4cdc5'}}>
          <div className="sec-hdr mb-2">
            <span className="sec-title">
              🌍 International Teams
            </span>
            <span className="text-xs" style={{color:'#8a8279'}}>Pre-season friendlies only</span>
          </div>
          <p className="text-xs mb-6" style={{color:'#8a8279'}}>
            These teams are available for pre-season friendly games. GMs can propose a game from each team's page.
          </p>
          {Object.entries(
            (worldTeams||[]).reduce((acc: Record<string,any[]>, t: any) => {
              if (!acc[t.continent]) acc[t.continent] = []
              acc[t.continent].push(t)
              return acc
            }, {})
          ).sort().map(([continent, cteams]: any) => (
            <div key={continent} style={{marginBottom:32}}>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{color:'#5c554e',letterSpacing:'1.5px'}}>{continent}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {cteams.map((t: any) => {
                  const tc = t.color || '#1d4ed8'
                  return (
                    <Link key={t.id} href={`/world/${t.id}`} className="no-underline group">
                      <div className="rounded-xl p-4 transition-all group-hover:brightness-95"
                           style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderLeft:`4px solid ${tc}`}}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                               style={{background:tc+'18'}}>
                            {t.logo_url
                              ?<img src={t.logo_url} alt="" className="w-full h-full object-contain p-0.5"/>
                              :<span className="text-xs font-black" style={{color:tc}}>{t.id}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate" style={{color:'#1a1512'}}>{t.name}</div>
                            <div className="text-xs" style={{color:'#8a8279'}}>{t.country}</div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 30

export default async function JobVacanciesPage() {
  const [{ data: teams }, { data: profiles }] = await Promise.all([
    supabase.from('teams').select('*').not('id','in','(ALL,RVS)').order('conference').order('name'),
    supabase.from('gm_profiles').select('team_id').not('team_id','is',null),
  ])

  const takenTeams = new Set((profiles||[]).map((p:any) => p.team_id))
  const eastern = (teams||[]).filter((t:any) => t.conference === 'Eastern')
  const western = (teams||[]).filter((t:any) => t.conference === 'Western')
  const openCount = (teams||[]).filter((t:any) => !takenTeams.has(t.id)).length

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🏀</div>
        <h1 className="text-3xl font-black mb-2" style={{color:'#1a1612'}}>NBA GM League</h1>
        <h2 className="text-xl font-bold mb-3" style={{color:'#b45309'}}>General Manager Vacancies</h2>
        <p className="text-sm max-w-lg mx-auto" style={{color:'#6b5f4e'}}>
          Take control of an NBA franchise. Manage trades, draft picks, staff, and lead your team to a championship.
        </p>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="text-center">
            <div className="text-2xl font-black" style={{color:'#166534'}}>{openCount}</div>
            <div className="text-xs" style={{color:'#6b5f4e'}}>Open Positions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black" style={{color:'#dc2626'}}>{30 - openCount}</div>
            <div className="text-xs" style={{color:'#6b5f4e'}}>Filled</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black" style={{color:'#1e40af'}}>30</div>
            <div className="text-xs" style={{color:'#6b5f4e'}}>Total Franchises</div>
          </div>
        </div>
      </div>

      {/* Conferences */}
      {[{label:'Eastern Conference', teams:eastern, color:'#e05050'},
        {label:'Western Conference', teams:western, color:'#5090d0'}].map(conf => (
        <div key={conf.label} className="mb-10">
          <h3 className="text-sm font-bold uppercase tracking-widest mb-4"
              style={{color:conf.color}}>{conf.label}</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {conf.teams.map((t:any) => {
              const isOpen = !takenTeams.has(t.id)
              const tc = readableTeamColor(t.color)
              return (
                <Link key={t.id} href={`/jobs/${t.id}`} className="no-underline group">
                  <div className="rounded-xl p-4 h-full transition-all group-hover:brightness-125"
                       style={{background:'#e8e2d6',
                               border:'1px solid '+(isOpen?'#1a5a20':'#5a1a1a'),
                               borderTop:'3px solid '+(isOpen?'#40e080':'#e04040')}}>
                    {/* Logo */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden mx-auto mb-3 flex items-center justify-center"
                         style={{background:tc+'22'}}>
                      {t.logo_url
                        ?<img src={t.logo_url} alt="" className="w-full h-full object-contain p-1.5"/>
                        :<span className="text-lg font-black" style={{color:tc}}>{t.id}</span>}
                    </div>
                    {/* Name */}
                    <div className="text-sm font-bold text-center mb-1 leading-tight" style={{color:'#1a1612'}}>
                      {t.name}
                    </div>
                    <div className="text-xs text-center mb-2" style={{color:'#6b5f4e'}}>{t.city}</div>
                    {/* Status */}
                    <div className="text-center">
                      <span className="text-xs font-bold px-2 py-1 rounded-full"
                            style={{background:isOpen?'#0a2a10':'#2a0a0a',
                                    color:isOpen?'#40e080':'#e04040'}}>
                        {isOpen ? '✅ Open' : '❌ Filled'}
                      </span>
                    </div>
                    {/* Record */}
                    <div className="flex justify-center gap-2 mt-2 text-xs" style={{color:'#9c8e7a'}}>
                      <span>{t.wins}W</span><span>·</span><span>{t.losses}L</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

import { supabase } from '@/lib/supabase'
import Link from 'next/link'
export const revalidate = 60

const ROLE_COLORS: Record<string,string> = {
  head_coach:'#ffd040', assistant_coach:'#60a0ff', trainer:'#40e080', physio:'#c040ff'
}
const ATK: Record<string,string> = {motion:'Motion',pickroll:'P&R',transition:'Transition',iso:'Iso',post:'Post'}
const DEF: Record<string,string> = {man:'Man',zone23:'Zone',press:'Press',pack:'Pack'}

export default async function CoachesAdminPage() {
  const [{ data: coaches }, { data: teams }] = await Promise.all([
    supabase.from('coaches').select('*').order('role').order('name'),
    supabase.from('teams').select('id,name,color,logo_url').not('id','in','(ALL,RVS)'),
  ])
  const teamMap = Object.fromEntries((teams||[]).map((t:any)=>[t.id,t]))
  const freeAgents = (coaches||[]).filter((c:any)=>!c.team_id)
  const byTeam: Record<string,any[]> = {}
  ;(coaches||[]).filter((c:any)=>c.team_id).forEach((c:any)=>{
    if(!byTeam[c.team_id])byTeam[c.team_id]=[]
    byTeam[c.team_id].push(c)
  })

  const personality = (v:number) => {
    if (v<=3) return {label:'Calm',color:'#60a0ff'}
    if (v<=6) return {label:'Balanced',color:'#40e080'}
    if (v<=8) return {label:'Intense',color:'#ffa040'}
    return {label:'Hot-headed',color:'#e04040'}
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{color:'#f0ebe0'}}>🎯 Coaching Staff — All Teams</h1>
        <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg no-underline" style={{background:'#3a3228',color:'#8a7a6a'}}>← Admin</Link>
      </div>

      {/* Teams */}
      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        {Object.entries(byTeam).sort().map(([tid, staff]) => {
          const t = teamMap[tid]
          return (
            <div key={tid} className="rounded-xl overflow-hidden" style={{border:'1px solid #3a3228'}}>
              <div className="flex items-center gap-2 px-4 py-2" style={{background:'#120f0a',borderBottom:'1px solid #3a3228'}}>
                {t?.logo_url&&<img src={t.logo_url} alt="" className="w-5 h-5 object-contain"/>}
                <span className="font-bold" style={{color:'#f0ebe0'}}>{t?.name||tid}</span>
                <span className="ml-auto text-xs" style={{color:'#6a5a4a'}}>{staff.length} staff</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{background:'#1a1610',borderBottom:'1px solid #3a3228'}}>
                      {['Role','Name','OA','DA','Sub','TO','OD','DD','Tac','Phy','Men','Atk','Def','Pers','Cond','Rec','Inj','Rehab'].map(h=>(
                        <th key={h} className="px-2 py-1.5 text-left font-semibold" style={{color:'#6a5a4a',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((c:any,i:number)=>{
                      const rc = ROLE_COLORS[c.role]||'#8a7a6a'
                      const pers = personality(c.personality||5)
                      return (
                        <tr key={c.id} style={{background:i%2===0?'#241f18':'#1e1a14',borderBottom:'1px solid #2a2218'}}>
                          <td className="px-2 py-1.5 font-semibold" style={{color:rc,whiteSpace:'nowrap'}}>{c.role.replace('_',' ')}</td>
                          <td className="px-2 py-1.5 font-semibold" style={{color:'#f0ebe0',whiteSpace:'nowrap'}}>{c.name}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.off_adjustment>=80?'#ffd040':'#8a7a6a'}}>{c.off_adjustment||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.def_adjustment>=80?'#40e080':'#8a7a6a'}}>{c.def_adjustment||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.substitutions||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.timeout_mgmt||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.off_development>=80?'#ffa040':'#8a7a6a'}}>{c.off_development||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.def_development>=80?'#40e080':'#8a7a6a'}}>{c.def_development||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.tactical_dev||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.physical_dev||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.mental_dev||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:'#ffa040',whiteSpace:'nowrap'}}>{c.pref_atk_style?ATK[c.pref_atk_style]:'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:'#40e080',whiteSpace:'nowrap'}}>{c.pref_def_style?DEF[c.pref_def_style]:'—'}</td>
                          <td className="px-2 py-1.5 text-center font-semibold" style={{color:pers.color}}>{c.personality||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.conditioning>=80?'#40e080':'#8a7a6a'}}>{c.conditioning||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.recovery_boost||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.injury_prevent||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.rehab_speed>=80?'#c040ff':'#8a7a6a'}}>{c.rehab_speed||'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {/* Free Agents */}
      <h2 className="text-sm font-bold mb-4" style={{color:'#f0ebe0'}}>🆓 Free Agent Staff ({freeAgents.length})</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        {freeAgents.map((c:any)=>{
          const rc=ROLE_COLORS[c.role]||'#8a7a6a'
          return (
            <div key={c.id} className="rounded-xl p-3" style={{background:'#241f18',border:'1px solid #3a3228'}}>
              <div className="text-xs font-semibold mb-0.5" style={{color:rc}}>{c.role.replace('_',' ')}</div>
              <div className="font-bold text-sm" style={{color:'#f0ebe0'}}>{c.name}</div>
              <div className="text-xs mt-1" style={{color:'#6a5a4a'}}>
                {c.role==='physio'?`Rehab: ${c.rehab_speed}`:
                 c.role==='trainer'?`Cond: ${c.conditioning} · Rec: ${c.recovery_boost}`:
                 `OFF: ${c.off_adjustment} · DEF: ${c.def_adjustment}`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

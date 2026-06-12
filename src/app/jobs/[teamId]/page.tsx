import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import ApplyForm from './ApplyForm'
export const revalidate = 30

export default async function TeamJobPage({ params }: { params: { teamId: string } }) {
  const teamId = params.teamId.toUpperCase()
  const [{ data: team }, { data: players }, { data: coaches }, { data: profile }] = await Promise.all([
    supabase.from('teams').select('*').eq('id', teamId).single(),
    supabase.from('players').select('id,name,pos,salary,usage,potential_grade')
      .eq('team_id', teamId).eq('status','active').order('usage',{ascending:false}),
    supabase.from('coaches').select('name,role').eq('team_id', teamId),
    supabase.from('gm_profiles').select('id,display_name').eq('team_id', teamId).single(),
  ])

  if (!team) notFound()

  const isOpen = !profile
  const tc = readableTeamColor((team as any).color)
  const capFmt = (n: number) => n >= 1000000 ? '$' + (n/1000000).toFixed(1) + 'M' : '$' + n?.toLocaleString()
  const cap = (team as any).salary_cap
  const used = (team as any).cap_used
  const space = cap - used
  const hc = (coaches||[]).find((c:any) => c.role === 'head_coach')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/jobs" className="text-xs no-underline mb-6 block" style={{color:'#8a7a6a'}}>
        ← Back to All Vacancies
      </Link>

      {/* Team header */}
      <div className="rounded-2xl p-6 mb-6"
           style={{background:'#241f18',borderTop:'4px solid '+tc,border:'1px solid #3a3228'}}>
        <div className="flex items-center gap-5 flex-wrap">
          <div className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
               style={{background:tc+'22',border:'2px solid '+tc+'44'}}>
            {(team as any).logo_url
              ?<img src={(team as any).logo_url} alt="" className="w-full h-full object-contain p-2"/>
              :<span className="text-2xl font-black" style={{color:tc}}>{teamId}</span>}
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold mb-1" style={{color:tc}}>
              {(team as any).conference} · {(team as any).division}
            </div>
            <h1 className="text-2xl font-black mb-1" style={{color:'#f0ebe0'}}>{(team as any).name}</h1>
            <div className="text-sm" style={{color:'#8a7a6a'}}>{(team as any).arena} · {(team as any).city}</div>
          </div>
          <div className="text-center">
            <span className="text-sm font-bold px-4 py-2 rounded-full"
                  style={{background:isOpen?'#0a2a10':'#2a0a0a',color:isOpen?'#40e080':'#e04040'}}>
              {isOpen ? '✅ Position Open' : '❌ Position Filled'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Franchise info */}
        <div className="rounded-xl p-4" style={{background:'#241f18',border:'1px solid #3a3228'}}>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6a5a4a'}}>
            📊 Franchise Overview
          </h3>
          {[
            ['Record', `${(team as any).wins}W – ${(team as any).losses}L`],
            ['Head Coach', hc?.name || 'TBA'],
            ['Cap Space', space > 0 ? '+' + capFmt(space) : 'Over cap ' + capFmt(Math.abs(space))],
            ['Arena', (team as any).arena],
            ['Capacity', (team as any).arena_capacity ? (team as any).arena_capacity.toLocaleString() + ' seats' : 'N/A'],
            ['City', (team as any).city],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between py-1.5" style={{borderBottom:'1px solid #2a2218'}}>
              <span className="text-xs" style={{color:'#6a5a4a'}}>{l}</span>
              <span className="text-xs font-semibold" style={{color:'#f0ebe0'}}>{v}</span>
            </div>
          ))}
        </div>

        {/* Roster preview */}
        <div className="rounded-xl p-4" style={{background:'#241f18',border:'1px solid #3a3228'}}>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6a5a4a'}}>
            🏀 Full Roster ({(players||[]).length} players)
          </h3>
          {(players||[]).map((p:any) => (
            <Link key={p.id} href={`/player/${p.id}`} className="no-underline group">
              <div className="flex items-center gap-2 py-1.5 group-hover:brightness-125 transition-all"
                   style={{borderBottom:'1px solid #2a2218'}}>
                <span className="text-xs w-7 flex-shrink-0" style={{color:'#6a5a4a'}}>{p.pos}</span>
                <span className="text-xs flex-1 font-semibold" style={{color:'#f0ebe0'}}>{p.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                      style={{background:p.potential_grade==='A'?'#2a2000':'#1a1610',
                              color:p.potential_grade==='A'?'#ffd040':p.potential_grade==='B'?'#40e080':'#6a5a4a'}}>
                  {p.potential_grade}
                </span>
                <span className="text-xs" style={{color:'#6a5a4a'}}>{capFmt(p.salary)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Apply form or filled message */}
      {isOpen ? (
        <ApplyForm teamId={teamId} teamName={(team as any).name} />
      ) : (
        <div className="rounded-xl p-6 text-center" style={{background:'#2a0a0a',border:'1px solid #5a1a1a'}}>
          <div className="text-3xl mb-3">❌</div>
          <h3 className="font-bold mb-1" style={{color:'#e04040'}}>Position Filled</h3>
          <p className="text-sm mb-4" style={{color:'#8a7a6a'}}>
            This franchise already has a GM. Check other available positions.
          </p>
          <Link href="/jobs" className="text-sm font-bold px-4 py-2 rounded-lg no-underline"
                style={{background:'#3a8adf',color:'#fff'}}>
            View All Vacancies
          </Link>
        </div>
      )}
    </div>
  )
}

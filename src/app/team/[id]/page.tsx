import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import RosterTable from './RosterTable'
import TeamSchedule from './TeamSchedule'
import TeamPageTabs from './TeamPageTabs'
import InjuryReport from './InjuryReport'
import CoachingStaff from './CoachingStaff'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60

export default async function TeamPage({ params }: { params: { id: string } }) {
  const teamId = params.id.toUpperCase()
  const [{ data: team }, { data: players }, { data: games }, { data: allTeams }, { data: injuries }] =
    await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase.from('players').select('*, player_stats(*)')
        .eq('team_id', teamId).eq('status','active').order('usage', { ascending: false }),
      supabase.from('games').select('*')
        .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
        .order('week_number').order('game_number'),
      supabase.from('teams').select('id,name,color,logo_url,arena'),
      supabase.from('injury_log').select('*').eq('status','active').limit(100),
    ])

  if (!team) return <div className="p-8 text-center" style={{color:'#8a7a6a'}}>Team not found.</div>

  const t = team as any
  const color = readableTeamColor(t.color)
  const cap=t.salary_cap, used=t.cap_used, space=cap-used
  const capFmt = (n:number) => '$'+Math.round(n/1000000).toFixed(1)+'M'
  const teamsMap = Object.fromEntries((allTeams||[]).map((x:any)=>[x.id,x]))

  // Filter injuries to only this team's players
  const teamPlayerIds = new Set((players||[]).map((p:any)=>p.id))
  const teamInjuries = (injuries||[]).filter((i:any)=>teamPlayerIds.has(i.player_id))

  const played = (games||[]).filter((g:any)=>g.status==='final')
  const wins   = played.filter((g:any)=>
    (g.home_team===teamId?g.home_score:g.away_score) > (g.home_team===teamId?g.away_score:g.home_score)
  ).length
  const losses = played.length - wins
  const pct    = played.length>0?(wins/played.length).toFixed(3):'—'

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* HEADER */}
      <div className="rounded-2xl p-6 mb-4"
           style={{background:'#241f18',borderTop:'4px solid '+color,border:'1px solid #3a3228'}}>
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
               style={{background:color+'22',border:'2px solid '+color+'44'}}>
            {t.logo_url
              ?<img src={t.logo_url} alt={t.name} className="w-full h-full object-contain p-2"/>
              :<span className="text-2xl font-black" style={{color}}>{t.id}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold mb-1" style={{color}}>{t.conference} · {t.division}</div>
            <h1 className="text-3xl font-bold mb-1" style={{color:'#f0ebe0'}}>{t.name}</h1>
            <div className="text-sm" style={{color:'#8a7a6a'}}>{t.arena} · {t.city}</div>
          </div>
          <div className="flex gap-6">
            {[{v:wins,l:'W',c:'#40e080'},{v:losses,l:'L',c:'#e04040'},{v:pct,l:'PCT',c:'#e8e0d0'}].map(x=>(
              <div key={x.l} className="text-center">
                <div className="text-3xl font-black" style={{color:x.c}}>{x.v}</div>
                <div className="text-xs" style={{color:'#6a5a4a'}}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CAP ROOM + GM PANEL */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl p-4" style={{background:'#241f18',border:'1px solid #3a3228'}}>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6a5a4a'}}>💰 Cap Room</h3>
          <div className="flex justify-between text-xs mb-1">
            <span style={{color:'#8a7a6a'}}>Used</span>
            <span className="font-bold" style={{color:'#f0ebe0'}}>{capFmt(used)}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-1" style={{background:'#3a3228'}}>
            <div className="h-full rounded-full" style={{width:Math.min(100,used/cap*100)+'%',
              background:space>0?'#3a8adf':'#e04040'}}></div>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{color:'#8a7a6a'}}>Cap: {capFmt(cap)}</span>
            <span className="font-bold" style={{color:space>0?'#40e080':'#e04040'}}>
              {space>0?'Space: +'+capFmt(space):'Over: '+capFmt(Math.abs(space))}
            </span>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{background:'#0a2a10',border:'1px solid #1a5a2a'}}>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:'#40e080'}}>🏀 GM Panel</h3>
          <p className="text-xs mb-3" style={{color:'#5a8a5a'}}>Depth chart, ball roles and tactics. Deadline: Sunday 23:59.</p>
          <Link href={`/gm/orders/${teamId}`}
                className="block text-center text-sm font-bold py-2.5 rounded-lg no-underline"
                style={{background:'#0a5a20',color:'#40e080'}}>
            Set Weekly Orders →
          </Link>
        </div>
      </div>

      {/* ROSTER + SCHEDULE TABS */}
      <TeamPageTabs
        players={players||[]}
        games={games||[]}
        teamId={teamId}
        teamColor={color}
        teamsMap={teamsMap}
      />

      {/* COACHING STAFF */}
      <div className="mt-6 rounded-xl p-4" style={{background:'#241f18',border:'1px solid #3a3228'}}>
        <CoachingStaff teamId={teamId} />
      </div>

      {/* INJURY REPORT */}
      <div className="mt-4 rounded-xl p-4" style={{background:'#241f18',border:'1px solid #3a3228'}}>
        <InjuryReport
          injuries={teamInjuries||[]}
          players={players||[]}
        />
      </div>
    </div>
  )
}

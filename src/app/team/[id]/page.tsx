import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import GMPanel from './GMPanel'
import RosterTable from './RosterTable'
import TeamSchedule from './TeamSchedule'
import TeamPageTabs from './TeamPageTabs'
import InjuryReport from './InjuryReport'
import CoachingStaff from './CoachingStaff'
import SeasonSidebar from '@/components/SeasonSidebar'
import { readableTeamColor } from '@/lib/color'
export const dynamic = "force-dynamic"

export default async function TeamPage({ params }: { params: { id: string } }) {
  const teamId = params.id.toUpperCase()
  const [{ data: team }, { data: players }, { data: games }, { data: allTeams }, { data: injuries }, { data: coaches }] =
    await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase.from('players').select('*, player_stats(*)')
        .eq('team_id', teamId).eq('status','active').order('usage', { ascending: false }),
      supabase.from('games').select('*')
        .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
        .order('week_number').order('game_number'),
      supabase.from('teams').select('id,name,color,logo_url,arena'),
      supabase.from('injury_log').select('*').eq('status','active').limit(100),
      supabase.from('coaches').select('*').eq('team_id', teamId),
    ])

  if (!team) return <div className="p-8 text-center" style={{color:'#6b5f4e'}}>Team not found.</div>

  const t = team as any
  const color = readableTeamColor(t.color)
  const cap=t.salary_cap, used=t.cap_used, space=cap-used
  const capFmt = (n:number) => '$'+Math.round(n/1000000).toFixed(1)+'M'
  const teamsMap = Object.fromEntries((allTeams||[]).map((x:any)=>[x.id,x]))

  const teamPlayerIds = new Set((players||[]).map((p:any)=>p.id))
  const teamInjuries = (injuries||[]).filter((i:any)=>teamPlayerIds.has(i.player_id))

  const played = (games||[]).filter((g:any)=>g.status==='final')
  const wins   = played.filter((g:any)=>
    (g.home_team===teamId?g.home_score:g.away_score) > (g.home_team===teamId?g.away_score:g.home_score)
  ).length
  const losses = played.length - wins
  const pct    = played.length>0?(wins/played.length).toFixed(3):'-'

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* HEADER */}
      <div className="rounded-2xl p-6 mb-4"
           style={{background:'#e8e2d6',borderTop:'4px solid '+color,border:'1px solid #d4cec3'}}>
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-28 h-28 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
               style={{background:color+'22',border:'2px solid '+color+'44'}}>
            {t.logo_url
              ?<img src={t.logo_url} alt={t.name} className="w-full h-full object-contain p-1"/>
              :<span className="text-3xl font-black" style={{color}}>{t.id}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold mb-1" style={{color}}>{t.conference} · {t.division}</div>
            <h1 className="text-3xl font-bold mb-1" style={{color:'#1a1612'}}>{t.name}</h1>
            <div className="text-sm" style={{color:'#6b5f4e'}}>{t.arena} · {t.city}</div>
          </div>
          <div className="flex gap-6">
            {[{v:wins,l:'W',c:'#15803d'},{v:losses,l:'L',c:'#dc2626'},{v:pct,l:'PCT',c:'#1a1512'}].map(x=>(
              <div key={x.l} className="text-center">
                <div className="text-3xl font-black" style={{color:x.c}}>{x.v}</div>
                <div className="text-xs" style={{color:'#6b5f4e'}}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT: content + sidebar */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* LEFT: main content */}
        <div className="flex-1 min-w-0">

          {/* CAP ROOM + GM PANEL */}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl p-4" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>💰 Cap Room</h3>
              <div className="flex justify-between text-xs mb-1">
                <span style={{color:'#6b5f4e'}}>Used</span>
                <span className="font-bold" style={{color:'#1a1612'}}>{capFmt(used)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-1" style={{background:'#cec7bc'}}>
                <div className="h-full rounded-full" style={{width:Math.min(100,used/cap*100)+'%',
                  background:space>0?'#1d4ed8':'#dc2626'}}></div>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{color:'#6b5f4e'}}>Cap: {capFmt(cap)}</span>
                <span className="font-bold" style={{color:space>0?'#15803d':'#dc2626'}}>
                  {space>0?'Space: +'+capFmt(space):'Over: '+capFmt(Math.abs(space))}
                </span>
              </div>
            </div>
            <GMPanel teamId={teamId} />
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
          <div className="mt-6 rounded-xl p-4" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
            <CoachingStaff staff={coaches||[]} />
          </div>

          {/* INJURY REPORT */}
          <div className="mt-4 rounded-xl p-4" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
            <InjuryReport
              injuries={teamInjuries||[]}
              players={players||[]}
            />
          </div>
        </div>

        {/* RIGHT: sidebar */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <SeasonSidebar />
        </div>

      </div>
    </div>
  )
}

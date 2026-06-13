'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import Link from 'next/link'

type View = 'conference' | 'league'

const DIV_MAP: Record<string,string> = {
  'Boston Celtics':'Atlantic','Brooklyn Nets':'Atlantic','New York Knicks':'Atlantic',
  'Philadelphia 76ers':'Atlantic','Toronto Raptors':'Atlantic',
  'Chicago Bulls':'Central','Cleveland Cavaliers':'Central','Detroit Pistons':'Central',
  'Indiana Pacers':'Central','Milwaukee Bucks':'Central',
  'Atlanta Hawks':'Southeast','Charlotte Hornets':'Southeast','Miami Heat':'Southeast',
  'Orlando Magic':'Southeast','Washington Wizards':'Southeast',
  'Denver Nuggets':'Northwest','Minnesota Timberwolves':'Northwest',
  'Oklahoma City Thunder':'Northwest','Portland Trail Blazers':'Northwest','Utah Jazz':'Northwest',
  'Golden State Warriors':'Pacific','LA Clippers':'Pacific','Los Angeles Lakers':'Pacific',
  'Phoenix Suns':'Pacific','Sacramento Kings':'Pacific',
  'Dallas Mavericks':'Southwest','Houston Rockets':'Southwest','Memphis Grizzlies':'Southwest',
  'New Orleans Pelicans':'Southwest','San Antonio Spurs':'Southwest',
}

function calcGB(leader: any, team: any) {
  if (!leader || (leader.wins === team.wins && leader.losses === team.losses)) return '—'
  const gb = ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2
  return gb === 0 ? '—' : gb.toFixed(1)
}

function seedStyle(rank: number) {
  if (rank <= 6) return {
    bg: '#f0fdf4', border: '#16a34a22',
    badge: { bg: '#15803d', color: '#fff', label: 'Playoffs' }
  }
  if (rank <= 10) return {
    bg: '#fefce8', border: '#ca8a0422',
    badge: { bg: '#b45309', color: '#fff', label: 'Play-In' }
  }
  return { bg: undefined, border: undefined, badge: null }
}

export default function StandingsPage() {
  const [teams, setTeams] = useState<any[]>([])
  const [view, setView]   = useState<View>('conference')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('teams').select('*').not('id','in','(ALL,RVS)').then(({ data }) => {
      if (data) setTeams(data.sort((a:any,b:any) => b.wins-a.wins || (b.pts_for-b.pts_against)-(a.pts_for-a.pts_against)))
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-12 text-center" style={{color:'#5c554e'}}>Loading standings...</div>

  const byConf = (conf: string) => teams.filter(t => t.conference === conf)
    .sort((a:any,b:any) => b.wins-a.wins || (b.pts_for-b.pts_against)-(a.pts_for-a.pts_against))

  const TeamLogo = ({ t }: { t: any }) => {
    const tc = readableTeamColor(t.color)
    return t.logo_url
      ? <img src={t.logo_url} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
      : <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-xs font-black flex-shrink-0"
              style={{ background:tc+'22', color:tc }}>{t.id.slice(0,3)}</span>
  }

  const ConferenceTable = ({ conf }: { conf: string }) => {
    const confTeams = byConf(conf)
    const leader = confTeams[0]
    return (
      <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3"
             style={{background:conf==='Eastern'?'#1e3a5f':'#3b1a08',borderBottom:'1px solid #d4cdc5'}}>
          <span className="text-sm font-bold" style={{color:'#fff'}}>{conf} Conference</span>
          <div className="flex items-center gap-4 text-xs font-bold" style={{color:'rgba(255,255,255,0.6)'}}>
            <span className="w-6 text-center">W</span>
            <span className="w-6 text-center">L</span>
            <span className="w-12 text-center">PCT</span>
            <span className="w-10 text-center">GB</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-2 text-xs" style={{background:'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{background:'#15803d'}}></div>
            <span style={{color:'#5c554e'}}>Playoffs (1-6)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{background:'#b45309'}}></div>
            <span style={{color:'#5c554e'}}>Play-In (7-10)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{background:'#d4cdc5'}}></div>
            <span style={{color:'#5c554e'}}>Eliminated (11+)</span>
          </div>
        </div>

        {confTeams.map((t: any, i: number) => {
          const rank = i + 1
          const gp   = t.wins + t.losses
          const pct  = gp > 0 ? (t.wins / gp).toFixed(3).replace(/^0/, '') : '.000'
          const gb   = calcGB(leader, t)
          const ss   = seedStyle(rank)

          return (
            <Link key={t.id} href={`/team/${t.id}`} className="no-underline group">
              <div className="flex items-center gap-3 px-4 py-2.5 transition-all group-hover:brightness-95"
                   style={{
                     background: ss.bg || (i%2===0?'#faf8f5':'#f5f1eb'),
                     borderBottom: '1px solid #e2dcd5',
                     borderLeft: `3px solid ${rank<=6?'#15803d':rank<=10?'#b45309':'transparent'}`,
                   }}>
                {/* Rank */}
                <span className="text-xs font-bold w-5 text-right flex-shrink-0"
                      style={{color: rank<=6?'#15803d':rank<=10?'#b45309':'#9c9088'}}>
                  {rank}
                </span>

                {/* Logo */}
                <TeamLogo t={t} />

                {/* Name + division */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{color:'#1a1512'}}>{t.name}</div>
                  <div className="text-xs" style={{color:'#8a8279'}}>{DIV_MAP[t.name]||''}</div>
                </div>

                {/* Seed badge */}
                {ss.badge && rank <= 10 && (
                  <span className="hidden sm:inline text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                        style={{background:ss.badge.bg,color:ss.badge.color,fontSize:10}}>
                    {rank<=6?`#${rank}`:`PI`}
                  </span>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="w-6 text-center text-sm font-bold" style={{color:'#15803d'}}>{t.wins}</span>
                  <span className="w-6 text-center text-sm font-bold" style={{color:'#dc2626'}}>{t.losses}</span>
                  <span className="w-12 text-center text-sm font-semibold" style={{color:'#1a1512'}}>{pct}</span>
                  <span className="w-10 text-center text-sm" style={{color:'#5c554e'}}>{gb}</span>
                </div>
              </div>
            </Link>
          )
        })}

        {/* Play-in explanation */}
        <div className="px-5 py-3 text-xs" style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5',color:'#8a8279'}}>
          Play-In: 7 vs 8 (winner = #7 seed) · 9 vs 10 (winner faces loser of 7v8 → #8 seed)
        </div>
      </div>
    )
  }

  const allSorted = [...teams].sort((a:any,b:any) => b.wins-a.wins || (b.pts_for-b.pts_against)-(a.pts_for-a.pts_against))
  const leagueLeader = allSorted[0]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-6">
        <span className="sec-title">
          <i className="ti ti-list-numbers" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          Standings — 2025-26
        </span>
        <div className="flex gap-2">
          {(['conference','league'] as const).map(v=>(
            <button key={v} onClick={()=>setView(v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{background:view===v?'#1a1512':'#f0ece5',color:view===v?'#fff':'#5c554e',
                      border:'1px solid '+(view===v?'#1a1512':'#d4cdc5')}}>
              {v==='conference'?'By Conference':'League'}
            </button>
          ))}
        </div>
      </div>

      {view === 'conference' && (
        <div className="grid md:grid-cols-2 gap-6">
          <ConferenceTable conf="Eastern" />
          <ConferenceTable conf="Western" />
        </div>
      )}

      {view === 'league' && (
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          <div className="flex items-center justify-between px-5 py-3"
               style={{background:'#1a1512',borderBottom:'1px solid #d4cdc5'}}>
            <span className="text-sm font-bold" style={{color:'#fff'}}>League Standings</span>
            <div className="flex items-center gap-4 text-xs font-bold" style={{color:'rgba(255,255,255,0.6)'}}>
              <span className="w-6 text-center">W</span>
              <span className="w-6 text-center">L</span>
              <span className="w-12 text-center">PCT</span>
              <span className="w-10 text-center">GB</span>
            </div>
          </div>
          {allSorted.map((t:any,i:number) => {
            const rank = i+1
            const gp = t.wins+t.losses
            const pct = gp>0?(t.wins/gp).toFixed(3).replace(/^0/,''):'.000'
            const gb = calcGB(leagueLeader,t)
            const ss = seedStyle(rank <= 16 ? (i%2===0?rank:rank) : 11) // rough
            return (
              <Link key={t.id} href={`/team/${t.id}`} className="no-underline group">
                <div className="flex items-center gap-3 px-4 py-2.5 transition-all group-hover:brightness-95"
                     style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5',
                             borderLeft:`3px solid ${i<12?'#15803d':i<20?'#b45309':'transparent'}`}}>
                  <span className="text-xs font-bold w-5 text-right flex-shrink-0" style={{color:'#9c9088'}}>{rank}</span>
                  <TeamLogo t={t} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{color:'#1a1512'}}>{t.name}</div>
                    <div className="text-xs" style={{color:'#8a8279'}}>{t.conference}</div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="w-6 text-center text-sm font-bold" style={{color:'#15803d'}}>{t.wins}</span>
                    <span className="w-6 text-center text-sm font-bold" style={{color:'#dc2626'}}>{t.losses}</span>
                    <span className="w-12 text-center text-sm font-semibold" style={{color:'#1a1512'}}>{pct}</span>
                    <span className="w-10 text-center text-sm" style={{color:'#5c554e'}}>{gb}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

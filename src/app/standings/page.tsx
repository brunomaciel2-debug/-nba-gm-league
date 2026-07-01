'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

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
  if (rank <= 6) return { bg: '#f0fdf4', border: '#16a34a22', badge: { bg: '#15803d', color: '#fff', label: 'Playoffs' } }
  if (rank <= 10) return { bg: '#fefce8', border: '#ca8a0422', badge: { bg: '#b45309', color: '#fff', label: 'Play-In' } }
  return { bg: undefined, border: undefined, badge: null }
}

export default function StandingsPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [teams, setTeams] = useState<any[]>([])
  const [view, setView] = useState<View>('conference')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('teams').select('*').not('id','in','(ALL,RVS)').then(({ data }) => {
      if (data) setTeams(data.sort((a:any,b:any) => b.wins-a.wins || (b.pts_for-b.pts_against)-(a.pts_for-a.pts_against)))
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#5c554e' }}>{t('common.loading')}</div>

  const byConf = (conf: string) => teams.filter(t => t.conference === conf)
    .sort((a:any,b:any) => b.wins-a.wins || (b.pts_for-b.pts_against)-(a.pts_for-a.pts_against))

  const TeamLogo = ({ t: team }: { t: any }) => {
    const tc = readableTeamColor(team.color)
    return team.logo_url
      ? <img src={team.logo_url} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
      : <span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',width:40,height:40,borderRadius:10,fontSize:11,fontWeight:900,flexShrink:0,background:tc+'22',color:tc }}>{team.id.slice(0,3)}</span>
  }

  const headerLabels = (
    <div style={{ display:'flex',alignItems:'center',gap:16,fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.6)' }}>
      <span style={{ width:24,textAlign:'center' }}>W</span>
      <span style={{ width:24,textAlign:'center' }}>L</span>
      <span style={{ width:48,textAlign:'center' }}>PCT</span>
      <span style={{ width:40,textAlign:'center' }}>GB</span>
    </div>
  )

  const ConferenceTable = ({ conf }: { conf: string }) => {
    const confTeams = byConf(conf)
    const leader = confTeams[0]
    const confLabel = isPT ? (conf === 'Eastern' ? 'Conferência Este' : 'Conferência Oeste') : `${conf} Conference`
    return (
      <div style={{ borderRadius:10,overflow:'hidden',border:'1px solid #d4cdc5' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',background:conf==='Eastern'?'#1e3a5f':'#3b1a08',borderBottom:'1px solid #d4cdc5' }}>
          <span style={{ fontSize:14,fontWeight:700,color:'#fff' }}>{confLabel}</span>
          {headerLabels}
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:16,padding:'8px 20px',background:'#f5f1eb',borderBottom:'1px solid #e2dcd5',fontSize:11 }}>
          {[
            { color:'#15803d', label: isPT?'Playoffs (1-6)':'Playoffs (1-6)' },
            { color:'#b45309', label: isPT?'Play-In (7-10)':'Play-In (7-10)' },
            { color:'#d4cdc5', label: isPT?'Eliminados (11+)':'Eliminated (11+)' },
          ].map(l => (
            <div key={l.label} style={{ display:'flex',alignItems:'center',gap:6 }}>
              <div style={{ width:12,height:12,borderRadius:3,background:l.color }}></div>
              <span style={{ color:'#5c554e' }}>{l.label}</span>
            </div>
          ))}
        </div>
        {confTeams.map((team: any, i: number) => {
          const rank = i + 1
          const gp = team.wins + team.losses
          const pct = gp > 0 ? (team.wins/gp).toFixed(3).replace(/^0/,'') : '.000'
          const gb = calcGB(leader, team)
          const ss = seedStyle(rank)
          return (
            <Link key={team.id} href={`/team/${team.id}`} style={{ textDecoration:'none' }}>
              <div style={{
                display:'flex',alignItems:'center',gap:12,padding:'10px 16px',
                background: ss.bg || (i%2===0?'#faf8f5':'#f5f1eb'),
                borderBottom:'1px solid #e2dcd5',
                borderLeft:`3px solid ${rank<=6?'#15803d':rank<=10?'#b45309':'transparent'}`,
              }}>
                <span style={{ fontSize:11,fontWeight:700,width:20,textAlign:'right',flexShrink:0,color:rank<=6?'#15803d':rank<=10?'#b45309':'#9c9088' }}>{rank}</span>
                <TeamLogo t={team} />
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:14,fontWeight:700,color:'#1a1512',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{team.name}</div>
                  <div style={{ fontSize:11,color:'#8a8279' }}>{DIV_MAP[team.name]||''}</div>
                </div>
                {ss.badge && rank <= 10 && (
                  <span style={{ fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:5,background:ss.badge.bg,color:ss.badge.color,flexShrink:0 }}>
                    {rank<=6?`#${rank}`:'PI'}
                  </span>
                )}
                <div style={{ display:'flex',alignItems:'center',gap:16,flexShrink:0 }}>
                  <span style={{ width:24,textAlign:'center',fontSize:14,fontWeight:700,color:'#15803d' }}>{team.wins}</span>
                  <span style={{ width:24,textAlign:'center',fontSize:14,fontWeight:700,color:'#dc2626' }}>{team.losses}</span>
                  <span style={{ width:48,textAlign:'center',fontSize:14,fontWeight:600,color:'#1a1512' }}>{pct}</span>
                  <span style={{ width:40,textAlign:'center',fontSize:14,color:'#5c554e' }}>{gb}</span>
                </div>
              </div>
            </Link>
          )
        })}
        <div style={{ padding:'10px 20px',fontSize:11,background:'#f5f1eb',borderTop:'1px solid #e2dcd5',color:'#8a8279' }}>
          {isPT ? 'Play-In: 7 vs 8 (vencedor = #7) · 9 vs 10 (vencedor enfrenta perdedor do 7v8 → #8)' : 'Play-In: 7 vs 8 (winner = #7 seed) · 9 vs 10 (winner faces loser of 7v8 → #8 seed)'}
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
          {isPT ? 'Classificação — 2025-26' : 'Standings — 2025-26'}
        </span>
        <div style={{ display:'flex',gap:8 }}>
          {(['conference','league'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ fontSize:12,fontWeight:600,padding:'6px 12px',borderRadius:8,cursor:'pointer',
                       background:view===v?'#1a1512':'#f0ece5',color:view===v?'#fff':'#5c554e',
                       border:'1px solid '+(view===v?'#1a1512':'#d4cdc5') }}>
              {v==='conference' ? (isPT?'Por Conferência':'By Conference') : (isPT?'Liga':'League')}
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
        <div style={{ borderRadius:10,overflow:'hidden',border:'1px solid #d4cdc5' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',background:'#1a1512',borderBottom:'1px solid #d4cdc5' }}>
            <span style={{ fontSize:14,fontWeight:700,color:'#fff' }}>{isPT?'Classificação Geral':'League Standings'}</span>
            {headerLabels}
          </div>
          {allSorted.map((team:any, i:number) => {
            const rank = i+1
            const gp = team.wins+team.losses
            const pct = gp>0?(team.wins/gp).toFixed(3).replace(/^0/,''):'.000'
            const gb = calcGB(leagueLeader,team)
            return (
              <Link key={team.id} href={`/team/${team.id}`} style={{ textDecoration:'none' }}>
                <div style={{
                  display:'flex',alignItems:'center',gap:12,padding:'10px 16px',
                  background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5',
                  borderLeft:`3px solid ${i<12?'#15803d':i<20?'#b45309':'transparent'}`,
                }}>
                  <span style={{ fontSize:11,fontWeight:700,width:20,textAlign:'right',flexShrink:0,color:'#9c9088' }}>{rank}</span>
                  <TeamLogo t={team} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:700,color:'#1a1512',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{team.name}</div>
                    <div style={{ fontSize:11,color:'#8a8279' }}>{isPT?(team.conference==='Eastern'?'Este':'Oeste'):team.conference}</div>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:16,flexShrink:0 }}>
                    <span style={{ width:24,textAlign:'center',fontSize:14,fontWeight:700,color:'#15803d' }}>{team.wins}</span>
                    <span style={{ width:24,textAlign:'center',fontSize:14,fontWeight:700,color:'#dc2626' }}>{team.losses}</span>
                    <span style={{ width:48,textAlign:'center',fontSize:14,fontWeight:600,color:'#1a1512' }}>{pct}</span>
                    <span style={{ width:40,textAlign:'center',fontSize:14,color:'#5c554e' }}>{gb}</span>
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

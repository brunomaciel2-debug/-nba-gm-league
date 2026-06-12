'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'

type View = 'conference' | 'division' | 'league'

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

const CONF_DIVS: Record<string,string[]> = {
  'Eastern': ['Atlantic','Central','Southeast'],
  'Western': ['Northwest','Pacific','Southwest'],
}

export default function StandingsPage() {
  const [teams, setTeams] = useState<any[]>([])
  const [view, setView] = useState<View>('conference')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('teams').select('*').not('id','in','(ALL,RVS)').then(({ data, error }) => {
      if (data) {
        setTeams(data.sort((a:any,b:any) =>
          b.wins - a.wins || (b.pts_for - b.pts_against) - (a.pts_for - a.pts_against)
        ))
      }
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-12 text-center">
      <p style={{ color:'#6b5f4e' }}>Loading standings...</p>
    </div>
  )

  const byConf = (conf: string) => teams.filter(t => t.conference === conf)
  const byDiv  = (div: string)  => teams.filter(t => DIV_MAP[t.name] === div)

  const TeamLogo = ({ t }: { t: any }) => {
    const tc = readableTeamColor(t.color)
    return t.logo_url
      ? <img src={t.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
      : <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-black flex-shrink-0"
              style={{ background:tc+'33', color:tc }}>{t.id.slice(0,2)}</span>
  }

  const Row = ({ t, rank, showDiv }: { t: any, rank: number, showDiv?: boolean }) => {
    const gp = t.wins + t.losses
    const pct = gp > 0 ? (t.wins/gp).toFixed(3) : '.000'
    const diff = t.pts_for - t.pts_against
    const isPlayoff = rank <= 8
    return (
      <tr style={{ background: rank%2===0?'#eae4db':'#ede8df', borderBottom:'1px solid #16120d' }}>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs w-5 text-right font-bold"
                  style={{ color: isPlayoff?'#40e080':'#5c554e' }}>{rank}</span>
            <TeamLogo t={t} />
            <span className="font-semibold text-white text-sm">{t.name}</span>
            {isPlayoff && <span className="text-xs px-1 rounded" style={{ background:'#dcfce7',color:'#166534' }}>P</span>}
            {showDiv && <span className="text-xs ml-1" style={{ color:'#9c8e7a' }}>{DIV_MAP[t.name]}</span>}
          </div>
        </td>
        <td className="px-3 py-2.5 text-right font-bold text-sm" style={{ color:'#166534' }}>{t.wins}</td>
        <td className="px-3 py-2.5 text-right text-sm" style={{ color:'#6b5f4e' }}>{t.losses}</td>
        <td className="px-3 py-2.5 text-right text-sm" style={{ color:'#2d2723' }}>{pct}</td>
        <td className="px-3 py-2.5 text-right text-sm" style={{ color:'#6b5f4e' }}>{gp||'—'}</td>
        <td className="px-3 py-2.5 text-right text-sm" style={{ color:'#6b5f4e' }}>{t.pts_for||'—'}</td>
        <td className="px-3 py-2.5 text-right text-sm" style={{ color:'#6b5f4e' }}>{t.pts_against||'—'}</td>
        <td className="px-3 py-2.5 text-right text-sm font-semibold"
            style={{ color: diff>0?'#40e080':diff<0?'#e04040':'#5c554e' }}>
          {diff>0?'+':''}{diff||'—'}
        </td>
      </tr>
    )
  }

  const Head = () => (
    <thead>
      <tr style={{ background:'#ddd7ca', borderBottom:'1px solid #d4cec3' }}>
        {['Team','W','L','PCT','GP','PF','PA','+/-'].map((h,i) => (
          <th key={h} className={`px-${i===0?4:3} py-2.5 font-semibold text-xs ${i===0?'text-left':'text-right'}`}
              style={{ color:'#6b5f4e' }}>{h}</th>
        ))}
      </tr>
    </thead>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">🏆 Standings — 2025-26</h1>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
          {(['conference','division','league'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{ background:view===v?'#d4cdc5':'transparent', color:view===v?'#60a0ff':'#5c554e' }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* CONFERENCE */}
      {view === 'conference' && ['Eastern','Western'].map(conf => (
        <div key={conf} className="mb-8">
          <h2 className="text-base font-bold mb-3"
              style={{ color:conf==='Eastern'?'#e04040':'#3a8adf' }}>{conf} Conference</h2>
          <div className="rounded-xl overflow-hidden" style={{ border:'1px solid #d4cec3' }}>
            <table className="w-full"><Head />
              <tbody>{byConf(conf).map((t,i) => <Row key={t.id} t={t} rank={i+1} />)}</tbody>
            </table>
          </div>
        </div>
      ))}

      {/* DIVISION */}
      {view === 'division' && ['Eastern','Western'].map(conf => (
        <div key={conf} className="mb-8">
          <h2 className="text-base font-bold mb-4"
              style={{ color:conf==='Eastern'?'#e04040':'#3a8adf' }}>{conf} Conference</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {CONF_DIVS[conf].map(div => (
              <div key={div} className="rounded-xl overflow-hidden" style={{ border:'1px solid #d4cec3' }}>
                <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest"
                     style={{ background:'#ddd7ca',borderBottom:'1px solid #d4cec3',
                              color:conf==='Eastern'?'#e06060':'#6090d0' }}>{div}</div>
                <table className="w-full">
                  <thead>
                    <tr style={{ background:'#ddd7ca',borderBottom:'1px solid #d4cec3' }}>
                      {['Team','W','L','PCT'].map((h,i) => (
                        <th key={h} className={`px-3 py-2 font-semibold text-xs ${i===0?'text-left':'text-right'}`}
                            style={{ color:'#6b5f4e' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byDiv(div).map((t,i) => {
                      const gp=t.wins+t.losses
                      return (
                        <tr key={t.id} style={{ background:i%2===0?'#ece7dd':'#e8e2d6',borderBottom:'1px solid #16120d' }}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <TeamLogo t={t} />
                              <span className="text-xs font-semibold text-white">{t.id}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-bold" style={{ color:'#166534' }}>{t.wins}</td>
                          <td className="px-3 py-2 text-right text-xs" style={{ color:'#6b5f4e' }}>{t.losses}</td>
                          <td className="px-3 py-2 text-right text-xs" style={{ color:'#2d2723' }}>
                            {gp>0?(t.wins/gp).toFixed(3):'.000'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* LEAGUE */}
      {view === 'league' && (
        <div className="rounded-xl overflow-hidden" style={{ border:'1px solid #d4cec3' }}>
          <table className="w-full"><Head />
            <tbody>{teams.map((t,i) => <Row key={t.id} t={t} rank={i+1} showDiv />)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60

const ROUND_LABELS: Record<number,string> = {
  1: 'Play-In Tournament',
  2: 'First Round',
  3: 'Conference Semifinals',
  4: 'Conference Finals',
  5: 'NBA Finals',
}

function TeamSlot({ team, wins, isWinner, seed }: { team:any, wins:number, isWinner:boolean, seed?:number }) {
  const tc = team ? readableTeamColor(team.color) : '#9c9088'
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
         style={{background: isWinner?tc+'18':'#f5f1eb', border:`1px solid ${isWinner?tc+'44':'#d4cdc5'}`}}>
      {seed && <span className="text-xs font-bold w-4 flex-shrink-0" style={{color:'#9c9088'}}>{seed}</span>}
      {team?.logo_url
        ?<img src={team.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0"/>
        :<div className="w-7 h-7 rounded flex items-center justify-center text-xs font-black flex-shrink-0"
              style={{background:tc+'22',color:tc}}>{team?.id?.slice(0,3)||'TBD'}</div>}
      <span className="text-sm font-semibold flex-1 truncate"
            style={{color: team ? '#1a1512' : '#9c9088'}}>
        {team?.name || 'TBD'}
      </span>
      <span className="text-lg font-black flex-shrink-0"
            style={{color: isWinner?tc:'#9c9088'}}>{wins}</span>
    </div>
  )
}

function SeriesCard({ series }: { series:any }) {
  const high = series.team_high_data
  const low  = series.team_low_data
  const done = series.status === 'complete'
  const isOne = series.games_needed === 1

  return (
    <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5',minWidth:240}}>
      <div className="px-3 py-2 text-xs font-semibold"
           style={{background:'#f0ece5',borderBottom:'1px solid #d4cdc5',color:'#5c554e'}}>
        {isOne ? 'Single Game' : `Best of ${series.games_needed}`}
        {done && <span className="ml-2 text-xs font-bold" style={{color:'#15803d'}}>✓ Complete</span>}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <TeamSlot team={high} wins={series.wins_high} isWinner={done && series.winner===high?.id} seed={series.seed_high} />
        <div className="text-center text-xs font-bold" style={{color:'#9c9088'}}>vs</div>
        <TeamSlot team={low}  wins={series.wins_low}  isWinner={done && series.winner===low?.id}  seed={series.seed_low} />
      </div>
    </div>
  )
}

export default async function PlayoffsPage() {
  const { data: rawSeries } = await supabase
    .from('playoff_series')
    .select('*')
    .eq('season','2025-26')
    .order('round').order('series_type')

  const { data: teams } = await supabase.from('teams').select('id,name,color,logo_url')
  const teamMap = Object.fromEntries((teams||[]).map((t:any) => [t.id,t]))

  const series = (rawSeries||[]).map((s:any) => ({
    ...s,
    team_high_data: s.team_high ? teamMap[s.team_high] : null,
    team_low_data:  s.team_low  ? teamMap[s.team_low]  : null,
    winner_data:    s.winner    ? teamMap[s.winner]     : null,
  }))

  const noPlayoffs = series.length === 0

  const byRound = (round: number, conf?: string) =>
    series.filter((s:any) => s.round===round && (!conf || s.conference===conf))

  const playInEast = series.filter((s:any) => s.round===1 && s.conference==='Eastern')
  const playInWest = series.filter((s:any) => s.round===1 && s.conference==='Western')

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-6">
        <span className="sec-title">
          <i className="ti ti-trophy" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          2025-26 NBA Playoffs
        </span>
        <Link href="/standings" className="text-xs no-underline font-semibold" style={{color:'#c8102e'}}>
          Regular Season Standings →
        </Link>
      </div>

      {noPlayoffs ? (
        <div className="rounded-2xl p-12 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <i className="ti ti-trophy" style={{fontSize:48,color:'#d4cdc5'}}></i>
          <h2 className="text-xl font-bold mt-4 mb-2" style={{color:'#1a1512'}}>Playoffs Not Yet Started</h2>
          <p className="text-sm mb-2" style={{color:'#5c554e'}}>The regular season must complete before playoffs begin.</p>
          <p className="text-xs" style={{color:'#8a8279'}}>Commissioner can generate the playoff bracket from the Admin panel after Week 26.</p>
        </div>
      ) : (
        <>
          {/* PLAY-IN */}
          {(playInEast.length > 0 || playInWest.length > 0) && (
            <div className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>
                Play-In Tournament
              </h2>
              <div className="rounded-xl p-4 mb-4" style={{background:'#fef9c3',border:'1px solid #b45309'}}>
                <div className="text-xs font-semibold mb-1" style={{color:'#b45309'}}>How Play-In works:</div>
                <div className="text-xs" style={{color:'#5c554e'}}>
                  <strong>Game A (7v8):</strong> Winner → #7 seed in Playoffs · Loser goes to Game C &nbsp;|&nbsp;
                  <strong>Game B (9v10):</strong> Winner goes to Game C · Loser eliminated &nbsp;|&nbsp;
                  <strong>Game C:</strong> Winner → #8 seed in Playoffs · Loser eliminated
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {[['Eastern',playInEast],['Western',playInWest]].map(([conf,games])=>(
                  <div key={conf as string}>
                    <h3 className="text-xs font-semibold mb-3" style={{color:'#8a8279'}}>{conf as string} Conference</h3>
                    <div className="flex flex-col gap-3">
                      {(games as any[]).map((s:any) => (
                        <div key={s.id} className="flex items-center gap-3">
                          <span className="text-xs font-bold w-6 flex-shrink-0" style={{color:'#b45309'}}>
                            {s.series_type.includes('_a_')?'A':s.series_type.includes('_b_')?'B':'C'}
                          </span>
                          <div className="flex-1"><SeriesCard series={s} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BRACKET */}
          {[2,3,4].map(round => {
            const eastSeries = byRound(round,'Eastern')
            const westSeries = byRound(round,'Western')
            if (!eastSeries.length && !westSeries.length) return null
            return (
              <div key={round} className="mb-8">
                <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>
                  {ROUND_LABELS[round]}
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {[['Eastern',eastSeries],['Western',westSeries]].map(([conf,confSeries])=>(
                    <div key={conf as string}>
                      <h3 className="text-xs font-semibold mb-3" style={{color:'#8a8279'}}>{conf as string}</h3>
                      <div className={`grid gap-4 ${round===2?'grid-cols-2':'grid-cols-1'}`}>
                        {(confSeries as any[]).map((s:any) => <SeriesCard key={s.id} series={s} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* NBA FINALS */}
          {byRound(5).length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#c8102e',letterSpacing:'1.5px'}}>
                🏆 NBA Finals
              </h2>
              <div className="max-w-sm mx-auto">
                {byRound(5).map((s:any) => <SeriesCard key={s.id} series={s} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

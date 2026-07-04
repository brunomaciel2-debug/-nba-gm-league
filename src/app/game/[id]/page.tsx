import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor, readableTeamColorOnDark } from '@/lib/color'
import { notFound } from 'next/navigation'
export const dynamic = 'force-dynamic'

export default async function GamePage({ params }: { params: { id: string } }) {
  const { data: game } = await supabase
    .from('games')
    .select('*, home:teams!games_home_team_fkey(*), away:teams!games_away_team_fkey(*)')
    .eq('id', params.id)
    .single()

  if (!game) notFound()

  const { data: boxScores } = await supabase
    .from('box_scores')
    .select('*, player:players(id,name,pos,photo_url)')
    .eq('game_id', params.id)
    .order('pts', { ascending: false })

  const homeBox = (boxScores||[]).filter((b:any) => b.team_id === game.home_team)
  const awayBox = (boxScores||[]).filter((b:any) => b.team_id === game.away_team)

  const home = game.home as any
  const away = game.away as any
  const homeColor = readableTeamColor(home?.color)
  const awayColor = readableTeamColor(away?.color)
  const homeColorOnDark = readableTeamColorOnDark(home?.color)
  const awayColorOnDark = readableTeamColorOnDark(away?.color)
  const homeWon = game.home_score > game.away_score

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', {
    weekday:'long', month:'long', day:'numeric', year:'numeric'
  })

  const statCols = [
    { key:'pts', label:'PTS' },
    { key:'reb', label:'REB' },
    { key:'ast', label:'AST' },
    { key:'stl', label:'STL' },
    { key:'blk', label:'BLK' },
    { key:'fgm', label:'FGM' },
    { key:'fga', label:'FGA' },
    { key:'tpm', label:'3PM' },
    { key:'tpa', label:'3PA' },
    { key:'ftm', label:'FTM' },
    { key:'fta', label:'FTA' },
    { key:'turnovers', label:'TO' },
    { key:'mins', label:'MIN' },
  ]

  const teamTotals = (box: any[]) => statCols.reduce((acc, col) => {
    acc[col.key] = box.reduce((s, b) => s + (b[col.key] || 0), 0)
    return acc
  }, {} as Record<string,number>)

  const homeTotals = teamTotals(homeBox)
  const awayTotals = teamTotals(awayBox)

  const BoxTable = ({ players, color, totals }: { players: any[], color: string, totals: any }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{background:'#ddd7ca',borderBottom:'1px solid #d4cdc5'}}>
            <th className="px-3 py-2 text-left font-bold" style={{color:'#5c554e',minWidth:140}}>Player</th>
            {statCols.map(c => (
              <th key={c.key} className="px-2 py-2 text-right font-bold" style={{color:'#5c554e'}}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((b: any, i: number) => (
            <tr key={b.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e8e2d6'}}>
              <td className="px-3 py-2">
                <Link href={`/player/${b.player?.id}`} className="no-underline font-semibold hover:underline"
                  style={{color}}>
                  {b.player?.name}
                </Link>
                <span className="ml-1.5 text-xs" style={{color:'#9c8e7a'}}>{b.player?.pos}</span>
              </td>
              {statCols.map(c => (
                <td key={c.key} className="px-2 py-2 text-right font-semibold"
                  style={{color: c.key==='pts' && b[c.key]>=20 ? color : '#1a1512'}}>
                  {b[c.key] || 0}
                </td>
              ))}
            </tr>
          ))}
          {/* Totals row */}
          <tr style={{background:'#e8e2d6',borderTop:'2px solid #d4cdc5'}}>
            <td className="px-3 py-2 font-black text-xs" style={{color:'#1a1512'}}>TEAM</td>
            {statCols.map(c => (
              <td key={c.key} className="px-2 py-2 text-right font-black" style={{color:'#1a1512'}}>
                {totals[c.key] || 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link href="/schedule" className="text-xs no-underline mb-6 block" style={{color:'#8a8279'}}>
        ← Schedule
      </Link>

      {/* SCOREBOARD */}
      <div className="rounded-2xl p-6 mb-6" style={{background:'#1a1512',border:'1px solid #2a2218'}}>
        <div className="text-center text-xs mb-4" style={{color:'#8a8279'}}>
          {game.played_at ? fmtDate(game.played_at) : ''}
          {game.week_number > 0 && ` · Week ${game.week_number}`}
          {game.attendance > 0 && ` · ${game.attendance.toLocaleString()} fans`}
        </div>
        <div className="flex items-center justify-between gap-4">
          {/* Home */}
          <div className="flex-1 text-center">
            <Link href={`/team/${game.home_team}`} className="no-underline">
              {home?.logo_url && (
                <img src={home.logo_url} alt="" className="w-20 h-20 object-contain mx-auto mb-3"/>
              )}
              <div className="text-sm font-bold" style={{color:homeColorOnDark}}>{home?.name}</div>
              <div className="text-xs mb-2" style={{color:'#8a8279'}}>HOME</div>
            </Link>
            <div className="text-6xl font-black" style={{color:homeWon?homeColorOnDark:'#5c554e'}}>
              {game.home_score}
            </div>
            {homeWon && <div className="text-xs font-bold mt-1" style={{color:'#4ade80'}}>WIN</div>}
          </div>

          {/* VS */}
          <div className="text-center flex-shrink-0">
            <div className="text-2xl font-black" style={{color:'#3a3228'}}>VS</div>
            {game.status === 'final' && (
              <div className="text-xs px-2 py-0.5 rounded mt-1" style={{background:'#2a2218',color:'#8a8279'}}>
                FINAL
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 text-center">
            <Link href={`/team/${game.away_team}`} className="no-underline">
              {away?.logo_url && (
                <img src={away.logo_url} alt="" className="w-20 h-20 object-contain mx-auto mb-3"/>
              )}
              <div className="text-sm font-bold" style={{color:awayColorOnDark}}>{away?.name}</div>
              <div className="text-xs mb-2" style={{color:'#8a8279'}}>AWAY</div>
            </Link>
            <div className="text-6xl font-black" style={{color:!homeWon?awayColorOnDark:'#5c554e'}}>
              {game.away_score}
            </div>
            {!homeWon && <div className="text-xs font-bold mt-1" style={{color:'#4ade80'}}>WIN</div>}
          </div>
        </div>
      </div>

      {/* BOX SCORES */}
      {boxScores && boxScores.length > 0 ? (
        <div className="flex flex-col gap-6">
          {/* Home box score */}
          <div className="rounded-2xl overflow-hidden" style={{border:'1px solid #d4cdc5',borderTop:`3px solid ${homeColor}`}}>
            <div className="px-4 py-3 flex items-center gap-3" style={{background:'#e8e2d6'}}>
              {home?.logo_url && <img src={home.logo_url} alt="" className="w-6 h-6 object-contain"/>}
              <span className="font-bold text-sm" style={{color:homeColor}}>{home?.name}</span>
              <span className="ml-auto text-lg font-black" style={{color:'#1a1512'}}>{game.home_score}</span>
            </div>
            <BoxTable players={homeBox} color={homeColor} totals={homeTotals} />
          </div>

          {/* Away box score */}
          <div className="rounded-2xl overflow-hidden" style={{border:'1px solid #d4cdc5',borderTop:`3px solid ${awayColor}`}}>
            <div className="px-4 py-3 flex items-center gap-3" style={{background:'#e8e2d6'}}>
              {away?.logo_url && <img src={away.logo_url} alt="" className="w-6 h-6 object-contain"/>}
              <span className="font-bold text-sm" style={{color:awayColor}}>{away?.name}</span>
              <span className="ml-auto text-lg font-black" style={{color:'#1a1512'}}>{game.away_score}</span>
            </div>
            <BoxTable players={awayBox} color={awayColor} totals={awayTotals} />
          </div>
        </div>
      ) : (
        <div className="text-center py-12 rounded-2xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <div className="text-3xl mb-3">📊</div>
          <p className="text-sm" style={{color:'#8a8279'}}>Box score not available for this game.</p>
        </div>
      )}
    </div>
  )
}

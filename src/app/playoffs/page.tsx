import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60

async function getStandings() {
  const { data } = await supabase
    .from('teams').select('id,name,color,logo_url,wins,losses,conference,pts_for,pts_against')
    .not('id','in','(ALL,RVS)')
  return data || []
}

function sortConf(teams: any[]) {
  return [...teams].sort((a,b) => {
    const pctA = a.wins / Math.max(1, a.wins+a.losses)
    const pctB = b.wins / Math.max(1, b.wins+b.losses)
    return pctB - pctA || b.wins - a.wins || (b.pts_for-b.pts_against)-(a.pts_for-a.pts_against)
  })
}

function TeamSlot({ team, seed, isPlayin, className }: {
  team: any, seed: number, isPlayin?: boolean, className?: string
}) {
  const tc = team ? readableTeamColor(team.color) : '#9c9088'
  const gp = team ? team.wins + team.losses : 0
  const pct = gp > 0 ? (team.wins/gp).toFixed(3).replace(/^0/,'') : '.000'

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${className||''}`}
         style={{
           background: isPlayin ? '#fef9c3' : '#faf8f5',
           border: `1px solid ${isPlayin ? '#b45309' : '#d4cdc5'}`,
           minWidth: 0,
         }}>
      <span className="text-xs font-black w-4 flex-shrink-0 text-center"
            style={{color: seed<=6?'#15803d':'#b45309'}}>{seed}</span>
      {team ? (
        <>
          {team.logo_url
            ? <img src={team.logo_url} alt="" className="w-7 h-7 object-contain flex-shrink-0"/>
            : <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-black flex-shrink-0"
                   style={{background:tc+'22',color:tc}}>{team.id?.slice(0,3)}</div>}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate" style={{color:'#1a1512'}}>{team.name}</div>
            <div className="text-xs" style={{color:'#8a8279'}}>{team.wins}W {team.losses}L</div>
          </div>
        </>
      ) : (
        <div className="flex-1">
          <div className="text-xs font-bold" style={{color:'#9c9088'}}>N/A</div>
          <div className="text-xs" style={{color:'#b0a89e'}}>Play-In</div>
        </div>
      )}
    </div>
  )
}

function Matchup({ hi, lo, hiSeed, loSeed, label }: {
  hi: any, lo: any, hiSeed: number, loSeed: number, label?: string
}) {
  const isPlayin7 = loSeed >= 7
  return (
    <div className="flex flex-col gap-1">
      {label && <div className="text-xs font-bold mb-1" style={{color:'#8a8279'}}>{label}</div>}
      <TeamSlot team={hi} seed={hiSeed} isPlayin={hiSeed>6} />
      <div className="text-center text-xs font-bold" style={{color:'#d4cdc5'}}>vs</div>
      <TeamSlot team={lo} seed={loSeed} isPlayin={loSeed>6} />
    </div>
  )
}

export default async function PlayoffsPage() {
  const teams = await getStandings()
  const east = sortConf(teams.filter(t => t.conference === 'Eastern'))
  const west = sortConf(teams.filter(t => t.conference === 'Western'))

  // Seeds: 1-6 direct, 7-8 = N/A (from play-in)
  const getSeeds = (ranked: any[]) => ({
    s1: ranked[0], s2: ranked[1], s3: ranked[2],
    s4: ranked[3], s5: ranked[4], s6: ranked[5],
    s7: null, s8: null, // play-in
    s7_cur: ranked[6], s8_cur: ranked[7], // current 7/8 before play-in
    s9: ranked[8], s10: ranked[9],
  })

  const eSeeds = getSeeds(east)
  const wSeeds = getSeeds(west)

  const ConferenceBracket = ({ conf, seeds, color }: { conf: string, seeds: ReturnType<typeof getSeeds>, color: string }) => (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full" style={{background:color}}></div>
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{color:'#1a1512'}}>{conf} Conference</h2>
      </div>

      {/* Round 1 matchups */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Matchup hi={seeds.s1} lo={seeds.s8} hiSeed={1} loSeed={8} label="1st Round" />
        <Matchup hi={seeds.s4} lo={seeds.s5} hiSeed={4} loSeed={5} />
        <Matchup hi={seeds.s2} lo={seeds.s7} hiSeed={2} loSeed={7} />
        <Matchup hi={seeds.s3} lo={seeds.s6} hiSeed={3} loSeed={6} />
      </div>

      {/* Play-in preview */}
      <div className="rounded-xl p-4 mb-4" style={{background:'#fef9c3',border:'1px solid #b45309'}}>
        <div className="text-xs font-bold mb-2" style={{color:'#b45309'}}>
          <i className="ti ti-tournament" style={{marginRight:4}}></i>Play-In (seeds 7-10)
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs mb-1" style={{color:'#8a8279'}}>Game A · 7 vs 8</div>
            <TeamSlot team={seeds.s7_cur} seed={7} isPlayin />
            <div className="text-center text-xs my-0.5" style={{color:'#d4cdc5'}}>vs</div>
            <TeamSlot team={seeds.s8_cur} seed={8} isPlayin />
          </div>
          <div>
            <div className="text-xs mb-1" style={{color:'#8a8279'}}>Game B · 9 vs 10</div>
            <TeamSlot team={seeds.s9} seed={9} isPlayin />
            <div className="text-center text-xs my-0.5" style={{color:'#d4cdc5'}}>vs</div>
            <TeamSlot team={seeds.s10} seed={10} isPlayin />
          </div>
        </div>
        <div className="text-xs mt-2" style={{color:'#8a8279'}}>
          Winner A → #7 seed · Loser A vs Winner B → #8 seed · Loser B eliminated
        </div>
      </div>

      {/* Semis placeholder */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[1,2].map(i=>(
          <div key={i} className="rounded-lg p-3 text-center"
               style={{background:'#f0ece5',border:'1px dashed #d4cdc5'}}>
            <div className="text-xs font-semibold" style={{color:'#8a8279'}}>Conf. Semis</div>
            <div className="text-xs mt-1" style={{color:'#b0a89e'}}>TBD</div>
          </div>
        ))}
      </div>

      {/* Finals placeholder */}
      <div className="rounded-lg p-3 text-center"
           style={{background:'#f0ece5',border:'1px dashed #d4cdc5'}}>
        <div className="text-xs font-semibold" style={{color:'#8a8279'}}>Conference Finals</div>
        <div className="text-xs mt-1" style={{color:'#b0a89e'}}>TBD</div>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-2">
        <span className="sec-title">
          <i className="ti ti-tournament" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          2025-26 Playoff Picture
        </span>
        <Link href="/standings" className="text-xs no-underline font-semibold" style={{color:'#c8102e'}}>
          Full Standings →
        </Link>
      </div>
      <p className="text-xs mb-6" style={{color:'#8a8279'}}>
        Based on current standings. Seeds 7 and 8 show as N/A — they are determined by the Play-In Tournament at end of season. Updates after each simulation.
      </p>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <ConferenceBracket conf="Eastern" seeds={eSeeds} color="#1e3a8a" />
        <ConferenceBracket conf="Western" seeds={wSeeds} color="#7c2d12" />
      </div>

      {/* NBA Finals placeholder */}
      <div className="rounded-2xl p-6 text-center"
           style={{background:'#faf8f5',border:'2px solid #c8102e',borderStyle:'dashed'}}>
        <i className="ti ti-trophy" style={{fontSize:32,color:'#c8102e'}}></i>
        <div className="text-sm font-bold mt-2 mb-1" style={{color:'#1a1512'}}>NBA Finals</div>
        <div className="text-xs" style={{color:'#8a8279'}}>East Champion vs West Champion · Best of 7</div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="rounded-lg px-4 py-2" style={{background:'#f0ece5',border:'1px dashed #d4cdc5'}}>
            <div className="text-xs font-bold" style={{color:'#1e3a8a'}}>East Champion</div>
            <div className="text-xs" style={{color:'#8a8279'}}>TBD</div>
          </div>
          <span className="font-black text-lg" style={{color:'#d4cdc5'}}>vs</span>
          <div className="rounded-lg px-4 py-2" style={{background:'#f0ece5',border:'1px dashed #d4cdc5'}}>
            <div className="text-xs font-bold" style={{color:'#7c2d12'}}>West Champion</div>
            <div className="text-xs" style={{color:'#8a8279'}}>TBD</div>
          </div>
        </div>
      </div>

      <p className="text-xs text-center mt-4" style={{color:'#b0a89e'}}>
        This is a projected bracket based on current standings and updates automatically after each simulation run.
      </p>
    </div>
  )
}

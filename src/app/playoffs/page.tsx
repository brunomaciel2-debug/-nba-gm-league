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

function Seed({ team, seed }: { team: any, seed: number }) {
  const isPlayin = seed >= 7
  const tc = team ? readableTeamColor(team.color) : '#9c9088'
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded"
         style={{
           background: isPlayin ? '#fef9c3' : '#faf8f5',
           border: `1px solid ${isPlayin ? '#f0c040' : '#d4cdc5'}`,
           minWidth: 0, width: '100%',
         }}>
      <span className="text-xs font-black flex-shrink-0 w-5"
            style={{color: seed<=6?'#15803d':'#b45309',fontSize:13}}>{seed}</span>
      {team?.logo_url
        ? <img src={team.logo_url} alt="" style={{width:24,height:24,objectFit:'contain',flexShrink:0}}/>
        : <div style={{width:24,height:24,borderRadius:3,background:tc+'22',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:10,fontWeight:900,color:tc}}>{(team?.id||'?').slice(0,3)}</span>
          </div>
      }
      <span className="truncate" style={{fontSize:13,fontWeight:600,color: team?'#1a1512':'#9c9088',minWidth:0}}>
        {team ? team.name.replace('Los Angeles','LA').replace('Golden State','GS').replace('Oklahoma City','OKC').replace('New Orleans','NO').replace('San Antonio','SA') : 'TBD'}
      </span>
      <span className="flex-shrink-0" style={{fontSize:12,color:'#8a8279',marginLeft:'auto'}}>{team?`${team.wins}-${team.losses}`:''}</span>
    </div>
  )
}

function Matchup({ hiTeam, loTeam, hiSeed, loSeed }: { hiTeam:any, loTeam:any, hiSeed:number, loSeed:number }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:3}}>
      <Seed team={hiTeam} seed={hiSeed} />
      <Seed team={loTeam} seed={loSeed} />
    </div>
  )
}

export default async function PlayoffsPage() {
  const teams = await getStandings()
  const east = sortConf(teams.filter((t:any) => t.conference === 'Eastern'))
  const west = sortConf(teams.filter((t:any) => t.conference === 'Western'))

  // East: 1-6 direct, 7&8 = TBD from play-in
  const eTop = east.slice(0,10)
  const wTop = west.slice(0,10)

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-2">
        <span className="sec-title">
          <i className="ti ti-tournament" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          2025-26 Playoff Picture
        </span>
        <Link href="/standings" className="text-xs no-underline font-semibold" style={{color:'#c8102e'}}>
          Standings →
        </Link>
      </div>
      <p className="text-xs mb-6" style={{color:'#8a8279'}}>
        Based on current standings. Seeds 7 & 8 are determined by the Play-In Tournament. Updates after each simulation.
      </p>

      {/* BRACKET — East left, West right, Finals center */}
      <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:'0 16px',alignItems:'center'}}>

        {/* ── EAST (left side, reads inward) ── */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3 text-center"
               style={{color:'#1e3a8a',letterSpacing:'1.5px'}}>Eastern Conference</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',alignItems:'center'}}>

            {/* Round 1 — leftmost */}
            <div style={{display:'flex',flexDirection:'column',gap:32}}>
              <Matchup hiTeam={eTop[0]} loTeam={null}    hiSeed={1} loSeed={8} />
              <Matchup hiTeam={eTop[3]} loTeam={eTop[4]} hiSeed={4} loSeed={5} />
              <Matchup hiTeam={eTop[1]} loTeam={null}    hiSeed={2} loSeed={7} />
              <Matchup hiTeam={eTop[2]} loTeam={eTop[5]} hiSeed={3} loSeed={6} />
            </div>

            {/* Conf Semis */}
            <div style={{display:'flex',flexDirection:'column',gap:96,justifyContent:'space-around'}}>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <div style={{height:48,background:'#f0ece5',border:'1px dashed #d4cdc5',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:12,color:'#8a8279',fontWeight:600}}>SEMI A</span>
                </div>
                <div style={{height:48,background:'#f0ece5',border:'1px dashed #d4cdc5',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:12,color:'#8a8279',fontWeight:600}}>TBD</span>
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <div style={{height:48,background:'#f0ece5',border:'1px dashed #d4cdc5',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:12,color:'#8a8279',fontWeight:600}}>SEMI B</span>
                </div>
                <div style={{height:48,background:'#f0ece5',border:'1px dashed #d4cdc5',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:12,color:'#8a8279',fontWeight:600}}>TBD</span>
                </div>
              </div>
            </div>

            {/* Conf Finals */}
            <div style={{display:'flex',flexDirection:'column',gap:2,alignSelf:'center'}}>
              <div style={{height:52,background:'#e8f0fe',border:'1px dashed #1e3a8a44',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontSize:12,color:'#1e3a8a',fontWeight:700}}>EAST FINAL</span>
              </div>
              <div style={{height:52,background:'#e8f0fe',border:'1px dashed #1e3a8a44',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontSize:12,color:'#1e3a8a',fontWeight:700}}>TBD</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── NBA FINALS (center) ── */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,minWidth:100}}>
          <i className="ti ti-trophy" style={{fontSize:32,color:'#c8102e',marginBottom:4}}></i>
          <div style={{fontSize:12,fontWeight:700,color:'#c8102e',letterSpacing:'1px',textTransform:'uppercase',textAlign:'center',marginBottom:8}}>NBA Finals</div>
          <div style={{width:120,height:52,background:'#fff0f0',border:'1.5px dashed #c8102e',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:12,color:'#c8102e',fontWeight:700}}>EAST</span>
          </div>
          <div style={{fontSize:12,color:'#d4cdc5',fontWeight:700,margin:'2px 0'}}>vs</div>
          <div style={{width:120,height:52,background:'#fff0f0',border:'1.5px dashed #c8102e',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:12,color:'#c8102e',fontWeight:700}}>WEST</span>
          </div>
          <div style={{fontSize:11,color:'#8a8279',marginTop:6,textAlign:'center'}}>Best of 7</div>
        </div>

        {/* ── WEST (right side, reads inward) ── */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3 text-center"
               style={{color:'#7c2d12',letterSpacing:'1.5px'}}>Western Conference</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',alignItems:'center'}}>

            {/* Conf Finals */}
            <div style={{display:'flex',flexDirection:'column',gap:2,alignSelf:'center'}}>
              <div style={{height:52,background:'#fef3e8',border:'1px dashed #7c2d1244',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontSize:12,color:'#7c2d12',fontWeight:700}}>WEST FINAL</span>
              </div>
              <div style={{height:52,background:'#fef3e8',border:'1px dashed #7c2d1244',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontSize:12,color:'#7c2d12',fontWeight:700}}>TBD</span>
              </div>
            </div>

            {/* Conf Semis */}
            <div style={{display:'flex',flexDirection:'column',gap:96,justifyContent:'space-around'}}>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <div style={{height:48,background:'#f0ece5',border:'1px dashed #d4cdc5',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:12,color:'#8a8279',fontWeight:600}}>SEMI A</span>
                </div>
                <div style={{height:48,background:'#f0ece5',border:'1px dashed #d4cdc5',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:12,color:'#8a8279',fontWeight:600}}>TBD</span>
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <div style={{height:48,background:'#f0ece5',border:'1px dashed #d4cdc5',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:12,color:'#8a8279',fontWeight:600}}>SEMI B</span>
                </div>
                <div style={{height:48,background:'#f0ece5',border:'1px dashed #d4cdc5',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:12,color:'#8a8279',fontWeight:600}}>TBD</span>
                </div>
              </div>
            </div>

            {/* Round 1 — rightmost */}
            <div style={{display:'flex',flexDirection:'column',gap:32}}>
              <Matchup hiTeam={wTop[0]} loTeam={null}    hiSeed={1} loSeed={8} />
              <Matchup hiTeam={wTop[3]} loTeam={wTop[4]} hiSeed={4} loSeed={5} />
              <Matchup hiTeam={wTop[1]} loTeam={null}    hiSeed={2} loSeed={7} />
              <Matchup hiTeam={wTop[2]} loTeam={wTop[5]} hiSeed={3} loSeed={6} />
            </div>
          </div>
        </div>
      </div>

      {/* Play-In legend */}
      <div className="mt-8 rounded-xl p-4" style={{background:'#fef9c3',border:'1px solid #b45309'}}>
        <div className="text-xs font-bold mb-2" style={{color:'#b45309'}}>
          <i className="ti ti-tournament" style={{marginRight:4}}></i>
          Play-In Tournament — seeds 7-10
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[['Eastern',eTop],['Western',wTop]].map(([conf,ranked]:any) => (
            <div key={conf}>
              <div className="text-xs font-semibold mb-2" style={{color:'#8a8279'}}>{conf}</div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs" style={{color:'#5c554e'}}>
                  <span className="font-bold" style={{color:'#b45309'}}>Game A:</span>
                  <Seed team={ranked[6]} seed={7} />
                  <span>vs</span>
                  <Seed team={ranked[7]} seed={8} />
                  <span style={{color:'#8a8279'}}>→ winner = #7 seed</span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{color:'#5c554e'}}>
                  <span className="font-bold" style={{color:'#b45309'}}>Game B:</span>
                  <Seed team={ranked[8]} seed={9} />
                  <span>vs</span>
                  <Seed team={ranked[9]} seed={10} />
                  <span style={{color:'#8a8279'}}>→ loser eliminated</span>
                </div>
                <div className="text-xs" style={{color:'#8a8279'}}>
                  Game C: loser(A) vs winner(B) → winner = #8 seed
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

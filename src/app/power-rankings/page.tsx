import { createClient } from '@supabase/supabase-js'

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getPowerRankings() {
  // Get latest week
  const { data: latest } = await supabaseServer
    .from('power_rankings')
    .select('week_number')
    .eq('season', '2025-26')
    .order('week_number', { ascending: false })
    .limit(1)
    .single()

  if (!latest) return { rankings: [], week: 0 }

  const { data: rankings } = await supabaseServer
    .from('power_rankings')
    .select('*, team:teams(id,name,logo_url,conference,division)')
    .eq('season', '2025-26')
    .eq('week_number', latest.week_number)
    .order('rank')

  return { rankings: rankings || [], week: latest.week_number }
}

export default async function PowerRankingsPage() {
  const { rankings, week } = await getPowerRankings()

  const east = rankings.filter((r: any) => r.team?.conference === 'Eastern')
  const west = rankings.filter((r: any) => r.team?.conference === 'Western')

  function TrendBadge({ trend, prevRank, rank }: { trend: string, prevRank: number | null, rank: number }) {
    if (trend === 'new' || !prevRank) return (
      <span style={{fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:4,background:'#dbeafe',color:'#1d4ed8'}}>NEW</span>
    )
    const diff = prevRank - rank
    if (trend === 'same') return <span style={{fontSize:12,color:'#8a8279'}}>—</span>
    return (
      <span style={{display:'inline-flex',alignItems:'center',gap:2,fontSize:10,fontWeight:700,
                    color:trend==='up'?'#15803d':'#dc2626'}}>
        {trend === 'up' ? '▲' : '▼'} {Math.abs(diff)}
      </span>
    )
  }

  function RankCard({ r, idx }: { r: any, idx: number }) {
    const isTop3 = r.rank <= 3
    const borderColor = r.rank === 1 ? '#b45309' : r.rank === 2 ? '#6b7280' : r.rank === 3 ? '#b45309' : '#e2dcd5'
    const bgColor = r.rank === 1 ? '#fffbeb' : r.rank === 2 ? '#f8fafc' : '#faf8f5'

    return (
      <div style={{
        display:'flex', gap:14, padding:'14px 16px',
        background: bgColor,
        borderBottom:'1px solid #e2dcd5',
        borderLeft: isTop3 ? `4px solid ${borderColor}` : '4px solid transparent',
      }}>
        {/* Rank number */}
        <div style={{width:36,flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4,paddingTop:2}}>
          <div style={{
            fontSize: isTop3 ? 22 : 16,
            fontWeight:800,
            color: r.rank === 1 ? '#b45309' : r.rank === 2 ? '#6b7280' : r.rank === 3 ? '#b45309' : '#1a1512',
          }}>{r.rank}</div>
          <TrendBadge trend={r.trend} prevRank={r.previous_rank} rank={r.rank}/>
        </div>

        {/* Logo */}
        <div style={{width:44,height:44,flexShrink:0,borderRadius:8,overflow:'hidden',
                     background:'#f0ece5',border:'1px solid #d4cdc5',
                     display:'flex',alignItems:'center',justifyContent:'center'}}>
          {r.team?.logo_url
            ? <img src={r.team.logo_url} alt={r.team.name} style={{width:36,height:36,objectFit:'contain'}}/>
            : <span style={{fontSize:10,fontWeight:700,color:'#8a8279'}}>{r.team_id}</span>}
        </div>

        {/* Content */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
            <span style={{fontSize:14,fontWeight:700,color:'#1a1512'}}>{r.team?.name}</span>
            <span style={{fontSize:11,fontWeight:600,color:'#5c554e',background:'#e8e2d6',padding:'1px 6px',borderRadius:4}}>
              {r.wins}-{r.losses}
            </span>
            <span style={{fontSize:10,color:'#8a8279'}}>L5: {r.last5}</span>
            {r.ppg && <span style={{fontSize:10,color:'#8a8279'}}>{r.ppg} PPG</span>}
          </div>
          <p style={{fontSize:12,color:'#3d3731',lineHeight:1.6,margin:0,fontStyle:'italic'}}>
            "{r.comment}"
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 16px'}}>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:4}}>
          <h1 style={{fontSize:26,fontWeight:900,color:'#1a1512',margin:0}}>⚡ Power Rankings</h1>
          {week > 0 && (
            <span style={{fontSize:12,color:'#8a8279',fontWeight:500}}>Week {week} · 2025-26 Season</span>
          )}
        </div>
        <p style={{fontSize:13,color:'#8a8279',margin:0}}>
          Updated every simulation cycle. Rankings weigh record, recent form and scoring differential.
        </p>
      </div>

      {rankings.length === 0 ? (
        <div style={{padding:48,textAlign:'center',background:'#faf8f5',border:'1px dashed #d4cdc5',borderRadius:12}}>
          <div style={{fontSize:32,marginBottom:12}}>📋</div>
          <div style={{fontSize:14,fontWeight:700,color:'#1a1512',marginBottom:6}}>No rankings yet</div>
          <div style={{fontSize:12,color:'#8a8279'}}>Power Rankings will be published after the first simulation cycle.</div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          {/* Eastern Conference */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,
                         padding:'8px 16px',background:'#1d4ed8',borderRadius:'10px 10px 0 0'}}>
              <span style={{fontSize:14,fontWeight:800,color:'#fff'}}>Eastern Conference</span>
            </div>
            <div style={{borderRadius:'0 0 10px 10px',overflow:'hidden',border:'1px solid #e2dcd5',borderTop:'none'}}>
              {east.map((r: any, idx: number) => <RankCard key={r.team_id} r={r} idx={idx}/>)}
            </div>
          </div>

          {/* Western Conference */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,
                         padding:'8px 16px',background:'#c8102e',borderRadius:'10px 10px 0 0'}}>
              <span style={{fontSize:14,fontWeight:800,color:'#fff'}}>Western Conference</span>
            </div>
            <div style={{borderRadius:'0 0 10px 10px',overflow:'hidden',border:'1px solid #e2dcd5',borderTop:'none'}}>
              {west.map((r: any, idx: number) => <RankCard key={r.team_id} r={r} idx={idx}/>)}
            </div>
          </div>
        </div>
      )}

      <p style={{marginTop:16,fontSize:11,color:'#b0a898',textAlign:'center'}}>
        Rankings generated automatically · Comments by NBA GM League Editorial
      </p>
    </div>
  )
}

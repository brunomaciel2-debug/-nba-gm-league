import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
export const revalidate = 60

export default async function GLeaguePage() {
  const { data: teams } = await supabase
    .from('gleague_teams')
    .select('*, nba:teams!gleague_teams_nba_affiliate_fkey(id,name,logo_url,color)')
    .order('conference').order('wins', { ascending: false })

  const east = (teams||[]).filter((t:any) => t.conference === 'Eastern')
    .sort((a:any,b:any) => b.wins-a.wins || a.losses-b.losses)
  const west = (teams||[]).filter((t:any) => t.conference === 'Western')
    .sort((a:any,b:any) => b.wins-a.wins || a.losses-b.losses)

  const calcGB = (leader:any, team:any) => {
    if (!leader || (leader.wins===team.wins && leader.losses===team.losses)) return '—'
    const gb = ((leader.wins-team.wins)+(team.losses-leader.losses))/2
    return gb===0?'—':gb.toFixed(1)
  }

  const Table = ({ conf, ranked }: { conf: string, ranked: any[] }) => {
    const leader = ranked[0]
    const confColor = conf==='Eastern'?'#1e3a5f':'#7c2d12'
    return (
      <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
        <div className="px-4 py-3 flex items-center justify-between"
             style={{background:confColor,borderBottom:'1px solid #d4cdc5'}}>
          <span className="text-sm font-bold" style={{color:'#fff'}}>{conf} Conference</span>
          <div className="flex items-center gap-4 text-xs font-bold" style={{color:'rgba(255,255,255,0.6)'}}>
            <span className="w-6 text-center">W</span>
            <span className="w-6 text-center">L</span>
            <span className="w-12 text-center">PCT</span>
            <span className="w-10 text-center">GB</span>
          </div>
        </div>
        {ranked.map((t:any, i:number) => {
          const gp = t.wins + t.losses
          const pct = gp>0 ? (t.wins/gp).toFixed(3).replace(/^0/,'') : '.000'
          const tc = readableTeamColor(t.color||'#1d4ed8')
          return (
            <Link key={t.id} href={`/gleague/${t.id}`} className="no-underline group">
              <div className="flex items-center gap-3 px-4 py-2.5 transition-all group-hover:brightness-95"
                   style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5',
                           borderLeft:`3px solid ${i<8?'#15803d':'transparent'}`}}>
                <span className="text-xs font-bold w-5 text-right flex-shrink-0"
                      style={{color:i<8?'#15803d':'#9c9088'}}>{i+1}</span>
                <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
                     style={{background:tc+'18'}}>
                  {t.nba?.logo_url
                    ?<img src={t.nba.logo_url} alt="" className="w-full h-full object-contain p-0.5"/>
                    :<span className="text-xs font-black" style={{color:tc}}>{t.id}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{color:'#1a1512'}}>{t.name}</div>
                  <div className="text-xs" style={{color:'#8a8279'}}>
                    {t.nba?.name ? `Affiliate: ${t.nba.name}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="w-6 text-center text-sm font-bold" style={{color:'#15803d'}}>{t.wins}</span>
                  <span className="w-6 text-center text-sm font-bold" style={{color:'#dc2626'}}>{t.losses}</span>
                  <span className="w-12 text-center text-sm font-semibold" style={{color:'#1a1512'}}>{pct}</span>
                  <span className="w-10 text-center text-sm" style={{color:'#5c554e'}}>{calcGB(leader,t)}</span>
                </div>
              </div>
            </Link>
          )
        })}
        <div className="px-4 py-2 text-xs" style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5',color:'#8a8279'}}>
          Top 8 qualify for playoffs
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-6">
        <span className="sec-title">
          <i className="ti ti-ball-basketball" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          NBA G League — 2025-26
        </span>
        <Link href="/gleague/teams" className="text-xs no-underline font-semibold" style={{color:'#c8102e'}}>
          All Teams →
        </Link>
      </div>

      <div className="rounded-xl p-4 mb-6" style={{background:'#fef9c3',border:'1px solid #b45309'}}>
        <div className="text-xs font-bold mb-1" style={{color:'#b45309'}}>
          <i className="ti ti-info-circle" style={{marginRight:4}}></i>NBA G League
        </div>
        <p className="text-xs" style={{color:'#5c554e'}}>
          Each NBA franchise has an affiliated G-League team. GMs can assign players from their NBA roster to develop in the G-League. Assigned players are forced into the starting rotation. The G-League simulates alongside the NBA season.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Table conf="Eastern" ranked={east} />
        <Table conf="Western" ranked={west} />
      </div>
    </div>
  )
}

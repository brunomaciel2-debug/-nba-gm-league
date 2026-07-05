import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { REFEREE_TRAIT_META } from '@/lib/referee-traits'

function TraitBar({ value, color }: { value: number, color: string }) {
  return (
    <div style={{ width: 100, height: 8, borderRadius: 4, background: '#e8e2d6', overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 4 }} />
    </div>
  )
}

export default async function RefereeProfilePage({ params }: { params: { id: string } }) {
  const { data: referee } = await supabase.from('referees').select('*').eq('id', params.id).single()
  if (!referee) notFound()

  // No declared foreign key from games.referee_id to referees — fetch
  // games separately rather than risk an embedded-join 400.
  const { data: games } = await supabase.from('games')
    .select('id,home_team,away_team,home_score,away_score,status,played_at,week_number')
    .eq('referee_id', params.id)
    .order('played_at', { ascending: false })

  const teamIds = Array.from(new Set((games || []).flatMap((g: any) => [g.home_team, g.away_team])))
  const { data: teams } = teamIds.length ? await supabase.from('teams').select('id,name,logo_url').in('id', teamIds) : { data: [] }
  const teamMap: Record<string, any> = {}
  ;(teams || []).forEach((t: any) => { teamMap[t.id] = t })

  const played = (games || []).filter((g: any) => g.status === 'final')
  const upcoming = (games || []).filter((g: any) => g.status !== 'final')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/referees" className="text-xs no-underline mb-6 block" style={{ color: '#8a8279' }}>← Referees</Link>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#e8e2d6' }}>
          {referee.photo_url
            ? <img src={referee.photo_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-xl font-black" style={{ color: '#8a8279' }}>
                {referee.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </div>}
        </div>
        <div>
          <h1 className="text-xl font-black" style={{ color: '#1a1512' }}>👨‍⚖️ {referee.name}</h1>
          <p className="text-xs" style={{ color: '#8a8279' }}>{played.length} games officiated this season</p>
        </div>
      </div>

      <div className="rounded-xl p-4 mb-6 flex flex-col gap-3" style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }}>
        {REFEREE_TRAIT_META.map(tm => (
          <div key={tm.key} className="flex items-center gap-3">
            <span className="text-xs w-40 flex-shrink-0" style={{ color: '#5c554e' }}>{tm.labelEN}</span>
            <TraitBar value={referee[tm.key]} color={tm.color} />
            <span className="text-xs font-bold" style={{ color: '#1a1512' }}>{referee[tm.key]}</span>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#8a8279' }}>Games Officiated</h2>
      <div className="flex flex-col gap-1.5">
        {played.map((g: any) => {
          const home = teamMap[g.home_team], away = teamMap[g.away_team]
          return (
            <Link key={g.id} href={`/game/${g.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg no-underline" style={{ background: '#faf8f5', border: '1px solid #e2dcd5' }}>
              <span className="text-xs w-16 flex-shrink-0" style={{ color: '#8a8279' }}>Wk {g.week_number}</span>
              <span className="text-sm flex-1" style={{ color: '#1a1512' }}>{home?.name || g.home_team} vs {away?.name || g.away_team}</span>
              <span className="text-sm font-bold" style={{ color: '#1a1512' }}>{g.home_score}-{g.away_score}</span>
            </Link>
          )
        })}
        {upcoming.slice(0, 5).map((g: any) => {
          const home = teamMap[g.home_team], away = teamMap[g.away_team]
          return (
            <div key={g.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: '#f5f1eb', border: '1px solid #e2dcd5' }}>
              <span className="text-xs w-16 flex-shrink-0" style={{ color: '#8a8279' }}>Wk {g.week_number}</span>
              <span className="text-sm flex-1" style={{ color: '#1a1512' }}>{home?.name || g.home_team} vs {away?.name || g.away_team}</span>
              <span className="text-xs" style={{ color: '#8a8279' }}>Scheduled</span>
            </div>
          )
        })}
      </div>

      {!games?.length && (
        <div className="rounded-xl p-6 text-center" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
          <p className="text-sm" style={{ color: '#6b5f4e' }}>No games assigned yet.</p>
        </div>
      )}
    </div>
  )
}

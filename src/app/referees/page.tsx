import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { REFEREE_TRAIT_META } from '@/lib/referee-traits'

function TraitBar({ value, color }: { value: number, color: string }) {
  return (
    <div style={{ width: 60, height: 6, borderRadius: 3, background: '#e8e2d6', overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  )
}

export default async function RefereesPage() {
  const { data: referees } = await supabase.from('referees').select('*').order('name')

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-black mb-2" style={{ color: '#1a1512' }}>👨‍⚖️ Referees / Árbitros</h1>
      <p className="text-xs mb-6" style={{ color: '#8a8279' }}>
        A pool of 40 real NBA officials. Each real game gets one assigned as crew chief ahead of time — his traits genuinely shift how often fouls and technicals get called, not just a name on the scoreboard.
        <br />Uma pool de 40 árbitros reais da NBA. Cada jogo real tem um deles como árbitro principal, atribuído com antecedência — os traços dele mexem mesmo na frequência de faltas e técnicas assinaladas, não é só um nome decorativo.
      </p>

      <div className="flex gap-4 mb-4 flex-wrap text-xs" style={{ color: '#5c554e' }}>
        {REFEREE_TRAIT_META.map(tm => (
          <div key={tm.key} className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: tm.color }} />
            {tm.labelEN} / {tm.labelPT}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {(referees || []).map((r: any) => (
          <Link key={r.id} href={`/referees/${r.id}`} className="rounded-lg px-4 py-3 no-underline flex items-center gap-3" style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }}>
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#e8e2d6' }}>
              {r.photo_url
                ? <img src={r.photo_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xs font-black" style={{ color: '#8a8279' }}>
                    {r.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold mb-2" style={{ color: '#1a1512' }}>{r.name}</div>
              <div className="flex gap-6 flex-wrap">
                {REFEREE_TRAIT_META.map(tm => (
                  <div key={tm.key} className="flex items-center gap-2">
                    <TraitBar value={r[tm.key]} color={tm.color} />
                    <span className="text-xs" style={{ color: '#8a8279' }}>{r[tm.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {(!referees || !referees.length) && (
        <div className="rounded-xl p-6 text-center" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
          <p className="text-sm" style={{ color: '#6b5f4e' }}>No referees loaded yet.</p>
        </div>
      )}
    </div>
  )
}

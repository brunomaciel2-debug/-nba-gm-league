'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { REFEREE_TRAIT_META } from '@/lib/referee-traits'
import { useTranslation } from '@/components/I18nProvider'

export default function OfficialsRankingPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: referees }, { data: games }] = await Promise.all([
        supabase.from('referees').select('*'),
        supabase.from('games').select('referee_id,referee_rating').not('referee_rating', 'is', null),
      ])
      const sums: Record<string, { sum: number, n: number }> = {}
      ;(games || []).forEach((g: any) => {
        const r = (sums[g.referee_id] ||= { sum: 0, n: 0 })
        r.sum += g.referee_rating; r.n++
      })
      const withAvg = (referees || []).map((r: any) => ({
        ...r,
        gamesRated: sums[r.id]?.n || 0,
        avgRating: sums[r.id] ? sums[r.id].sum / sums[r.id].n : null,
      }))
      withAvg.sort((a: any, b: any) => (b.avgRating ?? -1) - (a.avgRating ?? -1))
      setRows(withAvg)
      setLoading(false)
    })()
  }, [])

  const traitLabel = (tm: typeof REFEREE_TRAIT_META[number]) => isPT ? tm.labelPT : tm.labelEN

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-12 text-center" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a1512' }}>⚖️ {isPT ? 'Ranking de Arbitragem' : 'Officials Ranking'} — 2025-26</h1>
      <p className="text-xs mb-6" style={{ color: '#8a8279' }}>
        {isPT
          ? 'Cada árbitro é avaliado jogo a jogo com base no que realmente aconteceu em campo (simetria de faltas, técnicas, controlo do jogo). Os melhor classificados apitam os jogos mais decisivos.'
          : 'Every referee is graded game by game based on what actually happened on the floor (foul symmetry, technicals, game control). Top-ranked officials get the most decisive games.'}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: '#e8e2d6', border: '1px solid #d4cec3' }}>
          <p style={{ color: '#6b5f4e' }}>{isPT ? 'Ainda sem jogos avaliados esta época.' : 'No games rated yet this season.'}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: '#e8e2d6', border: '1px solid #d4cec3' }}>
          {rows.map((r: any, i: number) => {
            const isTop3 = i < 3 && r.gamesRated > 0
            const rc = i === 0 ? '#b45309' : i === 1 ? '#6b7280' : i === 2 ? '#92400e' : '#9c8e7a'
            return (
              <Link key={r.id} href={`/referees/${r.id}`} className="no-underline">
                <div className="flex items-center gap-3 px-4 py-3 hover:brightness-110 transition-all" style={{ background: i % 2 === 0 ? '#ece7dd' : '#e8e2d6', borderBottom: '1px solid #d4cdc5' }}>
                  <span className="text-sm font-black w-6 text-right flex-shrink-0" style={{ color: isTop3 ? rc : '#9c8e7a' }}>{i + 1}</span>
                  <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#cec7bc' }}>
                    {r.photo_url
                      ? <img src={r.photo_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xs font-black" style={{ color: '#5c554e' }}>{r.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: '#1a1512' }}>{r.name}</div>
                    <div className="text-xs flex gap-2 flex-wrap" style={{ color: '#8a8279' }}>
                      {REFEREE_TRAIT_META.map(tm => <span key={tm.key}>{traitLabel(tm)}: {r[tm.key]}</span>)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-black" style={{ color: r.avgRating == null ? '#9c8e7a' : isTop3 ? rc : '#1a1512' }}>
                      {r.avgRating == null ? '—' : r.avgRating.toFixed(1)}
                    </div>
                    <div className="text-xs" style={{ color: '#8a8279' }}>
                      {r.gamesRated} {isPT ? 'jogo(s)' : 'game(s)'}
                    </div>
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

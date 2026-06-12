'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const SEASONS = ['2025-26','2026-27','2027-28','2028-29','2029-30']
const SALARY_CAP = 141000000
const LUX_TAX   = 172000000

function fmt(n: number) {
  if (!n) return '—'
  return '$' + (n / 1000000).toFixed(1) + 'M'
}

function barColor(pct: number) {
  if (pct > 120) return '#e04040'
  if (pct > 100) return '#ffa040'
  if (pct > 85)  return '#ffd040'
  return '#40e080'
}

export default function ContractsTable({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('players')
      .select('id, name, pos, contracts(season, salary)')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (!data) return
        // Build a map: player -> season -> salary
        const built = data.map((p: any) => {
          const salaries: Record<string, number> = {}
          ;(p.contracts || []).forEach((c: any) => {
            salaries[c.season] = c.salary
          })
          return { id: p.id, name: p.name, pos: p.pos, salaries }
        })
        // Sort by current season salary desc
        built.sort((a, b) => (b.salaries['2025-26'] || 0) - (a.salaries['2025-26'] || 0))
        setRows(built)
        setLoading(false)
      })
  }, [teamId])

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: '#5c554e' }}>Loading contracts...</div>

  // Totals per season
  const totals = SEASONS.reduce((acc, s) => {
    acc[s] = rows.reduce((sum, p) => sum + (p.salaries[s] || 0), 0)
    return acc
  }, {} as Record<string, number>)

  const currentTotal = totals['2025-26'] || 0
  const capPct = (currentTotal / SALARY_CAP) * 100
  const luxPct = (currentTotal / LUX_TAX) * 100

  return (
    <div>
      {/* Cap overview */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Committed', value: fmt(currentTotal), sub: '2025-26 season', color: barColor(capPct) },
          { label: 'Cap Space', value: currentTotal < SALARY_CAP ? fmt(SALARY_CAP - currentTotal) : '—', sub: currentTotal > SALARY_CAP ? 'Over the cap' : 'Available', color: currentTotal > SALARY_CAP ? '#e04040' : '#40e080' },
          { label: 'Luxury Tax', value: currentTotal > LUX_TAX ? '+' + fmt(currentTotal - LUX_TAX) : fmt(LUX_TAX - currentTotal) + ' away', sub: currentTotal > LUX_TAX ? 'Paying luxury tax' : 'Below tax line', color: currentTotal > LUX_TAX ? '#e04040' : '#5c554e' },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4" style={{ background: '#e8e2d6', border: '1px solid #3a3228' }}>
            <div className="text-xs mb-1" style={{ color: '#5c554e' }}>{card.label}</div>
            <div className="text-xl font-black" style={{ color: card.color }}>{card.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#8a8279' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Cap bar */}
      <div className="rounded-xl p-4 mb-6" style={{ background: '#e8e2d6', border: '1px solid #3a3228' }}>
        <div className="flex justify-between text-xs mb-2" style={{ color: '#5c554e' }}>
          <span>2025-26 Payroll</span>
          <span style={{ color: barColor(capPct) }}>{fmt(currentTotal)} / {fmt(SALARY_CAP)} cap</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: '#d4cdc5' }}>
          <div className="h-full rounded-full transition-all"
               style={{ width: Math.min(capPct, 130) + '%', background: barColor(capPct), maxWidth: '100%' }} />
        </div>
        <div className="flex justify-between text-xs mt-1" style={{ color: '#a89f97' }}>
          <span>$0</span>
          <span>Cap ${(SALARY_CAP / 1000000).toFixed(0)}M</span>
          <span style={{ color: '#ffa040' }}>Tax ${(LUX_TAX / 1000000).toFixed(0)}M</span>
        </div>
      </div>

      {/* Contracts table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a2218' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#ddd7ca' }}>
                <th className="px-4 py-3 text-left sticky left-0" style={{ color: '#5c554e', background: '#ddd7ca', borderBottom: '1px solid #2a2218', minWidth: 160 }}>Player</th>
                <th className="px-3 py-3 text-center w-12" style={{ color: '#5c554e', background: '#ddd7ca', borderBottom: '1px solid #2a2218' }}>Pos</th>
                {SEASONS.map((s, i) => (
                  <th key={s} className="px-4 py-3 text-right whitespace-nowrap"
                      style={{ color: i === 0 ? '#F5A623' : '#5c554e', background: '#ddd7ca', borderBottom: '1px solid #2a2218', minWidth: 100 }}>
                    {s}{i === 0 ? ' ★' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? '#e8e2d9' : '#ebe5dc', borderBottom: '1px solid #242018' }}>
                  <td className="px-4 py-2.5 sticky left-0" style={{ background: i % 2 === 0 ? '#e8e2d9' : '#ebe5dc' }}>
                    <span className="font-semibold" style={{ color: '#1a1612' }}>{p.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center" style={{ color: '#5c554e' }}>{p.pos}</td>
                  {SEASONS.map(s => {
                    const sal = p.salaries[s]
                    const isExpiring = !p.salaries[SEASONS[SEASONS.indexOf(s) + 1]]
                    return (
                      <td key={s} className="px-4 py-2.5 text-right font-semibold"
                          style={{ color: sal ? (isExpiring && SEASONS.indexOf(s) < 4 ? '#ffd040' : '#2d2722') : '#d4cdc5' }}>
                        {sal ? fmt(sal) : '—'}
                        {sal && isExpiring && SEASONS.indexOf(s) < 4 && (
                          <span className="ml-1 text-xs" style={{ color: '#ffa040', fontSize: 9 }}>EXP</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Totals row */}
              <tr style={{ background: '#0f1623', borderTop: '2px solid #2a3a5a' }}>
                <td className="px-4 py-3 font-black sticky left-0" style={{ color: '#F5A623', background: '#0f1623' }}>
                  TOTAL PAYROLL
                </td>
                <td className="px-3 py-3" style={{ background: '#0f1623' }}></td>
                {SEASONS.map(s => (
                  <td key={s} className="px-4 py-3 text-right font-black"
                      style={{ color: totals[s] > SALARY_CAP ? '#e04040' : totals[s] > SALARY_CAP * 0.9 ? '#ffa040' : '#F5A623' }}>
                    {fmt(totals[s])}
                  </td>
                ))}
              </tr>

              {/* Cap line */}
              <tr style={{ background: '#ede8de', borderTop: '1px solid #2a2218' }}>
                <td className="px-4 py-2 sticky left-0" style={{ color: '#a89f97', background: '#ede8de', fontSize: 11 }}>Salary Cap</td>
                <td style={{ background: '#ede8de' }}></td>
                {SEASONS.map(s => (
                  <td key={s} className="px-4 py-2 text-right" style={{ color: '#a89f97', fontSize: 11 }}>${(SALARY_CAP / 1000000).toFixed(0)}M</td>
                ))}
              </tr>

              {/* Space/over row */}
              <tr style={{ background: '#ede8de' }}>
                <td className="px-4 py-2 sticky left-0" style={{ color: '#a89f97', background: '#ede8de', fontSize: 11 }}>Space / Over</td>
                <td style={{ background: '#ede8de' }}></td>
                {SEASONS.map(s => {
                  const diff = SALARY_CAP - (totals[s] || 0)
                  return (
                    <td key={s} className="px-4 py-2 text-right font-semibold" style={{ fontSize: 11, color: diff >= 0 ? '#40e080' : '#e04040' }}>
                      {diff >= 0 ? '+' : ''}{fmt(Math.abs(diff))}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs mt-3" style={{ color: '#a89f97' }}>
        ★ Current season · EXP = expiring contract · Yellow = over 90% cap · Red = over cap
      </p>
    </div>
  )
}

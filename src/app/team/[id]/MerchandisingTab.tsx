'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import { formatSimMonthName } from '@/lib/season-week-helper'

const fmt = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(1) + 'M'
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(0) + 'K'
  return sign + '$' + abs.toFixed(0)
}

const TIERS = [
  { key: 'small',  cost: 250000,  boost: 25, color: '#1d4ed8' },
  { key: 'medium', cost: 750000,  boost: 50, color: '#b45309' },
  { key: 'large',  cost: 2000000, boost: 90, color: '#6d28d9' },
]

export default function MerchandisingTab({ teamId, teamColor, players }: { teamId: string, teamColor: string, players: any[] }) {
  const { profile } = useAuth()
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [reports, setReports] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [pastPlayers, setPastPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [starting, setStarting] = useState(false)
  const [msg, setMsg] = useState('')
  const [period, setPeriod] = useState<'yearly' | 'monthly'>('monthly')

  const load = async () => {
    const [{ data: rep }, { data: camp }] = await Promise.all([
      supabase.from('jersey_sales_reports').select('*').eq('team_id', teamId).eq('season', '2025-26').order('month_num', { ascending: false }),
      supabase.from('marketing_campaigns').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    ])
    setReports(rep || [])
    setCampaigns(camp || [])

    // A jersey-sales report is a historical record — it can reference a
    // player who has since been traded away or cut and is no longer in the
    // current roster prop below. That used to just fall back to showing the
    // raw player_id number instead of a name. Fetch names directly for
    // whichever ids show up here, independent of current team roster.
    const currentIds = new Set(players.map((p: any) => p.id))
    const historicalIds = Array.from(new Set([...(rep || []).map((r: any) => r.player_id), ...(camp || []).map((c: any) => c.player_id)]))
      .filter((id: any) => id != null && !currentIds.has(id))
    if (historicalIds.length) {
      const { data: past } = await supabase.from('players').select('id,name').in('id', historicalIds)
      setPastPlayers(past || [])
    } else {
      setPastPlayers([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [teamId])

  const playerMap = Object.fromEntries([...players, ...pastPlayers].map((p: any) => [p.id, p]))
  const activeCampaignPlayerIds = new Set(campaigns.filter((c: any) => c.status === 'active').map((c: any) => c.player_id))

  const latestMonth = reports.length ? Math.max(...reports.map((r: any) => r.month_num)) : null
  const latestReports = latestMonth != null ? reports.filter((r: any) => r.month_num === latestMonth) : []

  // Yearly top sellers = each player's revenue/units SUMMED across every
  // month reported so far this season, not just his latest single-month row.
  const seasonByPlayer: Record<string, { player_id: any, revenue: number, units_sold: number }> = {}
  reports.forEach((r: any) => {
    const s = (seasonByPlayer[r.player_id] ||= { player_id: r.player_id, revenue: 0, units_sold: 0 })
    s.revenue += r.revenue; s.units_sold += r.units_sold
  })
  const topSellers = (period === 'yearly' ? Object.values(seasonByPlayer) : latestReports)
    .slice().sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 8)

  const monthTotals: Record<number, number> = {}
  const monthUnits: Record<number, number> = {}
  reports.forEach((r: any) => {
    monthTotals[r.month_num] = (monthTotals[r.month_num] || 0) + r.revenue
    monthUnits[r.month_num] = (monthUnits[r.month_num] || 0) + r.units_sold
  })
  const months = Object.keys(monthTotals).map(Number).sort((a, b) => b - a)
  const seasonTotalRevenue = Object.values(monthTotals).reduce((a, b) => a + b, 0)
  const seasonTotalUnits = Object.values(monthUnits).reduce((a, b) => a + b, 0)

  const startCampaign = async (tierKey: string) => {
    if (!selectedPlayer) { setMsg(isPT ? 'Escolhe um jogador primeiro' : 'Pick a player first'); return }
    setStarting(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT ? 'Não estás autenticado' : 'Not logged in'); setStarting(false); return }
    const res = await fetch('/api/marketing/start-campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ playerId: selectedPlayer, tier: tierKey }),
    })
    const json = await res.json()
    if (res.ok) { setMsg(isPT ? '✅ Campanha iniciada!' : '✅ Campaign started!'); setSelectedPlayer(''); await load() }
    else setMsg(json.error || (isPT ? 'Erro' : 'Error'))
    setStarting(false)
  }

  if (loading) return <div className="text-center py-8" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: '#faf8f5', border: '1px solid #d4cdc5', color: '#5c554e', lineHeight: 1.6 }}>
        👕 {isPT
          ? 'A venda de jerseys (online, alcance nacional — não depende dos bilhetes ou concessões da arena) é real e entra diretamente no balanço da equipa todos os meses. Quão popular um jogador é — qualidade, consistência, mercado da equipa, prémios — nunca se vê diretamente; só o resultado real, as vendas, aqui em baixo.'
          : "Jersey sales (online, national reach — separate from arena tickets/concessions) are real and post straight to the team's balance sheet every month. How popular a player is — quality, consistency, team market, awards — is never shown directly; only the real result, sales, shown below."}
      </div>

      <div className="flex gap-2 mb-3">
        {[{ k: 'monthly', l: isPT ? '🗓️ Mensal' : '🗓️ Monthly' }, { k: 'yearly', l: isPT ? '📅 Anual' : '📅 Yearly' }].map((v: any) => (
          <button key={v.k} onClick={() => setPeriod(v.k)}
            className="px-3 py-1 rounded-lg text-xs font-semibold"
            style={{ border: `1px solid ${period === v.k ? teamColor : '#d4cdc5'}`, background: period === v.k ? teamColor + '18' : '#faf8f5', color: period === v.k ? '#1a1512' : '#5c554e' }}>
            {v.l}
          </button>
        ))}
      </div>

      <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8a8279' }}>
        {period === 'yearly'
          ? (isPT ? 'Mais Vendidos — Época Completa' : 'Top Sellers — Full Season')
          : (isPT ? `Mais Vendidos${latestMonth != null ? ` — ${formatSimMonthName(latestMonth,'pt-PT')}` : ''}` : `Top Sellers${latestMonth != null ? ` — ${formatSimMonthName(latestMonth,'en-US')}` : ''}`)}
      </h2>
      {topSellers.length === 0 ? (
        <div className="rounded-xl p-6 text-center mb-6" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
          <p className="text-sm" style={{ color: '#6b5f4e' }}>{isPT ? 'O primeiro relatório mensal aparece no final do 1º mês da época.' : 'The first monthly report appears at the end of the season\'s 1st month.'}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
          {topSellers.map((r: any, i: number) => {
            const p = playerMap[r.player_id]
            return (
              <div key={r.player_id} className="flex items-center gap-3 px-4 py-2.5" style={{ background: i % 2 === 0 ? '#ece7dd' : '#e8e2d6', borderBottom: '1px solid #d4cdc5' }}>
                <span className="text-xs font-black w-5 text-right flex-shrink-0" style={{ color: i === 0 ? '#b45309' : '#9c8e7a' }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: '#1a1512' }}>{p?.name || r.player_id}</div>
                  {r.campaign_note && <div className="text-xs mt-0.5" style={{ color: r.campaign_note.includes('backfired') || r.campaign_note.includes('falhou') ? '#dc2626' : '#15803d' }}>📣 {r.campaign_note}</div>}
                  {r.acquisition_note && <div className="text-xs mt-0.5" style={{ color: '#1d4ed8' }}>🆕 {r.acquisition_note}</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-black" style={{ color: '#15803d' }}>{r.units_sold.toLocaleString()} {isPT ? 'jerseys' : 'jerseys'}</div>
                  <div className="text-xs" style={{ color: '#8a8279' }}>{fmt(r.revenue)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isGM && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8a8279' }}>
            {isPT ? 'Campanha de Anúncios' : 'Ad Campaign'}
          </h2>
          <div className="rounded-xl p-4 mb-6" style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }}>
            <p className="text-xs mb-3" style={{ color: '#5c554e', lineHeight: 1.6 }}>
              {isPT
                ? 'Investe em anúncios com a imagem de um jogador para venderes mais jerseys dele este mês — uma boa forma de testar se um jogador surpreendente é mesmo marketable. ⚠️ O timing importa: se ele cair de forma, se lesionar, ou não jogar durante a campanha, o dinheiro é desperdiçado (não há vendas extra).'
                : "Invest in ads featuring a player's image to sell more of his jerseys this month — a good way to test whether a surprising breakout player is genuinely marketable. ⚠️ Timing matters: if he slumps, gets hurt, or barely plays during the campaign, the money is wasted (no extra sales)."}
            </p>
            <select value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm mb-3" style={{ background: '#ede8de', border: '1px solid #d4cdc5', color: '#1a1512' }}>
              <option value="">{isPT ? '— Escolher jogador —' : '— Pick a player —'}</option>
              {players.filter((p: any) => !activeCampaignPlayerIds.has(p.id)).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              {TIERS.map(tier => (
                <button key={tier.key} onClick={() => startCampaign(tier.key)} disabled={!selectedPlayer || starting}
                  className="rounded-lg p-2.5 text-center transition-all disabled:opacity-40"
                  style={{ background: tier.color + '18', border: `2px solid ${tier.color}` }}>
                  <div className="text-xs font-bold uppercase" style={{ color: tier.color }}>{tier.key}</div>
                  <div className="text-sm font-black" style={{ color: '#1a1512' }}>{fmt(tier.cost)}</div>
                  <div className="text-xs" style={{ color: '#8a8279' }}>+{tier.boost}% {isPT ? 'vendas' : 'sales'}</div>
                </button>
              ))}
            </div>
            {msg && <div className="mt-3 text-xs font-semibold" style={{ color: msg.startsWith('✅') ? '#15803d' : '#dc2626' }}>{msg}</div>}
          </div>
        </>
      )}

      {campaigns.length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8a8279' }}>
            {isPT ? 'Campanhas' : 'Campaigns'}
          </h2>
          <div className="flex flex-col gap-1.5 mb-6">
            {campaigns.map((c: any) => {
              const p = playerMap[c.player_id]
              const statusColor = c.status === 'active' ? '#1d4ed8' : c.status === 'completed' ? '#15803d' : '#dc2626'
              const statusLabel = c.status === 'active' ? (isPT ? 'Em curso' : 'Active') : c.status === 'completed' ? (isPT ? 'Sucesso' : 'Success') : (isPT ? 'Falhou' : 'Backfired')
              return (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: '#faf8f5', border: '1px solid #e2dcd5' }}>
                  <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ background: statusColor + '18', color: statusColor }}>{statusLabel}</span>
                  <span className="text-sm flex-1 min-w-0 truncate" style={{ color: '#1a1512' }}>{p?.name || c.player_id}</span>
                  <span className="text-xs flex-shrink-0" style={{ color: '#8a8279' }}>{fmt(c.budget)}</span>
                  {c.result_note && <span className="text-xs flex-shrink-0 hidden sm:inline" style={{ color: '#8a8279' }}>{c.result_note}</span>}
                </div>
              )
            })}
          </div>
        </>
      )}

      {months.length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8a8279' }}>
            {period === 'yearly'
              ? (isPT ? 'Total da Época' : 'Season Total')
              : (isPT ? 'Histórico Mensal' : 'Monthly History')}
          </h2>
          {period === 'yearly' ? (
            <div className="rounded-xl overflow-hidden" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold" style={{ color: '#1a1512' }}>{isPT ? `Época 2025-26 (${months.length} ${months.length !== 1 ? 'meses' : 'mês'})` : `2025-26 Season (${months.length} month${months.length !== 1 ? 's' : ''})`}</span>
                <div className="text-right">
                  <div className="text-base font-black" style={{ color: '#15803d' }}>{fmt(seasonTotalRevenue)}</div>
                  <div className="text-xs" style={{ color: '#8a8279' }}>{seasonTotalUnits.toLocaleString()} {isPT ? 'jerseys' : 'jerseys'}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
              {months.map((m, i) => (
                <div key={m} className="flex items-center justify-between px-4 py-2.5" style={{ background: i % 2 === 0 ? '#ece7dd' : '#e8e2d6', borderBottom: '1px solid #d4cdc5' }}>
                  <span className="text-sm" style={{ color: '#1a1512' }}>{formatSimMonthName(m, isPT?'pt-PT':'en-US')}</span>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: '#15803d' }}>{fmt(monthTotals[m])}</div>
                    <div className="text-xs" style={{ color: '#8a8279' }}>{(monthUnits[m]||0).toLocaleString()} {isPT ? 'jerseys' : 'jerseys'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

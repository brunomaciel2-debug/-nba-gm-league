'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'
import { supabase } from '@/lib/supabase'

// How long to wait for /api/admin/simulate's own HTTP response before
// falling back to polling the database directly. A real incident: a week
// with a lot of processing outlasted the hosting platform's own gateway
// timeout, which silently drops the response even though the backend keeps
// running to completion (season_config genuinely advanced) — the browser
// was left showing "Simulating..." forever with no way to tell the step had
// actually finished.
const FETCH_TIMEOUT_MS = 90_000
const POLL_INTERVAL_MS = 5_000
const POLL_MAX_MS = 10 * 60_000

export default function AdminSimulatePage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [log, setLog]         = useState<string[]>([])
  const [weekCount, setWeekCount] = useState(1)

  const getSeasonState = async () => {
    const { data } = await supabase.from('season_config').select('current_week,next_sim_half').eq('id',1).single()
    return { week: data?.current_week as number, half: (data?.next_sim_half as number) || 1 }
  }

  // One /api/admin/simulate call = one "half" of a week. If the direct
  // response is late, this confirms against season_config instead of
  // waiting forever — the (week, half) pair only changes once that specific
  // step has actually finished server-side, regardless of whether its HTTP
  // response made it back to the browser.
  const callSimulateStep = async (before: {week:number, half:number}): Promise<any> => {
    const direct = fetch('/api/admin/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'nba-admin-2025' }),
    }).then(async res => {
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || (isPT ? 'Erro desconhecido' : 'Unknown error'))
      return data
    })

    const timeout = new Promise<'TIMEOUT'>(resolve => setTimeout(() => resolve('TIMEOUT'), FETCH_TIMEOUT_MS))
    const first = await Promise.race([direct, timeout])
    if (first !== 'TIMEOUT') return first

    setLog(prev => [...prev, isPT
      ? '⏳ A resposta está a demorar mais que o normal — a confirmar diretamente na base de dados...'
      : '⏳ Response is taking longer than usual — confirming directly against the database...'])

    const deadline = Date.now() + POLL_MAX_MS
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      const now = await getSeasonState()
      if (now.week !== before.week || now.half !== before.half) {
        return {
          week: before.week,
          games_simulated: null,
          friendlies_simulated: null,
          half: now.week === before.week ? before.half : undefined,
          _confirmedByPoll: true,
        }
      }
    }
    throw new Error(isPT
      ? 'A simulação não respondeu a tempo, mesmo depois de confirmar diretamente na base de dados.'
      : 'The simulation did not respond in time, even after checking the database directly.')
  }

  // Runs ONE full week (a week can come back split in two "halves" — days
  // 1-3 then days 4-7 — when there are too many games to fit the route's
  // own maxDuration in a single call, so this keeps calling /api/admin/simulate
  // until that same week reports back without half===1 pending).
  const simulateOneWeek = async (): Promise<any> => {
    setLog(prev => [...prev, isPT ? '⏳ A simular...' : '⏳ Simulating...'])
    let data: any = null
    for (let part = 0; part < 2; part++) {
      const before = await getSeasonState()
      data = await callSimulateStep(before)

      if (data.half === 1) {
        const noGames = !data.games_simulated && !data.friendlies_simulated
        setLog(prev => [...prev, isPT
          ? `✓ Semana ${data.week} (dias 1-3)${data._confirmedByPoll ? ' — confirmada na base de dados' : noGames ? ' — sem jogos nesta fase' : ` — ${data.games_simulated} jogos, ${data.friendlies_simulated||0} amigável(is)`}. A continuar para os dias 4-7...`
          : `✓ Week ${data.week} (days 1-3)${data._confirmedByPoll ? ' — confirmed against the database' : noGames ? ' — no games this phase' : ` — ${data.games_simulated} games, ${data.friendlies_simulated||0} friendly(ies)`}. Continuing to days 4-7...`])
        continue
      }
      return data
    }
    return data
  }

  const simulate = async () => {
    const n = Math.max(1, weekCount)
    if (!confirm(n === 1
      ? (isPT ? 'Simular a próxima semana agora?' : 'Simulate next week now?')
      : (isPT ? `Simular as próximas ${n} semanas agora? Isto pode demorar vários minutos.` : `Simulate the next ${n} weeks now? This may take several minutes.`))) return

    setLoading(true)
    setResult(null)

    try {
      for (let i = 1; i <= n; i++) {
        if (n > 1) setLog(prev => [...prev, isPT ? `— Semana ${i} de ${n} —` : `— Week ${i} of ${n} —`])
        setLog(prev => [...prev, isPT ? '⚙️ A gerar ordens automáticas para equipas sem GM...' : '⚙️ Generating auto orders for teams without GM...'])

        const ordRes = await fetch('/api/admin/auto-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: 'nba-admin-2025' }),
        })
        const ordData = await ordRes.json()
        if (ordData.generated !== undefined) {
          setLog(prev => [...prev, isPT
            ? `✓ Ordens automáticas geradas para ${ordData.generated} equipas${ordData.carriedForward ? `, ${ordData.carriedForward} equipa(s) com GM mantiveram a última ordem real` : ''}`
            : `✓ Auto orders generated for ${ordData.generated} teams${ordData.carriedForward ? `, ${ordData.carriedForward} GM team(s) kept their last real order` : ''}`])
        }

        const data = await simulateOneWeek()
        const msg = data._confirmedByPoll
          ? (isPT ? `✅ Semana ${data.week} simulada (confirmado na base de dados).` : `✅ Week ${data.week} simulated (confirmed against the database).`)
          : (isPT ? `✅ Semana ${data.week} simulada! ${data.games_simulated} jogos.` : `✅ Week ${data.week} simulated! ${data.games_simulated} games.`)
        setLog(prev => [...prev, msg])
        if (data.friendlies_simulated > 0) {
          setLog(prev => [...prev, isPT
            ? `⚡ ${data.friendlies_simulated} jogo(s) amigável(is) resolvido(s)`
            : `⚡ ${data.friendlies_simulated} friendly game(s) resolved`])
        }
        setResult(data)
      }
    } catch (e: any) {
      const msg = `❌ ${e.message}`
      setLog(prev => [...prev, msg])
      setResult({ error: e.message })
    }
    setLoading(false)
  }

  const resetLog = () => setLog([])

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/admin" className="text-xs no-underline mb-6 block" style={{color:'#8a8279'}}>← Admin</Link>

      <h1 className="text-xl font-bold mb-2" style={{color:'#1a1512'}}>
        ⚡ {isPT ? 'Simulação Manual' : 'Manual Simulation'}
      </h1>
      <p className="text-sm mb-6" style={{color:'#5c554e'}}>
        {isPT
          ? 'Simula a próxima semana da época agora, sem esperar pelo cron automático. Usa durante testes para avançar rapidamente.'
          : 'Simulate the next week immediately, without waiting for the automatic cron. Use during testing to advance quickly.'}
      </p>

      {/* Status */}
      <div className="rounded-xl p-4 mb-6" style={{background:'#faf8f5', border:'1px solid #d4cdc5'}}>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e'}}>
          {isPT ? 'O que é simulado:' : 'What gets simulated:'}
        </div>
        <div className="flex flex-col gap-1.5 text-sm" style={{color:'#3d3731'}}>
          {(isPT ? [
            '🏀 4 jogos por equipa (round-robin)',
            '🤝 Amigáveis pendentes resolvidos (não contam para stats)',
            '📊 Estatísticas de jogadores actualizadas (excepto na Pré-Época)',
            '🏥 Saúde e lesões processadas',
            '📈 Desenvolvimento de atributos',
            '🏆 Prémios semanais / mensais (excepto na Pré-Época)',
            '💰 Objectivos de patrocínio verificados',
            '🔬 Pontos de scouting gerados',
            '📣 Notificações enviadas aos GMs',
          ] : [
            '🏀 4 games per team (round-robin)',
            '🤝 Pending friendlies resolved (don\'t count toward stats)',
            '📊 Player stats updated (except during Pre-Season)',
            '🏥 Health and injuries processed',
            '📈 Attribute development',
            '🏆 Weekly / monthly awards (except during Pre-Season)',
            '💰 Sponsor objectives checked',
            '🔬 Scouting points generated',
            '📣 Notifications sent to GMs',
          ]).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold" style={{color:'#5c554e'}}>
          {isPT ? 'Nº de semanas a simular:' : 'Weeks to simulate:'}
        </span>
        <input
          type="number"
          min={1}
          max={20}
          value={weekCount}
          disabled={loading}
          onChange={e => setWeekCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
          className="w-16 px-2 py-1 rounded-lg text-sm text-center font-bold disabled:opacity-40"
          style={{background:'#faf8f5', border:'1px solid #d4cdc5', color:'#1a1512'}}
        />
      </div>

      <button
        onClick={simulate}
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 mb-4"
        style={{background:'#c8102e', color:'#fff'}}>
        {loading
          ? (isPT ? '⏳ A simular...' : '⏳ Simulating...')
          : weekCount === 1
            ? `⚡ ${isPT ? 'Simular Próxima Semana' : 'Simulate Next Week'}`
            : `⚡ ${isPT ? `Simular Próximas ${weekCount} Semanas` : `Simulate Next ${weekCount} Weeks`}`}
      </button>

      {/* Log */}
      {log.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          <div className="flex items-center justify-between px-4 py-2" style={{background:'#f0ece5', borderBottom:'1px solid #d4cdc5'}}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{color:'#5c554e'}}>
              {isPT ? 'Log' : 'Log'}
            </span>
            <button onClick={resetLog} className="text-xs" style={{color:'#8a8279'}}>
              {isPT ? 'Limpar' : 'Clear'}
            </button>
          </div>
          <div className="p-4 flex flex-col gap-1.5" style={{background:'#faf8f5', fontFamily:'monospace'}}>
            {log.map((line, i) => (
              <div key={i} className="text-xs" style={{
                color: line.startsWith('✅') ? '#15803d' : line.startsWith('❌') ? '#dc2626' : '#5c554e'
              }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result && !result.error && (
        <div className="mt-4 rounded-xl p-4" style={{background:'#dcfce7', border:'1px solid #15803d'}}>
          <div className="flex items-center gap-3 mb-3">
            <span style={{fontSize:28}}>✅</span>
            <div>
              <p className="text-sm font-bold" style={{color:'#15803d'}}>
                {isPT ? `Semana ${result.week} simulada com sucesso!` : `Week ${result.week} simulated successfully!`}
              </p>
              <p className="text-xs mt-0.5" style={{color:'#166534'}}>
                {result.games_simulated} {isPT ? 'jogos simulados' : 'games simulated'}
                {result.week && ` · ${isPT ? 'Época Regular' : 'Regular Season'}`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {href:'/schedule', labelEN:'Schedule', labelPT:'Calendário'},
              {href:'/standings', labelEN:'Standings', labelPT:'Classificação'},
              {href:'/power-rankings', labelEN:'Power Rankings', labelPT:'Power Rankings'},
              {href:'/league-leaders', labelEN:'League Leaders', labelPT:'Líderes da Liga'},
            ].map(({href, labelEN, labelPT}) => (
              <Link key={href} href={href}
                className="text-xs no-underline font-semibold text-center py-2 rounded-lg"
                style={{background:'#bbf7d0', color:'#15803d'}}>
                {isPT ? labelPT : labelEN} →
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

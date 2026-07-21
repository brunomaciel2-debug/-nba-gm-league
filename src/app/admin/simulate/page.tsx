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
  // A "block" is one /api/admin/simulate call = one half of a week (3 days,
  // then 4 days) — the Commissioner wants every simulate action, in every
  // season phase, to advance by exactly that much and stop there, never
  // silently chaining into the next block even when a stretch has no games
  // (a real incident: pre-season weeks with nothing scheduled still need to
  // be steppable one block at a time, not skipped through in a single click).
  const [blockCount, setBlockCount] = useState(1)

  const getSeasonState = async () => {
    const { data } = await supabase.from('season_config').select('current_week,next_sim_half').eq('id',1).single()
    return { week: data?.current_week as number, half: (data?.next_sim_half as number) || 1 }
  }

  // One /api/admin/simulate call = one "half" of a week (one block). If the
  // direct response is late, this confirms against season_config instead of
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
        return { week: before.week, games_simulated: null, friendlies_simulated: null, _confirmedByPoll: true }
      }
    }
    throw new Error(isPT
      ? 'A simulação não respondeu a tempo, mesmo depois de confirmar diretamente na base de dados.'
      : 'The simulation did not respond in time, even after checking the database directly.')
  }

  // Orders are submitted once per week and read for both its blocks — only
  // regenerate auto-orders when a block is about to START a new week
  // (half 1), not when continuing the same week's 2nd block.
  const maybeGenerateAutoOrders = async (half: number) => {
    if (half !== 1) return
    setLog(prev => [...prev, isPT ? '⚙️ A gerar ordens automáticas para equipas sem GM...' : '⚙️ Generating auto orders for teams without GM...'])
    const ordRes = await fetch('/api/admin/auto-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'nba-admin-2025' }),
    })
    const ordData = await ordRes.json()
    if (ordData.generated !== undefined) {
      setLog(prev => [...prev, isPT
        ? `✓ Ordens automáticas geradas para ${ordData.generated} equipas${ordData.carriedForward ? `, ${ordData.carriedForward} equipa(s) com GM mantiveram a última ordem real` : ''}`
        : `✓ Auto orders generated for ${ordData.generated} teams${ordData.carriedForward ? `, ${ordData.carriedForward} GM team(s) kept their last real order` : ''}`])
    }
  }

  const halfLabel = (half: number) => half === 1 ? (isPT ? 'dias 1-3' : 'days 1-3') : (isPT ? 'dias 4-7' : 'days 4-7')

  // "Complete Block" — one call, no game limit: always fully resolves
  // whatever's left in the CURRENT half, whether that's a fresh half or one
  // a previous interrupted call only got partway through.
  const simulate = async (n: number) => {
    if (!confirm(n === 1
      ? (isPT ? 'Completar o bloco atual (3-4 dias) agora?' : 'Complete the current block (3-4 days) now?')
      : (isPT ? `Simular os próximos ${n} blocos (3-4 dias cada) agora? Isto pode demorar vários minutos.` : `Simulate the next ${n} blocks (3-4 days each) now? This may take several minutes.`))) return

    setLoading(true)
    setResult(null)

    try {
      for (let i = 1; i <= n; i++) {
        const before = await getSeasonState()
        if (n > 1) setLog(prev => [...prev, isPT ? `— Bloco ${i} de ${n} —` : `— Block ${i} of ${n} —`])

        await maybeGenerateAutoOrders(before.half)

        setLog(prev => [...prev, isPT ? '⏳ A simular...' : '⏳ Simulating...'])
        const data = await callSimulateStep(before)
        const noGames = !data.games_simulated && !data.friendlies_simulated
        const msg = data._confirmedByPoll
          ? (isPT ? `✅ Semana ${data.week} (${halfLabel(before.half)}) — confirmado na base de dados.` : `✅ Week ${data.week} (${halfLabel(before.half)}) — confirmed against the database.`)
          : (isPT
              ? `✅ Semana ${data.week} (${halfLabel(before.half)})${noGames ? ' — sem jogos nesta fase' : ` — ${data.games_simulated} jogos, ${data.friendlies_simulated||0} amigável(is)`}.`
              : `✅ Week ${data.week} (${halfLabel(before.half)})${noGames ? ' — no games this phase' : ` — ${data.games_simulated} games, ${data.friendlies_simulated||0} friendly(ies)`}.`)
        setLog(prev => [...prev, msg])
        setResult(data)
      }
    } catch (e: any) {
      const msg = `❌ ${e.message}`
      setLog(prev => [...prev, msg])
      setResult({ error: e.message })
    }
    setLoading(false)
  }

  // "Simulate 1 Game" — caps this call to just the next unsimulated game in
  // the current block (see run.ts's gameLimit) — everything else in the
  // block (and every once-per-half step) waits until it's actually done.
  const simulateOneGame = async () => {
    if (!confirm(isPT ? 'Simular apenas o próximo jogo agora?' : 'Simulate just the next game now?')) return
    setLoading(true)
    setResult(null)
    try {
      const before = await getSeasonState()
      await maybeGenerateAutoOrders(before.half)
      setLog(prev => [...prev, isPT ? '⏳ A simular 1 jogo...' : '⏳ Simulating 1 game...'])
      const res = await fetch('/api/admin/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'nba-admin-2025', gameLimit: 1 }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || (isPT ? 'Erro desconhecido' : 'Unknown error'))
      const msg = data.partial
        ? (isPT ? `✅ 1 jogo simulado — ${data.games_remaining} por simular neste bloco (Semana ${data.week}).` : `✅ 1 game simulated — ${data.games_remaining} left in this block (Week ${data.week}).`)
        : (isPT ? `✅ Jogo simulado — era o último do bloco, bloco completo (Semana ${data.week}).` : `✅ Game simulated — it was the last one in the block, block complete (Week ${data.week}).`)
      setLog(prev => [...prev, msg])
      setResult(data)
    } catch (e: any) {
      setLog(prev => [...prev, `❌ ${e.message}`])
      setResult({ error: e.message })
    }
    setLoading(false)
  }

  // "Simulate 1 Week" — keeps calling complete-block until the CURRENT week
  // (the one about to be processed when this started) is fully done,
  // whether that takes 1 more block (already mid-week, at half 2) or 2
  // (starting fresh at half 1) — never spills into the following week.
  const simulateOneWeek = async () => {
    if (!confirm(isPT ? 'Simular a semana atual até ao fim (pode ser 1 ou 2 blocos)?' : 'Simulate the current week to completion (1 or 2 blocks)?')) return
    setLoading(true)
    setResult(null)
    try {
      const startState = await getSeasonState()
      const targetWeek = startState.week + 1
      for (let i = 0; i < 2; i++) {
        const before = await getSeasonState()
        if (before.week >= targetWeek) break
        await maybeGenerateAutoOrders(before.half)
        setLog(prev => [...prev, isPT ? `⏳ A simular semana ${targetWeek} (${halfLabel(before.half)})...` : `⏳ Simulating week ${targetWeek} (${halfLabel(before.half)})...`])
        const data = await callSimulateStep(before)
        const noGames = !data.games_simulated && !data.friendlies_simulated
        setLog(prev => [...prev, isPT
          ? `✅ Semana ${data.week} (${halfLabel(before.half)})${noGames ? ' — sem jogos nesta fase' : ` — ${data.games_simulated} jogos, ${data.friendlies_simulated||0} amigável(is)`}.`
          : `✅ Week ${data.week} (${halfLabel(before.half)})${noGames ? ' — no games this phase' : ` — ${data.games_simulated} games, ${data.friendlies_simulated||0} friendly(ies)`}.`])
        setResult(data)
      }
      setLog(prev => [...prev, isPT ? `🏁 Semana ${targetWeek} completa!` : `🏁 Week ${targetWeek} complete!`])
    } catch (e: any) {
      setLog(prev => [...prev, `❌ ${e.message}`])
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
          ? 'Simula o próximo bloco de 3-4 dias da época agora, sem esperar pelo cron automático — cada bloco avança sempre esse ritmo, haja jogos ou não. Usa durante testes para avançar rapidamente.'
          : 'Simulate the next 3-4 day block immediately, without waiting for the automatic cron — every block always advances at that same pace, whether or not it has games. Use during testing to advance quickly.'}
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

      {/* Primary actions */}
      <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e'}}>
        {isPT ? 'Simular' : 'Simulate'}
      </div>
      <div className="flex flex-col gap-2 mb-6">
        <button
          onClick={simulateOneGame}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 text-left px-4"
          style={{background:'#faf8f5', border:'1px solid #d4cdc5', color:'#1a1512'}}>
          🏀 {isPT ? '1 Jogo' : '1 Game'}
          <div className="text-xs font-normal mt-0.5" style={{color:'#8a8279'}}>
            {isPT ? 'Simula apenas o próximo jogo do bloco atual, e para aí.' : 'Simulates just the next game in the current block, then stops.'}
          </div>
        </button>
        <button
          onClick={() => simulate(1)}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 text-left px-4"
          style={{background:'#c8102e', color:'#fff'}}>
          ✅ {isPT ? 'Completar Bloco (3-4 dias)' : 'Complete Block (3-4 days)'}
          <div className="text-xs font-normal mt-0.5" style={{color:'#ffd9d9'}}>
            {isPT ? 'Termina todos os jogos que faltam no bloco atual (novo ou a meio).' : 'Finishes every game still left in the current block (fresh or mid-way).'}
          </div>
        </button>
        <button
          onClick={simulateOneWeek}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 text-left px-4"
          style={{background:'#faf8f5', border:'1px solid #d4cdc5', color:'#1a1512'}}>
          📅 {isPT ? '1 Semana Completa' : 'Full Week'}
          <div className="text-xs font-normal mt-0.5" style={{color:'#8a8279'}}>
            {isPT ? 'Simula a semana atual até ao fim (1 ou 2 blocos, conforme o ponto onde vai).' : 'Simulates the current week to completion (1 or 2 blocks, depending on where it is right now).'}
          </div>
        </button>
      </div>

      {/* Advanced: bulk-skip several blocks at once (testing) */}
      <details className="mb-4">
        <summary className="text-xs font-semibold cursor-pointer" style={{color:'#8a8279'}}>
          {isPT ? 'Avançado: simular vários blocos de uma vez' : 'Advanced: simulate several blocks at once'}
        </summary>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs font-semibold" style={{color:'#5c554e'}}>
            {isPT ? 'Nº de blocos (3-4 dias):' : 'Blocks (3-4 days):'}
          </span>
          <input
            type="number"
            min={1}
            max={40}
            value={blockCount}
            disabled={loading}
            onChange={e => setBlockCount(Math.min(40, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-16 px-2 py-1 rounded-lg text-sm text-center font-bold disabled:opacity-40"
            style={{background:'#faf8f5', border:'1px solid #d4cdc5', color:'#1a1512'}}
          />
          <button
            onClick={() => simulate(blockCount)}
            disabled={loading}
            className="flex-1 py-2 rounded-xl font-bold text-sm disabled:opacity-40"
            style={{background:'#5c554e', color:'#fff'}}>
            {loading ? (isPT ? '⏳ A simular...' : '⏳ Simulating...') : `⚡ ${isPT ? `Simular ${blockCount} Bloco${blockCount!==1?'s':''}` : `Simulate ${blockCount} Block${blockCount!==1?'s':''}`}`}
          </button>
        </div>
      </details>

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

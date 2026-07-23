'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'
import { supabase } from '@/lib/supabase'
import { formatHalfWeekRange, formatWeekRange, getHalfWeekDates, getWeekDates } from '@/lib/season-week-helper'

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:14, height:14, borderRadius:'50%', background:'rgba(255,255,255,0.5)', color:'inherit', fontSize:10, fontWeight:700, lineHeight:1 }}>i</span>
      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 px-2.5 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
        style={{ background:'#1a1512', color:'#f5f1eb', width:220, whiteSpace:'normal', lineHeight:1.5, fontWeight:400, boxShadow:'0 4px 12px rgba(0,0,0,0.2)' }}>
        {text}
      </span>
    </span>
  )
}

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
    return { week: data?.current_week as number, half: (data?.next_sim_half === 2 ? 2 : 1) as 1 | 2 }
  }

  // Real dates for each button — Bruno wants to see exactly what "1 Day" /
  // "Complete Block" / "Full Week" will simulate before clicking, so he can
  // tell at a glance whether things line up once he's done a partial step.
  const [preview, setPreview] = useState<{ nextDayDate: Date | null, blockStart: Date, blockEnd: Date, weekStart: Date, weekEnd: Date } | null>(null)

  const loadPreview = async () => {
    const { week, half } = await getSeasonState()
    const nextWeek = week + 1
    const { start: blockStart, end: blockEnd } = nextWeek > 0 ? getHalfWeekDates(nextWeek, half) : { start: new Date('2025-10-01'), end: new Date('2025-10-07') }
    const { start: weekStart, end: weekEnd } = nextWeek > 0 ? getWeekDates(nextWeek) : { start: new Date('2025-10-01'), end: new Date('2025-10-07') }
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    // The actual earliest still-scheduled day in this block — not just the
    // block's start date, since a previous partial "1 Day" run may have
    // already used up the first day or two.
    const { data: nextGame } = await supabase.from('games').select('scheduled_date')
      .eq('week_number', nextWeek).eq('status', 'scheduled')
      .gte('scheduled_date', ymd(blockStart)).lte('scheduled_date', ymd(blockEnd))
      .order('scheduled_date').limit(1).maybeSingle()
    const nextDayDate = nextGame?.scheduled_date ? new Date(nextGame.scheduled_date + 'T12:00:00') : null
    setPreview({ nextDayDate, blockStart, blockEnd, weekStart, weekEnd })
  }

  useEffect(() => { loadPreview() }, [])

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

  const locale = isPT ? 'pt-PT' : 'en-US'
  const halfLabel = (week: number, half: 1 | 2) => formatHalfWeekRange(week, half, locale)

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
          ? (isPT ? `✅ ${halfLabel(data.week,before.half)} — confirmado na base de dados.` : `✅ ${halfLabel(data.week,before.half)} — confirmed against the database.`)
          : (isPT
              ? `✅ ${halfLabel(data.week,before.half)}${noGames ? ' — sem jogos nesta fase' : ` — ${data.games_simulated} jogos, ${data.friendlies_simulated||0} amigável(is)`}.`
              : `✅ ${halfLabel(data.week,before.half)}${noGames ? ' — no games this phase' : ` — ${data.games_simulated} games, ${data.friendlies_simulated||0} friendly(ies)`}.`)
        setLog(prev => [...prev, msg])
        setResult(data)
      }
    } catch (e: any) {
      const msg = `❌ ${e.message}`
      setLog(prev => [...prev, msg])
      setResult({ error: e.message })
    }
    await loadPreview()
    setLoading(false)
  }

  // "Simulate 1 Day" — caps this call to just the earliest unsimulated
  // calendar day in the current block (see run.ts's dayLimit) — everything
  // else in the block (and every once-per-half step) waits until it's
  // actually done.
  const simulateOneDay = async () => {
    if (!confirm(isPT ? 'Simular apenas o próximo dia agora?' : 'Simulate just the next day now?')) return
    setLoading(true)
    setResult(null)
    try {
      const before = await getSeasonState()
      await maybeGenerateAutoOrders(before.half)
      setLog(prev => [...prev, isPT ? '⏳ A simular 1 dia...' : '⏳ Simulating 1 day...'])
      const res = await fetch('/api/admin/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'nba-admin-2025', dayLimit: 1 }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || (isPT ? 'Erro desconhecido' : 'Unknown error'))
      const msg = data.partial
        ? (isPT ? `✅ ${data.games_simulated} jogo(s) simulado(s) — ${data.games_remaining} por simular neste bloco (${formatWeekRange(data.week,locale)}).` : `✅ ${data.games_simulated} game(s) simulated — ${data.games_remaining} left in this block (${formatWeekRange(data.week,locale)}).`)
        : (isPT ? `✅ Dia simulado — era o último do bloco, bloco completo (${formatWeekRange(data.week,locale)}).` : `✅ Day simulated — it was the last one in the block, block complete (${formatWeekRange(data.week,locale)}).`)
      setLog(prev => [...prev, msg])
      setResult(data)
    } catch (e: any) {
      setLog(prev => [...prev, `❌ ${e.message}`])
      setResult({ error: e.message })
    }
    await loadPreview()
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
        setLog(prev => [...prev, isPT ? `⏳ A simular ${halfLabel(targetWeek,before.half)}...` : `⏳ Simulating ${halfLabel(targetWeek,before.half)}...`])
        const data = await callSimulateStep(before)
        const noGames = !data.games_simulated && !data.friendlies_simulated
        setLog(prev => [...prev, isPT
          ? `✅ ${halfLabel(data.week,before.half)}${noGames ? ' — sem jogos nesta fase' : ` — ${data.games_simulated} jogos, ${data.friendlies_simulated||0} amigável(is)`}.`
          : `✅ ${halfLabel(data.week,before.half)}${noGames ? ' — no games this phase' : ` — ${data.games_simulated} games, ${data.friendlies_simulated||0} friendly(ies)`}.`])
        setResult(data)
      }
      setLog(prev => [...prev, isPT ? `🏁 ${formatWeekRange(targetWeek,locale)} completa!` : `🏁 ${formatWeekRange(targetWeek,locale)} complete!`])
    } catch (e: any) {
      setLog(prev => [...prev, `❌ ${e.message}`])
      setResult({ error: e.message })
    }
    await loadPreview()
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
            '🏀 Jogos da semana (regulares, amigáveis/Pré-Época, exibições All-Star, Playoffs, G-League e Summer League, consoante a fase da época)',
            '📊 Estatísticas de jogadores actualizadas (excepto na Pré-Época)',
            '🏥 Saúde e lesões (em jogo, treino e fora de campo), recuperação e suspensões por faltas técnicas',
            '📈 Desenvolvimento de atributos e treino (slots e créditos)',
            '🏆 Prémios (semanais, mensais, da época) e Power Rankings actualizados',
            '💰 Finanças da equipa: patrocínios, merchandising e manutenção de instalações',
            '❤️ Popularidade e satisfação (fãs, GM, donos)',
            '🤝 Interações entre jogadores e All-Star Weekend (votação/plantéis)',
            '⚠️ Avisos de retirada e decisões de fim de época',
            '👴 Envelhecimento e progressão de rookies (fim de época)',
            '🔬 Pontos de scouting gerados',
            '📣 Notificações enviadas aos GMs',
          ] : [
            '🏀 Games for the week (regular, friendlies/Pre-Season, All-Star exhibitions, Playoffs, G-League and Summer League, depending on the season phase)',
            '📊 Player stats updated (except during Pre-Season)',
            '🏥 Health and injuries (in-game, practice and off-court), recovery and technical-foul suspensions',
            '📈 Attribute development and training (slots and credits)',
            '🏆 Awards (weekly, monthly, season) and Power Rankings updated',
            '💰 Team finances: sponsorships, merchandising and facility upkeep',
            '❤️ Popularity and satisfaction (fans, GM, owners)',
            '🤝 Player interactions and All-Star Weekend (voting/rosters)',
            '⚠️ Retirement warnings and end-of-season decisions',
            '👴 Aging and rookie option progression (end of season)',
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
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        {(() => {
          const fmtDate = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
          const dayDateLabel = preview
            ? (preview.nextDayDate ? fmtDate(preview.nextDayDate) : (isPT ? 'sem jogos' : 'no games'))
            : '…'
          // Start from whichever day is actually still unsimulated (same one
          // "1 Day" would target), not the block's nominal start date — if
          // a previous partial run already finished the first day or two,
          // "Mar 16 – Mar 19" would wrongly read as "will redo the 16th too".
          const blockDateLabel = preview
            ? `${fmtDate(preview.nextDayDate || preview.blockStart)} – ${fmtDate(preview.blockEnd)}`
            : '…'
          // Same reasoning as blockDateLabel — if this week's first half is
          // already done (we're now on half 2), the remaining range starts
          // at the current block's next unsimulated day, not the week's
          // nominal day 1.
          const weekDateLabel = preview
            ? `${fmtDate(preview.nextDayDate || preview.weekStart)} – ${fmtDate(preview.weekEnd)}`
            : '…'
          return [
            { onClick: simulateOneDay, icon: '🌅', color: '#1d4ed8', dateLabel: dayDateLabel,
              labelPT: '1 Dia', labelEN: '1 Day',
              descPT: 'Simula só o próximo dia com jogos por realizar no bloco atual, e para aí.',
              descEN: 'Simulates just the next day of games in the current block, then stops.' },
            { onClick: () => simulate(1), icon: '✅', color: '#c8102e', dateLabel: blockDateLabel,
              labelPT: 'Completar Bloco', labelEN: 'Complete Block',
              descPT: 'Termina todos os jogos que faltam no bloco atual (3-4 dias, novo ou a meio).',
              descEN: 'Finishes every game still left in the current block (3-4 days, fresh or mid-way).' },
            { onClick: simulateOneWeek, icon: '📅', color: '#15803d', dateLabel: weekDateLabel,
              labelPT: '1 Semana', labelEN: '1 Week',
              descPT: 'Simula a semana atual até ao fim (1 ou 2 blocos, conforme o ponto onde vai).',
              descEN: 'Simulates the current week to completion (1 or 2 blocks, depending on where it is right now).' },
          ].map(opt => (
            <button
              key={opt.labelEN}
              onClick={opt.onClick}
              disabled={loading}
              className="flex-1 py-2.5 px-3 rounded-xl font-bold text-sm disabled:opacity-40 text-center"
              style={{background:'#faf8f5', border:'1px solid #d4cdc5', borderTop:`3px solid ${opt.color}`, color:'#1a1512'}}>
              <div style={{color:opt.color}} className="flex items-center justify-center">
                {opt.icon} {isPT ? opt.labelPT : opt.labelEN}
                <Tooltip text={isPT ? opt.descPT : opt.descEN} />
              </div>
              <div className="text-xs font-semibold mt-1" style={{color:'#5c554e'}}>
                {opt.dateLabel}
              </div>
            </button>
          ))
        })()}
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
                {isPT ? `${formatWeekRange(result.week,locale)} simulada com sucesso!` : `${formatWeekRange(result.week,locale)} simulated successfully!`}
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

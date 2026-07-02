'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminSimulatePage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [log, setLog]         = useState<string[]>([])

  const simulate = async () => {
    if (!confirm(isPT
      ? 'Simular a próxima semana agora?'
      : 'Simulate next week now?')) return

    setLoading(true)
    setResult(null)
    setLog(prev => [...prev, isPT ? '⏳ A simular...' : '⏳ Simulating...'])

    try {
      const res = await fetch('/api/admin/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'nba-admin-2025' }),
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'dev-simulate'}`,
        },
      })
      const data = await res.json()

      if (res.ok && data.success) {
        const msg = isPT
          ? `✅ Semana ${data.week} simulada! ${data.games_simulated} jogos.`
          : `✅ Week ${data.week} simulated! ${data.games_simulated} games.`
        setLog(prev => [...prev, msg])
        setResult(data)
      } else {
        const msg = `❌ ${data.error || (isPT ? 'Erro desconhecido' : 'Unknown error')}`
        setLog(prev => [...prev, msg])
        setResult({ error: data.error })
      }
    } catch (e: any) {
      const msg = `❌ ${e.message}`
      setLog(prev => [...prev, msg])
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
            '📊 Estatísticas de jogadores actualizadas',
            '🏥 Saúde e lesões processadas',
            '📈 Desenvolvimento de atributos',
            '🏆 Prémios semanais / mensais',
            '💰 Objectivos de patrocínio verificados',
            '🔬 Pontos de scouting gerados',
            '📣 Notificações enviadas aos GMs',
          ] : [
            '🏀 4 games per team (round-robin)',
            '📊 Player stats updated',
            '🏥 Health and injuries processed',
            '📈 Attribute development',
            '🏆 Weekly / monthly awards',
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

      <button
        onClick={simulate}
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 mb-4"
        style={{background:'#c8102e', color:'#fff'}}>
        {loading
          ? (isPT ? '⏳ A simular...' : '⏳ Simulating...')
          : `⚡ ${isPT ? 'Simular Próxima Semana' : 'Simulate Next Week'}`}
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
          <p className="text-sm font-bold mb-1" style={{color:'#15803d'}}>
            ✓ {isPT ? `Semana ${result.week} concluída!` : `Week ${result.week} complete!`}
          </p>
          <p className="text-xs" style={{color:'#166534'}}>
            {result.games_simulated} {isPT ? 'jogos simulados' : 'games simulated'}
          </p>
          <div className="flex gap-3 mt-3">
            <Link href="/schedule" className="text-xs no-underline font-semibold" style={{color:'#15803d'}}>
              {isPT ? 'Ver Calendário →' : 'View Schedule →'}
            </Link>
            <Link href="/standings" className="text-xs no-underline font-semibold" style={{color:'#15803d'}}>
              {isPT ? 'Classificação →' : 'Standings →'}
            </Link>
            <Link href="/power-rankings" className="text-xs no-underline font-semibold" style={{color:'#15803d'}}>
              Power Rankings →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminGenerateSchedulePage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [error, setError]     = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const generate = async () => {
    if (!confirmed) return
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/admin/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'nba-admin-2025', startWeek: 17, endWeek: 40 }),
      })
      const data = await res.json()
      if (!res.ok || data.error) setError(data.error || 'Unknown error')
      else setResult(data)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/admin" className="text-xs no-underline mb-6 block" style={{color:'#8a8279'}}>← Admin</Link>

      <h1 className="text-xl font-bold mb-2" style={{color:'#1a1512'}}>
        📅 {isPT ? 'Gerar Calendário da Época Regular' : 'Generate Regular Season Schedule'}
      </h1>
      <p className="text-sm mb-6" style={{color:'#5c554e'}}>
        {isPT
          ? 'Constrói um calendário completo e correcto para as 30 equipas, seguindo o formato real da NBA: 4 jogos com cada rival de divisão, 4 ou 3 jogos com cada equipa da mesma conferência (consoante o adversário), 2 jogos com cada equipa da conferência oposta. Resultado: exactamente 82 jogos por equipa.'
          : 'Builds a complete, correct schedule for all 30 teams, following the real NBA format: 4 games vs each division rival, 4 or 3 games vs each same-conference opponent (depending on which one), 2 games vs each opposite-conference team. Result: exactly 82 games per team.'}
      </p>

      <div className="rounded-xl p-4 mb-4" style={{background:'#fef3c7', border:'1px solid #d4a72c'}}>
        <p className="text-sm font-bold mb-1" style={{color:'#92400e'}}>
          ⚠️ {isPT ? 'Isto substitui o calendário actual' : 'This replaces the current schedule'}
        </p>
        <p className="text-xs" style={{color:'#92400e'}}>
          {isPT
            ? 'Apaga todos os jogos da Época Regular ainda por jogar (status "agendado") e cria os novos. Jogos já jogados não são tocados.'
            : 'Deletes every not-yet-played Regular Season game and creates fresh ones. Already-played games are never touched.'}
        </p>
      </div>

      <label className="flex items-center gap-2 mb-4 text-sm" style={{color:'#5c554e'}}>
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
        {isPT ? 'Sim, quero substituir o calendário agendado' : 'Yes, I want to replace the scheduled calendar'}
      </label>

      <button
        onClick={generate}
        disabled={loading || !confirmed}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 mb-4"
        style={{background:'#4338ca', color:'#fff'}}>
        {loading
          ? (isPT ? '⏳ A gerar...' : '⏳ Generating...')
          : `📅 ${isPT ? 'Gerar Calendário' : 'Generate Schedule'}`}
      </button>

      {error && (
        <div className="rounded-xl p-4" style={{background:'#fee2e2', border:'1px solid #dc2626'}}>
          <p className="text-sm font-bold" style={{color:'#dc2626'}}>❌ {error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl p-4" style={{background:'#dcfce7', border:'1px solid #15803d'}}>
          <p className="text-sm font-bold" style={{color:'#15803d'}}>
            {isPT ? 'Calendário gerado com sucesso!' : 'Schedule generated successfully!'}
          </p>
          <p className="text-xs mt-1" style={{color:'#166534'}}>
            {result.games} {isPT ? 'jogos' : 'games'} · {result.weeks} {isPT ? 'semanas' : 'weeks'} · {isPT ? 'equipas fora de 82 jogos:' : 'teams off 82 games:'} {result.teams_off_82}
          </p>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminSponsorPoolPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [error, setError]     = useState('')

  const generate = async () => {
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/admin/generate-sponsor-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'nba-admin-2025', season: '2025-26' }),
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
        🤝 {isPT ? 'Reserva de Patrocinadores' : 'Sponsor Pool'}
      </h1>
      <p className="text-sm mb-6" style={{color:'#5c554e'}}>
        {isPT
          ? 'Dá a cada equipa as opções de patrocínio disponíveis para a época (camisola, campo, painéis), com base nos modelos já existentes. Não mexe em contratos já assinados.'
          : 'Gives every team the sponsor options available for the season (jersey, court, panels), based on the existing templates. Never touches already-signed contracts.'}
      </p>

      <button
        onClick={generate}
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 mb-4"
        style={{background:'#c8102e', color:'#fff'}}>
        {loading
          ? (isPT ? '⏳ A gerar...' : '⏳ Generating...')
          : `🤝 ${isPT ? 'Gerar Reserva de Patrocinadores' : 'Generate Sponsor Pool'}`}
      </button>

      {error && (
        <div className="rounded-xl p-4" style={{background:'#fee2e2', border:'1px solid #dc2626'}}>
          <p className="text-sm font-bold" style={{color:'#dc2626'}}>❌ {error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl p-4" style={{background:'#dcfce7', border:'1px solid #15803d'}}>
          <p className="text-sm font-bold" style={{color:'#15803d'}}>
            {isPT ? 'Reserva gerada com sucesso!' : 'Pool generated successfully!'}
          </p>
          <p className="text-xs mt-1" style={{color:'#166534'}}>
            {result.teams} {isPT ? 'equipas' : 'teams'} · {result.templates} {isPT ? 'modelos' : 'templates'} · {result.generated} {isPT ? 'opções criadas' : 'options created'}
          </p>
        </div>
      )}
    </div>
  )
}

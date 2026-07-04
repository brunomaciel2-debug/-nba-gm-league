'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminResolveDraftPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [error, setError]     = useState('')
  const [force, setForce]     = useState(false)

  const resolve = async () => {
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/admin/resolve-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'nba-admin-2025', force }),
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
        🎓 {isPT ? 'Resolver Draft' : 'Resolve Draft'}
      </h1>
      <p className="text-sm mb-6" style={{color:'#5c554e'}}>
        {isPT
          ? 'Resolve a Ronda 1 e/ou Ronda 2 do Draft (só corre a ronda cuja semana já chegou, a não ser que forces), e trata automaticamente confirmações e Team Options que tenham expirado o prazo. Corre sozinho de 6 em 6 horas — este botão serve para testar sem esperar pelas datas reais.'
          : 'Resolves Round 1 and/or Round 2 of the Draft (only runs the round whose week has actually arrived, unless forced), and automatically handles any expired confirmations or Team Options. Runs automatically every 6 hours — this button is for testing without waiting for the real dates.'}
      </p>

      <label className="flex items-center gap-2 mb-4 text-sm" style={{color:'#5c554e'}}>
        <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
        {isPT ? 'Forçar resolução imediata (ignora a semana do calendário)' : 'Force immediate resolution (ignore the calendar week)'}
      </label>

      <button
        onClick={resolve}
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 mb-4"
        style={{background:'#7c3aed', color:'#fff'}}>
        {loading
          ? (isPT ? '⏳ A resolver...' : '⏳ Resolving...')
          : `🎓 ${isPT ? 'Resolver Draft' : 'Resolve Draft'}`}
      </button>

      {error && (
        <div className="rounded-xl p-4" style={{background:'#fee2e2', border:'1px solid #dc2626'}}>
          <p className="text-sm font-bold" style={{color:'#dc2626'}}>❌ {error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl p-4" style={{background:'#dcfce7', border:'1px solid #15803d'}}>
          <p className="text-sm font-bold" style={{color:'#15803d'}}>
            {isPT ? 'Draft resolvido!' : 'Draft resolved!'}
          </p>
          <p className="text-xs mt-1" style={{color:'#166534'}}>
            {isPT ? 'Ronda 1' : 'Round 1'}: {result.round1?.resolved ?? 0} · {isPT ? 'Ronda 2' : 'Round 2'}: {result.round2?.resolved ?? 0} · {isPT ? 'Confirmações expiradas' : 'Confirmations expired'}: {result.confirmSweep?.expired ?? 0} · {isPT ? 'Opções expiradas' : 'Options expired'}: {result.optionSweep?.expired ?? 0}
          </p>
        </div>
      )}
    </div>
  )
}

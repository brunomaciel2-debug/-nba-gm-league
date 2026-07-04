'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminResolveFreeAgencyPage() {
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
      const res = await fetch('/api/admin/resolve-free-agency', {
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
        🏀 {isPT ? 'Resolver Free Agency' : 'Resolve Free Agency'}
      </h1>
      <p className="text-sm mb-6" style={{color:'#5c554e'}}>
        {isPT
          ? 'Decide as propostas de contrato feitas durante a semana de Free Agency. Cada jogador escolhe a melhor proposta com base em salário, ambição pessoal, popularidade da franquia e qualidade do staff técnico. Corre automaticamente de 4 em 4 horas — este botão serve para testar sem esperar.'
          : 'Decides the contract offers made during Free Agency week. Each player picks the best offer based on salary, personal ambition, franchise popularity, and coaching staff quality. Runs automatically every 4 hours — this button is for testing without waiting.'}
      </p>

      <label className="flex items-center gap-2 mb-4 text-sm" style={{color:'#5c554e'}}>
        <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
        {isPT ? 'Forçar decisão imediata (ignora a espera de 1-2 dias)' : 'Force immediate decision (skip the 1-2 day wait)'}
      </label>

      <button
        onClick={resolve}
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 mb-4"
        style={{background:'#c8102e', color:'#fff'}}>
        {loading
          ? (isPT ? '⏳ A resolver...' : '⏳ Resolving...')
          : `🏀 ${isPT ? 'Resolver Free Agency' : 'Resolve Free Agency'}`}
      </button>

      {error && (
        <div className="rounded-xl p-4" style={{background:'#fee2e2', border:'1px solid #dc2626'}}>
          <p className="text-sm font-bold" style={{color:'#dc2626'}}>❌ {error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl p-4" style={{background:'#dcfce7', border:'1px solid #15803d'}}>
          <p className="text-sm font-bold" style={{color:'#15803d'}}>
            {isPT ? 'Free Agency resolvida!' : 'Free Agency resolved!'}
          </p>
          <p className="text-xs mt-1" style={{color:'#166534'}}>
            {result.resolved} {isPT ? 'jogador(es) assinado(s)' : 'player(s) signed'}
          </p>
        </div>
      )}
    </div>
  )
}

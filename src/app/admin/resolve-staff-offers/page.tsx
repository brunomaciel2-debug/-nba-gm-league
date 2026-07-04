'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminResolveStaffOffersPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [error, setError]     = useState('')

  const resolve = async () => {
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/admin/resolve-staff-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'nba-admin-2025' }),
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
        👔 {isPT ? 'Resolver Propostas de Staff' : 'Resolve Staff Offers'}
      </h1>
      <p className="text-sm mb-6" style={{color:'#5c554e'}}>
        {isPT
          ? 'Decide todas as propostas pendentes a treinadores livres. Cada treinador escolhe entre as propostas recebidas, com base no salário oferecido, no registo da equipa e em corresponder (ou não) ao seu cargo natural. Normalmente corre sozinho todas as noites — este botão serve para testar sem esperar pela meia-noite.'
          : 'Decides every pending offer made to free-agent coaches. Each coach picks among the offers they received, weighing salary, the hiring team\'s record, and whether the role offered matches their natural role. Normally runs automatically every night — this button is for testing without waiting until midnight.'}
      </p>

      <button
        onClick={resolve}
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 mb-4"
        style={{background:'#1d4ed8', color:'#fff'}}>
        {loading
          ? (isPT ? '⏳ A resolver...' : '⏳ Resolving...')
          : `👔 ${isPT ? 'Resolver Propostas' : 'Resolve Offers'}`}
      </button>

      {error && (
        <div className="rounded-xl p-4" style={{background:'#fee2e2', border:'1px solid #dc2626'}}>
          <p className="text-sm font-bold" style={{color:'#dc2626'}}>❌ {error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl p-4" style={{background:'#dcfce7', border:'1px solid #15803d'}}>
          <p className="text-sm font-bold" style={{color:'#15803d'}}>
            {isPT ? 'Propostas resolvidas!' : 'Offers resolved!'}
          </p>
          <p className="text-xs mt-1" style={{color:'#166534'}}>
            {result.resolved} {isPT ? 'treinador(es) contratado(s)' : 'coach(es) hired'}
          </p>
        </div>
      )}
    </div>
  )
}

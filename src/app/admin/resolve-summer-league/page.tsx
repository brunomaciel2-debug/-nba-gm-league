'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminResolveSummerLeaguePage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const resolve = async () => {
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/admin/resolve-summer-league', {
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
        🏀 {isPT ? 'Resolver Summer League' : 'Resolve Summer League'}
      </h1>
      <p className="text-sm mb-6" style={{color:'#5c554e'}}>
        {isPT
          ? 'Avança o torneio de Summer League um estágio de cada vez: gera os rosters (Rookies + Sophomores + FAs até 26 anos), depois cada uma das 4 jornadas preliminares, depois o apuramento + consolação + meias-finais, e por fim a final. Podes carregar várias vezes seguidas para avançar o torneio todo.'
          : 'Advances the Summer League tournament one stage at a time: generates rosters (Rookies + Sophomores + FAs up to 26), then each of the 4 preliminary rounds, then seeding + consolation + semifinals, then the final. Click repeatedly to advance the whole tournament.'}
      </p>

      <button
        onClick={resolve}
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 mb-4"
        style={{background:'#c8102e', color:'#fff'}}>
        {loading
          ? (isPT ? '⏳ A avançar...' : '⏳ Advancing...')
          : `🏀 ${isPT ? 'Avançar Summer League' : 'Advance Summer League'}`}
      </button>

      {error && (
        <div className="rounded-xl p-4" style={{background:'#fee2e2', border:'1px solid #dc2626'}}>
          <p className="text-sm font-bold" style={{color:'#dc2626'}}>❌ {error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl p-4" style={{background:'#dcfce7', border:'1px solid #15803d'}}>
          <p className="text-sm font-bold" style={{color:'#15803d'}}>
            {isPT ? 'Estágio concluído!' : 'Stage complete!'}
          </p>
          <p className="text-xs mt-1" style={{color:'#166534'}}>{result.stage}</p>
          {result.detail && <pre className="text-xs mt-2" style={{color:'#166534'}}>{JSON.stringify(result.detail)}</pre>}
        </div>
      )}
    </div>
  )
}

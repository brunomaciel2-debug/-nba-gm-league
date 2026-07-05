'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

export default function AdminAssignRefereesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/admin/assign-referees', {
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
        👨‍⚖️ {isPT ? 'Atribuir Árbitros' : 'Assign Referees'}
      </h1>
      <p className="text-sm mb-6" style={{color:'#5c554e'}}>
        {isPT
          ? 'Atribui um árbitro a todos os jogos agendados que ainda não têm um, em todo o calendário futuro conhecido — nunca dois jogos no mesmo dia com o mesmo árbitro. Corre automaticamente a cada simulação — este botão serve para atualizar o calendário imediatamente.'
          : "Assigns a referee to every scheduled game that doesn't have one yet, across the whole known future schedule — never two games on the same day with the same referee. Runs automatically on every simulation — this button is for updating the calendar immediately."}
      </p>

      <button
        onClick={run}
        disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 mb-4"
        style={{background:'#c8102e', color:'#fff'}}>
        {loading
          ? (isPT ? '⏳ A atribuir...' : '⏳ Assigning...')
          : `👨‍⚖️ ${isPT ? 'Atribuir Árbitros' : 'Assign Referees'}`}
      </button>

      {error && (
        <div className="rounded-xl p-4" style={{background:'#fee2e2', border:'1px solid #dc2626'}}>
          <p className="text-sm font-bold" style={{color:'#dc2626'}}>❌ {error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl p-4" style={{background:'#dcfce7', border:'1px solid #15803d'}}>
          <p className="text-sm font-bold" style={{color:'#15803d'}}>
            {isPT ? 'Árbitros atribuídos!' : 'Referees assigned!'}
          </p>
          <p className="text-xs mt-1" style={{color:'#166534'}}>
            {result.assigned} {isPT ? 'jogo(s) atualizado(s)' : 'game(s) updated'}
          </p>
        </div>
      )}
    </div>
  )
}

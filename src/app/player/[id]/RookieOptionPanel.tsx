'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

function fmt(n: number) {
  return '$' + (n / 1_000_000).toFixed(2) + 'M'
}

export default function RookieOptionPanel({ playerId }: { playerId: number }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [player, setPlayer] = useState<any>(null)
  const [nextAmount, setNextAmount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    supabase.from('players').select('id,name,salary,rookie_draft_round,rookie_draft_pick,rookie_option_status,rookie_option_deadline').eq('id', playerId).single()
      .then(async ({ data }) => {
        setPlayer(data)
      })
  }, [playerId])

  if (!player || !player.rookie_option_status?.startsWith('pending_')) return null

  const stage = player.rookie_option_status === 'pending_y3' ? 'Y3' : 'Y4'
  const deadline = player.rookie_option_deadline ? new Date(player.rookie_option_deadline) : null
  const daysLeft = deadline ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null

  const act = async (action: 'exercise' | 'decline') => {
    setLoading(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT ? 'Não estás autenticado' : 'Not logged in'); setLoading(false); return }
    const res = await fetch('/api/players/rookie-option', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ playerId, action }),
    })
    const json = await res.json()
    if (res.ok) {
      setResolved(true)
      setMsg(action === 'exercise'
        ? (isPT ? `✅ Team Option exercida! Novo salário: ${fmt(json.newSalary)}/ano.` : `✅ Team Option exercised! New salary: ${fmt(json.newSalary)}/yr.`)
        : (isPT ? `${player.name} tornou-se agente livre.` : `${player.name} is now a free agent.`))
    } else {
      setMsg(json.error || (isPT ? 'Erro' : 'Error'))
    }
    setLoading(false)
  }

  if (resolved) return (
    <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: '#dcfce7', border: '1px solid #86efac' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>{msg}</div>
    </div>
  )

  return (
    <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #d4cdc5' }}>
      <div style={{ padding: '12px 16px', background: '#ede9fe', borderBottom: '1px solid #d4cdc5' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9' }}>
          📋 {isPT ? `Team Option Disponível — Ano ${stage === 'Y3' ? '3' : '4'}` : `Team Option Available — Year ${stage === 'Y3' ? '3' : '4'}`}
        </div>
        <div style={{ fontSize: 11, color: '#5b21b6', marginTop: 4, lineHeight: 1.5 }}>
          {isPT
            ? `${player.name} completou os anos garantidos do contrato de rookie. Podes exercer a opção de equipa (salário fixo, sem % de aumento) ou deixá-lo tornar-se agente livre.`
            : `${player.name} has completed his guaranteed rookie-contract years. You can exercise the team option (fixed salary, no % increase) or let him become a free agent.`}
        </div>
        {daysLeft !== null && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginTop: 6 }}>
            ⏰ {isPT ? `${daysLeft} dia(s) restante(s) para decidir` : `${daysLeft} day(s) left to decide`}
          </div>
        )}
      </div>
      <div style={{ padding: 16, background: '#faf8f5', display: 'flex', gap: 8 }}>
        <button onClick={() => act('exercise')} disabled={loading}
          style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#6d28d9', color: '#fff', border: 'none', cursor: loading ? 'wait' : 'pointer' }}>
          ✓ {isPT ? 'Exercer Opção' : 'Exercise Option'}
        </button>
        <button onClick={() => act('decline')} disabled={loading}
          style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', cursor: loading ? 'wait' : 'pointer' }}>
          ✕ {isPT ? 'Declinar' : 'Decline'}
        </button>
      </div>
      {msg && !resolved && (
        <div style={{ padding: '0 16px 12px', fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{msg}</div>
      )}
    </div>
  )
}

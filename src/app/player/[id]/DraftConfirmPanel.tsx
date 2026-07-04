'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

function fmt(n: number) {
  return '$' + (n / 1_000_000).toFixed(2) + 'M'
}

export default function DraftConfirmPanel({ playerId }: { playerId: number }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [player, setPlayer] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [resolved, setResolved] = useState<'confirmed' | 'declined' | null>(null)

  useEffect(() => {
    supabase.from('players').select('id,name,salary,contract_years,rookie_draft_round,rookie_draft_pick,draft_confirm_deadline').eq('id', playerId).single()
      .then(({ data }) => setPlayer(data))
  }, [playerId])

  if (!player) return null

  const act = async (action: 'confirm' | 'decline') => {
    setLoading(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT ? 'Não estás autenticado' : 'Not logged in'); setLoading(false); return }
    const res = await fetch('/api/players/draft-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ playerId, action }),
    })
    const json = await res.json()
    if (res.ok) {
      setResolved(json.status)
      setMsg(json.status === 'confirmed'
        ? (isPT ? `✅ Contrato confirmado! ${player.name} conta agora para a folha salarial.` : `✅ Contract confirmed! ${player.name} now counts against your cap.`)
        : (isPT ? `${player.name} tornou-se agente livre.` : `${player.name} is now a free agent.`))
    } else {
      setMsg(json.error || (isPT ? 'Erro' : 'Error'))
    }
    setLoading(false)
  }

  const deadline = player.draft_confirm_deadline ? new Date(player.draft_confirm_deadline) : null
  const daysLeft = deadline ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null

  if (resolved) return (
    <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: resolved === 'confirmed' ? '#dcfce7' : '#fee2e2', border: `1px solid ${resolved === 'confirmed' ? '#86efac' : '#fca5a5'}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: resolved === 'confirmed' ? '#15803d' : '#dc2626' }}>{msg}</div>
    </div>
  )

  return (
    <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #d4cdc5' }}>
      <div style={{ padding: '12px 16px', background: '#fff8e8', borderBottom: '1px solid #d4cdc5' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>
          🎓 {isPT ? 'Confirmação de Contrato de Rookie' : 'Rookie Draft Confirmation'}
        </div>
        <div style={{ fontSize: 11, color: '#8a7a6a', marginTop: 4, lineHeight: 1.5 }}>
          {isPT
            ? `Escolhido com a pick #${player.rookie_draft_pick} (Ronda ${player.rookie_draft_round}). Agora que vês os atributos completos, confirma se queres mesmo assinar por ${fmt(player.salary)}/ano × ${player.contract_years} anos garantidos, ou deixa-o tornar-se agente livre.`
            : `Selected with pick #${player.rookie_draft_pick} (Round ${player.rookie_draft_round}). Now that you can see his full attributes, confirm whether you want to sign him for ${fmt(player.salary)}/yr × ${player.contract_years} guaranteed years, or let him become a free agent instead.`}
        </div>
        {daysLeft !== null && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginTop: 6 }}>
            ⏰ {isPT ? `${daysLeft} dia(s) restante(s) para decidir` : `${daysLeft} day(s) left to decide`}
          </div>
        )}
      </div>
      <div style={{ padding: 16, background: '#faf8f5', display: 'flex', gap: 8 }}>
        <button onClick={() => act('confirm')} disabled={loading}
          style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#15803d', color: '#fff', border: 'none', cursor: loading ? 'wait' : 'pointer' }}>
          ✓ {isPT ? 'Confirmar Contrato' : 'Confirm Contract'}
        </button>
        <button onClick={() => act('decline')} disabled={loading}
          style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', cursor: loading ? 'wait' : 'pointer' }}>
          ✕ {isPT ? 'Deixar Tornar-se FA' : 'Let Become FA'}
        </button>
      </div>
      {msg && !resolved && (
        <div style={{ padding: '0 16px 12px', fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{msg}</div>
      )}
    </div>
  )
}

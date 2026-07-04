'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

const MIN_SALARY = 1_000_000
const MAX_SALARY = 50_000_000

function fmt(n: number) {
  return '$' + (n / 1_000_000).toFixed(1) + 'M'
}

export default function FAMarketOfferPanel({ playerId }: { playerId: number }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [gmTeamId, setGmTeamId] = useState<string | null>(null)
  const [player, setPlayer] = useState<any>(null)
  const [myOffer, setMyOffer] = useState<any>(null)
  const [offerCount, setOfferCount] = useState(0)
  const [firstOfferAt, setFirstOfferAt] = useState<string | null>(null)
  const [salary, setSalary] = useState(5_000_000)
  const [years, setYears] = useState(3)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: gm } = await supabase.from('gm_profiles').select('team_id').eq('id', user.id).single()
      if (!gm?.team_id) return
      setGmTeamId(gm.team_id)

      const [{ data: p }, { data: offers }] = await Promise.all([
        supabase.from('players').select('id,name').eq('id', playerId).single(),
        supabase.from('fa_market_offers').select('team_id,salary,years,created_at').eq('player_id', playerId).eq('status', 'pending').order('created_at'),
      ])
      setPlayer(p)
      setOfferCount(offers?.length || 0)
      if (offers?.length) setFirstOfferAt(offers[0].created_at)
      const mine = (offers || []).find((o: any) => o.team_id === gm.team_id)
      if (mine) { setMyOffer(mine); setSalary(mine.salary); setYears(mine.years) }
    })
  }, [playerId])

  if (!gmTeamId || !player) return null

  const submitOffer = async () => {
    setLoading(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT ? 'Não estás autenticado' : 'Not logged in'); setLoading(false); return }
    const res = await fetch('/api/fa/market-offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ playerId, salary, years }),
    })
    const json = await res.json()
    if (res.ok) {
      setMsg(isPT ? `✅ Proposta enviada — ${player.name} decide dentro de 1 a 2 dias.` : `✅ Offer sent — ${player.name} decides within 1-2 days.`)
      if (!myOffer) setOfferCount(c => c + 1)
      setMyOffer({ team_id: gmTeamId, salary, years })
    } else {
      setMsg(json.error || (isPT ? 'Erro ao submeter proposta' : 'Error submitting offer'))
    }
    setLoading(false)
  }

  const withdraw = async () => {
    setLoading(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    await fetch('/api/fa/market-offer', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ playerId }),
    })
    setMyOffer(null)
    setOfferCount(c => Math.max(0, c - 1))
    setLoading(false)
  }

  const daysSinceFirstOffer = firstOfferAt ? Math.floor((Date.now() - new Date(firstOfferAt).getTime()) / (24 * 60 * 60 * 1000)) : 0

  return (
    <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #d4cdc5' }}>
      <div style={{ padding: '12px 16px', background: '#fff8e8', borderBottom: '1px solid #d4cdc5' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>
          🏀 {isPT ? 'Semana de Free Agency' : 'Free Agency Week'}
        </div>
        <div style={{ fontSize: 11, color: '#8a7a6a', marginTop: 2, lineHeight: 1.5 }}>
          {isPT
            ? `Propõe o contrato que quiseres — ${player.name} decide com base no salário, ambição pessoal, popularidade da franquia e qualidade do staff técnico.`
            : `Offer whatever contract you want — ${player.name} decides based on salary, personal ambition, franchise popularity, and coaching staff quality.`}
        </div>
        {offerCount > 0 && (
          <div style={{ fontSize: 11, color: '#8a7a6a', marginTop: 6 }}>
            {isPT
              ? `${offerCount} equipa${offerCount !== 1 ? 's' : ''} já propuse${offerCount !== 1 ? 'ram' : ''} — decisão dentro de 1 a 2 dias desde a primeira proposta${daysSinceFirstOffer > 0 ? ` (já há ${daysSinceFirstOffer} dia${daysSinceFirstOffer !== 1 ? 's' : ''})` : ''}.`
              : `${offerCount} team${offerCount !== 1 ? 's have' : ' has'} already offered — decision lands 1-2 days after the first offer${daysSinceFirstOffer > 0 ? ` (already ${daysSinceFirstOffer} day${daysSinceFirstOffer !== 1 ? 's' : ''} ago)` : ''}.`}
          </div>
        )}
      </div>

      <div style={{ padding: 16, background: '#faf8f5' }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#5c554e', display: 'block', marginBottom: 4 }}>
            {isPT ? 'Salário Anual' : 'Annual Salary'}
          </label>
          <input type="range" min={MIN_SALARY} max={MAX_SALARY} step={100_000}
            value={salary} onChange={e => setSalary(Number(e.target.value))} style={{ width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8a8279', marginTop: 2 }}>
            <span>$1.0M</span>
            <span style={{ fontWeight: 700, color: '#1a1512', fontSize: 14 }}>{fmt(salary)}</span>
            <span>{fmt(MAX_SALARY)}</span>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#5c554e', display: 'block', marginBottom: 4 }}>
            {isPT ? 'Duração do Contrato' : 'Contract Length'}
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(y => (
              <button key={y} onClick={() => setYears(y)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${years === y ? '#1a1512' : '#d4cdc5'}`,
                  background: years === y ? '#1a1512' : '#f0ece5',
                  color: years === y ? '#fff' : '#5c554e',
                }}>
                {y}{isPT ? 'ano' : 'yr'}
              </button>
            ))}
          </div>
        </div>

        <button onClick={submitOffer} disabled={loading}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 700,
            background: '#1a1512', color: '#faf8f5', border: 'none',
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
          }}>
          {loading
            ? (isPT ? 'A submeter...' : 'Submitting...')
            : myOffer
            ? (isPT ? `Atualizar Proposta — ${fmt(salary)}/ano × ${years}${years === 1 ? 'ano' : 'anos'}` : `Update Offer — ${fmt(salary)}/yr × ${years}yr`)
            : (isPT ? `Propor Contrato — ${fmt(salary)}/ano × ${years}${years === 1 ? 'ano' : 'anos'}` : `Make Offer — ${fmt(salary)}/yr × ${years}yr`)}
        </button>

        {myOffer && (
          <button onClick={withdraw} disabled={loading}
            style={{ marginTop: 8, width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer' }}>
            {isPT ? 'Retirar Proposta' : 'Withdraw Offer'}
          </button>
        )}

        {msg && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: msg.startsWith('✅') ? '#15803d' : '#dc2626' }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

const MAX_SALARY = 50_000_000
const MAX_INCREASE_PCT = 0.40
const MIN_YEARS = 1
const MAX_YEARS = 5
const ELIGIBLE_YEARS_LEFT = 2

function fmt(n: number) {
  return '$' + (n / 1_000_000).toFixed(1) + 'M'
}

function fairValueForOvr(ovr: number) {
  return Math.min(MAX_SALARY, Math.max(1_000_000, Math.round((ovr - 60) * 1_200_000)))
}

export default function ContractExtensionPanel({ playerId }: { playerId: number }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const [gmTeamId, setGmTeamId]   = useState<string | null>(null)
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [player, setPlayer]     = useState<any>(null)
  const [team, setTeam]         = useState<any>(null)
  const [existingOffer, setExistingOffer] = useState<any>(null)
  const [years, setYears]       = useState(3)
  const [offerSalary, setOfferSalary] = useState(0)
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState('')
  const [expanded, setExpanded] = useState(false)
  const [advisor, setAdvisor]   = useState<any>(null)
  const [advisorLoading, setAdvisorLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: gm } = await supabase.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
      if (!gm) return
      setGmTeamId(gm.team_id)
      setIsCommissioner(gm.role === 'commissioner')

      const [{ data: p }, { data: offer }] = await Promise.all([
        supabase.from('players').select('id,name,team_id,age,real_ovr,salary,contract_years').eq('id', playerId).single(),
        supabase.from('contract_extension_offers').select('*').eq('player_id', playerId).eq('season', '2025-26').maybeSingle(),
      ])

      setPlayer(p)
      setExistingOffer(offer)
      if (p) setOfferSalary(p.salary)

      if (p?.team_id) {
        const { data: t2 } = await supabase.from('teams').select('id,cap_used').eq('id', p.team_id).single()
        setTeam(t2)
      }
    })
  }, [playerId])

  if (!player) return null
  const isOwner = gmTeamId === player.team_id
  const authorized = isOwner || isCommissioner
  if (!authorized) return null

  const isEligible = player.contract_years <= ELIGIBLE_YEARS_LEFT
  if (!isEligible) {
    return (
      <div className="flex items-center justify-between px-4 py-3 rounded-xl"
           style={{ marginTop: 16, background: '#f0ece5', border: '1px solid #d4cdc5' }}>
        <div className="text-xs" style={{ color: '#8a8279' }}>
          <i className="ti ti-lock" style={{ marginRight: 4 }}></i>
          {isPT
            ? `Não elegível para extensão — ${player.contract_years} ${player.contract_years===1?'ano':'anos'} restantes (necessário ≤ ${ELIGIBLE_YEARS_LEFT})`
            : `Not eligible for extension — ${player.contract_years} years remaining (${ELIGIBLE_YEARS_LEFT} or fewer required)`}
        </div>
      </div>
    )
  }

  if (existingOffer) {
    const statusColor = existingOffer.status === 'accepted' ? '#15803d' : existingOffer.status === 'rejected' ? '#dc2626' : '#b45309'
    const statusLabel = existingOffer.status === 'accepted'
      ? (isPT ? '✓ Aceite' : '✓ Accepted')
      : existingOffer.status === 'rejected'
      ? (isPT ? '✗ Rejeitado' : '✗ Rejected')
      : (isPT ? '⏳ Pendente' : '⏳ Pending')
    return (
      <div style={{ marginTop: 16, borderRadius: 12, background: '#faf8f5', border: `1px solid ${statusColor}44`, overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-xs" style={{ color: '#5c554e' }}>
            <i className="ti ti-file-text" style={{ marginRight: 4 }}></i>
            {isPT ? 'Proposta de extensão:' : 'Extension offer:'} {fmt(existingOffer.offered_salary)}/yr × {existingOffer.offered_years}yr
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
        </div>
        {existingOffer.status === 'rejected' && existingOffer.rejection_reason && (
          <div style={{ padding: '0 16px 12px', fontSize: 11, color: '#8a8279', fontStyle: 'italic' }}>
            "{existingOffer.rejection_reason}" — {isPT ? 'uma proposta por época, tenta no próximo ano.' : 'one offer per season, try again next year.'}
          </div>
        )}
      </div>
    )
  }

  const capMaxRaise = Math.round(player.salary * (1 + MAX_INCREASE_PCT))
  const capSpace = (180_000_000 - (team?.cap_used || 0)) + player.salary
  const maxAllowed = Math.min(MAX_SALARY, capMaxRaise, capSpace)
  const fairValue = fairValueForOvr(player.real_ovr)

  const fetchAdvisor = async () => {
    setAdvisorLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setAdvisorLoading(false); return }
    const res = await fetch('/api/contracts/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ playerId }),
    })
    const json = await res.json()
    if (res.ok) setAdvisor(json)
    setAdvisorLoading(false)
  }

  const applySuggestion = (s: any) => {
    setOfferSalary(s.salary)
    setYears(s.years)
  }

  const submitOffer = async () => {
    setLoading(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT ? 'Não estás autenticado' : 'Not logged in'); setLoading(false); return }

    const res = await fetch('/api/contracts/extend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ playerId, offeredSalary: offerSalary, offeredYears: years }),
    })
    const json = await res.json()
    if (res.ok) {
      setMsg(json.accepted
        ? (isPT ? `✅ ${player.name} aceitou a extensão!` : `✅ ${player.name} accepted the extension!`)
        : (isPT ? `❌ ${player.name} rejeitou a proposta. ${json.reason || ''}` : `❌ ${player.name} rejected the offer. ${json.reason || ''}`))
      setExistingOffer(json.offer)
    } else {
      setMsg(json.error || (isPT ? 'Erro ao submeter proposta' : 'Error submitting offer'))
    }
    setLoading(false)
  }

  return (
    <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #d4cdc5' }}>
      {/* Collapsed bar */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: '#faf8f5' }}>
        <div className="text-xs" style={{ color: '#5c554e' }}>
          <i className="ti ti-file-text" style={{ marginRight: 4 }}></i>
          {isPT ? 'Elegível para extensão de contrato' : 'Eligible for contract extension'}
          <a href="/rules/contracts" target="_blank" style={{fontSize:11,color:'#1d4ed8',textDecoration:'none',fontWeight:600,marginLeft:10}}>
            {isPT ? 'Ver regras →' : 'View rules →'}
          </a>
        </div>
        {!expanded ? (
          <button onClick={() => setExpanded(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: '#1d4ed8', color: '#fff', border: 'none', cursor: 'pointer' }}>
            📝 {isPT ? 'Propor Extensão' : 'Offer Extension'}
          </button>
        ) : (
          <button onClick={() => setExpanded(false)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: '#f0ece5', color: '#5c554e', border: '1px solid #d4cdc5', cursor: 'pointer' }}>
            {isPT ? 'Fechar' : 'Collapse'}
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '16px', background: '#faf8f5', borderTop: '1px solid #e2dcd5' }}>
          {/* Max salary info */}
          <div style={{ marginBottom:12, padding:'10px 14px', borderRadius:8, background:'#dbeafe', border:'1px solid #93c5fd' }}>
            <div style={{fontSize:11,color:'#1d4ed8',fontWeight:600}}>
              {isPT ? `Salário anual máximo que podes oferecer a ${player.name}:` : `Maximum annual salary you can offer ${player.name}:`}
            </div>
            <div style={{fontSize:20,fontWeight:900,color:'#1d4ed8',marginTop:2}}>
              {fmt(maxAllowed)}
            </div>
            <div style={{fontSize:10,color:'#1d4ed8',marginTop:4,lineHeight:1.5}}>
              {isPT
                ? `Limitado pelo menor de: máximo da liga (${fmt(MAX_SALARY)}) · aumento de +40% (${fmt(capMaxRaise)}) · margem salarial disponível (${fmt(capSpace)})`
                : `Limited by the lowest of: league max (${fmt(MAX_SALARY)}) · +40% raise cap (${fmt(capMaxRaise)}) · your available cap space (${fmt(capSpace)})`}
            </div>
          </div>

          {/* Fair value reference */}
          <div style={{marginBottom:14,fontSize:11,color:'#8a8279'}}>
            {isPT
              ? `Valor justo estimado para um jogador com ${player.real_ovr} OVR: `
              : `Estimated fair value for a ${player.real_ovr} OVR player: `}
            <strong style={{color:'#5c554e'}}>{fmt(fairValue)}</strong>/yr
            {isPT ? ' — propostas muito abaixo deste valor arriscam rejeição.' : ' — offers far below this risk rejection.'}
          </div>

          {/* Agent Advisor */}
          {!advisor ? (
            <button onClick={fetchAdvisor} disabled={advisorLoading}
              style={{
                width:'100%', marginBottom:14, padding:'9px 0', borderRadius:8, fontSize:12, fontWeight:700,
                background:'#ede9fe', color:'#6d28d9', border:'1px solid #c4b5fd',
                cursor: advisorLoading ? 'wait' : 'pointer',
              }}>
              {advisorLoading ? (isPT ? 'A consultar agente...' : 'Consulting agent...') : (isPT ? '🧠 Consultar Conselheiro' : '🧠 Consult Agent Advisor')}
            </button>
          ) : (
            <div style={{marginBottom:16,padding:'12px 14px',borderRadius:10,background:'#f5f3ff',border:'1px solid #c4b5fd'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#6d28d9',marginBottom:6}}>
                🧠 {isPT ? 'Conselheiro' : 'Agent Advisor'} — {player.name}
              </div>
              <div style={{fontSize:11,color:'#5b21b6',marginBottom:10,lineHeight:1.5,fontStyle:'italic'}}>
                {advisor.personalitySummary}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {advisor.suggestions.map((s:any) => {
                  const riskColor = s.risk === 'Low Risk' ? '#15803d' : s.risk === 'Moderate Risk' ? '#b45309' : '#dc2626'
                  return (
                    <div key={s.label} style={{ padding:'10px 12px', borderRadius:8, background:'#fff', border:'1px solid #e2dcd5', display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                          <span style={{fontSize:12,fontWeight:700,color:'#1a1512'}}>{s.label}</span>
                          <span style={{fontSize:10,fontWeight:700,color:riskColor}}>{s.risk}</span>
                        </div>
                        <div style={{fontSize:13,fontWeight:800,color:'#1a1512'}}>
                          {fmt(s.salary)}/yr × {s.years}yr
                        </div>
                        <div style={{fontSize:10,color:'#8a8279',marginTop:2,lineHeight:1.4}}>{s.riskNote}</div>
                        <div style={{fontSize:10,color:'#5c554e',marginTop:3}}>
                          {isPT ? 'Prob. de aceitação: ' : 'Estimated acceptance: '}<strong>{s.acceptChance}%</strong>
                        </div>
                      </div>
                      <button onClick={() => applySuggestion(s)}
                        style={{ fontSize:11, fontWeight:700, padding:'6px 12px', borderRadius:6, background:'#6d28d9', color:'#fff', border:'none', cursor:'pointer', flexShrink:0 }}>
                        {isPT ? 'Usar' : 'Use'}
                      </button>
                    </div>
                  )
                })}
              </div>
              <div style={{fontSize:9,color:'#8a8279',marginTop:8,fontStyle:'italic'}}>
                {isPT ? 'Estimativas apenas — nenhum resultado é garantido.' : 'Estimates only — no outcome is guaranteed.'}
              </div>
            </div>
          )}

          {/* Salary input */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:'#5c554e',display:'block',marginBottom:4}}>
              {isPT ? 'Salário Anual' : 'Annual Salary'}
            </label>
            <input type="range" min={1_000_000} max={maxAllowed} step={100_000}
              value={Math.min(offerSalary, maxAllowed)}
              onChange={e => setOfferSalary(Number(e.target.value))}
              style={{width:'100%'}}/>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8a8279',marginTop:2}}>
              <span>$1.0M</span>
              <span style={{fontWeight:700,color:'#1a1512',fontSize:14}}>{fmt(offerSalary)}</span>
              <span>{fmt(maxAllowed)}</span>
            </div>
          </div>

          {/* Years selector */}
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:600,color:'#5c554e',display:'block',marginBottom:4}}>
              {isPT ? 'Duração do Contrato' : 'Contract Length'}
            </label>
            <div style={{display:'flex',gap:6}}>
              {[1,2,3,4,5].map(y => (
                <button key={y} onClick={() => setYears(y)}
                  style={{ flex:1, padding:'8px 0', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer',
                    border:`1px solid ${years===y?'#1a1512':'#d4cdc5'}`,
                    background: years===y?'#1a1512':'#f0ece5',
                    color: years===y?'#fff':'#5c554e' }}>
                  {y}{isPT?'ano':'yr'}
                </button>
              ))}
            </div>
          </div>

          <button onClick={submitOffer} disabled={loading || offerSalary < 1_000_000}
            style={{ width:'100%', padding:'10px 0', borderRadius:8, fontSize:14, fontWeight:700,
              background:'#1a1512', color:'#faf8f5', border:'none',
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading
              ? (isPT ? 'A submeter...' : 'Submitting...')
              : (isPT ? `Propor Extensão — ${fmt(offerSalary)}/ano × ${years}${years===1?'ano':'anos'}` : `Offer Extension — ${fmt(offerSalary)}/yr × ${years}yr`)}
          </button>

          {msg && (
            <div style={{marginTop:10,fontSize:12,fontWeight:600,color: msg.startsWith('✅') ? '#15803d' : '#dc2626'}}>
              {msg}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

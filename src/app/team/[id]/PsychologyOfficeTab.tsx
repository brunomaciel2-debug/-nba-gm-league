'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import { SLOT_BASE_COST, SLOT_EXTRA_HOURS_COST, NORMAL_TARGET_MORALE, EXTRA_HOURS_TARGET_MORALE, weeklyCost } from '@/lib/psychology-office-constants'

type Slot = { id: string, slot_number: 1 | 2 | 3, player_id: number | null, extra_hours: boolean }
type Player = { id: number, name: string, pos: string, photo_url?: string, moral?: number, [key: string]: any }

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 13, height: 13, borderRadius: '50%', background: '#d4cdc5', color: '#5c554e', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
        style={{ background: '#1a1512', color: '#f5f1eb', width: 210, whiteSpace: 'normal', lineHeight: 1.5, fontWeight: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
        {text}
      </span>
    </span>
  )
}

function moraleColor(m: number): string {
  if (m >= 70) return '#15803d'
  if (m >= 45) return '#b45309'
  return '#dc2626'
}

const fmtMoney = (n: number) => `$${n.toLocaleString()}`

export default function PsychologyOfficeTab({ teamId, teamColor, players, coaches }: {
  teamId: string, teamColor: string, players: Player[], coaches: any[]
}) {
  const { profile } = useAuth()
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [slots, setSlots] = useState<Slot[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [pickingSlot, setPickingSlot] = useState<1 | 2 | 3 | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    (async () => {
      const [{ data: slotData }, { data: finData }] = await Promise.all([
        supabase.from('psychology_slots').select('*').eq('team_id', teamId).order('slot_number'),
        supabase.from('franchise_finances').select('balance').eq('team_id', teamId).single(),
      ])
      // Slots are only created lazily on first assignment — show all 3 as
      // empty placeholders even if no row exists yet for this team.
      const bySlot: Record<number, Slot> = {}
      ;(slotData || []).forEach((s: any) => { bySlot[s.slot_number] = s })
      setSlots([1, 2, 3].map(n => bySlot[n] || { id: '', slot_number: n as 1 | 2 | 3, player_id: null, extra_hours: false }))
      setBalance(finData?.balance ?? null)
      setLoading(false)
    })()
  }, [teamId])

  const mentalCoach = coaches.find((c: any) => c.role === 'mental_coach')
  const playerById: Record<number, Player> = {}
  players.forEach(p => { playerById[p.id] = p })

  const assignedIds = new Set(slots.map(s => s.player_id).filter((id): id is number => id != null))

  const assignPlayer = async (slotNumber: 1 | 2 | 3, playerId: number) => {
    setSaving(true); setMsg('')
    const existing = slots.find(s => s.slot_number === slotNumber)
    if (existing?.id) {
      await supabase.from('psychology_slots').update({ player_id: playerId, extra_hours: false, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('psychology_slots').insert({ team_id: teamId, slot_number: slotNumber, player_id: playerId, extra_hours: false })
    }
    const { data: slotData } = await supabase.from('psychology_slots').select('*').eq('team_id', teamId).order('slot_number')
    const bySlot: Record<number, Slot> = {}
    ;(slotData || []).forEach((s: any) => { bySlot[s.slot_number] = s })
    setSlots([1, 2, 3].map(n => bySlot[n] || { id: '', slot_number: n as 1 | 2 | 3, player_id: null, extra_hours: false }))
    setPickingSlot(null)
    setMsg(isPT ? 'Jogador atribuído!' : 'Player assigned!')
    setSaving(false)
  }

  const clearSlot = async (slot: Slot) => {
    if (!slot.id) return
    setSaving(true)
    await supabase.from('psychology_slots').update({ player_id: null, extra_hours: false, updated_at: new Date().toISOString() }).eq('id', slot.id)
    setSlots(prev => prev.map(s => s.slot_number === slot.slot_number ? { ...s, player_id: null, extra_hours: false } : s))
    setSaving(false)
  }

  const toggleExtraHours = async (slot: Slot) => {
    if (!slot.id) return
    setSaving(true)
    const next = !slot.extra_hours
    await supabase.from('psychology_slots').update({ extra_hours: next, updated_at: new Date().toISOString() }).eq('id', slot.id)
    setSlots(prev => prev.map(s => s.slot_number === slot.slot_number ? { ...s, extra_hours: next } : s))
    setSaving(false)
  }

  if (loading) return <div className="text-center py-8" style={{ color: '#8a8279' }}>{t('common.loading')}</div>

  const occupiedCount = slots.filter(s => s.player_id).length
  const totalWeeklyCost = slots.reduce((sum, s) => sum + (s.player_id ? weeklyCost(s.slot_number, s.extra_hours) : 0), 0)

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: '#faf8f5', border: '1px solid #d4cdc5', color: '#5c554e', lineHeight: 1.6 }}>
        🧠 {isPT
          ? 'Atribui um jogador a uma sessão privada com o Mental Coach para acelerar a recuperação de moral dele, além do que já acontece naturalmente. O jogador fica na sessão até chegar aos 60 de moral (ou 75 com Extra Hours), altura em que a sessão liberta automaticamente. Tem um custo semanal real, deduzido do saldo da equipa.'
          : "Assign a player to private sessions with the Mental Coach to speed up his morale recovery beyond what already happens naturally. The player stays in the session until reaching 60 morale (or 75 with Extra Hours), at which point it automatically frees up. Has a real weekly cost, deducted from the team's balance."}
      </div>

      {isGM && (
        <div className="flex gap-3 mb-4 flex-wrap">
          {[
            { label: isPT ? 'Sessões ativas' : 'Active sessions', val: `${occupiedCount}/3`, hi: occupiedCount > 0 },
            { label: isPT ? 'Custo semanal total' : 'Total weekly cost', val: fmtMoney(totalWeeklyCost), hi: totalWeeklyCost > 0 },
            ...(balance != null ? [{ label: isPT ? 'Saldo da equipa' : 'Team balance', val: fmtMoney(balance), hi: false }] : []),
          ].map(item => (
            <div key={item.label} style={{ background: item.hi ? teamColor + '18' : '#f0ece5', border: `1px solid ${item.hi ? teamColor : '#d4cdc5'}`, borderRadius: 8, padding: '6px 12px' }}>
              <div style={{ fontSize: 10, color: '#8a8279' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: item.hi ? teamColor : '#1a1512' }}>{item.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* MENTAL COACH */}
      <div className="rounded-xl p-4 mb-6" style={{ background: '#e8e2d6', border: '1px solid #d4cdc5' }}>
        {mentalCoach ? (
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-[220px]">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center"
                style={{ background: '#0e749018', border: '2px solid #0e749033' }}>
                {mentalCoach.photo_url ? <img src={mentalCoach.photo_url} alt={mentalCoach.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 16, fontWeight: 800, color: '#0e7490' }}>{mentalCoach.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold mb-0.5" style={{ color: '#0e7490' }}>{isPT ? 'Mental Coach' : 'Mental Coach'}</div>
                <div className="font-bold text-sm mb-2" style={{ color: '#1a1512' }}>{mentalCoach.name}</div>
                <div className="flex flex-col gap-1.5">
                  {[
                    { key: 'morale_management', label: isPT ? 'Gestão de Moral' : 'Morale Mgmt', val: mentalCoach.morale_management, tip: isPT ? 'Determina a velocidade das sessões privadas do Gabinete de Psicologia — e a rapidez com que a moral se aproxima do que "merece" naturalmente.' : 'Drives how fast Psychology Office private sessions work — and how quickly morale naturally drifts toward what it "deserves."' },
                    { key: 'team_cohesion', label: isPT ? 'Coesão' : 'Team Cohesion', val: mentalCoach.team_cohesion, tip: isPT ? 'Reduz a chance real de perdas de bola em jogo, até 20% a menos.' : 'Lowers the real in-game turnover chance, by up to 20%.' },
                    { key: 'composure_coaching', label: isPT ? 'Compostura' : 'Composure', val: mentalCoach.composure_coaching, tip: isPT ? 'Reduz o impacto real da pressão em momentos decisivos do jogo, até 12%.' : 'Lowers the real impact of pressure in decisive game moments, by up to 12%.' },
                  ].map(s => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className="text-xs flex items-center" style={{ color: '#5c554e', width: 110 }}>{s.label}<Tooltip text={s.tip} /></span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#cec7bc' }}>
                        <div className="h-full rounded-full" style={{ width: (s.val || 0) + '%', background: '#0e7490' }} />
                      </div>
                      <span className="text-xs font-bold w-6 text-right flex-shrink-0" style={{ color: '#0e7490' }}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#8a8279' }}>{isPT ? 'Sem Mental Coach contratado — as sessões continuam a funcionar, mas mais devagar.' : 'No Mental Coach hired — sessions still work, just slower.'}</p>
        )}
      </div>

      {/* SLOTS */}
      <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8a8279' }}>
        {isPT ? 'Sessões Privadas' : 'Private Sessions'}
      </h2>
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        {slots.map(slot => {
          const p = slot.player_id ? playerById[slot.player_id] : null
          const baseCost = SLOT_BASE_COST[slot.slot_number]
          const extraCost = SLOT_EXTRA_HOURS_COST[slot.slot_number]
          const cost = weeklyCost(slot.slot_number, slot.extra_hours)
          const target = slot.extra_hours ? EXTRA_HOURS_TARGET_MORALE : NORMAL_TARGET_MORALE
          return (
            <div key={slot.slot_number} className="rounded-xl p-4" style={{ background: '#faf8f5', border: '1px solid #d4cdc5', borderTop: `3px solid ${teamColor}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: teamColor }}>{isPT ? `Slot ${slot.slot_number}` : `Slot ${slot.slot_number}`}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: cost > 0 ? teamColor + '22' : '#dcfce7', color: cost > 0 ? teamColor : '#15803d' }}>
                  {cost > 0 ? `${fmtMoney(cost)}/${isPT ? 'sem' : 'wk'}` : (isPT ? 'Grátis' : 'Free')}
                </span>
              </div>

              {p ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#e8e2d6' }}>
                      {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: '#8a8279' }}>{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: '#1a1512' }}>{p.name}</div>
                      <div className="text-xs" style={{ color: moraleColor(p.moral || 0) }}>{isPT ? 'Moral' : 'Morale'}: {p.moral ?? '—'}/100</div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: '#e2dcd5' }}>
                    <div className="h-full rounded-full" style={{ width: Math.min(100, p.moral || 0) + '%', background: moraleColor(p.moral || 0) }} />
                  </div>
                  <div className="text-xs mb-3" style={{ color: '#8a8279' }}>{isPT ? `Objetivo: ${target} de moral` : `Target: ${target} morale`}</div>

                  {isGM && (
                    <>
                      <label className="flex items-center gap-2 mb-3 text-xs" style={{ color: '#5c554e', cursor: 'pointer' }}>
                        <input type="checkbox" checked={slot.extra_hours} disabled={saving} onChange={() => toggleExtraHours(slot)} />
                        {isPT ? 'Extra Hours' : 'Extra Hours'} <span style={{ color: '#8a8279' }}>(+{fmtMoney(extraCost)}/{isPT ? 'sem' : 'wk'} · {isPT ? 'até 75' : 'to 75'})</span>
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => setPickingSlot(slot.slot_number)} disabled={saving}
                          className="flex-1 text-xs font-semibold py-1.5 rounded-lg" style={{ background: '#e8e2d6', color: '#5c554e' }}>
                          {isPT ? 'Trocar' : 'Change'}
                        </button>
                        <button onClick={() => clearSlot(slot)} disabled={saving}
                          className="text-xs font-semibold py-1.5 px-3 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>
                          {isPT ? 'Remover' : 'Remove'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs mb-3" style={{ color: '#8a8279' }}>{isPT ? 'Vazio — escolhe um jogador.' : 'Empty — choose a player.'}</p>
                  {isGM && (
                    <button onClick={() => setPickingSlot(slot.slot_number)} disabled={saving}
                      className="w-full text-xs font-semibold py-1.5 rounded-lg" style={{ background: teamColor + '18', color: teamColor }}>
                      {isPT ? 'Escolher Jogador' : 'Choose Player'}
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
      {msg && <p className="text-xs font-semibold mb-4" style={{ color: '#15803d' }}>✓ {msg}</p>}

      {/* PLAYER PICKER */}
      {pickingSlot && (
        <div className="rounded-xl overflow-hidden mb-6" style={{ border: `2px solid ${teamColor}` }}>
          <div className="px-4 py-2 flex items-center justify-between" style={{ background: teamColor + '18' }}>
            <span className="text-xs font-bold" style={{ color: teamColor }}>
              {isPT ? `A escolher jogador para o Slot ${pickingSlot}` : `Choosing player for Slot ${pickingSlot}`}
            </span>
            <button onClick={() => setPickingSlot(null)} className="text-xs font-semibold" style={{ color: '#8a8279' }}>{isPT ? 'Cancelar' : 'Cancel'}</button>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {players.map((p, i) => {
              const alreadyAssignedElsewhere = assignedIds.has(p.id)
              return (
                <div key={p.id}
                  onClick={() => !alreadyAssignedElsewhere && !saving && assignPlayer(pickingSlot, p.id)}
                  className="flex items-center gap-3 px-4 py-2"
                  style={{
                    background: i % 2 === 0 ? '#faf8f5' : '#f5f1eb', borderBottom: '1px solid #e2dcd5',
                    cursor: alreadyAssignedElsewhere ? 'not-allowed' : 'pointer', opacity: alreadyAssignedElsewhere ? 0.45 : 1,
                  }}>
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#e8e2d6' }}>
                    {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: '#8a8279' }}>{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>}
                  </div>
                  <span className="text-sm font-semibold flex-1" style={{ color: '#1a1512' }}>{p.name}</span>
                  <span className="text-xs" style={{ background: '#e8e2d8', color: '#3d3731', padding: '1px 6px', borderRadius: 4 }}>{p.pos}</span>
                  <span className="text-xs font-bold w-20 text-right" style={{ color: moraleColor(p.moral || 0) }}>{isPT ? 'Moral' : 'Morale'}: {p.moral ?? '—'}</span>
                  {alreadyAssignedElsewhere && <span className="text-xs" style={{ color: '#8a8279' }}>{isPT ? 'já numa sessão' : 'already in a session'}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* FULL ROSTER MORALE */}
      <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8a8279' }}>
        {isPT ? 'Moral do Plantel' : 'Roster Morale'}
      </h2>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #d4cdc5' }}>
        {players.slice().sort((a, b) => (a.moral ?? 0) - (b.moral ?? 0)).map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-2" style={{ background: i % 2 === 0 ? '#faf8f5' : '#f5f1eb', borderBottom: '1px solid #e2dcd5' }}>
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#e8e2d6' }}>
              {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: '#8a8279' }}>{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>}
            </div>
            <span className="text-sm font-semibold flex-1" style={{ color: '#1a1512' }}>{p.name}</span>
            <span className="text-xs" style={{ background: '#e8e2d8', color: '#3d3731', padding: '1px 6px', borderRadius: 4 }}>{p.pos}</span>
            <div className="flex-1 max-w-[140px] h-1.5 rounded-full overflow-hidden" style={{ background: '#e2dcd5' }}>
              <div className="h-full rounded-full" style={{ width: Math.min(100, p.moral || 0) + '%', background: moraleColor(p.moral || 0) }} />
            </div>
            <span className="text-xs font-bold w-10 text-right" style={{ color: moraleColor(p.moral || 0) }}>{p.moral ?? '—'}</span>
            {assignedIds.has(p.id) && <span className="text-xs" title={isPT ? 'Em sessão privada' : 'In private session'}>🧠</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import { buildComplaintText, buildProgressText, buildResolutionText } from '@/lib/interaction-constants'

const CATEGORY_COLOR: Record<string,string> = {
  playing_time: '#1d4ed8', team_fit: '#7c3aed', contract: '#b45309',
  coaching: '#0e7490', personal: '#c2410c', culture: '#166534',
}

export default function PlayerInteractions({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [rows, setRows] = useState<any[]>([])
  const [playerMap, setPlayerMap] = useState<Record<string,{name:string,photo_url?:string}>>({})
  const [typeMap, setTypeMap] = useState<Record<string,any>>({})
  const [currentWeek, setCurrentWeek] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string|null>(null)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const [{ data: interactions }, { data: types }, { data: cfg }] = await Promise.all([
      supabase.from('player_interactions').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('player_interaction_types').select('*'),
      supabase.from('season_config').select('current_week').eq('id', 1).single(),
    ])
    setRows(interactions || [])
    const tMap: Record<string,any> = {}
    ;(types || []).forEach((t:any) => { tMap[t.reason_key] = t })
    setTypeMap(tMap)
    setCurrentWeek((cfg?.current_week || 0) + 1)

    const playerIds = Array.from(new Set([
      ...(interactions || []).map((i:any) => i.player_id),
      ...(interactions || []).map((i:any) => i.partner_player_id).filter(Boolean),
    ]))
    if (playerIds.length) {
      const { data: players } = await supabase.from('players').select('id,name,photo_url').in('id', playerIds)
      const pMap: Record<string,any> = {}
      ;(players || []).forEach((p:any) => { pMap[p.id] = p })
      setPlayerMap(pMap)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [teamId])

  const respond = async (interactionId: string, choice: 'concede'|'compromise'|'dismiss') => {
    setBusyId(interactionId); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT?'Não estás autenticado':'Not logged in'); setBusyId(null); return }
    const res = await fetch('/api/players/interaction-respond', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ interactionId, choice }),
    })
    const json = await res.json()
    if (res.ok) { setMsg(isPT?'✅ Resposta registada.':'✅ Response recorded.'); await load() }
    else setMsg(json.error || (isPT?'Erro':'Error'))
    setBusyId(null)
  }

  if (loading) return <div className="text-sm p-6 text-center" style={{color:'#8a8279'}}>{t('common.loading')}</div>

  const active = rows.filter(r => r.status !== 'resolved')
  const resolved = rows.filter(r => r.status === 'resolved')

  const RESPONSE_BTNS: { choice:'concede'|'compromise'|'dismiss', labelPT:string, labelEN:string, color:string }[] = [
    { choice:'concede',    labelPT:'Ceder ao Pedido',   labelEN:'Concede',    color:'#15803d' },
    { choice:'compromise', labelPT:'Meio-Termo',        labelEN:'Compromise', color:'#b45309' },
    { choice:'dismiss',    labelPT:'Recusar',           labelEN:'Dismiss',    color:'#dc2626' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black" style={{color:'#1a1512'}}>💬 {isPT?'Interações com Jogadores':'Player Interactions'}</h2>
        {active.length > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{background:'#fee2e2',color:'#dc2626'}}>
            {active.length} {isPT?'em aberto':'open'}
          </span>
        )}
      </div>

      {msg && <div className="mb-3 text-xs font-semibold" style={{color: msg.startsWith('✅')?'#15803d':'#dc2626'}}>{msg}</div>}

      {active.length === 0 && (
        <div className="rounded-xl p-6 text-center mb-6" style={{background:'#e8e2d6',border:'1px solid #d4cdc5'}}>
          <p className="text-sm" style={{color:'#6b5f4e'}}>✅ {isPT?'Sem interações em aberto. O plantel está tranquilo.':'No open interactions. The roster is calm.'}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-8">
        {active.map(row => {
          const player = playerMap[row.player_id]
          const partner = row.partner_player_id ? playerMap[row.partner_player_id] : null
          const type = typeMap[row.reason_key]
          const accent = CATEGORY_COLOR[type?.category] || '#6b5f4e'
          const complaint = buildComplaintText(row.reason_key, isPT?'pt':'en', {
            playerName: player?.name || '...', demandTarget: row.demand_target, baselineValue: row.baseline_value,
            partnerName: partner?.name, deadlineWeek: row.deadline_week,
          })
          return (
            <div key={row.id} className="rounded-xl overflow-hidden" style={{border:'1px solid '+accent+'44'}}>
              <div className="flex items-center gap-3 px-4 py-3" style={{background:accent+'11',borderBottom:'1px solid '+accent+'33'}}>
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0" style={{background:'#cec7bc'}}>
                  {player?.photo_url ? <img src={player.photo_url} alt="" className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:'#6b5f4e'}}>
                        {player?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'?'}
                      </div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{color:'#1a1612'}}>{player?.name||'...'}</div>
                  <div className="text-xs" style={{color:accent}}>{row.status==='monitoring'?(isPT?'A monitorizar':'Monitoring'):(isPT?'Aguarda resposta':'Awaiting response')}</div>
                </div>
              </div>
              <div className="px-4 py-3" style={{background:'#ece7dd'}}>
                <p className="text-sm mb-2" style={{color:'#2a231e',lineHeight:1.6}}>{complaint}</p>
                {row.status === 'monitoring' ? (
                  <div className="text-xs font-semibold px-3 py-2 rounded-lg" style={{background:'#ddd7ca',color:'#3d3731'}}>
                    {buildProgressText(isPT?'pt':'en', row.demand_target, row.current_progress ?? row.baseline_value, row.deadline_week, currentWeek)}
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {RESPONSE_BTNS.map(b => (
                      <button key={b.choice} onClick={()=>respond(row.id, b.choice)} disabled={busyId===row.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                        style={{background:b.color, color:'#fff'}}>
                        {busyId===row.id?'⏳...':(isPT?b.labelPT:b.labelEN)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {resolved.length > 0 && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>
            {isPT?'Histórico':'History'}
          </h3>
          <div className="flex flex-col gap-2">
            {resolved.map(row => {
              const player = playerMap[row.player_id]
              const delta = (row.moral_after ?? 0) - (row.moral_before ?? 0)
              return (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{background:'#f0ece5',border:'1px solid #ddd8d0'}}>
                  <span className="text-xs font-bold flex-1" style={{color:'#3d3731'}}>{player?.name||'...'}</span>
                  <span className="text-xs" style={{color:'#8a8279'}}>{buildResolutionText(isPT?'pt':'en', player?.name||'', row.outcome, delta)}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

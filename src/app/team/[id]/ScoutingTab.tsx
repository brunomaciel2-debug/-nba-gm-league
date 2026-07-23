'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import { TOTAL_ATTRIBUTES } from '@/lib/scouting-constants'

const TIERS_EN = {
  1: { label: 'Tier 1', pointsRequired: 100, revealCount: 6, creditCost: 10, weeklyMaintenance: 0, desc: 'Local scouting network — college games, combine reports' },
  2: { label: 'Tier 2', pointsRequired: 250, revealCount: 14, creditCost: 15, weeklyMaintenance: 15_000, desc: 'Regional travel — in-person workouts, deeper film study' },
  3: { label: 'Tier 3', pointsRequired: 400, revealCount: 24, creditCost: 20, weeklyMaintenance: 40_000, desc: 'International scouting — private workouts, full team of evaluators' },
}
const TIERS_PT = {
  1: { label: 'Nível 1', pointsRequired: 100, revealCount: 6, creditCost: 10, weeklyMaintenance: 0, desc: 'Rede de scouting local — jogos universitários, relatórios de combine' },
  2: { label: 'Nível 2', pointsRequired: 250, revealCount: 14, creditCost: 15, weeklyMaintenance: 15_000, desc: 'Viagens regionais — treinos presenciais, estudo de vídeo mais aprofundado' },
  3: { label: 'Nível 3', pointsRequired: 400, revealCount: 24, creditCost: 20, weeklyMaintenance: 40_000, desc: 'Scouting internacional — treinos privados, equipa completa de avaliadores' },
}

const POS_COLOR: Record<string,string> = { PG:'#1d4ed8', SG:'#6d28d9', SF:'#15803d', PF:'#b45309', C:'#dc2626' }
const POSITIONS = ['All','PG','SG','SF','PF','C']

const ATTR_LABELS_EN: Record<string,string> = {
  three:'3PT', layup:'Layup', dunk:'Dunk', mid:'Mid-Range', ft:'Free Throw',
  siq:'Shot IQ', draw_foul:'Draw Foul', blk:'Block', stl:'Steal',
  idef:'Interior Def', pdef:'Perimeter Def', def_reb:'Def Rebound', off_reb:'Off Rebound',
  stamina:'Stamina', durability:'Durability', speed:'Speed', agility:'Agility', strength:'Strength',
  ball_hdl:'Ball Handle', pass_vis:'Pass Vision', pass_iq:'Pass IQ', assist_role:'Assist Role',
  pressure:'Clutch', consistency:'Consistency', crowd_effect:'Crowd Effect', streaky:'Streaky',
  trash_talk:'Trash Talk', close_shot:'Close Shot', standing_dunk:'Standing Dunk',
}
const ATTR_LABELS_PT: Record<string,string> = {
  three:'3PT', layup:'Bandeja', dunk:'Enterrada', mid:'Média Dist.', ft:'Lance Livre',
  siq:'IQ Lanç.', draw_foul:'Sofrer Falta', blk:'Bloqueio', stl:'Roubo',
  idef:'Def. Interior', pdef:'Def. Perimetral', def_reb:'Ressalto Def', off_reb:'Ressalto Of',
  stamina:'Resistência', durability:'Durabilidade', speed:'Velocidade', agility:'Agilidade', strength:'Força',
  ball_hdl:'Drible', pass_vis:'Visão de Passe', pass_iq:'IQ de Passe', assist_role:'Função Assist.',
  pressure:'Sangue-Frio', consistency:'Consistência', crowd_effect:'Efeito Público', streaky:'Inconstância',
  trash_talk:'Provocação', close_shot:'Lanç. Próximo', standing_dunk:'Ent. Parada',
}
const ALL_ATTRS = Object.keys(ATTR_LABELS_EN)

function fmt(n: number) { return n >= 1_000_000 ? '$'+(n/1_000_000).toFixed(1)+'M' : n > 0 ? '$'+(n/1000).toFixed(0)+'K' : '$0' }
function attrColor(v: number) {
  if (v >= 90) return '#b45309'
  if (v >= 80) return '#15803d'
  if (v >= 70) return '#1d4ed8'
  if (v >= 60) return '#1a1512'
  return '#8a8279'
}

export default function ScoutingTab({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const TIERS = isPT ? TIERS_PT : TIERS_EN
  const ATTR_LABELS = isPT ? ATTR_LABELS_PT : ATTR_LABELS_EN
  const { profile } = useAuth()
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [loading, setLoading] = useState(true)
  const [scout, setScout] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [prospects, setProspects] = useState<any[]>([])
  const [revealedMap, setRevealedMap] = useState<Record<string, Set<string>>>({})
  const [selectedTier, setSelectedTier] = useState<1|2|3|null>(null)
  const [cart, setCart] = useState<{prospectId:string, attribute:string}[]>([])
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState('All')
  const [expandedProspect, setExpandedProspect] = useState<string|null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('coaches').select('*').eq('team_id', teamId).eq('role','scout').maybeSingle(),
      supabase.from('scout_progress').select('*').eq('team_id', teamId).eq('season','2025-26').maybeSingle(),
      supabase.from('prospects').select('id,name,pos,college,photo_url,overall').eq('season','2027').order('name'),
      supabase.from('scouting_reveals').select('prospect_id,attribute_name').eq('team_id', teamId).eq('season','2025-26'),
    ]).then(([{ data: sc }, { data: pr }, { data: prospects }, { data: reveals }]) => {
      setScout(sc)
      setProgress(pr || { points: 0, lifetime_points: 0 })
      setProspects(prospects || [])
      const map: Record<string, Set<string>> = {}
      for (const r of (reveals || [])) {
        if (!map[r.prospect_id]) map[r.prospect_id] = new Set()
        map[r.prospect_id].add(r.attribute_name)
      }
      setRevealedMap(map)
      setLoading(false)
    })
  }, [teamId])

  if (!isGM) return (
    <div style={{padding:40,textAlign:'center',color:'#b0a89e',fontSize:13}}>
      🔒 {isPT ? 'O Scouting é privado, só o GM da franquia o vê.' : 'Scouting is private to the franchise GM.'}
    </div>
  )

  if (loading) return <div style={{color:'#8a8279',padding:20}}>{isPT ? 'A carregar dados de scouting...' : 'Loading scouting data...'}</div>

  const lifetimePoints = progress?.lifetime_points || 0
  const spendablePoints = progress?.points || 0
  const currentTier = lifetimePoints >= 400 ? 3 : lifetimePoints >= 250 ? 2 : lifetimePoints >= 100 ? 1 : 0
  const nextTierInfo = currentTier < 3 ? TIERS[(currentTier + 1) as 1|2|3] : null
  const prevThreshold = currentTier === 0 ? 0 : TIERS[currentTier as 1|2|3].pointsRequired
  const tierProgress = nextTierInfo
    ? Math.min(100, ((lifetimePoints - prevThreshold) / (nextTierInfo.pointsRequired - prevThreshold)) * 100)
    : 100

  const filteredProspects = prospects
    .filter(p => pos === 'All' || p.pos === pos)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  const isRevealed = (prospectId: string, attr: string) => revealedMap[prospectId]?.has(attr) || false

  const toggleCartItem = (prospectId: string, attribute: string) => {
    if (!selectedTier) return
    const exists = cart.some(c => c.prospectId === prospectId && c.attribute === attribute)
    if (exists) {
      setCart(prev => prev.filter(c => !(c.prospectId === prospectId && c.attribute === attribute)))
    } else {
      if (cart.length >= TIERS[selectedTier].revealCount) {
        setMsg(isPT
          ? `O Nível ${selectedTier} permite até ${TIERS[selectedTier].revealCount} revelações por sessão`
          : `Tier ${selectedTier} allows up to ${TIERS[selectedTier].revealCount} reveals per session`)
        return
      }
      setCart(prev => [...prev, { prospectId, attribute }])
    }
  }

  const submitSession = async () => {
    if (!selectedTier || cart.length === 0) return
    setSubmitting(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT ? 'Não estás autenticado' : 'Not logged in'); setSubmitting(false); return }

    const res = await fetch('/api/scouting/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ tier: selectedTier, reveals: cart, teamId }),
    })
    const json = await res.json()
    if (res.ok) {
      setMsg(isPT ? `✅ ${cart.length} atributos revelados!` : `✅ Revealed ${cart.length} attributes!`)
      const newMap = { ...revealedMap }
      for (const c of cart) {
        if (!newMap[c.prospectId]) newMap[c.prospectId] = new Set()
        newMap[c.prospectId].add(c.attribute)
      }
      setRevealedMap(newMap)
      setCart([])
      setSelectedTier(null)
      setProgress((p:any) => ({ ...p, points: (p?.points || 0) - TIERS[selectedTier].creditCost }))
    } else {
      setMsg(`❌ ${json.error}`)
    }
    setSubmitting(false)
  }

  return (
    <div>
      {/* Scout card */}
      {!scout ? (
        <div style={{marginBottom:20,padding:20,borderRadius:12,textAlign:'center',background:'#fef3c7',border:'1px solid #fcd34d'}}>
          <div style={{fontSize:13,fontWeight:600,color:'#b45309'}}>⚠️ {isPT ? 'A tua franquia não tem um Scout. Visita Free Agents → Staff para contratar um.' : "Your franchise doesn't have a Scout. Visit Free Agents → Staff to hire one."}</div>
        </div>
      ) : (
        <div style={{marginBottom:20,padding:20,borderRadius:12,background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:16}}>
            <div>
              <div style={{fontSize:11,color:'#8a8279'}}>{isPT ? 'O Teu Scout' : 'Your Scout'}</div>
              <div style={{fontSize:18,fontWeight:900,color:'#1a1512'}}>{scout.name}</div>
            </div>
            <div style={{display:'flex',gap:16}}>
              {[
                {label: isPT ? 'Avaliação' : 'Evaluation', val: scout.scouting_evaluation},
                {label: isPT ? 'Rede' : 'Network', val: scout.scouting_network},
                {label: isPT ? 'Experiência' : 'Experience', val: scout.scouting_experience},
              ].map(s => (
                <div key={s.label} style={{textAlign:'center'}}>
                  <div style={{fontSize:10,color:'#8a8279'}}>{s.label}</div>
                  <div style={{fontSize:15,fontWeight:700,color:'#1a1512'}}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
              <span style={{color:'#5c554e',fontWeight:600}}>{isPT ? 'Nível Atual' : 'Current Tier'}: {currentTier === 0 ? (isPT ? 'Nenhum' : 'None') : (isPT ? `Nível ${currentTier}` : `Tier ${currentTier}`)}</span>
              {nextTierInfo && <span style={{color:'#8a8279'}}>{lifetimePoints} / {nextTierInfo.pointsRequired} {isPT ? `pts para o Nível ${currentTier+1}` : `pts to Tier ${currentTier+1}`}</span>}
            </div>
            <div style={{height:10,borderRadius:5,background:'#e2dcd5',overflow:'hidden',display:'flex'}}>
              {[1,2,3].map(t => (
                <div key={t} style={{flex:1,position:'relative',borderRight: t<3 ? '2px solid #faf8f5' : 'none'}}>
                  <div style={{
                    height:'100%',
                    width: currentTier >= t ? '100%' : currentTier === t-1 ? `${tierProgress}%` : '0%',
                    background: t===1?'#3b82f6':t===2?'#b45309':'#7c3aed',
                  }}/>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11}}>
            <span style={{color:'#15803d',fontWeight:700}}>💰 {isPT ? `${spendablePoints} créditos disponíveis` : `${spendablePoints} credits available`}</span>
            <span style={{color:'#8a8279'}}>+{Math.round((scout.scouting_evaluation*0.5)+(scout.scouting_experience*0.3)+(scout.scouting_network*0.2))} {isPT ? 'pts/sem. est.' : 'pts/week est.'}</span>
          </div>
        </div>
      )}

      {/* Tier selector */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',marginBottom:8}}>{isPT ? 'Como Funciona o Scouting' : 'How Scouting Works'}</div>
        <div style={{marginBottom:10,padding:'10px 12px',borderRadius:8,background:'#fef3c7',border:'1px solid #fcd34d',fontSize:11,color:'#b45309',lineHeight:1.5}}>
          💡 {isPT
            ? 'Níveis mais altos custam menos por atributo revelado — muitas vezes compensa poupar créditos e esperar por um nível mais alto em vez de gastar cedo. Mas manter o Nível 2/3 tem um custo semanal recorrente de manutenção, cobrado automaticamente do teu saldo.'
            : 'Higher tiers cost less per attribute revealed — it often pays to save credits and wait for a higher tier rather than spending early. But holding Tier 2/3 comes with a recurring weekly maintenance cost, billed automatically from your balance.'}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {([1,2,3] as const).map(t => {
            const info = TIERS[t]
            const unlocked = currentTier >= t
            const isSelected = selectedTier === t
            return (
              <button key={t} disabled={!unlocked}
                onClick={() => { setSelectedTier(isSelected ? null : t); setCart([]) }}
                style={{
                  textAlign:'left', padding:14, borderRadius:12, cursor: unlocked ? 'pointer' : 'not-allowed',
                  background: isSelected ? '#ede9fe' : unlocked ? '#faf8f5' : '#f0ece5',
                  border: `2px solid ${isSelected ? '#7c3aed' : unlocked ? '#d4cdc5' : '#e2dcd5'}`,
                  opacity: unlocked ? 1 : 0.6,
                }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:800,color: unlocked ? '#1a1512' : '#8a8279'}}>{info.label}</span>
                  {!unlocked && <span style={{fontSize:10}}>🔒</span>}
                </div>
                <div style={{fontSize:11,color:'#5c554e',marginBottom:8,lineHeight:1.4}}>{info.desc}</div>
                <div style={{fontSize:11,color:'#5c554e'}}>{isPT ? <>Revela até <strong>{info.revealCount}</strong> atributos</> : <>Reveals up to <strong>{info.revealCount}</strong> attributes</>}</div>
                <div style={{fontSize:11,color:'#5c554e',marginTop:2}}>
                  {isPT ? 'Custo' : 'Cost'}: <strong>{info.creditCost} {isPT ? 'créditos' : 'credits'}</strong> <span style={{color:'#8a8279'}}>({(info.creditCost/info.revealCount).toFixed(1)}/attr)</span>
                </div>
                {info.weeklyMaintenance > 0 && (
                  <div style={{fontSize:11,color:'#b45309',marginTop:4,fontWeight:600}}>
                    🏷️ {fmt(info.weeklyMaintenance)}/{isPT ? 'sem. de manutenção' : 'week upkeep'}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cart status */}
      {selectedTier && (
        <div style={{marginBottom:16,padding:14,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,background:'#ede9fe',border:'1px solid #c4b5fd'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#5b21b6'}}>
            {isPT
              ? `Sessão de ${TIERS[selectedTier].label} — ${cart.length}/${TIERS[selectedTier].revealCount} atributos selecionados`
              : `${TIERS[selectedTier].label} session — ${cart.length}/${TIERS[selectedTier].revealCount} attributes selected`}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={() => { setCart([]); setSelectedTier(null) }}
              style={{fontSize:11,fontWeight:600,padding:'6px 12px',borderRadius:8,border:'1px solid #c4b5fd',background:'#fff',color:'#5b21b6',cursor:'pointer'}}>
              {isPT ? 'Cancelar' : 'Cancel'}
            </button>
            <button onClick={submitSession} disabled={cart.length === 0 || submitting}
              style={{fontSize:11,fontWeight:700,padding:'6px 16px',borderRadius:8,border:'none',background:'#6d28d9',color:'#fff',cursor:'pointer',opacity: cart.length===0?0.5:1}}>
              {submitting
                ? (isPT ? 'A submeter...' : 'Submitting...')
                : (isPT ? `Confirmar Sessão (${TIERS[selectedTier].creditCost} créditos)` : `Confirm Session (${TIERS[selectedTier].creditCost} credits)`)}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{marginBottom:16,padding:12,borderRadius:8,fontSize:13,fontWeight:600,
                     background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#15803d' : '#dc2626'}}>
          {msg}
        </div>
      )}

      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isPT ? 'Procurar prospects...' : 'Search prospects...'}
          style={{flex:1,minWidth:160,padding:'8px 12px',borderRadius:8,fontSize:13,background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {POSITIONS.map(p => (
            <button key={p} onClick={() => setPos(p)}
              style={{fontSize:11,fontWeight:700,padding:'6px 10px',borderRadius:8,cursor:'pointer',
                      background:pos===p?'#1a1512':'#f0ece5',color:pos===p?'#fff':'#5c554e',
                      border:'1px solid '+(pos===p?'#1a1512':'#d4cdc5')}}>
              {p === 'All' ? (isPT ? 'Todas' : 'All') : p}
            </button>
          ))}
        </div>
      </div>

      {/* Prospects list */}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filteredProspects.map(p => {
          const revealed = revealedMap[p.id] || new Set()
          const isExpanded = expandedProspect === p.id
          const pc = POS_COLOR[p.pos] || '#5c554e'
          return (
            <div key={p.id} style={{borderRadius:12,border:'1px solid #d4cdc5',overflow:'hidden'}}>
              <div onClick={() => setExpandedProspect(isExpanded ? null : p.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#faf8f5',cursor:'pointer'}}>
                {p.photo_url
                  ? <img src={p.photo_url} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}}/>
                  : <div style={{width:32,height:32,borderRadius:'50%',background:pc+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:pc}}>
                      {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                    </div>}
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1a1512'}}>{p.name}</div>
                  <div style={{fontSize:11,color:'#8a8279'}}>
                    <span style={{color:pc,fontWeight:600}}>{p.pos}</span> · {p.college || (isPT ? 'Internacional' : 'International')}
                  </div>
                </div>
                <div style={{fontSize:11,fontWeight:600,color: revealed.size === TOTAL_ATTRIBUTES ? '#15803d' : '#8a8279'}}>
                  {revealed.size}/{TOTAL_ATTRIBUTES} {isPT ? 'avaliado' : 'scouted'}
                </div>
                <a href={`/prospect/${p.id}`} onClick={e=>e.stopPropagation()} style={{fontSize:10,color:'#1d4ed8',textDecoration:'none',fontWeight:600}}>
                  {isPT ? 'Ver →' : 'View →'}
                </a>
                <span style={{fontSize:11,color:'#8a8279'}}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {isExpanded && (
                <div style={{padding:'12px 14px',background:'#fff',borderTop:'1px solid #e2dcd5',display:'flex',flexWrap:'wrap',gap:6}}>
                  {ALL_ATTRS.map(attr => {
                    const attrRevealed = isRevealed(p.id, attr)
                    const inCart = cart.some(c => c.prospectId === p.id && c.attribute === attr)
                    return (
                      <button key={attr}
                        disabled={attrRevealed || !selectedTier}
                        onClick={() => toggleCartItem(p.id, attr)}
                        style={{
                          fontSize:11, fontWeight:600, padding:'5px 10px', borderRadius:8,
                          border: `1px solid ${attrRevealed ? '#bbf7d0' : inCart ? '#7c3aed' : '#d4cdc5'}`,
                          background: attrRevealed ? '#f0fdf4' : inCart ? '#ede9fe' : '#f5f1eb',
                          color: attrRevealed ? '#15803d' : inCart ? '#6d28d9' : '#5c554e',
                          cursor: attrRevealed ? 'default' : selectedTier ? 'pointer' : 'not-allowed',
                          opacity: !selectedTier && !attrRevealed ? 0.5 : 1,
                        }}>
                        {ATTR_LABELS[attr]} {attrRevealed && '✓'}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

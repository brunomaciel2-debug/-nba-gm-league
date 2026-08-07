'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import { TOTAL_ATTRIBUTES } from '@/lib/scouting-constants'

// One resettable progress meter, not three separate pools. Crossing a
// tier's pointsRequired makes that tier's revealCount the current
// available credits, replacing (not adding to) whatever the previous tier
// offered. Spending resets the whole meter back to 0.
const TIERS_EN = {
  1: { label: 'Tier 1', pointsRequired: 100, revealCount: 6, weeklyMaintenance: 0, desc: 'Local scouting network — college games, combine reports' },
  2: { label: 'Tier 2', pointsRequired: 250, revealCount: 14, weeklyMaintenance: 15_000, desc: 'Regional travel — in-person workouts, deeper film study' },
  3: { label: 'Tier 3', pointsRequired: 400, revealCount: 24, weeklyMaintenance: 40_000, desc: 'International scouting — private workouts, full team of evaluators' },
}
const TIERS_PT = {
  1: { label: 'Nível 1', pointsRequired: 100, revealCount: 6, weeklyMaintenance: 0, desc: 'Rede de scouting local — jogos universitários, relatórios de combine' },
  2: { label: 'Nível 2', pointsRequired: 250, revealCount: 14, weeklyMaintenance: 15_000, desc: 'Viagens regionais — treinos presenciais, estudo de vídeo mais aprofundado' },
  3: { label: 'Nível 3', pointsRequired: 400, revealCount: 24, weeklyMaintenance: 40_000, desc: 'Scouting internacional — treinos privados, equipa completa de avaliadores' },
}

function getCurrentTier(points: number): 0|1|2|3 {
  if (points >= TIERS_EN[3].pointsRequired) return 3
  if (points >= TIERS_EN[2].pointsRequired) return 2
  if (points >= TIERS_EN[1].pointsRequired) return 1
  return 0
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
  const [cart, setCart] = useState<{prospectId:string, attribute:string}[]>([])
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState('All')
  // A Set (not a single id) so a GM can have several prospects open side by
  // side while distributing credits — opening one used to silently close
  // whichever was already open, making it easy to lose track of who'd
  // already gotten attention.
  const [expandedProspects, setExpandedProspects] = useState<Set<string>>(new Set())
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

  const cyclePoints = progress?.points || 0
  const currentTier = getCurrentTier(cyclePoints)
  const creditsAvailable = currentTier > 0 ? TIERS[currentTier as 1|2|3].revealCount : 0
  const nextTierInfo = currentTier < 3 ? TIERS[(currentTier + 1) as 1|2|3] : null
  const prevThreshold = currentTier === 0 ? 0 : TIERS[currentTier as 1|2|3].pointsRequired
  const tierProgress = nextTierInfo
    ? Math.min(100, ((cyclePoints - prevThreshold) / (nextTierInfo.pointsRequired - prevThreshold)) * 100)
    : 100

  const filteredProspects = prospects
    .filter(p => pos === 'All' || p.pos === pos)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  const isRevealed = (prospectId: string, attr: string) => revealedMap[prospectId]?.has(attr) || false

  const toggleExpanded = (id: string) => {
    setExpandedProspects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleCartItem = (prospectId: string, attribute: string) => {
    if (creditsAvailable === 0) return
    const exists = cart.some(c => c.prospectId === prospectId && c.attribute === attribute)
    if (exists) {
      setCart(prev => prev.filter(c => !(c.prospectId === prospectId && c.attribute === attribute)))
    } else {
      if (cart.length >= creditsAvailable) {
        setMsg(isPT
          ? `Só tens ${creditsAvailable} créditos disponíveis neste momento`
          : `You only have ${creditsAvailable} credits available right now`)
        return
      }
      setCart(prev => [...prev, { prospectId, attribute }])
    }
  }

  const submitSession = async () => {
    if (creditsAvailable === 0 || cart.length === 0) return
    setSubmitting(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg(isPT ? 'Não estás autenticado' : 'Not logged in'); setSubmitting(false); return }

    const res = await fetch('/api/scouting/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ reveals: cart, teamId }),
    })
    const json = await res.json()
    if (res.ok) {
      setMsg(isPT ? `✅ ${cart.length} atributos revelados! Progresso reiniciado.` : `✅ Revealed ${cart.length} attributes! Progress reset.`)
      const newMap = { ...revealedMap }
      for (const c of cart) {
        if (!newMap[c.prospectId]) newMap[c.prospectId] = new Set()
        newMap[c.prospectId].add(c.attribute)
      }
      setRevealedMap(newMap)
      setCart([])
      setProgress((p:any) => ({ ...p, points: 0 }))
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
              {nextTierInfo && <span style={{color:'#8a8279'}}>{cyclePoints} / {nextTierInfo.pointsRequired} {isPT ? `pts para o Nível ${currentTier+1}` : `pts to Tier ${currentTier+1}`}</span>}
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
            <span style={{color: creditsAvailable>0 ? '#15803d' : '#8a8279',fontWeight:700}}>
              💰 {creditsAvailable>0
                ? (isPT ? `${creditsAvailable} créditos disponíveis` : `${creditsAvailable} credits available`)
                : (isPT ? 'Sem créditos disponíveis ainda' : 'No credits available yet')}
            </span>
            <span style={{color:'#8a8279'}}>+{Math.round((scout.scouting_evaluation*0.5)+(scout.scouting_experience*0.3)+(scout.scouting_network*0.2))} {isPT ? 'pts/sem. est.' : 'pts/week est.'}</span>
          </div>
        </div>
      )}

      {/* Tier ladder — informational only, not clickable. Reaching a tier
          REPLACES the previous one's credits, it doesn't add to it, and
          spending resets progress back to the bottom. */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#8a8279',marginBottom:8}}>{isPT ? 'Como Funciona o Scouting' : 'How Scouting Works'}</div>
        <div style={{marginBottom:10,padding:'10px 12px',borderRadius:8,background:'#fef3c7',border:'1px solid #fcd34d',fontSize:11,color:'#b45309',lineHeight:1.5}}>
          💡 {isPT
            ? 'O progresso enche sozinho todas as semanas. Ao atingir um nível, os créditos disponíveis passam a ser os desse nível (não se somam aos anteriores). Podes gastar já ou continuar à espera de um nível maior — mas manter o Nível 2/3 por gastar tem um custo semanal de manutenção. Ao gastares, usa tudo o que tens: o progresso volta sempre a 0 e o que não usares fica perdido.'
            : 'Progress fills on its own every week. Reaching a tier replaces your available credits with that tier\'s amount (it doesn\'t add to the previous one). Spend now or keep waiting for a bigger tier — but holding an unspent Tier 2/3 comes with a weekly maintenance cost. When you spend, use everything you have: progress always resets to 0 and whatever you don\'t use is lost.'}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {([1,2,3] as const).map(t => {
            const info = TIERS[t]
            const isCurrent = currentTier === t
            const reached = currentTier >= t
            return (
              <div key={t}
                style={{
                  textAlign:'left', padding:14, borderRadius:12,
                  background: isCurrent ? '#ede9fe' : '#faf8f5',
                  border: `2px solid ${isCurrent ? '#7c3aed' : '#d4cdc5'}`,
                  opacity: reached ? 1 : 0.7,
                }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:800,color:'#1a1512'}}>{info.label}</span>
                  {isCurrent && <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:10,background:'#7c3aed',color:'#fff'}}>{isPT?'ATUAL':'CURRENT'}</span>}
                </div>
                <div style={{fontSize:11,color:'#5c554e',marginBottom:8,lineHeight:1.4}}>{info.desc}</div>
                <div style={{fontSize:11,color:'#5c554e'}}>{isPT ? <>Dá <strong>{info.revealCount}</strong> créditos</> : <>Gives <strong>{info.revealCount}</strong> credits</>}</div>
                <div style={{fontSize:11,color:'#5c554e',marginTop:2}}>
                  {isPT ? 'Precisa de' : 'Needs'}: <strong>{info.pointsRequired} {isPT ? 'pts' : 'pts'}</strong>
                </div>
                {info.weeklyMaintenance > 0 && (
                  <div style={{fontSize:11,color:'#b45309',marginTop:4,fontWeight:600}}>
                    🏷️ {fmt(info.weeklyMaintenance)}/{isPT ? 'sem. de manutenção' : 'week upkeep'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cart status */}
      {creditsAvailable > 0 && (
        <div style={{marginBottom:16,padding:14,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,background:'#ede9fe',border:'1px solid #c4b5fd'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#5b21b6'}}>
            {isPT
              ? `${cart.length}/${creditsAvailable} atributos selecionados`
              : `${cart.length}/${creditsAvailable} attributes selected`}
            {cart.length > 0 && cart.length < creditsAvailable && (
              <span style={{display:'block',fontSize:11,fontWeight:600,color:'#b45309',marginTop:2}}>
                ⚠️ {isPT ? `Vais desperdiçar ${creditsAvailable - cart.length} créditos não usados` : `You'll waste ${creditsAvailable - cart.length} unused credits`}
              </span>
            )}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={() => setCart([])} disabled={cart.length===0}
              style={{fontSize:11,fontWeight:600,padding:'6px 12px',borderRadius:8,border:'1px solid #c4b5fd',background:'#fff',color:'#5b21b6',cursor:cart.length?'pointer':'not-allowed',opacity:cart.length?1:0.5}}>
              {isPT ? 'Limpar' : 'Clear'}
            </button>
            <button onClick={submitSession} disabled={cart.length === 0 || submitting}
              style={{fontSize:11,fontWeight:700,padding:'6px 16px',borderRadius:8,border:'none',background:'#6d28d9',color:'#fff',cursor:'pointer',opacity: cart.length===0?0.5:1}}>
              {submitting
                ? (isPT ? 'A submeter...' : 'Submitting...')
                : (isPT ? `Confirmar e Gastar Tudo` : `Confirm and Spend Everything`)}
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
          const isExpanded = expandedProspects.has(p.id)
          const pendingCount = cart.filter(c => c.prospectId === p.id).length
          const pc = POS_COLOR[p.pos] || '#5c554e'
          return (
            <div key={p.id} style={{borderRadius:12,border: pendingCount>0 ? '1px solid #c4b5fd' : '1px solid #d4cdc5',overflow:'hidden'}}>
              <div onClick={() => toggleExpanded(p.id)}
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
                {/* Visible even collapsed — the only way today's GM had of
                    telling whether a prospect still had unsaved selections
                    was to reopen every single card and check by eye. */}
                {pendingCount > 0 && (
                  <div style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:10,background:'#ede9fe',color:'#6d28d9',whiteSpace:'nowrap'}}>
                    +{pendingCount} {isPT ? 'por gravar' : 'pending'}
                  </div>
                )}
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
                        disabled={attrRevealed || creditsAvailable === 0}
                        onClick={() => toggleCartItem(p.id, attr)}
                        style={{
                          fontSize:11, fontWeight:600, padding:'5px 10px', borderRadius:8,
                          border: `1px solid ${attrRevealed ? '#bbf7d0' : inCart ? '#7c3aed' : '#d4cdc5'}`,
                          background: attrRevealed ? '#f0fdf4' : inCart ? '#ede9fe' : '#f5f1eb',
                          color: attrRevealed ? '#15803d' : inCart ? '#6d28d9' : '#5c554e',
                          cursor: attrRevealed ? 'default' : creditsAvailable>0 ? 'pointer' : 'not-allowed',
                          opacity: creditsAvailable===0 && !attrRevealed ? 0.5 : 1,
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

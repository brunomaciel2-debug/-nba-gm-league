'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TIERS = {
  1: { label: 'Tier 1', pointsRequired: 100, revealCount: 6, creditCost: 10, moneyCost: 0, desc: 'Local scouting network — college games, combine reports' },
  2: { label: 'Tier 2', pointsRequired: 250, revealCount: 14, creditCost: 35, moneyCost: 150_000, desc: 'Regional travel — in-person workouts, deeper film study' },
  3: { label: 'Tier 3', pointsRequired: 400, revealCount: 24, creditCost: 80, moneyCost: 400_000, desc: 'International scouting — private workouts, full team of evaluators' },
}

const ATTR_LABELS: Record<string,string> = {
  three:'3PT', layup:'Layup', dunk:'Dunk', mid:'Mid-Range', ft:'Free Throw',
  siq:'Shot IQ', draw_foul:'Draw Foul', usage:'Usage', blk:'Block', stl:'Steal',
  idef:'Interior Def', pdef:'Perimeter Def', def_reb:'Def Rebound', off_reb:'Off Rebound',
  stamina:'Stamina', durability:'Durability', speed:'Speed', agility:'Agility', strength:'Strength',
  ball_hdl:'Ball Handle', pass_vis:'Pass Vision', pass_iq:'Pass IQ', assist_role:'Assist Role',
  pressure:'Clutch', consistency:'Consistency', crowd_effect:'Crowd Effect', streaky:'Streaky',
  trash_talk:'Trash Talk', close_shot:'Close Shot', standing_dunk:'Standing Dunk',
}
const ALL_ATTRS = Object.keys(ATTR_LABELS)

function fmt(n: number) { return n >= 1_000_000 ? '$'+(n/1_000_000).toFixed(1)+'M' : n > 0 ? '$'+(n/1000).toFixed(0)+'K' : '$0' }

export default function ScoutingPage() {
  const [loading, setLoading] = useState(true)
  const [teamId, setTeamId] = useState<string|null>(null)
  const [scout, setScout] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [prospects, setProspects] = useState<any[]>([])
  const [revealedMap, setRevealedMap] = useState<Record<string, Set<string>>>({}) // prospectId -> Set(attrs)
  const [selectedTier, setSelectedTier] = useState<1|2|3|null>(null)
  const [cart, setCart] = useState<{prospectId:string, attribute:string}[]>([])
  const [search, setSearch] = useState('')
  const [expandedProspect, setExpandedProspect] = useState<string|null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data: gm } = await supabase.from('gm_profiles').select('team_id').eq('id', user.id).single()
      if (!gm?.team_id) { setLoading(false); return }
      setTeamId(gm.team_id)

      const [{ data: sc }, { data: pr }, { data: prospects }, { data: reveals }] = await Promise.all([
        supabase.from('coaches').select('*').eq('team_id', gm.team_id).eq('role','scout').maybeSingle(),
        supabase.from('scout_progress').select('*').eq('team_id', gm.team_id).eq('season','2025-26').maybeSingle(),
        supabase.from('prospects').select('id,name,pos,college,photo_url,overall').eq('season','2027').order('name'),
        supabase.from('scouting_reveals').select('prospect_id,attribute_name').eq('team_id', gm.team_id).eq('season','2025-26'),
      ])

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
  }, [])

  if (loading) return <div className="p-8 text-center" style={{color:'#5c554e'}}>Loading...</div>
  if (!teamId) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-8 rounded-2xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div className="text-4xl mb-4">🔒</div>
        <div className="text-xl font-black mb-2" style={{color:'#1a1512'}}>GM Access Required</div>
      </div>
    </div>
  )

  const lifetimePoints = progress?.lifetime_points || 0
  const spendablePoints = progress?.points || 0
  const currentTier = lifetimePoints >= 400 ? 3 : lifetimePoints >= 250 ? 2 : lifetimePoints >= 100 ? 1 : 0
  const nextTierInfo = currentTier < 3 ? TIERS[(currentTier + 1) as 1|2|3] : null
  const tierProgress = nextTierInfo
    ? Math.min(100, ((lifetimePoints - (currentTier === 0 ? 0 : TIERS[currentTier as 1|2|3].pointsRequired)) / (nextTierInfo.pointsRequired - (currentTier === 0 ? 0 : TIERS[currentTier as 1|2|3].pointsRequired))) * 100)
    : 100

  const filteredProspects = prospects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  const isRevealed = (prospectId: string, attr: string) => revealedMap[prospectId]?.has(attr) || false

  const toggleCartItem = (prospectId: string, attribute: string) => {
    if (!selectedTier) return
    const exists = cart.some(c => c.prospectId === prospectId && c.attribute === attribute)
    if (exists) {
      setCart(prev => prev.filter(c => !(c.prospectId === prospectId && c.attribute === attribute)))
    } else {
      if (cart.length >= TIERS[selectedTier].revealCount) {
        setMsg(`Tier ${selectedTier} allows up to ${TIERS[selectedTier].revealCount} reveals per session`)
        return
      }
      setCart(prev => [...prev, { prospectId, attribute }])
    }
  }

  const submitSession = async () => {
    if (!selectedTier || cart.length === 0) return
    setSubmitting(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg('Not logged in'); setSubmitting(false); return }

    const res = await fetch('/api/scouting/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ tier: selectedTier, reveals: cart }),
    })
    const json = await res.json()
    if (res.ok) {
      setMsg(`✅ Revealed ${cart.length} attributes!`)
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
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black mb-1" style={{color:'#1a1512'}}>🔍 Scouting</h1>
        <p className="text-sm" style={{color:'#8a8279'}}>
          Evaluate the 2026-27 draft class. Reveal hidden attributes to make informed draft decisions.
        </p>
      </div>

      {/* Scout card */}
      {!scout ? (
        <div className="mb-6 p-5 rounded-xl text-center" style={{background:'#fef3c7',border:'1px solid #fcd34d'}}>
          <div className="text-sm font-semibold" style={{color:'#b45309'}}>⚠️ Your franchise doesn't have a Scout. Visit Free Agents → Staff to hire one.</div>
        </div>
      ) : (
        <div className="mb-6 p-5 rounded-xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <div className="text-xs" style={{color:'#8a8279'}}>Your Scout</div>
              <div className="text-lg font-black" style={{color:'#1a1512'}}>{scout.name}</div>
            </div>
            <div className="flex gap-4">
              {[
                {label:'Evaluation', val: scout.scouting_evaluation},
                {label:'Network', val: scout.scouting_network},
                {label:'Experience', val: scout.scouting_experience},
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-xs" style={{color:'#8a8279'}}>{s.label}</div>
                  <div className="text-base font-bold" style={{color:'#1a1512'}}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier progress bar */}
          <div style={{marginBottom:8}}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span style={{color:'#5c554e',fontWeight:600}}>Current Tier: {currentTier === 0 ? 'None' : `Tier ${currentTier}`}</span>
              {nextTierInfo && <span style={{color:'#8a8279'}}>{lifetimePoints} / {nextTierInfo.pointsRequired} pts to Tier {currentTier+1}</span>}
            </div>
            <div style={{height:10,borderRadius:5,background:'#e2dcd5',overflow:'hidden',display:'flex'}}>
              {[1,2,3].map(t => (
                <div key={t} style={{
                  flex:1, position:'relative', borderRight: t<3 ? '2px solid #faf8f5' : 'none',
                }}>
                  <div style={{
                    height:'100%',
                    width: currentTier >= t ? '100%' : currentTier === t-1 ? `${tierProgress}%` : '0%',
                    background: t===1?'#3b82f6':t===2?'#b45309':'#7c3aed',
                  }}/>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{color:'#15803d',fontWeight:700}}>💰 {spendablePoints} credits available</span>
            <span style={{color:'#8a8279'}}>+{Math.round((scout.scouting_evaluation*0.5)+(scout.scouting_experience*0.3)+(scout.scouting_network*0.2))} pts/week est.</span>
          </div>
        </div>
      )}

      {/* Tier selector / how it works */}
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#8a8279'}}>How Scouting Works</div>
        <div className="grid sm:grid-cols-3 gap-3">
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
                <div className="flex items-center justify-between mb-1">
                  <span style={{fontSize:13,fontWeight:800,color: unlocked ? '#1a1512' : '#8a8279'}}>{info.label}</span>
                  {!unlocked && <span style={{fontSize:10}}>🔒</span>}
                </div>
                <div style={{fontSize:11,color:'#5c554e',marginBottom:8,lineHeight:1.4}}>{info.desc}</div>
                <div style={{fontSize:11,color:'#5c554e'}}>
                  Reveals up to <strong>{info.revealCount}</strong> attributes
                </div>
                <div style={{fontSize:11,color:'#5c554e',marginTop:2}}>
                  Cost: <strong>{info.creditCost} credits</strong>{info.moneyCost > 0 && <> + <strong>{fmt(info.moneyCost)}</strong></>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Cart status */}
      {selectedTier && (
        <div className="mb-4 p-4 rounded-xl flex items-center justify-between flex-wrap gap-3"
             style={{background:'#ede9fe',border:'1px solid #c4b5fd'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#5b21b6'}}>
            {TIERS[selectedTier].label} session — {cart.length}/{TIERS[selectedTier].revealCount} attributes selected
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setCart([]); setSelectedTier(null) }}
              style={{fontSize:11,fontWeight:600,padding:'6px 12px',borderRadius:8,border:'1px solid #c4b5fd',background:'#fff',color:'#5b21b6',cursor:'pointer'}}>
              Cancel
            </button>
            <button onClick={submitSession} disabled={cart.length === 0 || submitting}
              style={{fontSize:11,fontWeight:700,padding:'6px 16px',borderRadius:8,border:'none',background:'#6d28d9',color:'#fff',cursor:'pointer',opacity: cart.length===0?0.5:1}}>
              {submitting ? 'Submitting...' : `Confirm Session (${TIERS[selectedTier].creditCost} credits)`}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div className="mb-4 p-3 rounded-lg text-sm font-semibold"
             style={{background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#15803d' : '#dc2626'}}>
          {msg}
        </div>
      )}

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prospects..."
        className="w-full px-3 py-2 rounded-lg text-sm mb-4"
        style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>

      {/* Prospects list */}
      <div className="flex flex-col gap-2">
        {filteredProspects.map(p => {
          const revealed = revealedMap[p.id] || new Set()
          const isExpanded = expandedProspect === p.id
          return (
            <div key={p.id} style={{borderRadius:12,border:'1px solid #d4cdc5',overflow:'hidden'}}>
              <div onClick={() => setExpandedProspect(isExpanded ? null : p.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#faf8f5',cursor:'pointer'}}>
                {p.photo_url
                  ? <img src={p.photo_url} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}}/>
                  : <div style={{width:32,height:32,borderRadius:'50%',background:'#e2dcd5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#5c554e'}}>
                      {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                    </div>}
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1a1512'}}>{p.name}</div>
                  <div style={{fontSize:11,color:'#8a8279'}}>{p.pos} · {p.college || 'International'}</div>
                </div>
                <div style={{fontSize:11,fontWeight:600,color: revealed.size === 30 ? '#15803d' : '#8a8279'}}>
                  {revealed.size}/30 scouted
                </div>
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

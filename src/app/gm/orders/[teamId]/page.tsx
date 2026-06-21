'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const POSITIONS = ['PG','SG','SF','PF','C']
const SLOTS = [
  { key:'s',  label:'Starter',  color:'#1d4ed8' },
  { key:'b1', label:'1st Sub',  color:'#166534' },
  { key:'b2', label:'2nd Sub',  color:'#6b5f4e' },
]

const BALL_ROLES = [
  { value:'dominant',   label:'Ball Dominant',  desc:'Controls most possessions, primary decision-maker', color:'#c2410c' },
  { value:'balanced',   label:'Balanced',        desc:'Mixes creating for self and others',                color:'#1e40af' },
  { value:'off_ball',   label:'Off-Ball',         desc:'Moves without the ball, spot-up shooter/cutter',   color:'#166534' },
]

const ATK_STYLES = [
  { value:'motion',     label:'Motion Offense',   desc:'Ball movement and player movement - balanced' },
  { value:'pickroll',   label:'Pick & Roll',       desc:'Heavy pick-and-roll usage - creates open looks' },
  { value:'transition', label:'Fast Break',        desc:'Push pace after rebounds and turnovers' },
  { value:'iso',        label:'Isolation',         desc:'Let your best player create 1-on-1' },
  { value:'post',       label:'Post-Up',           desc:'Feed the big man in the low post' },
]

const DEF_STYLES = [
  { value:'man',    label:'Man-to-Man',       desc:'Standard on-ball coverage - most common' },
  { value:'zone23', label:'Zone 2-3',          desc:'Clogs the paint, forces mid-range shots' },
  { value:'press',  label:'Full-Court Press',  desc:'High pressure, creates turnovers but tires players' },
  { value:'pack',   label:'Pack the Paint',    desc:'Collapse on drives, allow perimeter shots' },
]

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex ml-1 cursor-help"
          onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full"
            style={{ background:'#d4cdc5', color:'#1e40af', fontSize:9 }}>i</span>
      {show && (
        <span className="absolute bottom-full left-0 mb-1.5 z-50 px-2.5 py-1.5 rounded-lg text-xs pointer-events-none"
              style={{ background:'#16120d', border:'1px solid #d4cec3', color:'#1a1512',
                       width:200, lineHeight:1.4, whiteSpace:'normal' }}>
          {text}
        </span>
      )}
    </span>
  )
}

export default function GMOrdersPage({ params }: { params: { teamId: string } }) {
  const teamId = params.teamId.toUpperCase()
  const [players, setPlayers] = useState<any[]>([])
  const [team, setTeam] = useState<any>(null)
  const [pris, setPris] = useState(['','',''])
  const [clutch, setClutch] = useState('')
  const [ballRoles, setBallRoles] = useState<Record<string,string>>({})
  const [pace, setPace] = useState(70)
  const [threeRate, setThreeRate] = useState(38)
  const [atkStyle, setAtkStyle] = useState('motion')
  const [defStyle, setDefStyle] = useState('man')
  const [trainIntensity, setTrainIntensity] = useState('normal')
  const [dc, setDc] = useState<Record<string,any>>({
    PG:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    SG:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    SF:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    PF:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    C: {s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
  })
  const [saving, setSaving] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState<boolean|null>(null)
  const router = useRouter()
  const [saved, setSaved] = useState(false)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    // AUTH CHECK — only GM of this team or Commissioner
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setIsAuthorized(false); return }
      const { data: gm } = await supabase.from('gm_profiles').select('team_id, is_commissioner').eq('id', user.id).single()
      if (gm?.is_commissioner || gm?.team_id === teamId) {
        setIsAuthorized(true)
      } else {
        setIsAuthorized(false)
      }
    })

    supabase.from('teams').select('*').eq('id',teamId).single().then(({data})=>data&&setTeam(data))
    supabase.from('players').select('name,pos,usage').eq('team_id',teamId).eq('status','active')
      .order('usage',{ascending:false}).then(({data})=>{ if(data)setPlayers(data) })
    supabase.from('season_config').select('current_week').eq('id',1).single()
      .then(({data:cfg})=>{
        if(!cfg)return
        supabase.from('gm_orders').select('*').eq('team_id',teamId).eq('week_number',cfg.current_week+1).single()
          .then(({data:ord})=>{
            if(!ord)return
            setPris([ord.priority_1||'',ord.priority_2||'',ord.priority_3||''])
            setClutch(ord.clutch_player||'')
            setPace(ord.pace||70); setThreeRate(ord.three_rate||38)
            setAtkStyle(ord.atk_style||'motion'); setDefStyle(ord.def_style||'man')
            if(ord.depth_chart)setDc(ord.depth_chart as any)
            if(ord.depth_chart?.ball_roles)setBallRoles(ord.depth_chart.ball_roles)
            setTrainIntensity(ord.training_intensity||'normal')
            setLocked(ord.locked||false)
          })
      })
  }, [teamId])

  const save = async () => {
    if(locked)return
    setSaving(true)
    const {data:cfg}=await supabase.from('season_config').select('current_week').eq('id',1).single()
    const week=(cfg?.current_week||0)+1
    await supabase.from('gm_orders').upsert({
      team_id:teamId, week_number:week,
      priority_1:pris[0], priority_2:pris[1], priority_3:pris[2],
      clutch_player:clutch, pace, three_rate:threeRate,
      atk_style:atkStyle, def_style:defStyle,
      depth_chart:{...dc, ball_roles:ballRoles},
      training_intensity:trainIntensity,
    },{onConflict:'team_id,week_number'})
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  const posTot = (pos:string) => {
    const p=dc[pos]||{}
    return (parseInt(p.s?.mins)||0)+(parseInt(p.b1?.mins)||0)+(parseInt(p.b2?.mins)||0)
  }

  // AUTH GUARDS — must be before return
  if (isAuthorized === null) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{color:'#5c554e',textAlign:'center'}}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>Verifying access...</div>
      </div>
    </div>
  )

  if (isAuthorized === false) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{textAlign:'center',padding:40,borderRadius:16,background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div style={{fontSize:40,marginBottom:16}}>🔒</div>
        <div style={{fontSize:22,fontWeight:900,marginBottom:8,color:'#1a1512'}}>Access Denied</div>
        <div style={{fontSize:14,marginBottom:20,color:'#5c554e'}}>Only the GM of this team or the Commissioner can access this page.</div>
        <a href="/" style={{fontSize:14,fontWeight:700,padding:'10px 24px',borderRadius:8,background:'#1a1512',color:'#fff',textDecoration:'none'}}>Go Home</a>
      </div>
    </div>
  )

  const teamColor = team ? '#'+team.color : '#1d4ed8'

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {team?.logo_url && <img src={team.logo_url} alt="" className="w-12 h-12 object-contain" />}
        <div>
          <h1 className="text-2xl font-bold text-white">Weekly Orders - {team?.name||teamId}</h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>Deadline: Sunday 23:59 Lisbon time</p>
        </div>
        {locked && <span className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={{background:'#fee2e2',color:'#dc2626'}}>⚠️ Locked</span>}
      </div>

      {/* DEPTH CHART */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>
        Depth Chart
        <InfoTip text="Assign players to positions and set their minutes. Each position must total exactly 48 minutes." />
      </h2>
      <div className="flex flex-col gap-3 mb-8">
        {POSITIONS.map(pos => {
          const tot=posTot(pos), ok=tot===48
          return (
            <div key={pos} className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cec3'}}>
              <div className="flex items-center gap-3 px-4 py-2" style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
                <span className="font-bold text-sm w-8" style={{color:teamColor}}>{pos}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'#cec7bc'}}>
                  <div className="h-full rounded-full transition-all"
                       style={{width:Math.min(100,tot/48*100)+'%',
                               background:ok?'#15803d':tot>48?'#dc2626':'#b45309'}}></div>
                </div>
                <span className="text-xs font-semibold" style={{color:ok?'#15803d':tot>48?'#dc2626':'#b45309'}}>{tot}/48</span>
              </div>
              <div className="grid grid-cols-3">
                {SLOTS.map(({key,label,color},si) => {
                  const entry=dc[pos]?.[key]||{name:'',mins:0}
                  return (
                    <div key={key} className="p-3" style={{borderRight:si<2?'1px solid #3a3228':'none'}}>
                      <div className="text-xs font-semibold mb-2" style={{color}}>{label}</div>
                      <select value={entry.name}
                              onChange={e=>setDc(d=>({...d,[pos]:{...d[pos],[key]:{...d[pos]?.[key],name:e.target.value}}}))}
                              className="w-full text-xs px-2 py-1.5 rounded mb-2"
                              style={{background:'#ddd7ca',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}}>
                        <option value="">-- None --</option>
                        {players.map(p=><option key={p.name} value={p.name}>{p.name} ({p.pos})</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max="48" value={entry.mins||0}
                               onChange={e=>setDc(d=>({...d,[pos]:{...d[pos],[key]:{...d[pos]?.[key],mins:parseInt(e.target.value)||0}}}))}
                               className="w-16 text-xs px-2 py-1 rounded text-center"
                               style={{background:'#ddd7ca',border:'1px solid #d4cec3',color:'#e8e2d6',outline:'none'}} />
                        <span className="text-xs" style={{color:'#6b5f4e'}}>min</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* BALL ROLES */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color:'#6b5f4e'}}>
        Ball Role per Player
        <InfoTip text="Defines each player's role with the ball. Ball Dominant = primary decision-maker who controls the possession outcome. Balanced = mixes creating for self and others. Off-Ball = moves without the ball, finishes plays." />
      </h2>
      <p className="text-xs mb-3" style={{color:'#9c8e7a'}}>
        Different from offensive priority - this defines <em>how</em> each player uses the ball, not who gets it first.
      </p>
      <div className="rounded-xl overflow-hidden mb-8" style={{border:'1px solid #d4cec3'}}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
              <th className="px-4 py-2 text-left font-semibold" style={{color:'#6b5f4e'}}>Player</th>
              <th className="px-4 py-2 text-left font-semibold" style={{color:'#6b5f4e'}}>Ball Role</th>
              <th className="px-4 py-2 text-left font-semibold" style={{color:'#6b5f4e'}}>Description</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p,i) => {
              const role = ballRoles[p.name] || 'balanced'
              const roleInfo = BALL_ROLES.find(r=>r.value===role)||BALL_ROLES[1]
              return (
                <tr key={p.name} style={{background:i%2===0?'#ece7dd':'#e8e2d6',borderBottom:'1px solid #16120d'}}>
                  <td className="px-4 py-2.5 font-semibold text-white">{p.name}
                    <span className="ml-2 text-xs" style={{color:'#6b5f4e'}}>{p.pos}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <select value={role}
                            onChange={e=>setBallRoles(r=>({...r,[p.name]:e.target.value}))}
                            className="text-xs px-2 py-1 rounded font-semibold"
                            style={{background:roleInfo.color+'22',border:'1px solid '+roleInfo.color+'44',
                                    color:roleInfo.color,outline:'none'}}>
                      {BALL_ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5" style={{color:'#6b5f4e'}}>{roleInfo.desc}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* OFFENSIVE PRIORITIES */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color:'#6b5f4e'}}>
        Offensive Priorities
        <InfoTip text="Who receives the ball in a scoring situation. 1st Option gets the ball most often in half-court sets. This is about finalization - not ball control." />
      </h2>
      <p className="text-xs mb-3" style={{color:'#9c8e7a'}}>Who finishes plays - gets the ball in scoring position.</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0,1,2].map(i=>(
          <div key={i}>
            <label className="text-xs mb-1 block font-semibold"
                   style={{color:i===0?'#b45309':i===1?'#1d4ed8':'#5c554e'}}>
              {i===0?'1st Option':i===1?'2nd Option':'3rd Option'}
            </label>
            <select value={pris[i]} onChange={e=>{const n=[...pris];n[i]=e.target.value;setPris(n)}}
              className="w-full text-xs px-3 py-2 rounded-lg"
              style={{background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}}>
              <option value="">--</option>
              {players.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* TACTICS */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>Tactics</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            Clutch Player
            <InfoTip text="Gets the ball in the final 2 minutes of a close game (<=5 points difference)." />
          </label>
          <select value={clutch} onChange={e=>setClutch(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}}>
            <option value="">--</option>
            {players.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            Pace - {pace}
            <InfoTip text="How fast your team plays. High pace = more possessions per game, faster transitions. Low pace = slower, more controlled half-court offense." />
          </label>
          <input type="range" min="50" max="100" value={pace} onChange={e=>setPace(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs mt-0.5" style={{color:'#9c8e7a'}}>
            <span>Slow</span><span>Fast</span>
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            Three-Point Rate - {threeRate}%
            <InfoTip text="Percentage of possessions that end in a 3PT attempt. NBA average is ~38%. High = more 3s, more variance. Low = more 2PT and post play." />
          </label>
          <input type="range" min="0" max="80" value={threeRate} onChange={e=>setThreeRate(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs mt-0.5" style={{color:'#9c8e7a'}}>
            <span>Post-heavy</span><span>3PT-heavy</span>
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            Attack Style
            <InfoTip text="How your team generates offense in half-court situations." />
          </label>
          <select value={atkStyle} onChange={e=>setAtkStyle(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}}>
            {ATK_STYLES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <p className="text-xs mt-1" style={{color:'#9c8e7a'}}>
            {ATK_STYLES.find(s=>s.value===atkStyle)?.desc}
          </p>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            Defense Style
            <InfoTip text="How your team defends on the half-court." />
          </label>
          <select value={defStyle} onChange={e=>setDefStyle(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}}>
            {DEF_STYLES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <p className="text-xs mt-1" style={{color:'#9c8e7a'}}>
            {DEF_STYLES.find(s=>s.value===defStyle)?.desc}
          </p>
        </div>
      </div>

      {/* TRAINING INTENSITY */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3 mt-6" style={{color:'#506070'}}>
        Training Intensity
        <InfoTip text="Sets how hard the team trains during recovery days. Intense training = less health recovery. Rest = more recovery but less preparation." />
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
        {[
          {value:'rest',        label:'Rest',         desc:'Max recovery. +150% health regen.',    color:'#166534'},
          {value:'light',       label:'Light',        desc:'+25% health regen. Low risk.',          color:'#a0e040'},
          {value:'normal',      label:'Normal',       desc:'Standard training. Full regen.',        color:'#1e40af'},
          {value:'intense',     label:'Intense',      desc:'-50% health regen. Higher performance readiness.', color:'#c2410c'},
          {value:'very_intense',label:'Max Load',     desc:'-75% health regen. Injury risk.',      color:'#dc2626'},
        ].map(t=>(
          <button key={t.value} onClick={()=>setTrainIntensity(t.value)}
            className="rounded-xl p-3 text-center transition-all"
            style={{background:trainIntensity===t.value?t.color+'22':'#0f1e33',
                    border:'1px solid '+(trainIntensity===t.value?t.color:'#1e3a5f'),
                    opacity:locked?0.5:1}}>
            <div className="text-xs font-semibold" style={{color:trainIntensity===t.value?t.color:'#c0ccd8'}}>
              {t.label}
            </div>
            <div className="text-xs mt-1" style={{color:'#506070'}}>{t.desc}</div>
          </button>
        ))}
      </div>

      <button onClick={save} disabled={saving||locked}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-colors"
        style={{background:saved?'#0a5a20':locked?'#1a0a0a':'#d4cdc5',
                color:saved?'#15803d':locked?'#5c554e':'#1d4ed8'}}>
        {saving?'Saving...':saved?'✔ Orders Saved!':locked?'⚠️ Locked for this week':'Save Weekly Orders'}
      </button>
    </div>
  )
}

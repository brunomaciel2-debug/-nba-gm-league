'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const POSITIONS = ['PG','SG','SF','PF','C']
const SLOTS = [
  { key:'s',  label:'Starter',  color:'#3a8adf' },
  { key:'b1', label:'1st Sub',  color:'#40e080' },
  { key:'b2', label:'2nd Sub',  color:'#7090b0' },
]

const BALL_ROLES = [
  { value:'dominant',   label:'Ball Dominant',  desc:'Controls most possessions, primary decision-maker', color:'#ffa040' },
  { value:'balanced',   label:'Balanced',        desc:'Mixes creating for self and others',                color:'#60a0ff' },
  { value:'off_ball',   label:'Off-Ball',         desc:'Moves without the ball, spot-up shooter/cutter',   color:'#40e080' },
]

const ATK_STYLES = [
  { value:'motion',     label:'Motion Offense',   desc:'Ball movement and player movement — balanced' },
  { value:'pickroll',   label:'Pick & Roll',       desc:'Heavy pick-and-roll usage — creates open looks' },
  { value:'transition', label:'Fast Break',        desc:'Push pace after rebounds and turnovers' },
  { value:'iso',        label:'Isolation',         desc:'Let your best player create 1-on-1' },
  { value:'post',       label:'Post-Up',           desc:'Feed the big man in the low post' },
]

const DEF_STYLES = [
  { value:'man',    label:'Man-to-Man',       desc:'Standard on-ball coverage — most common' },
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
            style={{ background:'#1e3a5f', color:'#60a0ff', fontSize:9 }}>i</span>
      {show && (
        <span className="absolute bottom-full left-0 mb-1.5 z-50 px-2.5 py-1.5 rounded-lg text-xs pointer-events-none"
              style={{ background:'#0a1628', border:'1px solid #1e3a5f', color:'#c0ccd8',
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
  const [ballRoles, setBallRoles] = useState<Record<string,string>>({}) // name -> role
  const [pace, setPace] = useState(70)
  const [threeRate, setThreeRate] = useState(38)
  const [atkStyle, setAtkStyle] = useState('motion')
  const [defStyle, setDefStyle] = useState('man')
  const [dc, setDc] = useState<Record<string,any>>({
    PG:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    SG:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    SF:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    PF:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    C: {s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
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
    },{onConflict:'team_id,week_number'})
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  const posTot = (pos:string) => {
    const p=dc[pos]||{}
    return (parseInt(p.s?.mins)||0)+(parseInt(p.b1?.mins)||0)+(parseInt(p.b2?.mins)||0)
  }

  const teamColor = team ? '#'+team.color : '#3a8adf'

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {team?.logo_url && <img src={team.logo_url} alt="" className="w-12 h-12 object-contain" />}
        <div>
          <h1 className="text-2xl font-bold text-white">Weekly Orders — {team?.name||teamId}</h1>
          <p className="text-sm" style={{color:'#7090b0'}}>Deadline: Sunday 23:59 Lisbon time</p>
        </div>
        {locked && <span className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={{background:'#2a0a0a',color:'#e04040'}}>⚠️ Locked</span>}
      </div>

      {/* ── DEPTH CHART ─────────────────────────────── */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#506070'}}>
        Depth Chart
        <InfoTip text="Assign players to positions and set their minutes. Each position must total exactly 48 minutes." />
      </h2>
      <div className="flex flex-col gap-3 mb-8">
        {POSITIONS.map(pos => {
          const tot=posTot(pos), ok=tot===48
          return (
            <div key={pos} className="rounded-xl overflow-hidden" style={{border:'1px solid #1e3a5f'}}>
              <div className="flex items-center gap-3 px-4 py-2" style={{background:'#060c18',borderBottom:'1px solid #1e3a5f'}}>
                <span className="font-bold text-sm w-8" style={{color:teamColor}}>{pos}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'#1e3a5f'}}>
                  <div className="h-full rounded-full transition-all"
                       style={{width:Math.min(100,tot/48*100)+'%',
                               background:ok?'#40e080':tot>48?'#e04040':'#ffa040'}}></div>
                </div>
                <span className="text-xs font-semibold" style={{color:ok?'#40e080':tot>48?'#e04040':'#ffa040'}}>{tot}/48</span>
              </div>
              <div className="grid grid-cols-3">
                {SLOTS.map(({key,label,color},si) => {
                  const entry=dc[pos]?.[key]||{name:'',mins:0}
                  return (
                    <div key={key} className="p-3" style={{borderRight:si<2?'1px solid #1e3a5f':'none'}}>
                      <div className="text-xs font-semibold mb-2" style={{color}}>{label}</div>
                      <select value={entry.name}
                              onChange={e=>setDc(d=>({...d,[pos]:{...d[pos],[key]:{...d[pos]?.[key],name:e.target.value}}}))}
                              className="w-full text-xs px-2 py-1.5 rounded mb-2"
                              style={{background:'#060c18',border:'1px solid #1e3a5f',color:'#c0ccd8',outline:'none'}}>
                        <option value="">— None —</option>
                        {players.map(p=><option key={p.name} value={p.name}>{p.name} ({p.pos})</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max="48" value={entry.mins||0}
                               onChange={e=>setDc(d=>({...d,[pos]:{...d[pos],[key]:{...d[pos]?.[key],mins:parseInt(e.target.value)||0}}}))}
                               className="w-16 text-xs px-2 py-1 rounded text-center"
                               style={{background:'#060c18',border:'1px solid #1e3a5f',color:'#fff',outline:'none'}} />
                        <span className="text-xs" style={{color:'#506070'}}>min</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── BALL ROLES ──────────────────────────────── */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color:'#506070'}}>
        Ball Role per Player
        <InfoTip text="Defines each player's role with the ball. Ball Dominant = primary decision-maker who controls the possession outcome. Balanced = mixes creating for self and others. Off-Ball = moves without the ball, finishes plays." />
      </h2>
      <p className="text-xs mb-3" style={{color:'#405060'}}>
        Different from offensive priority — this defines <em>how</em> each player uses the ball, not who gets it first.
      </p>
      <div className="rounded-xl overflow-hidden mb-8" style={{border:'1px solid #1e3a5f'}}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{background:'#060c18',borderBottom:'1px solid #1e3a5f'}}>
              <th className="px-4 py-2 text-left font-semibold" style={{color:'#7090b0'}}>Player</th>
              <th className="px-4 py-2 text-left font-semibold" style={{color:'#7090b0'}}>Ball Role</th>
              <th className="px-4 py-2 text-left font-semibold" style={{color:'#506070'}}>Description</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p,i) => {
              const role = ballRoles[p.name] || 'balanced'
              const roleInfo = BALL_ROLES.find(r=>r.value===role)||BALL_ROLES[1]
              return (
                <tr key={p.name} style={{background:i%2===0?'#0f1e33':'#0c1a2c',borderBottom:'1px solid #0a1628'}}>
                  <td className="px-4 py-2.5 font-semibold text-white">{p.name}
                    <span className="ml-2 text-xs" style={{color:'#506070'}}>{p.pos}</span>
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
                  <td className="px-4 py-2.5" style={{color:'#506070'}}>{roleInfo.desc}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── OFFENSIVE PRIORITIES ─────────────────────── */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color:'#506070'}}>
        Offensive Priorities
        <InfoTip text="Who receives the ball in a scoring situation. 1st Option gets the ball most often in half-court sets. This is about finalization — not ball control." />
      </h2>
      <p className="text-xs mb-3" style={{color:'#405060'}}>Who finishes plays — gets the ball in scoring position.</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0,1,2].map(i=>(
          <div key={i}>
            <label className="text-xs mb-1 block font-semibold"
                   style={{color:i===0?'#ffa040':i===1?'#60a0ff':'#7090b0'}}>
              {i===0?'1st Option':i===1?'2nd Option':'3rd Option'}
            </label>
            <select value={pris[i]} onChange={e=>{const n=[...pris];n[i]=e.target.value;setPris(n)}}
              className="w-full text-xs px-3 py-2 rounded-lg"
              style={{background:'#0f1e33',border:'1px solid #1e3a5f',color:'#c0ccd8',outline:'none'}}>
              <option value="">—</option>
              {players.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* ── TACTICS ──────────────────────────────────── */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#506070'}}>Tactics</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#7090b0'}}>
            Clutch Player
            <InfoTip text="Gets the ball in the final 2 minutes of a close game (≤5 points difference)." />
          </label>
          <select value={clutch} onChange={e=>setClutch(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#0f1e33',border:'1px solid #1e3a5f',color:'#c0ccd8',outline:'none'}}>
            <option value="">—</option>
            {players.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#7090b0'}}>
            Pace — {pace}
            <InfoTip text="How fast your team plays. High pace = more possessions per game, faster transitions. Low pace = slower, more controlled half-court offense." />
          </label>
          <input type="range" min="50" max="100" value={pace} onChange={e=>setPace(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs mt-0.5" style={{color:'#405060'}}>
            <span>Slow</span><span>Fast</span>
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#7090b0'}}>
            Three-Point Rate — {threeRate}%
            <InfoTip text="Percentage of possessions that end in a 3PT attempt. NBA average is ~38%. High = more 3s, more variance. Low = more 2PT and post play." />
          </label>
          <input type="range" min="0" max="80" value={threeRate} onChange={e=>setThreeRate(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs mt-0.5" style={{color:'#405060'}}>
            <span>Post-heavy</span><span>3PT-heavy</span>
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#7090b0'}}>
            Attack Style
            <InfoTip text="How your team generates offense in half-court situations." />
          </label>
          <select value={atkStyle} onChange={e=>setAtkStyle(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#0f1e33',border:'1px solid #1e3a5f',color:'#c0ccd8',outline:'none'}}>
            {ATK_STYLES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <p className="text-xs mt-1" style={{color:'#405060'}}>
            {ATK_STYLES.find(s=>s.value===atkStyle)?.desc}
          </p>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#7090b0'}}>
            Defense Style
            <InfoTip text="How your team defends on the half-court." />
          </label>
          <select value={defStyle} onChange={e=>setDefStyle(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#0f1e33',border:'1px solid #1e3a5f',color:'#c0ccd8',outline:'none'}}>
            {DEF_STYLES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <p className="text-xs mt-1" style={{color:'#405060'}}>
            {DEF_STYLES.find(s=>s.value===defStyle)?.desc}
          </p>
        </div>
      </div>

      <button onClick={save} disabled={saving||locked}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-colors"
        style={{background:saved?'#0a5a20':locked?'#1a0a0a':'#1e3a5f',
                color:saved?'#40e080':locked?'#506070':'#60a0ff'}}>
        {saving?'Saving...':saved?'✓ Orders Saved!':locked?'⚠️ Locked for this week':'Save Weekly Orders'}
      </button>
    </div>
  )
}

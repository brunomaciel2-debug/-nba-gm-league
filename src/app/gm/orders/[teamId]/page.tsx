'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const POSITIONS = ['PG','SG','SF','PF','C']
const SLOTS = [{key:'s',label:'Starter'},{key:'b1',label:'1st Sub'},{key:'b2',label:'2nd Sub'}]

export default function GMOrdersPage({ params }: { params: { teamId: string }}) {
  const teamId = params.teamId.toUpperCase()
  const [players, setPlayers] = useState<any[]>([])
  const [pris, setPris] = useState(['','',''])
  const [clutch, setClutch] = useState('')
  const [pace, setPace] = useState(70)
  const [threeRate, setThreeRate] = useState(38)
  const [atkStyle, setAtkStyle] = useState('motion')
  const [defStyle, setDefStyle] = useState('man')
  const [dc, setDc] = useState<Record<string,any>>({PG:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},SG:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},SF:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},PF:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},C:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}}})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    supabase.from('players').select('name,pos').eq('team_id',teamId).eq('status','active').order('usage',{ascending:false})
      .then(({data})=>{ if(data)setPlayers(data) })
    supabase.from('season_config').select('current_week').eq('id',1).single()
      .then(({data:cfg})=>{
        if(!cfg)return
        supabase.from('gm_orders').select('*').eq('team_id',teamId).eq('week_number',cfg.current_week+1).single()
          .then(({data:ord})=>{
            if(!ord)return
            setPris([ord.priority_1||'',ord.priority_2||'',ord.priority_3||''])
            setClutch(ord.clutch_player||'')
            setPace(ord.pace||70);setThreeRate(ord.three_rate||38)
            setAtkStyle(ord.atk_style||'motion');setDefStyle(ord.def_style||'man')
            if(ord.depth_chart)setDc(ord.depth_chart as any)
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
      atk_style:atkStyle, def_style:defStyle, depth_chart:dc,
    },{onConflict:'team_id,week_number'})
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),2000)
  }

  const posTot=(pos:string)=>{const p=dc[pos]||{};return (parseInt(p.s?.mins)||0)+(parseInt(p.b1?.mins)||0)+(parseInt(p.b2?.mins)||0)}

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">Weekly Orders — {teamId}</h1>
      {locked && <div className="px-4 py-2 rounded-lg text-sm mb-4 font-semibold" style={{background:'#2a0a0a',color:'#e04040'}}>⚠️ Orders are locked for this week. Changes will apply next week.</div>}

      {/* DEPTH CHART */}
      <h2 className="text-sm font-semibold uppercase tracking-widest mb-3 mt-6" style={{color:'#506070'}}>Depth Chart (48 min per position)</h2>
      <div className="flex flex-col gap-3 mb-6">
        {POSITIONS.map(pos=>{
          const tot=posTot(pos)
          const ok=tot===48
          return(
          <div key={pos} className="rounded-xl overflow-hidden" style={{border:'1px solid #1e3a5f'}}>
            <div className="flex items-center gap-3 px-4 py-2" style={{background:'#060c18',borderBottom:'1px solid #1e3a5f'}}>
              <span className="font-bold text-sm" style={{color:'#60a0ff',minWidth:30}}>{pos}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'#1e3a5f'}}>
                <div className="h-full rounded-full transition-all" style={{width:Math.min(100,tot/48*100)+'%',background:ok?'#40e080':tot>48?'#e04040':'#ffa040'}}></div>
              </div>
              <span className="text-xs font-semibold" style={{color:ok?'#40e080':tot>48?'#e04040':'#ffa040'}}>{tot}/48</span>
            </div>
            <div className="grid grid-cols-3">
              {SLOTS.map(({key,label},si)=>{
                const entry=dc[pos]?.[key]||{name:'',mins:0}
                return(
                <div key={key} className="p-3" style={{borderRight:si<2?'1px solid #1e3a5f':'none'}}>
                  <div className="text-xs font-semibold mb-2" style={{color:si===0?'#3a8adf':si===1?'#40e080':'#7090b0'}}>{label}</div>
                  <select value={entry.name} onChange={e=>{const n=e.target.value;setDc(d=>({...d,[pos]:{...d[pos],[key]:{...d[pos]?.[key],name:n}}}))}}
                    className="w-full text-xs px-2 py-1.5 rounded mb-2"
                    style={{background:'#060c18',border:'1px solid #1e3a5f',color:'#c0ccd8',outline:'none'}}>
                    <option value="">— None —</option>
                    {players.map(p=><option key={p.name} value={p.name}>{p.name} ({p.pos})</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="48" value={entry.mins||0}
                      onChange={e=>{const m=parseInt(e.target.value)||0;setDc(d=>({...d,[pos]:{...d[pos],[key]:{...d[pos]?.[key],mins:m}}}))}}
                      className="w-16 text-xs px-2 py-1 rounded text-center"
                      style={{background:'#060c18',border:'1px solid #1e3a5f',color:'#fff',outline:'none'}} />
                    <span className="text-xs" style={{color:'#506070'}}>min</span>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )})}
      </div>

      {/* TACTICS */}
      <h2 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{color:'#506070'}}>Offensive Priorities</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0,1,2].map(i=>(
          <div key={i}>
            <label className="text-xs mb-1 block" style={{color:'#7090b0'}}>{i===0?'1st Option':i===1?'2nd Option':'3rd Option'}</label>
            <select value={pris[i]} onChange={e=>{const n=[...pris];n[i]=e.target.value;setPris(n)}}
              className="w-full text-xs px-3 py-2 rounded-lg" style={{background:'#0f1e33',border:'1px solid #1e3a5f',color:'#c0ccd8',outline:'none'}}>
              <option value="">—</option>
              {players.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs mb-1 block" style={{color:'#7090b0'}}>Clutch Player</label>
          <select value={clutch} onChange={e=>setClutch(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg" style={{background:'#0f1e33',border:'1px solid #1e3a5f',color:'#c0ccd8',outline:'none'}}>
            <option value="">—</option>
            {players.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{color:'#7090b0'}}>Pace {pace}</label>
          <input type="range" min="50" max="100" value={pace} onChange={e=>setPace(+e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{color:'#7090b0'}}>Three Point Rate {threeRate}</label>
          <input type="range" min="0" max="100" value={threeRate} onChange={e=>setThreeRate(+e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{color:'#7090b0'}}>Attack Style</label>
          <select value={atkStyle} onChange={e=>setAtkStyle(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg" style={{background:'#0f1e33',border:'1px solid #1e3a5f',color:'#c0ccd8',outline:'none'}}>
            <option value="motion">Motion Offense</option>
            <option value="pickroll">Pick & Roll</option>
            <option value="transition">Fast Break</option>
            <option value="iso">Isolation</option>
            <option value="post">Post-Up</option>
          </select>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{color:'#7090b0'}}>Defense Style</label>
          <select value={defStyle} onChange={e=>setDefStyle(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg" style={{background:'#0f1e33',border:'1px solid #1e3a5f',color:'#c0ccd8',outline:'none'}}>
            <option value="man">Man-to-Man</option>
            <option value="zone23">Zone 2-3</option>
            <option value="press">Full-Court Press</option>
            <option value="pack">Pack the Paint</option>
          </select>
        </div>
      </div>

      <button onClick={save} disabled={saving||locked}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-colors"
        style={{background:saved?'#0a5a20':locked?'#1a0a0a':'#1e3a5f',color:saved?'#40e080':locked?'#506070':'#60a0ff'}}>
        {saving?'Saving...':saved?'✓ Orders Saved!':locked?'⚠️ Locked':'Save Weekly Orders'}
      </button>
    </div>
  )
}

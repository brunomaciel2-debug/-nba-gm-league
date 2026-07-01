'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

const POSITIONS = ['PG','SG','SF','PF','C']

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex ml-1 cursor-help"
          onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full"
            style={{ background:'#d4cdc5', color:'#1e40af', fontSize:9 }}>i</span>
      {show && (
        <span className="absolute bottom-full left-0 mb-1.5 z-50 px-2.5 py-1.5 rounded-lg text-xs pointer-events-none"
              style={{ background:'#1a1512', border:'1px solid #3a3228', color:'#f5f1eb',
                       width:200, lineHeight:1.4, whiteSpace:'normal' }}>
          {text}
        </span>
      )}
    </span>
  )
}

export default function GMOrdersPage({ params }: { params: { teamId: string } }) {
  const teamId = params.teamId.toUpperCase()
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const SLOTS = [
    { key:'s',  labelEN:'Starter',  labelPT:'Titular',    color:'#1d4ed8' },
    { key:'b1', labelEN:'1st Sub',  labelPT:'1º Suplente',color:'#166534' },
    { key:'b2', labelEN:'2nd Sub',  labelPT:'2º Suplente',color:'#6b5f4e' },
  ]

  const BALL_ROLES = [
    { value:'dominant', labelEN:'Ball Dominant', labelPT:'Dominante com Bola', descEN:'Controls most possessions, primary decision-maker', descPT:'Controla a maioria das posses, tomador de decisão principal', color:'#c2410c' },
    { value:'balanced', labelEN:'Balanced',      labelPT:'Equilibrado',        descEN:'Mixes creating for self and others', descPT:'Mistura criação para si e para os companheiros', color:'#1e40af' },
    { value:'off_ball', labelEN:'Off-Ball',      labelPT:'Sem Bola',           descEN:'Moves without the ball, spot-up shooter/cutter', descPT:'Move-se sem a bola, lançador de posição/cortador', color:'#166534' },
  ]

  const ATK_STYLES = [
    { value:'motion',     labelEN:'Motion Offense', labelPT:'Motion Offense',  descEN:'Ball movement and player movement - balanced', descPT:'Movimentação de bola e jogadores - equilibrado' },
    { value:'pickroll',   labelEN:'Pick & Roll',    labelPT:'Pick & Roll',     descEN:'Heavy pick-and-roll usage - creates open looks', descPT:'Muita utilização do pick-and-roll - cria oportunidades' },
    { value:'transition', labelEN:'Fast Break',     labelPT:'Contra-Ataque',   descEN:'Push pace after rebounds and turnovers', descPT:'Acelera após ressaltos e perdas de bola' },
    { value:'iso',        labelEN:'Isolation',      labelPT:'Isolamento',      descEN:'Let your best player create 1-on-1', descPT:'Deixa o teu melhor jogador criar em 1x1' },
    { value:'post',       labelEN:'Post-Up',        labelPT:'Jogo de Poste',   descEN:'Feed the big man in the low post', descPT:'Passa para o poste no baixo poste' },
  ]

  const DEF_STYLES = [
    { value:'man',    labelEN:'Man-to-Man',      labelPT:'Individual',       descEN:'Standard on-ball coverage - most common', descPT:'Defesa individual padrão - a mais comum' },
    { value:'zone23', labelEN:'Zone 2-3',        labelPT:'Zona 2-3',         descEN:'Clogs the paint, forces mid-range shots', descPT:'Satura o garrafão, força lançamentos de médio alcance' },
    { value:'press',  labelEN:'Full-Court Press',labelPT:'Pressing Total',   descEN:'High pressure, creates turnovers but tires players', descPT:'Alta pressão, cria perdas mas cansa os jogadores' },
    { value:'pack',   labelEN:'Pack the Paint',  labelPT:'Defesa Fechada',   descEN:'Collapse on drives, allow perimeter shots', descPT:'Fecha o garrafão nas penetrações, permite lançamentos exteriores' },
  ]

  const TRAIN_OPTS = [
    { value:'rest',        labelEN:'Rest',     labelPT:'Descanso',   descEN:'Max recovery. +150% health regen.',           descPT:'Recuperação máxima. +150% regen de saúde.',    color:'#166534' },
    { value:'light',       labelEN:'Light',    labelPT:'Leve',       descEN:'+25% health regen. Low risk.',                descPT:'+25% regen de saúde. Baixo risco.',            color:'#15803d' },
    { value:'normal',      labelEN:'Normal',   labelPT:'Normal',     descEN:'Standard training. Full regen.',              descPT:'Treino padrão. Recuperação completa.',         color:'#1d4ed8' },
    { value:'intense',     labelEN:'Intense',  labelPT:'Intenso',    descEN:'-50% health regen. Higher performance readiness.', descPT:'-50% regen de saúde. Maior prontidão.',  color:'#b45309' },
    { value:'very_intense',labelEN:'Max Load', labelPT:'Carga Máx.', descEN:'-75% health regen. Injury risk.',            descPT:'-75% regen de saúde. Risco de lesão.',         color:'#dc2626' },
  ]

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
  const [saved, setSaved] = useState(false)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setIsAuthorized(false); return }
      const { data: gm } = await supabase.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
      setIsAuthorized(gm?.role==='commissioner' || gm?.team_id===teamId)
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

  if (isAuthorized===null) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{color:'#5c554e',textAlign:'center',fontSize:18,fontWeight:700}}>
        {isPT?'A verificar acesso...':'Verifying access...'}
      </div>
    </div>
  )

  if (isAuthorized===false) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{textAlign:'center',padding:40,borderRadius:16,background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div style={{fontSize:40,marginBottom:16}}>🔒</div>
        <div style={{fontSize:22,fontWeight:900,marginBottom:8,color:'#1a1512'}}>{isPT?'Acesso Negado':'Access Denied'}</div>
        <div style={{fontSize:14,marginBottom:20,color:'#5c554e'}}>{isPT?'Apenas o GM desta equipa ou o Comissário podem aceder a esta página.':'Only the GM of this team or the Commissioner can access this page.'}</div>
        <a href="/" style={{fontSize:14,fontWeight:700,padding:'10px 24px',borderRadius:8,background:'#1a1512',color:'#fff',textDecoration:'none'}}>{isPT?'Início':'Go Home'}</a>
      </div>
    </div>
  )

  const teamColor = team ? '#'+team.color : '#1d4ed8'
  const priLabels = isPT ? ['1ª Opção','2ª Opção','3ª Opção'] : ['1st Option','2nd Option','3rd Option']
  const priColors = ['#b45309','#1d4ed8','#5c554e']

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        {team?.logo_url && <img src={team.logo_url} alt="" className="w-12 h-12 object-contain" />}
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1a1512'}}>
            {isPT?'Ordens Semanais':'Weekly Orders'} — {team?.name||teamId}
          </h1>
          <p className="text-sm" style={{color:'#6b5f4e'}}>
            {isPT?'Prazo: domingo 23:59 hora de Lisboa':'Deadline: Sunday 23:59 Lisbon time'}
          </p>
        </div>
        {locked && <span className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={{background:'#fee2e2',color:'#dc2626'}}>⚠️ {isPT?'Bloqueado':'Locked'}</span>}
      </div>

      {/* DEPTH CHART */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>
        {isPT?'Rotação':'Depth Chart'}
        <InfoTip text={isPT?'Atribui jogadores a posições e define os seus minutos. Cada posição tem de totalizar exactamente 48 minutos.':'Assign players to positions and set their minutes. Each position must total exactly 48 minutes.'} />
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
                       style={{width:Math.min(100,tot/48*100)+'%',background:ok?'#15803d':tot>48?'#dc2626':'#b45309'}}/>
                </div>
                <span className="text-xs font-semibold" style={{color:ok?'#15803d':tot>48?'#dc2626':'#b45309'}}>{tot}/48</span>
              </div>
              <div className="grid grid-cols-3">
                {SLOTS.map(({key,labelEN,labelPT,color},si) => {
                  const entry=dc[pos]?.[key]||{name:'',mins:0}
                  return (
                    <div key={key} className="p-3" style={{background:'#e8e2d6',borderRight:si<2?'1px solid #d4cec3':'none'}}>
                      <div className="text-xs font-semibold mb-2" style={{color}}>{isPT?labelPT:labelEN}</div>
                      <select value={entry.name}
                              onChange={e=>setDc(d=>({...d,[pos]:{...d[pos],[key]:{...d[pos]?.[key],name:e.target.value}}}))}
                              className="w-full text-xs px-2 py-1.5 rounded mb-2"
                              style={{background:'#f0ece5',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}}>
                        <option value="">-- {isPT?'Nenhum':'None'} --</option>
                        {players.map(p=><option key={p.name} value={p.name}>{p.name} ({p.pos})</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max="48" value={entry.mins||0}
                               onChange={e=>setDc(d=>({...d,[pos]:{...d[pos],[key]:{...d[pos]?.[key],mins:parseInt(e.target.value)||0}}}))}
                               className="w-16 text-xs px-2 py-1 rounded text-center"
                               style={{background:'#f0ece5',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}} />
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
        {isPT?'Função com Bola por Jogador':'Ball Role per Player'}
        <InfoTip text={isPT?'Define a função de cada jogador com a bola. Dominante = tomador de decisão principal. Equilibrado = mistura criação para si e para outros. Sem Bola = move-se sem a bola e finaliza jogadas.':'Defines each player\'s role with the ball. Ball Dominant = primary decision-maker. Balanced = mixes creating for self and others. Off-Ball = moves without the ball, finishes plays.'} />
      </h2>
      <p className="text-xs mb-3" style={{color:'#9c8e7a'}}>
        {isPT?'Diferente da prioridade ofensiva — define como cada jogador usa a bola, não quem a recebe primeiro.':'Different from offensive priority - defines how each player uses the ball, not who gets it first.'}
      </p>
      <div className="rounded-xl overflow-hidden mb-8" style={{border:'1px solid #d4cec3'}}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
              <th className="px-4 py-2 text-left font-semibold" style={{color:'#6b5f4e'}}>{isPT?'Jogador':'Player'}</th>
              <th className="px-4 py-2 text-left font-semibold" style={{color:'#6b5f4e'}}>{isPT?'Função':'Ball Role'}</th>
              <th className="px-4 py-2 text-left font-semibold" style={{color:'#6b5f4e'}}>{isPT?'Descrição':'Description'}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p,i) => {
              const role=ballRoles[p.name]||'balanced'
              const roleInfo=BALL_ROLES.find(r=>r.value===role)||BALL_ROLES[1]
              return (
                <tr key={p.name} style={{background:i%2===0?'#ece7dd':'#e8e2d6',borderBottom:'1px solid #d4cec3'}}>
                  <td className="px-4 py-2.5 font-semibold" style={{color:'#1a1512'}}>{p.name}
                    <span className="ml-2 text-xs" style={{color:'#6b5f4e'}}>{p.pos}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <select value={role} onChange={e=>setBallRoles(r=>({...r,[p.name]:e.target.value}))}
                            className="text-xs px-2 py-1 rounded font-semibold"
                            style={{background:roleInfo.color+'22',border:'1px solid '+roleInfo.color+'44',color:roleInfo.color,outline:'none'}}>
                      {BALL_ROLES.map(r=><option key={r.value} value={r.value}>{isPT?r.labelPT:r.labelEN}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5" style={{color:'#6b5f4e'}}>{isPT?roleInfo.descPT:roleInfo.descEN}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* OFFENSIVE PRIORITIES */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color:'#6b5f4e'}}>
        {isPT?'Prioridades Ofensivas':'Offensive Priorities'}
        <InfoTip text={isPT?'Quem recebe a bola em situação de finalização. A 1ª opção recebe a bola com mais frequência em situações de meia-court. Trata-se de finalizar jogadas, não de quem controla a bola.':'Who receives the ball in a scoring situation. 1st Option gets the ball most often in half-court sets. This is about finalization - not ball control.'} />
      </h2>
      <p className="text-xs mb-3" style={{color:'#9c8e7a'}}>
        {isPT?'Quem finaliza as jogadas — recebe a bola em posição de marcação.':'Who finishes plays - gets the ball in scoring position.'}
      </p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0,1,2].map(i=>(
          <div key={i}>
            <label className="text-xs mb-1 block font-semibold" style={{color:priColors[i]}}>{priLabels[i]}</label>
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
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>{isPT?'Táticas':'Tactics'}</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            {isPT?'Jogador Clutch':'Clutch Player'}
            <InfoTip text={isPT?'Recebe a bola nos últimos 2 minutos de um jogo decidido por ≤5 pontos.':'Gets the ball in the final 2 minutes of a close game (<=5 points difference).'} />
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
            {isPT?`Ritmo — ${pace}`:`Pace — ${pace}`}
            <InfoTip text={isPT?'Velocidade de jogo. Ritmo alto = mais posses por jogo. Ritmo baixo = jogo mais controlado.':'How fast your team plays. High pace = more possessions per game. Low pace = slower, more controlled.'} />
          </label>
          <input type="range" min="50" max="100" value={pace} onChange={e=>setPace(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs mt-0.5" style={{color:'#9c8e7a'}}>
            <span>{isPT?'Lento':'Slow'}</span><span>{isPT?'Rápido':'Fast'}</span>
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            {isPT?`Taxa de 3 Pontos — ${threeRate}%`:`Three-Point Rate — ${threeRate}%`}
            <InfoTip text={isPT?'% de posses que terminam em lançamento de 3. Média NBA ~38%.':'Percentage of possessions ending in a 3PT attempt. NBA average ~38%.'} />
          </label>
          <input type="range" min="0" max="80" value={threeRate} onChange={e=>setThreeRate(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs mt-0.5" style={{color:'#9c8e7a'}}>
            <span>{isPT?'Poste':'Post-heavy'}</span><span>{isPT?'3 Pontos':'3PT-heavy'}</span>
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            {isPT?'Estilo Ofensivo':'Attack Style'}
            <InfoTip text={isPT?'Como a equipa gera ataque em situações de meia-court.':'How your team generates offense in half-court situations.'} />
          </label>
          <select value={atkStyle} onChange={e=>setAtkStyle(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}}>
            {ATK_STYLES.map(s=><option key={s.value} value={s.value}>{isPT?s.labelPT:s.labelEN}</option>)}
          </select>
          <p className="text-xs mt-1" style={{color:'#9c8e7a'}}>
            {isPT ? ATK_STYLES.find(s=>s.value===atkStyle)?.descPT : ATK_STYLES.find(s=>s.value===atkStyle)?.descEN}
          </p>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            {isPT?'Estilo Defensivo':'Defense Style'}
            <InfoTip text={isPT?'Como a equipa defende em situações de meia-court.':'How your team defends on the half-court.'} />
          </label>
          <select value={defStyle} onChange={e=>setDefStyle(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#e8e2d6',border:'1px solid #d4cec3',color:'#1a1512',outline:'none'}}>
            {DEF_STYLES.map(s=><option key={s.value} value={s.value}>{isPT?s.labelPT:s.labelEN}</option>)}
          </select>
          <p className="text-xs mt-1" style={{color:'#9c8e7a'}}>
            {isPT ? DEF_STYLES.find(s=>s.value===defStyle)?.descPT : DEF_STYLES.find(s=>s.value===defStyle)?.descEN}
          </p>
        </div>
      </div>

      {/* TRAINING INTENSITY */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3 mt-6" style={{color:'#6b5f4e'}}>
        {isPT?'Intensidade de Treino':'Training Intensity'}
        <InfoTip text={isPT?'Define a intensidade do treino nos dias de recuperação. Treino intenso = menos recuperação de saúde. Descanso = mais recuperação.':'Sets how hard the team trains during recovery days. Intense training = less health recovery. Rest = more recovery but less preparation.'} />
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
        {TRAIN_OPTS.map(ti=>(
          <button key={ti.value} onClick={()=>setTrainIntensity(ti.value)}
            className="rounded-xl p-3 text-center transition-all"
            style={{background:trainIntensity===ti.value?ti.color+'22':'#f0ece5',border:'1px solid '+(trainIntensity===ti.value?ti.color:'#d4cec3'),opacity:locked?0.5:1}}>
            <div className="text-xs font-semibold" style={{color:trainIntensity===ti.value?ti.color:'#3d3731'}}>
              {isPT?ti.labelPT:ti.labelEN}
            </div>
            <div className="text-xs mt-1" style={{color:'#6b5f4e'}}>{isPT?ti.descPT:ti.descEN}</div>
          </button>
        ))}
      </div>

      <button onClick={save} disabled={saving||locked}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-colors"
        style={{background:saved?'#dcfce7':locked?'#fee2e2':'#1d4ed8',color:saved?'#15803d':locked?'#dc2626':'#fff'}}>
        {saving?(isPT?'A guardar...':'Saving...')
          :saved?`✔ ${isPT?'Ordens Guardadas!':'Orders Saved!'}`
          :locked?`⚠️ ${isPT?'Bloqueado para esta semana':'Locked for this week'}`
          :(isPT?'Guardar Ordens Semanais':'Save Weekly Orders')}
      </button>
    </div>
  )
}

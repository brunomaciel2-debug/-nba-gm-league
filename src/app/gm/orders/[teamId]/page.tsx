'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import { formatWeekRange } from '@/lib/season-week-helper'

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
    { value:'motion',     labelEN:'Motion Offense', labelPT:'Motion Offense', descEN:'Ball movement and player movement - balanced', descPT:'Movimentação de bola e jogadores - equilibrado' },
    { value:'pickroll',   labelEN:'Pick & Roll',    labelPT:'Pick & Roll',    descEN:'Heavy pick-and-roll usage - creates open looks', descPT:'Muita utilização do pick-and-roll - cria oportunidades' },
    { value:'transition', labelEN:'Fast Break',     labelPT:'Contra-Ataque',  descEN:'Push pace after rebounds and turnovers', descPT:'Acelera após ressaltos e perdas de bola' },
    { value:'iso',        labelEN:'Isolation',      labelPT:'Isolamento',     descEN:'Let your best player create 1-on-1', descPT:'Deixa o teu melhor jogador criar em 1x1' },
    { value:'post',       labelEN:'Post-Up',        labelPT:'Jogo de Poste',  descEN:'Feed the big man in the low post', descPT:'Passa para o poste no baixo poste' },
  ]

  const DEF_STYLES = [
    { value:'man',    labelEN:'Man-to-Man',      labelPT:'Individual',     descEN:'Standard on-ball coverage - most common', descPT:'Defesa individual padrão - a mais comum' },
    { value:'zone23', labelEN:'Zone 2-3',         labelPT:'Zona 2-3',       descEN:'Clogs the paint, forces mid-range shots', descPT:'Satura o garrafão, força lançamentos de meia distância' },
    { value:'press',  labelEN:'Full-Court Press', labelPT:'Pressing Total', descEN:'High pressure, creates turnovers but tires players', descPT:'Alta pressão, cria perdas mas cansa os jogadores' },
    { value:'pack',   labelEN:'Pack the Paint',   labelPT:'Defesa Fechada', descEN:'Collapse on drives, allow perimeter shots', descPT:'Fecha o garrafão nas penetrações, permite lançamentos exteriores' },
  ]

  const TRAIN_OPTS = [
    { value:'rest',        labelEN:'Rest',    labelPT:'Descanso',   descEN:'Max recovery. +150% health regen.', descPT:'Recuperação máxima. +150% regen de saúde.', color:'#166534' },
    { value:'light',       labelEN:'Light',   labelPT:'Leve',       descEN:'+25% health regen. Low risk.', descPT:'+25% regen de saúde. Baixo risco.', color:'#15803d' },
    { value:'normal',      labelEN:'Normal',  labelPT:'Normal',     descEN:'Standard training. Full regen.', descPT:'Treino padrão. Recuperação completa.', color:'#1d4ed8' },
    { value:'intense',     labelEN:'Intense', labelPT:'Intenso',    descEN:'-50% health regen. Higher performance readiness.', descPT:'-50% regen de saúde. Maior prontidão.', color:'#b45309' },
    { value:'very_intense',labelEN:'Max Load',labelPT:'Carga Máx.', descEN:'-75% health regen. Injury risk.', descPT:'-75% regen de saúde. Risco de lesão.', color:'#dc2626' },
  ]

  const emptyDC = {
    PG:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    SG:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    SF:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    PF:{s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
    C: {s:{name:'',mins:0},b1:{name:'',mins:0},b2:{name:'',mins:0}},
  }

  const [players, setPlayers] = useState<any[]>([])
  const [injuredNames, setInjuredNames] = useState<Set<string>>(new Set())
  const [team, setTeam] = useState<any>(null)
  const [pris, setPris] = useState(['','',''])
  const [clutch, setClutch] = useState('')
  const [ballRoles, setBallRoles] = useState<Record<string,string>>({})
  const [pace, setPace] = useState(70)
  const [threeRate, setThreeRate] = useState(47)
  const [atkStyle, setAtkStyle] = useState('motion')
  const [defStyle, setDefStyle] = useState('man')
  const [trainIntensity, setTrainIntensity] = useState('normal')
  const [dc, setDc] = useState<Record<string,any>>(emptyDC)
  const [saving, setSaving] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState<boolean|null>(null)
  const [saved, setSaved] = useState(false)
  const [locked, setLocked] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(0)
  // The existing order for this week (if any) loads over 2 sequential
  // network round-trips (season_config, then gm_orders) after the page is
  // already visible and interactive. A GM who starts filling in the Depth
  // Chart during that short window was editing state that the load then
  // silently overwrote the moment it resolved — every position edited
  // BEFORE the load finished got reset back to 0, while whatever was
  // edited AFTER kept working, exactly matching a report of "I filled in
  // every position but only the last one I touched actually saved."
  // Locking the form until the load completes closes that window.
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  type Assignment = { double_team_target?:string, lockdown_target?:string, lockdown_defender?:string }
  const [specialAssignments, setSpecialAssignments] = useState<Record<string,Assignment>>({})
  const [activeOppTab, setActiveOppTab] = useState<string>('')
  const [oppGroups, setOppGroups] = useState<{teamId:string,teamName:string,players:any[]}[]>([])

  const setAssignment = (oppId:string, patch: Partial<Assignment>) => {
    setSpecialAssignments(prev => ({ ...prev, [oppId]: { ...prev[oppId], ...patch } }))
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setIsAuthorized(false); return }
      const { data: gm } = await supabase.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
      setIsAuthorized(gm?.role==='commissioner' || gm?.team_id===teamId)
    })
    supabase.from('teams').select('*').eq('id',teamId).single().then(({data})=>data&&setTeam(data))
    supabase.from('players').select('id,name,pos,usage').eq('team_id',teamId).eq('status','active')
      .order('name',{ascending:true}).then(async ({data})=>{
        if(!data)return
        setPlayers(data)
        // No declared foreign key from injury_log to players — fetch active
        // injuries separately and cross-reference by id, same no-embed
        // pattern used everywhere else this session.
        // Only block on injuries the system itself flags as unplayable
        // (can_play=false) — an open-but-playable injury (e.g. a moderate
        // sprain the player can still suit up for) shouldn't hard-block
        // Save, since the injury system already lets a GM play through it.
        const { data: injuries } = await supabase.from('injury_log').select('player_id').eq('status','active').eq('can_play',false).in('player_id', data.map((p:any)=>p.id))
        setInjuredNames(new Set(data.filter((p:any)=>(injuries||[]).some((i:any)=>i.player_id===p.id)).map((p:any)=>p.name)))
      })
    supabase.from('season_config').select('current_week').eq('id',1).single()
      .then(({data:cfg})=>{
        if(!cfg){ setOrdersLoaded(true); return }
        const week = cfg.current_week + 1
        setCurrentWeek(week)
        // A team plays SEVERAL games in a single simulated week (this league
        // runs ~4 per week), each potentially against a different opponent.
        // Double Team is a weekly setting like everything else here (Pace,
        // Attack/Defense Style) — it applies to every game that week, but
        // only actually does anything in the specific game against whichever
        // team the chosen player really plays for.
        //
        // Pre-season friendlies are a DIFFERENT table (preseason_games, not
        // games) and aren't tied to week_number at all — the cron resolves
        // every pending one (status scheduled/accepted) on its next run,
        // regardless of "week". Some friendly opponents are fictional World
        // Teams, whose rosters live under players.world_team_id, not team_id.
        Promise.all([
          supabase.from('games').select('home_team,away_team')
            .eq('week_number',week).or(`home_team.eq.${teamId},away_team.eq.${teamId}`),
          supabase.from('preseason_games').select('home_team,away_team,home_type,away_type')
            .eq('season','2025-26').in('status',['scheduled','accepted'])
            .or(`home_team.eq.${teamId},away_team.eq.${teamId}`),
        ]).then(([{data:realGames},{data:friendlies}])=>{
          const entries: {oppId:string,oppType:'nba'|'world'}[] = []
          ;(realGames||[]).forEach((g:any)=>{
            const oppId = g.home_team===teamId?g.away_team:g.home_team
            if(oppId) entries.push({oppId,oppType:'nba'})
          })
          ;(friendlies||[]).forEach((g:any)=>{
            const isHome = g.home_team===teamId
            const oppId = isHome?g.away_team:g.home_team
            const oppType = ((isHome?g.away_type:g.home_type)||'nba') as 'nba'|'world'
            if(oppId) entries.push({oppId,oppType})
          })
          const seen = new Set<string>()
          const uniqueOpps = entries.filter(e=>{ if(seen.has(e.oppId))return false; seen.add(e.oppId); return true })
          if(!uniqueOpps.length){ setOppGroups([]); return }
          Promise.all(uniqueOpps.map(async ({oppId,oppType})=>{
            if(oppType==='world'){
              const [{data:wt},{data:ops}] = await Promise.all([
                supabase.from('world_teams').select('name').eq('id',oppId).single(),
                supabase.from('players').select('name,pos,usage').eq('world_team_id',oppId).order('usage',{ascending:false}),
              ])
              return { teamId:oppId, teamName:wt?.name||oppId, players:ops||[] }
            }
            const [{data:ot},{data:ops}] = await Promise.all([
              supabase.from('teams').select('name').eq('id',oppId).single(),
              supabase.from('players').select('name,pos,usage').eq('team_id',oppId).eq('status','active').order('usage',{ascending:false}),
            ])
            return { teamId:oppId, teamName:ot?.name||oppId, players:ops||[] }
          })).then(groups=>{ setOppGroups(groups); if(groups.length) setActiveOppTab(prev=>prev||groups[0].teamId) })
        })
        supabase.from('gm_orders').select('*').eq('team_id',teamId).eq('week_number',week).single()
          .then(({data:ord})=>{
            if(!ord){ setOrdersLoaded(true); return }
            // Restore all saved values
            setPris([ord.priority_1||'',ord.priority_2||'',ord.priority_3||''])
            setClutch(ord.clutch_player||'')
            setPace(ord.pace||70)
            setThreeRate(ord.three_rate||47)
            setAtkStyle(ord.atk_style||'motion')
            setDefStyle(ord.def_style||'man')
            setTrainIntensity(ord.training_intensity||'normal')
            setSpecialAssignments(ord.special_assignments||{})
            setLocked(ord.locked||false)
            if(ord.depth_chart) {
              // Extract ball_roles separately from depth_chart
              const { ball_roles, ...dcOnly } = ord.depth_chart as any
              setDc({...emptyDC, ...dcOnly})
              if(ball_roles) setBallRoles(ball_roles)
            }
            if(ord.ball_roles) setBallRoles(ord.ball_roles)
            setOrdersLoaded(true)
          })
      })
  }, [teamId])

  // A real injured player can never actually suit up — block the save
  // entirely rather than let it through with a dismissible warning.
  const assignedInjuredNames = Array.from(new Set(
    Object.values(dc).flatMap((p:any) => [p?.s?.name, p?.b1?.name, p?.b2?.name])
      .filter((name:any) => name && injuredNames.has(name))
  ))

  const save = async () => {
    if(locked || !ordersLoaded || assignedInjuredNames.length>0 || !allPositionsOk)return
    setSaving(true)
    // Always re-check the live week instead of trusting the value cached in
    // React state at page load — if the season actually advanced while this
    // tab sat open (a simulation ran, or the commissioner did a reset), the
    // cached currentWeek silently pointed Save at the wrong, already-passed
    // week, overwriting that week's real (possibly locked) orders instead of
    // the upcoming one the simulator actually reads.
    const { data: freshCfg } = await supabase.from('season_config').select('current_week').eq('id',1).single()
    const week = (freshCfg?.current_week || 0) + 1
    if (week !== currentWeek) setCurrentWeek(week)
    await supabase.from('gm_orders').upsert({
      team_id:teamId, week_number:week,
      priority_1:pris[0], priority_2:pris[1], priority_3:pris[2],
      clutch_player:clutch, pace, three_rate:threeRate,
      atk_style:atkStyle, def_style:defStyle, special_assignments:specialAssignments,
      depth_chart:{...dc, ball_roles:ballRoles},
      training_intensity:trainIntensity,
    },{onConflict:'team_id,week_number'})
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  const posTot = (pos:string) => {
    const p=dc[pos]||{}
    return (parseInt(p.s?.mins)||0)+(parseInt(p.b1?.mins)||0)+(parseInt(p.b2?.mins)||0)
  }
  // 48 is a ceiling, not a required exact total — a position can run under
  // 48 on purpose. Going over is the only thing that actually gets blocked.
  const allPositionsOk = POSITIONS.every(pos => posTot(pos) <= 48)

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
            {isPT?`${formatWeekRange(currentWeek,'pt-PT')} · Prazo: domingo 23:59 hora de Lisboa`:`${formatWeekRange(currentWeek,'en-US')} · Deadline: Sunday 23:59 Lisbon time`}
          </p>
        </div>
        {locked && <span className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{background:'#fee2e2',color:'#dc2626'}}>⚠️ {isPT?'Bloqueado':'Locked'}</span>}
      </div>

      {!ordersLoaded && (
        <div className="rounded-xl p-3 mb-5 text-xs font-semibold text-center" style={{background:'#e0e7ff',color:'#3730a3'}}>
          {isPT?'⏳ A carregar as tuas ordens desta semana — espera antes de editar, para não perderes o que já tinhas gravado...':'⏳ Loading your orders for this week — wait before editing, so nothing you already saved gets lost...'}
        </div>
      )}

      {/* Locked until the async load of this week's saved order finishes —
          see the ordersLoaded comment above. Prevents a GM's edits from
          being silently overwritten the moment the load resolves. */}
      <div style={{pointerEvents:ordersLoaded?'auto':'none',opacity:ordersLoaded?1:0.5}}>

      {/* DEPTH CHART */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b5f4e'}}>
        {isPT?'Rotação':'Depth Chart'}
        <InfoTip text={isPT?'Atribui jogadores a posições e define os seus minutos. 48 é o máximo por posição (podes ficar abaixo, nunca acima) — e jogar fora de posição real tem uma penalização real de rendimento no jogo, não é bloqueado.':'Assign players to positions and set their minutes. 48 is the maximum per position (you can go under, never over) — and playing someone out of their real position carries a real in-game performance penalty, it isn\'t blocked.'} />
      </h2>
      <div className="flex flex-col gap-3 mb-8">
        {POSITIONS.map(pos => {
          const tot=posTot(pos), full=tot===48, over=tot>48
          const barColor = over?'#dc2626':full?'#15803d':'#1d4ed8'
          return (
            <div key={pos} className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cec3'}}>
              <div className="flex items-center gap-3 px-4 py-2" style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
                <span className="font-bold text-sm w-8" style={{color:teamColor}}>{pos}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'#cec7bc'}}>
                  <div className="h-full rounded-full transition-all"
                    style={{width:Math.min(100,tot/48*100)+'%',background:barColor}}/>
                </div>
                <span className="text-xs font-semibold" style={{color:barColor}}>{tot}/48{over?(isPT?' — acima do máximo!':' — over the max!'):''}</span>
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
                        style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
                        <option value="">-- {isPT?'Nenhum':'None'} --</option>
                        {players.map(p=><option key={p.name} value={p.name}>{p.name} ({p.pos})</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max="48" value={entry.mins||0}
                          onChange={e=>setDc(d=>({...d,[pos]:{...d[pos],[key]:{...d[pos]?.[key],mins:parseInt(e.target.value)||0}}}))}
                          className="w-16 text-xs px-2 py-1 rounded text-center"
                          style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}} />
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
        <InfoTip text={isPT?'Define a função de cada jogador com a bola.':'Defines each player\'s role with the ball.'} />
      </h2>
      <p className="text-xs mb-3" style={{color:'#9c8e7a'}}>
        {isPT?'Diferente da prioridade ofensiva — define como cada jogador usa a bola.':'Different from offensive priority - defines how each player uses the ball.'}
      </p>
      <div className="rounded-xl overflow-hidden mb-8" style={{border:'1px solid #d4cdc5'}}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{background:'#ddd7ca',borderBottom:'1px solid #d4cdc5'}}>
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
                <tr key={p.name} style={{background:i%2===0?'#ece7dd':'#e8e2d6',borderBottom:'1px solid #d4cdc5'}}>
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
        <InfoTip text={isPT?'Quem recebe a bola em situação de finalização.':'Who receives the ball in a scoring situation.'} />
      </h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0,1,2].map(i=>(
          <div key={i}>
            <label className="text-xs mb-1 block font-semibold" style={{color:priColors[i]}}>{priLabels[i]}</label>
            <select value={pris[i]} onChange={e=>{const n=[...pris];n[i]=e.target.value;setPris(n)}}
              className="w-full text-xs px-3 py-2 rounded-lg"
              style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
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
            <InfoTip text={isPT?'Recebe a bola nos últimos 2 minutos de um jogo decidido por ≤5 pontos.':'Gets the ball in the final 2 minutes of a close game.'} />
          </label>
          <select value={clutch} onChange={e=>setClutch(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
            <option value="">--</option>
            {players.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            {isPT?`Ritmo — ${pace}`:`Pace — ${pace}`}
            <InfoTip text={isPT?'Velocidade de jogo. Ritmo alto = mais posses por jogo.':'How fast your team plays. High pace = more possessions per game.'} />
          </label>
          <input type="range" min="50" max="100" value={pace} onChange={e=>setPace(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs mt-0.5" style={{color:'#9c8e7a'}}>
            <span>{isPT?'Lento':'Slow'}</span><span>{isPT?'Rápido':'Fast'}</span>
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            {isPT?`Taxa de 3 Pontos — ${threeRate}%`:`Three-Point Rate — ${threeRate}%`}
            <InfoTip text={isPT?'% de posses que terminam em lançamento de 3.':'% of possessions ending in a 3PT attempt.'} />
          </label>
          <input type="range" min="0" max="80" value={threeRate} onChange={e=>setThreeRate(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs mt-0.5" style={{color:'#9c8e7a'}}>
            <span>{isPT?'Poste':'Post-heavy'}</span><span>{isPT?'3 Pontos':'3PT-heavy'}</span>
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            {isPT?'Estilo Ofensivo':'Attack Style'}
          </label>
          <select value={atkStyle} onChange={e=>setAtkStyle(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
            {ATK_STYLES.map(s=><option key={s.value} value={s.value}>{isPT?s.labelPT:s.labelEN}</option>)}
          </select>
          <p className="text-xs mt-1" style={{color:'#9c8e7a'}}>
            {isPT?ATK_STYLES.find(s=>s.value===atkStyle)?.descPT:ATK_STYLES.find(s=>s.value===atkStyle)?.descEN}
          </p>
        </div>
        <div>
          <label className="text-xs mb-1 block font-semibold" style={{color:'#6b5f4e'}}>
            {isPT?'Estilo Defensivo':'Defense Style'}
          </label>
          <select value={defStyle} onChange={e=>setDefStyle(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
            {DEF_STYLES.map(s=><option key={s.value} value={s.value}>{isPT?s.labelPT:s.labelEN}</option>)}
          </select>
          <p className="text-xs mt-1" style={{color:'#9c8e7a'}}>
            {isPT?DEF_STYLES.find(s=>s.value===defStyle)?.descPT:DEF_STYLES.find(s=>s.value===defStyle)?.descEN}
          </p>
        </div>
      </div>

      {/* SPECIAL ASSIGNMENTS — one independent panel per opponent this week */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{border:'1px solid #d4cdc5'}}>
        <div className="px-4 py-3" style={{background:'#ece7dd',borderBottom:'1px solid #d4cdc5'}}>
          <div className="text-xs font-semibold uppercase tracking-widest" style={{color:'#6b5f4e'}}>
            🎯 {isPT?'Atribuições Especiais':'Special Assignments'}
          </div>
          <div className="text-xs mt-0.5" style={{color:'#9c8e7a'}}>
            {isPT?'Um Double Team e um Defensor de Marcação próprios para cada adversário desta semana.':'Your own Double Team and Lockdown Defender for each opponent this week.'}
          </div>
        </div>

        {oppGroups.length===0 ? (
          <div className="p-5 text-center text-xs" style={{color:'#9c8e7a',background:'#faf8f5'}}>
            {isPT?'Sem jogos agendados esta semana.':'No games scheduled this week.'}
          </div>
        ) : (
          <>
            {/* Opponent tabs */}
            <div className="flex gap-1.5 px-3 pt-3 flex-wrap" style={{background:'#faf8f5'}}>
              {oppGroups.map(g=>{
                const a = specialAssignments[g.teamId]
                const hasAssignment = !!(a?.double_team_target || a?.lockdown_target)
                const active = activeOppTab===g.teamId
                return (
                  <button key={g.teamId} onClick={()=>setActiveOppTab(g.teamId)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                    style={{
                      background: active ? '#1a1512' : '#e8e2d6',
                      color: active ? '#fff' : '#3d3731',
                      border: '1px solid ' + (active ? '#1a1512' : '#d4cdc5'),
                    }}>
                    vs {g.teamName}
                    {hasAssignment && <span style={{width:6,height:6,borderRadius:'50%',background:active?'#f59e0b':'#c2410c',display:'inline-block'}}/>}
                  </button>
                )
              })}
            </div>

            {oppGroups.filter(g=>g.teamId===activeOppTab).map(g=>{
              const a = specialAssignments[g.teamId] || {}
              return (
                <div key={g.teamId} className="grid sm:grid-cols-2 gap-px mt-3" style={{background:'#d4cdc5'}}>
                  <div className="p-4" style={{background:'#faf8f5'}}>
                    <label className="text-xs mb-1.5 flex items-center font-semibold" style={{color:'#7c2d12'}}>
                      🔒 {isPT?'Double Team':'Double Team'}
                      <InfoTip text={isPT?'Reduz muito o lançamento e aumenta as perdas de bola do jogador escolhido, mas deixa os companheiros dele com lançamentos mais fáceis — a tua defesa fica mais fina no resto do campo.':'Sharply reduces the chosen player\'s shooting and raises his turnovers, but leaves his teammates with easier looks — the rest of your defense is stretched thinner.'} />
                    </label>
                    <div className="text-xs font-semibold mb-1" style={{color:'#7c2d12'}}>
                      {isPT?`Jogador de ${g.teamName} a dobrar`:`${g.teamName} player to double-team`}
                    </div>
                    <select value={a.double_team_target||''} onChange={e=>setAssignment(g.teamId,{double_team_target:e.target.value})}
                      className="w-full text-xs px-3 py-2 rounded-lg"
                      style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
                      <option value="">-- {isPT?'Nenhum':'None'} --</option>
                      {g.players.map(p=><option key={p.name} value={p.name}>{p.name} ({p.pos})</option>)}
                    </select>
                    <p className="text-xs mt-1.5" style={{color:'#9c8e7a'}}>
                      {isPT?'Alto risco, alta recompensa — condiciona a estrela, expõe o resto.':'High risk, high reward — locks down the star, exposes the rest.'}
                    </p>
                  </div>
                  <div className="p-4" style={{background:'#faf8f5'}}>
                    <label className="text-xs mb-1.5 flex items-center font-semibold" style={{color:'#0e7490'}}>
                      🛡️ {isPT?'Defensor de Marcação':'Lockdown Defender'}
                      <InfoTip text={isPT?'Designa um jogador teu para marcar sempre um jogador específico do adversário, em vez de depender de quem calhar a marcá-lo. Sem penalização no resto da defesa.':'Assigns one of your players to always guard a specific opponent, instead of leaving it to whoever happens to switch onto him. No penalty elsewhere.'} />
                    </label>
                    <div className="text-xs font-semibold mb-1" style={{color:'#0e7490'}}>
                      1. {isPT?`Jogador de ${g.teamName} a neutralizar`:`${g.teamName} player to neutralize`}
                    </div>
                    <select value={a.lockdown_target||''} onChange={e=>setAssignment(g.teamId,{lockdown_target:e.target.value, ...(e.target.value?{}:{lockdown_defender:''})})}
                      className="w-full text-xs px-3 py-2 rounded-lg mb-2"
                      style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}>
                      <option value="">-- {isPT?'Nenhum':'None'} --</option>
                      {g.players.map(p=><option key={p.name} value={p.name}>{p.name} ({p.pos})</option>)}
                    </select>
                    <div className="text-xs font-semibold mb-1" style={{color:a.lockdown_target?'#0e7490':'#b8ada0'}}>
                      2. {isPT?'O TEU jogador que vai marcá-lo':'YOUR player who will guard him'}
                    </div>
                    <select value={a.lockdown_defender||''} onChange={e=>setAssignment(g.teamId,{lockdown_defender:e.target.value})} disabled={!a.lockdown_target}
                      className="w-full text-xs px-3 py-2 rounded-lg disabled:opacity-50"
                      style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none',cursor:a.lockdown_target?'pointer':'not-allowed'}}>
                      <option value="">-- {a.lockdown_target?(isPT?'Escolhe o teu defensor':'Choose your defender'):(isPT?'Escolhe primeiro o alvo acima':'Pick the target above first')} --</option>
                      {players.map(p=><option key={p.name} value={p.name}>{p.name} ({p.pos})</option>)}
                    </select>
                    <p className="text-xs mt-1.5" style={{color:'#9c8e7a'}}>
                      {isPT?'Baixo risco — o teu melhor defensor, sempre no jogador certo.':'Low risk — your best defender, always on the right man.'}
                    </p>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* TRAINING */}
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3 mt-6" style={{color:'#6b5f4e'}}>
        {isPT?'Intensidade de Treino':'Training Intensity'}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
        {TRAIN_OPTS.map(ti=>(
          <button key={ti.value} onClick={()=>setTrainIntensity(ti.value)}
            className="rounded-xl p-3 text-center transition-all"
            style={{background:trainIntensity===ti.value?ti.color+'22':'#f0ece5',border:'1px solid '+(trainIntensity===ti.value?ti.color:'#d4cdc5'),opacity:locked?0.5:1}}>
            <div className="text-xs font-semibold" style={{color:trainIntensity===ti.value?ti.color:'#3d3731'}}>
              {isPT?ti.labelPT:ti.labelEN}
            </div>
            <div className="text-xs mt-1" style={{color:'#6b5f4e'}}>{isPT?ti.descPT:ti.descEN}</div>
          </button>
        ))}
      </div>

      </div>

      {assignedInjuredNames.length>0&&(
        <div className="rounded-xl p-4 mb-4" style={{background:'#fee2e2',border:'1px solid #dc2626'}}>
          <div className="text-sm font-bold mb-1" style={{color:'#dc2626'}}>
            {isPT?'🚑 Não podes escalar jogadores lesionados':"🚑 You can't dress injured players"}
          </div>
          <div className="text-xs" style={{color:'#991b1b'}}>
            {isPT?'Remove da rotação: ':'Remove from the rotation: '}{assignedInjuredNames.join(', ')}
          </div>
        </div>
      )}

      {!allPositionsOk&&(
        <div className="rounded-xl p-4 mb-4" style={{background:'#fee2e2',border:'1px solid #dc2626'}}>
          <div className="text-sm font-bold mb-1" style={{color:'#dc2626'}}>
            {isPT?'⏱️ Uma posição está acima do máximo de 48 minutos':'⏱️ A position is over the 48-minute maximum'}
          </div>
          <div className="text-xs" style={{color:'#991b1b'}}>
            {isPT?'Reduz os minutos até nenhuma posição ultrapassar 48.':'Reduce minutes until no position exceeds 48.'}
          </div>
        </div>
      )}

      <button onClick={save} disabled={saving||locked||!ordersLoaded||assignedInjuredNames.length>0||!allPositionsOk}
        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-colors"
        style={{background:saved?'#dcfce7':locked?'#fee2e2':'#1d4ed8',color:saved?'#15803d':locked?'#dc2626':'#fff'}}>
        {saving?(isPT?'A guardar...':'Saving...')
          :saved?`✔ ${isPT?'Ordens Guardadas!':'Orders Saved!'}`
          :locked?`⚠️ ${isPT?'Bloqueado para esta semana':'Locked for this week'}`
          :!allPositionsOk?`🚫 ${isPT?'Uma posição excede 48 minutos':'A position exceeds 48 minutes'}`
          :(isPT?'Guardar Ordens Semanais':'Save Weekly Orders')}
      </button>
    </div>
  )
}

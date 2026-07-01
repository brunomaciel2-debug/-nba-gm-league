'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import ArenaView from './ArenaView'
import { useTranslation } from '@/components/I18nProvider'

type GymGrade = 'F'|'E'|'D'|'C'|'B'|'A'
type Facility = {
  id:string, team_id:string, gym_grade:GymGrade,
  has_pool:boolean, has_sauna:boolean, has_shooting_machine:boolean,
  has_film_room:boolean, has_sports_lab:boolean,
  gym_under_construction:boolean, gym_upgrade_ends_at:string|null, monthly_cost:number
}

const GRADES: GymGrade[] = ['F','E','D','C','B','A']

const GYM_CONFIG: Record<GymGrade,{label:string,color:string,bg:string,speed:number,recovery:number,risk:number,fa:number,cost:number,unlocks:string[],descEN:string,descPT:string}> = {
  F:{label:'Grade F',color:'#dc2626',bg:'#fee2e2',speed:5, recovery:-5, risk:0,  fa:0,  cost:50000,   unlocks:[],            descEN:'Temporary rented facility',       descPT:'Instalação alugada temporária'},
  E:{label:'Grade E',color:'#b45309',bg:'#fef3c7',speed:7, recovery:0,  risk:0,  fa:0,  cost:150000,  unlocks:[],            descEN:'Entry-level NBA facility',         descPT:'Instalação básica de NBA'},
  D:{label:'Grade D',color:'#ca8a04',bg:'#fefce8',speed:9, recovery:3,  risk:0,  fa:0,  cost:300000,  unlocks:['Playmaking'],descEN:'2 courts, video room',             descPT:'2 campos, sala de vídeo'},
  C:{label:'Grade C',color:'#15803d',bg:'#dcfce7',speed:12,recovery:7,  risk:-5, fa:0,  cost:600000,  unlocks:['Shooting'],  descEN:'3 courts, physiotherapy',         descPT:'3 campos, fisioterapia'},
  B:{label:'Grade B',color:'#1d4ed8',bg:'#dbeafe',speed:15,recovery:13, risk:-10,fa:5,  cost:1200000, unlocks:['Mental'],    descEN:'Hydrotherapy, cryotherapy',       descPT:'Hidroterapia, crioterapia'},
  A:{label:'Grade A',color:'#6d28d9',bg:'#ede9fe',speed:19,recovery:20, risk:-18,fa:12, cost:2500000, unlocks:['Analytics'], descEN:'World class campus',              descPT:'Campus de classe mundial'},
}

const UPGRADES: Partial<Record<GymGrade,{cost:number,weeks:number,next:GymGrade}>> = {
  F:{cost:5000000,  weeks:4, next:'E'},
  E:{cost:12000000, weeks:6, next:'D'},
  D:{cost:25000000, weeks:8, next:'C'},
  C:{cost:50000000, weeks:10,next:'B'},
  B:{cost:100000000,weeks:12,next:'A'},
}

const EXTRAS_EN = [
  {key:'has_pool',            label:'Pool',             icon:'🏊',cost:8000000, monthly:80000,  bonus:'Physical +3%/wk'},
  {key:'has_sauna',           label:'Sauna',            icon:'🧖',cost:2000000, monthly:20000,  bonus:'Physical +2%/wk'},
  {key:'has_shooting_machine',label:'Shooting Machine', icon:'🎯',cost:5000000, monthly:100000, bonus:'Offense +4%/wk'},
  {key:'has_film_room',       label:'Film Room',        icon:'🎬',cost:3000000, monthly:50000,  bonus:'Defense +3%/wk'},
  {key:'has_sports_lab',      label:'Sports Lab',       icon:'🔬',cost:15000000,monthly:200000, bonus:'Analytics +5%/wk'},
]

const EXTRAS_PT = [
  {key:'has_pool',            label:'Piscina',           icon:'🏊',cost:8000000, monthly:80000,  bonus:'Físico +3%/sem'},
  {key:'has_sauna',           label:'Sauna',             icon:'🧖',cost:2000000, monthly:20000,  bonus:'Físico +2%/sem'},
  {key:'has_shooting_machine',label:'Máquina Lançamento',icon:'🎯',cost:5000000, monthly:100000, bonus:'Ataque +4%/sem'},
  {key:'has_film_room',       label:'Sala de Vídeo',     icon:'🎬',cost:3000000, monthly:50000,  bonus:'Defesa +3%/sem'},
  {key:'has_sports_lab',      label:'Lab Desportivo',    icon:'🔬',cost:15000000,monthly:200000, bonus:'Análise +5%/sem'},
]

const fmtM=(n:number)=>'$'+(n>=1000000?(n/1e6).toFixed(0)+'M':(n/1000).toFixed(0)+'K')

export default function FacilitiesTab({teamId,teamColor,arenaName,arenaCapacity,cash=45000000}:{
  teamId:string,teamColor:string,arenaName?:string,arenaCapacity?:number,cash?:number
}) {
  const {profile} = useAuth()
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const isGM = (profile as any)?.team_id===teamId || profile?.role==='commissioner'
  const EXTRAS = isPT ? EXTRAS_PT : EXTRAS_EN
  const [facility,setFacility] = useState<Facility|null>(null)
  const [loading,setLoading]   = useState(true)
  const [view,setView]         = useState<'gym'|'arena'>('gym')
  const [upgrading,setUpgrading] = useState(false)
  const [msg,setMsg]           = useState('')

  useEffect(()=>{
    supabase.from('practice_facilities').select('*').eq('team_id',teamId).single()
      .then(({data})=>{setFacility(data);setLoading(false)})
  },[teamId])

  const handleUpgrade=async()=>{
    if(!facility||!isGM)return
    const upg=UPGRADES[facility.gym_grade]; if(!upg||cash<upg.cost)return
    setUpgrading(true)
    const ends=new Date(); ends.setDate(ends.getDate()+upg.weeks*7)
    await supabase.from('practice_facilities').update({gym_under_construction:true,gym_upgrade_ends_at:ends.toISOString().split('T')[0]}).eq('id',facility.id)
    setFacility(p=>p?{...p,gym_under_construction:true,gym_upgrade_ends_at:ends.toISOString().split('T')[0]}:p)
    setMsg(isPT?`Melhoria para ${upg.next} iniciada — pronta em ${upg.weeks} semanas.`:`Upgrade to ${upg.next} started — ready in ${upg.weeks} weeks.`)
    setUpgrading(false)
  }

  const handleBuild=async(key:string,cost:number,monthly:number)=>{
    if(!facility||!isGM||cash<cost)return
    await supabase.from('practice_facilities').update({[key]:true,monthly_cost:facility.monthly_cost+monthly}).eq('id',facility.id)
    setFacility(p=>p?{...p,[key]:true,monthly_cost:p.monthly_cost+monthly}:p)
    setMsg(isPT?'Construção concluída!':'Built successfully!')
  }

  if(loading)return <div className="text-center py-8" style={{color:'#8a8279'}}>{t('common.loading')}</div>
  if(!facility)return null

  const cfg=GYM_CONFIG[facility.gym_grade]
  const upg=UPGRADES[facility.gym_grade]
  const nextCfg=upg?GYM_CONFIG[upg.next]:null
  const gradeIdx=GRADES.indexOf(facility.gym_grade)

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {[{key:'gym',label:isPT?'🏋️ Ginásio':'🏋️ Practice Facility'},{key:'arena',label:isPT?'🏟️ Pavilhão':'🏟️ Arena'}].map((v:any)=>(
          <button key={v.key} onClick={()=>setView(v.key)}
            style={{padding:'6px 16px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',border:`1px solid ${view===v.key?teamColor:'#d4cdc5'}`,background:view===v.key?teamColor:'#f0ece5',color:view===v.key?'#fff':'#5c554e'}}>
            {v.label}
          </button>
        ))}
      </div>

      {view==='arena' && (
        <div className="rounded-xl p-4" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <ArenaView teamId={teamId} teamColor={teamColor} arenaName={arenaName||'Arena'} arenaCapacity={arenaCapacity||20000} cash={cash}/>
        </div>
      )}

      {view==='gym' && (
        <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
          <div style={{flex:1,minWidth:0}}>
            {msg && (
              <div style={{marginBottom:12,padding:'8px 12px',borderRadius:8,background:'#dcfce7',color:'#15803d',fontSize:12,fontWeight:600,border:'1px solid #bbf7d0'}}>✓ {msg}</div>
            )}
            <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:12}}>
                {isPT?'Grau do Ginásio':'Practice Facility Grade'}
              </div>
              <div style={{display:'flex',gap:6,alignItems:'stretch',marginBottom:12}}>
                {GRADES.map((g,i)=>{
                  const gc=GYM_CONFIG[g]; const isCurrent=g===facility.gym_grade; const isPast=i<gradeIdx; const isFuture=i>gradeIdx
                  return (
                    <div key={g} style={{flex:1,borderRadius:8,padding:'8px 4px',textAlign:'center',background:isCurrent?gc.bg:isPast?gc.color+'22':'#f0ece5',border:`1px solid ${isCurrent?gc.color:isPast?gc.color+'44':'#e2dcd5'}`,opacity:isFuture?0.5:1}}>
                      <div style={{fontSize:14,fontWeight:900,color:isCurrent?gc.color:isPast?gc.color:'#b0a89e'}}>{g}</div>
                      {isCurrent && <div style={{fontSize:8,color:gc.color,fontWeight:700,marginTop:1}}>{isPT?'ATUAL':'CURRENT'}</div>}
                    </div>
                  )
                })}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{fontSize:20}}>{facility.gym_under_construction?'🚧':'🏋️'}</span>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:facility.gym_under_construction?'#1d4ed8':cfg.color}}>
                    {facility.gym_under_construction?`${isPT?'Em melhoria para':'Upgrading to'} ${upg?.next}...`:cfg.label}
                  </div>
                  <div style={{fontSize:12,color:'#5c554e'}}>{isPT?cfg.descPT:cfg.descEN}</div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                {[
                  {label:isPT?'Velocidade slot':'Slot speed',val:`+${cfg.speed}%/sem`,color:cfg.color},
                  {label:isPT?'Recuperação':'Recovery',val:cfg.recovery>=0?`+${cfg.recovery}%`:`${cfg.recovery}%`,color:cfg.recovery>=0?'#15803d':'#dc2626'},
                  {label:isPT?'Risco lesão':'Injury risk',val:cfg.risk===0?'—':`${cfg.risk}%`,color:cfg.risk<0?'#15803d':'#5c554e'},
                  {label:isPT?'Bónus FA':'FA bonus',val:cfg.fa>0?`+${cfg.fa}%`:'—',color:cfg.fa>0?'#15803d':'#8a8279'},
                  ...(isGM?[{label:isPT?'Mensal':'Monthly',val:fmtM(facility.monthly_cost),color:'#dc2626'}]:[]),
                  {label:isPT?'Desbloqueia':'Unlocks',val:cfg.unlocks[0]||'—',color:cfg.color},
                ].map(item=>(
                  <div key={item.label} style={{background:'#f0ece5',borderRadius:6,padding:'6px 8px'}}>
                    <div style={{fontSize:9,color:'#8a8279'}}>{item.label}</div>
                    <div style={{fontSize:11,fontWeight:700,color:item.color}}>{item.val}</div>
                  </div>
                ))}
              </div>
              {facility.gym_under_construction && (
                <div style={{marginTop:10,padding:'8px 10px',background:'#dbeafe',borderRadius:8,border:'1px solid #93c5fd',fontSize:11,color:'#1d4ed8'}}>
                  🚧 {isPT?'Em construção · Pronto:':'Under construction · Ready:'} {facility.gym_upgrade_ends_at?new Date(facility.gym_upgrade_ends_at).toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric',year:'numeric'}):'TBD'}
                </div>
              )}
            </div>
            <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:8}}>
              {isPT?'Instalações Adicionais':'Additional Facilities'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {EXTRAS.map(ef=>{
                const built=(facility as any)[ef.key]
                return (
                  <div key={ef.key} style={{background:built?'#f0fdf4':'#faf8f5',border:`1px solid ${built?'#bbf7d0':'#d4cdc5'}`,borderLeft:`3px solid ${built?'#15803d':'#d4cdc5'}`,borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:20,flexShrink:0}}>{ef.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#1a1512'}}>{ef.label}</div>
                      <div style={{fontSize:10,color:built?'#15803d':'#8a8279',marginBottom:2}}>{built?'✓ '+(isPT?'Construído':'Built'):ef.bonus}</div>
                      {!built && isGM && <div style={{fontSize:10,color:'#8a8279'}}>{isPT?'Construir':'Build'}: {fmtM(ef.cost)} · {isPT?'Manutenção':'Maint'}: {fmtM(ef.monthly)}/mo</div>}
                    </div>
                    {!built && isGM && (
                      <button onClick={()=>handleBuild(ef.key,ef.cost,ef.monthly)} disabled={cash<ef.cost}
                        style={{padding:'4px 10px',fontSize:11,fontWeight:600,borderRadius:6,border:'none',flexShrink:0,background:cash>=ef.cost?teamColor:'#e2dcd5',color:cash>=ef.cost?'#fff':'#8a8279',cursor:cash>=ef.cost?'pointer':'not-allowed'}}>
                        {isPT?'Construir':'Build'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{width:200,flexShrink:0}}>
            {upg && nextCfg && !facility.gym_under_construction ? (
              <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:12,padding:14}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:10}}>
                  {isPT?'Próxima Melhoria':'Next Upgrade'}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <div style={{width:36,height:36,borderRadius:8,background:nextCfg.bg,border:`1px solid ${nextCfg.color}44`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{fontSize:16,fontWeight:900,color:nextCfg.color}}>{upg.next}</span>
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:nextCfg.color}}>{nextCfg.label}</div>
                    <div style={{fontSize:10,color:'#8a8279'}}>{isPT?nextCfg.descPT:nextCfg.descEN}</div>
                  </div>
                </div>
                {[
                  {label:isPT?'Duração':'Duration',val:`${upg.weeks} ${isPT?'semanas':'weeks'}`},
                  {label:isPT?'Velocidade slot':'Slot speed',val:`+${nextCfg.speed}%/${isPT?'sem':'week'}`},
                  {label:isPT?'Desbloqueia':'Unlocks',val:nextCfg.unlocks[0]||'—'},
                  ...(isGM?[{label:isPT?'Custo':'Cost',val:fmtM(upg.cost)}]:[]),
                ].map(row=>(
                  <div key={row.label} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #e2dcd5',fontSize:11}}>
                    <span style={{color:'#8a8279'}}>{row.label}</span>
                    <span style={{color:'#1a1512',fontWeight:600}}>{row.val}</span>
                  </div>
                ))}
                {isGM && (
                  <button onClick={handleUpgrade} disabled={!upg||cash<upg.cost||upgrading}
                    style={{width:'100%',marginTop:10,padding:'8px',fontSize:12,fontWeight:700,borderRadius:8,border:'none',background:cash>=upg.cost?cfg.color:'#e2dcd5',color:cash>=upg.cost?'#fff':'#8a8279',cursor:cash>=upg.cost?'pointer':'not-allowed'}}>
                    {upgrading?'...':`${isPT?'Melhorar':'Upgrade'} — ${fmtM(upg.cost)}`}
                  </button>
                )}
                {cash<upg.cost && <div style={{fontSize:10,color:'#dc2626',marginTop:4,textAlign:'center'}}>{isPT?'Fundos insuficientes':'Insufficient funds'}</div>}
              </div>
            ) : facility.gym_grade==='A' ? (
              <div style={{background:'#ede9fe',border:'1px solid #6d28d9',borderRadius:12,padding:14,textAlign:'center'}}>
                <div style={{fontSize:20,marginBottom:6}}>🏆</div>
                <div style={{fontSize:13,fontWeight:700,color:'#6d28d9'}}>{isPT?'Classe Mundial':'World Class'}</div>
                <div style={{fontSize:11,color:'#5c554e',marginTop:4}}>{isPT?'Grau máximo atingido':'Maximum grade achieved'}</div>
              </div>
            ) : facility.gym_under_construction ? (
              <div style={{background:'#dbeafe',border:'1px solid #93c5fd',borderRadius:12,padding:14,textAlign:'center'}}>
                <div style={{fontSize:20,marginBottom:6}}>🚧</div>
                <div style={{fontSize:13,fontWeight:700,color:'#1d4ed8'}}>{isPT?'Em Progresso':'In Progress'}</div>
                <div style={{fontSize:11,color:'#5c554e',marginTop:4}}>
                  {facility.gym_upgrade_ends_at?new Date(facility.gym_upgrade_ends_at).toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric'}):'TBD'}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

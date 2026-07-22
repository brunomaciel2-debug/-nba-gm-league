'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'
import { getWeekDates, formatWeekRange } from '@/lib/season-week-helper'

const AWARD_META_EN: Record<string,{label:string,icon:string,color:string,desc:string}> = {
  potw_eastern:{label:'Player of the Week',  icon:'ti-star',         color:'#b45309',desc:'Eastern Conference'},
  potw_western:{label:'Player of the Week',  icon:'ti-star',         color:'#1d4ed8',desc:'Western Conference'},
  potm_eastern:{label:'Player of the Month', icon:'ti-calendar-star',color:'#b45309',desc:'Eastern Conference'},
  potm_western:{label:'Player of the Month', icon:'ti-calendar-star',color:'#1d4ed8',desc:'Western Conference'},
  rotw:        {label:'Rookie of the Week',  icon:'ti-star',         color:'#6d28d9',desc:'League-Wide'},
  rotm:        {label:'Rookie of the Month', icon:'ti-calendar-star',color:'#6d28d9',desc:'League-Wide'},
  mvp:         {label:'MVP',                 icon:'ti-trophy',       color:'#c8102e',desc:'Most Valuable Player'},
  dpoy:        {label:'DPOY',                icon:'ti-shield',       color:'#15803d',desc:'Defensive Player of the Year'},
  roy:         {label:'Rookie of the Year',  icon:'ti-bolt',         color:'#6d28d9',desc:'Best First-Year Player'},
  coy:         {label:'Coach of the Year',   icon:'ti-whistle',      color:'#0e7490',desc:'Best Head Coach'},
  mip:         {label:'Most Improved',       icon:'ti-trending-up',  color:'#c2410c',desc:'Most Improved Player'},
  finals_mvp:  {label:'Finals MVP',          icon:'ti-medal',        color:'#c8102e',desc:'Championship Series MVP'},
  all_nba_1:   {label:'1st Team All-NBA',    icon:'ti-award',        color:'#b45309',desc:''},
  all_nba_2:   {label:'2nd Team All-NBA',    icon:'ti-award',        color:'#5c554e',desc:''},
  all_nba_3:   {label:'3rd Team All-NBA',    icon:'ti-award',        color:'#8a8279',desc:''},
  all_rookie_1:{label:'1st Rookie Team',     icon:'ti-award',        color:'#6d28d9',desc:''},
  all_rookie_2:{label:'2nd Rookie Team',     icon:'ti-award',        color:'#8a8279',desc:''},
}
const AWARD_META_PT: Record<string,{label:string,icon:string,color:string,desc:string}> = {
  potw_eastern:{label:'Jogador da Semana',   icon:'ti-star',         color:'#b45309',desc:'Conferência Este'},
  potw_western:{label:'Jogador da Semana',   icon:'ti-star',         color:'#1d4ed8',desc:'Conferência Oeste'},
  potm_eastern:{label:'Jogador do Mês',      icon:'ti-calendar-star',color:'#b45309',desc:'Conferência Este'},
  potm_western:{label:'Jogador do Mês',      icon:'ti-calendar-star',color:'#1d4ed8',desc:'Conferência Oeste'},
  rotw:        {label:'Rookie da Semana',    icon:'ti-star',         color:'#6d28d9',desc:'Toda a Liga'},
  rotm:        {label:'Rookie do Mês',       icon:'ti-calendar-star',color:'#6d28d9',desc:'Toda a Liga'},
  mvp:         {label:'MVP',                 icon:'ti-trophy',       color:'#c8102e',desc:'Jogador Mais Valioso'},
  dpoy:        {label:'DPOY',                icon:'ti-shield',       color:'#15803d',desc:'Melhor Defensor do Ano'},
  roy:         {label:'Caloiro do Ano',      icon:'ti-bolt',         color:'#6d28d9',desc:'Melhor Jogador de 1º Ano'},
  coy:         {label:'Treinador do Ano',    icon:'ti-whistle',      color:'#0e7490',desc:'Melhor Head Coach'},
  mip:         {label:'Mais Melhorado',      icon:'ti-trending-up',  color:'#c2410c',desc:'Jogador Mais Melhorado'},
  finals_mvp:  {label:'MVP das Finais',      icon:'ti-medal',        color:'#c8102e',desc:'MVP das Finais do Campeonato'},
  all_nba_1:   {label:'1ª Equipa All-NBA',   icon:'ti-award',        color:'#b45309',desc:''},
  all_nba_2:   {label:'2ª Equipa All-NBA',   icon:'ti-award',        color:'#5c554e',desc:''},
  all_nba_3:   {label:'3ª Equipa All-NBA',   icon:'ti-award',        color:'#8a8279',desc:''},
  all_rookie_1:{label:'1ª Equipa Caloiros',  icon:'ti-award',        color:'#6d28d9',desc:''},
  all_rookie_2:{label:'2ª Equipa Caloiros',  icon:'ti-award',        color:'#8a8279',desc:''},
}

type Tab = 'weekly'|'monthly'|'yearly'

const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
// Player of the Month periods are stored as "month_YYYY-MM" (e.g.
// "month_2025-11") since the engine switched from an arbitrary 4-week
// block to real calendar months — this turns that into "November 2025" /
// "Novembro 2025" instead of showing the raw key. Falls back to the raw
// suffix for any leftover pre-fix "month_N" rows rather than crashing.
function formatMonthPeriod(period: string, isPT: boolean): string {
  const m = period.match(/^month_(\d{4})-(\d{2})$/)
  if (!m) return period.replace('month_', isPT?'Mês ':'Month ')
  const names = isPT ? MONTH_NAMES_PT : MONTH_NAMES_EN
  return `${names[parseInt(m[2],10)-1]} ${m[1]}`
}

// Weekly awards only store "week_N" — the real calendar month a given week
// falls into has to be derived from getWeekDates(N).start, same source the
// engine itself uses to decide when a real month has crossed for Player of
// the Month. Used to group Weekly awards under a month dropdown instead of
// one long list that just keeps growing as the season progresses.
function weekMonthKey(period: string): string {
  const w = parseInt(period.replace('week_',''), 10)
  const start = getWeekDates(w).start
  return `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}`
}

function AwardCard({award,meta,isPT}:{award:any,meta:any,isPT:boolean}) {
  const isCoach=award.award_type==='coy'
  const entity=isCoach?award.coaches:award.players
  const team=entity?.teams
  const tc=team?readableTeamColor(team.color):'#5c554e'
  const stats=award.stats_context
  const period = award.period?.startsWith('month_')
    ? formatMonthPeriod(award.period, isPT)
    : award.period?.startsWith('week_')
    ? formatWeekRange(parseInt(award.period.replace('week_',''),10), isPT?'pt-PT':'en-US')
    : award.period?.replace('season','2025-26')
  return (
    <div className="rounded-2xl overflow-hidden" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${meta.color}`}}>
      <div className="px-5 py-3 flex items-center justify-between" style={{background:'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
        <div className="flex items-center gap-2">
          <i className={`ti ${meta.icon}`} style={{fontSize:16,color:meta.color}}></i>
          <span className="text-xs font-bold uppercase tracking-widest" style={{color:meta.color,letterSpacing:'1px'}}>{meta.label}</span>
        </div>
        <div className="text-xs" style={{color:'#8a8279'}}>
          {meta.desc&&<span>{meta.desc} · </span>}<span>{period}</span>
        </div>
      </div>
      <div className="p-5">
        {entity?(
          <Link href={isCoach?`/staff/${entity.id}`:`/player/${entity.id}`} className="no-underline group flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{background:tc+'18',border:`1.5px solid ${tc}33`}}>
              {entity.photo_url||entity.logo_url
                ?<img src={entity.photo_url||entity.logo_url} alt="" className="w-full h-full object-cover"/>
                :<div className="w-full h-full flex items-center justify-center font-black text-lg" style={{color:tc}}>
                   {entity.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                 </div>}
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg group-hover:underline" style={{color:'#1a1512'}}>{entity.name}</div>
              <div className="text-sm" style={{color:tc}}>{entity.pos&&<span className="mr-1.5">{entity.pos}</span>}{team?.name}</div>
              {stats&&(
                <div className="flex gap-3 mt-1.5 flex-wrap">
                  {stats.ppg&&<span className="text-xs font-semibold" style={{color:'#5c554e'}}>{stats.ppg} PPG</span>}
                  {stats.rpg&&<span className="text-xs font-semibold" style={{color:'#5c554e'}}>{stats.rpg} RPG</span>}
                  {stats.apg&&<span className="text-xs font-semibold" style={{color:'#5c554e'}}>{stats.apg} APG</span>}
                  {stats.games&&<span className="text-xs" style={{color:'#8a8279'}}>{stats.games} GP</span>}
                </div>
              )}
            </div>
          </Link>
        ):(
          <div className="text-center py-4" style={{color:'#8a8279'}}>
            <i className={`ti ${meta.icon}`} style={{fontSize:28,color:'#d4cdc5'}}></i>
            <p className="text-sm mt-2">{isPT?'Época em curso':'Season in progress'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TeamAward({awards,type,meta,isPT}:{awards:any[],type:string,meta:any,isPT:boolean}) {
  const members=awards.filter(a=>a.award_type===type)
  if(!meta)return null
  return (
    <div className="rounded-2xl overflow-hidden" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${meta.color}`}}>
      <div className="px-5 py-3 flex items-center gap-2" style={{background:'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
        <i className={`ti ${meta.icon}`} style={{fontSize:16,color:meta.color}}></i>
        <span className="text-xs font-bold uppercase tracking-widest" style={{color:meta.color,letterSpacing:'1px'}}>{meta.label}</span>
        <span className="text-xs ml-auto" style={{color:'#8a8279'}}>2025-26</span>
      </div>
      <div className="p-4">
        {members.length===0?(
          <div className="text-center py-4" style={{color:'#8a8279'}}>
            <p className="text-sm">{isPT?'Disponível no final da época':'Available at end of season'}</p>
          </div>
        ):(
          <div className="flex flex-col gap-2">
            {members.map((a:any,i:number)=>{
              const p=a.players; const tc=p?.teams?readableTeamColor(p.teams.color):'#5c554e'
              return (
                <Link key={a.id} href={`/player/${p?.id}`} className="no-underline group flex items-center gap-3 px-3 py-2 rounded-xl transition-all" style={{background:i%2===0?'#f5f1eb':'transparent'}}>
                  <span className="text-sm font-black w-5" style={{color:meta.color}}>{i+1}</span>
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{background:tc+'18'}}>
                    {p?.photo_url?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                      :<div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:tc}}>{p?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold group-hover:underline" style={{color:'#1a1512'}}>{p?.name}</div>
                    <div className="text-xs" style={{color:tc}}>{p?.pos} · {p?.teams?.name}</div>
                  </div>
                  {a.stats_context?.ppg&&<span className="text-xs font-semibold" style={{color:'#5c554e'}}>{a.stats_context.ppg} PPG</span>}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AwardsPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const AWARD_META = isPT ? AWARD_META_PT : AWARD_META_EN
  const [tab,setTab] = useState<Tab>('weekly')
  const [awards,setAwards] = useState<any[]>([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    // Load all awards at once
    supabase.from('awards')
      .select('*, players(id,name,pos,photo_url,team_id,teams:teams!players_team_id_fkey(id,name,color,logo_url)), coaches(id,name,role,team_id,teams(id,name,color,logo_url))')
      .eq('season','2025-26').order('award_type').order('created_at',{ascending:false})
      .then(({data})=>{setAwards(data||[]);setLoading(false)})
  },[])

  const tabAwards = (type: Tab) => {
    if(type==='weekly')  return awards.filter(a=>['potw_eastern','potw_western'].includes(a.award_type))
    if(type==='monthly') return awards.filter(a=>['potm_eastern','potm_western'].includes(a.award_type))
    return awards.filter(a=>['mvp','dpoy','roy','coy','mip','finals_mvp','all_nba_1','all_nba_2','all_nba_3','all_rookie_1','all_rookie_2'].includes(a.award_type))
  }

  const weeklyPeriods=Array.from(new Set(awards.filter(a=>a.award_type.startsWith('potw')||a.award_type==='rotw').map((a:any)=>a.period))).sort((a:any,b:any)=>parseInt(b.split('_')[1]||'0')-parseInt(a.split('_')[1]||'0'))
  // "month_YYYY-MM" sorts correctly as a plain string (2025-11 > 2025-10),
  // unlike parseInt(b.split('_')[1]) which stops at the first hyphen and
  // collapses every month in the same year to an identical sort key.
  const monthlyPeriods=Array.from(new Set(awards.filter(a=>a.award_type.startsWith('potm')||a.award_type==='rotm').map((a:any)=>a.period))).sort((a:any,b:any)=>b.localeCompare(a))

  // Group weekly periods by real calendar month so the page can show one
  // month at a time via a dropdown instead of an ever-growing list of every
  // week since the season started.
  const weeklyMonthKeys=Array.from(new Set(weeklyPeriods.map(weekMonthKey))).sort((a,b)=>b.localeCompare(a))
  const [selectedWeeklyMonth,setSelectedWeeklyMonth]=useState<string>('')
  useEffect(()=>{
    if(!selectedWeeklyMonth && weeklyMonthKeys.length>0) setSelectedWeeklyMonth(weeklyMonthKeys[0])
  },[weeklyMonthKeys.join(','),selectedWeeklyMonth])
  const weeklyPeriodsInMonth=weeklyPeriods.filter(p=>weekMonthKey(p)===selectedWeeklyMonth)

  const TABS_EN = [['weekly','Weekly'],['monthly','Monthly'],['yearly','Season Awards']] as const
  const TABS_PT = [['weekly','Semanais'],['monthly','Mensais'],['yearly','Prémios da Época']] as const
  const TABS = isPT ? TABS_PT : TABS_EN

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="sec-hdr mb-6">
        <span className="sec-title">
          <i className="ti ti-trophy" style={{fontSize:16,marginRight:8,color:'#c8102e'}}></i>
          {isPT?'Prémios':'Awards'} — 2025-26
        </span>
      </div>

      <div className="flex gap-2 mb-8 border-b" style={{borderColor:'#d4cdc5'}}>
        {TABS.map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key as Tab)} className="no-underline">
            <div className="px-5 py-3 text-sm font-semibold transition-all"
                 style={{color:tab===key?'#1a1512':'#5c554e',background:'transparent',border:'none',cursor:'pointer',
                         borderBottom:tab===key?'3px solid #c8102e':'3px solid transparent',marginBottom:-1}}>
              {label}
            </div>
          </button>
        ))}
      </div>

      {loading?<div className="text-center py-12" style={{color:'#8a8279'}}>{t('common.loading')}</div>:(
        <>
          {tab==='weekly'&&(
            weeklyPeriods.length===0?(
              <div className="text-center py-16">
                <i className="ti ti-star" style={{fontSize:48,color:'#d4cdc5'}}></i>
                <p className="text-base mt-4 font-semibold" style={{color:'#5c554e'}}>{isPT?'Ainda sem prémios semanais':'No weekly awards yet'}</p>
                <p className="text-sm mt-1" style={{color:'#8a8279'}}>{isPT?'Os prémios são calculados após cada ciclo de simulação.':'Awards are calculated after each simulation run.'}</p>
              </div>
            ):(
              <>
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{color:'#5c554e',letterSpacing:'1px'}}>{isPT?'Mês:':'Month:'}</span>
                  <select
                    value={selectedWeeklyMonth}
                    onChange={e=>setSelectedWeeklyMonth(e.target.value)}
                    className="text-sm font-semibold px-3 py-2 rounded-lg"
                    style={{background:'#faf8f5',border:'1px solid #d4cdc5',color:'#1a1512'}}>
                    {weeklyMonthKeys.map(mk=>(
                      <option key={mk} value={mk}>{formatMonthPeriod(`month_${mk}`,isPT)}</option>
                    ))}
                  </select>
                </div>
                {weeklyPeriodsInMonth.map((period:any)=>(
                  <div key={period} className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1px'}}>
                      {formatWeekRange(parseInt(period.replace('week_',''),10), isPT?'pt-PT':'en-US')}
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      {['potw_eastern','potw_western','rotw'].map(type=>{
                        const a=awards.find((aw:any)=>aw.award_type===type&&aw.period===period)
                        return a?<AwardCard key={type} award={a} meta={AWARD_META[type]} isPT={isPT}/>:null
                      })}
                    </div>
                  </div>
                ))}
              </>
            )
          )}

          {tab==='monthly'&&(
            monthlyPeriods.length===0?(
              <div className="text-center py-16">
                <i className="ti ti-calendar-star" style={{fontSize:48,color:'#d4cdc5'}}></i>
                <p className="text-base mt-4 font-semibold" style={{color:'#5c554e'}}>{isPT?'Ainda sem prémios mensais':'No monthly awards yet'}</p>
                <p className="text-sm mt-1" style={{color:'#8a8279'}}>{isPT?'Os prémios mensais são calculados no final de cada mês real do calendário.':'Monthly awards are calculated at the end of each real calendar month.'}</p>
              </div>
            ):monthlyPeriods.map((period:any)=>(
              <div key={period} className="mb-8">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1px'}}>
                  {formatMonthPeriod(period, isPT)}
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {['potm_eastern','potm_western','rotm'].map(type=>{
                    const a=awards.find((aw:any)=>aw.award_type===type&&aw.period===period)
                    return a?<AwardCard key={type} award={a} meta={AWARD_META[type]} isPT={isPT}/>:null
                  })}
                </div>
              </div>
            ))
          )}

          {tab==='yearly'&&(
            <>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>{isPT?'Prémios Individuais':'Individual Awards'}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {['mvp','dpoy','roy','coy','mip','finals_mvp'].map(type=>{
                  const a=awards.find((aw:any)=>aw.award_type===type)
                  const meta=AWARD_META[type]
                  if(!a)return(
                    <div key={type} className="rounded-2xl overflow-hidden" style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${meta.color}`}}>
                      <div className="px-5 py-3 flex items-center gap-2" style={{background:'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                        <i className={`ti ${meta.icon}`} style={{fontSize:16,color:meta.color}}></i>
                        <span className="text-xs font-bold uppercase tracking-widest" style={{color:meta.color,letterSpacing:'1px'}}>{meta.label}</span>
                      </div>
                      <div className="p-5 text-center">
                        <i className={`ti ${meta.icon}`} style={{fontSize:32,color:'#d4cdc5'}}></i>
                        <p className="text-sm mt-2" style={{color:'#8a8279'}}>{isPT?'Época em curso':'Season in progress'}</p>
                        <p className="text-xs mt-1" style={{color:'#a89f97'}}>{meta.desc}</p>
                      </div>
                    </div>
                  )
                  return <AwardCard key={type} award={a} meta={meta} isPT={isPT}/>
                })}
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>{isPT?'Equipas All-NBA':'All-NBA Teams'}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {['all_nba_1','all_nba_2','all_nba_3'].map(type=><TeamAward key={type} awards={awards} type={type} meta={AWARD_META[type]} isPT={isPT}/>)}
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{color:'#5c554e',letterSpacing:'1.5px'}}>{isPT?'Equipas de Caloiros':'All-Rookie Teams'}</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {['all_rookie_1','all_rookie_2'].map(type=><TeamAward key={type} awards={awards} type={type} meta={AWARD_META[type]} isPT={isPT}/>)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

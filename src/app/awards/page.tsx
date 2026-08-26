'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColorOnDark } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'
import { getWeekDates, formatWeekRange } from '@/lib/season-week-helper'
import { fetchAllRows } from '@/lib/paginate'

// Bold neon accents instead of the old muted trophy-shop palette (brown/
// olive/teal) — tuned to glow on the dark trading-card backgrounds below
// rather than sit flat on cream.
const AWARD_META_EN: Record<string,{label:string,icon:string,color:string,desc:string}> = {
  potw_eastern:{label:'Player of the Week',  icon:'ti-star',         color:'#fb923c',desc:'Eastern Conference'},
  potw_western:{label:'Player of the Week',  icon:'ti-star',         color:'#38bdf8',desc:'Western Conference'},
  potm_eastern:{label:'Player of the Month', icon:'ti-calendar-star',color:'#fb923c',desc:'Eastern Conference'},
  potm_western:{label:'Player of the Month', icon:'ti-calendar-star',color:'#38bdf8',desc:'Western Conference'},
  rotw:        {label:'Rookie of the Week',  icon:'ti-star',         color:'#a78bfa',desc:'League-Wide'},
  rotm:        {label:'Rookie of the Month', icon:'ti-calendar-star',color:'#a78bfa',desc:'League-Wide'},
  mvp:         {label:'MVP',                 icon:'ti-trophy',       color:'#f43f5e',desc:'Most Valuable Player'},
  dpoy:        {label:'DPOY',                icon:'ti-shield',       color:'#22d3ee',desc:'Defensive Player of the Year'},
  roy:         {label:'Rookie of the Year',  icon:'ti-bolt',         color:'#a78bfa',desc:'Best First-Year Player'},
  coy:         {label:'Coach of the Year',   icon:'ti-whistle',      color:'#38bdf8',desc:'Best Head Coach'},
  mip:         {label:'Most Improved',       icon:'ti-trending-up',  color:'#fb923c',desc:'Most Improved Player'},
  smoy:        {label:'6th Man of the Year', icon:'ti-armchair',     color:'#facc15',desc:'Best Bench Player'},
  finals_mvp:  {label:'Finals MVP',          icon:'ti-medal',        color:'#fbbf24',desc:'Championship Series MVP'},
  all_nba_1:   {label:'1st Team All-NBA',    icon:'ti-award',        color:'#fbbf24',desc:''},
  all_nba_2:   {label:'2nd Team All-NBA',    icon:'ti-award',        color:'#cbd5e1',desc:''},
  all_nba_3:   {label:'3rd Team All-NBA',    icon:'ti-award',        color:'#d97706',desc:''},
  all_rookie_1:{label:'1st Rookie Team',     icon:'ti-award',        color:'#a78bfa',desc:''},
  all_rookie_2:{label:'2nd Rookie Team',     icon:'ti-award',        color:'#818cf8',desc:''},
}
const AWARD_META_PT: Record<string,{label:string,icon:string,color:string,desc:string}> = {
  potw_eastern:{label:'Jogador da Semana',   icon:'ti-star',         color:'#fb923c',desc:'Conferência Este'},
  potw_western:{label:'Jogador da Semana',   icon:'ti-star',         color:'#38bdf8',desc:'Conferência Oeste'},
  potm_eastern:{label:'Jogador do Mês',      icon:'ti-calendar-star',color:'#fb923c',desc:'Conferência Este'},
  potm_western:{label:'Jogador do Mês',      icon:'ti-calendar-star',color:'#38bdf8',desc:'Conferência Oeste'},
  rotw:        {label:'Rookie da Semana',    icon:'ti-star',         color:'#a78bfa',desc:'Toda a Liga'},
  rotm:        {label:'Rookie do Mês',       icon:'ti-calendar-star',color:'#a78bfa',desc:'Toda a Liga'},
  mvp:         {label:'MVP',                 icon:'ti-trophy',       color:'#f43f5e',desc:'Jogador Mais Valioso'},
  dpoy:        {label:'DPOY',                icon:'ti-shield',       color:'#22d3ee',desc:'Melhor Defensor do Ano'},
  roy:         {label:'Caloiro do Ano',      icon:'ti-bolt',         color:'#a78bfa',desc:'Melhor Jogador de 1º Ano'},
  coy:         {label:'Treinador do Ano',    icon:'ti-whistle',      color:'#38bdf8',desc:'Melhor Head Coach'},
  mip:         {label:'Mais Melhorado',      icon:'ti-trending-up',  color:'#fb923c',desc:'Jogador Mais Melhorado'},
  smoy:        {label:'6º Homem do Ano',     icon:'ti-armchair',     color:'#facc15',desc:'Melhor Jogador Suplente'},
  finals_mvp:  {label:'MVP das Finais',      icon:'ti-medal',        color:'#fbbf24',desc:'MVP das Finais do Campeonato'},
  all_nba_1:   {label:'1ª Equipa All-NBA',   icon:'ti-award',        color:'#fbbf24',desc:''},
  all_nba_2:   {label:'2ª Equipa All-NBA',   icon:'ti-award',        color:'#cbd5e1',desc:''},
  all_nba_3:   {label:'3ª Equipa All-NBA',   icon:'ti-award',        color:'#d97706',desc:''},
  all_rookie_1:{label:'1ª Equipa Caloiros',  icon:'ti-award',        color:'#a78bfa',desc:''},
  all_rookie_2:{label:'2ª Equipa Caloiros',  icon:'ti-award',        color:'#818cf8',desc:''},
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

// Shared dark "trading card" language — reused/adapted from the Transactions
// and All-Star pages: deep navy-purple base, a faint diagonal texture, and a
// soft radial wash of the card's accent color, instead of the old flat cream
// boxes that read more "spreadsheet" than "sports app".
const DARK_BG = '#140f24'
const DARK_BG_2 = '#241c3d'
const CARD_TEXTURE = 'repeating-linear-gradient(115deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 2px, transparent 2px, transparent 14px)'
const TEXT_PRIMARY = '#f5f2fb'
const TEXT_SECONDARY = '#c9c2e0'
const TEXT_MUTED = '#8f88ad'

function cardGradient(accent: string, teamColor?: string) {
  const glow = teamColor || accent
  return `linear-gradient(135deg, ${glow}2e 0%, ${DARK_BG} 42%, ${DARK_BG} 68%, ${accent}22 100%), ${CARD_TEXTURE}, ${DARK_BG}`
}

function GlowBeam({color}:{color:string}) {
  return <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none" style={{background:`linear-gradient(90deg, transparent, ${color}, transparent)`,boxShadow:`0 0 16px 2px ${color}aa`}}/>
}

function SectionHeader({children,color='#f43f5e'}:{children:React.ReactNode,color?:string}) {
  return (
    <h3 className="text-sm font-black uppercase mb-4 flex items-center gap-2.5" style={{color:'#1a1512',letterSpacing:'1.5px'}}>
      <span style={{width:5,height:18,borderRadius:2,display:'inline-block',background:`linear-gradient(180deg, ${color}, #fb923c)`,boxShadow:`0 0 8px ${color}88`}}></span>
      {children}
    </h3>
  )
}

function EmptyState({icon,title,subtitle}:{icon:string,title:string,subtitle:string}) {
  return (
    <div className="relative rounded-3xl overflow-hidden text-center py-16" style={{background:cardGradient('#8f88ad'),border:'1px solid rgba(255,255,255,0.08)'}}>
      <GlowBeam color="#8f88ad"/>
      <i className={`ti ${icon}`} style={{fontSize:48,color:'rgba(255,255,255,0.15)'}}></i>
      <p className="text-base mt-4 font-bold" style={{color:TEXT_SECONDARY}}>{title}</p>
      <p className="text-sm mt-1" style={{color:TEXT_MUTED}}>{subtitle}</p>
    </div>
  )
}

function AwardCard({award,meta,isPT}:{award:any,meta:any,isPT:boolean}) {
  const isCoach=award.award_type==='coy'
  const entity=isCoach?award.coaches:award.players
  const team=entity?.teams
  const tc=team?readableTeamColorOnDark(team.color):meta.color
  const stats=award.stats_context
  const period = award.period?.startsWith('month_')
    ? formatMonthPeriod(award.period, isPT)
    : award.period?.startsWith('week_')
    ? formatWeekRange(parseInt(award.period.replace('week_',''),10), isPT?'pt-PT':'en-US')
    : award.period?.replace('season','2025-26')
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{background:cardGradient(meta.color, team?.color?tc:undefined),border:'1px solid rgba(255,255,255,0.08)',boxShadow:`0 12px 26px -16px ${meta.color}77`}}>
      <GlowBeam color={meta.color}/>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <i className={`ti ${meta.icon}`} style={{fontSize:14,color:meta.color,filter:`drop-shadow(0 0 5px ${meta.color}aa)`}}></i>
          <span className="text-[11px] font-black uppercase truncate" style={{color:meta.color,letterSpacing:'1.2px'}}>{meta.label}</span>
        </div>
        <div className="text-[10px] text-right flex-shrink-0" style={{color:TEXT_MUTED}}>
          {meta.desc&&<span>{meta.desc} · </span>}<span>{period}</span>
        </div>
      </div>
      <div className="px-4 pb-4">
        {entity?(
          <Link href={isCoach?`/staff/${entity.id}`:`/player/${entity.id}`} className="no-underline group flex items-center gap-3">
            <div className="rounded-full flex-shrink-0 p-[2.5px]" style={{width:56,height:56,background:`conic-gradient(from 180deg, ${tc}, #fff, ${tc})`,boxShadow:`0 0 12px 2px ${tc}77`}}>
              <div className="w-full h-full rounded-full overflow-hidden" style={{background:DARK_BG_2}}>
                {entity.photo_url||entity.logo_url
                  ?<img src={entity.photo_url||entity.logo_url} alt="" className="w-full h-full object-cover"/>
                  :<div className="w-full h-full flex items-center justify-center font-black text-sm" style={{color:tc}}>
                     {entity.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                   </div>}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-sm group-hover:underline truncate" style={{color:TEXT_PRIMARY}}>{entity.name}</div>
              <div className="text-xs font-bold truncate" style={{color:tc}}>{entity.pos&&<span className="mr-1.5">{entity.pos}</span>}{team?.name}</div>
              {stats&&(
                <div className="flex gap-2.5 mt-1.5 flex-wrap">
                  {stats.ppg&&<span className="text-[11px] font-bold" style={{color:TEXT_SECONDARY}}>{stats.ppg}<span style={{color:TEXT_MUTED,fontWeight:600}}> PPG</span></span>}
                  {stats.rpg&&<span className="text-[11px] font-bold" style={{color:TEXT_SECONDARY}}>{stats.rpg}<span style={{color:TEXT_MUTED,fontWeight:600}}> RPG</span></span>}
                  {stats.apg&&<span className="text-[11px] font-bold" style={{color:TEXT_SECONDARY}}>{stats.apg}<span style={{color:TEXT_MUTED,fontWeight:600}}> APG</span></span>}
                </div>
              )}
            </div>
          </Link>
        ):(
          <div className="text-center py-3" style={{color:TEXT_MUTED}}>
            <i className={`ti ${meta.icon}`} style={{fontSize:24,opacity:0.3}}></i>
            <p className="text-xs mt-2">{isPT?'Época em curso':'Season in progress'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Per-award-type "why they won" chips — each award's formula rewards a
// different stat mix (DPOY = defense, COY = wins above roster expectation,
// MIP = season-over-season delta), so a single generic ppg/rpg/apg row
// (the old behavior) hid the actual justification for anything but MVP.
function StatChip({value,label,accent}:{value:string|number,label:string,accent:string}) {
  return (
    <div className="flex-1 text-center px-1 min-w-0">
      <div className="text-lg sm:text-2xl font-black leading-none truncate" style={{color:'#fff',textShadow:`0 0 14px ${accent}bb`}}>{value}</div>
      <div className="text-[9px] font-bold uppercase mt-1" style={{color:TEXT_MUTED,letterSpacing:'0.6px'}}>{label}</div>
    </div>
  )
}

function awardChips(type:string, stats:any, isPT:boolean, accent:string) {
  if(!stats) return []
  const R = isPT ? {record:'RECORDE',def:'DEFESA',win:'VITÓRIAS',vs:'VS ESPERADO'} : {record:'RECORD',def:'DEFENSE',win:'WIN%',vs:'VS EXPECTED'}
  switch(type){
    case 'mvp': case 'roy': case 'finals_mvp':
      return [
        <StatChip key="ppg" value={stats.ppg} label="PPG" accent={accent}/>,
        <StatChip key="rpg" value={stats.rpg} label="RPG" accent={accent}/>,
        <StatChip key="apg" value={stats.apg} label="APG" accent={accent}/>,
        ...(stats.record?[<StatChip key="rec" value={stats.record} label={R.record} accent={accent}/>]:[]),
      ]
    case 'smoy':
      return [
        <StatChip key="ppg" value={stats.ppg} label="PPG" accent={accent}/>,
        <StatChip key="rpg" value={stats.rpg} label="RPG" accent={accent}/>,
        <StatChip key="apg" value={stats.apg} label="APG" accent={accent}/>,
      ]
    case 'mip':
      return [
        <StatChip key="ppg" value={`${stats.priorPpg}→${stats.ppg}`} label="PPG" accent={accent}/>,
        <StatChip key="rpg" value={stats.rpg} label="RPG" accent={accent}/>,
        <StatChip key="apg" value={stats.apg} label="APG" accent={accent}/>,
      ]
    case 'dpoy':
      return [
        <StatChip key="bpg" value={stats.bpg} label="BPG" accent={accent}/>,
        <StatChip key="spg" value={stats.spg} label="SPG" accent={accent}/>,
        ...(stats.defRank?[<StatChip key="def" value={`#${stats.defRank}`} label={R.def} accent={accent}/>]:[]),
      ]
    case 'coy':
      return [
        <StatChip key="rec" value={`${stats.wins}-${stats.losses}`} label={R.record} accent={accent}/>,
        <StatChip key="win" value={`${stats.winPct}%`} label={R.win} accent={accent}/>,
        ...(stats.diffPct?[<StatChip key="diff" value={`${Number(stats.diffPct)>=0?'+':''}${stats.diffPct}%`} label={R.vs} accent={accent}/>]:[]),
      ]
    default: return []
  }
}

function awardWhy(type:string, stats:any, isPT:boolean): string {
  if(!stats) return ''
  switch(type){
    case 'mvp': return isPT
      ? `${stats.ppg} PPG, ${stats.rpg} RPG e ${stats.apg} APG, liderando a equipa a um recorde de ${stats.record}.`
      : `${stats.ppg} PPG, ${stats.rpg} RPG and ${stats.apg} APG, leading the team to a ${stats.record} record.`
    case 'dpoy': return isPT
      ? `${stats.bpg} BPG e ${stats.spg} SPG, âncora d${stats.defRank?`a #${stats.defRank} melhor`:'e uma das melhores'} defesas da liga.`
      : `${stats.bpg} BPG and ${stats.spg} SPG, anchoring the league's ${stats.defRank?`#${stats.defRank}-ranked`:'a top'} defense.`
    case 'roy': return isPT
      ? `${stats.ppg} PPG, ${stats.rpg} RPG e ${stats.apg} APG em ${stats.games} jogos na época de estreia.`
      : `${stats.ppg} PPG, ${stats.rpg} RPG and ${stats.apg} APG across ${stats.games} games as a rookie.`
    case 'smoy': return isPT
      ? `${stats.ppg} PPG a sair do banco, com apenas ${stats.starts} titularidades em ${stats.games} jogos.`
      : `${stats.ppg} PPG off the bench, with just ${stats.starts} starts in ${stats.games} games.`
    case 'mip': return isPT
      ? `Subiu de ${stats.priorPpg} para ${stats.ppg} PPG (${Number(stats.ppgDelta)>=0?'+':''}${stats.ppgDelta}) face à época anterior.`
      : `Jumped from ${stats.priorPpg} to ${stats.ppg} PPG (${Number(stats.ppgDelta)>=0?'+':''}${stats.ppgDelta}) from last season.`
    case 'coy': return isPT
      ? `Recorde de ${stats.wins}-${stats.losses}, ${stats.diffPct}% acima do esperado para este plantel.`
      : `${stats.wins}-${stats.losses} record, ${stats.diffPct}% above what this roster projected to win.`
    case 'finals_mvp': return isPT
      ? `${stats.ppg} PPG, ${stats.rpg} RPG e ${stats.apg} APG ao longo da série do campeonato.`
      : `${stats.ppg} PPG, ${stats.rpg} RPG and ${stats.apg} APG across the championship series.`
    default: return ''
  }
}

// Trading-card treatment (conic ring, team-color glow, dark neon base)
// reused/adapted from the All-Star and Transactions pages — every season
// award is a trophy moment, so every card gets full "reveal" styling
// instead of a flat box.
function SeasonAwardCard({award,meta,isPT,featured}:{award:any,meta:any,isPT:boolean,featured?:boolean}) {
  const isCoach = award.award_type==='coy'
  const entity = isCoach ? award.coaches : award.players
  const team = entity?.teams
  const tc = team ? readableTeamColorOnDark(team.color) : meta.color
  const stats = award.stats_context
  const chips = awardChips(award.award_type, stats, isPT, meta.color)
  const why = awardWhy(award.award_type, stats, isPT)

  if(!entity){
    return (
      <div className="relative rounded-3xl overflow-hidden" style={{background:cardGradient(meta.color),border:'1px solid rgba(255,255,255,0.08)'}}>
        <GlowBeam color={meta.color}/>
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <i className={`ti ${meta.icon}`} style={{fontSize:16,color:meta.color,filter:`drop-shadow(0 0 6px ${meta.color}aa)`}}></i>
          <span className="text-xs font-black uppercase" style={{color:meta.color,letterSpacing:'1.5px'}}>{meta.label}</span>
        </div>
        <div className="p-6 text-center">
          <i className={`ti ${meta.icon}`} style={{fontSize:32,color:'rgba(255,255,255,0.15)'}}></i>
          <p className="text-sm mt-2 font-bold" style={{color:TEXT_SECONDARY}}>{isPT?'Época em curso':'Season in progress'}</p>
          <p className="text-xs mt-1" style={{color:TEXT_MUTED}}>{meta.desc}</p>
        </div>
      </div>
    )
  }

  const photoSize = featured ? 152 : 96
  return (
    <div className="relative rounded-3xl overflow-hidden" style={{
      background: featured
        ? `radial-gradient(circle at 50% -10%, ${tc}3d 0%, ${DARK_BG} 55%), ${CARD_TEXTURE}, ${DARK_BG}`
        : cardGradient(meta.color, team?.color?tc:undefined),
      border:'1px solid rgba(255,255,255,0.09)',
      boxShadow:`0 24px 50px -18px ${tc}55`}}>
      <GlowBeam color={meta.color}/>
      {featured&&(
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="font-black uppercase" style={{fontSize:170,color:'rgba(255,255,255,0.025)',letterSpacing:'-4px',whiteSpace:'nowrap'}}>{meta.label}</span>
        </div>
      )}
      <div className="relative px-5 pt-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className={`ti ${meta.icon}`} style={{fontSize:featured?22:15,color:meta.color,filter:`drop-shadow(0 0 8px ${meta.color}cc)`}}></i>
          <span className="font-black uppercase" style={{fontSize:featured?14:11,color:meta.color,letterSpacing:'2px'}}>{meta.label}</span>
        </div>
        {meta.desc&&<span className="text-[10px] font-bold" style={{color:TEXT_MUTED}}>{meta.desc}</span>}
      </div>
      <Link href={isCoach?`/staff/${entity.id}`:`/player/${entity.id}`} className="no-underline">
        <div className={`relative flex flex-col items-center px-5 ${featured?'pt-5 pb-7':'pt-3 pb-5'}`}>
          <div className="relative rounded-full mb-4" style={{
            width:photoSize,height:photoSize,padding:4,
            background:`conic-gradient(from 180deg, ${tc}, #fff, ${tc}, ${meta.color}, ${tc})`,
            boxShadow:`0 0 0 4px ${DARK_BG}, 0 0 32px 6px ${tc}aa`}}>
            <div className="w-full h-full rounded-full overflow-hidden relative" style={{background:DARK_BG_2}}>
              {entity.photo_url||entity.logo_url
                ?<img src={entity.photo_url||entity.logo_url} alt="" className="w-full h-full object-cover"/>
                :<div className="w-full h-full flex items-center justify-center font-black" style={{fontSize:featured?36:22,color:tc}}>
                   {entity.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                 </div>}
            </div>
            {team?.logo_url&&(
              <div className="absolute rounded-full overflow-hidden flex items-center justify-center" style={{
                width:featured?42:32,height:featured?42:32,right:-2,bottom:-2,background:DARK_BG,
                border:`2px solid ${tc}`,boxShadow:'0 3px 10px -2px rgba(0,0,0,0.7)'}}>
                <img src={team.logo_url} alt="" className="w-full h-full object-contain p-0.5"/>
              </div>
            )}
          </div>
          <div className="font-black text-center leading-tight uppercase" style={{fontSize:featured?28:18,color:'#fff',letterSpacing:'-0.5px',textShadow:`0 0 24px ${tc}55`}}>{entity.name}</div>
          <div className="text-xs font-bold mt-1" style={{color:tc}}>{entity.pos&&<span className="mr-1">{entity.pos}</span>}{team?.name}</div>

          {chips.length>0&&(
            <div className="relative flex items-stretch justify-center w-full mt-5 pt-4" style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>
              {chips}
            </div>
          )}
          {why&&<p className="relative text-[11px] text-center mt-3 leading-snug font-medium" style={{color:TEXT_SECONDARY,maxWidth:featured?440:undefined,marginLeft:'auto',marginRight:'auto'}}>{why}</p>}
        </div>
      </Link>
    </div>
  )
}

// All-NBA / All-Rookie "top 5" used to render as a plain vertical list —
// now a grid of mini trading cards (numbered badge, conic photo ring, team
// glow) so a starting five reads like a squad lineup instead of a table row.
function TeamAward({awards,type,meta,isPT,season}:{awards:any[],type:string,meta:any,isPT:boolean,season?:string}) {
  const members=awards.filter(a=>a.award_type===type)
  if(!meta)return null
  return (
    <div className="relative rounded-3xl overflow-hidden p-5" style={{background:cardGradient(meta.color),border:'1px solid rgba(255,255,255,0.08)'}}>
      <GlowBeam color={meta.color}/>
      <div className="flex items-center gap-2 mb-4">
        <i className={`ti ${meta.icon}`} style={{fontSize:16,color:meta.color,filter:`drop-shadow(0 0 6px ${meta.color}aa)`}}></i>
        <span className="text-xs font-black uppercase" style={{color:meta.color,letterSpacing:'1.5px'}}>{meta.label}</span>
        {season&&<span className="text-[10px] font-bold ml-auto" style={{color:TEXT_MUTED}}>{season}</span>}
      </div>
      {members.length===0?(
        <div className="text-center py-6" style={{color:TEXT_MUTED}}>
          <p className="text-sm">{isPT?'Disponível no final da época':'Available at end of season'}</p>
        </div>
      ):(
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {members.map((a:any,i:number)=>{
            const p=a.players; const tc=p?.teams?readableTeamColorOnDark(p.teams.color):meta.color
            const s=a.stats_context
            return (
              <Link key={a.id} href={`/player/${p?.id}`} className="relative no-underline group flex flex-col items-center rounded-2xl p-3 pt-4 text-center transition-transform hover:-translate-y-0.5" style={{background:'rgba(255,255,255,0.035)',border:`1px solid ${tc}33`}}>
                <span className="absolute top-1.5 left-1.5 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center z-10" style={{color:'#0f0b1e',background:tc}}>{i+1}</span>
                <div className="relative rounded-full mb-2 p-[2px]" style={{width:70,height:70,background:`conic-gradient(from 180deg, ${tc}, #fff, ${tc})`,boxShadow:`0 0 10px 1px ${tc}66`}}>
                  <div className="w-full h-full rounded-full overflow-hidden" style={{background:DARK_BG_2}}>
                    {p?.photo_url?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                      :<div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:tc}}>{p?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
                  </div>
                  {p?.teams?.logo_url&&(
                    <div className="absolute rounded-full overflow-hidden flex items-center justify-center" style={{
                      width:30,height:30,right:-4,bottom:-4,background:DARK_BG,
                      border:`2px solid ${tc}`,boxShadow:'0 2px 6px -1px rgba(0,0,0,0.7)'}}>
                      <img src={p.teams.logo_url} alt="" className="w-full h-full object-contain p-0.5"/>
                    </div>
                  )}
                </div>
                <div className="text-xs font-black leading-tight group-hover:underline w-full" style={{color:'#fff',minHeight:'2.4em',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{p?.name}</div>
                <div className="text-[10px] font-bold mt-1" style={{color:tc}}>{p?.pos} · {p?.teams?.id}</div>
                {s&&(
                  <div className="flex gap-3 mt-2.5 pt-2.5 w-full justify-center" style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>
                    {s.ppg&&<span className="text-sm font-black" style={{color:TEXT_SECONDARY}}>{s.ppg}<span className="text-[10px] font-bold" style={{color:TEXT_MUTED}}> PPG</span></span>}
                    {s.rpg&&<span className="text-sm font-black" style={{color:TEXT_SECONDARY}}>{s.rpg}<span className="text-[10px] font-bold" style={{color:TEXT_MUTED}}> RPG</span></span>}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {background:DARK_BG,border:'1px solid rgba(255,255,255,0.12)',color:'#fff'}

export default function AwardsPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const AWARD_META = isPT ? AWARD_META_PT : AWARD_META_EN
  const [tab,setTab] = useState<Tab>('weekly')
  const [awards,setAwards] = useState<any[]>([])
  const [loading,setLoading] = useState(true)

  // Weekly/Monthly always show the current (latest) season — only the
  // Season Awards tab lets the GM look back at a past season's trophies,
  // via the dropdown added below. Every season's rows are fetched once up
  // front (award counts per season are tiny — a season is a handful of
  // individual/team awards plus ~2-3 weekly/monthly rows — nowhere near the
  // PostgREST 1000-row page cap) and cached client-side by season so
  // switching the dropdown never re-fetches.
  const [allSeasons,setAllSeasons] = useState<string[]>([])
  const [selectedSeason,setSelectedSeason] = useState<string>('')
  const [yearlyAwards,setYearlyAwards] = useState<any[]>([])
  const seasonCacheRef = useRef<Record<string,any[]>>({})

  useEffect(()=>{
    fetchAllRows<any>((from,to) => supabase.from('awards')
      .select('*, players(id,name,pos,photo_url,team_id,teams:teams!players_team_id_fkey(id,name,color,logo_url)), coaches(id,name,role,team_id,teams(id,name,color,logo_url))')
      .order('season',{ascending:false}).order('award_type').order('created_at',{ascending:false}).range(from,to))
      .then((rows)=>{
        const seasons=Array.from(new Set(rows.map((r:any)=>r.season))).sort((a,b)=>b.localeCompare(a))
        const latest=seasons[0]||'2025-26'
        const cache:Record<string,any[]>={}
        for(const s of seasons) cache[s]=rows.filter((r:any)=>r.season===s)
        seasonCacheRef.current=cache
        setAllSeasons(seasons)
        setSelectedSeason(latest)
        setAwards(cache[latest]||[])
        setYearlyAwards(cache[latest]||[])
        setLoading(false)
      })
  },[])

  function selectSeason(season:string) {
    setSelectedSeason(season)
    setYearlyAwards(seasonCacheRef.current[season]||[])
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
      <div className="relative rounded-3xl overflow-hidden mb-6 px-6 py-7" style={{
        background:`radial-gradient(circle at 12% 15%, #f43f5e33 0%, ${DARK_BG} 55%), radial-gradient(circle at 90% 100%, #38bdf82e 0%, transparent 60%), ${CARD_TEXTURE}, ${DARK_BG}`,
        border:'1px solid rgba(255,255,255,0.08)'}}>
        <GlowBeam color="#f43f5e"/>
        <div className="relative flex items-center gap-3">
          <i className="ti ti-trophy" style={{fontSize:34,color:'#fbbf24',filter:'drop-shadow(0 0 16px #fbbf24bb)'}}></i>
          <div>
            <h1 className="font-black uppercase leading-none" style={{fontSize:30,letterSpacing:'-0.5px',background:'linear-gradient(90deg, #fff 40%, #c9c2e0)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              {isPT?'Prémios':'Awards'}
            </h1>
            <p className="text-xs font-black mt-1.5" style={{color:'#8f88ad',letterSpacing:'1.5px'}}>{(selectedSeason||'2025-26').toUpperCase()} {isPT?'ÉPOCA':'SEASON'}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-8 p-1.5 rounded-2xl w-fit" style={{background:DARK_BG,border:'1px solid rgba(255,255,255,0.06)'}}>
        {TABS.map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key as Tab)} className="no-underline">
            <div className="px-5 py-2.5 rounded-xl text-sm font-black uppercase transition-all" style={{
              color: tab===key ? '#fff' : TEXT_MUTED,
              background: tab===key ? 'linear-gradient(135deg, #f43f5e, #fb923c)' : 'transparent',
              boxShadow: tab===key ? '0 8px 18px -6px #f43f5e88' : 'none',
              cursor:'pointer', letterSpacing:'0.5px'}}>
              {label}
            </div>
          </button>
        ))}
      </div>

      {loading?<div className="text-center py-12" style={{color:'#8a8279'}}>{t('common.loading')}</div>:(
        <>
          {tab==='weekly'&&(
            weeklyPeriods.length===0?(
              <EmptyState icon="ti-star"
                title={isPT?'Ainda sem prémios semanais':'No weekly awards yet'}
                subtitle={isPT?'Os prémios são calculados após cada ciclo de simulação.':'Awards are calculated after each simulation run.'}/>
            ):(
              <>
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-xs font-black uppercase" style={{color:'#5c554e',letterSpacing:'1px'}}>{isPT?'Mês:':'Month:'}</span>
                  <select
                    value={selectedWeeklyMonth}
                    onChange={e=>setSelectedWeeklyMonth(e.target.value)}
                    className="text-sm font-bold px-3 py-2 rounded-lg"
                    style={selectStyle}>
                    {weeklyMonthKeys.map(mk=>(
                      <option key={mk} value={mk}>{formatMonthPeriod(`month_${mk}`,isPT)}</option>
                    ))}
                  </select>
                </div>
                {weeklyPeriodsInMonth.map((period:any)=>(
                  <div key={period} className="mb-8">
                    <SectionHeader color="#fb923c">{formatWeekRange(parseInt(period.replace('week_',''),10), isPT?'pt-PT':'en-US')}</SectionHeader>
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
              <EmptyState icon="ti-calendar-star"
                title={isPT?'Ainda sem prémios mensais':'No monthly awards yet'}
                subtitle={isPT?'Os prémios mensais são calculados no final de cada mês real do calendário.':'Monthly awards are calculated at the end of each real calendar month.'}/>
            ):monthlyPeriods.map((period:any)=>(
              <div key={period} className="mb-8">
                <SectionHeader color="#38bdf8">{formatMonthPeriod(period, isPT)}</SectionHeader>
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
              <div className="flex items-center gap-2 mb-6">
                <span className="text-xs font-black uppercase" style={{color:'#5c554e',letterSpacing:'1px'}}>{isPT?'Época:':'Season:'}</span>
                <select
                  value={selectedSeason}
                  onChange={e=>selectSeason(e.target.value)}
                  disabled={allSeasons.length<=1}
                  className="text-sm font-bold px-3 py-2 rounded-lg"
                  style={{...selectStyle,opacity:allSeasons.length<=1?0.7:1}}>
                  {allSeasons.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <SectionHeader color="#f43f5e">{isPT?'Prémio Máximo':'Marquee Award'}</SectionHeader>
              <div className="mb-8">
                <SeasonAwardCard award={yearlyAwards.find((aw:any)=>aw.award_type==='mvp')||{award_type:'mvp'}} meta={AWARD_META['mvp']} isPT={isPT} featured/>
              </div>
              <SectionHeader color="#22d3ee">{isPT?'Prémios Individuais':'Individual Awards'}</SectionHeader>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                {['dpoy','roy','coy','mip','smoy','finals_mvp'].map(type=>{
                  const a=yearlyAwards.find((aw:any)=>aw.award_type===type)
                  const meta=AWARD_META[type]
                  return <SeasonAwardCard key={type} award={a||{award_type:type}} meta={meta} isPT={isPT}/>
                })}
              </div>
              <SectionHeader color="#fbbf24">{isPT?'Equipas All-NBA':'All-NBA Teams'}</SectionHeader>
              <div className="flex flex-col gap-4 mb-8">
                {['all_nba_1','all_nba_2','all_nba_3'].map(type=><TeamAward key={type} awards={yearlyAwards} type={type} meta={AWARD_META[type]} isPT={isPT} season={selectedSeason}/>)}
              </div>
              <SectionHeader color="#a78bfa">{isPT?'Equipas de Caloiros':'All-Rookie Teams'}</SectionHeader>
              <div className="flex flex-col gap-4">
                {['all_rookie_1','all_rookie_2'].map(type=><TeamAward key={type} awards={yearlyAwards} type={type} meta={AWARD_META[type]} isPT={isPT} season={selectedSeason}/>)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

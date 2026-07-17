'use client'
import { useTranslation } from '@/components/I18nProvider'
import Link from 'next/link'

export function WeeklyHighlightsHeader() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <div className="section-header mb-5">
      <span className="text-xs font-semibold uppercase tracking-widest" style={{color:'#1a1612',letterSpacing:'1.5px'}}>
        <i className="ti ti-flame" style={{fontSize:14,marginRight:6,color:'#b45309'}}></i>
        {isPT ? 'Destaques da Semana' : 'Weekly Highlights'}
      </span>
    </div>
  )
}

export function HighlightCardTitle({ icon, color, textEN, textPT }: { icon:string, color:string, textEN:string, textPT:string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <div className="flex items-center gap-2 mb-4 pb-3" style={{borderBottom:'1px solid #ddd8ce'}}>
      <i className={`ti ${icon}`} style={{fontSize:18,color}}></i>
      <span className="text-xs font-bold uppercase tracking-widest" style={{color,letterSpacing:'1px'}}>
        {isPT ? textPT : textEN}
      </span>
    </div>
  )
}

export function HighlightEmpty({ icon, textEN, textPT }: { icon:string, textEN:string, textPT:string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <div className="text-center py-6">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm" style={{color:'#6b5f4e'}}>{isPT ? textPT : textEN}</p>
    </div>
  )
}

export function ViewBoxScore({ gameId, red }: { gameId:string, red?:boolean }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <Link href={`/game/${gameId}`}
      className="block text-center text-xs no-underline py-2 rounded-lg font-semibold"
      style={red ? {background:'#fee2e2',color:'#dc2626'} : {background:'#fef3c7',color:'#b45309'}}>
      {isPT ? 'Ver Box Score →' : 'View Box Score →'}
    </Link>
  )
}

export function ViewTeamLink({ teamId }: { teamId:string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <Link href={`/team/${teamId}`}
      className="block text-center text-xs no-underline py-2 mt-3 rounded-lg font-semibold"
      style={{background:'#fed7aa',color:'#9a3412'}}>
      {isPT ? 'Ver Equipa →' : 'View Team →'}
    </Link>
  )
}

export function WinStreakLabel({ wins }: { wins:number }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <span className="text-xl font-black" style={{color:'#c2410c'}}>
      {isPT ? `${wins} vitórias seguidas` : `${wins}-game win streak`}
    </span>
  )
}

export function FeaturedHeader() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <div className="section-header mb-5">
      <span className="text-xs font-semibold uppercase tracking-widest" style={{color:'#1a1612',letterSpacing:'1.5px'}}>
        <i className="ti ti-pin" style={{fontSize:14,marginRight:6,color:'#b45309'}}></i>
        {isPT ? 'Destaque' : 'Featured'}
      </span>
    </div>
  )
}

export function FeaturedLabel({ color }: { color:string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <div className="text-xs font-bold mb-2 uppercase tracking-widest" style={{color}}>
      📌 {isPT ? 'Destaque' : 'Featured'}
    </div>
  )
}

// pct is always the UNDERDOG's (the eventual winner's) pre-game win chance —
// shown attached to each team instead of floating unlabeled between the two
// logos, so it's clear at a glance which side was actually expected to win.
export function UnderdogLabel({ pct, role }: { pct:number, role: 'underdog'|'favorite' }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  if (role === 'underdog') {
    return <div className="text-xs font-bold" style={{color:'#dc2626'}}>{isPT ? `🎲 ${pct}% outsider` : `🎲 ${pct}% underdog`}</div>
  }
  return <div className="text-xs" style={{color:'#9c8e7a'}}>{isPT ? `${100-pct}% favorito` : `${100-pct}% favorite`}</div>
}

export function UotwWinLoss({ isWin }: { isWin:boolean }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <div className="text-xs font-bold text-center" style={{color: isWin ? '#166534' : '#dc2626'}}>
      {isWin ? (isPT ? 'VIT' : 'WIN') : (isPT ? 'DER' : 'LOSS')}
    </div>
  )
}

export function WinBadge() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <span className="font-bold px-1.5 py-0.5 rounded" style={{background:'#15803d',color:'#fff'}}>
      {isPT ? 'V' : 'W'}
    </span>
  )
}

export function SeasonBadge() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return <p className="text-lg" style={{color:'#6b5f4e'}}>{isPT ? 'Época 2025-26' : '2025-26 Season'}</p>
}

export function ArticleDate({ date }: { date: string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <p className="text-sm mt-3" style={{color:'#9c8e7a'}}>
      {new Date(date).toLocaleDateString(isPT?'pt-PT':'en-US',{month:'long',day:'numeric',year:'numeric'})}
    </p>
  )
}

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

export function RecentResultsHeader() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return (
    <div className="section-header mb-4">
      <span className="text-xs font-semibold uppercase tracking-widest" style={{color:'#1a1612',letterSpacing:'1.5px'}}>
        <i className="ti ti-ball-basketball" style={{fontSize:14,marginRight:6,color:'#b45309'}}></i>
        {isPT ? 'Resultados Recentes' : 'Recent Results'}
      </span>
      <Link href="/schedule" className="text-xs no-underline font-semibold" style={{color:'#b45309'}}>
        {isPT ? 'Calendário Completo →' : 'Full Schedule →'}
      </Link>
    </div>
  )
}

export function BoxScoreLink() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return <span className="text-xs" style={{color:'#b8ae9e'}}>{isPT ? 'Box Score →' : 'Box Score →'}</span>
}

export function UnderdogLabel({ pct }: { pct:number }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  return <div className="text-xs" style={{color:'#9c8e7a'}}>{isPT ? `${pct}% azarão` : `${pct}% underdog`}</div>
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

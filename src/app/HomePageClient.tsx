'use client'
import { useTranslation } from '@/components/I18nProvider'
import Link from 'next/link'
import { getStatusForWeek, getHalfWeekDates, getSimDate, formatWeekRange, SEASON_STATUS_COLORS, SEASON_STATUS_LABELS } from '@/lib/season-week-helper'

// Homepage "at a glance" calendar card — same color palette as the navbar's
// SimulatorBanner strip (SEASON_STATUS_COLORS), so a GM learns one color
// per season phase once and recognizes it everywhere on the site.
export function HomeCalendarCard({ config, nextEvent }: { config: any, nextEvent: any }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const locale = isPT ? 'pt-PT' : 'en-US'

  if (!config) return null

  const week = config.current_week || 0
  const nextWeek = week + 1
  const status = getStatusForWeek(week)
  const nextStatus = getStatusForWeek(nextWeek)
  const sc = SEASON_STATUS_COLORS[status] || SEASON_STATUS_COLORS['offseason']
  const label = SEASON_STATUS_LABELS[status] ? (isPT ? SEASON_STATUS_LABELS[status].pt : SEASON_STATUS_LABELS[status].en) : status
  const nextLabel = SEASON_STATUS_LABELS[nextStatus] ? (isPT ? SEASON_STATUS_LABELS[nextStatus].pt : SEASON_STATUS_LABELS[nextStatus].en) : nextStatus

  const nextHalf: 1 | 2 = config.next_sim_half === 2 ? 2 : 1
  const { start: blockStart, end: blockEnd } = nextWeek > 0
    ? getHalfWeekDates(nextWeek, nextHalf)
    : { start: new Date('2025-10-01'), end: new Date('2025-10-07') }
  const fmtDate = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  const fmtEventDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' })

  const SIM_DAY_PT: Record<string, string> = {
    Monday: 'Segunda', Tuesday: 'Terça', Wednesday: 'Quarta',
    Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sábado', Sunday: 'Domingo',
  }
  const simDay = (d: string) => isPT ? (SIM_DAY_PT[d] ?? d) : d

  const eventSoon = (() => {
    if (!nextEvent) return false
    const simToday = getSimDate(week || 1)
    const evStart = new Date(nextEvent.start_date + 'T00:00:00')
    const daysUntil = Math.round((evStart.getTime() - simToday.getTime()) / 86400000)
    return daysUntil <= 14
  })()

  return (
    <div className="rounded-2xl flex flex-col gap-3" style={{background:'#0a0f1a',border:'1px solid #1f2937',padding:'16px',height:280,width:260,flexShrink:0}}>
      <div className="text-xs font-bold uppercase tracking-widest" style={{color:'#8a8279',letterSpacing:'1px'}}>
        📅 {isPT ? 'Calendário' : 'Calendar'}
      </div>

      <div>
        <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full w-fit"
          style={{ background: sc.bg, color: sc.text }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block', boxShadow: `0 0 6px ${sc.dot}` }} />
          {label}
        </span>
        {week > 0 && <div className="text-sm font-semibold mt-1.5" style={{color:'#d4cdc5'}}>{formatWeekRange(week, locale)}</div>}
      </div>

      <div style={{borderTop:'1px solid #1f2937',paddingTop:10}}>
        <div className="text-xs" style={{color:'#8a8279'}}>{isPT ? 'Próxima simulação' : 'Next simulation'}</div>
        <div className="text-sm font-semibold mt-0.5" style={{color: sc.text}}>
          {nextStatus !== status ? `${nextLabel} · ` : ''}{fmtDate(blockStart)}–{fmtDate(blockEnd)}
        </div>
        <div className="text-xs mt-0.5" style={{color:'#8a8279'}}>
          {isPT ? 'Simula-se às' : 'Simulates on'} {simDay(config.sim_day_1)} {isPT ? 'e' : '&'} {simDay(config.sim_day_2)}
        </div>
      </div>

      {nextEvent && (
        <div style={{borderTop:'1px solid #1f2937',paddingTop:10,marginTop:'auto'}}>
          <div className="text-xs mb-1.5" style={{color:'#8a8279'}}>{isPT ? 'A seguir' : 'Coming up'}</div>
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full w-fit"
            style={eventSoon ? {background: nextEvent.color || '#b45309', color: '#fff'} : {background:'#1f2937', color:'#d4cdc5'}}>
            {nextEvent.icon} {nextEvent.event_name} · {fmtEventDate(nextEvent.start_date)}
          </span>
        </div>
      )}
    </div>
  )
}

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

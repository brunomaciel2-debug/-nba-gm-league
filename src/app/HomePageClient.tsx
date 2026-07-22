'use client'
import { useTranslation } from '@/components/I18nProvider'
import Link from 'next/link'
import { getStatusForWeek, getHalfWeekDates, SEASON_STATUS_COLORS, SEASON_STATUS_LABELS } from '@/lib/season-week-helper'

const WEEKDAY_PT = ['D','S','T','Q','Q','S','S']
const WEEKDAY_EN = ['S','M','T','W','T','F','S']
const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

function ymd(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

// 6 full weeks (42 days) starting on the Sunday on/before the 1st — always
// enough rows for any month, muted leading/trailing days from neighbors.
function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

// Homepage "at a glance" calendar — a real month grid (not another status
// summary; the navbar's SimulatorBanner strip already covers that) showing
// the SIMULATED season calendar: today (the last simulated day), the
// specific days of the next simulation block, and every upcoming event that
// falls within the visible month — not just the single nearest one, so e.g.
// "G League Playoffs Begin" still shows up alongside "G League Finals"
// rather than only ever the closest of the two. Same color palette as the
// navbar (SEASON_STATUS_COLORS) so a GM recognizes one color per season
// phase everywhere on the site.
export function HomeCalendarCard({ config, upcomingEvents }: { config: any, upcomingEvents: any[] }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  if (!config) return null

  const week = config.current_week || 0
  const nextWeek = week + 1
  const status = getStatusForWeek(week)
  const sc = SEASON_STATUS_COLORS[status] || SEASON_STATUS_COLORS['offseason']
  const label = SEASON_STATUS_LABELS[status] ? (isPT ? SEASON_STATUS_LABELS[status].pt : SEASON_STATUS_LABELS[status].en) : status

  // "Today" is the last day of the last fully-simulated week — a single
  // date, not a 7-day span (the whole week isn't equally "now").
  const today = week > 0 ? getHalfWeekDates(week, 2).end : new Date('2025-10-01')

  const nextHalf: 1 | 2 = config.next_sim_half === 2 ? 2 : 1
  const { start: blockStart, end: blockEnd } = nextWeek > 0
    ? getHalfWeekDates(nextWeek, nextHalf)
    : { start: new Date('2025-10-01'), end: new Date('2025-10-07') }

  // The grid shows whichever month the upcoming simulation block falls in —
  // that's the thing a GM actually wants to see coming up, more than the
  // (possibly already-finished) current week.
  const gridMonth = blockStart
  const days = getMonthGrid(gridMonth.getFullYear(), gridMonth.getMonth())
  const weekdayLabels = isPT ? WEEKDAY_PT : WEEKDAY_EN
  const monthLabel = `${(isPT ? MONTH_NAMES_PT : MONTH_NAMES_EN)[gridMonth.getMonth()]} ${gridMonth.getFullYear()}`

  const todayStr = ymd(today)
  const blockStartStr = ymd(blockStart), blockEndStr = ymd(blockEnd)

  // Only list, in the legend, events that actually land on a visible cell —
  // no point explaining a color nobody sees this month.
  const visibleEvents = (upcomingEvents || []).filter(ev => days.some(d => ymd(d) === ev.start_date))

  // Several events share the same category color in season_events (e.g.
  // every G-League milestone is stored green) — fine for a single badge
  // elsewhere, but useless here when 2-3 of them show up together and need
  // to be told apart. Assigns each VISIBLE event its own color from a fixed
  // palette instead, cycling if there are ever more events than colors.
  const MARKER_PALETTE = ['#dc2626','#1d4ed8','#15803d','#b45309','#7c3aed','#0e7490','#db2777']
  const markerColorById: Record<string, string> = {}
  visibleEvents.forEach((ev, i) => { markerColorById[ev.id] = MARKER_PALETTE[i % MARKER_PALETTE.length] })

  const eventByDate: Record<string, any> = {}
  ;(upcomingEvents || []).forEach(ev => { if (!eventByDate[ev.start_date]) eventByDate[ev.start_date] = ev })

  // Fixed at the card's natural size with a typical 3-event legend — locked
  // instead of content-driven so the banner next to it (which stretches to
  // match via flexbox) always gets the exact same height, letting Bruno
  // commission a banner image sized to fit this box with zero cropping,
  // ever. The legend area scrolls internally on the rare month with more
  // events than fit, instead of growing the whole card.
  const CARD_HEIGHT = 383

  return (
    <div className="rounded-2xl flex flex-col" style={{background:'#faf8f5',border:'1px solid #d4cdc5',padding:'14px 16px',width:300,height:CARD_HEIGHT,flexShrink:0}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold" style={{color:'#1a1512'}}>{monthLabel}</span>
        <span className="flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: sc.bg, color: sc.text }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
          {label}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {weekdayLabels.map((w, i) => (
          <div key={i} className="text-center text-xs font-bold" style={{color:'#b0a89e'}}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const dStr = ymd(d)
          const inGridMonth = d.getMonth() === gridMonth.getMonth()
          const isToday = dStr === todayStr
          const isNextBlock = dStr >= blockStartStr && dStr <= blockEndStr
          const ev = eventByDate[dStr]
          return (
            <div key={i} className="flex items-center justify-center relative" style={{height:30}}>
              <div className="flex items-center justify-center rounded-full text-xs"
                style={{
                  width: 26, height: 26, fontWeight: (isToday || isNextBlock) ? 800 : 500,
                  color: !inGridMonth ? '#d4cdc5' : isToday ? '#fff' : isNextBlock ? sc.text : '#3d3731',
                  background: isToday ? '#1a1512' : isNextBlock ? sc.bg : 'transparent',
                }}>
                {d.getDate()}
              </div>
              {ev && <div style={{position:'absolute',bottom:0,width:5,height:5,borderRadius:'50%',background:markerColorById[ev.id]||ev.color||'#b45309'}} />}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 mt-2 pt-2 flex-wrap flex-1 overflow-y-auto content-start" style={{borderTop:'1px solid #e2dcd5'}}>
        <span className="flex items-center gap-1 text-xs" style={{color:'#5c554e'}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:'#1a1512',display:'inline-block'}}/>
          {isPT ? 'Hoje' : 'Today'}
        </span>
        <span className="flex items-center gap-1 text-xs" style={{color:'#5c554e'}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:sc.bg,border:`1px solid ${sc.dot}`,display:'inline-block'}}/>
          {isPT ? 'Próxima simulação' : 'Next simulation'}
        </span>
        {visibleEvents.map(ev => (
          <span key={ev.id} className="flex items-center gap-1 text-xs" style={{color:'#5c554e'}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:markerColorById[ev.id]||ev.color||'#b45309',display:'inline-block'}}/>
            {ev.icon} {ev.event_name}
          </span>
        ))}
      </div>
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

'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { useTranslation } from './I18nProvider'
import InboxButton from './InboxButton'
import ChatButton from './ChatButton'
import SimulatorBanner from './SimulatorBanner'
import LanguageSwitcher from './LanguageSwitcher'
import GlobalSearch from './GlobalSearch'

// Dark-bar styling shared by every top-level nav link/dropdown trigger — the
// whole nav row now lives on the same dark strip as the logo/icons (merged
// from what used to be two separate bars), so these replace the old
// light-background colors (#2d2722 text / red-on-hover) with white-on-dark.
const navBtnStyle: React.CSSProperties = {
  padding: '9px 9px', fontSize: 13, fontWeight: 600, color: '#c9d1d9',
  borderBottom: '3px solid transparent', marginBottom: -1, whiteSpace: 'nowrap',
}
const navBtnHover = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderBottomColor = '#c8102e' }
const navBtnLeave = (e: React.MouseEvent<HTMLElement>, active: boolean) => { if (!active) { e.currentTarget.style.color = '#c9d1d9'; e.currentTarget.style.borderBottomColor = 'transparent' } }

function NavDropdown({ label, icon, items, onNavigate }: {
  label: string, icon: string, items: any[], onNavigate: () => void
}) {
  const [open, setOpen] = useState(false)
  // Sub-groups (Rules & Info's Roster & Contracts/On the Court/etc.) start
  // collapsed — Bruno: even grouped, a 21-item list still meant "muito
  // scroll down" just to open the dropdown. Clicking a group heading
  // toggles just that section instead of showing everything at once.
  // League/Events items have no `group` field, so this never engages for
  // them — they still render as a plain flat list, unchanged.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const ref = useRef<HTMLDivElement>(null)
  const hasGroups = items.some((item: any) => item.group)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 no-underline transition-all"
        style={{ ...navBtnStyle, color: open ? '#fff' : navBtnStyle.color, borderBottomColor: open ? '#c8102e' : 'transparent', background: 'transparent', border: 'none', borderBottomWidth: 3, borderBottomStyle: 'solid', cursor: 'pointer' }}
        onMouseEnter={navBtnHover}
        onMouseLeave={e => navBtnLeave(e, open)}>
        <i className={`ti ${icon}`} style={{ fontSize: 14 }}></i>
        {label}
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 13, marginLeft: 2, color: '#d4a537' }}></i>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 rounded-xl py-1"
             style={{ background: '#ede8df', border: '1px solid #cec8be', minWidth: 220, maxHeight: '75vh', overflowY: 'auto',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.2)', marginTop: 8 }}>
          {items.map((item: any, i: number) => {
            const showGroup = item.group && item.group !== items[i - 1]?.group
            if (hasGroups && item.group && !showGroup && !openGroups[item.group]) return null
            return (
              <div key={item.href}>
                {showGroup && (
                  <button type="button" onClick={() => setOpenGroups(prev => ({ ...prev, [item.group]: !prev[item.group] }))}
                    className="w-full flex items-center justify-between"
                    style={{
                      margin: i === 0 ? '4px 8px 2px' : '10px 8px 2px', padding: '4px 6px',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
                      textTransform: 'uppercase', color: '#8a8279',
                      background: 'transparent', border: 'none', cursor: 'pointer', width: 'calc(100% - 16px)',
                    }}>
                    {item.group}
                    <i className={`ti ti-chevron-${openGroups[item.group] ? 'up' : 'down'}`} style={{ fontSize: 11 }}></i>
                  </button>
                )}
                {showGroup && i !== 0 && <div style={{ height: 1, background: '#d6d0c6', margin: '0 12px 4px' }} />}
                {(!item.group || openGroups[item.group]) && (
                  <Link href={item.href}
                    onClick={() => { setOpen(false); onNavigate() }}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs no-underline transition-all"
                    style={{ color: '#2d2722', borderBottom: '1px solid #d6d0c6' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#e2dbd0')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <i className={`ti ${item.icon}`} style={{ fontSize: 14, color: '#c8102e' }}></i>
                    {item.label}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [commOpen, setCommOpen] = useState(false)
  const [gmOpen, setGmOpen] = useState(false)
  // The mobile drawer used to flatten every dropdown into one long
  // alphabetized list (Bruno: "tenho de fazer muito scroll down e up") —
  // these track which of the desktop's own groups (League/Events/Rules)
  // are expanded, defaulting to all collapsed so the drawer opens short.
  const [mobileGroupsOpen, setMobileGroupsOpen] = useState<Record<string, boolean>>({})
  const toggleMobileGroup = (key: string) => setMobileGroupsOpen(prev => ({ ...prev, [key]: !prev[key] }))
  const { user, profile, loading, signOut } = useAuth()
  const { t } = useTranslation()

  // isPT computed inside component so I18nProvider is ready
  const isPT = t('common.save') === 'Guardar'
  const teamId = (profile as any)?.team_id

  // All dropdowns built inside the component after i18n is ready
  const NAV_DROPDOWNS = [
    {
      label: isPT ? 'Liga' : 'League',
      icon: 'ti-ball-basketball',
      items: [
        { label: isPT ? 'Equipas'          : 'Teams',           href: '/teams',          icon: 'ti-users' },
        { label: isPT ? 'Classificação'    : 'Standings',       href: '/standings',      icon: 'ti-list-numbers', group: isPT ? 'Classificação & Calendário' : 'Standings & Schedule' },
        { label: isPT ? 'Calendário'       : 'Schedule',        href: '/schedule',       icon: 'ti-calendar', group: isPT ? 'Classificação & Calendário' : 'Standings & Schedule' },
        { label: isPT ? 'Margem Salarial'  : 'Cap Space',       href: '/cap-space',      icon: 'ti-cash', group: isPT ? 'Transações' : 'Transactions' },
        { label: isPT ? 'Free Agents'      : 'Free Agents',     href: '/free-agents',    icon: 'ti-user-plus', group: isPT ? 'Transações' : 'Transactions' },
        { label: isPT ? 'Trade Center'     : 'Trade Center',    href: '/trade-center',   icon: 'ti-switch-horizontal', group: isPT ? 'Transações' : 'Transactions' },
        { label: isPT ? 'Lesões'           : 'Injuries',        href: '/injuries',       icon: 'ti-first-aid-kit', group: isPT ? 'Transações' : 'Transactions' },
        { label: isPT ? 'Transações'       : 'Transactions',    href: '/transactions',   icon: 'ti-arrows-exchange', group: isPT ? 'Transações' : 'Transactions' },
        { label: isPT ? 'Líderes da Liga'  : 'League Leaders',  href: '/league-leaders', icon: 'ti-trophy', group: isPT ? 'Estatísticas & Rankings' : 'Stats & Rankings' },
        { label: isPT ? 'Power Rankings'   : 'Power Rankings',  href: '/power-rankings', icon: 'ti-trending-up', group: isPT ? 'Estatísticas & Rankings' : 'Stats & Rankings' },
        { label: isPT ? 'Recordes'         : 'Records',         href: '/records',        icon: 'ti-clipboard-list', group: isPT ? 'Estatísticas & Rankings' : 'Stats & Rankings' },
        { label: isPT ? 'Ranking de Arbitragem' : 'Officials Ranking', href: '/officials-ranking', icon: 'ti-gavel', group: isPT ? 'Estatísticas & Rankings' : 'Stats & Rankings' },
      ],
    },
    {
      label: isPT ? 'Eventos' : 'Events',
      icon: 'ti-star',
      items: [
        { label: 'All-Star',                               href: '/all-star',  icon: 'ti-star' },
        { label: isPT ? 'Prémios'   : 'Awards',           href: '/awards',    icon: 'ti-award' },
        { label: 'Draft',                                  href: '/draft',     icon: 'ti-clipboard-list' },
        { label: 'Summer League',                          href: '/summer-league', icon: 'ti-sun' },
        { label: 'Playoffs',                               href: '/playoffs',  icon: 'ti-tournament' },
      ],
    },
    {
      // Used to be a single plain link — G-League's own page already has 5
      // internal tabs (Teams/Standings/Schedule/Leaders/Playoffs) with
      // nothing in the navbar pointing at them directly.
      label: 'G-League',
      icon: 'ti-ball-basketball',
      items: [
        { label: isPT ? 'Equipas'          : 'Teams',          href: '/gleague?tab=teams',     icon: 'ti-users' },
        { label: isPT ? 'Classificação'    : 'Standings',      href: '/gleague?tab=standings', icon: 'ti-list-numbers' },
        { label: isPT ? 'Calendário'       : 'Schedule',       href: '/gleague?tab=schedule',  icon: 'ti-calendar' },
        { label: isPT ? 'Líderes'          : 'League Leaders', href: '/gleague?tab=leaders',   icon: 'ti-trophy' },
        { label: 'Playoffs',                                   href: '/gleague?tab=playoffs',  icon: 'ti-tournament' },
      ],
    },
  ]

  // Rules & Info lives on the right side of the navbar — it's reference
  // material, a different kind of thing from the league-navigation
  // dropdowns on the left (Bruno's call: these are "quite different
  // subjects").
  const RULES_DROPDOWN = {
    label: isPT ? 'Regras & Info' : 'Rules & Info',
    icon: 'ti-book',
    items: [
      // 1. Roster & Contracts
      { label: isPT ? 'Regras do Tecto Salarial'  : 'Salary Cap Rules',    href: '/rules/cap',      icon: 'ti-cash', group: isPT ? 'Plantel & Contratos' : 'Roster & Contracts' },
      { label: isPT ? 'Regras de Contratos'        : 'Contract Rules',      href: '/rules/contracts',icon: 'ti-file-text', group: isPT ? 'Plantel & Contratos' : 'Roster & Contracts' },
      { label: isPT ? 'Regras de Trades'           : 'Trade Rules',         href: '/rules/trades',   icon: 'ti-switch-horizontal', group: isPT ? 'Plantel & Contratos' : 'Roster & Contracts' },
      { label: isPT ? 'Regras de Free Agency'      : 'Free Agency Rules',   href: '/rules/free-agency', icon: 'ti-user-dollar', group: isPT ? 'Plantel & Contratos' : 'Roster & Contracts' },
      { label: isPT ? 'Regras do Draft'            : 'Draft Rules',         href: '/rules/draft',    icon: 'ti-clipboard-list', group: isPT ? 'Plantel & Contratos' : 'Roster & Contracts' },
      // 2. On the Court
      { label: isPT ? 'Regras de Faltas'  : 'Foul Rules',href: '/rules/technical-fouls', icon: 'ti-flag', group: isPT ? 'Em Campo' : 'On the Court' },
      { label: isPT ? 'Regras de Lesões'           : 'Injury Rules',        href: '/rules/injuries', icon: 'ti-first-aid-kit', group: isPT ? 'Em Campo' : 'On the Court' },
      { label: isPT ? 'Regras da G-League'         : 'G-League Rules',      href: '/rules/gleague',  icon: 'ti-ball-basketball', group: isPT ? 'Em Campo' : 'On the Court' },
      { label: isPT ? 'Regras de Prémios'          : 'Awards Rules',        href: '/rules/awards',   icon: 'ti-trophy', group: isPT ? 'Em Campo' : 'On the Court' },
      { label: isPT ? 'Regras de Líderes da Liga'  : 'League Leaders Rules',href: '/rules/league-leaders', icon: 'ti-chart-bar', group: isPT ? 'Em Campo' : 'On the Court' },
      // 3. Player & Team Development (renamed from "Player Development")
      { label: isPT ? 'Regras de Treino'           : 'Training Rules',      href: '/rules/training', icon: 'ti-barbell', group: isPT ? 'Desenvolvimento de Jogador & Equipa' : 'Player & Team Development' },
      { label: isPT ? 'Familiaridade Tática'      : 'Tactical Familiarity', href: '/rules/tactical-systems', icon: 'ti-brain', group: isPT ? 'Desenvolvimento de Jogador & Equipa' : 'Player & Team Development' },
      { label: isPT ? 'Guia de Scouting'          : 'Scouting Guide',       href: '/rules/scouting', icon: 'ti-search', group: isPT ? 'Desenvolvimento de Jogador & Equipa' : 'Player & Team Development' },
      // 4. Team Management
      { label: isPT ? 'Guia das Ordens Semanais'  : 'Weekly Orders Guide',  href: '/rules/orders',   icon: 'ti-clipboard-list', group: isPT ? 'Gestão de Equipa' : 'Team Management' },
      { label: isPT ? 'Moral e Interações'          : 'Morale & Interactions', href: '/rules/interactions', icon: 'ti-message-circle', group: isPT ? 'Gestão de Equipa' : 'Team Management' },
      { label: isPT ? 'Regras de Retirada'         : 'Retirement Rules',    href: '/rules/retirement', icon: 'ti-door-exit', group: isPT ? 'Gestão de Equipa' : 'Team Management' },
      { label: isPT ? 'Regras do Psychology Office' : 'Psychology Office Rules', href: '/rules/psychology-office', icon: 'ti-brain', group: isPT ? 'Gestão de Equipa' : 'Team Management' },
      { label: isPT ? 'Satisfação e Avaliação do GM' : 'GM Satisfaction & Evaluation', href: '/rules/satisfaction', icon: 'ti-clipboard-check', group: isPT ? 'Gestão de Equipa' : 'Team Management' },
      // 5. Business
      { label: isPT ? 'Finanças e Economia da Arena' : 'Finances & Arena Economy', href: '/rules/finances', icon: 'ti-building-stadium', group: isPT ? 'Negócio' : 'Business' },
      { label: isPT ? 'Objetivos de Patrocínio'   : 'Sponsor Objectives',   href: '/rules/sponsors', icon: 'ti-target-arrow', group: isPT ? 'Negócio' : 'Business' },
      { label: isPT ? 'Regras de Merchandising'   : 'Merchandising Rules',  href: '/rules/merchandising', icon: 'ti-shirt', group: isPT ? 'Negócio' : 'Business' },
    ],
  }

  // Job Openings sits on the right, next to Rules & Info — same reasoning.
  const NAV_LINKS_RIGHT = [
    { label: isPT ? 'Vagas de GM' : 'Job Openings', href: '/jobs', icon: 'ti-briefcase' },
  ]

  const COMM_LINKS = isPT ? [
    { href: '/admin',              label: 'Painel do Comissário', icon: 'ti-settings' },
    { href: '/admin/article/new',  label: 'Escrever Artigo',      icon: 'ti-pencil' },
    { href: '/admin/articles',     label: 'Gerir Artigos',        icon: 'ti-news' },
    { href: '/admin/media',        label: 'Gestor de Media',      icon: 'ti-photo' },
    { href: '/admin/coaches',      label: 'Staff Técnico',        icon: 'ti-whistle' },
    { href: '/admin/applications', label: 'Candidaturas GM',      icon: 'ti-clipboard-list' },
    { href: '/admin/gms',          label: 'Gerir GMs',            icon: 'ti-users' },
    { href: '/preseason',          label: 'Amigáveis (por equipa)', icon: 'ti-calendar-event' },
  ] : [
    { href: '/admin',              label: 'Commissioner Panel', icon: 'ti-settings' },
    { href: '/admin/article/new',  label: 'Write Article',      icon: 'ti-pencil' },
    { href: '/admin/articles',     label: 'Manage Articles',    icon: 'ti-news' },
    { href: '/admin/media',        label: 'Media Manager',      icon: 'ti-photo' },
    { href: '/admin/coaches',      label: 'Coaching Staff',     icon: 'ti-whistle' },
    { href: '/admin/applications', label: 'GM Applications',    icon: 'ti-clipboard-list' },
    { href: '/admin/gms',          label: 'Manage GMs',         icon: 'ti-users' },
    { href: '/preseason',          label: 'Friendlies (per team)', icon: 'ti-calendar-event' },
  ]

  // Trade Center, Free Agents and Contracts already live elsewhere (League
  // dropdown / the team page's own tabs), and GM Chat + Inbox already have
  // their own icon buttons in the navbar — keeping them here too was pure
  // duplication (Bruno's call).
  const GM_LINKS = [
    { href: `/team/${teamId}?tab=overview`, label: isPT ? 'A Minha Franquia' : 'My Franchise',    icon: 'ti-building' },
    { href: `/gm/orders/${teamId}`,      label: isPT ? 'Ordens Semanais'   : 'Weekly Orders',     icon: 'ti-clipboard-check' },
    { href: `/preseason`,                label: isPT ? 'Agendar Amigável'  : 'Schedule Friendly', icon: 'ti-calendar-event' },
  ]

  // Same grouping as the desktop dropdowns (League, Events, Rules & Info)
  // instead of one flattened, alphabetized list of 25+ links.
  const MOBILE_GROUPS = [...NAV_DROPDOWNS, RULES_DROPDOWN]

  return (
    <>
      {/* SINGLE MERGED BAR — logo, menus, search and account controls all on
          one dark strip (previously two separate bars: a dark account/logo
          bar and a light menu bar underneath). Only the week/simulation
          status strip below stays as its own separate bar. */}
      <div style={{ background: '#0f1623', borderBottom: '1px solid #1f2937' }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-2" style={{ minHeight: 52 }}>
          <Link href="/" className="no-underline flex items-center gap-2 flex-shrink-0 mr-1">
            <span style={{ fontSize: 22 }}>🏀</span>
            <span className="font-black italic" style={{ fontSize: 17, letterSpacing: '-0.2px', lineHeight: 1 }}>
              <span style={{ color: '#fff' }}>BEYOND </span>
              <span style={{ color: '#d4a537' }}>THE COURT</span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center flex-1 min-w-0">
            <Link href="/"
              className="flex items-center gap-1 no-underline transition-all"
              style={navBtnStyle}
              onMouseEnter={navBtnHover}
              onMouseLeave={e => navBtnLeave(e, false)}>
              <i className="ti ti-home" style={{ fontSize: 14 }}></i>
              {isPT ? 'Início' : 'Home'}
            </Link>

            {NAV_DROPDOWNS.map(d => (
              <NavDropdown key={d.label} label={d.label} icon={d.icon} items={d.items} onNavigate={() => {}} />
            ))}

            {/* Separates primary league navigation from reference material
                (Rules & Info / Job Openings) — Bruno's call: "assuntos bem
                diferentes" from the League/Events/G-League group. */}
            <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 6px', flexShrink: 0 }} />

            <NavDropdown label={RULES_DROPDOWN.label} icon={RULES_DROPDOWN.icon} items={RULES_DROPDOWN.items} onNavigate={() => {}} />

            {NAV_LINKS_RIGHT.map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-1 no-underline transition-all"
                style={navBtnStyle}
                onMouseEnter={navBtnHover}
                onMouseLeave={e => navBtnLeave(e, false)}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 14 }}></i>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 ml-auto lg:ml-0">
            <LanguageSwitcher stacked />
            <ChatButton />
            <InboxButton />
            {loading ? (
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
            ) : user ? (
              profile?.role === 'commissioner' ? (
                <div className="relative">
                  <button onClick={() => setCommOpen(!commOpen)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: '#c8102e', color: '#fff' }}>
                    <i className="ti ti-crown" style={{ fontSize: 13 }}></i>
                    {isPT ? 'Comissário' : 'Commissioner'}
                    <i className="ti ti-chevron-down" style={{ fontSize: 11 }}></i>
                  </button>
                  {commOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden py-1"
                         style={{ background: '#ede8df', border: '1px solid #cec8be', minWidth: 210, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                      {COMM_LINKS.map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setCommOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs no-underline transition-all"
                          style={{ color: '#2d2722', borderBottom: '1px solid #d6d0c6' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#e2dbd0')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <i className={`ti ${item.icon}`} style={{ fontSize: 14, color: '#c8102e' }}></i>
                          {item.label}
                        </Link>
                      ))}
                      <button onClick={() => { signOut(); setCommOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs"
                        style={{ color: '#dc2626' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#e2dbd0')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <i className="ti ti-logout" style={{ fontSize: 14 }}></i>
                        {isPT ? 'Terminar Sessão' : 'Sign Out'}
                      </button>
                    </div>
                  )}
                </div>
              ) : teamId ? (
                <div className="relative">
                  <button onClick={() => setGmOpen(!gmOpen)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: '#1d4ed8', color: '#fff' }}>
                    <i className="ti ti-user-circle" style={{ fontSize: 13 }}></i>
                    {profile?.display_name || user.email?.split('@')[0]}
                    <i className="ti ti-chevron-down" style={{ fontSize: 11 }}></i>
                  </button>
                  {gmOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden py-1"
                         style={{ background: '#ede8df', border: '1px solid #cec8be', minWidth: 210, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                      <div className="px-4 py-2.5 text-xs font-black uppercase tracking-widest"
                           style={{ color: '#1d4ed8', borderBottom: '1px solid #d6d0c6', background: '#e8e2d6' }}>
                        <i className="ti ti-building mr-1.5" style={{ fontSize: 13 }}></i>
                        {(profile as any)?.teams?.name || teamId}
                      </div>
                      {GM_LINKS.map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setGmOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs no-underline transition-all"
                          style={{ color: '#2d2722', borderBottom: '1px solid #d6d0c6' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#e2dbd0')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <i className={`ti ${item.icon}`} style={{ fontSize: 14, color: '#1d4ed8' }}></i>
                          {item.label}
                        </Link>
                      ))}
                      <button onClick={() => { signOut(); setGmOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs"
                        style={{ color: '#dc2626' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#e2dbd0')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <i className="ti ti-logout" style={{ fontSize: 14 }}></i>
                        {isPT ? 'Terminar Sessão' : 'Sign Out'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: '#c9d1d9' }}>
                    {profile?.display_name || user.email?.split('@')[0]}
                  </span>
                  <button onClick={signOut} className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                    {isPT ? 'Terminar Sessão' : 'Sign Out'}
                  </button>
                </div>
              )
            ) : (
              <Link href="/login" className="text-xs font-bold px-3 py-1.5 rounded-lg no-underline"
                style={{ background: '#c8102e', color: '#fff' }}>
                {isPT ? 'Entrar' : 'Sign In'}
              </Link>
            )}
            <button onClick={() => setOpen(!open)} className="lg:hidden p-1.5 rounded"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
              <i className={`ti ${open ? 'ti-x' : 'ti-menu-2'}`} style={{ fontSize: 18 }}></i>
            </button>
          </div>
        </div>

        {/* MOBILE PANEL */}
        {open && (
          <div className="lg:hidden px-4 pb-3 flex flex-col gap-1" style={{ borderTop: '1px solid #1f2937' }}>
            <div className="py-2.5">
              <GlobalSearch onNavigate={() => setOpen(false)} />
            </div>
            <Link href="/" onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm no-underline"
              style={{ color: '#c9d1d9' }}>
              <i className="ti ti-home" style={{ fontSize: 16 }}></i>
              {isPT ? 'Início' : 'Home'}
            </Link>

            {MOBILE_GROUPS.map(group => {
              const groupOpen = !!mobileGroupsOpen[group.label]
              return (
                <div key={group.label}>
                  <button type="button" onClick={() => toggleMobileGroup(group.label)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                    style={{ color: '#c9d1d9', background: 'transparent', border: 'none', textAlign: 'left' }}>
                    <i className={`ti ${group.icon}`} style={{ fontSize: 16 }}></i>
                    <span style={{ flex: 1 }}>{group.label}</span>
                    <i className={`ti ti-chevron-${groupOpen ? 'up' : 'down'}`} style={{ fontSize: 14, color: '#8a8279' }}></i>
                  </button>
                  {groupOpen && (
                    <div className="flex flex-col gap-1" style={{ paddingLeft: 16 }}>
                      {group.items.map((item: any, i: number) => {
                        const showSubGroup = item.group && item.group !== (group.items[i - 1] as any)?.group
                        return (
                          <div key={item.href}>
                            {showSubGroup && (
                              <div style={{ margin: i === 0 ? '2px 12px 4px' : '10px 12px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#6b7280' }}>
                                {item.group}
                              </div>
                            )}
                            <Link href={item.href} onClick={() => setOpen(false)}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm no-underline"
                              style={{ color: '#9ba5b0' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              <i className={`ti ${item.icon}`} style={{ fontSize: 14 }}></i>
                              {item.label}
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {NAV_LINKS_RIGHT.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm no-underline"
                style={{ color: '#c9d1d9' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 16 }}></i>
                {item.label}
              </Link>
            ))}

            <div className="px-3 py-2">
              <LanguageSwitcher />
            </div>
          </div>
        )}
      </div>

      {/* SIMULATOR BANNER — kept as its own, separate strip */}
      <SimulatorBanner />
    </>
  )
}

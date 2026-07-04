'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { useTranslation } from './I18nProvider'
import InboxButton from './InboxButton'
import ChatButton from './ChatButton'
import SimulatorBanner from './SimulatorBanner'
import LanguageSwitcher from './LanguageSwitcher'

function NavDropdown({ label, icon, items, onNavigate }: {
  label: string, icon: string, items: any[], onNavigate: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
        className="flex items-center gap-1.5 no-underline whitespace-nowrap transition-all"
        style={{
          padding: '14px 16px', fontSize: 14, fontWeight: 600,
          color: open ? '#c8102e' : '#2d2722',
          borderBottom: open ? '3px solid #c8102e' : '3px solid transparent',
          marginBottom: -2, background: 'transparent', border: 'none',
          borderBottomStyle: 'solid', borderBottomWidth: 3,
          borderBottomColor: open ? '#c8102e' : 'transparent',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.color = '#c8102e'; e.currentTarget.style.borderBottomColor = '#c8102e' } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.color = '#2d2722'; e.currentTarget.style.borderBottomColor = 'transparent' } }}>
        <i className={`ti ${icon}`} style={{ fontSize: 15 }}></i>
        {label}
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 11, marginLeft: 2 }}></i>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 rounded-xl overflow-hidden py-1"
             style={{ background: '#ede8df', border: '1px solid #cec8be', minWidth: 200,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', marginTop: 2 }}>
          {items.map((item: any) => (
            <Link key={item.href} href={item.href}
              onClick={() => { setOpen(false); onNavigate() }}
              className="flex items-center gap-2.5 px-4 py-2.5 text-xs no-underline transition-all"
              style={{ color: '#2d2722', borderBottom: '1px solid #d6d0c6' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#e2dbd0')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 14, color: '#c8102e' }}></i>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [commOpen, setCommOpen] = useState(false)
  const [gmOpen, setGmOpen] = useState(false)
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
        { label: isPT ? 'Margem Salarial'  : 'Cap Space',       href: '/cap-space',      icon: 'ti-cash' },
        { label: isPT ? 'Free Agents'      : 'Free Agents',     href: '/free-agents',    icon: 'ti-user-plus' },
        { label: isPT ? 'Líderes da Liga'  : 'League Leaders',  href: '/league-leaders', icon: 'ti-trophy' },
        { label: isPT ? 'Power Rankings'   : 'Power Rankings',  href: '/power-rankings', icon: 'ti-trending-up' },
        { label: isPT ? 'Calendário'       : 'Schedule',        href: '/schedule',       icon: 'ti-calendar' },
        { label: isPT ? 'Classificação'    : 'Standings',       href: '/standings',      icon: 'ti-list-numbers' },
        { label: isPT ? 'Equipas'          : 'Teams',           href: '/teams',          icon: 'ti-users' },
        { label: isPT ? 'Trade Center'     : 'Trade Center',    href: '/trade-center',   icon: 'ti-switch-horizontal' },
        { label: isPT ? 'Transações'       : 'Transactions',    href: '/transactions',   icon: 'ti-arrows-exchange' },
      ],
    },
    {
      label: isPT ? 'Eventos' : 'Events',
      icon: 'ti-star',
      items: [
        { label: 'All-Star',                               href: '/all-star',  icon: 'ti-star' },
        { label: isPT ? 'Prémios'   : 'Awards',           href: '/awards',    icon: 'ti-award' },
        { label: 'Draft',                                  href: '/draft',     icon: 'ti-clipboard-list' },
        { label: 'Playoffs',                               href: '/playoffs',  icon: 'ti-tournament' },
      ],
    },
    {
      label: isPT ? 'Regras & Info' : 'Rules & Info',
      icon: 'ti-book',
      items: [
        { label: isPT ? 'Regras do Tecto Salarial'  : 'Salary Cap Rules',    href: '/rules/cap',      icon: 'ti-cash' },
        { label: isPT ? 'Regras de Contratos'        : 'Contract Rules',      href: '/rules/contracts',icon: 'ti-file-text' },
        { label: isPT ? 'Regras de Trades'           : 'Trade Rules',         href: '/rules/trades',   icon: 'ti-switch-horizontal' },
        { label: isPT ? 'Regras de Treino'           : 'Training Rules',      href: '/rules/training', icon: 'ti-barbell' },
        { label: isPT ? 'Regras de Free Agency'      : 'Free Agency Rules',   href: '/rules/free-agency', icon: 'ti-user-dollar' },
        { label: isPT ? 'Regras do Draft'            : 'Draft Rules',         href: '/rules/draft',    icon: 'ti-clipboard-list' },
        { label: isPT ? 'Guia das Ordens Semanais'  : 'Weekly Orders Guide',  href: '/rules/orders',   icon: 'ti-clipboard-list' },
        { label: isPT ? 'Guia de Scouting'          : 'Scouting Guide',       href: '/rules/scouting', icon: 'ti-search' },
        { label: isPT ? 'Objetivos de Patrocínio'   : 'Sponsor Objectives',   href: '/rules/sponsors', icon: 'ti-target-arrow' },
      ],
    },
  ]

  const NAV_LINKS_STATIC = [
    { label: isPT ? 'Vagas de GM' : 'Job Openings', href: '/jobs',    icon: 'ti-briefcase' },
    { label: 'G-League',                             href: '/gleague', icon: 'ti-ball-basketball' },
  ]

  const COMM_LINKS = isPT ? [
    { href: '/admin',              label: 'Painel do Comissário', icon: 'ti-settings' },
    { href: '/admin/article/new',  label: 'Escrever Artigo',      icon: 'ti-pencil' },
    { href: '/admin/articles',     label: 'Gerir Artigos',        icon: 'ti-news' },
    { href: '/admin/media',        label: 'Gestor de Media',      icon: 'ti-photo' },
    { href: '/admin/coaches',      label: 'Staff Técnico',        icon: 'ti-whistle' },
    { href: '/admin/applications', label: 'Candidaturas GM',      icon: 'ti-clipboard-list' },
    { href: '/admin/gms',          label: 'Gerir GMs',            icon: 'ti-users' },
  ] : [
    { href: '/admin',              label: 'Commissioner Panel', icon: 'ti-settings' },
    { href: '/admin/article/new',  label: 'Write Article',      icon: 'ti-pencil' },
    { href: '/admin/articles',     label: 'Manage Articles',    icon: 'ti-news' },
    { href: '/admin/media',        label: 'Media Manager',      icon: 'ti-photo' },
    { href: '/admin/coaches',      label: 'Coaching Staff',     icon: 'ti-whistle' },
    { href: '/admin/applications', label: 'GM Applications',    icon: 'ti-clipboard-list' },
    { href: '/admin/gms',          label: 'Manage GMs',         icon: 'ti-users' },
  ]

  const GM_LINKS = [
    { href: `/team/${teamId}`,           label: isPT ? 'A Minha Franquia'  : 'My Franchise',      icon: 'ti-building' },
    { href: `/gm/orders/${teamId}`,      label: isPT ? 'Ordens Semanais'   : 'Weekly Orders',     icon: 'ti-clipboard-check' },
    { href: `/trade-center`,             label: isPT ? 'Trade Center'      : 'Trade Center',      icon: 'ti-switch-horizontal' },
    { href: `/free-agents`,              label: isPT ? 'Free Agents'       : 'Free Agents',       icon: 'ti-user-plus' },
    { href: `/preseason`,                label: isPT ? 'Agendar Amigável'  : 'Schedule Friendly', icon: 'ti-calendar-event' },
    { href: `/team/${teamId}#contracts`, label: isPT ? 'Contratos'         : 'Contracts',         icon: 'ti-file-dollar' },
    { href: `/chat`,                     label: 'GM Chat',                                        icon: 'ti-message-circle' },
    { href: `/inbox`,                    label: isPT ? 'Caixa de Entrada'  : 'Inbox',             icon: 'ti-mail' },
  ]

  const ALL_MOBILE = [
    ...NAV_DROPDOWNS.flatMap(d => d.items),
    ...NAV_LINKS_STATIC,
  ].sort((a, b) => a.label.localeCompare(b.label))

  return (
    <>
      {/* TOP BAR */}
      <div style={{ background: '#0f1623', borderBottom: '1px solid #1f2937' }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-12">
          <Link href="/" className="no-underline flex items-center gap-2.5">
            <span className="text-lg font-bold" style={{ color: '#fff', letterSpacing: '-0.3px' }}>
              🏀 Beyond the Court
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
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
                  <span className="text-xs font-semibold" style={{ color: '#8a8279' }}>
                    {profile?.display_name || user.email?.split('@')[0]}
                  </span>
                  <button onClick={signOut} className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#1a1512' }}>
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
              style={{ background: 'rgba(255,255,255,0.1)', color: '#1a1512' }}>
              <i className={`ti ${open ? 'ti-x' : 'ti-menu-2'}`} style={{ fontSize: 18 }}></i>
            </button>
          </div>
        </div>
      </div>

      {/* SIMULATOR BANNER */}
      <SimulatorBanner />

      {/* NAV BAR */}
      <nav style={{ background: '#faf8f5', borderBottom: '2px solid #d4cdc5', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto px-4 hidden lg:flex items-center">
          <Link href="/"
            className="flex items-center gap-1.5 no-underline whitespace-nowrap transition-all"
            style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#2d2722',
                     borderBottom: '3px solid transparent', marginBottom: -2 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#c8102e'; e.currentTarget.style.borderBottomColor = '#c8102e' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#2d2722'; e.currentTarget.style.borderBottomColor = 'transparent' }}>
            <i className="ti ti-home" style={{ fontSize: 15 }}></i>
            {isPT ? 'Início' : 'Home'}
          </Link>

          {NAV_DROPDOWNS.map(d => (
            <NavDropdown key={d.label} label={d.label} icon={d.icon} items={d.items} onNavigate={() => {}} />
          ))}

          {NAV_LINKS_STATIC.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-1.5 no-underline whitespace-nowrap transition-all"
              style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#2d2722',
                       borderBottom: '3px solid transparent', marginBottom: -2 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#c8102e'; e.currentTarget.style.borderBottomColor = '#c8102e' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#2d2722'; e.currentTarget.style.borderBottomColor = 'transparent' }}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 15 }}></i>
              {item.label}
            </Link>
          ))}
        </div>

        {/* MOBILE */}
        {open && (
          <div className="lg:hidden px-4 pb-3 flex flex-col gap-1" style={{ borderTop: '1px solid #e5e1d8' }}>
            <Link href="/" onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm no-underline"
              style={{ color: '#2d2722' }}>
              <i className="ti ti-home" style={{ fontSize: 16 }}></i>
              {isPT ? 'Início' : 'Home'}
            </Link>
            {ALL_MOBILE.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm no-underline"
                style={{ color: '#2d2722' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e2dbd0')}
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
      </nav>
    </>
  )
}

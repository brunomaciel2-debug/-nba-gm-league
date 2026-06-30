'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import InboxButton from './InboxButton'
import ChatButton from './ChatButton'
import SimulatorBanner from './SimulatorBanner'

const NAV_DROPDOWNS = [
  {
    label: 'League',
    icon: 'ti-ball-basketball',
    items: [
      { label: 'Cap Space',       href: '/cap-space',        icon: 'ti-cash' },
      { label: 'Free Agents',     href: '/free-agents',      icon: 'ti-user-plus' },
      { label: 'League Leaders',  href: '/league-leaders',   icon: 'ti-trophy' },
      { label: 'Power Rankings',  href: '/power-rankings',   icon: 'ti-trending-up' },
      { label: 'Schedule',        href: '/schedule',         icon: 'ti-calendar' },
      { label: 'Standings',       href: '/standings',        icon: 'ti-list-numbers' },
      { label: 'Teams',           href: '/teams',            icon: 'ti-users' },
      { label: 'Trade Center',    href: '/trade-center',     icon: 'ti-switch-horizontal' },
      { label: 'Transactions',    href: '/transactions',     icon: 'ti-arrows-exchange' },
    ],
  },
  {
    label: 'Events',
    icon: 'ti-star',
    items: [
      { label: 'All-Star',  href: '/all-star', icon: 'ti-star' },
      { label: 'Awards',    href: '/awards',   icon: 'ti-award' },
      { label: 'Draft',     href: '/draft',    icon: 'ti-clipboard-list' },
      { label: 'Playoffs',  href: '/playoffs', icon: 'ti-tournament' },
    ],
  },
]

const NAV_LINKS = [
  { label: 'Job Openings', href: '/jobs',     icon: 'ti-briefcase' },
  { label: 'G-League',     href: '/gleague',  icon: 'ti-ball-basketball' },
]

const COMM_LINKS = [
  { href: '/admin',               label: 'Commissioner Panel', icon: 'ti-settings' },
  { href: '/admin/article/new',   label: 'Write Article',      icon: 'ti-pencil' },
  { href: '/admin/articles',      label: 'Manage Articles',    icon: 'ti-news' },
  { href: '/admin/media',         label: 'Media Manager',      icon: 'ti-photo' },
  { href: '/admin/coaches',       label: 'Coaching Staff',     icon: 'ti-whistle' },
  { href: '/admin/applications',  label: 'GM Applications',    icon: 'ti-clipboard-list' },
  { href: '/admin/gms',           label: 'Manage GMs',         icon: 'ti-users' },
]

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
        style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: open ? '#c8102e' : '#2d2722',
                 borderBottom: open ? '3px solid #c8102e' : '3px solid transparent',
                 marginBottom: -2, background: 'transparent', border: 'none',
                 borderBottomStyle: 'solid', borderBottomWidth: 3,
                 borderBottomColor: open ? '#c8102e' : 'transparent',
                 cursor: 'pointer' }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.color = '#c8102e'; e.currentTarget.style.borderBottomColor = '#c8102e' }}}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.color = '#2d2722'; e.currentTarget.style.borderBottomColor = 'transparent' }}}>
        <i className={`ti ${icon}`} style={{ fontSize: 15 }}></i>
        {label}
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 11, marginLeft: 2 }}></i>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 rounded-xl overflow-hidden py-1"
             style={{ background: '#ede8df', border: '1px solid #cec8be', minWidth: 200,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', marginTop: 2 }}>
          {items.map(item => (
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

  const teamId = (profile as any)?.team_id

  const GM_LINKS = [
    { href: `/team/${teamId}`,           label: 'My Franchise',      icon: 'ti-building' },
    { href: `/gm/orders/${teamId}`,      label: 'Weekly Orders',     icon: 'ti-clipboard-check' },
    { href: `/trade-center`,             label: 'Propose Trade',     icon: 'ti-switch-horizontal' },
    { href: `/free-agents`,              label: 'Sign Free Agent',   icon: 'ti-user-plus' },
    { href: `/preseason`,                label: 'Schedule Friendly', icon: 'ti-calendar-event' },
    { href: `/team/${teamId}#contracts`, label: 'Contracts',         icon: 'ti-file-dollar' },
    { href: `/chat`,                     label: 'GM Chat',           icon: 'ti-message-circle' },
    { href: `/inbox`,                    label: 'Inbox',             icon: 'ti-mail' },
  ]

  const ALL_MOBILE = [
    ...NAV_DROPDOWNS.flatMap(d => d.items),
    ...NAV_LINKS,
  ].sort((a, b) => a.label.localeCompare(b.label))

  return (
    <>
      {/* TOP BAR */}
      <div style={{ background: '#0f1623', borderBottom: '1px solid #1f2937' }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-12">
          <Link href="/" className="no-underline flex items-center gap-2.5">
            <span className="text-lg font-bold" style={{ color: '#fff', letterSpacing: '-0.3px' }}>
              🏀 NBA GM League
            </span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)', color: '#8a8279' }}>
              2025-26
            </span>
          </Link>
          <div className="flex items-center gap-3">
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
                    Commissioner
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
                        Sign Out
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
                        Sign Out
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
                    Sign Out
                  </button>
                </div>
              )
            ) : (
              <Link href="/login" className="text-xs font-bold px-3 py-1.5 rounded-lg no-underline"
                style={{ background: '#c8102e', color: '#fff' }}>
                Sign In
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
            Home
          </Link>

          {NAV_DROPDOWNS.map(d => (
            <NavDropdown key={d.label} label={d.label} icon={d.icon} items={d.items} onNavigate={() => {}} />
          ))}

          {NAV_LINKS.map(item => (
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
              Home
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
          </div>
        )}
      </nav>
    </>
  )
}

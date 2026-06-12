'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from './AuthProvider'
import InboxButton from './InboxButton'

const NAV = [
  { label: 'Home',          href: '/',               icon: 'ti-home' },
  { label: 'Job Vacancies', href: '/jobs',            icon: 'ti-briefcase' },
  { label: 'Standings',     href: '/standings',       icon: 'ti-list-numbers' },
  { label: 'Schedule',      href: '/schedule',        icon: 'ti-calendar' },
  { label: 'Teams',         href: '/teams',           icon: 'ti-users' },
  { label: 'Leaders',       href: '/league-leaders',  icon: 'ti-trophy' },
  { label: 'Transactions',  href: '/transactions',    icon: 'ti-arrows-exchange' },
  { label: 'Trade Center',  href: '/trade-center',    icon: 'ti-switch-horizontal' },
  { label: 'All-Star',      href: '/all-star',        icon: 'ti-star' },
]

const COMM_LINKS = [
  { href: '/admin',               label: 'Commissioner Panel', icon: 'ti-settings' },
  { href: '/admin/article/new',   label: 'Write Article',      icon: 'ti-pencil' },
  { href: '/admin/articles',      label: 'Manage Articles',    icon: 'ti-news' },
  { href: '/admin/media',         label: 'Media Manager',      icon: 'ti-photo' },
  { href: '/admin/coaches',       label: 'Coaching Staff',     icon: 'ti-whistle' },
  { href: '/admin/applications',  label: 'GM Applications',    icon: 'ti-clipboard-list' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [commOpen, setCommOpen] = useState(false)
  const { user, profile, loading, signOut } = useAuth()

  return (
    <>
      {/* ── TOP BAR ─────────────────────────────── */}
      <div style={{ background: '#0f1623', borderBottom: '1px solid #1f2937' }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-12">
          {/* Logo */}
          <Link href="/" className="no-underline flex items-center gap-2.5">
            <span className="text-lg" style={{ color: '#fff', fontWeight: 500, letterSpacing: '-0.3px' }}>
              🏀 NBA GM League
            </span>
            <span className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              2025-26
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <InboxButton />

            {loading ? (
              <div className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', color: '#6b7280' }}>...</div>
            ) : user ? (
              profile?.role === 'commissioner' ? (
                <div className="relative">
                  <button onClick={() => setCommOpen(!commOpen)}
                    className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: '#F5A623', color: '#111827' }}>
                    <i className="ti ti-crown" style={{ fontSize: 13 }} aria-hidden="true"></i>
                    Commissioner
                    <i className="ti ti-chevron-down" style={{ fontSize: 12 }} aria-hidden="true"></i>
                  </button>
                  {commOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden py-1"
                         style={{ background: '#111827', border: '1px solid #1f2937', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                      {COMM_LINKS.map(item => (
                        <Link key={item.href} href={item.href}
                              onClick={() => setCommOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-xs no-underline transition-all"
                              style={{ color: '#d1d5db', borderBottom: '1px solid #1f2937' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <i className={`ti ${item.icon}`} style={{ fontSize: 14, color: '#F5A623' }} aria-hidden="true"></i>
                          {item.label}
                        </Link>
                      ))}
                      <button onClick={() => { signOut(); setCommOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs"
                        style={{ color: '#ef4444' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <i className="ti ti-logout" style={{ fontSize: 14 }} aria-hidden="true"></i>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: '#9ca3af' }}>
                    {profile?.display_name || profile?.teams?.name || user.email?.split('@')[0]}
                  </span>
                  <button onClick={signOut} className="text-xs px-3 py-1.5 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                    Sign Out
                  </button>
                </div>
              )
            ) : (
              <Link href="/login"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg no-underline"
                style={{ background: '#F5A623', color: '#111827' }}>
                Sign In
              </Link>
            )}

            {/* Mobile menu */}
            <button onClick={() => setOpen(!open)} className="lg:hidden p-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>
              <i className={`ti ${open ? 'ti-x' : 'ti-menu-2'}`} style={{ fontSize: 18 }} aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>

      {/* ── NAV BAR ─────────────────────────────── */}
      <nav style={{ background: '#111827', borderBottom: '1px solid #1f2937' }}>
        <div className="max-w-7xl mx-auto px-4 hidden lg:flex items-center overflow-x-auto"
             style={{ scrollbarWidth: 'none' }}>
          {NAV.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-1.5 no-underline whitespace-nowrap transition-all"
              style={{ padding: '13px 14px', fontSize: 12, fontWeight: 500, color: '#9ca3af',
                       borderBottom: '2px solid transparent' }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#e5e7eb'
                e.currentTarget.style.borderBottomColor = '#374151'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#9ca3af'
                e.currentTarget.style.borderBottomColor = 'transparent'
              }}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 15 }} aria-hidden="true"></i>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Mobile nav */}
        {open && (
          <div className="lg:hidden px-4 pb-3 flex flex-col gap-1"
               style={{ borderTop: '1px solid #1f2937' }}>
            {NAV.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm no-underline"
                style={{ color: '#d1d5db' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 16 }} aria-hidden="true"></i>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </>
  )
}

'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from './AuthProvider'
import InboxButton from './InboxButton'

const NAV = [
  { label: 'Home',          href: '/' },
  { label: '📋 Job Vacancies', href: '/jobs' },
  { label: 'Standings',     href: '/standings' },
  { label: 'Schedule',      href: '/schedule' },
  { label: 'Teams',         href: '/teams' },
  { label: 'Leaders',       href: '/league-leaders' },
  { label: 'Transactions',  href: '/transactions' },
  { label: 'Trade Center',  href: '/trade-center' },
  { label: '⭐ All-Star',   href: '/all-star' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, profile, signOut } = useAuth()

  return (
    <nav style={{ background: '#120f0a', borderBottom: '1px solid #3a3228' }}
         className="sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-4">
        <Link href="/" className="no-underline flex-shrink-0">
          <span className="text-base font-black" style={{ color: '#f0ebe0' }}>🏀</span>
          <span className="ml-1.5 text-sm font-bold hidden sm:inline" style={{ color: '#f0ebe0' }}>NBA GM League</span>
          <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded" style={{ background: '#3a3228', color: '#8a7a6a' }}>2025-26</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1 flex-1 overflow-x-auto">
          {NAV.map(item => (
            <Link key={item.href} href={item.href}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold no-underline whitespace-nowrap transition-all hover:brightness-125"
              style={{ background: '#3a3228', color: '#60a0ff' }}>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right side — inbox + auth */}
        <div className="flex items-center gap-3 ml-auto">
          <InboxButton />
          {user ? (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-semibold" style={{color:'#8a7a6a'}}>
                {profile?.teams?.name || 'Commissioner'}
              </span>
              <button onClick={signOut}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{background:'#3a3228',color:'#8a7a6a'}}>
                Sign Out
              </button>
            </div>
          ) : (
            <Link href="/login"
              className="text-xs px-3 py-1.5 rounded-lg font-bold no-underline"
              style={{background:'#3a8adf',color:'#fff'}}>
              Sign In
            </Link>
          )}
          {/* Mobile menu button */}
          <button onClick={() => setOpen(!open)} className="lg:hidden p-1.5 rounded-lg"
            style={{ background: '#3a3228', color: '#8a7a6a' }}>
            {open ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="lg:hidden px-4 pb-4 flex flex-col gap-1"
             style={{ background: '#120f0a', borderTop: '1px solid #3a3228' }}>
          {NAV.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-sm font-semibold no-underline"
              style={{ background: '#1e1a14', color: '#60a0ff' }}>
              {item.label}
            </Link>
          ))}
          {user ? (
            <button onClick={()=>{signOut();setOpen(false)}}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-left"
              style={{background:'#2a0a0a',color:'#e04040'}}>
              Sign Out ({profile?.teams?.name||'Commissioner'})
            </button>
          ) : (
            <Link href="/login" onClick={()=>setOpen(false)}
              className="px-3 py-2 rounded-lg text-sm font-bold no-underline"
              style={{background:'#3a8adf',color:'#fff'}}>
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}

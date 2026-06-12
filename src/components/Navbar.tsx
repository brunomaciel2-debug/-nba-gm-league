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
  const { user, profile, loading, signOut } = useAuth()

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
              {profile?.role === 'commissioner' && (
                <div className="relative group">
                  <button className="text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"
                          style={{background:'#2a2000',color:'#ffd040',border:'1px solid #5a4a00'}}>
                    👑 Commissioner ▾
                  </button>
                  <div className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all"
                       style={{background:'#120f0a',border:'1px solid #3a3228',minWidth:200}}>
                    {[
                      {href:'/admin',                label:'⚙️ Commissioner Panel'},
                      {href:'/admin/article/new',    label:'✍️ Write Article'},
                      {href:'/admin/media',          label:'🖼️ Media Manager'},
                      {href:'/admin/coaches',        label:'🎯 Coaching Staff'},
                      {href:'/admin/applications',   label:'📋 GM Applications'},
                      {href:'/admin/trades',         label:'🤝 Trade Approvals'},
                    ].map(item => (
                      <a key={item.href} href={item.href}
                         className="block px-4 py-2.5 text-xs no-underline transition-all hover:brightness-125"
                         style={{color:'#c0b8a8',borderBottom:'1px solid #2a2218'}}>
                        {item.label}
                      </a>
                    ))}
                    <button onClick={signOut}
                      className="w-full text-left px-4 py-2.5 text-xs"
                      style={{color:'#e04040'}}>
                      🚪 Sign Out
                    </button>
                  </div>
                </div>
              )}
              {profile?.role !== 'commissioner' && (
                <span className="text-xs font-semibold" style={{color:'#8a7a6a'}}>
                  {profile?.display_name || profile?.teams?.name || user?.email?.split('@')[0] || 'User'}
                </span>
              )}
              {profile?.role !== 'commissioner' && (
                <button onClick={signOut}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{background:'#3a3228',color:'#8a7a6a'}}>
                  Sign Out
                </button>
              )}
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

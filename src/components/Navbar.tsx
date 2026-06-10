'use client'
import Link from 'next/link'
import { useState } from 'react'

const NAV = [
  { label: 'Home',          href: '/' },
  { label: 'Standings',     href: '/standings' },
  { label: 'Schedule',      href: '/schedule' },
  { label: 'Teams',         href: '/teams' },
  { label: 'Leaders',       href: '/league-leaders' },
  { label: 'Transactions',  href: '/transactions' },
  { label: 'Free Agents',   href: '/free-agents' },
  { label: 'Trade Center',  href: '/trade-center' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <nav style={{ background: '#060c18', borderBottom: '1px solid #1e3a5f' }}
         className="sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg no-underline">
          🏀 <span style={{ color: '#60a0ff' }}>NBA</span> GM League
          <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full"
                style={{ background: '#1e3a5f', color: '#7090b0' }}>2025-26</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className="px-3 py-1.5 rounded-lg text-xs font-medium no-underline transition-colors"
              style={{ color: '#7090b0' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#e8eaf0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#7090b0')}>
              {n.label}
            </Link>
          ))}
          <Link href="/admin" className="ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold no-underline"
            style={{ background: '#1e3a5f', color: '#60a0ff' }}>
            Commissioner
          </Link>
          <Link href="/gm" className="ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold no-underline"
            style={{ background: '#0a3a20', color: '#40e080' }}>
            GM Login
          </Link>
        </div>

        {/* Mobile burger */}
        <button className="md:hidden p-2" onClick={() => setOpen(!open)}
          style={{ color: '#7090b0' }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden px-4 pb-4 flex flex-col gap-1"
             style={{ borderTop: '1px solid #1e3a5f' }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-sm no-underline"
              style={{ color: '#c0ccd8' }}>
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}

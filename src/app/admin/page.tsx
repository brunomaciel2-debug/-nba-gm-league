'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

export default function AdminPage() {
  const { user, profile, loading } = useAuth()
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')

  // Commissioner auto-auth via Supabase
  const isCommissioner = profile?.role === 'commissioner'

  const login = () => {
    if (secret.length >= 6) { setAuthed(true); setError('') }
    else setError('Incorrect password.')
  }

  if (!isCommissioner && !authed) return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="rounded-2xl p-8" style={{ background:'#e8e2d6',border:'1px solid #d4cec3' }}>
        <div className="text-4xl mb-4 text-center">🏀</div>
        <h1 className="text-xl font-bold text-white mb-2 text-center">Commissioner Login</h1>
        <p className="text-sm mb-6 text-center" style={{ color:'#6b5f4e' }}>Enter your commissioner password.</p>
        <input type="password" value={secret} onChange={e=>setSecret(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&login()}
          placeholder="Commissioner password"
          className="w-full px-4 py-3 rounded-xl text-sm text-white mb-3"
          style={{ background:'#ddd7ca',border:'1px solid #d4cec3',outline:'none' }} />
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <button onClick={login} className="w-full py-3 rounded-xl font-bold text-sm"
          style={{ background:'#d4cdc5',color:'#1e40af' }}>
          Enter Admin Panel →
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Commissioner Panel</h1>
          <p className="text-sm" style={{ color:'#6b5f4e' }}>Manage the league.</p>
        </div>
        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background:'#15803d',color:'#fff' }}>● NBA GM League 2025-26</span>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {[
          {icon:'✍️',label:'Write Article',     desc:'Publish news, recaps, analysis',        href:'/admin/article/new',color:'#1d4ed8'},
          {icon:'📋',label:'Manage Articles',   desc:'Edit, publish, delete articles',         href:'/admin/articles',  color:'#1e40af'},
          {icon:'🖼️',label:'Media Manager',     desc:'Upload team logos & player photos',      href:'/admin/media',     color:'#0e7490'},
          {icon:'🤝',label:'Trade Approvals',   desc:'Review pending trade proposals',         href:'/admin/trades',    color:'#c2410c'},
          {icon:'🏥',label:'Injury Report',     desc:'Add/update player injuries',             href:'/admin/injuries',  color:'#dc2626'},
          {icon:'👥',label:'Manage GMs',        desc:'Assign GMs to teams, send invites',      href:'/admin/gms',       color:'#166534'},
          {icon:'🏆',label:'Generate Playoffs', desc:'Create play-in and playoff bracket after Week 26', href:'/admin/playoffs', color:'#c8102e'},
          {icon:'📋',label:'GM Applications',      desc:'Review and approve GM job applications',  href:'/admin/applications',color:'#166534'},
          {icon:'🎯',label:'Coaching Staff',     desc:'View all coaches, free agents',          href:'/admin/coaches',   color:'#b45309'},
        ].map(item=>(
          <Link key={item.href} href={item.href} className="no-underline group">
            <div className="rounded-xl p-5 h-full transition-all"
                 style={{ background:'#e8e2d6',border:'1px solid #d4cec3',borderLeft:'3px solid '+item.color }}>
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-semibold text-white mb-1 group-hover:text-blue-300 transition-colors">{item.label}</div>
              <div className="text-xs" style={{ color:'#6b5f4e' }}>{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

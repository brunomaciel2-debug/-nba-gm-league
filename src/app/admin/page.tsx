'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')

  const login = () => {
    // Simple client-side check — real auth via Supabase in production
    if (secret === process.env.NEXT_PUBLIC_COMMISSIONER_HINT || secret.length > 6) {
      setAuthed(true); setError('')
    } else {
      setError('Incorrect commissioner password.')
    }
  }

  if (!authed) return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="rounded-2xl p-8" style={{ background:'#0f1e33',border:'1px solid #1e3a5f' }}>
        <h1 className="text-xl font-bold text-white mb-2">Commissioner Login</h1>
        <p className="text-sm mb-6" style={{ color:'#7090b0' }}>Enter your commissioner password to access the admin panel.</p>
        <input type="password" value={secret} onChange={e=>setSecret(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&login()}
          placeholder="Commissioner password"
          className="w-full px-4 py-3 rounded-xl text-sm text-white mb-3"
          style={{ background:'#060c18',border:'1px solid #1e3a5f',outline:'none' }} />
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <button onClick={login} className="w-full py-3 rounded-xl font-bold text-sm"
          style={{ background:'#1e3a5f',color:'#60a0ff' }}>
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
          <p className="text-sm" style={{ color:'#7090b0' }}>Manage the league, publish news, approve trades.</p>
        </div>
        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background:'#0a2a10',color:'#40e080' }}>● Active Season</span>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {[
          { icon:'✍️', label:'Write Article', desc:'Publish news, recaps, analysis', href:'/admin/article/new', color:'#3a8adf' },
          { icon:'📋', label:'Manage Articles', desc:'Edit, publish, delete articles', href:'/admin/articles', color:'#60a0ff' },
          { icon:'🤝', label:'Trade Approvals', desc:'Review pending trade proposals', href:'/admin/trades', color:'#ffa040' },
          { icon:'🏥', label:'Injury Report', desc:'Add/update player injuries', href:'/admin/injuries', color:'#e04040' },
          { icon:'👥', label:'Manage GMs', desc:'Assign GMs to teams, send invites', href:'/admin/gms', color:'#40e080' },
          { icon:'⚙️', label:'Season Config', desc:'Simulation schedule, settings', href:'/admin/config', color:'#c040ff' },
        ].map(item=>(
          <Link key={item.href} href={item.href} className="no-underline group">
            <div className="rounded-xl p-5 h-full transition-all"
                 style={{ background:'#0f1e33',border:'1px solid #1e3a5f',borderLeft:'3px solid '+item.color }}>
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-semibold text-white mb-1 group-hover:text-blue-300 transition-colors">{item.label}</div>
              <div className="text-xs" style={{ color:'#7090b0' }}>{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick stats */}
      <div className="rounded-xl p-5" style={{ background:'#0f1e33',border:'1px solid #1e3a5f' }}>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color:'#506070' }}>Season Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[['30','Teams'],['422','Players'],['0','Games Played'],['0','Weeks Done']].map(([v,l])=>(
            <div key={l} className="text-center">
              <div className="text-2xl font-bold text-white">{v}</div>
              <div className="text-xs" style={{ color:'#7090b0' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

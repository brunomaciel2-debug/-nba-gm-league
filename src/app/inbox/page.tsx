'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TYPE_ICONS: Record<string,string> = {
  system:               '🤖',
  application:          '📋',
  preseason_request:    '🏀',
  preseason_accepted:   '✅',
  preseason_declined:   '❌',
  injury:               '🏥',
  trade:                '🔄',
  contract:             '📝',
  award:                '🏆',
}

export default function InboxPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [myTeamId, setMyTeamId] = useState<string|null>(null)
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'unread'>('all')
  const [expanded, setExpanded] = useState<string|null>(null)
  const [processing, setProcessing] = useState<string|null>(null)
  const [actionMsg, setActionMsg] = useState('')

  const loadMessages = async (tid: string) => {
    const { data } = await supabase
      .from('inbox_messages')
      .select('*')
      .eq('to_team_id', tid)
      .order('created_at', { ascending: false })
      .limit(100)
    setMessages(data || [])
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data: gm } = await supabase
        .from('gm_profiles')
        .select('team_id, role')
        .eq('id', user.id)
        .single()
      if (!gm) { setLoading(false); return }

      const tid = gm.role === 'commissioner' ? 'commissioner' : gm.team_id
      if (!tid) { setLoading(false); return }

      setMyTeamId(tid)
      setIsCommissioner(gm.role === 'commissioner')
      await loadMessages(tid)
      setLoading(false)
    })
  }, [])

  const markAsRead = async (msg: any) => {
    if (msg.read) return
    await supabase.from('inbox_messages').update({ read: true }).eq('id', msg.id)
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
  }

  const toggleExpand = async (msg: any) => {
    if (expanded === msg.id) {
      setExpanded(null)
    } else {
      setExpanded(msg.id)
      await markAsRead(msg)
    }
  }

  const deleteMsg = async (id: string) => {
    await supabase.from('inbox_messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
    if (expanded === id) setExpanded(null)
  }

  const clearRead = async () => {
    if (!myTeamId) return
    await supabase.from('inbox_messages').delete().eq('to_team_id', myTeamId).eq('read', true)
    setMessages(prev => prev.filter(m => !m.read))
  }

  const approveApp = async (msg: any) => {
    if (!msg.metadata?.application_id) return
    setProcessing(msg.id)
    try {
      const res = await fetch('/api/admin/approve-gm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: msg.metadata.application_id,
          email: msg.metadata.email,
          password: msg.metadata.password || 'NBA2025!',
          full_name: msg.metadata.full_name,
          team_id: msg.metadata.team_id,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Unknown error')
      setActionMsg(`✅ ${msg.metadata.full_name} aprovado! Conta criada e email enviado.`)
      await deleteMsg(msg.id)
    } catch (e: any) {
      setActionMsg(`❌ Erro: ${e.message}`)
    }
    setProcessing(null)
  }

  const rejectApp = async (msg: any) => {
    if (!msg.metadata?.application_id) return
    setProcessing(msg.id)
    try {
      const res = await fetch('/api/admin/approve-gm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          application_id: msg.metadata.application_id,
          email: msg.metadata.email,
          full_name: msg.metadata.full_name,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Unknown error')
      setActionMsg(`❌ ${msg.metadata.full_name} rejeitado. Email enviado.`)
      await deleteMsg(msg.id)
    } catch (e: any) {
      setActionMsg(`❌ Erro: ${e.message}`)
    }
    setProcessing(null)
  }

  const filtered = filter === 'unread' ? messages.filter(m => !m.read) : messages
  const unreadCount = messages.filter(m => !m.read).length

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) return <div className="p-8 text-center" style={{color:'#5c554e'}}>Loading...</div>

  if (!loading && !myTeamId) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-8 rounded-2xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div className="text-4xl mb-4">🔒</div>
        <div className="text-xl font-black mb-2" style={{color:'#1a1512'}}>Login Required</div>
        <a href="/login" className="text-sm font-bold px-4 py-2 rounded-lg"
           style={{background:'#1a1512',color:'#fff',textDecoration:'none'}}>Sign In</a>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black mb-0.5" style={{color:'#1a1512'}}>📬 Inbox</h1>
          <p className="text-sm" style={{color:'#8a8279'}}>
            {messages.length} messages{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all','unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: filter===f ? '#1a1512' : '#e8e2d6',
                color: filter===f ? '#f5f1eb' : '#5c554e',
                border: '1px solid #d4cdc5',
              }}>
              {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </button>
          ))}
          {messages.filter(m => m.read).length > 0 && (
            <button onClick={clearRead}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5'}}>
              🗑 Clear Read
            </button>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className="mb-4 p-3 rounded-lg text-sm font-semibold"
             style={{background: actionMsg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
                     color: actionMsg.startsWith('✅') ? '#15803d' : '#dc2626'}}>
          {actionMsg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm" style={{color:'#8a8279'}}>
            {filter === 'unread' ? 'No unread messages' : 'Your inbox is empty'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #c8c0b8',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          {filtered.map((msg, idx) => (
            <div key={msg.id}>
              {idx > 0 && <div style={{height:1, background:'#ddd8d0'}} />}

              <div
                onClick={() => toggleExpand(msg)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                style={{
                  background: msg.read ? '#f5f2ee' : '#ffffff',
                  borderLeft: `3px solid ${msg.read ? 'transparent' : '#c8102e'}`,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = msg.read ? '#ede8e1' : '#fef6f6')}
                onMouseLeave={e => (e.currentTarget.style.background = msg.read ? '#f5f2ee' : '#ffffff')}
              >
                <div style={{width:8, height:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  {!msg.read && (
                    <div style={{width:8, height:8, borderRadius:'50%', background:'#c8102e', boxShadow:'0 0 0 2px #ffd0d0'}} />
                  )}
                </div>

                <div style={{fontSize:18, flexShrink:0, opacity: msg.read ? 0.45 : 1}}>
                  {TYPE_ICONS[msg.type] || '📨'}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block"
                    style={{color: msg.read ? '#9a9088' : '#1a1512', fontWeight: msg.read ? 400 : 700}}>
                    {msg.subject}
                  </span>
                  {expanded !== msg.id && (
                    <span className="text-xs truncate block" style={{color: msg.read ? '#b0a89e' : '#6b5f52'}}>
                      {msg.body}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs"
                    style={{color: msg.read ? '#b0a89e' : '#c8102e', fontWeight: msg.read ? 400 : 700}}>
                    {fmtDate(msg.created_at)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteMsg(msg.id) }}
                    className="text-xs px-2 py-1 rounded"
                    style={{background:'transparent', color:'#c0b8b0'}}
                    title="Delete">
                    🗑
                  </button>
                </div>
              </div>

              {expanded === msg.id && (
                <div style={{background:'#fdfcfb', borderTop:'1px solid #ddd8d0'}}>
                  <div className="px-6 py-4">
                    <p className="text-sm" style={{color:'#2a231e', lineHeight:1.8}}>{msg.body}</p>
                    {msg.from_team_id && (
                      <p className="text-xs mt-2" style={{color:'#8a8279'}}>From: {msg.from_team_id}</p>
                    )}
                  </div>

                  {isCommissioner && msg.type === 'application' && msg.metadata?.application_id && (
                    <div className="px-6 py-3 flex items-center gap-3 flex-wrap"
                         style={{background:'#f0ece5', borderTop:'1px solid #ddd8d0'}}>
                      <span className="text-xs font-semibold" style={{color:'#5c554e'}}>
                        Applicant: <strong style={{color:'#1a1512'}}>{msg.metadata.full_name}</strong>
                        {' · '}{msg.metadata.email}
                      </span>
                      <div className="flex gap-2 ml-auto">
                        <button
                          onClick={() => approveApp(msg)}
                          disabled={processing === msg.id}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                          style={{background:'#15803d', color:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}>
                          {processing === msg.id ? '⏳ A processar...' : '✅ Approve'}
                        </button>
                        <button
                          onClick={() => rejectApp(msg)}
                          disabled={processing === msg.id}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                          style={{background:'#dc2626', color:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}>
                          {processing === msg.id ? '⏳...' : '❌ Reject'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

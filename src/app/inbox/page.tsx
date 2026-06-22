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

      // Mark all as read
      await supabase.from('inbox_messages')
        .update({ read: true })
        .eq('to_team_id', tid)
        .eq('read', false)
    })
  }, [])

  const deleteMsg = async (id: string) => {
    await supabase.from('inbox_messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  const clearRead = async () => {
    if (!myTeamId) return
    await supabase.from('inbox_messages').delete().eq('to_team_id', myTeamId).eq('read', true)
    setMessages(prev => prev.filter(m => !m.read))
  }

  // Approve/Reject application directly from inbox
  const approveApp = async (msg: any) => {
    if (!msg.metadata?.application_id) return
    setProcessing(msg.id)
    await supabase.from('job_applications')
      .update({ status: 'approved' })
      .eq('id', msg.metadata.application_id)
    setActionMsg(`✅ Approved! Go to Supabase → Auth → Add user: ${msg.metadata?.email} then run the SQL in /admin/applications.`)
    await deleteMsg(msg.id)
    setProcessing(null)
  }

  const rejectApp = async (msg: any) => {
    if (!msg.metadata?.application_id) return
    setProcessing(msg.id)
    await supabase.from('job_applications')
      .update({ status: 'rejected' })
      .eq('id', msg.metadata.application_id)
    await deleteMsg(msg.id)
    setActionMsg(`❌ Application rejected.`)
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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black mb-1" style={{color:'#1a1512'}}>📬 Inbox</h1>
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
        <div className="flex flex-col gap-2">
          {filtered.map(msg => (
            <div key={msg.id}
                 className="rounded-xl overflow-hidden"
                 style={{
                   border: `1px solid ${msg.read ? '#e2dcd5' : '#d4cdc5'}`,
                   borderLeft: `4px solid ${msg.read ? '#d4cdc5' : '#c8102e'}`,
                 }}>
              {/* Main message */}
              <div className="flex items-start gap-4 px-4 py-4"
                   style={{background: msg.read ? '#faf8f5' : '#fff'}}>
                <div className="text-2xl flex-shrink-0 mt-0.5">
                  {TYPE_ICONS[msg.type] || '📨'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <div className="font-bold text-sm" style={{color:'#1a1512'}}>{msg.subject}</div>
                    <div className="text-xs flex-shrink-0" style={{color:'#8a8279'}}>{fmtDate(msg.created_at)}</div>
                  </div>
                  <div className="text-sm" style={{color:'#5c554e',lineHeight:1.5}}>{msg.body}</div>
                  {msg.from_team_id && (
                    <div className="text-xs mt-1.5" style={{color:'#8a8279'}}>From: {msg.from_team_id}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {!msg.read && (
                    <div className="w-2 h-2 rounded-full" style={{background:'#c8102e'}}></div>
                  )}
                  <button onClick={() => deleteMsg(msg.id)}
                    className="text-xs px-2 py-1 rounded"
                    style={{background:'#f0ece5',color:'#8a8279'}}
                    title="Delete">
                    🗑
                  </button>
                </div>
              </div>

              {/* Application actions - only for commissioner on application type */}
              {isCommissioner && msg.type === 'application' && msg.metadata?.application_id && (
                <div className="px-4 py-3 flex items-center gap-3 flex-wrap"
                     style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5'}}>
                  <span className="text-xs font-semibold" style={{color:'#5c554e'}}>
                    Applicant: <strong style={{color:'#1a1512'}}>{msg.metadata.full_name}</strong>
                    {' · '}{msg.metadata.email}
                  </span>
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={() => approveApp(msg)}
                      disabled={processing === msg.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                      style={{background:'#15803d',color:'#fff'}}>
                      {processing === msg.id ? '...' : '✅ Approve'}
                    </button>
                    <button
                      onClick={() => rejectApp(msg)}
                      disabled={processing === msg.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                      style={{background:'#dc2626',color:'#fff'}}>
                      {processing === msg.id ? '...' : '❌ Reject'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

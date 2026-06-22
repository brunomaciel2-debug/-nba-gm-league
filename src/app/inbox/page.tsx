'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TYPE_ICONS: Record<string,string> = {
  system: '🤖',
  preseason_request: '🏀',
  preseason_accepted: '✅',
  preseason_declined: '❌',
  injury: '🏥',
  trade: '🔄',
  contract: '📝',
  award: '🏆',
}

export default function InboxPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [myTeamId, setMyTeamId] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'unread'>('all')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data: gm } = await supabase.from('gm_profiles').select('team_id, role').eq('id', user.id).single()
      const tid = gm?.team_id || (gm?.role === 'commissioner' ? 'commissioner' : null)
      if (!tid) { setLoading(false); return }
      setMyTeamId(tid)

      const { data } = await supabase
        .from('inbox_messages')
        .select('*')
        .eq('to_team_id', tid)
        .order('created_at', { ascending: false })
        .limit(100)
      setMessages(data || [])
      setLoading(false)

      // Mark all as read
      await supabase.from('inbox_messages')
        .update({ read: true })
        .eq('to_team_id', tid)
        .eq('read', false)
    })
  }, [])

  const filtered = filter === 'unread' ? messages.filter(m => !m.read) : messages
  const unreadCount = messages.filter(m => !m.read).length

  const deleteMsg = async (id: string) => {
    await supabase.from('inbox_messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
  }

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
        <p className="text-sm mb-4" style={{color:'#5c554e'}}>You need to be a GM to access your inbox.</p>
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
        <div className="flex gap-2">
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
        </div>
        {messages.filter(m => m.read).length > 0 && (
          <button onClick={async () => {
            await supabase.from('inbox_messages').delete().eq('to_team_id', myTeamId).eq('read', true)
            setMessages(prev => prev.filter(m => !m.read))
          }}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5'}}>
            🗑 Clear Read
          </button>
        )}
      </div>

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
                 className="flex items-start gap-4 px-4 py-4 rounded-xl group"
                 style={{
                   background: msg.read ? '#faf8f5' : '#fff',
                   border: `1px solid ${msg.read ? '#e2dcd5' : '#d4cdc5'}`,
                   borderLeft: `4px solid ${msg.read ? '#d4cdc5' : '#c8102e'}`,
                 }}>
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
                  <div className="text-xs mt-1.5" style={{color:'#8a8279'}}>
                    From: {msg.from_team_id}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {!msg.read && (
                  <div className="w-2 h-2 rounded-full"
                       style={{background:'#c8102e'}}></div>
                )}
                <button onClick={() => deleteMsg(msg.id)}
                  className="text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{background:'#fee2e2',color:'#dc2626'}}
                  title="Delete">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

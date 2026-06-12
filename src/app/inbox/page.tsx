'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const MSG_TYPE_STYLE: Record<string,{color:string,icon:string,label:string}> = {
  message:        {color:'#1e40af',icon:'💬',label:'Message'},
  trade_proposal: {color:'#b45309',icon:'🔄',label:'Trade Proposal'},
  staff_offer:    {color:'#166534',icon:'👔',label:'Staff Offer'},
  system:         {color:'#6b5f4e',icon:'🔔',label:'System'},
}

export default function InboxPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const [profiles,    setProfiles]    = useState<any[]>([])
  const [thread,      setThread]      = useState<any | null>(null) // selected user to chat with
  const [messages,    setMessages]    = useState<any[]>([])
  const [newMsg,      setNewMsg]      = useState('')
  const [sending,     setSending]     = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading])

  useEffect(() => {
    if (!user) return
    // Load all GM profiles
    supabase.from('gm_profiles').select('*, teams(id,name,color,logo_url)')
      .neq('id', user.id).then(({ data }) => setProfiles(data||[]))

    // Presence for online status
    const presence = supabase.channel('online-users')
    presence.on('presence', { event: 'sync' }, () => {
      const state = presence.presenceState()
      setOnlineUsers(new Set(Object.keys(state)))
    }).subscribe(async status => {
      if (status === 'SUBSCRIBED') await presence.track({ user_id: user.id })
    })
    return () => { supabase.removeChannel(presence) }
  }, [user])

  useEffect(() => {
    if (!user || !thread) return
    // Load messages for this thread
    const load = async () => {
      const { data } = await supabase.from('messages').select('*')
        .or(`and(from_user.eq.${user.id},to_user.eq.${thread.id}),and(from_user.eq.${thread.id},to_user.eq.${user.id})`)
        .order('created_at')
      setMessages(data||[])
      // Mark as read
      await supabase.from('messages').update({ read: true })
        .eq('to_user', user.id).eq('from_user', thread.id).eq('read', false)
    }
    load()
    // Realtime subscription for this thread
    const sub = supabase.channel(`thread-${thread.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const m = payload.new as any
        if ((m.from_user===user.id&&m.to_user===thread.id)||(m.from_user===thread.id&&m.to_user===user.id)) {
          setMessages(prev => [...prev, m])
          if (m.to_user===user.id) supabase.from('messages').update({read:true}).eq('id',m.id)
        }
      }).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [user, thread])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!newMsg.trim() || !thread || !user) return
    setSending(true)
    await supabase.from('messages').insert({
      from_user: user.id, to_user: thread.id,
      body: newMsg.trim(), type: 'message'
    })
    setNewMsg('')
    setSending(false)
  }

  if (authLoading) return (
    <div className="flex items-center justify-center h-64" style={{color:'#6b5f4e'}}>Loading...</div>
  )
  if (!user) return null

  const teamColor = profile?.teams?.color ? '#'+profile.teams.color : '#3a8adf'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4" style={{color:'#1a1612'}}>✉️ Messages</h1>
      <div className="flex gap-4 h-[600px]">
        {/* Sidebar — GMs list */}
        <div className="w-64 flex-shrink-0 rounded-xl overflow-hidden flex flex-col"
             style={{border:'1px solid #d4cec3',background:'#e8e2d6'}}>
          <div className="px-4 py-3" style={{borderBottom:'1px solid #d4cec3',background:'#ddd7ca'}}>
            <p className="text-xs font-semibold" style={{color:'#6b5f4e'}}>All GMs</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {profiles.map(p => {
              const tc = p.teams?.color ? '#'+p.teams.color : '#6b6258'
              const isOnline = onlineUsers.has(p.id)
              const isSelected = thread?.id === p.id
              return (
                <button key={p.id} onClick={() => setThread(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                  style={{background:isSelected?'#cec8be':'transparent',
                          borderBottom:'1px solid #ddd8ce'}}>
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full overflow-hidden"
                         style={{background:tc+'22',border:'1.5px solid '+tc+'44'}}>
                      {p.teams?.logo_url
                        ?<img src={p.teams.logo_url} alt="" className="w-full h-full object-contain p-1"/>
                        :<div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:tc}}>
                           {p.teams?.id?.slice(0,2)||'?'}
                         </div>}
                    </div>
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                         style={{background:isOnline?'#40e080':'#9c9088',borderColor:'#ede8df'}}></div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{color:'#1a1612'}}>
                      {p.display_name||p.teams?.name||'GM'}
                    </div>
                    <div className="text-xs" style={{color:tc}}>{p.teams?.name}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 rounded-xl flex flex-col overflow-hidden"
             style={{border:'1px solid #d4cec3',background:'#e8e2d6'}}>
          {thread ? (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3"
                   style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
                <div className="w-8 h-8 rounded-full overflow-hidden"
                     style={{background:'#cec8be'}}>
                  {thread.teams?.logo_url
                    ?<img src={thread.teams.logo_url} alt="" className="w-full h-full object-contain p-1"/>
                    :<div className="w-full h-full flex items-center justify-center text-xs font-black"
                          style={{color:'#6b5f4e'}}>{thread.teams?.id?.slice(0,2)}</div>}
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{color:'#1a1612'}}>
                    {thread.display_name||thread.teams?.name}
                  </div>
                  <div className="text-xs" style={{color:onlineUsers.has(thread.id)?'#40e080':'#9c9088'}}>
                    {onlineUsers.has(thread.id)?'🟢 Online':'⚫ Offline'}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {messages.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm" style={{color:'#9c8e7a'}}>No messages yet. Say hello!</p>
                  </div>
                )}
                {messages.map((m:any) => {
                  const isMe = m.from_user === user.id
                  const typeInfo = MSG_TYPE_STYLE[m.type]||MSG_TYPE_STYLE.message
                  return (
                    <div key={m.id} className={`flex ${isMe?'justify-end':'justify-start'}`}>
                      <div className="max-w-[70%]">
                        {m.type !== 'message' && (
                          <div className="text-xs mb-1 px-1" style={{color:typeInfo.color}}>
                            {typeInfo.icon} {typeInfo.label}
                          </div>
                        )}
                        <div className="px-4 py-2.5 rounded-2xl text-sm"
                             style={{background:isMe?'#1e3a5f':'#cec8be',
                                     color:'#1a1612',
                                     borderBottomRightRadius:isMe?4:undefined,
                                     borderBottomLeftRadius:!isMe?4:undefined}}>
                          {m.subject && <div className="font-bold mb-1">{m.subject}</div>}
                          {m.body}
                          {m.ref_id && m.type==='trade_proposal' && (
                            <Link href={`/trade-center/${m.ref_id}`}
                                  className="block mt-2 text-xs no-underline"
                                  style={{color:'#b45309'}}>
                              View Trade Proposal →
                            </Link>
                          )}
                        </div>
                        <div className="text-xs mt-0.5 px-1"
                             style={{color:'#b8ae9e',textAlign:isMe?'right':'left'}}>
                          {new Date(m.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3" style={{borderTop:'1px solid #3a3228'}}>
                <div className="flex gap-2">
                  <input value={newMsg} onChange={e=>setNewMsg(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}} />
                  <button onClick={sendMessage} disabled={sending||!newMsg.trim()}
                    className="px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-40"
                    style={{background:'#3a8adf',color:'#e8e2d6'}}>
                    {sending?'...':'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="text-4xl">✉️</div>
              <p className="text-sm" style={{color:'#6b5f4e'}}>Select a GM to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function ChatPage() {
  const [myTeamId, setMyTeamId] = useState<string|null>(null)
  const [myName, setMyName] = useState<string>('')
  const [teams, setTeams] = useState<any[]>([])
  const [channels, setChannels] = useState<{id:string,name:string,type:'general'|'dm'}[]>([
    { id:'general', name:'🏀 General', type:'general' }
  ])
  const [activeChannel, setActiveChannel] = useState('general')
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState<Record<string,number>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data: gm } = await supabase
        .from('gm_profiles')
        .select('team_id, display_name, role')
        .eq('id', user.id)
        .single()
      if (gm) {
        setMyTeamId(gm.team_id || 'commissioner')
        setMyName(gm.display_name || gm.team_id || 'Commissioner')
      }
      setLoading(false)
    })

    // Load all teams for DM channels
    supabase.from('teams').select('id,name,color,logo_url')
      .not('id','in','(ALL,RVS)').order('name')
      .then(({ data }) => setTeams(data || []))
  }, [])

  // Load messages for active channel
  useEffect(() => {
    setMessages([])
    supabase.from('chat_messages')
      .select('*')
      .eq('channel', activeChannel)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setMessages(data || [])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })

    // Realtime subscription
    const sub = supabase
      .channel(`chat:${activeChannel}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel=eq.${activeChannel}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [activeChannel])

  const send = async () => {
    if (!input.trim() || !myTeamId) return
    await supabase.from('chat_messages').insert({
      channel: activeChannel,
      from_team_id: myTeamId,
      from_name: myName,
      body: input.trim(),
    })
    setInput('')
  }

  const openDM = (teamId: string) => {
    const channelId = [myTeamId, teamId].sort().join('_')
    const team = teams.find(t => t.id === teamId)
    if (!channels.find(c => c.id === channelId)) {
      setChannels(prev => [...prev, { id: channelId, name: `💬 ${team?.name||teamId}`, type: 'dm' }])
    }
    setActiveChannel(channelId)
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12: false })
  }
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric' })
  }

  // Group messages by date
  const groupedMessages: { date: string, msgs: any[] }[] = []
  for (const msg of messages) {
    const date = fmtDate(msg.created_at)
    const last = groupedMessages[groupedMessages.length - 1]
    if (last && last.date === date) last.msgs.push(msg)
    else groupedMessages.push({ date, msgs: [msg] })
  }

  const activeChannelInfo = channels.find(c => c.id === activeChannel)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div style={{color:'#5c554e'}}>Loading...</div>
    </div>
  )

  if (!myTeamId) return (
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
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex gap-0 rounded-2xl overflow-hidden" style={{border:'1px solid #d4cdc5',height:'calc(100vh - 160px)',minHeight:500}}>

        {/* SIDEBAR */}
        <div className="w-64 flex-shrink-0 flex flex-col" style={{background:'#1a1512',borderRight:'1px solid #3a3228'}}>
          <div className="px-4 py-4" style={{borderBottom:'1px solid #3a3228'}}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{color:'#8a8279'}}>NBA GM League</div>
            <div className="text-sm font-bold mt-0.5" style={{color:'#f5f1eb'}}>Chat</div>
          </div>

          {/* Channels */}
          <div className="flex-1 overflow-y-auto py-2">
            <div className="px-3 mb-1">
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e'}}>Channels</div>
              {channels.filter(c=>c.type==='general').map(c=>(
                <button key={c.id} onClick={()=>setActiveChannel(c.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold mb-0.5"
                  style={{background:activeChannel===c.id?'#3a3228':'transparent',color:activeChannel===c.id?'#f5f1eb':'#8a8279'}}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* DM channels */}
            {channels.filter(c=>c.type==='dm').length > 0 && (
              <div className="px-3 mt-3 mb-1">
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e'}}>Direct Messages</div>
                {channels.filter(c=>c.type==='dm').map(c=>(
                  <button key={c.id} onClick={()=>setActiveChannel(c.id)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5"
                    style={{background:activeChannel===c.id?'#3a3228':'transparent',color:activeChannel===c.id?'#f5f1eb':'#8a8279'}}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* New DM */}
            <div className="px-3 mt-3">
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e'}}>GMs Online</div>
              {teams.filter(t=>t.id!==myTeamId).map(t=>(
                <button key={t.id} onClick={()=>openDM(t.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs mb-0.5 flex items-center gap-2"
                  style={{color:'#8a8279'}}>
                  {t.logo_url && <img src={t.logo_url} alt="" className="w-4 h-4 object-contain"/>}
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* My identity */}
          <div className="px-4 py-3" style={{borderTop:'1px solid #3a3228'}}>
            <div className="text-xs font-bold" style={{color:'#f5f1eb'}}>{myName}</div>
            <div className="text-xs" style={{color:'#5c554e'}}>{myTeamId}</div>
          </div>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 flex flex-col" style={{background:'#faf8f5'}}>
          {/* Header */}
          <div className="px-5 py-3 flex items-center gap-3" style={{borderBottom:'1px solid #d4cdc5',background:'#f5f1eb'}}>
            <div className="font-bold text-sm" style={{color:'#1a1512'}}>{activeChannelInfo?.name||activeChannel}</div>
            {activeChannelInfo?.type==='general' && (
              <span className="text-xs" style={{color:'#8a8279'}}>{teams.length + 1} members</span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {groupedMessages.length === 0 && (
              <div className="text-center py-12" style={{color:'#8a8279'}}>
                <div className="text-3xl mb-2">💬</div>
                <div className="text-sm">No messages yet. Say hello!</div>
              </div>
            )}
            {groupedMessages.map(({ date, msgs }) => (
              <div key={date}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px" style={{background:'#d4cdc5'}}></div>
                  <span className="text-xs font-semibold px-2" style={{color:'#8a8279'}}>{date}</span>
                  <div className="flex-1 h-px" style={{background:'#d4cdc5'}}></div>
                </div>
                {msgs.map((msg, i) => {
                  const isMe = msg.from_team_id === myTeamId
                  const prevMsg = msgs[i-1]
                  const sameAuthor = prevMsg && prevMsg.from_team_id === msg.from_team_id
                  return (
                    <div key={msg.id} className={`flex gap-3 mb-1 ${isMe?'flex-row-reverse':''}`}>
                      {!sameAuthor && !isMe && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black"
                             style={{background:'#e8e2d6',color:'#1a1512',marginTop:4}}>
                          {msg.from_name?.substring(0,2)?.toUpperCase()}
                        </div>
                      )}
                      {(sameAuthor || isMe) && <div className="w-8 flex-shrink-0"></div>}
                      <div className={`max-w-xs lg:max-w-md ${isMe?'items-end':'items-start'} flex flex-col`}>
                        {!sameAuthor && (
                          <div className={`text-xs font-bold mb-0.5 ${isMe?'text-right':''}`}
                               style={{color: isMe?'#1d4ed8':'#b45309'}}>
                            {msg.from_name}
                          </div>
                        )}
                        <div className="px-3 py-2 rounded-2xl text-sm"
                             style={{
                               background: isMe?'#1d4ed8':'#e8e2d6',
                               color: isMe?'#fff':'#1a1512',
                               borderBottomRightRadius: isMe?4:16,
                               borderBottomLeftRadius: isMe?16:4,
                             }}>
                          {msg.body}
                        </div>
                        <div className="text-xs mt-0.5" style={{color:'#b8ae9e'}}>{fmtTime(msg.created_at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={bottomRef}></div>
          </div>

          {/* Input */}
          <div className="px-4 py-3" style={{borderTop:'1px solid #d4cdc5',background:'#f5f1eb'}}>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
                placeholder={`Message ${activeChannelInfo?.name||'...'}`}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm"
                style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}
              />
              <button onClick={send} disabled={!input.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{background:'#1d4ed8',color:'#fff'}}>
                Send
              </button>
            </div>
            <div className="text-xs mt-1.5" style={{color:'#8a8279'}}>Press Enter to send</div>
          </div>
        </div>
      </div>
    </div>
  )
}

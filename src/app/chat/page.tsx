'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

export default function ChatPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [myTeamId, setMyTeamId] = useState<string|null>(null)
  const [myUserId, setMyUserId] = useState<string|null>(null)
  const [myName, setMyName] = useState<string>('')
  const [myRole, setMyRole] = useState<string>('')
  const [teams, setTeams] = useState<any[]>([])
  const [activeChannel, setActiveChannel] = useState('general')
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewDM, setShowNewDM] = useState(false)
  const [reads, setReads] = useState<Record<string, string>>({})
  const [dmList, setDmList] = useState<{id:string, name:string, lastMsg:string, lastTime:string, unread:boolean}[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      setMyUserId(user.id)
      const { data: gm } = await supabase
        .from('gm_profiles')
        .select('team_id, display_name, role')
        .eq('id', user.id)
        .single()
      if (gm) {
        const tid = gm.role === 'commissioner' ? 'commissioner' : gm.team_id
        setMyTeamId(tid)
        setMyName(gm.display_name || tid || 'Unknown')
        setMyRole(gm.role)
      }
      setLoading(false)
    })

    supabase.from('teams').select('id,name,color,logo_url')
      .not('id','in','(ALL,RVS,ROO,SOP)').order('name')
      .then(({ data }) => {
        const commissioner = { id: 'commissioner', name: 'Commissioner', logo_url: null, color: 'c8102e' }
        setTeams([commissioner, ...(data || [])])
      })
  }, [])

  // Carregar DMs com actividade + reads
  const loadDMs = async (tid: string, uid: string) => {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('channel, body, from_team_id, from_name, created_at')
      .like('channel', `%${tid}%`)
      .order('created_at', { ascending: false })
      .limit(500)

    const { data: readsData } = await supabase
      .from('chat_reads')
      .select('channel, last_read_at')
      .eq('user_id', uid)

    const readsMap: Record<string, string> = {}
    for (const r of (readsData || [])) readsMap[r.channel] = r.last_read_at
    setReads(readsMap)

    // Agrupar por canal DM
    const channelMap: Record<string, any> = {}
    for (const msg of (msgs || [])) {
      if (msg.channel === 'general') continue
      if (!channelMap[msg.channel]) channelMap[msg.channel] = msg
    }

    const list = Object.entries(channelMap).map(([channelId, lastMsg]: [string, any]) => {
      // Descobrir nome do outro participante
      const parts = channelId.split('_')
      const otherId = parts.find((p: string) => p !== tid) || ''
      const lastRead = readsMap[channelId]
      const unread = lastMsg.from_team_id !== tid && (!lastRead || new Date(lastMsg.created_at) > new Date(lastRead))
      return {
        id: channelId,
        otherId,
        lastMsg: lastMsg.body,
        lastTime: lastMsg.created_at,
        unread,
      }
    })

    list.sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime())
    setDmList(list as any)
  }

  useEffect(() => {
    if (myTeamId && myUserId) loadDMs(myTeamId, myUserId)
  }, [myTeamId, myUserId])

  // Realtime para novos DMs
  useEffect(() => {
    if (!myTeamId || !myUserId) return
    const sub = supabase
      .channel('dm_notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        loadDMs(myTeamId, myUserId)
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [myTeamId, myUserId])

  const markAsRead = async (channel: string, userId: string) => {
    await supabase.from('chat_reads').upsert({
      user_id: userId,
      channel,
      last_read_at: new Date().toISOString(),
    }, { onConflict: 'user_id,channel' })
    setReads(prev => ({ ...prev, [channel]: new Date().toISOString() }))
    setDmList(prev => prev.map(d => d.id === channel ? { ...d, unread: false } : d))
  }

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

    if (myUserId) markAsRead(activeChannel, myUserId)

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
        if (myUserId) markAsRead(activeChannel, myUserId)
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [activeChannel, myUserId])

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
    setActiveChannel(channelId)
    setShowNewDM(false)
    if (myUserId) markAsRead(channelId, myUserId)
  }

  const getTeamName = (id: string) => {
    if (id === 'commissioner') return isPT ? 'Comissário' : 'Commissioner'
    return teams.find(t => t.id === id)?.name || id
  }

  const getTeamLogo = (id: string) => {
    if (id === 'commissioner') return null
    return teams.find(t => t.id === id)?.logo_url || null
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return d.toLocaleTimeString(isPT?'pt-PT':'en-US', { hour:'numeric', minute:'2-digit', hour12: false })
    return d.toLocaleDateString(isPT?'pt-PT':'en-US', { month:'short', day:'numeric' })
  }

  const fmtMsgTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString(isPT?'pt-PT':'en-US', { hour:'numeric', minute:'2-digit', hour12: false })
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(isPT?'pt-PT':'en-US', { month:'short', day:'numeric' })
  }

  const groupedMessages: { date: string, msgs: any[] }[] = []
  for (const msg of messages) {
    const date = fmtDate(msg.created_at)
    const last = groupedMessages[groupedMessages.length - 1]
    if (last && last.date === date) last.msgs.push(msg)
    else groupedMessages.push({ date, msgs: [msg] })
  }

  const activeChannelOtherId = activeChannel === 'general' ? null
    : (activeChannel.split('_').find(p => p !== myTeamId) || null)
  const activeChannelName = activeChannel === 'general'
    ? (isPT?'🏀 Geral':'🏀 General')
    : getTeamName(activeChannelOtherId || '')

  const contacts = teams.filter(t => t.id !== myTeamId)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div style={{color:'#5c554e'}}>{t('common.loading')}</div>
    </div>
  )

  if (!loading && !myTeamId) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-8 rounded-2xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div className="text-4xl mb-4">🔒</div>
        <div className="text-xl font-black mb-2" style={{color:'#1a1512'}}>{isPT?'Login Necessário':'Login Required'}</div>
        <a href="/login" className="text-sm font-bold px-4 py-2 rounded-lg"
           style={{background:'#1a1512',color:'#fff',textDecoration:'none'}}>{isPT?'Iniciar Sessão':'Sign In'}</a>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex gap-0 rounded-2xl overflow-hidden" style={{border:'1px solid #d4cdc5',height:'calc(100vh - 160px)',minHeight:500}}>

        {/* SIDEBAR */}
        <div className="w-72 flex-shrink-0 flex flex-col" style={{background:'#1a1512',borderRight:'1px solid #3a3228'}}>
          <div className="px-4 py-4" style={{borderBottom:'1px solid #3a3228'}}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{color:'#8a8279'}}>NBA GM League</div>
            <div className="text-sm font-bold mt-0.5" style={{color:'#f5f1eb'}}>Chat</div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* General */}
            <div className="px-3 pt-3 pb-1">
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e'}}>{isPT?'Canais':'Channels'}</div>
              <button onClick={() => setActiveChannel('general')}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold"
                style={{background: activeChannel==='general' ? '#3a3228' : 'transparent', color: activeChannel==='general' ? '#f5f1eb' : '#8a8279'}}>
                🏀 {isPT?'Geral':'General'}
              </button>
            </div>

            {/* DMs com actividade */}
            <div className="px-3 pt-3">
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e'}}>{isPT?'Mensagens Directas':'Direct Messages'}</div>
              {dmList.length === 0 && (
                <div className="text-xs px-3 py-2" style={{color:'#5c554e'}}>{isPT?'Ainda sem conversas':'No conversations yet'}</div>
              )}
              {dmList.map((dm: any) => {
                const isActive = activeChannel === dm.id
                const logo = getTeamLogo(dm.otherId)
                const name = getTeamName(dm.otherId)
                return (
                  <button key={dm.id} onClick={() => { setActiveChannel(dm.id); if (myUserId) markAsRead(dm.id, myUserId) }}
                    className="w-full text-left px-3 py-2.5 rounded-lg mb-0.5 flex items-center gap-3"
                    style={{background: isActive ? '#3a3228' : 'transparent'}}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2a221c' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {dm.otherId === 'commissioner'
                        ? <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                               style={{background:'#c8102e'}}>👑</div>
                        : logo
                          ? <img src={logo} alt="" className="w-8 h-8 object-contain rounded-full"
                                 style={{background:'#2a221c'}}/>
                          : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                                 style={{background:'#3a3228',color:'#f5f1eb'}}>{name.substring(0,2)}</div>
                      }
                      {dm.unread && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center font-black"
                              style={{width:14,height:14,borderRadius:'50%',background:'#c8102e',color:'#fff',fontSize:9,border:'2px solid #1a1512'}}>
                          !
                        </span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate"
                              style={{color: dm.unread ? '#f5f1eb' : '#c0b8ae'}}>{name}</span>
                        <span className="text-xs flex-shrink-0 ml-1" style={{color:'#5c554e'}}>{fmtTime(dm.lastTime)}</span>
                      </div>
                      <div className="text-xs truncate mt-0.5"
                           style={{color: dm.unread ? '#a09890' : '#5c554e', fontWeight: dm.unread ? 600 : 400}}>
                        {dm.lastMsg}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Nova conversa */}
            <div className="px-3 pt-3 pb-3">
              <button onClick={() => setShowNewDM(!showNewDM)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
                style={{background:'#2a221c', color:'#8a8279'}}
                onMouseEnter={e => (e.currentTarget.style.background = '#3a3228')}
                onMouseLeave={e => (e.currentTarget.style.background = '#2a221c')}>
                <span style={{fontSize:14}}>✏️</span>
                {isPT?'Nova Mensagem':'New Message'}
                <span style={{marginLeft:'auto', fontSize:10}}>{showNewDM ? '▲' : '▼'}</span>
              </button>
              {showNewDM && (
                <div className="mt-1 rounded-lg overflow-hidden" style={{background:'#0f0d0a',border:'1px solid #3a3228'}}>
                  {contacts.map(t => (
                    <button key={t.id} onClick={() => openDM(t.id)}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                      style={{color:'#8a8279', borderBottom:'1px solid #1a1512'}}
                      onMouseEnter={e => (e.currentTarget.style.background = '#2a221c')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {t.id === 'commissioner'
                        ? <span style={{fontSize:12}}>👑</span>
                        : t.logo_url
                          ? <img src={t.logo_url} alt="" className="w-4 h-4 object-contain flex-shrink-0"/>
                          : <span className="w-4 h-4 flex-shrink-0"/>
                      }
                      <span className="truncate">{t.id === 'commissioner' ? (isPT?'Comissário':'Commissioner') : t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Identity */}
          <div className="px-4 py-3" style={{borderTop:'1px solid #3a3228'}}>
            <div className="text-xs font-bold" style={{color:'#f5f1eb'}}>{myName}</div>
            <div className="text-xs" style={{color:'#5c554e'}}>{myRole === 'commissioner' ? (isPT?'Comissário':'Commissioner') : myTeamId}</div>
          </div>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 flex flex-col" style={{background:'#faf8f5'}}>
          <div className="px-5 py-3 flex items-center gap-3" style={{borderBottom:'1px solid #d4cdc5',background:'#f5f1eb'}}>
            <div className="font-bold text-sm" style={{color:'#1a1512'}}>
              {activeChannelOtherId && activeChannelOtherId !== 'commissioner'
                ? <Link href={`/team/${activeChannelOtherId}`} className="hover:underline" style={{color:'inherit'}}>{activeChannelName}</Link>
                : activeChannelName}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {groupedMessages.length === 0 && (
              <div className="text-center py-12" style={{color:'#8a8279'}}>
                <div className="text-3xl mb-2">💬</div>
                <div className="text-sm">{isPT?'Ainda sem mensagens. Diz olá!':'No messages yet. Say hello!'}</div>
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
                  const isComm = msg.from_team_id === 'commissioner'
                  return (
                    <div key={msg.id} className={`flex gap-3 mb-1 ${isMe?'flex-row-reverse':''}`}>
                      {!sameAuthor && !isMe && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black"
                             style={{background: isComm?'#c8102e':'#e8e2d6', color: isComm?'#fff':'#1a1512', marginTop:4}}>
                          {isComm ? '👑' : msg.from_name?.substring(0,2)?.toUpperCase()}
                        </div>
                      )}
                      {(sameAuthor || isMe) && <div className="w-8 flex-shrink-0"></div>}
                      <div className={`max-w-xs lg:max-w-md ${isMe?'items-end':'items-start'} flex flex-col`}>
                        {!sameAuthor && (
                          <div className={`text-xs font-bold mb-0.5 ${isMe?'text-right':''}`}
                               style={{color: isMe?'#1d4ed8': isComm?'#c8102e':'#b45309'}}>
                            {msg.from_name}
                          </div>
                        )}
                        <div className="px-3 py-2 rounded-2xl text-sm"
                             style={{
                               background: isMe?'#1d4ed8': isComm?'#c8102e22':'#e8e2d6',
                               color: isMe?'#fff':'#1a1512',
                               borderBottomRightRadius: isMe?4:16,
                               borderBottomLeftRadius: isMe?16:4,
                               border: isComm && !isMe ? '1px solid #c8102e44' : 'none',
                             }}>
                          {msg.body}
                        </div>
                        <div className="text-xs mt-0.5" style={{color:'#b8ae9e'}}>{fmtMsgTime(msg.created_at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={bottomRef}></div>
          </div>

          <div className="px-4 py-3" style={{borderTop:'1px solid #d4cdc5',background:'#f5f1eb'}}>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
                placeholder={isPT ? `Mensagem para ${activeChannelName}` : `Message ${activeChannelName}`}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm"
                style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}
              />
              <button onClick={send} disabled={!input.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{background:'#1d4ed8',color:'#fff'}}>
                {isPT?'Enviar':'Send'}
              </button>
            </div>
            <div className="text-xs mt-1.5" style={{color:'#8a8279'}}>{isPT?'Prime Enter para enviar':'Press Enter to send'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

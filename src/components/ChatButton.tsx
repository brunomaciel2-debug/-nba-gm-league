'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ChatButton() {
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    let sub: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: gm } = await supabase
        .from('gm_profiles')
        .select('team_id, role')
        .eq('id', user.id)
        .single()
      if (!gm) return

      const myTeamId = gm.role === 'commissioner' ? 'commissioner' : gm.team_id
      if (!myTeamId) return

      const checkUnread = async () => {
        const { data: myMessages } = await supabase
          .from('chat_messages')
          .select('channel')
          .or(`channel.eq.general,channel.like.%${myTeamId}%`)
          .order('created_at', { ascending: false })
          .limit(200)

        const channels = (myMessages || []).map((m: any) => m.channel).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
        if (channels.length === 0) { setHasUnread(false); return }

        const { data: reads } = await supabase
          .from('chat_reads')
          .select('channel, last_read_at')
          .eq('user_id', user.id)

        const readsMap: Record<string, string> = {}
        for (const r of (reads || [])) readsMap[r.channel] = r.last_read_at

        for (const channel of channels) {
          const lastRead = readsMap[channel]
          const { data: newMsgs } = await supabase
            .from('chat_messages')
            .select('id, from_team_id')
            .eq('channel', channel)
            .neq('from_team_id', myTeamId)
            .gt('created_at', lastRead || '2000-01-01')
            .limit(1)

          if (newMsgs && newMsgs.length > 0) {
            setHasUnread(true)
            return
          }
        }
        setHasUnread(false)
      }

      await checkUnread()

      sub = supabase
        .channel('chat_unread_notify')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        }, (payload) => {
          if (payload.new.from_team_id !== myTeamId) {
            checkUnread()
          }
        })
        .subscribe()
    }

    init()

    return () => {
      if (sub) supabase.removeChannel(sub)
    }
  }, [])

  return (
    <Link
      href="/chat"
      onClick={() => setHasUnread(false)}
      className="relative flex items-center justify-center w-8 h-8 rounded-lg no-underline"
      style={{color:'#8a8279'}}
      title="GM Chat"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      {hasUnread && (
        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center font-black"
              style={{width:14, height:14, borderRadius:'50%', background:'#c8102e', color:'#fff', fontSize:9, border:'2px solid #0f1623'}}>
          !
        </span>
      )}
    </Link>
  )
}

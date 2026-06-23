'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function InboxButton() {
  const [unread, setUnread] = useState(0)

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

      const toTeamId = gm.role === 'commissioner' ? 'commissioner' : gm.team_id
      if (!toTeamId) return

      const { count } = await supabase
        .from('inbox_messages')
        .select('*', { count: 'exact', head: true })
        .eq('to_team_id', toTeamId)
        .eq('read', false)
      setUnread(count || 0)

      sub = supabase
        .channel('inbox:' + toTeamId)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'inbox_messages',
          filter: `to_team_id=eq.${toTeamId}`,
        }, () => setUnread(n => n + 1))
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'inbox_messages',
          filter: `to_team_id=eq.${toTeamId}`,
        }, (payload) => {
          if (payload.old.read === false && payload.new.read === true) {
            setUnread(n => Math.max(0, n - 1))
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
    <Link href="/inbox" className="relative flex items-center justify-center w-8 h-8 rounded-lg no-underline"
          style={{color:'#8a8279'}} title="Inbox">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 text-xs font-black rounded-full flex items-center justify-center"
              style={{background:'#c8102e',color:'#fff',minWidth:16,height:16,fontSize:9,padding:'0 3px'}}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
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

      // Escuta novas mensagens no canal general
      sub = supabase
        .channel('chat_notify')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        }, (payload) => {
          // Só notifica se não foi o próprio a enviar
          const fromTeam = payload.new.from_team_id
          const myTeam = gm.role === 'commissioner' ? null : gm.team_id
          if (fromTeam !== myTeam) {
            setHasUnread(true)
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
        <span className="absolute -top-1 -right-1 flex items-center justify-center"
              style={{width:8, height:8, borderRadius:'50%', background:'#1d4ed8', border:'2px solid #faf8f5'}}>
        </span>
      )}
    </Link>
  )
}

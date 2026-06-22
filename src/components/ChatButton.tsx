'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ChatButton() {
  const [unread, setUnread] = useState(0)
  const [myTeamId, setMyTeamId] = useState<string|null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: gm } = await supabase.from('gm_profiles').select('team_id').eq('id', user.id).single()
      if (gm?.team_id) setMyTeamId(gm.team_id)
    })
  }, [])

  // For now just show the icon - unread count will be added later with read tracking
  return (
    <Link href="/chat" className="relative flex items-center justify-center w-8 h-8 rounded-lg no-underline"
          style={{color:'#8a8279'}} title="GM Chat">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 text-xs font-black rounded-full flex items-center justify-center"
              style={{background:'#1d4ed8',color:'#fff',minWidth:16,height:16,fontSize:9,padding:'0 3px'}}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

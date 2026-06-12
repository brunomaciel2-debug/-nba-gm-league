'use client'
import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function InboxButton() {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { count } = await supabase.from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('to_user', user.id).eq('read', false)
      setUnread(count || 0)
    }
    load()
    // Realtime subscription
    const sub = supabase.channel('inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
          filter: `to_user=eq.${user.id}` }, () => {
        setUnread(u => u + 1)
      }).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [user])

  if (!user) return null

  return (
    <Link href="/inbox" className="relative no-underline">
      <div className="w-8 h-8 flex items-center justify-center rounded-full"
           style={{background:'#cec7bc'}}>
        <span className="text-sm">✉️</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-black"
                style={{background:'#dc2626',color:'#fff',fontSize:9}}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>
    </Link>
  )
}

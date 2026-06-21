'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function GMPanel({ teamId }: { teamId: string }) {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data: gm } = await supabase
        .from('gm_profiles')
        .select('team_id, is_commissioner')
        .eq('id', user.id)
        .single()
      if (gm?.is_commissioner || gm?.team_id === teamId) {
        setAuthorized(true)
      }
      setLoading(false)
    })
  }, [teamId])

  if (loading || !authorized) return null

  return (
    <div className="rounded-xl p-4" style={{background:'#f0fdf4',border:'1px solid #15803d'}}>
      <h3 className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{color:'#15803d',letterSpacing:'1px'}}>
        🏀 GM Panel
      </h3>
      <p className="text-xs mb-3" style={{color:'#5c554e'}}>
        Depth chart, ball roles and tactics. Deadline: Sunday 23:59.
      </p>
      <Link href={`/gm/orders/${teamId}`}
            className="block text-center text-sm font-bold py-2.5 rounded-lg no-underline"
            style={{background:'#15803d',color:'#fff',fontWeight:700}}>
        Set Weekly Orders →
      </Link>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function CutButton({ playerId, playerTeamId }: { playerId: number, playerTeamId: string | null }) {
  const [gmTeamId, setGmTeamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('gm_profiles').select('team_id').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.team_id) setGmTeamId(data.team_id)
        })
    })
  }, [])

  // Only show if this GM owns the player's team
  if (!gmTeamId || gmTeamId !== playerTeamId) return null

  const handleCut = async () => {
    if (!confirmed) {
      setConfirmed(true)
      setMsg('Click again to confirm waiver.')
      return
    }

    setLoading(true)
    setMsg('')

    try {
      // 1. Mark contracts as waived (team still on the hook financially)
      const { error: contractErr } = await supabase
        .from('contracts')
        .update({ waived: true, waived_by_team: gmTeamId })
        .eq('player_id', playerId)

      if (contractErr) throw contractErr

      // 2. Remove player from team roster
      const { error: playerErr } = await supabase
        .from('players')
        .update({ team_id: null, status: 'active' })
        .eq('id', playerId)

      if (playerErr) throw playerErr

      setMsg('Player waived. Contract remains on your cap.')
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      setMsg('Error: ' + err.message)
      setConfirmed(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={handleCut}
        disabled={loading}
        style={{
          background: confirmed ? '#dc2626' : '#7f1d1d',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '7px 18px',
          fontWeight: 700,
          fontSize: 13,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          transition: 'background 0.2s',
        }}
      >
        {loading ? 'Processing...' : confirmed ? '⚠️ Confirm Waiver' : '✂️ Cut / Waive'}
      </button>
      {msg && (
        <div style={{
          marginTop: 6,
          fontSize: 12,
          color: msg.startsWith('Error') ? '#dc2626' : '#15803d',
          fontWeight: 600
        }}>
          {msg}
        </div>
      )}
    </div>
  )
}

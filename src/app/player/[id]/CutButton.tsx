'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const MIN_ROSTER = 12

export default function CutButton({ playerId, playerTeamId }: { playerId: number, playerTeamId: string }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [rosterSize, setRosterSize] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: gm } = await supabase.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
      if (!gm) return

      const isOwner = gm.team_id === playerTeamId
      const isComm = gm.role === 'commissioner'
      setIsCommissioner(isComm)
      setAuthorized(isOwner || isComm)

      if (isOwner || isComm) {
        const { count } = await supabase
          .from('players')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', playerTeamId)
          .eq('status', 'active')
        setRosterSize(count ?? null)
      }
    })
  }, [playerTeamId])

  if (!authorized) return null

  // Note: roster minimum (12) is enforced only outside the free agency window.
  // During free agency, teams are allowed to dip below 12 temporarily.
  const wouldGoBelowMin = rosterSize !== null && rosterSize - 1 < MIN_ROSTER

  const handleCut = async () => {
    setLoading(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg('Not logged in'); setLoading(false); return }

    const res = await fetch('/api/players/cut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ playerId }),
    })
    const json = await res.json()
    if (res.ok) {
      setMsg('✓ Player released to free agency')
      setTimeout(() => router.refresh(), 1000)
    } else {
      setMsg(json.error || 'Error releasing player')
    }
    setLoading(false)
  }

  return (
    <div style={{ marginTop: 16 }}>
      {!confirming ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl"
             style={{ background: '#faf8f5', border: '1px solid #d4cdc5' }}>
          <div className="text-xs" style={{ color: '#5c554e' }}>
            <i className="ti ti-scissors" style={{ marginRight: 4 }}></i>
            Release this player to free agency
          </div>
          <button onClick={() => setConfirming(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer' }}>
            ✂️ Cut / Waive{isCommissioner ? ' (Commissioner)' : ''}
          </button>
        </div>
      ) : (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: '#fef2f2', border: '1px solid #fca5a5',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
            Confirm release?
          </div>
          <div style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 10, lineHeight: 1.5 }}>
            This player will become an unrestricted free agent immediately. Their salary will remain on your cap as dead money until another team signs them.
          </div>

          {wouldGoBelowMin && (
            <div style={{
              marginBottom: 10, padding: '8px 12px', borderRadius: 6,
              background: '#fef3c7', border: '1px solid #fcd34d', fontSize: 11, color: '#b45309', fontWeight: 500,
            }}>
              ⚠️ This will bring your roster to {(rosterSize ?? 1) - 1} players, below the {MIN_ROSTER}-player minimum. This is only allowed during the free agency window — you must resolve this before the season locks the roster.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCut} disabled={loading}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: '#dc2626', color: '#fff', border: 'none',
                cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
              }}>
              {loading ? 'Releasing...' : 'Confirm Release'}
            </button>
            <button onClick={() => setConfirming(false)} disabled={loading}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: '#f0ece5', color: '#5c554e', border: '1px solid #d4cdc5',
                cursor: 'pointer',
              }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: msg.startsWith('✓') ? '#15803d' : '#dc2626' }}>
          {msg}
        </div>
      )}
    </div>
  )
}

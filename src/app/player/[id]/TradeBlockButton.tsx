'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function TradeBlockButton({ playerId, playerTeamId }: { playerId: number, playerTeamId: string | null }) {
  const [onBlock, setOnBlock] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [blockId, setBlockId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: gm } = await supabase
        .from('gm_profiles')
        .select('team_id, role')
        .eq('id', user.id)
        .single()

      // Só o GM desta equipa pode gerir o trade block
      if (gm?.team_id === playerTeamId) {
        setCanManage(true)
      } else {
        setLoading(false)
        return
      }

      // Verificar se já está no trade block
      const { data: existing } = await supabase
        .from('trade_block')
        .select('id')
        .eq('player_id', playerId)
        .eq('status', 'available')
        .single()

      if (existing) {
        setOnBlock(true)
        setBlockId(existing.id)
      }

      setLoading(false)
    }
    init()
  }, [playerId, playerTeamId])

  const toggle = async () => {
    setSaving(true)
    if (onBlock && blockId) {
      // Remover do trade block
      await supabase
        .from('trade_block')
        .update({ status: 'removed', removed_at: new Date().toISOString() })
        .eq('id', blockId)
      setOnBlock(false)
      setBlockId(null)
    } else {
      // Adicionar ao trade block
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('trade_block')
        .insert({
          player_id: playerId,
          team_id: playerTeamId,
          added_by: user?.id,
          status: 'available',
        })
        .select('id')
        .single()
      if (data) {
        setOnBlock(true)
        setBlockId(data.id)
      }
    }
    setSaving(false)
  }

  if (loading || !canManage) return null

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 transition-all"
      style={{
        background: onBlock ? '#fee2e2' : '#fef3c7',
        color: onBlock ? '#dc2626' : '#b45309',
        border: `1px solid ${onBlock ? '#fca5a5' : '#fde68a'}`,
      }}>
      {saving ? '...' : onBlock ? '❌ Remove from Trade Block' : '📋 Add to Trade Block'}
    </button>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OFF_SYSTEMS, OffSystem, nodesForSystem, isNodeUnlocked, masteredCountByLevel } from '@/lib/tactical-constants'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GM picks which unlocked, not-yet-mastered node to develop next for a
// given system. Progress only actually moves in weeks where that system is
// the team's currently active atk_style — see src/lib/tactical-resolver.ts.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
  if (!gm) return NextResponse.json({ error: 'No GM profile found' }, { status: 403 })

  const { teamId, system, nodeId } = await req.json()
  if (!teamId || !OFF_SYSTEMS.includes(system) || !nodeId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const isAuthorized = gm.role === 'commissioner' || gm.team_id === teamId
  if (!isAuthorized) return NextResponse.json({ error: 'Not authorized for this team' }, { status: 403 })

  const node = nodesForSystem(system as OffSystem).find(n => n.id === nodeId)
  if (!node) return NextResponse.json({ error: 'Unknown tech node' }, { status: 400 })

  const { data: progressRows } = await admin.from('tactical_familiarity').select('node_id,progress').eq('team_id', teamId).eq('system', system)
  const progressByNodeId: Record<string, number> = {}
  ;(progressRows || []).forEach((r: any) => { progressByNodeId[r.node_id] = r.progress })

  if ((progressByNodeId[nodeId] || 0) >= 100) return NextResponse.json({ error: 'This tech is already mastered' }, { status: 400 })
  const counts = masteredCountByLevel(progressByNodeId, system as OffSystem)
  if (!isNodeUnlocked(node, counts)) return NextResponse.json({ error: 'This tech is still locked' }, { status: 400 })

  const { error } = await admin.from('tactical_focus').upsert(
    { team_id: teamId, system, node_id: nodeId },
    { onConflict: 'team_id,system' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

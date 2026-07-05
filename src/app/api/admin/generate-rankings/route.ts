import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const validSecrets = [
    `Bearer ${process.env.CRON_SECRET}`,
    `Bearer ${process.env.ADMIN_SECRET}`,
  ]
  if (!validSecrets.includes(auth || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id,name,logo_url,wins,losses,pts_for,pts_against,conference,division')
    .not('id', 'in', '(ALL,RVS,ROO,SOP)')

  if (!teams?.length) return NextResponse.json({ error: 'No teams' })

  const { data: players } = await supabase
    .from('players')
    .select('team_id,real_ovr,usage,salary')
    .eq('status', 'active')
    .not('team_id', 'is', null)

  const { data: coaches } = await supabase
    .from('coaches')
    .select('team_id,role,offense_iq,defense_iq,player_dev')
    .not('team_id', 'is', null)

  const { data: facilities } = await supabase
    .from('practice_facilities')
    .select('team_id,grade')

  type TeamScore = {
    id: string; name: string; conference: string; division: string
    rosterScore: number; avgOvr: number; topPlayerOvr: number
    coachScore: number; facilityScore: number; total: number
    wins: number; losses: number
  }

  const GRADE_SCORE: Record<string, number> = { A: 100, B: 80, C: 60, D: 40, E: 20, F: 0 }

  const teamScores: TeamScore[] = teams.map((team: any) => {
    const roster = (players || []).filter((p: any) => p.team_id === team.id)
    const top8 = roster.sort((a: any, b: any) => b.real_ovr - a.real_ovr).slice(0, 8)
    const avgOvr = top8.length ? top8.reduce((s: number, p: any) => s + (p.real_ovr || 70), 0) / top8.length : 70
    const topPlayerOvr = top8[0]?.real_ovr || 70
    const rosterDepth = Math.min(1, roster.length / 12)
    const hc = (coaches || []).find((c: any) => c.team_id === team.id && c.role === 'head_coach')
    const coachScore = hc ? ((hc.offense_iq || 60) + (hc.defense_iq || 60)) / 2 : 60
    const fac = (facilities || []).find((f: any) => f.team_id === team.id)
    const facilityScore = fac ? (GRADE_SCORE[fac.grade] || 0) : 0
    const rosterScore = (avgOvr / 99) * 0.4 + (topPlayerOvr / 99) * 0.2 + rosterDepth * 0.1
    const total = rosterScore * 0.7 + (coachScore / 100) * 0.2 + (facilityScore / 100) * 0.1
    return {
      id: team.id, name: team.name,
      conference: team.conference, division: team.division,
      rosterScore, avgOvr: Math.round(avgOvr * 10) / 10,
      topPlayerOvr, coachScore, facilityScore, total,
      wins: team.wins || 0, losses: team.losses || 0,
    }
  })

  teamScores.sort((a, b) => b.total - a.total)

  const rankings: any[] = []

  for (let i = 0; i < teamScores.length; i += 6) {
    const batch = teamScores.slice(i, i + 6)

    const prompt = `You are a seasoned NBA journalist writing the Pre-Season Power Rankings. This is BEFORE the season starts — no games have been played yet. Write a sharp, accurate 2-sentence preview for each team based on their roster quality, coaching staff and facilities, IN BOTH ENGLISH AND EUROPEAN PORTUGUESE (Portugal, not Brazil) — two independent, natural-sounding comments conveying the same analysis, not a literal translation of each other. Be opinionated and direct. Sound like a real columnist with opinions, not a data report.

${batch.map((t, idx) => `
TEAM ${i + idx + 1}: ${t.name}
- Pre-season rank: #${i + idx + 1} of 30
- Roster avg OVR: ${t.avgOvr} | Best player OVR: ${t.topPlayerOvr}
- Head coach quality: ${t.coachScore}/100
- Practice facility: ${t.facilityScore}/100
- Conference: ${t.conference}
`).join('\n')}

Respond ONLY with a valid JSON array, no markdown, no explanation:
[{"team_id":"TEAM_ID","comment_en":"2-sentence comment in English","comment_pt":"2-sentence comment in European Portuguese"},...]

Use these exact team IDs: ${batch.map(t => t.id).join(', ')}`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const text = data.content?.[0]?.text || '[]'
      const clean = text.replace(/```json|```/g, '').trim()
      const comments: { team_id: string, comment_en: string, comment_pt: string }[] = JSON.parse(clean)

      for (let j = 0; j < batch.length; j++) {
        const team = batch[j]
        const rank = i + j + 1
        const commentData = comments.find(c => c.team_id === team.id)
        const comment = commentData?.comment_en ||
          `${team.name} enter the season with a roster averaging ${team.avgOvr} OVR and a ${team.coachScore >= 75 ? 'strong' : 'developing'} coaching staff.`
        const commentPt = commentData?.comment_pt ||
          `${team.name} entram na época com um plantel a rondar os ${team.avgOvr} OVR e um corpo técnico ${team.coachScore >= 75 ? 'forte' : 'ainda em desenvolvimento'}.`

        rankings.push({
          season: '2025-26', week_number: 0,
          team_id: team.id, rank, previous_rank: null, trend: 'new',
          comment, comment_pt: commentPt, wins: 0, losses: 0, last5: 'N/A',
          ppg: null, opp_ppg: null,
        })
      }
    } catch (err) {
      for (let j = 0; j < batch.length; j++) {
        const team = batch[j]
        rankings.push({
          season: '2025-26', week_number: 0,
          team_id: team.id, rank: i + j + 1, previous_rank: null, trend: 'new',
          comment: `${team.name} enter the season with a roster averaging ${team.avgOvr} OVR and a ${team.coachScore >= 75 ? 'strong' : 'developing'} coaching staff.`,
          comment_pt: `${team.name} entram na época com um plantel a rondar os ${team.avgOvr} OVR e um corpo técnico ${team.coachScore >= 75 ? 'forte' : 'ainda em desenvolvimento'}.`,
          wins: 0, losses: 0, last5: 'N/A', ppg: null, opp_ppg: null,
        })
      }
    }
  }

  await supabase.from('power_rankings')
    .upsert(rankings, { onConflict: 'season,week_number,team_id' })

  return NextResponse.json({ success: true, generated: rankings.length })
}

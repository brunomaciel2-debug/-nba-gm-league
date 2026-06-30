import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CAP_LIMIT = 180_000_000
const MIN_ROSTER = 12
const MAX_ROSTER = 15

function fmt(n: number) {
  return '$' + (n / 1_000_000).toFixed(1) + 'M'
}

export default async function CapSpacePage() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id,name,logo_url,color,conference,division')
    .not('id', 'in', '(ALL,RVS,ROO,SOP)')

  const { data: players } = await supabase
    .from('players')
    .select('team_id,salary')
    .eq('status', 'active')
    .not('team_id', 'is', null)

  const teamData = (teams || []).map((t: any) => {
    const teamPlayers = (players || []).filter((p: any) => p.team_id === t.id)
    const capUsed = teamPlayers.reduce((s: number, p: any) => s + (p.salary || 0), 0)
    const rosterSize = teamPlayers.length
    const capSpace = CAP_LIMIT - capUsed
    return { ...t, capUsed, rosterSize, capSpace }
  }).sort((a, b) => b.capSpace - a.capSpace)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1512', margin: 0 }}>💰 Cap Space</h1>
        <p style={{ fontSize: 13, color: '#8a8279', marginTop: 4 }}>
          League salary cap: {fmt(CAP_LIMIT)} · Roster: {MIN_ROSTER}–{MAX_ROSTER} players
        </p>
      </div>

      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #d4cdc5' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 110px 110px 110px 90px',
          gap: 8, padding: '10px 16px', background: '#f0ece5',
          borderBottom: '2px solid #d4cdc5', fontSize: 11, fontWeight: 700,
          color: '#5c554e', textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          <span></span>
          <span>Team</span>
          <span style={{ textAlign: 'right' }}>Cap Used</span>
          <span style={{ textAlign: 'right' }}>Cap Space</span>
          <span style={{ textAlign: 'right' }}>% Used</span>
          <span style={{ textAlign: 'center' }}>Roster</span>
        </div>

        {teamData.map((t: any, idx: number) => {
          const tc = readableTeamColor(t.color)
          const pctUsed = (t.capUsed / CAP_LIMIT) * 100
          const rosterColor = t.rosterSize < MIN_ROSTER ? '#dc2626' : t.rosterSize >= MAX_ROSTER ? '#b45309' : '#15803d'
          const spaceColor = t.capSpace < 0 ? '#dc2626' : t.capSpace < 5_000_000 ? '#b45309' : '#15803d'

          return (
            <Link key={t.id} href={`/team/${t.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 110px 110px 110px 90px',
                gap: 8, alignItems: 'center', padding: '10px 16px',
                background: idx % 2 === 0 ? '#faf8f5' : '#f5f1eb',
                borderBottom: '1px solid #e2dcd5',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, overflow: 'hidden',
                  background: '#f0ece5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {t.logo_url
                    ? <img src={t.logo_url} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                    : <span style={{ fontSize: 8, fontWeight: 700, color: '#8a8279' }}>{t.id}</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1512' }}>{t.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#5c554e', textAlign: 'right' }}>{fmt(t.capUsed)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: spaceColor, textAlign: 'right' }}>
                  {t.capSpace < 0 ? '−' : ''}{fmt(Math.abs(t.capSpace))}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 36, height: 6, borderRadius: 3, background: '#e2dcd5', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.min(100, pctUsed)}%`,
                        background: pctUsed > 97 ? '#dc2626' : pctUsed > 90 ? '#b45309' : '#15803d',
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#8a8279' }}>{pctUsed.toFixed(0)}%</span>
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: rosterColor, textAlign: 'center' }}>
                  {t.rosterSize}/{MAX_ROSTER}
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      <p style={{ marginTop: 14, fontSize: 11, color: '#b0a898', textAlign: 'center' }}>
        Roster shown in red is below the {MIN_ROSTER}-player minimum · must be resolved by end of free agency
      </p>
    </div>
  )
}

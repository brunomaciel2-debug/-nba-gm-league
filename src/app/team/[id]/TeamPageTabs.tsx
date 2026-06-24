'use client'
import { useState, useEffect } from 'react'
import RosterTable from './RosterTable'
import TeamSchedule from './TeamSchedule'
import ContractsTable from './ContractsTable'
import CoachingStaff from './CoachingStaff'
import InjuryReport from './InjuryReport'
import DraftPicksTable from './DraftPicksTable'

type Tab = 'roster' | 'schedule' | 'contracts' | 'draft' | 'training' | 'facilities' | 'sponsors'

export default function TeamPageTabs({
  players, games, teamId, teamsMap, teamColor, coaches, injuries
}: {
  players: any[], games: any[], teamId: string, teamsMap: any, teamColor: string,
  coaches: any[], injuries: any[]
}) {
  const [tab, setTab] = useState<Tab>('roster')

  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as Tab
    if (['roster', 'schedule', 'contracts', 'draft', 'training', 'facilities', 'sponsors'].includes(hash)) {
      setTab(hash as Tab)
    }
  }, [])

  const played   = games.filter((g:any) => g.status === 'final').length
  const upcoming = games.filter((g:any) => g.status !== 'final').length

  const TABS: { key: Tab, label: string, badge: string }[] = [
    { key: 'roster',     label: 'Roster',      badge: `${players.length} players` },
    { key: 'schedule',   label: 'Schedule',    badge: `${played} played · ${upcoming} remaining` },
    { key: 'contracts',  label: 'Contracts',   badge: 'Multi-year view' },
    { key: 'draft',      label: 'Draft Picks', badge: '5 seasons' },
    { key: 'training',   label: 'Training',    badge: 'Coming soon' },
    { key: 'facilities', label: 'Facilities',  badge: 'Coming soon' },
    { key: 'sponsors',   label: 'Sponsors',    badge: 'Coming soon' },
  ]

  const ComingSoon = ({ label }: { label: string }) => (
    <div className="rounded-2xl p-16 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
      <div className="text-5xl mb-4">
        {label === 'Training' ? '🏋️' : label === 'Facilities' ? '🏟️' : '💰'}
      </div>
      <h3 className="text-lg font-black mb-2" style={{color:'#1a1512'}}>{label}</h3>
      <p className="text-sm" style={{color:'#8a8279'}}>This feature is coming soon.</p>
    </div>
  )

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: tab === t.key ? 600 : 500,
              background: tab === t.key ? '#1a1512' : '#faf8f5',
              color: tab === t.key ? '#faf8f5' : '#3d3731',
              border: '1px solid ' + (tab === t.key ? '#1a1512' : '#d4cdc5'),
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {t.label}
            <span style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              background: tab === t.key ? '#3d3731' : '#e8e2d8',
              color: tab === t.key ? '#d4cdc5' : '#5c554e',
            }}>
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'roster' && (
        <>
          <RosterTable players={players} teamColor={teamColor} />
          <div className="mt-6 rounded-xl p-4" style={{background:'#e8e2d6',border:'1px solid #d4cdc5'}}>
            <CoachingStaff staff={coaches} />
          </div>
          <div className="mt-4 rounded-xl p-4" style={{background:'#e8e2d6',border:'1px solid #d4cdc5'}}>
            <InjuryReport injuries={injuries} players={players} />
          </div>
        </>
      )}
      {tab === 'schedule'   && <TeamSchedule games={games} teamId={teamId} teams={teamsMap} />}
      {tab === 'contracts'  && <ContractsTable teamId={teamId} teamColor={teamColor} />}
      {tab === 'draft'      && <DraftPicksTable teamId={teamId} />}
      {tab === 'training'   && <ComingSoon label="Training" />}
      {tab === 'facilities' && <ComingSoon label="Facilities" />}
      {tab === 'sponsors'   && <ComingSoon label="Sponsors" />}
    </div>
  )
}

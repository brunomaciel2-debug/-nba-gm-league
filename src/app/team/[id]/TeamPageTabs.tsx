'use client'
import { useState } from 'react'
import RosterTable from './RosterTable'
import TeamSchedule from './TeamSchedule'
import ContractsTable from './ContractsTable'

type Tab = 'roster' | 'schedule' | 'contracts'

export default function TeamPageTabs({
  players, games, teamId, teamsMap, teamColor
}: {
  players: any[], games: any[], teamId: string, teamsMap: any, teamColor: string
}) {
  const [tab, setTab] = useState<Tab>('roster')
  const played   = games.filter((g:any) => g.status === 'final').length
  const upcoming = games.filter((g:any) => g.status !== 'final').length

  const TABS = [
    { key: 'roster',    label: 'Roster',    icon: 'ti-users',          badge: players.length + ' players' },
    { key: 'schedule',  label: 'Schedule',  icon: 'ti-calendar',       badge: `${played} played · ${upcoming} remaining` },
    { key: 'contracts', label: 'Contracts', icon: 'ti-receipt',        badge: 'Multi-year view' },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-2 mb-5 flex-wrap" style={{overflowVisible:'visible'}}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: tab === t.key ? '#2d2722' : '#ede8df',
              color: tab === t.key ? '#1a1512' : '#5c554e',
              border: '1px solid ' + (tab === t.key ? '#2d2722' : '#d4cdc5'),
              borderBottom: tab === t.key ? '2px solid #b45309' : '2px solid transparent'
            }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 15 }} aria-hidden="true"></i>
            {t.label}
            <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: tab === t.key ? '#2d2722' : '#d4cdc5', color: tab === t.key ? '#8a8279' : '#8a8279' }}>
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {tab === 'roster' && (
        <div>
          <RosterTable players={players} teamColor={teamColor} />
        </div>
      )}
      {tab === 'schedule' && (
        <div>
          <TeamSchedule games={games} teamId={teamId} teams={teamsMap} />
        </div>
      )}
      {tab === 'contracts' && (
        <ContractsTable teamId={teamId} teamColor={teamColor} />
      )}
    </div>
  )
}

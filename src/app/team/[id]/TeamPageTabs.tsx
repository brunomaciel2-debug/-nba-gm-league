'use client'
import { useState, useEffect } from 'react'
import RosterTable from './RosterTable'
import TeamSchedule from './TeamSchedule'
import ContractsTable from './ContractsTable'
import CoachingStaff from './CoachingStaff'
import InjuryReport from './InjuryReport'
import DraftPicksTable from './DraftPicksTable'
import ArenaView from './ArenaView'
import TrainingTab from './TrainingTab'
import FacilitiesTab from './FacilitiesTab'
import FinancesTab from './FinancesTab'
import SponsorsTab from './SponsorsTab'
import GoalsTab from './GoalsTab'
import ScoutingTab from './ScoutingTab'
import { useTranslation } from '@/components/I18nProvider'

type Tab = 'roster' | 'schedule' | 'contracts' | 'draft' | 'training' | 'facilities' | 'finances' | 'sponsors' | 'goals' | 'scouting'

function ComingSoon({ label, icon, isPT }: { label: string, icon: string, isPT: boolean }) {
  return (
    <div className="rounded-2xl p-16 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-black mb-2" style={{color:'#1a1512'}}>{label}</h3>
      <p className="text-sm" style={{color:'#8a8279'}}>{isPT ? 'Esta funcionalidade estará disponível em breve.' : 'This feature is coming soon.'}</p>
    </div>
  )
}

export default function TeamPageTabs({
  players, games, teamId, teamsMap, teamColor, coaches, injuries, arenaName, arenaCapacity
}: {
  players: any[], games: any[], teamId: string, teamsMap: any, teamColor: string,
  coaches: any[], injuries: any[], arenaName?: string, arenaCapacity?: number
}) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [tab, setTab] = useState<Tab>('roster')

  const TABS: { key: Tab, label: string, icon: string }[] = [
    { key: 'roster',     label: isPT ? 'Plantel'         : 'Roster',      icon: '👥' },
    { key: 'schedule',   label: isPT ? 'Calendário'      : 'Schedule',    icon: '📅' },
    { key: 'contracts',  label: isPT ? 'Contratos'       : 'Contracts',   icon: '📄' },
    { key: 'draft',      label: isPT ? 'Escolhas Draft'  : 'Draft Picks', icon: '🎓' },
    { key: 'scouting',   label: 'Scouting',                               icon: '🔍' },
    { key: 'training',   label: isPT ? 'Treino'          : 'Training',    icon: '🏋️' },
    { key: 'facilities', label: isPT ? 'Instalações'     : 'Facilities',  icon: '🏟️' },
    { key: 'finances',   label: isPT ? 'Finanças'        : 'Finances',    icon: '💵' },
    { key: 'sponsors',   label: isPT ? 'Patrocinadores'  : 'Sponsors',    icon: '💰' },
    { key: 'goals',      label: isPT ? 'Objetivos'       : 'Goals',       icon: '🎯' },
  ]

  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as Tab
    if (TABS.map(t => t.key).includes(hash as Tab)) setTab(hash as Tab)
  }, [])

  const played   = games.filter((g:any) => g.status === 'final').length
  const upcoming = games.filter((g:any) => g.status !== 'final').length

  const badges: Partial<Record<Tab, string>> = {
    roster:    `${players.length}`,
    schedule:  `${played}/${played + upcoming}`,
    contracts: isPT ? 'Multi-ano' : 'Multi-yr',
    draft:     '5 yrs',
  }

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* SIDEBAR */}
      <div style={{
        width: 180, flexShrink: 0, background: '#faf8f5',
        border: '1px solid #d4cdc5', borderRadius: 14, padding: '8px 0',
        position: 'sticky', top: 80,
      }}>
        {TABS.map((t, i) => {
          const active = tab === t.key
          const showDivider = i === 4
          return (
            <div key={t.key}>
              {showDivider && <div style={{height:1,background:'#e2dcd5',margin:'6px 12px'}}/>}
              <button type="button" onClick={() => setTab(t.key)}
                style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%',
                  padding:'9px 14px', fontSize:13,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#1a1512' : '#3d3731',
                  background: active ? teamColor + '18' : 'transparent',
                  borderLeft: `3px solid ${active ? teamColor : 'transparent'}`,
                  border:'none', borderLeftStyle:'solid', borderLeftWidth:3,
                  borderLeftColor: active ? teamColor : 'transparent',
                  cursor:'pointer', textAlign:'left', transition:'all 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f0ece5' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <span style={{fontSize:15,flexShrink:0}}>{t.icon}</span>
                <span style={{flex:1}}>{t.label}</span>
                {badges[t.key] && (
                  <span style={{fontSize:10,padding:'1px 5px',borderRadius:4,flexShrink:0,
                    background: active ? teamColor+'33' : '#e8e2d8',
                    color: active ? teamColor : '#8a8279', fontWeight:600}}>
                    {badges[t.key]}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* CONTENT */}
      <div style={{flex:1, minWidth:0}}>
        {tab === 'roster' && (
          <>
            <RosterTable players={players} teamColor={teamColor} />
            <div className="mt-6 rounded-xl p-4" style={{background:'#e8e2d6',border:'1px solid #d4cdc5'}}>
              <CoachingStaff staff={coaches} />
            </div>
            <div className="mt-4 rounded-xl p-4" style={{background:'#e8e2d6',border:'1px solid #d4cdc5'}}>
              <InjuryReport injuries={injuries} players={players} teamId={teamId} />
            </div>
          </>
        )}
        {tab === 'schedule'   && <TeamSchedule games={games} teamId={teamId} teams={teamsMap} />}
        {tab === 'contracts'  && <ContractsTable teamId={teamId} teamColor={teamColor} />}
        {tab === 'draft'      && <DraftPicksTable teamId={teamId} />}
        {tab === 'training'   && <TrainingTab teamId={teamId} teamColor={teamColor} players={players} />}
        {tab === 'facilities' && <FacilitiesTab teamId={teamId} teamColor={teamColor} arenaName={arenaName} arenaCapacity={arenaCapacity} />}
        {tab === 'finances'   && <FinancesTab teamId={teamId} teamColor={teamColor} />}
        {tab === 'scouting'   && <ScoutingTab teamId={teamId} teamColor={teamColor}/>}
        {tab === 'goals'      && <GoalsTab teamId={teamId} teamColor={teamColor}/>}
        {tab === 'sponsors'   && <SponsorsTab teamId={teamId} teamColor={teamColor}/>}
      </div>
    </div>
  )
}

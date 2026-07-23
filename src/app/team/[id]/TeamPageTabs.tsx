'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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
import MerchandisingTab from './MerchandisingTab'
import TacticalSystemsTab from './TacticalSystemsTab'
import SponsorsTab from './SponsorsTab'
import GoalsTab from './GoalsTab'
import ScoutingTab from './ScoutingTab'
import PlayerInteractions from './PlayerInteractions'
import SocialMediaTab from './SocialMediaTab'
import SatisfactionTab from './SatisfactionTab'
import TransactionsTab from './TransactionsTab'
import PsychologyOfficeTab from './PsychologyOfficeTab'
import { useTranslation } from '@/components/I18nProvider'

type Tab = 'roster' | 'staff' | 'injuries' | 'schedule' | 'contracts' | 'draft' | 'transactions' | 'training' | 'facilities' | 'finances' | 'merchandising' | 'tactical' | 'sponsors' | 'goals' | 'satisfaction' | 'scouting' | 'interactions' | 'social_media' | 'psychology'

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
  players, injuredPlayers, games, teamId, teamsMap, teamColor, coaches, injuries, arenaName, arenaCapacity, socialMediaFollowers
}: {
  players: any[], injuredPlayers?: any[], games: any[], teamId: string, teamsMap: any, teamColor: string,
  coaches: any[], injuries: any[], arenaName?: string, arenaCapacity?: number, socialMediaFollowers?: number
}) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const searchParams = useSearchParams()
  const VALID_TABS: Tab[] = ['roster','staff','injuries','schedule','contracts','draft','transactions','training','facilities','finances','merchandising','tactical','sponsors','goals','satisfaction','scouting','interactions','social_media','psychology']
  const initialTab = (VALID_TABS as string[]).includes(searchParams.get('tab') || '') ? (searchParams.get('tab') as Tab) : 'roster'
  const [tab, setTab] = useState<Tab>(initialTab)

  // Split into two groups: pages the GM merely consults (Informação) vs
  // pages where the GM makes decisions/takes action (Gestão). Requested by
  // Bruno since the flat 17-item list had become hard to scan.
  const TABS: { key: Tab, label: string, icon: string, group: 'info' | 'action' }[] = [
    { key: 'roster',     label: isPT ? 'Plantel'         : 'Roster',      icon: '👥', group: 'info' },
    { key: 'staff',      label: isPT ? 'Equipa Técnica'  : 'Staff',       icon: '🧑‍💼', group: 'info' },
    { key: 'injuries',   label: isPT ? 'Lesões'          : 'Injuries',    icon: '🏥', group: 'info' },
    { key: 'schedule',   label: isPT ? 'Calendário'      : 'Schedule',    icon: '📅', group: 'info' },
    { key: 'contracts',  label: isPT ? 'Contratos'       : 'Contracts',   icon: '📄', group: 'info' },
    { key: 'draft',      label: isPT ? 'Escolhas Draft'  : 'Draft Picks', icon: '🎓', group: 'info' },
    { key: 'transactions', label: isPT ? 'Transferências' : 'Transactions', icon: '🔄', group: 'info' },
    { key: 'finances',   label: isPT ? 'Finanças'        : 'Finances',    icon: '💵', group: 'info' },
    { key: 'goals',      label: isPT ? 'Objetivos'       : 'Goals',       icon: '🎯', group: 'info' },
    { key: 'satisfaction', label: isPT ? 'Satisfação'    : 'Satisfaction', icon: '📋', group: 'info' },
    { key: 'scouting',   label: 'Scouting',                               icon: '🔍', group: 'action' },
    { key: 'training',   label: isPT ? 'Treino'          : 'Training',    icon: '🏋️', group: 'action' },
    { key: 'psychology', label: isPT ? 'Gabinete de Psicologia' : 'Psychology Office', icon: '🧠', group: 'action' },
    { key: 'facilities', label: isPT ? 'Instalações'     : 'Facilities',  icon: '🏟️', group: 'action' },
    { key: 'tactical',   label: isPT ? 'Sistemas'       : 'Systems',       icon: '🔥', group: 'action' },
    { key: 'sponsors',   label: isPT ? 'Patrocinadores'  : 'Sponsors',    icon: '💰', group: 'action' },
    { key: 'interactions', label: isPT ? 'Interações'    : 'Interactions', icon: '💬', group: 'action' },
    { key: 'social_media', label: isPT ? 'Social Media'  : 'Social Media', icon: '📱', group: 'action' },
    { key: 'merchandising', label: isPT ? 'Merchandising' : 'Merchandising', icon: '👕', group: 'action' },
  ]

  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as Tab
    if (TABS.map(t => t.key).includes(hash as Tab)) setTab(hash as Tab)
  }, [])

  const played   = games.filter((g:any) => g.status === 'final').length
  const upcoming = games.filter((g:any) => g.status !== 'final').length

  const activeInjuryCount = injuries.filter((i:any) => i.status === 'active').length

  // Red "action needed" dots — computed here (not inside each tab) because
  // only the currently-selected tab is ever mounted below, so a tab's own
  // component can't report its pending state while the GM is looking at a
  // different tab.
  const [alerts, setAlerts] = useState<Partial<Record<Tab, boolean>>>({})
  useEffect(() => {
    (async () => {
      const [
        { data: pool }, { data: contracts },
        { data: cfg },
        { data: interactions },
        { data: scoutProgress },
        { data: trainingSlots },
        { data: psychSlots },
      ] = await Promise.all([
        supabase.from('sponsor_pool').select('tier,chosen').eq('team_id', teamId).eq('season', '2025-26'),
        supabase.from('sponsor_contracts').select('tier').eq('team_id', teamId).eq('season', '2025-26').eq('status', 'active'),
        supabase.from('season_config').select('current_week').eq('id', 1).single(),
        supabase.from('player_interactions').select('id').eq('team_id', teamId).neq('status', 'resolved'),
        supabase.from('scout_progress').select('points,lifetime_points').eq('team_id', teamId).eq('season', '2025-26').maybeSingle(),
        supabase.from('training_slots').select('player_id').eq('team_id', teamId),
        supabase.from('psychology_slots').select('player_id').eq('team_id', teamId),
      ])

      const activeTiers = new Set((contracts || []).map((c: any) => c.tier))
      const sponsorsPending = ['jersey', 'court', 'panels'].some(tier =>
        !activeTiers.has(tier) && (pool || []).some((p: any) => p.tier === tier && !p.chosen))

      const week = (cfg as any)?.current_week || 0
      const { data: order } = await supabase.from('gm_orders').select('atk_style').eq('team_id', teamId).eq('week_number', week).maybeSingle()
      const activeSystem = (order as any)?.atk_style || 'motion'
      const { data: focusRows } = await supabase.from('tactical_focus').select('system,node_id').eq('team_id', teamId)
      const tacticalPending = !(focusRows || []).some((f: any) => f.system === activeSystem)

      const scoutingPending = (scoutProgress?.lifetime_points || 0) >= 100 && (scoutProgress?.points || 0) >= 10

      const trainingPending = !trainingSlots || trainingSlots.length === 0 || trainingSlots.some((s: any) => !s.player_id)
      const psychologyPending = (psychSlots || []).filter((s: any) => s.player_id).length < 3

      setAlerts({
        sponsors: sponsorsPending,
        tactical: tacticalPending,
        interactions: (interactions || []).length > 0,
        scouting: scoutingPending,
        training: trainingPending,
        psychology: psychologyPending,
      })
    })()
  }, [teamId])

  const badges: Partial<Record<Tab, string>> = {
    roster:    `${players.length}`,
    schedule:  `${played}/${played + upcoming}`,
    contracts: isPT ? 'Multi-ano' : 'Multi-yr',
    draft:     '5 yrs',
    ...(activeInjuryCount > 0 ? { injuries: `${activeInjuryCount}` } : {}),
  }

  return (
    <div className="flex flex-col md:flex-row" style={{ gap: 16 }}>
      {/* MOBILE TAB STRIP — the desktop sidebar below is a fixed 180px
          column that, with no menu of its own, was squeezing the entire
          content area down to under 150px wide on phone-size screens
          (confirmed while testing: content area measured 139px at a 568px
          viewport). Below md, this horizontally-scrollable pill row
          replaces it entirely so content gets the full screen width. */}
      <div className="flex md:hidden overflow-x-auto gap-1.5 pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 flex-shrink-0"
              style={{
                padding: '7px 12px', fontSize: 12, fontWeight: active ? 700 : 500,
                borderRadius: 20, whiteSpace: 'nowrap',
                background: active ? teamColor + '18' : '#faf8f5',
                color: active ? teamColor : '#5c554e',
                border: `1px solid ${active ? teamColor + '55' : '#d4cdc5'}`,
              }}>
              <span style={{fontSize:14}}>{t.icon}</span>
              {t.label}
              {alerts[t.key] && (
                <span title={isPT ? 'Ação pendente' : 'Action needed'}
                  style={{width:13,height:13,borderRadius:'50%',flexShrink:0,
                    background:'#dc2626', color:'#fff', fontSize:9, fontWeight:800,
                    display:'inline-flex', alignItems:'center', justifyContent:'center'}}>!</span>
              )}
              {badges[t.key] && (
                <span style={{fontSize:9,padding:'1px 4px',borderRadius:4,
                  background: active ? teamColor+'33' : '#e8e2d8',
                  color: active ? teamColor : '#8a8279', fontWeight:600}}>
                  {badges[t.key]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* DESKTOP SIDEBAR */}
      <div className="hidden md:block" style={{
        width: 180, flexShrink: 0, background: '#faf8f5',
        border: '1px solid #d4cdc5', borderRadius: 14, padding: '8px 0',
        position: 'sticky', top: 80,
      }}>
        {TABS.map((t, i) => {
          const active = tab === t.key
          const showGroupLabel = i === 0 || t.group !== TABS[i - 1].group
          const groupLabel = t.group === 'info' ? (isPT ? 'Informação' : 'Information') : (isPT ? 'Gestão' : 'Management')
          return (
            <div key={t.key}>
              {showGroupLabel && i !== 0 && <div style={{height:1,background:'#e2dcd5',margin:'8px 12px'}}/>}
              {showGroupLabel && (
                <div style={{
                  margin: i === 0 ? '2px 14px 6px' : '2px 14px 6px',
                  fontSize: 10, fontWeight: 700, letterSpacing: '1px',
                  textTransform: 'uppercase', color: '#a39a8d',
                }}>{groupLabel}</div>
              )}
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
                {alerts[t.key] && (
                  <span title={isPT ? 'Ação pendente' : 'Action needed'}
                    style={{width:14,height:14,borderRadius:'50%',flexShrink:0,
                      background:'#dc2626', color:'#fff', fontSize:9, fontWeight:800,
                      display:'inline-flex', alignItems:'center', justifyContent:'center'}}>!</span>
                )}
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
        {tab === 'roster' && <RosterTable players={[...players, ...(injuredPlayers||[])]} teamColor={teamColor} />}
        {tab === 'staff' && (
          <div className="rounded-xl p-4" style={{background:'#e8e2d6',border:'1px solid #d4cdc5'}}>
            <CoachingStaff staff={coaches} socialMediaFollowers={socialMediaFollowers} />
          </div>
        )}
        {tab === 'injuries' && <InjuryReport injuries={injuries} players={[...players, ...(injuredPlayers||[])]} teamId={teamId} />}
        {tab === 'schedule'   && <TeamSchedule games={games} teamId={teamId} teams={teamsMap} />}
        {tab === 'contracts'  && <ContractsTable teamId={teamId} teamColor={teamColor} />}
        {tab === 'draft'      && <DraftPicksTable teamId={teamId} />}
        {tab === 'transactions' && <TransactionsTab teamId={teamId} teamColor={teamColor} />}
        {tab === 'training'   && <TrainingTab teamId={teamId} teamColor={teamColor} players={players} />}
        {tab === 'psychology' && <PsychologyOfficeTab teamId={teamId} teamColor={teamColor} players={players} coaches={coaches} />}
        {tab === 'facilities' && <FacilitiesTab teamId={teamId} teamColor={teamColor} arenaName={arenaName} arenaCapacity={arenaCapacity} />}
        {tab === 'finances'   && <FinancesTab teamId={teamId} teamColor={teamColor} />}
        {tab === 'merchandising' && <MerchandisingTab teamId={teamId} teamColor={teamColor} players={players} />}
        {tab === 'tactical'   && <TacticalSystemsTab teamId={teamId} teamColor={teamColor} />}
        {tab === 'scouting'   && <ScoutingTab teamId={teamId} teamColor={teamColor}/>}
        {tab === 'goals'      && <GoalsTab teamId={teamId} teamColor={teamColor}/>}
        {tab === 'satisfaction' && <SatisfactionTab teamId={teamId} teamColor={teamColor}/>}
        {tab === 'sponsors'   && <SponsorsTab teamId={teamId} teamColor={teamColor}/>}
        {tab === 'interactions' && <PlayerInteractions teamId={teamId} teamColor={teamColor}/>}
        {tab === 'social_media' && <SocialMediaTab teamId={teamId} teamColor={teamColor} coaches={coaches} socialMediaFollowers={socialMediaFollowers}/>}
      </div>
    </div>
  )
}

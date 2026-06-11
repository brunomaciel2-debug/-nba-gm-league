'use client'
import { useState } from 'react'
import RosterTable from './RosterTable'
import TeamSchedule from './TeamSchedule'

type Tab = 'roster' | 'schedule'

export default function TeamPageTabs({
  players, games, teamId, teamColor, teamsMap
}: {
  players: any[], games: any[], teamId: string, teamColor: string, teamsMap: Record<string,any>
}) {
  const [tab, setTab] = useState<Tab>('roster')

  const played   = games.filter(g=>g.status==='final').length
  const upcoming = games.filter(g=>g.status==='scheduled').length

  return (
    <div>
      {/* Tab headers */}
      <div className="flex gap-2 mb-4">
        {([
          {key:'roster',   label:'📋 Roster',   badge: players.length+' players'},
          {key:'schedule', label:'📅 Schedule',  badge: `${played} played · ${upcoming} remaining`},
        ] as {key:Tab,label:string,badge:string}[]).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{background:tab===t.key?'#3a3228':'#241f18',
                    color:tab===t.key?'#f0ebe0':'#8a7a6a',
                    border:'1px solid '+(tab===t.key?'#5a4a3a':'#3a3228')}}>
            {t.label}
            <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{background:'#241f18',color:'#6a5a4a',fontSize:10}}>
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab==='roster' && (
        <div className="rounded-xl p-4" style={{background:'#241f18',border:'1px solid #3a3228'}}>
          <RosterTable players={players} teamColor={teamColor} />
        </div>
      )}
      {tab==='schedule' && (
        <div className="rounded-xl p-4" style={{background:'#241f18',border:'1px solid #3a3228'}}>
          <TeamSchedule games={games} teamId={teamId} teams={teamsMap} />
        </div>
      )}
    </div>
  )
}

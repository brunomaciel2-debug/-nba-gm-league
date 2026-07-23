'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

// 2026 is deliberately excluded — Season 1 has no real draft of its own
// (draft_config.next_draft_season is fixed at 2027, so the game skips
// straight there), and every 2026 draft_picks row has been voided
// (status='void') by ANULAR_DRAFT_PICKS_2026.sql. Showing an inert asset
// here would just recreate the original "trade did nothing" confusion —
// this time it would even be technically true, since it can never resolve.
const SEASONS = ['2027','2028','2029','2030','2031']
const SEASON_LABEL: Record<string,string> = { '2027':'2026-27','2028':'2027-28','2029':'2028-29','2030':'2029-30','2031':'2030-31' }
const ROUND_COLOR: Record<number,{color:string,bg:string}> = {
  1:{color:'#b45309',bg:'#fef3c7'}, 2:{color:'#1d4ed8',bg:'#dbeafe'},
}

export default function DraftPicksTable({ teamId }: { teamId: string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [picks, setPicks] = useState<any[]>([])
  const [teams, setTeams] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(true)

  const fetchPicks = async () => {
    const { data } = await supabase.from('draft_picks').select('*').eq('team_id',teamId).eq('status','owned').in('season',SEASONS).order('season').order('round')
    setPicks(data||[])
  }

  useEffect(() => {
    Promise.all([
      supabase.from('draft_picks').select('*').eq('team_id',teamId).eq('status','owned').in('season',SEASONS).order('season').order('round'),
      supabase.from('teams').select('id,name,logo_url,color').not('id','in','(ALL,RVS,ROO,SOP)'),
    ]).then(([{data:picksData},{data:teamsData}]) => {
      setPicks(picksData||[])
      const map: Record<string,any> = {}
      for (const t of (teamsData||[])) map[t.id]=t
      setTeams(map); setLoading(false)
    })
    const sub = supabase.channel(`draft_picks:${teamId}`).on('postgres_changes',{event:'*',schema:'public',table:'draft_picks'},()=>fetchPicks()).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [teamId])

  if (loading) return <div className="p-6 text-center" style={{color:'#8a8279'}}>{t('common.loading')}</div>

  const bySeason: Record<string,any[]> = {}
  for (const s of SEASONS) bySeason[s]=[]
  for (const pick of picks) { if (bySeason[pick.season]) bySeason[pick.season].push(pick) }
  const isOwn = (pick:any) => pick.original_team_id === teamId

  return (
    <div className="flex flex-col gap-6">
      {SEASONS.map(season => {
        const seasonPicks = bySeason[season]
        const label = SEASON_LABEL[season]||season
        return (
          <div key={season}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-black" style={{color:'#1a1512'}}>{label} {isPT?'Draft':'Draft'}</h3>
              <div className="flex-1 h-px" style={{background:'#d4cdc5'}}/>
              <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{background:'#e8e2d6',color:'#6b5f4e'}}>
                {seasonPicks.length} {isPT ? `escolha${seasonPicks.length!==1?'s':''}` : `pick${seasonPicks.length!==1?'s':''}`}
              </span>
            </div>
            {seasonPicks.length === 0 ? (
              <div className="px-4 py-3 rounded-xl text-xs" style={{background:'#faf8f5',border:'1px solid #e2dcd5',color:'#b0a89e'}}>
                {isPT ? 'Sem escolhas esta época' : 'No picks this season'}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {seasonPicks.sort((a,b)=>a.round-b.round).map(pick => {
                  const origTeam = teams[pick.original_team_id]
                  const isOwnPick = isOwn(pick)
                  const roundStyle = ROUND_COLOR[pick.round]||{color:'#5c554e',bg:'#f0ece5'}
                  return (
                    <div key={pick.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                         style={{background:'#faf8f5',border:`1px solid ${isOwnPick?'#d4cdc5':'#f0a50055'}`,borderLeft:`4px solid ${isOwnPick?roundStyle.color:'#f0a500'}`}}>
                      <div className="flex flex-col items-center justify-center rounded-lg px-3 py-1.5 flex-shrink-0"
                           style={{background:roundStyle.bg,border:`1px solid ${roundStyle.color}44`}}>
                        <span className="text-xs font-black" style={{color:roundStyle.color}}>R{pick.round}</span>
                        <span style={{color:roundStyle.color,fontSize:8,fontWeight:700}}>{pick.round===1?'1ª':'2ª'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm" style={{color:'#1a1512'}}>
                            {pick.round===1 ? (isPT?'Escolha 1ª Ronda':'1st Round Pick') : (isPT?'Escolha 2ª Ronda':'2nd Round Pick')}
                          </span>
                          {!isOwnPick&&origTeam&&(
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:'#fef3c7',color:'#b45309'}}>
                              via <Link href={`/team/${pick.original_team_id}`} className="no-underline" style={{color:'inherit'}}>{origTeam.name}</Link>
                            </span>
                          )}
                          {isOwnPick&&(
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'#f0ece5',color:'#8a8279'}}>
                              {isPT?'Própria':'Own pick'}
                            </span>
                          )}
                        </div>
                        {pick.protection&&pick.protection!=='unprotected'&&(
                          <div className="text-xs mt-0.5" style={{color:'#dc2626'}}>🛡 {isPT?'Protegida':'Protected'}: {pick.protection}</div>
                        )}
                        {!isOwnPick&&origTeam&&(
                          <div className="text-xs mt-0.5" style={{color:'#6b5f4e'}}>
                            {isPT ? <>Qualidade determinada pela classificação final dos <Link href={`/team/${pick.original_team_id}`} className="hover:underline" style={{color:'inherit'}}>{origTeam.name}</Link></>
                                  : <>Quality determined by <Link href={`/team/${pick.original_team_id}`} className="hover:underline" style={{color:'inherit'}}>{origTeam.name}</Link>'s final standing</>}
                          </div>
                        )}
                      </div>
                      {origTeam?.logo_url&&(
                        <div className="flex-shrink-0" style={{opacity:isOwnPick?0.4:1}}>
                          <img src={origTeam.logo_url} alt="" className="w-10 h-10 object-contain"/>
                        </div>
                      )}
                      <span className="text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0"
                            style={{background:pick.status==='owned'?'#dcfce7':'#fee2e2',color:pick.status==='owned'?'#15803d':'#dc2626'}}>
                        {pick.status==='owned' ? (isPT?'Detida':'Owned') : pick.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

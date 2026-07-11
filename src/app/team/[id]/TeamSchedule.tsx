'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'
import GamePreviewModal from '@/components/GamePreviewModal'
import { getMarqueeInfoForDate, getMarqueeLabelText } from '@/lib/marquee-dates'

const MARQUEE_ICON: Record<string, string> = {
  'Christmas Day': '🎄', 'Thanksgiving': '🦃', 'MLK Day': '✊🏾',
  "Presidents' Day": '🎩', 'NBA Cup Championship': '🏆', 'Opening Night': '🎬',
}
type Filter = 'all' | 'home' | 'away' | 'played' | 'upcoming'
const PRESEASON_START = new Date('2025-10-02')
const PRESEASON_END   = new Date('2025-10-17')
const MAX_PRESEASON   = 5
function getDates() {
  const dates: Date[] = []
  const d = new Date(PRESEASON_START)
  while (d <= PRESEASON_END) { dates.push(new Date(d)); d.setDate(d.getDate()+1) }
  return dates
}
function isoDate(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const r=new Date(d); r.setDate(r.getDate()+n); return r }
export default function TeamSchedule({
  games, teamId, teams
}: {
  games: any[], teamId: string, teams: Record<string,any>
}) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [filter, setFilter] = useState<Filter>('all')
  const [myTeamId, setMyTeamId] = useState<string|null>(null)
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date|null>(null)
  const [selectedOpp, setSelectedOpp] = useState('')
  const [oppType, setOppType] = useState<'nba'|'world'>('nba')
  const [isHome, setIsHome] = useState(true)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [preseasonGames, setPreseasonGames] = useState<any[]>([])
  const [nbaTeams, setNbaTeams] = useState<any[]>([])
  const [worldTeams, setWorldTeams] = useState<any[]>([])
  const [allPreseasonGames, setAllPreseasonGames] = useState<any[]>([])
  const [seasonStatus, setSeasonStatus] = useState<string>('pre-season')
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set())
  const [previewGame, setPreviewGame] = useState<any>(null)

  const isPreseasonPeriod = seasonStatus === 'pre-season'

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: gm } = await supabase.from('gm_profiles').select('team_id,role').eq('id', user.id).single()
      if (gm?.team_id === teamId || gm?.role === 'commissioner') setMyTeamId(teamId)
      if (gm?.role === 'commissioner') setIsCommissioner(true)
    })
    // Get season status
    supabase.from('season_config').select('status').eq('id',1).single().then(({data}) => {
      if (data) setSeasonStatus(data.status)
    })
    Promise.all([
      supabase.from('preseason_games').select('*').eq('season','2025-26').order('scheduled_date'),
      supabase.from('teams').select('id,name,color,logo_url').not('id','in','(ALL,RVS,ROO,SOP)').order('name'),
      supabase.from('world_teams').select('*').order('name'),
    ]).then(([{data:pg},{data:nba},{data:wt}]) => {
      setAllPreseasonGames(pg||[])
      const myPg = (pg||[]).filter((g:any) => g.home_team===teamId||g.away_team===teamId)
      setPreseasonGames(myPg)
      setNbaTeams(nba||[])
      setWorldTeams(wt||[])
    })
  }, [teamId])

  const filters: {key:Filter, label:string}[] = [
    {key:'all',      label:isPT?'Todos':'All'},
    {key:'upcoming', label:isPT?'Próximos':'Upcoming'},
    {key:'played',   label:isPT?'Realizados':'Played'},
    {key:'home',     label:isPT?'Casa':'Home'},
    {key:'away',     label:isPT?'Fora':'Away'},
  ]
  const filtered = games.filter(g => {
    if (cancelledIds.has(g.id)) return false
    if (filter==='played')   return g.status==='final'
    if (filter==='upcoming') return g.status!=='final'
    if (filter==='home')     return g.home_team===teamId
    if (filter==='away')     return g.away_team===teamId
    return true
  })
  // scheduled_date is the in-game calendar date; played_at is just the
  // real-world server timestamp of when the simulate job happened to run
  // (e.g. "today") — that must never win over the actual game date.
  const effDate = (g:any) => (g.scheduled_date ? g.scheduled_date+'T12:00:00' : g.played_at)
  const byMonth: Record<string,any[]> = {}
  for (const g of filtered) {
    const iso = effDate(g)
    const d = iso ? new Date(iso) : null
    const key = d ? d.toLocaleDateString(isPT?'pt-PT':'en-US',{month:'long',year:'numeric'}) : 'TBD'
    if (!byMonth[key]) byMonth[key]=[]
    byMonth[key].push(g)
  }
  const sortedMonths = Object.keys(byMonth).sort((a,b) => {
    if (a==='TBD') return 1; if (b==='TBD') return -1
    return new Date(a).getTime()-new Date(b).getTime()
  })
  const played   = games.filter(g=>g.status==='final').length
  const upcoming = games.filter(g=>g.status!=='final').length
  const worldTeamIds = new Set(worldTeams.map((t:any)=>t.id))
  const fmtDate = (iso:string) => new Date(iso).toLocaleDateString(isPT?'pt-PT':'en-US',{weekday:'short',month:'short',day:'numeric'})
  const fmtTime = (iso:string) => new Date(iso).toLocaleTimeString(isPT?'pt-PT':'en-US',{hour:'numeric',minute:'2-digit',timeZone:'Europe/Lisbon'})
  const myActivePS = preseasonGames.filter(g=>['pending','accepted','scheduled','final'].includes(g.status))
  const canSchedule = myTeamId && isPreseasonPeriod && myActivePS.length < MAX_PRESEASON
  const myBusyDates = new Set(
    myActivePS.filter(g=>g.scheduled_date).flatMap(g => {
      const d = new Date(g.scheduled_date)
      return [isoDate(addDays(d,-1)), isoDate(d), isoDate(addDays(d,1))]
    })
  )
  const getAvailableOpps = (date: Date) => {
    const ds=isoDate(date), prev=isoDate(addDays(date,-1)), next=isoDate(addDays(date,1))
    const busy = new Set(
      allPreseasonGames
        .filter(g=>g.scheduled_date&&['pending','accepted','scheduled','final'].includes(g.status))
        .filter(g=>[prev,ds,next].includes(g.scheduled_date))
        .flatMap((g:any)=>[g.home_team,g.away_team])
    )
    return {
      nba: nbaTeams.filter((t:any)=>t.id!==teamId&&!busy.has(t.id)),
      world: worldTeams.filter((t:any)=>!busy.has(t.id)),
    }
  }
  const handleSchedule = async () => {
    if (!selectedDate||!selectedOpp||!myTeamId) return
    setSaving(true); setMsg('')
    const home = isHome ? myTeamId : selectedOpp
    const away = isHome ? selectedOpp : myTeamId
    const { error } = await supabase.from('preseason_games').insert({
      season:'2025-26', home_team:home, away_team:away,
      home_type: isHome?'nba':oppType, away_type: isHome?oppType:'nba',
      requested_by:myTeamId, status:oppType==='world'?'scheduled':'pending',
      scheduled_date:isoDate(selectedDate), notes:note,
    })
    if (error) { setMsg('Error: '+error.message); setSaving(false); return }
    if (oppType==='nba') {
      await supabase.from('inbox_messages').insert({
        to_team_id: selectedOpp,
        from_team_id: myTeamId,
        subject: isPT?'Pedido de Jogo Amigável':'Pre-Season Game Request',
        body: isPT
          ? `${teams[myTeamId]?.name||myTeamId} desafiou-te para um amigável a ${fmtDate(isoDate(selectedDate)+'T12:00:00')}. ${note?`Mensagem: "${note}"`:''}` 
          : `${teams[myTeamId]?.name||myTeamId} has challenged you to a pre-season game on ${fmtDate(isoDate(selectedDate)+'T12:00:00')}. ${note?`Message: "${note}"`:''}`,
        type: 'preseason_request',
        metadata: { date: isoDate(selectedDate), requesting_team: myTeamId },
      })
    }
    setMsg(oppType==='world'
      ? (isPT?'✅ Jogo agendado!':'✅ Game scheduled!')
      : (isPT?'✅ Pedido enviado! O adversário será notificado.':'✅ Request sent! Opponent will be notified.'))
    const {data:pg} = await supabase.from('preseason_games').select('*').eq('season','2025-26').order('scheduled_date')
    setAllPreseasonGames(pg||[])
    setPreseasonGames((pg||[]).filter((g:any)=>g.home_team===teamId||g.away_team===teamId))
    setTimeout(()=>{ setShowModal(false); setMsg(''); setSelectedDate(null); setSelectedOpp(''); setNote('') },2000)
    setSaving(false)
  }
  const [simulatingId, setSimulatingId] = useState<string|null>(null)
  const handleSimulateFriendly = async (preseasonGameId: string) => {
    if (!confirm(isPT ? 'Simular este jogo amigável agora?' : 'Simulate this friendly game now?')) return
    setSimulatingId(preseasonGameId)
    try {
      const res = await fetch('/api/admin/simulate-preseason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: preseasonGameId, secret: 'nba-admin-2025' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert(isPT ? `Erro: ${data.error}` : `Error: ${data.error}`)
        setSimulatingId(null)
        return
      }
      window.location.reload()
    } catch (e: any) {
      alert(e.message)
      setSimulatingId(null)
    }
  }
  const allDates = getDates()
  const TYPE_BADGE: Record<string,{label:string,bg:string,color:string}> = {
    preseason: {label:isPT?'Pré-Época':'Pre-Season',bg:'#f0f9ff',color:'#0369a1'},
    regular:   {label:isPT?'Época Regular':'Regular',bg:'#f0fdf4',color:'#15803d'},
    playoff:   {label:'Playoffs',bg:'#fef2f2',color:'#dc2626'},
  }
  const PS_STATUS: Record<string,{bg:string,color:string,label:string}> = {
    pending:   {bg:'#fef3c7',color:'#b45309',label:isPT?'Pendente':'Pending'},
    scheduled: {bg:'#dbeafe',color:'#1d4ed8',label:isPT?'Agendado':'Scheduled'},
    declined:  {bg:'#fee2e2',color:'#dc2626',label:isPT?'Recusado':'Declined'},
    final:     {bg:'#f0ece5',color:'#5c554e',label:'Final'},
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-4 text-sm flex-wrap">
          <span style={{color:'#6b5f4e'}}>{played} {isPT?'realizados':'played'}</span>
          <span style={{color:'#6b5f4e'}}>·</span>
          <span style={{color:'#6b5f4e'}}>{upcoming} {isPT?'restantes':'remaining'}</span>
          <span style={{color:'#6b5f4e'}}>·</span>
          <span style={{color:'#6b5f4e'}}>{games.length} total</span>
        </div>
        {canSchedule && (
          <button onClick={()=>setShowModal(true)}
            className="px-4 py-2 rounded-lg text-xs font-bold"
            style={{background:'#0369a1',color:'#fff'}}>
            {isPT?'+ Agendar Amigável':'+ Schedule Pre-Season Game'}
          </button>
        )}
        {myTeamId && isPreseasonPeriod && myActivePS.length >= MAX_PRESEASON && (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{background:'#fee2e2',color:'#dc2626'}}>
            {isPT?'⚠️ Máximo de 5 amigáveis atingido':'⚠️ Max 5 pre-season games reached'}
          </span>
        )}
      </div>

      {isPreseasonPeriod && (() => {
        // Commissioner sees ALL pending games across all teams
        // GM sees pending requests TO their team (to accept/decline)
        // GM also sees their OWN pending requests (to cancel)
        const pendingToAccept = isCommissioner
          ? allPreseasonGames.filter(g => g.status === 'pending')
          : preseasonGames.filter(g => g.status === 'pending' && g.requested_by !== teamId)
        const pendingToCancel = preseasonGames.filter(g => g.status === 'pending' && g.requested_by === teamId)

        if (pendingToAccept.length === 0 && pendingToCancel.length === 0) return null
        return (
          <>
            {pendingToAccept.length > 0 && (
              <div className="mb-4 p-3 rounded-xl" style={{background:'#fef9c3',border:'1px solid #b45309'}}>
                <div className="text-xs font-bold mb-2" style={{color:'#b45309'}}>
                  {isPT ? '⏳ Pedidos pendentes para aceitar' : '⏳ Pending requests to accept'}
                  {isCommissioner && <span className="ml-2 text-xs font-normal opacity-70">{isPT ? '(todas as equipas)' : '(all teams)'}</span>}
                </div>
                {pendingToAccept.map((g:any) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-xs" style={{color:'#1a1512'}}>
                      {teams[g.home_team]?.name||g.home_team} vs {teams[g.away_team]?.name||g.away_team}
                      {g.scheduled_date && <span style={{color:'#8a8279'}}> · {fmtDate(g.scheduled_date+'T12:00:00')}</span>}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        await supabase.from('preseason_games').update({status:'scheduled'}).eq('id',g.id)
                        const {data:pg} = await supabase.from('preseason_games').select('*').eq('season','2025-26').order('scheduled_date')
                        setAllPreseasonGames(pg||[])
                        setPreseasonGames((pg||[]).filter((x:any)=>x.home_team===teamId||x.away_team===teamId))
                      }} className="px-2 py-1 rounded text-xs font-bold" style={{background:'#15803d',color:'#fff'}}>
                        {isPT?'Aceitar':'Accept'}
                      </button>
                      <button onClick={async () => {
                        await supabase.from('preseason_games').update({status:'declined'}).eq('id',g.id)
                        const {data:pg} = await supabase.from('preseason_games').select('*').eq('season','2025-26').order('scheduled_date')
                        setAllPreseasonGames(pg||[])
                        setPreseasonGames((pg||[]).filter((x:any)=>x.home_team===teamId||x.away_team===teamId))
                      }} className="px-2 py-1 rounded text-xs font-bold" style={{background:'#dc2626',color:'#fff'}}>
                        {isPT?'Recusar':'Decline'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pendingToCancel.length > 0 && (
              <div className="mb-4 p-3 rounded-xl" style={{background:'#f0f4ff',border:'1px solid #93c5fd'}}>
                <div className="text-xs font-bold mb-2" style={{color:'#1d4ed8'}}>
                  {isPT ? '📤 Pedidos enviados (aguardam resposta)' : '📤 Sent requests (awaiting response)'}
                </div>
                {pendingToCancel.map((g:any) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-xs" style={{color:'#1a1512'}}>
                      {teams[g.home_team]?.name||g.home_team} vs {teams[g.away_team]?.name||g.away_team}
                      {g.scheduled_date && <span style={{color:'#8a8279'}}> · {fmtDate(g.scheduled_date+'T12:00:00')}</span>}
                    </span>
                    <button onClick={async () => {
                      if (!confirm(isPT?'Cancelar este pedido?':'Cancel this request?')) return
                      await supabase.from('preseason_games').update({status:'cancelled'}).eq('id',g.id)
                      setCancelledIds(prev => { const s = new Set(prev); s.add(g.id); return s })
                      setPreseasonGames(prev => prev.filter((pg:any) => pg.id !== g.id))
                      setAllPreseasonGames(prev => prev.map((pg:any) => pg.id===g.id ? {...pg,status:'cancelled'} : pg))
                    }} className="px-2 py-1 rounded text-xs font-bold" style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5'}}>
                      {isPT?'✕ Cancelar':'✕ Cancel'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      })()}

      <div className="flex gap-2 mb-5 flex-wrap">
        {filters.map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{background:filter===f.key?'#1a1512':'#e8e2d6',color:filter===f.key?'#f5f1eb':'#5c554e',border:'1px solid '+(filter===f.key?'#1a1512':'#d4cdc5')}}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length===0 && (
        <div className="text-center py-8 rounded-xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <p className="text-sm" style={{color:'#8a8279'}}>{isPT?'Sem jogos encontrados.':'No games found.'}</p>
        </div>
      )}

      {sortedMonths.map(month=>(
        <div key={month} className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{color:'#b45309',letterSpacing:'1.5px'}}>{month}</span>
            <div className="flex-1 h-px" style={{background:'#d4cdc5'}}></div>
            <span className="text-xs" style={{color:'#8a8279'}}>
              {byMonth[month].length} {isPT?'jogo'+(byMonth[month].length!==1?'s':''):'game'+(byMonth[month].length!==1?'s':'')}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {byMonth[month]
              .sort((a,b)=>new Date(effDate(a)||0).getTime()-new Date(effDate(b)||0).getTime())
              .map((g,i)=>{
                const isHome2=g.home_team===teamId
                const opp=isHome2?g.away_team:g.home_team
                const oppTeam=teams[opp]
                const oppColor=oppTeam?readableTeamColor(oppTeam.color):'#5c554e'
                const isPlayed=g.status==='final'
                const myScore=isHome2?g.home_score:g.away_score
                const oppScore=isHome2?g.away_score:g.home_score
                const won=isPlayed&&myScore>oppScore
                const typeBadge=TYPE_BADGE[g.game_type||'regular']||TYPE_BADGE.regular
                const gEffDate = effDate(g)
                const marquee = g.week_number>0 && gEffDate ? getMarqueeInfoForDate(gEffDate, g.week_number) : {marquee:false}
                const isPreviewable = !isPlayed && g.game_type!=='preseason'
                return (
                  <div key={g.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                       onClick={()=>{if(isPreviewable)setPreviewGame(g)}}
                       style={{background:i%2===0?'#faf8f5':'#f5f1eb',border:'1px solid #e2dcd5',cursor:isPreviewable?'pointer':'default'}}>
                    <div className="w-24 flex-shrink-0">
                      <div className="text-xs font-bold" style={{color:'#1a1512'}}>{gEffDate?fmtDate(gEffDate):'TBD'}</div>
                      {g.week_number>0&&<div className="text-xs" style={{color:'#8a8279'}}>{isPT?'Sem':'Wk'} {g.week_number}</div>}
                      {g.played_at&&!isPlayed&&<div className="text-xs" style={{color:'#b45309'}}>{fmtTime(g.played_at)}</div>}
                    </div>
                    <div className="w-6 flex-shrink-0 text-center">
                      <span className="text-xs font-bold px-1 py-0.5 rounded"
                            style={{background:isHome2?'#dbeafe':'#f0ece5',color:isHome2?'#1d4ed8':'#6b5f4e'}}>
                        {isHome2?(isPT?'C':'H'):(isPT?'F':'A')}
                      </span>
                    </div>
                    {g.game_type&&g.game_type!=='regular'&&(
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{background:typeBadge.bg,color:typeBadge.color,fontSize:10}}>
                        {typeBadge.label}
                      </span>
                    )}
                    {marquee.marquee&&(
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{background:'#fef9c3',color:'#b45309',fontSize:10}}>
                        {MARQUEE_ICON[marquee.label||'']||'⭐'} {getMarqueeLabelText(marquee.label||'', isPT)}
                      </span>
                    )}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      {oppTeam?.logo_url&&<img src={oppTeam.logo_url} alt={opp} className="w-5 h-5 object-contain flex-shrink-0"/>}
                      <Link href={worldTeamIds.has(opp)?`/world/${opp}`:`/team/${opp}`} onClick={e=>e.stopPropagation()} className="text-sm font-semibold hover:underline truncate" style={{color:oppColor}}>
                        {oppTeam?.name||opp}
                      </Link>
                    </div>
                    {/* Odds for upcoming games — based on composite strength */}
                    {!isPlayed && (() => {
                      const myStr = teams[teamId]?.strength
                      const oppStr = teams[opp]?.strength
                      if (myStr == null || oppStr == null) return null
                      // Home advantage: +5 strength points
                      const myAdj = myStr + (isHome2 ? 5 : 0)
                      const oppAdj = oppStr + (isHome2 ? 0 : 5)
                      const total = myAdj + oppAdj
                      const myWinProb = total > 0 ? myAdj / total : 0.5
                      const oppWinProb = 1 - myWinProb
                      return (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs font-black px-1.5 py-0.5 rounded"
                            style={{background:myWinProb>=0.5?'#dcfce7':'#fee2e2',color:myWinProb>=0.5?'#15803d':'#dc2626'}}>
                            {Math.round(myWinProb*100)}%
                          </span>
                          <span className="text-xs" style={{color:'#9c8e7a'}}>-</span>
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{background:'#f0ece5',color:'#6b5f4e'}}>
                            {Math.round(oppWinProb*100)}%
                          </span>
                        </div>
                      )
                    })()}
                    <div className="flex-shrink-0 text-right flex items-center gap-2">
                      {isPlayed?(
                        <Link href={g.is_world_friendly ? `/game/friendly/${g.preseason_game_id||g.id}` : `/game/${g.id}`} className="flex items-center gap-2 no-underline hover:opacity-80">
                          <span className="text-xs font-black px-2 py-0.5 rounded"
                                style={{background:won?'#dcfce7':'#fee2e2',color:won?'#15803d':'#dc2626'}}>
                            {won?(isPT?'V':'W'):(isPT?'D':'L')}
                          </span>
                          <span className="text-sm font-bold" style={{color:'#1a1512'}}>{myScore}-{oppScore}</span>
                        </Link>
                      ):(
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded" style={{background:'#f0ece5',color:'#8a8279'}}>
                            {isPT?'Agendado':'Scheduled'}
                          </span>
                          {g.game_type==='preseason' && myTeamId && (
                            <button
                              onClick={async () => {
                                if (!confirm(isPT?'Cancelar este jogo amigável?':'Cancel this friendly game?')) return
                                await supabase.from('preseason_games').update({status:'cancelled'}).eq('id',g.preseason_game_id||g.id)
                                setCancelledIds(prev => { const s = new Set(prev); s.add(g.id); return s })
                                setPreseasonGames(prev => prev.filter((pg:any) => pg.id !== (g.preseason_game_id||g.id)))
                                setAllPreseasonGames(prev => prev.map((pg:any) => pg.id===(g.preseason_game_id||g.id) ? {...pg,status:'cancelled'} : pg))
                              }}
                              className="text-xs px-2 py-0.5 rounded font-semibold"
                              style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5'}}>
                              {isPT?'✕ Cancelar':'✕ Cancel'}
                            </button>
                          )}
                          {g.game_type==='preseason' && isCommissioner && (
                            <button
                              disabled={simulatingId===(g.preseason_game_id||g.id)}
                              onClick={() => handleSimulateFriendly(g.preseason_game_id||g.id)}
                              className="text-xs px-2 py-0.5 rounded font-semibold disabled:opacity-40"
                              style={{background:'#dbeafe',color:'#1d4ed8',border:'1px solid #93c5fd'}}>
                              {simulatingId===(g.preseason_game_id||g.id)
                                ? (isPT?'⏳ A simular...':'⏳ Simulating...')
                                : (isPT?'⚡ Simular':'⚡ Simulate')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      ))}

      {showModal&&myTeamId&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.65)'}}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{background:'#faf8f5',border:'1px solid #d4cdc5',maxHeight:'90vh',overflowY:'auto'}}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black" style={{color:'#1a1512'}}>
                🏀 {isPT?'Agendar Amigável':'Schedule Pre-Season Game'}
              </h2>
              <button onClick={()=>{setShowModal(false);setSelectedDate(null);setSelectedOpp('');setMsg('')}} style={{color:'#8a8279',fontSize:20}}>✕</button>
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e'}}>
                {isPT?'1. Escolhe a Data (2–17 Out)':'1. Choose Date (Oct 2–17)'}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {allDates.map(d=>{
                  const avail=!myBusyDates.has(isoDate(d))
                  const sel=selectedDate&&isoDate(d)===isoDate(selectedDate)
                  return (
                    <button key={isoDate(d)} disabled={!avail} onClick={()=>{setSelectedDate(d);setSelectedOpp('')}}
                      className="py-2 rounded-lg text-xs font-bold"
                      style={{
                        background:sel?'#1a1512':avail?'#e8e2d6':'#fee2e2',
                        color:sel?'#f5f1eb':avail?'#1a1512':'#dc2626',
                        border:'1px solid '+(sel?'#1a1512':avail?'#d4cdc5':'#fca5a5'),
                        cursor:avail?'pointer':'not-allowed',
                        textDecoration:avail?'none':'line-through',
                      }}>
                      {d.toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric'})}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  <span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'#e8e2d6'}}></span>
                  {isPT?'Disponível':'Available'}
                </span>
                <span className="flex items-center gap-1">
                  <span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'#fee2e2'}}></span>
                  {isPT?'Indisponível':'Unavailable'}
                </span>
              </div>
            </div>

            {selectedDate&&(
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e'}}>
                  {isPT?'2. O teu papel':'2. Your Role'}
                </div>
                <div className="flex gap-2">
                  {[{v:true,l:isPT?'🏠 Casa':'🏠 Home'},{v:false,l:isPT?'✈️ Fora':'✈️ Away'}].map(o=>(
                    <button key={String(o.v)} onClick={()=>setIsHome(o.v)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold"
                      style={{background:isHome===o.v?'#1a1512':'#e8e2d6',color:isHome===o.v?'#f5f1eb':'#1a1512',border:'1px solid #d4cdc5'}}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedDate&&(
              <div className="mb-4">
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e'}}>
                  {isPT?'3. Adversário':'3. Opponent'}
                </div>
                <div className="flex gap-2 mb-3">
                  {[{v:'nba' as const,l:isPT?'Equipa NBA':'NBA Team'},{v:'world' as const,l:isPT?'Equipa Mundial (AI)':'World Team (AI)'}].map(o=>(
                    <button key={o.v} onClick={()=>{setOppType(o.v);setSelectedOpp('')}}
                      className="flex-1 py-2 rounded-lg text-xs font-bold"
                      style={{background:oppType===o.v?'#1a1512':'#e8e2d6',color:oppType===o.v?'#f5f1eb':'#1a1512',border:'1px solid #d4cdc5'}}>
                      {o.l}
                    </button>
                  ))}
                </div>
                {(()=>{
                  const avail=getAvailableOpps(selectedDate)
                  const opps=oppType==='nba'?avail.nba:avail.world
                  if(!opps.length) return (
                    <div className="text-xs text-center py-2" style={{color:'#dc2626'}}>
                      {isPT?'Sem adversários disponíveis para esta data':'No available opponents for this date'}
                    </div>
                  )
                  return (
                    <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                      {opps.map((t:any)=>(
                        <button key={t.id} onClick={()=>setSelectedOpp(t.id)}
                          className="px-2 py-2 rounded-lg text-xs font-semibold text-left"
                          style={{background:selectedOpp===t.id?'#1a1512':'#e8e2d6',color:selectedOpp===t.id?'#f5f1eb':'#1a1512',border:'1px solid #d4cdc5'}}>
                          {t.name}
                          {oppType==='world'&&<span className="block opacity-60" style={{fontSize:10}}>{t.country}</span>}
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {selectedOpp&&(
              <div className="mb-4">
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e'}}>
                  {isPT?'4. Mensagem (opcional)':'4. Message (optional)'}
                </div>
                <input type="text" value={note} onChange={e=>setNote(e.target.value)}
                  placeholder={isPT?'Mensagem opcional para o adversário...':'Optional message to opponent...'}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
              </div>
            )}

            {msg&&<div className="mb-3 text-sm font-semibold text-center" style={{color:msg.startsWith('✅')?'#15803d':'#dc2626'}}>{msg}</div>}
            <button onClick={handleSchedule} disabled={!selectedDate||!selectedOpp||saving}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
              style={{background:'#1a1512',color:'#f5f1eb'}}>
              {saving
                ? (isPT?'A enviar...':'Sending...')
                : (oppType==='world'?(isPT?'Agendar Jogo':'Schedule Game'):(isPT?'Enviar Pedido →':'Send Request →'))}
            </button>
          </div>
        </div>
      )}

      {previewGame && (
        <GamePreviewModal game={previewGame} teams={teams} isPT={isPT} onClose={()=>setPreviewGame(null)} />
      )}
    </div>
  )
}

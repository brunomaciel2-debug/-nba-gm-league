'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

type GameHigh = { pid:string, name:string, pos:string, team:string, teamColor?:string, photo?:string, value:number, gameId:string, opp:string, dateLabel:string }
type SeasonBest = { pid:string, name:string, pos:string, team:string, teamColor?:string, photo?:string, value:number, season:string }
type TeamGameRecord = { teamId:string, teamName:string, teamColor?:string, logo?:string, value:number, gameId:string, opp:string, oppScore?:number, dateLabel:string }
type StreakRecord = { teamId:string, teamName:string, teamColor?:string, logo?:string, streak:number }

const POS_GAME_KEYS = ['pts','reb','ast','stl','blk','tpm','ftm','plus_minus'] as const
const NEG_GAME_KEYS = ['turnovers','pf'] as const
const POS_TOTAL_KEYS = ['pts','reb','ast','stl','blk','tpm','double_doubles','triple_doubles'] as const
const NEG_TOTAL_KEYS = ['turnovers'] as const

export default function RecordsPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [loading,setLoading] = useState(true)
  const [viewMode,setViewMode] = useState<'season'|'alltime'>('season')
  const [availableSeasons,setAvailableSeasons] = useState<string[]>([])
  const [selectedSeason,setSelectedSeason] = useState<string>('')

  const [gameHighs,setGameHighs] = useState<Record<string,GameHigh[]>>({})
  const [gameLows,setGameLows] = useState<Record<string,GameHigh[]>>({})
  const [worstPlusMinus,setWorstPlusMinus] = useState<GameHigh[]>([])
  const [seasonBestsTotal,setSeasonBestsTotal] = useState<Record<string,SeasonBest[]>>({})
  const [seasonWorstTotal,setSeasonWorstTotal] = useState<Record<string,SeasonBest[]>>({})

  const [teamGamePts,setTeamGamePts] = useState<TeamGameRecord[]>([])
  const [teamGameMargin,setTeamGameMargin] = useState<TeamGameRecord[]>([])
  const [teamGameFewestAllowed,setTeamGameFewestAllowed] = useState<TeamGameRecord[]>([])
  const [teamGameCombined,setTeamGameCombined] = useState<TeamGameRecord[]>([])
  const [teamGame3pm,setTeamGame3pm] = useState<TeamGameRecord[]>([])
  const [longestStreak,setLongestStreak] = useState<StreakRecord[]>([])

  const [teamGameFewestScored,setTeamGameFewestScored] = useState<TeamGameRecord[]>([])
  const [teamGameBiggestLoss,setTeamGameBiggestLoss] = useState<TeamGameRecord[]>([])
  const [teamGameMostAllowed,setTeamGameMostAllowed] = useState<TeamGameRecord[]>([])
  const [longestLosingStreak,setLongestLosingStreak] = useState<StreakRecord[]>([])

  const [championships,setChampionships] = useState<any[]>([])

  // Which seasons actually exist — queried once, independent of the
  // season/all-time toggle below, so the season picker can populate itself
  // and always default to the most recent one.
  useEffect(()=>{
    supabase.from('games').select('season').eq('status','final').eq('game_type','regular').then(({data})=>{
      const seasons = Array.from(new Set((data||[]).map((g:any)=>g.season))).sort().reverse()
      setAvailableSeasons(seasons.length?seasons:['2025-26'])
      setSelectedSeason(seasons[0]||'2025-26')
    })
  },[])

  useEffect(()=>{
    if (viewMode==='season' && !selectedSeason) return
    (async () => {
      setLoading(true)
      // null = All-Time (no season filter); a real season string scopes everything below to it.
      const scopeSeason = viewMode==='season' ? selectedSeason : null

      // Supabase caps a single request at 1000 rows — a full season already
      // exceeds that in games/box_scores, so a plain unpaginated select
      // starts silently truncating results (missing rows, not an error)
      // right around when the season is furthest along and records matter most.
      const fetchAllRows = async (table: string, selectStr: string, filters: (q:any)=>any) => {
        let all: any[] = [], from = 0
        const pageSize = 1000
        while (true) {
          const { data } = await filters(supabase.from(table).select(selectStr)).range(from, from+pageSize-1)
          if (!data || data.length === 0) break
          all = all.concat(data)
          if (data.length < pageSize) break
          from += pageSize
        }
        return all
      }

      const gamesBase = (q:any) => {
        const f = q.eq('status','final').eq('game_type','regular')
        return scopeSeason ? f.eq('season', scopeSeason) : f
      }
      const boxGamesJoin = (q:any) => {
        const f = q.eq('games.status','final').eq('games.game_type','regular')
        return scopeSeason ? f.eq('games.season', scopeSeason) : f
      }

      const regGames = await fetchAllRows('games', 'id,home_team,away_team,home_score,away_score,scheduled_date', gamesBase)
      const gameById: Record<string,any> = {}
      for (const g of (regGames||[])) gameById[g.id] = g

      const { data: teamsData } = await supabase.from('teams').select('id,name,color,logo_url,wins,losses').not('id','in','(ALL,RVS,ROO,SOP)')
      const teamMap: Record<string,any> = {}
      for (const tm of (teamsData||[])) teamMap[tm.id] = tm

      const mapBoxRow = (b:any, key:string) => {
        const g = gameById[b.game_id]
        const isHome = g?.home_team === b.team_id
        const oppId = g ? (isHome ? g.away_team : g.home_team) : '—'
        return {
          pid: b.players?.id, name: b.players?.name||'—', pos: b.players?.pos||'—',
          team: b.team_id, teamColor: b.players?.teams?.color, photo: b.players?.photo_url,
          value: b[key]||0, gameId: b.game_id, opp: teamMap[oppId]?.name || oppId,
          dateLabel: g?.scheduled_date || '',
        }
      }

      // ── Individual single-game highs/lows — joined on games (status/
      // game_type/season) instead of .in('game_id', gameIds): with 600+
      // games a season, passing every id as a URL filter blows past
      // PostgREST's request-size limit and silently 400's.
      const highsResult: Record<string,GameHigh[]> = {}
      for (const key of POS_GAME_KEYS) {
        const { data } = await boxGamesJoin(supabase.from('box_scores')
          .select(`player_id,game_id,team_id,${key},players(id,name,pos,photo_url,teams:teams!players_team_id_fkey(color)),games!inner(status,game_type,season)`))
          .order(key,{ascending:false}).limit(1)
        highsResult[key] = (data||[]).map((b:any)=>mapBoxRow(b,key))
      }
      setGameHighs(highsResult)

      const lowsResult: Record<string,GameHigh[]> = {}
      for (const key of NEG_GAME_KEYS) {
        const { data } = await boxGamesJoin(supabase.from('box_scores')
          .select(`player_id,game_id,team_id,${key},players(id,name,pos,photo_url,teams:teams!players_team_id_fkey(color)),games!inner(status,game_type,season)`))
          .order(key,{ascending:false}).limit(1)
        lowsResult[key] = (data||[]).map((b:any)=>mapBoxRow(b,key))
      }
      setGameLows(lowsResult)

      const { data: worstPM } = await boxGamesJoin(supabase.from('box_scores')
        .select(`player_id,game_id,team_id,plus_minus,players(id,name,pos,photo_url,teams:teams!players_team_id_fkey(color)),games!inner(status,game_type,season)`))
        .order('plus_minus',{ascending:true}).limit(1)
      setWorstPlusMinus((worstPM||[]).map((b:any)=>mapBoxRow(b,'plus_minus')))

      // ── Team single-game records (positive + negative share the same raw rows) ──
      const teamGameRows: {teamId:string,score:number,oppScore:number,gameId:string,opp:string,dateLabel:string}[] = []
      for (const g of (regGames||[])) {
        teamGameRows.push({teamId:g.home_team, score:g.home_score, oppScore:g.away_score, gameId:g.id, opp:teamMap[g.away_team]?.name||g.away_team, dateLabel:g.scheduled_date})
        teamGameRows.push({teamId:g.away_team, score:g.away_score, oppScore:g.home_score, gameId:g.id, opp:teamMap[g.home_team]?.name||g.home_team, dateLabel:g.scheduled_date})
      }
      const toTeamRecord = (r:any, value:number) => ({
        teamId:r.teamId, teamName:teamMap[r.teamId]?.name||r.teamId, teamColor:teamMap[r.teamId]?.color, logo:teamMap[r.teamId]?.logo_url,
        value, gameId:r.gameId, opp:r.opp, oppScore:r.oppScore, dateLabel:r.dateLabel,
      })
      setTeamGamePts([...teamGameRows].sort((a,b)=>b.score-a.score).slice(0,1).map(r=>toTeamRecord(r,r.score)))
      setTeamGameFewestScored([...teamGameRows].sort((a,b)=>a.score-b.score).slice(0,1).map(r=>toTeamRecord(r,r.score)))
      setTeamGameMargin([...teamGameRows].filter(r=>r.score>r.oppScore).sort((a,b)=>(b.score-b.oppScore)-(a.score-a.oppScore)).slice(0,1).map(r=>toTeamRecord(r,r.score-r.oppScore)))
      setTeamGameBiggestLoss([...teamGameRows].filter(r=>r.score<r.oppScore).sort((a,b)=>(b.oppScore-b.score)-(a.oppScore-a.score)).slice(0,1).map(r=>toTeamRecord(r,r.oppScore-r.score)))
      setTeamGameFewestAllowed([...teamGameRows].sort((a,b)=>a.oppScore-b.oppScore).slice(0,1).map(r=>toTeamRecord(r,r.oppScore)))
      setTeamGameMostAllowed([...teamGameRows].sort((a,b)=>b.oppScore-a.oppScore).slice(0,1).map(r=>toTeamRecord(r,r.oppScore)))

      const combinedRows = (regGames||[]).map((g:any)=>({
        teamId:g.home_team, score:g.home_score+g.away_score, gameId:g.id, opp:teamMap[g.away_team]?.name||g.away_team, dateLabel:g.scheduled_date,
      }))
      setTeamGameCombined([...combinedRows].sort((a,b)=>b.score-a.score).slice(0,1).map(r=>toTeamRecord(r,r.score)))

      // ── Most 3-pointers made BY A TEAM in a single game — box_scores has
      // no per-team-per-game total, so this sums each player's tpm grouped
      // by (game_id, team_id) client-side.
      const allTpmBoxes = await fetchAllRows('box_scores', 'game_id,team_id,tpm,games!inner(status,game_type,season)', boxGamesJoin)
      const teamGame3pmMap: Record<string, number> = {}
      for (const b of (allTpmBoxes||[])) {
        const key = `${b.game_id}|${b.team_id}`
        teamGame3pmMap[key] = (teamGame3pmMap[key]||0) + (b.tpm||0)
      }
      const team3pmRows = Object.entries(teamGame3pmMap).map(([key,value])=>{
        const [gameId,teamId] = key.split('|')
        const g = gameById[gameId]
        const isHome = g?.home_team === teamId
        const oppId = g ? (isHome?g.away_team:g.home_team) : '—'
        return { teamId, value, gameId, opp: teamMap[oppId]?.name||oppId, dateLabel: g?.scheduled_date||'' }
      })
      setTeamGame3pm([...team3pmRows].sort((a,b)=>b.value-a.value).slice(0,1).map(r=>toTeamRecord(r,r.value)))

      // ── Longest win/losing streaks — chronological scan tracking the BEST
      // (or worst) streak reached during the scan, not just whichever one
      // is still active at the end.
      const chronoGames = [...(regGames||[])].sort((a:any,b:any)=>(a.scheduled_date||'').localeCompare(b.scheduled_date||''))
      const curWin: Record<string,number> = {}, bestWin: Record<string,number> = {}
      const curLoss: Record<string,number> = {}, worstLoss: Record<string,number> = {}
      for (const g of chronoGames) {
        const hw = (g.home_score||0) > (g.away_score||0)
        const wt = hw?g.home_team:g.away_team, lt = hw?g.away_team:g.home_team
        curWin[wt] = (curWin[wt]||0)+1; curWin[lt] = 0
        bestWin[wt] = Math.max(bestWin[wt]||0, curWin[wt])
        curLoss[lt] = (curLoss[lt]||0)+1; curLoss[wt] = 0
        worstLoss[lt] = Math.max(worstLoss[lt]||0, curLoss[lt])
      }
      const toStreak = ([teamId,streak]:[string,number]) => ({ teamId, teamName:teamMap[teamId]?.name||teamId, teamColor:teamMap[teamId]?.color, logo:teamMap[teamId]?.logo_url, streak })
      setLongestStreak(Object.entries(bestWin).sort((a,b)=>b[1]-a[1]).slice(0,1).map(toStreak))
      setLongestLosingStreak(Object.entries(worstLoss).sort((a,b)=>b[1]-a[1]).slice(0,1).map(toStreak))

      // ── Individual season totals (positive + negative) ──
      const statsFilter = (q:any) => { const f = q.gt('games',0); return scopeSeason ? f.eq('season',scopeSeason) : f }
      const { data: statsRows } = await statsFilter(supabase.from('player_stats')
        .select('player_id,team_id,season,games,pts,reb,ast,stl,blk,tpm,tpa,fgm,fga,ftm,fta,turnovers,double_doubles,triple_doubles,players(id,name,pos,photo_url,teams:teams!players_team_id_fkey(color))'))
      const mapStatRow = (s:any, key:string) => ({
        pid:s.players?.id, name:s.players?.name||'—', pos:s.players?.pos||'—', team:s.team_id,
        teamColor:s.players?.teams?.color, photo:s.players?.photo_url, value:s[key]||0, season:s.season,
      })
      const totalBest: Record<string,SeasonBest[]> = {}
      for (const key of POS_TOTAL_KEYS) totalBest[key] = [...(statsRows||[])].sort((a:any,b:any)=>(b[key]||0)-(a[key]||0)).slice(0,1).map(s=>mapStatRow(s,key))
      setSeasonBestsTotal(totalBest)
      const totalWorst: Record<string,SeasonBest[]> = {}
      for (const key of NEG_TOTAL_KEYS) totalWorst[key] = [...(statsRows||[])].sort((a:any,b:any)=>(b[key]||0)-(a[key]||0)).slice(0,1).map(s=>mapStatRow(s,key))
      setSeasonWorstTotal(totalWorst)

      // ── Champions & runners-up — scoped to the selected season, or every
      // season on record when viewing All-Time.
      const champFilter = (q:any) => scopeSeason ? q.eq('season',scopeSeason) : q
      const { data: champs } = await champFilter(supabase.from('championship_history').select('*'))
        .order('season',{ascending:false}).order('created_at',{ascending:false})
      setChampionships(champs||[])

      setLoading(false)
    })()
  },[viewMode, selectedSeason])

  const GAME_STAT_LABELS: Record<string,{en:string,pt:string,color:string}> = {
    pts: {en:'Most Points',    pt:'Mais Pontos',        color:'#c2410c'},
    reb: {en:'Most Rebounds',  pt:'Mais Ressaltos',     color:'#166534'},
    ast: {en:'Most Assists',   pt:'Mais Assistências',  color:'#1e40af'},
    stl: {en:'Most Steals',    pt:'Mais Roubos',        color:'#7c3aed'},
    blk: {en:'Most Blocks',    pt:'Mais Bloqueios',     color:'#ff6040'},
    tpm: {en:'Most 3-Pointers Made', pt:'Mais Triplos Convertidos', color:'#b45309'},
    ftm: {en:'Most Free Throws Made', pt:'Mais Lances Livres Convertidos', color:'#0e7490'},
    plus_minus: {en:'Best +/-', pt:'Melhor +/-', color:'#15803d'},
  }
  const GAME_STAT_LOW_LABELS: Record<string,{en:string,pt:string,color:string}> = {
    turnovers: {en:'Most Turnovers', pt:'Mais Perdas de Bola', color:'#dc2626'},
    pf:        {en:'Most Personal Fouls', pt:'Mais Faltas Pessoais', color:'#b45309'},
  }
  const TOTAL_LABELS: Record<string,{en:string,pt:string,color:string}> = {
    pts: {en:'Most Points (season)',      pt:'Mais Pontos (época)',        color:'#c2410c'},
    reb: {en:'Most Rebounds (season)',    pt:'Mais Ressaltos (época)',     color:'#166534'},
    ast: {en:'Most Assists (season)',     pt:'Mais Assistências (época)',  color:'#1e40af'},
    stl: {en:'Most Steals (season)',      pt:'Mais Roubos (época)',        color:'#7c3aed'},
    blk: {en:'Most Blocks (season)',      pt:'Mais Bloqueios (época)',     color:'#ff6040'},
    tpm: {en:'Most 3-Pointers Made (season)', pt:'Mais Triplos Convertidos (época)', color:'#b45309'},
    double_doubles: {en:'Most Double-Doubles (season)', pt:'Mais Duplos-Duplos (época)', color:'#6d28d9'},
    triple_doubles: {en:'Most Triple-Doubles (season)', pt:'Mais Triplos-Duplos (época)', color:'#c8102e'},
  }
  const TOTAL_LOW_LABELS: Record<string,{en:string,pt:string,color:string}> = {
    turnovers: {en:'Most Turnovers (season)', pt:'Mais Perdas de Bola (época)', color:'#dc2626'},
  }

  const SectionTitle = ({icon,children}:{icon:string,children:React.ReactNode}) => (
    <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{color:'#1a1512'}}>
      <span>{icon}</span>{children}
    </h2>
  )
  const SubTitle = ({children,color}:{children:React.ReactNode,color:string}) => (
    <h3 className="text-xs font-bold uppercase tracking-widest mb-3 mt-1" style={{color,letterSpacing:'1.5px'}}>{children}</h3>
  )

  const PlayerRow = ({r,signed}:{r:GameHigh|SeasonBest,signed?:boolean}) => {
    const tc = readableTeamColor(r.teamColor||'555')
    const g = r as GameHigh
    const display = signed && r.value>0 ? `+${r.value}` : String(r.value)
    return (
      <Link href={`/player/${r.pid}`} className="no-underline">
        <div className="flex items-center gap-3 px-4 py-3 hover:brightness-110 transition-all">
          <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0" style={{background:tc+'22',border:'2px solid '+tc+'44'}}>
            {r.photo?<img src={r.photo} alt="" className="w-full h-full object-cover"/>
              :<div className="w-full h-full flex items-center justify-center text-sm font-black" style={{color:tc}}>{r.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate" style={{color:'#1a1512'}}>{r.name}</div>
            <div className="text-xs truncate" style={{color:'#6b5f4e'}}>
              {r.team} · {r.pos}{g.opp ? ` · ${isPT?'vs':'vs'} ${g.opp}${g.dateLabel?` · ${g.dateLabel}`:''}` : ''}
            </div>
          </div>
          <span className="text-lg font-black flex-shrink-0" style={{color:'#1a1512'}}>{display}</span>
        </div>
      </Link>
    )
  }

  const TeamRow = ({r,marginMode}:{r:TeamGameRecord,marginMode?:boolean}) => {
    const tc = readableTeamColor(r.teamColor||'555')
    return (
      <Link href={`/game/${r.gameId}`} className="no-underline">
        <div className="flex items-center gap-3 px-4 py-3 hover:brightness-110 transition-all">
          <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{background:tc+'22'}}>
            {r.logo?<img src={r.logo} alt="" className="w-full h-full object-contain p-1.5"/>
              :<span className="text-sm font-black" style={{color:tc}}>{r.teamId}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate" style={{color:'#1a1512'}}>{r.teamName}</div>
            <div className="text-xs truncate" style={{color:'#6b5f4e'}}>
              {isPT?'vs':'vs'} {r.opp}{r.dateLabel?` · ${r.dateLabel}`:''}{r.oppScore!=null && !marginMode ? ` · ${r.value}-${r.oppScore}` : ''}
            </div>
          </div>
          <span className="text-lg font-black flex-shrink-0" style={{color:'#1a1512'}}>{marginMode?`+${r.value}`:r.value}</span>
        </div>
      </Link>
    )
  }

  const StreakRow = ({r}:{r:StreakRecord}) => {
    const tc = readableTeamColor(r.teamColor||'555')
    return (
      <Link href={`/team/${r.teamId}`} className="no-underline">
        <div className="flex items-center gap-3 px-4 py-3 hover:brightness-110 transition-all">
          <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{background:tc+'22'}}>
            {r.logo?<img src={r.logo} alt="" className="w-full h-full object-contain p-1.5"/>:<span className="text-sm font-black" style={{color:tc}}>{r.teamId}</span>}
          </div>
          <div className="flex-1 min-w-0"><div className="text-sm font-bold truncate" style={{color:'#1a1512'}}>{r.teamName}</div></div>
          <span className="text-lg font-black flex-shrink-0" style={{color:'#1a1512'}}>{r.streak} {isPT?'jogos':'games'}</span>
        </div>
      </Link>
    )
  }

  const Card = ({title,color,children}:{title:string,color:string,children:React.ReactNode}) => (
    <div className="rounded-xl overflow-hidden" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
      <div className="px-4 py-3" style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
        <h3 className="font-bold text-sm" style={{color}}>{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  )
  const Empty = () => <div className="p-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Sem dados ainda':'No data yet'}</div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4" style={{color:'#1a1512'}}>🏆 {isPT?'Recordes':'Records'}</h1>

      {/* Season vs All-Time */}
      <div className="flex gap-2 mb-4">
        {[{k:'season',l:isPT?'📅 Por Época':'📅 By Season'},{k:'alltime',l:isPT?'🏛️ All-Time':'🏛️ All-Time'}].map(v=>(
          <button key={v.k} onClick={()=>setViewMode(v.k as any)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{border:`1px solid ${viewMode===v.k?'#b45309':'#d4cdc5'}`,background:viewMode===v.k?'#fef3c7':'#faf8f5',color:viewMode===v.k?'#1a1512':'#5c554e'}}>
            {v.l}
          </button>
        ))}
      </div>

      {viewMode==='season' && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {availableSeasons.map(s=>(
            <button key={s} onClick={()=>setSelectedSeason(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{border:`1px solid ${selectedSeason===s?'#1d4ed8':'#d4cdc5'}`,background:selectedSeason===s?'#dbeafe':'#faf8f5',color:selectedSeason===s?'#1e40af':'#5c554e'}}>
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs mb-8" style={{color:'#8a8279'}}>
        {viewMode==='season'
          ? (isPT ? `A mostrar recordes da época ${selectedSeason}.` : `Showing records for the ${selectedSeason} season.`)
          : (isPT ? 'A mostrar os melhores (e piores) de sempre, em todas as épocas.' : 'Showing the best (and worst) ever, across every season.')}
      </p>

      {loading ? <div className="text-center py-12" style={{color:'#8a8279'}}>{t('common.loading')}</div> : <>

      {/* ── CHAMPIONS ── */}
      <SectionTitle icon="🏆">{isPT?'Campeões & Vice-Campeões':'Champions & Runners-Up'}</SectionTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {[{league:'nba',label:'NBA',color:'#c8102e'},{league:'gleague',label:'G League',color:'#1d4ed8'}].map(({league,label,color})=>{
          const rows = championships.filter((c:any)=>c.league===league)
          return (
            <Card key={league} title={label} color={color}>
              {rows.length===0 ? <Empty/> : rows.map((c:any,i:number)=>(
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3"
                     style={{background:i%2===0?'#ece7dd':'#e8e2d6',borderBottom:i<rows.length-1?'1px solid #d4cdc5':'none'}}>
                  {viewMode==='alltime' && <span className="text-xs font-semibold flex-shrink-0" style={{color:'#8a8279'}}>{c.season}</span>}
                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-sm font-bold truncate" style={{color}}>🏆 {c.champion_team_name}</div>
                    <div className="text-xs truncate" style={{color:'#8a8279'}}>{isPT?'vice':'runner-up'}: {c.runner_up_team_name}</div>
                  </div>
                </div>
              ))}
            </Card>
          )
        })}
      </div>

      {/* ── INDIVIDUAL ── */}
      <SectionTitle icon="🎯">{isPT?'Recordes Individuais':'Individual Records'}</SectionTitle>

      <SubTitle color="#15803d">✅ {isPT?'Positivos — Um Jogo':'Positive — Single Game'}</SubTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {POS_GAME_KEYS.map(key=>(
          <Card key={key} title={isPT?GAME_STAT_LABELS[key].pt:GAME_STAT_LABELS[key].en} color={GAME_STAT_LABELS[key].color}>
            {(gameHighs[key]||[]).length===0 ? <Empty/> : gameHighs[key].map((r,i)=><PlayerRow key={i} r={r} signed={key==='plus_minus'} />)}
          </Card>
        ))}
      </div>

      <SubTitle color="#15803d">✅ {isPT?'Positivos — Uma Época (Totais)':'Positive — Single Season (Totals)'}</SubTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {POS_TOTAL_KEYS.map(key=>(
          <Card key={key} title={isPT?TOTAL_LABELS[key].pt:TOTAL_LABELS[key].en} color={TOTAL_LABELS[key].color}>
            {(seasonBestsTotal[key]||[]).length===0 ? <Empty/> : seasonBestsTotal[key].map((r,i)=><PlayerRow key={i} r={r} />)}
          </Card>
        ))}
      </div>

      <SubTitle color="#dc2626">❌ {isPT?'Negativos — Um Jogo':'Negative — Single Game'}</SubTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {NEG_GAME_KEYS.map(key=>(
          <Card key={key} title={isPT?GAME_STAT_LOW_LABELS[key].pt:GAME_STAT_LOW_LABELS[key].en} color={GAME_STAT_LOW_LABELS[key].color}>
            {(gameLows[key]||[]).length===0 ? <Empty/> : gameLows[key].map((r,i)=><PlayerRow key={i} r={r} />)}
          </Card>
        ))}
        <Card title={isPT?'Pior +/-':'Worst +/-'} color="#dc2626">
          {worstPlusMinus.length===0 ? <Empty/> : worstPlusMinus.map((r,i)=><PlayerRow key={i} r={r} signed />)}
        </Card>
      </div>

      <SubTitle color="#dc2626">❌ {isPT?'Negativos — Uma Época (Totais)':'Negative — Single Season (Totals)'}</SubTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {NEG_TOTAL_KEYS.map(key=>(
          <Card key={key} title={isPT?TOTAL_LOW_LABELS[key].pt:TOTAL_LOW_LABELS[key].en} color={TOTAL_LOW_LABELS[key].color}>
            {(seasonWorstTotal[key]||[]).length===0 ? <Empty/> : seasonWorstTotal[key].map((r,i)=><PlayerRow key={i} r={r} />)}
          </Card>
        ))}
      </div>

      {/* ── COLLECTIVE ── */}
      <SectionTitle icon="🏀">{isPT?'Recordes Coletivos':'Team Records'}</SectionTitle>

      <SubTitle color="#15803d">✅ {isPT?'Positivos':'Positive'}</SubTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card title={isPT?'Mais Pontos Numa Equipa (jogo)':'Most Points By a Team (game)'} color="#c2410c">
          {teamGamePts.length===0 ? <Empty/> : teamGamePts.map((r,i)=><TeamRow key={i} r={r} />)}
        </Card>
        <Card title={isPT?'Maior Margem de Vitória':'Biggest Winning Margin'} color="#166534">
          {teamGameMargin.length===0 ? <Empty/> : teamGameMargin.map((r,i)=><TeamRow key={i} r={r} marginMode />)}
        </Card>
        <Card title={isPT?'Menos Pontos Sofridos (melhor defesa)':'Fewest Points Allowed (best defense)'} color="#0e7490">
          {teamGameFewestAllowed.length===0 ? <Empty/> : teamGameFewestAllowed.map((r,i)=><TeamRow key={i} r={r} />)}
        </Card>
        <Card title={isPT?'Maior Pontuação Combinada (jogo)':'Highest Combined Score (game)'} color="#c8102e">
          {teamGameCombined.length===0 ? <Empty/> : teamGameCombined.map((r,i)=><TeamRow key={i} r={r} marginMode />)}
        </Card>
        <Card title={isPT?'Mais Triplos Convertidos Numa Equipa (jogo)':'Most 3-Pointers Made By a Team (game)'} color="#b45309">
          {teamGame3pm.length===0 ? <Empty/> : teamGame3pm.map((r,i)=><TeamRow key={i} r={r} />)}
        </Card>
        <Card title={isPT?'Maior Sequência de Vitórias':'Longest Win Streak'} color="#6d28d9">
          {longestStreak.length===0 ? <Empty/> : longestStreak.map((r,i)=><StreakRow key={i} r={r} />)}
        </Card>
      </div>

      <SubTitle color="#dc2626">❌ {isPT?'Negativos':'Negative'}</SubTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <Card title={isPT?'Menos Pontos Marcados Numa Equipa (jogo)':'Fewest Points Scored By a Team (game)'} color="#dc2626">
          {teamGameFewestScored.length===0 ? <Empty/> : teamGameFewestScored.map((r,i)=><TeamRow key={i} r={r} />)}
        </Card>
        <Card title={isPT?'Maior Margem de Derrota':'Biggest Losing Margin'} color="#991b1b">
          {teamGameBiggestLoss.length===0 ? <Empty/> : teamGameBiggestLoss.map((r,i)=><TeamRow key={i} r={r} marginMode />)}
        </Card>
        <Card title={isPT?'Mais Pontos Sofridos (pior defesa)':'Most Points Allowed (worst defense)'} color="#b91c1c">
          {teamGameMostAllowed.length===0 ? <Empty/> : teamGameMostAllowed.map((r,i)=><TeamRow key={i} r={r} />)}
        </Card>
        <Card title={isPT?'Maior Sequência de Derrotas':'Longest Losing Streak'} color="#7f1d1d">
          {longestLosingStreak.length===0 ? <Empty/> : longestLosingStreak.map((r,i)=><StreakRow key={i} r={r} />)}
        </Card>
      </div>

      </>}
    </div>
  )
}

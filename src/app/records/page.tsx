'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

type GameHigh = { pid:string, name:string, pos:string, team:string, teamColor?:string, photo?:string, value:number, gameId:string, opp:string, dateLabel:string }
type SeasonBest = { pid:string, name:string, pos:string, team:string, teamColor?:string, photo?:string, value:number, season:string }
type TeamGameRecord = { teamId:string, teamName:string, teamColor?:string, logo?:string, value:number, gameId:string, opp:string, oppScore?:number, dateLabel:string }
type TeamSeasonRecord = { teamId:string, teamName:string, teamColor?:string, logo?:string, wins:number, losses:number }

const GAME_STAT_KEYS = ['pts','reb','ast','stl','blk','tpm','ftm','plus_minus'] as const
const SEASON_TOTAL_ONLY_KEYS = ['tpm','double_doubles','triple_doubles'] as const

export default function RecordsPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [loading,setLoading] = useState(true)
  const [gameHighs,setGameHighs] = useState<Record<string,GameHigh[]>>({})
  const [seasonBestsTotal,setSeasonBestsTotal] = useState<Record<string,SeasonBest[]>>({})
  const [teamGamePts,setTeamGamePts] = useState<TeamGameRecord[]>([])
  const [teamGameMargin,setTeamGameMargin] = useState<TeamGameRecord[]>([])
  const [teamGameFewestAllowed,setTeamGameFewestAllowed] = useState<TeamGameRecord[]>([])
  const [teamGameCombined,setTeamGameCombined] = useState<TeamGameRecord[]>([])
  const [teamGame3pm,setTeamGame3pm] = useState<TeamGameRecord[]>([])
  const [teamSeasons,setTeamSeasons] = useState<TeamSeasonRecord[]>([])
  const [longestStreak,setLongestStreak] = useState<{teamId:string,teamName:string,teamColor?:string,logo?:string,streak:number}[]>([])

  useEffect(()=>{
    (async () => {
      // Supabase caps a single request at 1000 rows — this season already
      // has 655 final regular-season games and a full 82-game season would
      // exceed 1000 games total, so a plain unpaginated select would start
      // silently truncating results (missing games, not an error) right
      // around when the season is furthest along and records matter most.
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

      const regGames = await fetchAllRows('games', 'id,home_team,away_team,home_score,away_score,scheduled_date',
        q=>q.eq('status','final').eq('game_type','regular'))
      const gameById: Record<string,any> = {}
      for (const g of (regGames||[])) gameById[g.id] = g

      const { data: teamsData } = await supabase.from('teams').select('id,name,color,logo_url,wins,losses').not('id','in','(ALL,RVS,ROO,SOP)')
      const teamMap: Record<string,any> = {}
      for (const tm of (teamsData||[])) teamMap[tm.id] = tm

      // ── Individual single-game highs (record holder per stat) ──
      // Filtered via a join on games (status/game_type) instead of
      // .in('game_id', gameIds) — with 655+ games this season, passing every
      // id as a URL filter blew past PostgREST's request-size limit and
      // silently 400'd, which is exactly why every card here read "No data
      // yet" despite the season being well underway. The join scales
      // regardless of how many games have been played.
      const highsResult: Record<string,GameHigh[]> = {}
      for (const key of GAME_STAT_KEYS) {
        const { data } = await supabase.from('box_scores')
          .select(`player_id,game_id,team_id,${key},players(id,name,pos,photo_url,teams:teams!players_team_id_fkey(color)),games!inner(status,game_type)`)
          .eq('games.status','final').eq('games.game_type','regular')
          .order(key,{ascending:false}).limit(1)
        highsResult[key] = (data||[]).map((b:any) => {
          const g = gameById[b.game_id]
          const isHome = g?.home_team === b.team_id
          const oppId = g ? (isHome ? g.away_team : g.home_team) : '—'
          return {
            pid: b.players?.id, name: b.players?.name||'—', pos: b.players?.pos||'—',
            team: b.team_id, teamColor: b.players?.teams?.color, photo: b.players?.photo_url,
            value: b[key]||0, gameId: b.game_id, opp: teamMap[oppId]?.name || oppId,
            dateLabel: g?.scheduled_date || '',
          }
        })
      }
      setGameHighs(highsResult)

      // ── Team single-game records ──
      const teamGameRows: {teamId:string,score:number,oppScore:number,gameId:string,opp:string,dateLabel:string}[] = []
      for (const g of (regGames||[])) {
        teamGameRows.push({teamId:g.home_team, score:g.home_score, oppScore:g.away_score, gameId:g.id, opp:teamMap[g.away_team]?.name||g.away_team, dateLabel:g.scheduled_date})
        teamGameRows.push({teamId:g.away_team, score:g.away_score, oppScore:g.home_score, gameId:g.id, opp:teamMap[g.home_team]?.name||g.home_team, dateLabel:g.scheduled_date})
      }
      const topScores = [...teamGameRows].sort((a,b)=>b.score-a.score).slice(0,1).map(r=>({
        teamId:r.teamId, teamName:teamMap[r.teamId]?.name||r.teamId, teamColor:teamMap[r.teamId]?.color, logo:teamMap[r.teamId]?.logo_url,
        value:r.score, gameId:r.gameId, opp:r.opp, oppScore:r.oppScore, dateLabel:r.dateLabel,
      }))
      setTeamGamePts(topScores)
      const topMargins = [...teamGameRows].filter(r=>r.score>r.oppScore).sort((a,b)=>(b.score-b.oppScore)-(a.score-a.oppScore)).slice(0,1).map(r=>({
        teamId:r.teamId, teamName:teamMap[r.teamId]?.name||r.teamId, teamColor:teamMap[r.teamId]?.color, logo:teamMap[r.teamId]?.logo_url,
        value:r.score-r.oppScore, gameId:r.gameId, opp:r.opp, oppScore:r.oppScore, dateLabel:r.dateLabel,
      }))
      setTeamGameMargin(topMargins)
      const fewestAllowed = [...teamGameRows].sort((a,b)=>a.oppScore-b.oppScore).slice(0,1).map(r=>({
        teamId:r.teamId, teamName:teamMap[r.teamId]?.name||r.teamId, teamColor:teamMap[r.teamId]?.color, logo:teamMap[r.teamId]?.logo_url,
        value:r.oppScore, gameId:r.gameId, opp:r.opp, oppScore:r.score, dateLabel:r.dateLabel,
      }))
      setTeamGameFewestAllowed(fewestAllowed)
      const combinedRows = (regGames||[]).map((g:any)=>({
        teamId:g.home_team, score:g.home_score+g.away_score, gameId:g.id, opp:teamMap[g.away_team]?.name||g.away_team, dateLabel:g.scheduled_date,
      }))
      const topCombined = [...combinedRows].sort((a,b)=>b.score-a.score).slice(0,1).map(r=>({
        teamId:r.teamId, teamName:teamMap[r.teamId]?.name||r.teamId, teamColor:teamMap[r.teamId]?.color, logo:teamMap[r.teamId]?.logo_url,
        value:r.score, gameId:r.gameId, opp:r.opp, dateLabel:r.dateLabel,
      }))
      setTeamGameCombined(topCombined)

      // ── Most 3-pointers made BY A TEAM in a single game — box_scores has
      // no per-team-per-game total, so this sums each player's tpm grouped
      // by (game_id, team_id) client-side. Needs every row (17,900+ already
      // this season), hence fetchAllRows rather than a single request.
      const allTpmBoxes = await fetchAllRows('box_scores', 'game_id,team_id,tpm,games!inner(status,game_type)',
        q=>q.eq('games.status','final').eq('games.game_type','regular'))
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
      const top3pmTeam = [...team3pmRows].sort((a,b)=>b.value-a.value).slice(0,1).map(r=>({
        teamId:r.teamId, teamName:teamMap[r.teamId]?.name||r.teamId, teamColor:teamMap[r.teamId]?.color, logo:teamMap[r.teamId]?.logo_url,
        value:r.value, gameId:r.gameId, opp:r.opp, dateLabel:r.dateLabel,
      }))
      setTeamGame3pm(top3pmTeam)

      // ── Longest win streak ever, per team — same reversed-chronological
      // scan as the homepage Hot Streak card, but tracking the BEST streak
      // reached during the scan instead of just the one still active at the
      // end, since a record book cares about a team's best-ever run, not
      // necessarily their current form.
      const chronoGames = [...(regGames||[])].sort((a:any,b:any)=>(a.scheduled_date||'').localeCompare(b.scheduled_date||''))
      const curStreak: Record<string,number> = {}
      const bestStreak: Record<string,number> = {}
      for (const g of chronoGames) {
        const hw = (g.home_score||0) > (g.away_score||0)
        const wt = hw?g.home_team:g.away_team
        const lt = hw?g.away_team:g.home_team
        curStreak[wt] = (curStreak[wt]||0)+1
        curStreak[lt] = 0
        bestStreak[wt] = Math.max(bestStreak[wt]||0, curStreak[wt])
      }
      const streakList = Object.entries(bestStreak).sort((a,b)=>b[1]-a[1]).slice(0,1).map(([teamId,streak])=>({
        teamId, teamName:teamMap[teamId]?.name||teamId, teamColor:teamMap[teamId]?.color, logo:teamMap[teamId]?.logo_url, streak,
      }))
      setLongestStreak(streakList)

      // ── Best team season (by win%) ──
      const seasonTeams = (teamsData||[]).map((tm:any)=>({
        teamId:tm.id, teamName:tm.name, teamColor:tm.color, logo:tm.logo_url, wins:tm.wins||0, losses:tm.losses||0,
      })).filter((tm:any)=>tm.wins+tm.losses>0).sort((a:any,b:any)=> (b.wins/(b.wins+b.losses)) - (a.wins/(a.wins+a.losses))).slice(0,1)
      setTeamSeasons(seasonTeams)

      // ── Individual season bests (raw totals — pts/reb/ast/stl/blk plus
      // tpm/double_doubles/triple_doubles, no per-game average) ──
      const { data: statsRows } = await supabase.from('player_stats')
        .select('player_id,team_id,season,games,pts,reb,ast,stl,blk,tpm,tpa,fgm,fga,ftm,fta,double_doubles,triple_doubles,players(id,name,pos,photo_url,teams:teams!players_team_id_fkey(color))')
        .gt('games',0)
      const AVG_KEYS = ['pts','reb','ast','stl','blk'] as const
      const totalResult: Record<string,SeasonBest[]> = {}
      for (const key of [...AVG_KEYS, ...SEASON_TOTAL_ONLY_KEYS]) {
        totalResult[key] = [...(statsRows||[])].sort((a:any,b:any)=>(b[key]||0)-(a[key]||0)).slice(0,1).map((s:any)=>({
          pid:s.players?.id, name:s.players?.name||'—', pos:s.players?.pos||'—', team:s.team_id,
          teamColor:s.players?.teams?.color, photo:s.players?.photo_url, value:s[key]||0, season:s.season,
        }))
      }
      setSeasonBestsTotal(totalResult)

      setLoading(false)
    })()
  },[])

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

  const SectionTitle = ({icon,children}:{icon:string,children:React.ReactNode}) => (
    <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{color:'#1a1512'}}>
      <span>{icon}</span>{children}
    </h2>
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

  const Card = ({title,color,children}:{title:string,color:string,children:React.ReactNode}) => (
    <div className="rounded-xl overflow-hidden" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
      <div className="px-4 py-3" style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
        <h3 className="font-bold text-sm" style={{color}}>{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  )

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-12 text-center" style={{color:'#8a8279'}}>{t('common.loading')}</div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2" style={{color:'#1a1512'}}>🏆 {isPT?'Recordes':'Records'} — 2025-26</h1>
      <p className="text-xs mb-8" style={{color:'#8a8279'}}>
        {isPT
          ? 'Todos os recordes desta época e all-time (por agora, esta é a única época jogada, por isso os números coincidem).'
          : "All records for this season and all-time (right now this is the only season played, so the numbers match)."}
      </p>

      <SectionTitle icon="🎯">{isPT?'Recordes Individuais — Um Jogo':'Individual Records — Single Game'}</SectionTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {GAME_STAT_KEYS.map(key=>(
          <Card key={key} title={isPT?GAME_STAT_LABELS[key].pt:GAME_STAT_LABELS[key].en} color={GAME_STAT_LABELS[key].color}>
            {(gameHighs[key]||[]).length===0
              ? <div className="p-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Sem dados ainda':'No data yet'}</div>
              : gameHighs[key].map((r,i)=><PlayerRow key={i} r={r} signed={key==='plus_minus'} />)}
          </Card>
        ))}
      </div>

      <SectionTitle icon="📦">{isPT?'Recordes Individuais — Uma Época (Totais)':'Individual Records — Single Season (Totals)'}</SectionTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {Object.keys(TOTAL_LABELS).map(key=>(
          <Card key={key} title={isPT?TOTAL_LABELS[key].pt:TOTAL_LABELS[key].en} color={TOTAL_LABELS[key].color}>
            {(seasonBestsTotal[key]||[]).length===0
              ? <div className="p-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Sem dados ainda':'No data yet'}</div>
              : seasonBestsTotal[key].map((r,i)=><PlayerRow key={i} r={r} />)}
          </Card>
        ))}
      </div>

      <SectionTitle icon="🏀">{isPT?'Recordes Coletivos':'Team Records'}</SectionTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <Card title={isPT?'Mais Pontos Numa Equipa (jogo)':'Most Points By a Team (game)'} color="#c2410c">
          {teamGamePts.length===0
            ? <div className="p-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Sem dados ainda':'No data yet'}</div>
            : teamGamePts.map((r,i)=><TeamRow key={i} r={r} />)}
        </Card>
        <Card title={isPT?'Maior Margem de Vitória':'Biggest Winning Margin'} color="#166534">
          {teamGameMargin.length===0
            ? <div className="p-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Sem dados ainda':'No data yet'}</div>
            : teamGameMargin.map((r,i)=><TeamRow key={i} r={r} marginMode />)}
        </Card>
        <Card title={isPT?'Menos Pontos Sofridos (melhor defesa)':'Fewest Points Allowed (best defense)'} color="#0e7490">
          {teamGameFewestAllowed.length===0
            ? <div className="p-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Sem dados ainda':'No data yet'}</div>
            : teamGameFewestAllowed.map((r,i)=><TeamRow key={i} r={r} />)}
        </Card>
        <Card title={isPT?'Maior Pontuação Combinada (jogo)':'Highest Combined Score (game)'} color="#c8102e">
          {teamGameCombined.length===0
            ? <div className="p-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Sem dados ainda':'No data yet'}</div>
            : teamGameCombined.map((r,i)=><TeamRow key={i} r={r} marginMode />)}
        </Card>
        <Card title={isPT?'Mais Triplos Convertidos Numa Equipa (jogo)':'Most 3-Pointers Made By a Team (game)'} color="#b45309">
          {teamGame3pm.length===0
            ? <div className="p-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Sem dados ainda':'No data yet'}</div>
            : teamGame3pm.map((r,i)=><TeamRow key={i} r={r} />)}
        </Card>
        <Card title={isPT?'Maior Sequência de Vitórias (all-time)':'Longest Win Streak (all-time)'} color="#6d28d9">
          {longestStreak.length===0
            ? <div className="p-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Sem dados ainda':'No data yet'}</div>
            : longestStreak.map((r)=>{
              const tc = readableTeamColor(r.teamColor||'555')
              return (
                <Link key={r.teamId} href={`/team/${r.teamId}`} className="no-underline">
                  <div className="flex items-center gap-3 px-4 py-3 hover:brightness-110 transition-all">
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{background:tc+'22'}}>
                      {r.logo?<img src={r.logo} alt="" className="w-full h-full object-contain p-1.5"/>:<span className="text-sm font-black" style={{color:tc}}>{r.teamId}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{color:'#1a1512'}}>{r.teamName}</div>
                    </div>
                    <span className="text-lg font-black flex-shrink-0" style={{color:'#1a1512'}}>{r.streak} {isPT?'jogos':'games'}</span>
                  </div>
                </Link>
              )
            })}
        </Card>
      </div>

      <SectionTitle icon="👑">{isPT?'Melhor Registo de Época':'Best Season Record'}</SectionTitle>
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <Card title={isPT?'Melhor % de Vitórias':'Best Win %'} color="#0e7490">
          {teamSeasons.length===0
            ? <div className="p-4 text-xs text-center" style={{color:'#8a8279'}}>{isPT?'Sem dados ainda':'No data yet'}</div>
            : teamSeasons.map((r)=>{
              const tc = readableTeamColor(r.teamColor||'555')
              const pct = r.wins+r.losses>0 ? (r.wins/(r.wins+r.losses)).toFixed(3).replace(/^0/,'') : '.000'
              return (
                <Link key={r.teamId} href={`/team/${r.teamId}`} className="no-underline">
                  <div className="flex items-center gap-3 px-4 py-3 hover:brightness-110 transition-all">
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{background:tc+'22'}}>
                      {r.logo?<img src={r.logo} alt="" className="w-full h-full object-contain p-1.5"/>:<span className="text-sm font-black" style={{color:tc}}>{r.teamId}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{color:'#1a1512'}}>{r.teamName}</div>
                      <div className="text-xs" style={{color:'#6b5f4e'}}>{r.wins}-{r.losses}</div>
                    </div>
                    <span className="text-lg font-black flex-shrink-0" style={{color:'#1a1512'}}>{pct}</span>
                  </div>
                </Link>
              )
            })}
        </Card>
      </div>
    </div>
  )
}

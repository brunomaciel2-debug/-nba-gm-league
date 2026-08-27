'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'

// useSearchParams() (needed for the ?date= deep link from SimulatorBanner)
// forces Next.js to bail out of static prerendering for whatever reads it —
// without a Suspense boundary around that part, the build fails outright
// ("useSearchParams() should be wrapped in a suspense boundary"). The actual
// page content lives in ScheduleContent below; this default export just
// supplies the boundary.
export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-12 text-center" style={{color:'#8a8279'}}>Loading...</div>}>
      <ScheduleContent />
    </Suspense>
  )
}

function ScheduleContent() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const searchParams = useSearchParams()
  // Set by SimulatorBanner's "Now" link (?date=YYYY-MM-DD) so a GM lands
  // straight on today's games instead of having to scroll/hunt for them.
  // Arriving here any other way (the plain "Schedule" nav item) had no such
  // param at all — every visit silently landed on the very first
  // Pre-Season game, months before "now", forcing a long scroll every
  // single time. autoToday is the same "last_sim_day + 1" computation
  // SimulatorBanner's own pill uses, fetched here as a fallback so the page
  // lands on today's games regardless of how it was reached.
  const jumpToDateParam = searchParams.get('date')
  const [autoToday,setAutoToday]=useState<string|null>(null)
  const jumpToDate = jumpToDateParam || autoToday
  const [games,setGames]=useState<any[]>([])
  const [teamMap,setTeamMap]=useState<Record<string,any>>({})
  const [worldTeamIds,setWorldTeamIds]=useState<Set<string>>(new Set())
  const [loading,setLoading]=useState(true)

  const GAME_TYPE_LABEL_EN: Record<string,{label:string,bg:string,color:string}> = {
    preseason: {label:'Pre-Season',    bg:'#f0f9ff',color:'#0369a1'},
    regular:   {label:'Regular Season',bg:'#f0fdf4',color:'#15803d'},
    playoff:   {label:'Playoffs',      bg:'#fef2f2',color:'#dc2626'},
    allstar:      {label:'All-Star',      bg:'#fef9c3',color:'#b45309'},
    rising_stars: {label:'Rising Stars',  bg:'#ecfdf5',color:'#0d9488'},
  }
  const GAME_TYPE_LABEL_PT: Record<string,{label:string,bg:string,color:string}> = {
    preseason: {label:'Pré-Época',     bg:'#f0f9ff',color:'#0369a1'},
    regular:   {label:'Época Regular', bg:'#f0fdf4',color:'#15803d'},
    playoff:   {label:'Playoffs',      bg:'#fef2f2',color:'#dc2626'},
    allstar:      {label:'All-Star',      bg:'#fef9c3',color:'#b45309'},
    rising_stars: {label:'Rising Stars',  bg:'#ecfdf5',color:'#0d9488'},
  }
  const GAME_TYPE_LABEL = isPT ? GAME_TYPE_LABEL_PT : GAME_TYPE_LABEL_EN

  // Fixed per-round calendar, mirroring computeNextGameDate in
  // src/lib/playoff-resolver.ts — kept in sync there and here rather than
  // shared, since the backend only computes/caches a series' next_game_date
  // once BOTH its teams are known (it has a real game to actually book).
  // This page needs the date to show up EARLIER than that, the moment the
  // round itself starts, with the still-undecided side rendered as TBD —
  // exactly the gap Bruno flagged: the schedule had nothing at all for a
  // series whose participants weren't determined yet.
  const addDaysLocal=(dateStr:string,days:number)=>{
    const d=new Date(dateStr+'T12:00:00'); d.setDate(d.getDate()+days)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  const roundEventKeyFor=(seriesType:string):string|null=>{
    if(seriesType.startsWith('r1_'))return 'playoffs_r1'
    if(seriesType.startsWith('r2_'))return 'playoffs_semis'
    if(seriesType.startsWith('conf_final_'))return 'playoffs_conf_finals'
    if(seriesType==='nba_finals')return 'nba_finals'
    return null
  }
  const SERIES_LABEL_EN: Record<string,string> = {
    r2_eastern_a:'East Semifinal A', r2_eastern_b:'East Semifinal B',
    r2_western_a:'West Semifinal A', r2_western_b:'West Semifinal B',
    conf_final_eastern:'Eastern Conference Finals', conf_final_western:'Western Conference Finals',
    nba_finals:'NBA Finals',
  }
  const SERIES_LABEL_PT: Record<string,string> = {
    r2_eastern_a:'Meia-Final Este A', r2_eastern_b:'Meia-Final Este B',
    r2_western_a:'Meia-Final Oeste A', r2_western_b:'Meia-Final Oeste B',
    conf_final_eastern:'Final da Conferência Este', conf_final_western:'Final da Conferência Oeste',
    nba_finals:'Finais da NBA',
  }

  useEffect(()=>{
    Promise.all([
      supabase.from('games').select('*').order('played_at').order('game_number').range(0,699),
      supabase.from('games').select('*').order('played_at').order('game_number').range(700,1299),
      supabase.from('teams').select('id,name,color,logo_url'),
      supabase.from('preseason_games').select('*').eq('season','2025-26'),
      supabase.from('season_config').select('last_sim_day').eq('id',1).single(),
      supabase.from('playoff_series').select('*').eq('season','2025-26').neq('status','completed'),
      supabase.from('season_events').select('event_key,start_date').eq('season','2025-26'),
    ]).then(([{data:g1},{data:g2},{data:teams}, {data:preseason}, {data:cfg}, {data:series}, {data:events}])=>{
      if (cfg?.last_sim_day) {
        const d = new Date(cfg.last_sim_day+'T00:00:00')
        d.setDate(d.getDate()+1)
        setAutoToday(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
      }
      // A preseason_games row for an NBA-vs-NBA friendly gets its own real
      // `games` row once simulated (game_id points to it) — that real row is
      // already in g1/g2, so re-adding a synthetic entry for the same game
      // here would show it twice. Only World-team friendlies (which can
      // never get a real `games` row — see preseason-simulator.ts) need a
      // synthetic entry; keep their box score inline since there's no
      // /game/[id] page for them to link to.
      const realGameIds = new Set([...(g1||[]),...(g2||[])].map((g:any)=>g.id))
      const normalizedPreseason = (preseason||[])
        .filter((g:any)=>['scheduled','accepted','final'].includes(g.status) && !(g.game_id && realGameIds.has(g.game_id)))
        .map((g:any)=>({
          id: g.id,
          week_number: 0, game_number: 0,
          home_team: g.home_team, away_team: g.away_team,
          home_score: g.home_score || null, away_score: g.away_score || null,
          status: g.status==='final' ? 'final' : 'scheduled',
          played_at: g.scheduled_date ? g.scheduled_date+'T12:00:00' : null,
          game_type: 'preseason',
          box_score: g.box_score || null,
          isWorldFriendly: true,
        }))
      // Playoff series whose participants aren't fully known yet (still
      // waiting on Play-In or an earlier round) never get a real `games`
      // row — the resolver only books one once it actually has two teams
      // to schedule. Synthesize a TBD placeholder instead, using the exact
      // same fixed per-round calendar the resolver itself computes (see
      // computeNextGameDate in playoff-resolver.ts): the date is known and
      // real the moment the round starts, even before the matchup is.
      const eventMap = Object.fromEntries((events||[]).map((e:any)=>[e.event_key,e.start_date]))
      const normalizedSeries = (series||[])
        .filter((s:any)=> !s.team_high || !s.team_low)
        .map((s:any)=>{
          let date: string|null = null
          if (s.series_type?.startsWith('playin_a_') || s.series_type?.startsWith('playin_b_')) {
            date = eventMap['play_in'] || null
          } else if (s.series_type?.startsWith('playin_c_')) {
            date = eventMap['play_in'] ? addDaysLocal(eventMap['play_in'],1) : null
          } else {
            const key = roundEventKeyFor(s.series_type)
            date = key && eventMap[key] ? eventMap[key] : null
          }
          if (!date) return null
          const label = isPT ? SERIES_LABEL_PT[s.series_type] : SERIES_LABEL_EN[s.series_type]
          return {
            id: `series-${s.id}`,
            week_number: 0, game_number: 0,
            home_team: s.team_high || null, away_team: s.team_low || null,
            home_score: null, away_score: null,
            status: 'scheduled',
            played_at: `${date}T12:00:00`,
            game_type: 'playoff',
            seriesLabel: label,
          }
        })
        .filter(Boolean)
      setGames([...(g1||[]),...(g2||[]),...normalizedPreseason,...normalizedSeries])
      setTeamMap(Object.fromEntries((teams||[]).map((t:any)=>[t.id,t])))

      const missingIds = Array.from(new Set(normalizedPreseason.flatMap((g:any)=>[g.home_team,g.away_team])
        .filter((id:string)=>id && !(teams||[]).some((t:any)=>t.id===id))))
      if (missingIds.length>0) {
        supabase.from('world_teams').select('id,name,color,logo_url').in('id',missingIds).then(({data:wt})=>{
          setTeamMap(prev=>({...prev, ...Object.fromEntries((wt||[]).map((t:any)=>[t.id,t]))}))
          setWorldTeamIds(new Set(missingIds))
        })
      }
      setLoading(false)
    })
  },[])

  // Prefer scheduled_date (the intended real-world calendar date) over
  // played_at (the moment someone actually clicked Simulate) — a friendly's
  // `games` row previously had no scheduled_date at all, so it fell back to
  // played_at and could land in a completely different month than the date
  // shown on the Pre-Season page for the exact same game.
  const dateOf=(g:any)=>g.scheduled_date?new Date(g.scheduled_date+'T12:00:00'):(g.played_at?new Date(g.played_at):null)
  const byMonth: Record<string,any[]> = {}
  // `new Date("outubro de 2025")` can't be parsed back — the JS Date
  // constructor only understands English month names, so sorting the
  // localized PT month labels directly silently broke (Invalid Date -> NaN
  // -> the comparator never actually reorders anything), and in PT mode the
  // months rendered in whatever order they first appeared instead of
  // chronologically. Tracked here as a separate, locale-independent sort
  // key (first-of-month timestamp) alongside the display label.
  const monthSortKey: Record<string,number> = {}
  games.forEach(g=>{
    const d=dateOf(g)
    const key=d?d.toLocaleDateString(isPT?'pt-PT':'en-US',{month:'long',year:'numeric'}):'TBD'
    if(!byMonth[key]){byMonth[key]=[]; monthSortKey[key]=d?new Date(d.getFullYear(),d.getMonth(),1).getTime():Infinity}
    byMonth[key].push(g)
  })
  // Games arrive from the DB ordered by `played_at` (null for anything not
  // yet simulated) with World-friendly entries appended separately at the
  // end — neither matches the intended calendar order, so each month's
  // games must be explicitly re-sorted by their real scheduled date before
  // rendering, or games within the same month show up in a near-random order.
  Object.keys(byMonth).forEach(key=>{
    byMonth[key].sort((a,b)=>(dateOf(a)?.getTime()||0)-(dateOf(b)?.getTime()||0))
  })
  const sortedMonths=Object.keys(byMonth).sort((a,b)=>{if(a==='TBD')return 1;if(b==='TBD')return -1;return monthSortKey[a]-monthSortKey[b]})
  const played=games.filter(g=>g.status==='final').length

  const fmtDate=(iso:string)=>new Date(iso).toLocaleDateString(isPT?'pt-PT':'en-US',{weekday:'short',month:'short',day:'numeric'})
  const ymd=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  // Which game id is the FIRST one on its calendar date — that row gets the
  // `date-YYYY-MM-DD` anchor SimulatorBanner's "Now" link jumps to. Only one
  // id per date, even though several games share it, so scrollIntoView has
  // exactly one unambiguous target.
  const firstGameIdOfDate: Record<string,string> = {}
  games.forEach(g=>{
    const d=dateOf(g)
    if(!d)return
    const key=ymd(d)
    if(!(key in firstGameIdOfDate))firstGameIdOfDate[key]=g.id
  })
  // Earliest date with a still-'scheduled' (not yet decided) game — used
  // below to prefer landing there over the plain "closest date to today"
  // pick. Real incident this fixes: a batch of Play-In games got booked
  // across a couple of different due-dates a day or two apart (each
  // team's own regular season had wrapped up on a slightly different
  // day), and "closest to today" landed on the LATEST of those dates —
  // leaving an earlier, equally-upcoming game sitting just above the fold,
  // invisible unless you happened to scroll up past the landing point.
  const earliestUpcomingDate = Object.keys(firstGameIdOfDate)
    .filter(k=>games.find((g:any)=>g.id===firstGameIdOfDate[k])?.status!=='final')
    .sort()[0]

  // Runs once the page has finished loading AND rendered the games list —
  // the target row's id doesn't exist in the DOM until then. If the exact
  // date has no games (a real "rest day" in the day-yes-day-no schedule),
  // falls back to the closest upcoming game date instead of silently doing
  // nothing — landing near "today" beats landing nowhere.
  useEffect(()=>{
    if (loading || !jumpToDate) return
    let target = jumpToDate
    if (!(target in firstGameIdOfDate)) {
      // Any still-undecided game takes priority over the plain "closest
      // date to today" pick — it's exactly what "what's coming up" means,
      // even if it's dated a day or two before today's exact date (see
      // earliestUpcomingDate above for the real incident this covers).
      const next = Object.keys(firstGameIdOfDate).filter(k=>k>=jumpToDate).sort()[0]
      const prev = Object.keys(firstGameIdOfDate).filter(k=>k<jumpToDate).sort().pop()
      target = earliestUpcomingDate || next || prev || target
    }
    // 'auto' (instant), not 'smooth' — a real incident found while testing
    // this exact jump: smooth scrollIntoView silently never actually moved
    // the page in at least one real browser context, leaving the visit
    // sitting at the very top of the whole season with no visible sign
    // anything was even attempted. An instant jump has no such failure mode.
    document.getElementById(`date-${target}`)?.scrollIntoView({ behavior:'auto', block:'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loading, jumpToDate, games.length])

  if(loading) return <div className="max-w-5xl mx-auto px-4 py-12 text-center" style={{color:'#8a8279'}}>{t('common.loading')}</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{color:'#1a1512'}}>📅 {isPT?'Calendário & Resultados':'Schedule & Results'} — 2025-26</h1>
          <p className="text-sm" style={{color:'#8a8279'}}>
            {played} {isPT?'jogados':'played'} · {games.length-played} {isPT?'restantes':'remaining'} · {games.length} {isPT?'total':'total'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(GAME_TYPE_LABEL).map(([key,val])=>(
            <span key={key} className="text-xs font-semibold px-2 py-0.5 rounded" style={{background:val.bg,color:val.color}}>{val.label}</span>
          ))}
        </div>
      </div>

      {sortedMonths.length===0?(
        <div className="rounded-xl p-8 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <p style={{color:'#6b5f4e'}}>{isPT?'O calendário aparecerá aqui quando a época começar.':'Schedule will appear here once the season begins.'}</p>
        </div>
      ):sortedMonths.map(month=>(
        <div key={month} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{color:'#b45309',letterSpacing:'1.5px'}}>{month}</span>
            <div className="flex-1 h-px" style={{background:'#d4cdc5'}}/>
            <span className="text-xs" style={{color:'#8a8279'}}>{byMonth[month].length} {isPT?`jogo${byMonth[month].length!==1?'s':''}`:`game${byMonth[month].length!==1?'s':''}`}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {byMonth[month].map((g:any)=>{
              const home=teamMap[g.home_team]; const away=teamMap[g.away_team]
              const isFinal=g.status==='final'
              const winner=isFinal?((g.home_score||0)>(g.away_score||0)?'home':'away'):null
              const homeColor=home?readableTeamColor(home.color):'#5c554e'
              const awayColor=away?readableTeamColor(away.color):'#5c554e'
              const typeInfo=GAME_TYPE_LABEL[g.game_type||'regular']||GAME_TYPE_LABEL.regular
              const gDate=dateOf(g)
              const hasBoxScore=isFinal&&g.isWorldFriendly&&g.box_score
              const dateAnchor=gDate&&firstGameIdOfDate[ymd(gDate)]===g.id?`date-${ymd(gDate)}`:undefined
              return(
                <div key={g.id} id={dateAnchor} className="px-4 py-2.5 rounded-xl" style={{background:'#faf8f5',border:'1px solid #e2dcd5',scrollMarginTop:90}}>
                  <div className="flex items-center gap-3">
                    <div className="w-36 flex-shrink-0">
                      <div className="text-xs font-bold" style={{color:'#1a1512'}}>{gDate?fmtDate(gDate.toISOString()):'TBD'}</div>
                      {g.week_number>0&&<div className="text-xs" style={{color:'#8a8279'}}>{isPT?'Sem':'Wk'} {g.week_number}</div>}
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{background:typeInfo.bg,color:typeInfo.color,fontSize:10}}>{typeInfo.label}</span>
                    <div className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
                      {g.home_team?(
                        <>
                          {home?.logo_url&&<img src={home.logo_url} alt="" className="w-5 h-5 object-contain flex-shrink-0"/>}
                          <Link href={worldTeamIds.has(g.home_team)?`/world/${g.home_team}`:`/team/${g.home_team}`} className="text-sm font-semibold no-underline hover:underline" style={{color:winner==='away'?'#8a8279':homeColor}}>{home?.name||g.home_team}</Link>
                        </>
                      ):<span className="text-sm font-semibold" style={{color:'#9c9088'}}>TBD</span>}
                      {isFinal?<span className="font-black text-sm mx-1" style={{color:'#1a1512'}}>{g.home_score}–{g.away_score}</span>:<span className="text-xs mx-1" style={{color:'#8a8279'}}>vs</span>}
                      {g.away_team?(
                        <>
                          {away?.logo_url&&<img src={away.logo_url} alt="" className="w-5 h-5 object-contain flex-shrink-0"/>}
                          <Link href={worldTeamIds.has(g.away_team)?`/world/${g.away_team}`:`/team/${g.away_team}`} className="text-sm font-semibold no-underline hover:underline" style={{color:winner==='home'?'#8a8279':awayColor}}>{away?.name||g.away_team}</Link>
                        </>
                      ):<span className="text-sm font-semibold" style={{color:'#9c9088'}}>TBD</span>}
                      {g.seriesLabel&&<span className="text-xs" style={{color:'#8a8279'}}>({g.seriesLabel})</span>}
                    </div>
                    {isFinal
                      ?(g.isWorldFriendly
                        ?(hasBoxScore
                          ?<Link href={`/game/friendly/${g.id}`} className="text-xs no-underline px-2 py-1 rounded flex-shrink-0" style={{background:'#e8e2d6',color:'#1d4ed8'}}>{isPT?'Box Score →':'Box Score →'}</Link>
                          :<span className="text-xs flex-shrink-0" style={{color:'#8a8279'}}>{isPT?'Final':'Final'}</span>)
                        :<Link href={`/game/${g.id}`} className="text-xs no-underline px-2 py-1 rounded flex-shrink-0" style={{background:'#e8e2d6',color:'#1d4ed8'}}>{isPT?'Box Score →':'Box Score →'}</Link>)
                      :<span className="text-xs flex-shrink-0" style={{color:'#8a8279'}}>{isPT?'Agendado':'Scheduled'}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

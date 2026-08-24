'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'
import { VOTING_OPENS_WEEK, VOTING_CLOSES_WEEK, ALLSTAR_WEEK, minGamesByWeek, expectedGamesByWeek } from '@/lib/allstar-constants'
import { formatWeekRange, getWeekForDate } from '@/lib/season-week-helper'
import { fetchAllRows } from '@/lib/paginate'

const POSITIONS = ['PG','SG','SF','PF','C']
const CONFS = ['Eastern','Western']
const STAT_CATS = ['pts','reb','ast','stl','blk'] as const
const STAT_SUFFIX: Record<string,string> = { pts:'ppg', reb:'rpg', ast:'apg', stl:'spg', blk:'bpg' }
// Extra raw counting stats (beyond the 5 shown on the card) needed only to
// compute Game Score below.
const GMSC_EXTRA_CATS = ['fgm','fga','ftm','fta','off_reb','def_reb','pf','turnovers'] as const
// Bruno's explicit spec: guards/wings always lead with scoring + playmaking
// (their two "wow" numbers), bigs lead with scoring + rebounding — a
// relative "whichever stat ranks highest" pick (like the first version of
// this used for both slots) could surface something unimpressive, like
// Cade Cunningham's rebounds/steals, ahead of his actual scoring/assists.
// Only the 3rd slot is picked dynamically, from the remaining categories.
const ALWAYS_STAT_CATS: Record<string,readonly string[]> = {
  PG: ['pts','ast'], SG: ['pts','ast'], SF: ['pts','ast'],
  PF: ['pts','reb'], C: ['pts','reb'],
}
const CANDIDATE_STAT_CATS: Record<string,readonly string[]> = {
  PG: ['reb','stl','blk'], SG: ['reb','stl','blk'], SF: ['reb','stl','blk'],
  PF: ['ast','stl','blk'], C: ['ast','stl','blk'],
}

export default function AllStarPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [ready,   setReady]   = useState(false)
  const [players, setPlayers] = useState<any[]>([])
  const [teams,   setTeams]   = useState<Record<string,any>>({})
  const [curWeek, setCurWeek] = useState(0)
  const [votes,   setVotes]   = useState<Record<string,Record<string,string[]>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [gmTeam,    setGmTeam]    = useState('')
  const [teamAutoDetected, setTeamAutoDetected] = useState(false)
  const [tab,       setTab]       = useState<'vote'|'results'>('vote')
  const [roster,    setRoster]    = useState<any[]>([])
  const [voteOpenDate, setVoteOpenDate] = useState<string|null>(null)

  const VOTING_OPENS  = VOTING_OPENS_WEEK
  const VOTING_CLOSES = VOTING_CLOSES_WEEK
  const locale = isPT ? 'pt-PT' : 'en-US'
  // Prefer the exact date already shown site-wide (navbar's "Next event")
  // over the coarser VOTING_OPENS_WEEK date range, so this page never gives
  // a different answer to "when does voting open" than the rest of the site.
  const voteOpenLabel = voteOpenDate
    ? new Date(voteOpenDate+'T12:00:00').toLocaleDateString(locale,{month:'short',day:'numeric'})
    : formatWeekRange(VOTING_OPENS,locale)

  useEffect(() => {
    const load = async () => {
      try {
        const [r1,r2,r3,r4,r5] = await Promise.allSettled([
          // player_stats has one row per season — without this filter a
          // veteran's player_stats?.[0] below can grab a stale, all-null
          // past season instead of the current one.
          // Paginated fetch is required — there are 1163 active players,
          // and PostgREST hard-caps EVERY request at 1000 rows regardless
          // of the requested range (a single .range(0, 2999) still only
          // returns rows 0-999) — see src/lib/paginate.ts. That silently
          // dropped ~160 real players from every position pool (real
          // example: LaMelo Ball and Derrick White both missing from the
          // PG pool while lower-scoring players still showed up).
          fetchAllRows((from,to)=>supabase.from('players').select('id,name,pos,team_id,photo_url,status,player_stats(games,pts,reb,ast,stl,blk,fgm,fga,ftm,fta,off_reb,def_reb,pf,turnovers)').eq('status','active').eq('player_stats.season','2025-26').range(from,to)).then(data=>({data})),
          supabase.from('teams').select('id,name,conference,color,logo_url').not('id','in','(ALL,RVS,ROO,SOP)'),
          // current_week only advances once a WHOLE week (both halves) is
          // done — mid-week it still reads last week's number, which made
          // this page show "Current: Jan 9-15" while the navbar's "Now"
          // (last_sim_day + 1) already read Jan 18. last_sim_day is the
          // same source the navbar uses, so deriving curWeek from it here
          // keeps both readouts in agreement.
          supabase.from('season_config').select('last_sim_day').eq('id',1).single(),
          // is_injured rows are historical markers (the original pick who
          // got hurt) — the row for who actually took his spot is a
          // separate, non-injured row already in this same result set, so
          // rendering both doubled every replaced player onto the roster
          // (found live: Eastern showed 7 "starters" and 16 total instead
          // of 5 + 12, exactly the count of injured markers still included).
          supabase.from('allstar_roster').select('*, players!allstar_roster_player_id_fkey(name,pos,photo_url,team_id)').eq('season','2025-26').eq('is_injured',false),
          // The exact real-world open date the navbar's "Next event" pill
          // shows (e.g. "Jan 19") — VOTING_OPENS_WEEK's week-math lands on
          // the Monday that week starts (Jan 16), a few days off from this,
          // which read as two different answers to "when does voting open."
          // Showing this same date here instead keeps the site consistent.
          supabase.from('season_events').select('start_date').eq('season','2025-26').eq('event_key','allstar_vote').maybeSingle(),
        ])
        if(r1.status==='fulfilled'&&r1.value.data)setPlayers(r1.value.data)
        if(r2.status==='fulfilled'&&r2.value.data)setTeams(Object.fromEntries(r2.value.data.map((t:any)=>[t.id,t])))
        if(r3.status==='fulfilled'&&r3.value.data){
          const lastSimDay=(r3.value.data as any).last_sim_day
          if(lastSimDay){
            const d=new Date(lastSimDay+'T12:00:00')
            d.setDate(d.getDate()+1)
            const ymd=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
            setCurWeek(getWeekForDate(ymd))
          }
        }
        if(r4.status==='fulfilled'&&r4.value.data)setRoster(r4.value.data)
        if(r5.status==='fulfilled'&&r5.value.data)setVoteOpenDate((r5.value.data as any).start_date)
      } catch(e){console.error(e)}
      setReady(true)
    }
    load()
    // A logged-in GM votes as their own team — asking which team they are
    // (when the site already knows, from their login) was a pointless extra
    // step. Only the fallback dropdown (no team on the profile — e.g. the
    // Commissioner account) still asks.
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: gm } = await supabase.from('gm_profiles').select('team_id').eq('id', user.id).single()
      if (gm?.team_id) { setGmTeam(gm.team_id); setTeamAutoDetected(true) }
    })
  },[])

  const votingOpen   = curWeek >= VOTING_OPENS && curWeek <= VOTING_CLOSES
  const votingClosed = curWeek >  VOTING_CLOSES
  const announced    = roster.length > 0
  const minGames = minGamesByWeek(curWeek)
  const expectedGames = expectedGamesByWeek(curWeek)

  const confPlayers = (conf:string, pos:string) => {
    // Strict position match only — SF/PF used to also cross-list into each
    // other's pool, so the same player could appear (and be votable) under
    // two different position cards at once, letting one GM's votes for him
    // split across both and silently eating a slot that should've gone to
    // someone else entirely.
    const pool = players.filter(p=>{
      const gp=p.player_stats?.[0]?.games||0
      return teams[p.team_id]?.conference===conf && p.pos===pos && gp>=minGames
    }).map(p=>{
      const s=p.player_stats?.[0]||{}
      const gp2=Math.max(1,s.games||1)
      const per:Record<string,number>={}
      for(const c of STAT_CATS) per[c]=(s[c]||0)/gp2
      for(const c of GMSC_EXTRA_CATS) per[c]=(s[c]||0)/gp2
      // Game Score (GmSc) — same John Hollinger formula already used
      // site-wide to pick each game's MVP (see GameBoxScore.tsx) — Bruno's
      // call: it's the real "how good was this player" number, where the
      // old pts/reb/ast-only weighting could rank a high-volume, low-impact
      // scorer above someone clearly better overall.
      const score = per.pts + 0.4*per.fgm - 0.7*per.fga - 0.4*(per.fta-per.ftm)
        + 0.7*per.off_reb + 0.3*per.def_reb + per.stl + 0.7*per.ast + 0.7*per.blk
        - 0.4*per.pf - per.turnovers
      return {...p, per, score}
    }).sort((a:any,b:any)=>b.score-a.score).slice(0,10)

    // Which 2 stats actually distinguish each player, not just PPG — a
    // defensive-minded PG might stand out more for assists/steals than
    // scoring. Ranked relative to this same pool's own max per category, so
    // "distinguish" means relative to the other All-Star candidates, not
    // some arbitrary league-wide bar.
    const maxByCat:Record<string,number>={}
    for(const c of STAT_CATS) maxByCat[c]=Math.max(0.1,...pool.map((p:any)=>p.per[c]))
    return pool.map((p:any)=>{
      const always=ALWAYS_STAT_CATS[p.pos]||['pts','ast']
      const candidates=CANDIDATE_STAT_CATS[p.pos]||['reb','stl','blk']
      const bestCandidate=[...candidates].sort((a,b)=>(p.per[b]/maxByCat[b])-(p.per[a]/maxByCat[a]))[0]
      const topStats=[...always,bestCandidate].map(c=>({cat:c,val:p.per[c]}))
      return {...p, topStats}
    })
  }

  const toggleVote=(conf:string,pos:string,pid:string)=>{
    if(!votingOpen||submitted)return
    setVotes(v=>{
      const cur=v[conf]?.[pos]||[]
      if(cur.includes(pid))return{...v,[conf]:{...v[conf],[pos]:cur.filter((x:string)=>x!==pid)}}
      if(cur.length>=2)return v
      return{...v,[conf]:{...(v[conf]||{}),[pos]:[...cur,pid]}}
    })
  }

  const saveVotes=async()=>{
    if(!gmTeam)return
    setSaving(true)
    const rows:any[]=[]
    for(const conf of CONFS)for(const pos of POSITIONS)for(const pid of(votes[conf]?.[pos]||[])){
      rows.push({gm_team_id:gmTeam,season:'2025-26',conference:conf,position:pos,player_id:pid,is_auto:false})
    }
    if(rows.length>0)await supabase.from('allstar_votes').upsert(rows,{onConflict:'gm_team_id,season,conference,position,player_id'})
    setSaving(false);setSubmitted(true)
  }

  const totalVotes=Object.values(votes).reduce((s,cv)=>s+Object.values(cv).reduce((ss,a)=>ss+(a as string[]).length,0),0)

  const confLabel=(conf:string)=>isPT?(conf==='Eastern'?'Este':'Oeste'):conf

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="rounded-2xl p-7 mb-6 relative overflow-hidden" style={{
        background:'linear-gradient(135deg, #fde68a 0%, #fbbf24 55%, #f59e0b 100%)',
        border:'1px solid #92620a', boxShadow:'0 20px 44px -12px rgba(120,72,0,0.35), 0 4px 14px rgba(120,72,0,0.15)'}}>
        <div className="absolute -right-6 -top-10 text-[160px] leading-none select-none pointer-events-none" style={{opacity:0.12}}>⭐</div>
        <div className="flex items-start justify-between flex-wrap gap-4 relative">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black mb-1 tracking-tight" style={{color:'#3d2400',textShadow:'0 1px 0 rgba(255,255,255,0.35)'}}>⭐ All-Star Weekend</h1>
            <p className="text-sm font-semibold" style={{color:'#5a3d00'}}>{isPT?`${formatWeekRange(ALLSTAR_WEEK,locale)} · Caloiros vs Veteranos (Sáb) · Este vs Oeste (Dom)`:`${formatWeekRange(ALLSTAR_WEEK,locale)} · Rookies vs Sophomores (Sat) · East vs West (Sun)`}</p>
          </div>
          <div className="text-right">
            {!ready?(
              <span className="text-xs px-3 py-1.5 rounded-full font-bold" style={{background:'rgba(0,0,0,0.15)',color:'#3d2400'}}>{t('common.loading')}</span>
            ):(
              <span className="text-sm px-4 py-2 rounded-full font-black inline-block" style={{
                background:votingOpen?'#0a2a10':votingClosed?'#2a0a0a':'#1a1210',
                color:votingOpen?'#4ade80':votingClosed?'#f87171':'#fbbf24',
                boxShadow:'0 8px 20px -6px rgba(0,0,0,0.4)',
                animation:votingOpen?'pulse 2s infinite':undefined}}>
                {votingOpen?`🗳️ ${isPT?'Votação Aberta':'Voting Open'}`:votingClosed?`🔒 ${isPT?'Votação Fechada':'Voting Closed'}`:`${isPT?'Abre em':'Opens'} ${voteOpenLabel}`}
              </span>
            )}
            <div className="text-xs mt-1.5 font-bold" style={{color:'#5a3d00'}}>{isPT?'Atual:':'Current:'} {formatWeekRange(curWeek,locale)}</div>
          </div>
        </div>
      </div>

      {!ready?(
        <div className="rounded-xl p-8 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <p style={{color:'#6b5f4e'}}>{t('common.loading')}</p>
        </div>
      ):(
        <>
          <div className="rounded-xl px-4 py-3 mb-5 text-xs" style={{background:'#efe8da',border:'1px solid #d4cec3',color:'#6b5f4e'}}>
            <strong style={{color:'#1a1612'}}>{isPT?'Elegibilidade:':'Eligibility:'}</strong> ≥{minGames} {isPT?`jogos (75% de ~${expectedGames} jogos)`:`games played (75% of ~${expectedGames} games)`} · {isPT?'Sem jogadores lesionados':'No injured players'} ·{' '}
            <strong style={{color:'#1a1612'}}>{isPT?'Titulares:':'Starters:'}</strong> {isPT?'mais votados por posição (5 por equipa) + 7 reservas':'top-voted per position (5 per team) + 7 reserves'} ·{' '}
            <strong style={{color:'#1a1612'}}>{isPT?'Voto automático:':'Auto-vote:'}</strong> {isPT?'GMs que perderem o prazo recebem votos automáticos':'GMs who miss deadline get system votes'}
          </div>

          <div className="flex gap-2 mb-5">
            {[{k:'vote',l:isPT?'🗳️ Votar':'🗳️ Cast Votes'},{k:'results',l:isPT?'📊 Convocados':'📊 Roster'}].map((tb:any)=>(
              <button key={tb.k} onClick={()=>setTab(tb.k)} className="px-5 py-2.5 rounded-xl text-sm font-black transition-all"
                style={{background:tab===tb.k?'#b45309':'#faf8f5',color:tab===tb.k?'#fff':'#5c554e',border:'1px solid '+(tab===tb.k?'#b45309':'#d4cdc5'),
                  boxShadow:tab===tb.k?'0 8px 18px -6px rgba(180,83,9,0.5)':'none'}}>
                {tb.l}
              </button>
            ))}
          </div>

          {tab==='vote'&&<>
            {!votingOpen&&!votingClosed&&(
              <div className="rounded-xl p-10 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="text-5xl mb-4">🔒</div>
                <h2 className="text-xl font-bold mb-2" style={{color:'#1a1612'}}>{isPT?`Votação abre a ${voteOpenLabel}`:`Voting opens ${voteOpenLabel}`}</h2>
                <p style={{color:'#6b5f4e'}}>{isPT?`A liga está em ${formatWeekRange(curWeek,locale)}. A votação abre a ${voteOpenLabel}.`:`The league is currently at ${formatWeekRange(curWeek,locale)}. Voting opens ${voteOpenLabel}.`}</p>
              </div>
            )}
            {votingClosed&&(
              <div className="rounded-xl p-10 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="text-5xl mb-4">⏳</div>
                <h2 className="text-xl font-bold mb-2" style={{color:'#1a1612'}}>{isPT?'Votação Encerrada':'Voting Closed'}</h2>
                <p style={{color:'#6b5f4e'}}>{isPT?'O Comissário está a finalizar os convocados. Anúncio em breve.':'Commissioner is finalising the rosters. Announcement coming soon.'}</p>
              </div>
            )}
            {votingOpen&&<>
              <div className="flex items-center gap-3 mb-6 p-4 rounded-xl" style={{background:'#1a1612',boxShadow:'0 8px 20px -8px rgba(0,0,0,0.3)'}}>
                <span className="text-xs font-bold uppercase tracking-wide" style={{color:'#a89a86'}}>{isPT?'A tua equipa':'Your team'}</span>
                {teamAutoDetected?(
                  <span className="text-base font-black flex-1" style={{color:'#fbbf24'}}>{teams[gmTeam]?.name || gmTeam}</span>
                ):(
                  <select value={gmTeam} onChange={e=>setGmTeam(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg flex-1"
                    style={{background:'#2a241e',border:'1px solid #4a4238',color:'#fff',outline:'none'}}>
                    <option value="">{isPT?'— Seleciona a tua equipa —':'— Select your team —'}</option>
                    {Object.values(teams).map((tm:any)=><option key={tm.id} value={tm.id}>{tm.name}</option>)}
                  </select>
                )}
                <span className="text-sm font-black px-3 py-1 rounded-full" style={{background:totalVotes===20?'#0a3a1a':'#3a2f1a',color:totalVotes===20?'#4ade80':'#fbbf24'}}>{totalVotes}/20</span>
              </div>
              {CONFS.map(conf=>(
                <div key={conf} className="mb-9">
                  <h2 className="text-xl font-black mb-4 flex items-center gap-2" style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>
                    <span className="inline-block w-1.5 h-6 rounded-full" style={{background:conf==='Eastern'?'#e05050':'#5090d0'}}/>
                    {confLabel(conf)} <span className="text-xs font-semibold" style={{color:'#8a8074'}}>— {isPT?'escolhe 2 por posição':'pick 2 per position'}</span>
                  </h2>
                  {POSITIONS.map(pos=>{
                    const pool=confPlayers(conf,pos);const sel=votes[conf]?.[pos]||[]
                    return(
                      <div key={pos} className="mb-4 rounded-2xl overflow-hidden" style={{border:'1px solid #d4cec3',boxShadow:'0 4px 14px -6px rgba(30,20,10,0.12)'}}>
                        <div className="px-4 py-2.5 flex justify-between items-center" style={{background:'#2a2420'}}>
                          <span className="font-black text-sm" style={{color:'#fbbf24'}}>{pos}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:sel.length===2?'#0a3a1a':'#3a3228',color:sel.length===2?'#4ade80':'#c9bda8'}}>{sel.length}/2</span>
                        </div>
                        {pool.length===0?(
                          <div className="p-4 text-xs text-center" style={{color:'#6b5f4e'}}>{isPT?'Sem jogadores elegíveis ainda.':'No eligible players yet.'}</div>
                        ):(
                          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4" style={{background:'#f4efe4'}}>
                            {pool.map((p:any)=>{
                              const isSel=sel.includes(p.id);const tm=teams[p.team_id];const tc=readableTeamColor(tm?.color||'555555')
                              return(
                                <button key={p.id} onClick={()=>toggleVote(conf,pos,p.id)} disabled={!isSel&&sel.length>=2}
                                  className="relative flex flex-col items-center p-4 rounded-2xl transition-all disabled:opacity-40"
                                  style={{
                                    background:isSel?'linear-gradient(160deg, #fdf1d0 0%, #fce4b0 100%)':'#fff',
                                    border:'2px solid '+(isSel?'#b45309':'#e5ddcf'),
                                    boxShadow:isSel?'0 14px 30px -8px rgba(180,83,9,0.5)':'0 2px 8px -4px rgba(30,20,10,0.1)',
                                    transform:isSel?'translateY(-3px) scale(1.02)':'none'}}>
                                  {isSel&&<span className="absolute -top-3 -right-2 text-2xl z-10" style={{filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'}}>⭐</span>}
                                  {/* Conic-gradient ring (team color → gold → team color) instead of a
                                      flat solid circle — reads as a trading-card badge, and glows
                                      brighter once selected instead of just changing color. */}
                                  <div className="rounded-full mb-3" style={{
                                    width:104,height:104,padding:4,
                                    background:`conic-gradient(from 180deg, ${tc}, #fde68a, ${tc})`,
                                    boxShadow:isSel?`0 0 0 4px #fff, 0 0 22px 4px ${tc}99`:`0 0 0 3px #fff, 0 6px 14px -4px rgba(0,0,0,0.35)`}}>
                                    <div className="w-full h-full rounded-full overflow-hidden" style={{background:'#fff'}}>
                                      {p.photo_url?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                                        :<div className="w-full h-full flex items-center justify-center text-2xl font-black" style={{color:tc,background:tc+'18'}}>{p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
                                    </div>
                                  </div>
                                  <div className="text-sm font-black text-center leading-tight mb-0.5" style={{color:isSel?'#7c3a00':'#1a1512'}}>{p.name}</div>
                                  <div className="text-[10px] font-bold mb-2 px-2 py-0.5 rounded-full" style={{color:'#fff',background:tc}}>{tm?.id}</div>
                                  <div className="flex items-stretch justify-center w-full" style={{borderTop:'1px solid '+(isSel?'#e0b673':'#e5ddcf')}}>
                                    {p.topStats.map((ts:any,i:number)=>(
                                      <div key={i} className="flex-1 text-center pt-2" style={{borderLeft:i>0?'1px solid '+(isSel?'#e0b673':'#e5ddcf'):'none'}}>
                                        <div className="text-lg font-black leading-none" style={{color:isSel?'#b45309':'#2a2420'}}>{ts.val.toFixed(1)}</div>
                                        <div className="text-[9px] font-bold uppercase tracking-wide mt-0.5" style={{color:'#8a8074'}}>{STAT_SUFFIX[ts.cat]}</div>
                                      </div>
                                    ))}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              <button onClick={saveVotes} disabled={saving||submitted||!gmTeam} className="px-8 py-3.5 rounded-xl font-black text-base disabled:opacity-40 transition-all"
                style={{background:submitted?'#0a5a20':'linear-gradient(135deg,#fbbf24,#b45309)',color:submitted?'#4ade80':'#2a1500',
                  border:'1px solid '+(submitted?'#1a5a20':'#92620a'),boxShadow:submitted?'none':'0 10px 24px -8px rgba(180,83,9,0.5)'}}>
                {saving?(isPT?'A guardar...':'Saving...'):submitted?`✓ ${isPT?'Submetido!':'Submitted!'}`:(isPT?'Submeter Votos':'Submit Votes')}
              </button>
            </>}
          </>}

          {tab==='results'&&(
            !announced?(
              <div className="rounded-xl p-10 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="text-5xl mb-4">⭐</div>
                <h2 className="text-xl font-bold mb-2" style={{color:'#1a1612'}}>{isPT?'Ainda não anunciado':'Not yet announced'}</h2>
                <p style={{color:'#6b5f4e'}}>{isPT?`Os convocados serão anunciados pelo Comissário após ${formatWeekRange(VOTING_CLOSES,locale)}.`:`Roster will be announced by the Commissioner after ${formatWeekRange(VOTING_CLOSES,locale)}.`}</p>
              </div>
            ):(
              CONFS.map(conf=>{
                const cr=roster.filter((r:any)=>r.conference===conf).sort((a:any,b:any)=>(b.is_starter?1:0)-(a.is_starter?1:0))
                return(
                  <div key={conf} className="mb-9">
                    <h2 className="text-xl font-black mb-4 flex items-center gap-2" style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>
                      <span className="inline-block w-1.5 h-6 rounded-full" style={{background:conf==='Eastern'?'#e05050':'#5090d0'}}/>
                      {confLabel(conf)} All-Stars
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {cr.map((r:any)=>{
                        const p=r.players;const tm=teams[p?.team_id];const tc=readableTeamColor(tm?.color||'555')
                        return(
                          <div key={r.id} className="rounded-2xl p-4 text-center flex flex-col items-center" style={{
                            background:r.is_starter?'linear-gradient(160deg, #fdf1d0 0%, #fce4b0 100%)':'#fff',
                            border:'2px solid '+(r.is_starter?'#b45309':'#e5ddcf'),
                            boxShadow:r.is_starter?'0 14px 30px -8px rgba(180,83,9,0.45)':'0 2px 8px -4px rgba(30,20,10,0.1)'}}>
                            {r.is_starter&&<div className="text-[10px] font-black mb-1.5 tracking-wide" style={{color:'#b45309'}}>⭐ {isPT?'TITULAR':'STARTER'}</div>}
                            <div className="rounded-full mb-2" style={{
                              width:104,height:104,padding:4,
                              background:`conic-gradient(from 180deg, ${tc}, #fde68a, ${tc})`,
                              boxShadow:r.is_starter?`0 0 0 4px #fff, 0 0 22px 4px ${tc}99`:`0 0 0 3px #fff, 0 6px 14px -4px rgba(0,0,0,0.35)`}}>
                              <div className="w-full h-full rounded-full overflow-hidden" style={{background:'#fff'}}>
                                {p?.photo_url?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                                  :<div className="w-full h-full flex items-center justify-center text-2xl font-black" style={{color:tc,background:tc+'18'}}>{p?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
                              </div>
                            </div>
                            <div className="text-sm font-black leading-tight" style={{color:'#1a1612'}}>{p?.name}</div>
                            <div className="text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full" style={{color:'#fff',background:tc}}>{r.position} · {tm?.id}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )
          )}
        </>
      )}
    </div>
  )
}

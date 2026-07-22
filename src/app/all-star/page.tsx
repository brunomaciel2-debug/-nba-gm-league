'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { readableTeamColor } from '@/lib/color'
import { useTranslation } from '@/components/I18nProvider'
import { VOTING_OPENS_WEEK, VOTING_CLOSES_WEEK, ALLSTAR_WEEK, minGamesByWeek, expectedGamesByWeek } from '@/lib/allstar-constants'
import { formatWeekRange } from '@/lib/season-week-helper'

const POSITIONS = ['PG','SG','SF','PF','C']
const CONFS = ['Eastern','Western']

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
  const [tab,       setTab]       = useState<'vote'|'results'>('vote')
  const [roster,    setRoster]    = useState<any[]>([])

  const VOTING_OPENS  = VOTING_OPENS_WEEK
  const VOTING_CLOSES = VOTING_CLOSES_WEEK
  const locale = isPT ? 'pt-PT' : 'en-US'

  useEffect(() => {
    const load = async () => {
      try {
        const [r1,r2,r3,r4] = await Promise.allSettled([
          // player_stats has one row per season — without this filter a
          // veteran's player_stats?.[0] below can grab a stale, all-null
          // past season instead of the current one.
          supabase.from('players').select('id,name,pos,team_id,photo_url,status,player_stats(games,pts,reb,ast)').eq('status','active').eq('player_stats.season','2025-26'),
          supabase.from('teams').select('id,name,conference,color,logo_url').not('id','in','(ALL,RVS,ROO,SOP)'),
          supabase.from('season_config').select('current_week').eq('id',1).single(),
          // is_injured rows are historical markers (the original pick who
          // got hurt) — the row for who actually took his spot is a
          // separate, non-injured row already in this same result set, so
          // rendering both doubled every replaced player onto the roster
          // (found live: Eastern showed 7 "starters" and 16 total instead
          // of 5 + 12, exactly the count of injured markers still included).
          supabase.from('allstar_roster').select('*, players!allstar_roster_player_id_fkey(name,pos,photo_url,team_id)').eq('season','2025-26').eq('is_injured',false),
        ])
        if(r1.status==='fulfilled'&&r1.value.data)setPlayers(r1.value.data)
        if(r2.status==='fulfilled'&&r2.value.data)setTeams(Object.fromEntries(r2.value.data.map((t:any)=>[t.id,t])))
        if(r3.status==='fulfilled'&&r3.value.data)setCurWeek((r3.value.data as any).current_week||0)
        if(r4.status==='fulfilled'&&r4.value.data)setRoster(r4.value.data)
      } catch(e){console.error(e)}
      setReady(true)
    }
    load()
  },[])

  const votingOpen   = curWeek >= VOTING_OPENS && curWeek <= VOTING_CLOSES
  const votingClosed = curWeek >  VOTING_CLOSES
  const announced    = roster.length > 0
  const minGames = minGamesByWeek(curWeek)
  const expectedGames = expectedGamesByWeek(curWeek)

  const confPlayers = (conf:string, pos:string) =>
    players.filter(p=>{
      const gp=p.player_stats?.[0]?.games||0
      return teams[p.team_id]?.conference===conf&&
        (p.pos===pos||(pos==='SF'&&p.pos==='PF')||(pos==='PF'&&p.pos==='SF'))&&gp>=minGames
    }).map(p=>{const s=p.player_stats?.[0]||{};const gp2=Math.max(1,s.games||1);return{...p,ppg:(s.pts/gp2).toFixed(1),score:(s.pts/gp2)*0.5+(s.reb/gp2)*0.25+(s.ast/gp2)*0.25}})
    .sort((a:any,b:any)=>b.score-a.score).slice(0,10)

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
      <div className="rounded-2xl p-6 mb-6" style={{background:'#fef3c7',border:'1px solid #5a4a00',borderTop:'4px solid #b45309'}}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{color:'#b45309'}}>⭐ {isPT?'All-Star Weekend 2025-26':'All-Star Weekend 2025-26'}</h1>
            <p className="text-sm" style={{color:'#8a6a00'}}>{isPT?`${formatWeekRange(ALLSTAR_WEEK,locale)} · Caloiros vs Veteranos (Sáb) · Este vs Oeste (Dom)`:`${formatWeekRange(ALLSTAR_WEEK,locale)} · Rookies vs Sophomores (Sat) · East vs West (Sun)`}</p>
          </div>
          <div className="text-right">
            {!ready?(
              <span className="text-xs px-3 py-1.5 rounded-full" style={{background:'#e8e2d6',color:'#6b5f4e'}}>{t('common.loading')}</span>
            ):(
              <span className="text-xs px-3 py-1.5 rounded-full font-semibold inline-block"
                    style={{background:votingOpen?'#0a2a10':votingClosed?'#2a0a0a':'#faf8f5',color:votingOpen?'#15803d':votingClosed?'#dc2626':'#5c554e'}}>
                {votingOpen?`🗳️ ${isPT?'Votação Aberta':'Voting Open'}`:votingClosed?`🔒 ${isPT?'Votação Fechada':'Voting Closed'}`:`${isPT?'Abre em':'Opens'} ${formatWeekRange(VOTING_OPENS,locale)}`}
              </span>
            )}
            <div className="text-xs mt-1" style={{color:'#6b5f4e'}}>{isPT?'Atual:':'Current:'} {formatWeekRange(curWeek,locale)}</div>
          </div>
        </div>
      </div>

      {!ready?(
        <div className="rounded-xl p-8 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <p style={{color:'#6b5f4e'}}>{t('common.loading')}</p>
        </div>
      ):(
        <>
          <div className="rounded-xl px-4 py-3 mb-5 text-xs" style={{background:'#e8e2d6',border:'1px solid #d4cec3',color:'#6b5f4e'}}>
            <strong style={{color:'#1a1612'}}>{isPT?'Elegibilidade:':'Eligibility:'}</strong> ≥{minGames} {isPT?`jogos (75% de ~${expectedGames} jogos)`:`games played (75% of ~${expectedGames} games)`} · {isPT?'Sem jogadores lesionados':'No injured players'} ·{' '}
            <strong style={{color:'#1a1612'}}>{isPT?'Titulares:':'Starters:'}</strong> {isPT?'mais votados por posição (5 por equipa) + 7 reservas':'top-voted per position (5 per team) + 7 reserves'} ·{' '}
            <strong style={{color:'#1a1612'}}>{isPT?'Voto automático:':'Auto-vote:'}</strong> {isPT?'GMs que perderem o prazo recebem votos automáticos':'GMs who miss deadline get system votes'}
          </div>

          <div className="flex gap-2 mb-5">
            {[{k:'vote',l:isPT?'🗳️ Votar':'🗳️ Cast Votes'},{k:'results',l:isPT?'📊 Convocados':'📊 Roster'}].map((tb:any)=>(
              <button key={tb.k} onClick={()=>setTab(tb.k)} className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{background:tab===tb.k?'#d4cdc5':'#faf8f5',color:tab===tb.k?'#1a1512':'#5c554e',border:'1px solid #d4cdc5'}}>
                {tb.l}
              </button>
            ))}
          </div>

          {tab==='vote'&&<>
            {!votingOpen&&!votingClosed&&(
              <div className="rounded-xl p-10 text-center" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <div className="text-5xl mb-4">🔒</div>
                <h2 className="text-xl font-bold mb-2" style={{color:'#1a1612'}}>{isPT?`Votação abre em ${formatWeekRange(VOTING_OPENS,locale)}`:`Voting opens ${formatWeekRange(VOTING_OPENS,locale)}`}</h2>
                <p style={{color:'#6b5f4e'}}>{isPT?`A liga está em ${formatWeekRange(curWeek,locale)}. A votação abre a partir de ${formatWeekRange(VOTING_OPENS,locale)}.`:`The league is currently at ${formatWeekRange(curWeek,locale)}. Voting opens starting ${formatWeekRange(VOTING_OPENS,locale)}.`}</p>
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
              <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
                <span className="text-xs font-semibold" style={{color:'#6b5f4e'}}>{isPT?'A tua equipa:':'Your team:'}</span>
                <select value={gmTeam} onChange={e=>setGmTeam(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg flex-1"
                  style={{background:'#ddd7ca',border:'1px solid #d4cec3',color:'#1a1612',outline:'none'}}>
                  <option value="">{isPT?'— Seleciona a tua equipa —':'— Select your team —'}</option>
                  {Object.values(teams).map((tm:any)=><option key={tm.id} value={tm.id}>{tm.name}</option>)}
                </select>
                <span className="text-xs font-bold" style={{color:totalVotes===20?'#15803d':'#5c554e'}}>{totalVotes}/20</span>
              </div>
              {CONFS.map(conf=>(
                <div key={conf} className="mb-8">
                  <h2 className="text-base font-bold mb-4" style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>{confLabel(conf)} — {isPT?'escolhe 2 por posição':'pick 2 per position'}</h2>
                  {POSITIONS.map(pos=>{
                    const pool=confPlayers(conf,pos);const sel=votes[conf]?.[pos]||[]
                    return(
                      <div key={pos} className="mb-3 rounded-xl overflow-hidden" style={{border:'1px solid #d4cec3'}}>
                        <div className="px-4 py-2 flex justify-between" style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
                          <span className="font-bold" style={{color:'#1a1612'}}>{pos}</span>
                          <span className="text-xs" style={{color:sel.length===2?'#15803d':'#5c554e'}}>{sel.length}/2</span>
                        </div>
                        {pool.length===0?(
                          <div className="p-4 text-xs text-center" style={{color:'#6b5f4e'}}>{isPT?'Sem jogadores elegíveis ainda.':'No eligible players yet.'}</div>
                        ):(
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3" style={{background:'#ede8de'}}>
                            {pool.map((p:any)=>{
                              const isSel=sel.includes(p.id);const tm=teams[p.team_id];const tc=readableTeamColor(tm?.color||'555555')
                              return(
                                <button key={p.id} onClick={()=>toggleVote(conf,pos,p.id)} disabled={!isSel&&sel.length>=2}
                                  className="flex flex-col items-center p-2 rounded-lg transition-all disabled:opacity-40"
                                  style={{background:isSel?'#fdf1e0':'#faf8f5',border:'1px solid '+(isSel?'#b45309':'#d4cdc5')}}>
                                  <div className="w-10 h-10 rounded-full overflow-hidden mb-1" style={{background:tc+'22'}}>
                                    {p.photo_url?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                                      :<div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:tc}}>{p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
                                  </div>
                                  <div className="text-xs font-semibold" style={{color:isSel?'#b45309':'#1a1512'}}>{p.name.split(' ').slice(-1)[0]}</div>
                                  <div className="text-xs" style={{color:'#6b5f4e'}}>{p.ppg}pts</div>
                                  {isSel&&<span>⭐</span>}
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
              <button onClick={saveVotes} disabled={saving||submitted||!gmTeam} className="px-8 py-3 rounded-xl font-bold disabled:opacity-40"
                style={{background:submitted?'#0a5a20':'#2a2000',color:submitted?'#15803d':'#b45309',border:'1px solid '+(submitted?'#1a5a20':'#5a4a00')}}>
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
                  <div key={conf} className="mb-8">
                    <h2 className="text-lg font-bold mb-4" style={{color:conf==='Eastern'?'#e05050':'#5090d0'}}>{confLabel(conf)} All-Stars</h2>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {cr.map((r:any)=>{
                        const p=r.players;const tm=teams[p?.team_id];const tc=readableTeamColor(tm?.color||'555')
                        return(
                          <div key={r.id} className="rounded-xl p-3 text-center" style={{background:r.is_starter?'#fdf1e0':'#faf8f5',border:'1px solid '+(r.is_starter?'#b45309':'#d4cdc5')}}>
                            {r.is_starter&&<div className="text-xs font-bold mb-1" style={{color:'#b45309'}}>⭐ {isPT?'TITULAR':'STARTER'}</div>}
                            <div className="w-12 h-12 rounded-full overflow-hidden mx-auto mb-2" style={{background:tc+'22'}}>
                              {p?.photo_url?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                                :<div className="w-full h-full flex items-center justify-center font-black" style={{color:tc}}>{p?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>}
                            </div>
                            <div className="text-xs font-bold" style={{color:'#1a1612'}}>{p?.name?.split(' ').slice(-1)[0]}</div>
                            <div className="text-xs" style={{color:'#6b5f4e'}}>{r.position} · {tm?.id}</div>
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

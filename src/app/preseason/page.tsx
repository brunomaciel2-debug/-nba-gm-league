'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'
import { countryName } from '@/lib/country-pt'

const PRESEASON_START = new Date('2025-10-02')
const PRESEASON_END   = new Date('2025-10-17')
const MAX_GAMES = 5

function getDates() {
  const dates: Date[] = []
  const d = new Date(PRESEASON_START)
  while (d <= PRESEASON_END) { dates.push(new Date(d)); d.setDate(d.getDate()+1) }
  return dates
}
function isoDate(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const r=new Date(d); r.setDate(r.getDate()+n); return r }

export default function PreseasonPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const STATUS_STYLE_EN: Record<string,{bg:string,color:string,label:string}> = {
    pending:   {bg:'#fef3c7',color:'#b45309',label:'Pending'},
    accepted:  {bg:'#dcfce7',color:'#15803d',label:'Accepted'},
    scheduled: {bg:'#dbeafe',color:'#1d4ed8',label:'Scheduled'},
    declined:  {bg:'#fee2e2',color:'#dc2626',label:'Declined'},
    cancelled: {bg:'#fee2e2',color:'#dc2626',label:'Cancelled'},
    final:     {bg:'#f0ece5',color:'#5c554e',label:'Final'},
  }
  const STATUS_STYLE_PT: Record<string,{bg:string,color:string,label:string}> = {
    pending:   {bg:'#fef3c7',color:'#b45309',label:'Pendente'},
    accepted:  {bg:'#dcfce7',color:'#15803d',label:'Aceite'},
    scheduled: {bg:'#dbeafe',color:'#1d4ed8',label:'Agendado'},
    declined:  {bg:'#fee2e2',color:'#dc2626',label:'Recusado'},
    cancelled: {bg:'#fee2e2',color:'#dc2626',label:'Cancelado'},
    final:     {bg:'#f0ece5',color:'#5c554e',label:'Final'},
  }
  const STATUS_STYLE = isPT ? STATUS_STYLE_PT : STATUS_STYLE_EN

  const [myTeamId,setMyTeamId]=useState<string|null>(null)
  const [myGames,setMyGames]=useState<any[]>([])
  const [allGames,setAllGames]=useState<any[]>([])
  const [nbaTeams,setNbaTeams]=useState<any[]>([])
  const [worldTeams,setWorldTeams]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [showModal,setShowModal]=useState(false)
  const [selectedDate,setSelectedDate]=useState<Date|null>(null)
  const [selectedOpponent,setSelectedOpponent]=useState<string>('')
  const [opponentType,setOpponentType]=useState<'nba'|'world'>('nba')
  const [isHome,setIsHome]=useState(true)
  const [notes,setNotes]=useState('')
  const [saving,setSaving]=useState(false)
  const [msg,setMsg]=useState('')

  useEffect(()=>{
    supabase.auth.getUser().then(async({data:{user}})=>{
      if(!user){setLoading(false);return}
      const{data:gm}=await supabase.from('gm_profiles').select('team_id,role').eq('id',user.id).single()
      if(gm?.team_id)setMyTeamId(gm.team_id)
      setLoading(false)
    })
    loadData()
  },[])

  const loadData=async()=>{
    const[{data:games},{data:nba},{data:world}]=await Promise.all([
      supabase.from('preseason_games').select('*').eq('season','2025-26').order('scheduled_date'),
      supabase.from('teams').select('id,name,color,logo_url').not('id','in','(ALL,RVS,ROO,SOP)').order('name'),
      supabase.from('world_teams').select('*').order('name'),
    ])
    setAllGames(games||[]);setNbaTeams(nba||[]);setWorldTeams(world||[])
  }

  useEffect(()=>{
    if(myTeamId)setMyGames(allGames.filter(g=>g.home_team===myTeamId||g.away_team===myTeamId))
  },[myTeamId,allGames])

  const myActiveGames=myGames.filter(g=>['pending','accepted','scheduled','final'].includes(g.status))
  const canScheduleMore=myActiveGames.length<MAX_GAMES

  const myBusyDates=new Set(myActiveGames.filter(g=>g.scheduled_date).flatMap(g=>{const d=new Date(g.scheduled_date);return[isoDate(addDays(d,-1)),isoDate(d),isoDate(addDays(d,1))]}))
  const isDateAvailable=(d:Date)=>!myBusyDates.has(isoDate(d))

  const getAvailableOpponents=(date:Date)=>{
    const dateStr=isoDate(date),prevStr=isoDate(addDays(date,-1)),nextStr=isoDate(addDays(date,1))
    const busyTeams=new Set(allGames.filter(g=>g.scheduled_date&&['pending','accepted','scheduled','final'].includes(g.status)).filter(g=>[prevStr,dateStr,nextStr].includes(g.scheduled_date)).flatMap(g=>[g.home_team,g.away_team]))
    return{nba:nbaTeams.filter(t=>t.id!==myTeamId&&!busyTeams.has(t.id)),world:worldTeams.filter(t=>!busyTeams.has(t.id))}
  }

  const handleSchedule=async()=>{
    if(!selectedDate||!selectedOpponent||!myTeamId)return
    setSaving(true);setMsg('')
    const homeTeam=isHome?myTeamId:selectedOpponent
    const awayTeam=isHome?selectedOpponent:myTeamId
    const isWorldGame=opponentType==='world'
    const{error}=await supabase.from('preseason_games').insert({
      season:'2025-26',home_team:homeTeam,away_team:awayTeam,
      home_type:isHome?'nba':opponentType,away_type:isHome?opponentType:'nba',
      requested_by:myTeamId,status:isWorldGame?'scheduled':'pending',
      scheduled_date:isoDate(selectedDate),notes,
    })
    if(error){setMsg(`${isPT?'Erro':'Error'}: `+error.message)}
    else{
      setMsg(isWorldGame?(isPT?'✅ Jogo agendado!':'✅ Game scheduled!'):(isPT?'✅ Pedido enviado! Aguarda aceitação.':'✅ Request sent! Waiting for opponent to accept.'))
      await loadData()
      setTimeout(()=>{setShowModal(false);setMsg('');setSelectedOpponent('');setNotes('')},2000)
    }
    setSaving(false)
  }

  const handleRespond=async(gameId:string,accept:boolean)=>{
    await supabase.from('preseason_games').update({status:accept?'scheduled':'declined',updated_at:new Date().toISOString()}).eq('id',gameId)
    await loadData()
  }

  const fmtDate=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString(isPT?'pt-PT':'en-US',{weekday:'short',month:'short',day:'numeric'})
  const getTeamName=(id:string,type:string)=>type==='world'?worldTeams.find(t=>t.id===id)?.name||id:nbaTeams.find(t=>t.id===id)?.name||id

  const allDates=getDates()

  if(loading)return<div className="p-8 text-center" style={{color:'#5c554e'}}>{t('common.loading')}</div>

  return(
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black mb-1" style={{color:'#1a1512'}}>🏀 {isPT?'Pré-Época':'Pre-Season'}</h1>
        <p className="text-sm" style={{color:'#8a8279'}}>{isPT?'2–17 Out 2025 · Máx 5 jogos por equipa · Sem back-to-backs':'Oct 2–17, 2025 · Max 5 games per team · No back-to-back games'}</p>
      </div>

      {myTeamId&&(
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            {label:isPT?'Jogos Agendados':'Games Scheduled',value:myActiveGames.length,color:'#1d4ed8'},
            {label:isPT?'Slots Livres':'Remaining Slots',value:MAX_GAMES-myActiveGames.length,color:'#15803d'},
            {label:isPT?'Pedidos Pendentes':'Pending Requests',value:myGames.filter(g=>g.status==='pending'&&g.requested_by!==myTeamId).length,color:'#b45309'},
          ].map(s=>(
            <div key={s.label} className="rounded-xl p-4" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <div className="text-2xl font-black" style={{color:s.color}}>{s.value}</div>
              <div className="text-xs" style={{color:'#8a8279'}}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {myTeamId&&canScheduleMore&&(
        <button onClick={()=>setShowModal(true)} className="mb-6 px-5 py-3 rounded-xl font-bold text-sm" style={{background:'#1a1512',color:'#f5f1eb'}}>
          + {isPT?'Agendar Jogo Pré-Época':'Schedule Pre-Season Game'}
        </button>
      )}
      {myTeamId&&!canScheduleMore&&(
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-semibold" style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5'}}>
          ⚠️ {isPT?'Máximo de 5 jogos atingido':'Maximum 5 games reached'}
        </div>
      )}

      {myTeamId&&(()=>{
        const pending=myGames.filter(g=>g.status==='pending'&&g.requested_by!==myTeamId)
        if(!pending.length)return null
        return(
          <div className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#b45309'}}>
              ⏳ {isPT?`Pedidos Pendentes (${pending.length})`:`Pending Requests (${pending.length})`}
            </h2>
            <div className="flex flex-col gap-2">
              {pending.map(g=>(
                <div key={g.id} className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{background:'#fef9c3',border:'1px solid #b45309'}}>
                  <div className="flex-1">
                    <div className="font-bold text-sm" style={{color:'#1a1512'}}>{getTeamName(g.home_team,g.home_type)} vs {getTeamName(g.away_team,g.away_type)}</div>
                    <div className="text-xs" style={{color:'#8a8279'}}>{g.scheduled_date?fmtDate(g.scheduled_date):'TBD'}{g.notes&&` · "${g.notes}"`}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>handleRespond(g.id,true)} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{background:'#15803d',color:'#fff'}}>{isPT?'Aceitar':'Accept'}</button>
                    <button onClick={()=>handleRespond(g.id,false)} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{background:'#dc2626',color:'#fff'}}>{isPT?'Recusar':'Decline'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {myTeamId&&myActiveGames.filter(g=>g.status!=='pending'||g.requested_by===myTeamId).length>0&&(
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e'}}>{isPT?'Os Meus Jogos':'My Games'}</h2>
          <div className="flex flex-col gap-2">
            {myGames.filter(g=>g.status!=='declined'&&g.status!=='cancelled').sort((a,b)=>(a.scheduled_date||'').localeCompare(b.scheduled_date||'')).map(g=>{
              const ss=STATUS_STYLE[g.status]||STATUS_STYLE.pending
              const isMyRequest=g.requested_by===myTeamId
              const isWorldGame=g.home_type==='world'||g.away_type==='world'
              const hasBoxScore=g.status==='final'&&isWorldGame&&g.box_score
              return(
                <div key={g.id} className="px-4 py-3 rounded-xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-bold text-sm" style={{color:'#1a1512'}}>{getTeamName(g.home_team,g.home_type)}<span style={{color:'#8a8279',fontWeight:400}}> vs </span>{getTeamName(g.away_team,g.away_type)}</div>
                      <div className="text-xs" style={{color:'#8a8279'}}>{g.scheduled_date?fmtDate(g.scheduled_date):'TBD'}{isWorldGame?(isPT?' · vs Equipa Internacional (IA)':' · vs World Team (AI)'):''}</div>
                    </div>
                    {g.status==='final'&&<div className="font-black text-sm" style={{color:'#1a1512'}}>{g.home_score}-{g.away_score}</div>}
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{background:ss.bg,color:ss.color}}>
                      {ss.label}{g.status==='pending'&&isMyRequest?(isPT?' (enviado)':' (sent)'):''}</span>
                    {hasBoxScore&&<Link href={`/game/friendly/${g.id}`} className="text-xs no-underline px-2 py-1 rounded flex-shrink-0" style={{background:'#e8e2d6',color:'#1d4ed8'}}>{isPT?'Box Score →':'Box Score →'}</Link>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e'}}>{isPT?'Todos os Jogos Pré-Época':'All Pre-Season Games'}</h2>
        {allGames.filter(g=>g.status!=='declined'&&g.status!=='cancelled').length===0?(
          <div className="text-center py-8 rounded-xl" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
            <p className="text-sm" style={{color:'#8a8279'}}>{isPT?'Nenhum jogo agendado ainda.':'No games scheduled yet.'}</p>
          </div>
        ):(
          <div className="flex flex-col gap-1.5">
            {allGames.filter(g=>g.status!=='declined'&&g.status!=='cancelled').sort((a,b)=>(a.scheduled_date||'').localeCompare(b.scheduled_date||'')).map(g=>{
              const ss=STATUS_STYLE[g.status]||STATUS_STYLE.pending
              const isWorldGame=g.home_type==='world'||g.away_type==='world'
              const hasBoxScore=g.status==='final'&&isWorldGame&&g.box_score
              return(
                <div key={g.id} className="px-4 py-2.5 rounded-lg" style={{background:'#faf8f5',border:'1px solid #e2dcd5'}}>
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-xs font-semibold flex-shrink-0" style={{color:'#8a8279'}}>{g.scheduled_date?fmtDate(g.scheduled_date):'TBD'}</div>
                    <div className="flex-1 text-sm font-semibold" style={{color:'#1a1512'}}>{getTeamName(g.home_team,g.home_type)} vs {getTeamName(g.away_team,g.away_type)}</div>
                    {g.status==='final'&&<div className="font-black text-sm" style={{color:'#1a1512'}}>{g.home_score}-{g.away_score}</div>}
                    <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{background:ss.bg,color:ss.color}}>{ss.label}</span>
                    {hasBoxScore&&<Link href={`/game/friendly/${g.id}`} className="text-xs no-underline px-2 py-1 rounded flex-shrink-0" style={{background:'#e8e2d6',color:'#1d4ed8'}}>{isPT?'Box Score →':'Box Score →'}</Link>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal&&myTeamId&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)'}}>
          <div className="w-full max-w-lg rounded-2xl p-6" style={{background:'#faf8f5',border:'1px solid #d4cdc5',maxHeight:'90vh',overflowY:'auto'}}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black" style={{color:'#1a1512'}}>{isPT?'Agendar Jogo Pré-Época':'Schedule Pre-Season Game'}</h2>
              <button onClick={()=>{setShowModal(false);setSelectedDate(null);setSelectedOpponent('');setMsg('')}} className="text-xl" style={{color:'#8a8279'}}>✕</button>
            </div>

            <div className="mb-5">
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e'}}>1. {isPT?'Escolhe a Data (2–17 Out)':'Choose Date (Oct 2–17)'}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {allDates.map(d=>{
                  const available=isDateAvailable(d); const selected=selectedDate&&isoDate(d)===isoDate(selectedDate)
                  return(
                    <button key={isoDate(d)} disabled={!available} onClick={()=>{setSelectedDate(d);setSelectedOpponent('')}}
                      className="py-2 rounded-lg text-xs font-bold transition-all"
                      style={{background:selected?'#1a1512':available?'#e8e2d6':'#f0ece5',color:selected?'#f5f1eb':available?'#1a1512':'#c4bdb5',border:selected?'1px solid #1a1512':'1px solid #d4cdc5',cursor:available?'pointer':'not-allowed',textDecoration:available?'none':'line-through'}}>
                      {d.toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric'})}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedDate&&(
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e'}}>2. {isPT?'O Teu Papel':'Your Role'}</div>
                <div className="flex gap-2">
                  {[{v:true,l:isPT?'Casa (tu recebes)':'Home (you host)'},{v:false,l:isPT?'Fora (tu viajas)':'Away (you travel)'}].map(o=>(
                    <button key={String(o.v)} onClick={()=>setIsHome(o.v)} className="flex-1 py-2 rounded-lg text-xs font-bold"
                      style={{background:isHome===o.v?'#1a1512':'#e8e2d6',color:isHome===o.v?'#f5f1eb':'#1a1512',border:'1px solid #d4cdc5'}}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedDate&&(
              <div className="mb-4">
                <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#5c554e'}}>3. {isPT?'Tipo de Adversário':'Opponent Type'}</div>
                <div className="flex gap-2 mb-3">
                  {[{v:'nba' as const,l:isPT?'Equipa NBA':'NBA Team'},{v:'world' as const,l:isPT?'Equipa Internacional (IA)':'World Team (AI)'}].map(o=>(
                    <button key={o.v} onClick={()=>{setOpponentType(o.v);setSelectedOpponent('')}} className="flex-1 py-2 rounded-lg text-xs font-bold"
                      style={{background:opponentType===o.v?'#1a1512':'#e8e2d6',color:opponentType===o.v?'#f5f1eb':'#1a1512',border:'1px solid #d4cdc5'}}>
                      {o.l}
                    </button>
                  ))}
                </div>
                {(()=>{
                  const avail=getAvailableOpponents(selectedDate)
                  const opponents=opponentType==='nba'?avail.nba:avail.world
                  if(!opponents.length)return<div className="text-xs py-2 text-center" style={{color:'#dc2626'}}>{isPT?'Sem adversários disponíveis para esta data':'No available opponents for this date'}</div>
                  return(
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                      {opponents.map(opp=>(
                        <button key={opp.id} onClick={()=>setSelectedOpponent(opp.id)} className="px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all"
                          style={{background:selectedOpponent===opp.id?'#1a1512':'#e8e2d6',color:selectedOpponent===opp.id?'#f5f1eb':'#1a1512',border:'1px solid #d4cdc5'}}>
                          {opp.name}{opponentType==='world'&&<span className="block text-xs opacity-60">{countryName(opp.country, isPT)}</span>}
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {selectedOpponent&&(
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#5c554e'}}>4. {isPT?'Mensagem (opcional)':'Message (optional)'}</div>
                <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} placeholder={isPT?'Mensagem opcional para o adversário...':'Optional message to the opponent...'} className="w-full px-3 py-2 rounded-lg text-sm" style={{background:'#e8e2d6',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
              </div>
            )}

            {msg&&<div className="mb-4 text-sm font-semibold text-center" style={{color:msg.startsWith('✅')?'#15803d':'#dc2626'}}>{msg}</div>}

            <button onClick={handleSchedule} disabled={!selectedDate||!selectedOpponent||saving} className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40" style={{background:'#1a1512',color:'#f5f1eb'}}>
              {saving?(isPT?'A enviar...':'Sending...'):opponentType==='world'?(isPT?'Agendar Jogo':'Schedule Game'):(isPT?'Enviar Pedido':'Send Request')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

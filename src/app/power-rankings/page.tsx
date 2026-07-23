'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'
import { formatWeekRange } from '@/lib/season-week-helper'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Grade = 'good' | 'neutral' | 'bad'
const GRADE_STYLE: Record<Grade, { bg: string, color: string }> = {
  good:    { bg: '#dcfce7', color: '#15803d' },
  neutral: { bg: '#f0ece5', color: '#6b5f4e' },
  bad:     { bg: '#fee2e2', color: '#dc2626' },
}

// Ordinal helper for both "past schedule difficulty" and "next schedule
// difficulty" chips — same rank convention (1 = hardest) shown from
// whichever end reads more naturally (nobody wants to see "27th hardest";
// "4th easiest" says the same thing more clearly).
function ordinalFromRank(rank: number | null, total: number, isPT: boolean): { label: string, easy: boolean } | null {
  if (!rank || !total) return null
  const mid = Math.ceil(total / 2)
  const easy = rank > mid
  const displayRank = easy ? (total - rank + 1) : rank
  const suffix = isPT ? 'º' : (displayRank === 1 ? 'st' : displayRank === 2 ? 'nd' : displayRank === 3 ? 'rd' : 'th')
  return { label: `${displayRank}${suffix}`, easy }
}

function CriteriaChip({icon,label,value,detail,grade}:{icon:string,label:string,value:string,detail:string,grade:Grade}) {
  const s = GRADE_STYLE[grade]
  return (
    <div className="relative group" style={{background:s.bg,borderRadius:8,padding:'6px 8px',cursor:'help'}}>
      <div style={{fontSize:9,fontWeight:700,color:s.color,textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:2,display:'flex',alignItems:'center',gap:3}}>
        <span>{icon}</span><span>{label}</span>
      </div>
      <div style={{fontSize:11,fontWeight:600,color:'#1a1512',lineHeight:1.3}}>{value}</div>
      <div className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
        style={{background:'#1a1512',color:'#f5f1eb',width:210,whiteSpace:'normal',lineHeight:1.5,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>
        {detail}
      </div>
    </div>
  )
}

function buildChips(criteria: any[], isPT: boolean) {
  const byKey: Record<string, any> = {}
  criteria.forEach(c => { byKey[c.key] = c })
  const chips: { icon:string, label:string, value:string, detail:string, grade:Grade }[] = []

  const rf = byKey.recent_form
  if (rf) {
    const noGames = rf.data.games === 0 || rf.data.last5 === 'N/A'
    chips.push({ icon:'📈', label: isPT?'Forma recente':'Recent form',
      value: noGames ? (isPT?'Sem jogos ainda':'No games yet') : rf.data.last5,
      detail: isPT?'Resultado nos últimos 5 jogos.':'Result in the last 5 games.',
      grade: rf.grade })
  }

  const elo = byKey.elo
  if (elo) chips.push({ icon:'⚡', label:'Elo', value:`${elo.data.value} (#${elo.data.leagueRank})`,
    detail: isPT?'Força da equipa ajustada à qualidade dos adversários que defrontou — sobe mais ao vencer um adversário forte do que um fraco.':"Team strength adjusted for opponent quality — rises more from beating a strong opponent than a weak one.",
    grade: elo.grade })

  const nr = byKey.net_rating
  if (nr) chips.push({ icon:'📊', label: isPT?'Dif. Pontos':'Net rating', value:`${nr.data.diff>=0?'+':''}${nr.data.diff}`,
    detail: isPT?'Pontos marcados menos pontos sofridos, por jogo. Um indicador de qualidade real mais fiável do que só o registo de vitórias/derrotas.':'Points scored minus points allowed, per game — a more reliable quality signal than the win-loss record alone.',
    grade: nr.grade })

  const rq = byKey.roster_quality
  if (rq) chips.push({ icon:'💎', label: isPT?'Talento Plantel':'Roster talent', value:`${Math.round(rq.data.norm*100)}%`,
    detail: isPT?'Valor combinado dos 8 jogadores mais utilizados do plantel. O critério que mais pesa no início da época, antes dos resultados dizerem alguma coisa.':"Combined value of the roster's 8 most-used players. The heaviest-weighted criterion early in the season, before results mean much.",
    grade: rq.grade })

  const sl = byKey.schedule_last
  if (sl) {
    const ord = ordinalFromRank(sl.data.hardnessRank, sl.data.totalTeams, isPT)
    const noGames = sl.data.games === 0
    chips.push({ icon:'📅', label: isPT?'Cal. Passado':'Schedule played',
      value: noGames ? (isPT?'Sem jogos ainda':'No games yet') : ord ? `${ord.label} ${isPT ? (ord.easy?'mais fácil':'mais difícil') : (ord.easy?'easiest':'hardest')} · ${sl.data.wins}-${sl.data.games-sl.data.wins}` : '—',
      detail: isPT?'Compara a força dos adversários da última semana com o desempenho real nesses jogos — recompensa vencer contra calendário difícil, desconta vitórias fáceis contra calendário fraco.':'Compares last week\'s opponent strength with actual performance in those games — rewards winning against a tough slate, discounts easy wins over a weak one.',
      grade: sl.grade })
  }

  const sn = byKey.schedule_next
  if (sn) {
    const ord = ordinalFromRank(sn.data.hardnessRank, sn.data.totalTeams, isPT)
    chips.push({ icon:'📆', label: isPT?'Cal. Seguinte':'Schedule ahead',
      value: ord ? `${ord.label} ${isPT ? (ord.easy?'mais fácil':'mais difícil') : (ord.easy?'easiest':'hardest')}` : (isPT?'Sem jogos marcados':'No games scheduled'),
      detail: isPT?'Força média dos adversários da próxima semana. Um calendário mais fácil dá uma pequena vantagem a quem luta pela mesma posição na tabela.':"Average opponent strength for next week. An easier schedule gives a small edge to teams fighting for the same standings spot.",
      grade: sn.grade })
  }

  const inj = byKey.injuries
  if (inj) {
    const players = inj.data.players as {name:string,severity:string,gamesOut:number}[]
    chips.push({ icon:'🩹', label: isPT?'Lesões':'Injuries',
      value: players.length === 0 ? (isPT?'Sem lesões relevantes':'No notable injuries')
        : players.length === 1 ? `${players[0].name} (${players[0].gamesOut}j)`
        : (isPT?`${players.length} jogadores-chave fora`:`${players.length} key players out`),
      detail: players.length === 0 ? (isPT?'Nenhum jogador com lesão significativa (5+ jogos de paragem) neste momento.':'No player with a significant injury (5+ games missed) right now.')
        : (isPT?'Jogadores com lesões significativas, pesados pela sua importância no plantel: ':'Players with significant injuries, weighted by their importance to the roster: ')+players.map(p=>`${p.name} (${p.severity}, ${p.gamesOut}${isPT?'j':'g'})`).join(', '),
      grade: inj.grade })
  }

  const tr = byKey.trades
  if (tr) {
    const hasTrade = (tr.data.in?.length||0) > 0 || (tr.data.out?.length||0) > 0
    chips.push({ icon:'🔄', label: isPT?'Trocas':'Trades',
      value: !hasTrade ? (isPT?'Sem trocas':'No trades') : `${tr.data.netOvrDelta>=0?'+':''}${tr.data.netOvrDelta} OVR`,
      detail: !hasTrade ? (isPT?'Sem atividade de trocas nos últimos 10 dias.':'No trade activity in the last 10 days.')
        : (isPT?'Saldo de talento (OVR) ganho ou perdido em trocas recentes. ':'Net talent (OVR) gained or lost in recent trades. ')+
          `${tr.data.in?.length?(isPT?'Recebeu: ':'Acquired: ')+tr.data.in.join(', ')+'. ':''}${tr.data.out?.length?(isPT?'Cedeu: ':'Traded away: ')+tr.data.out.join(', ')+'.':''}`,
      grade: tr.grade })
  }

  const tj = byKey.trajectory
  if (tj) chips.push({ icon:'🌱', label: isPT?'Trajetória':'Trajectory', value:`${tj.data.avgAge}${isPT?' anos':'y'} · ${tj.data.highPotentialCount} A/B${tj.data.extraPicks?` · +${tj.data.extraPicks} picks`:''}`,
    detail: isPT?'Idade média da rotação principal, quantos jogadores têm potencial A/B, e escolhas de draft extra banked para o futuro — o retrato de equipa "em ascensão" vs "a envelhecer".':"Average age of the core rotation, how many A/B-potential players are on the roster, and extra future draft picks banked — the picture of a rising team vs an aging one.",
    grade: tj.grade })

  return chips
}

export default function PowerRankingsPage() {
  const {t} = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [rankings,setRankings]=useState<any[]>([])
  const [week,setWeek]=useState(0)
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    supabase.from('power_rankings').select('week_number').eq('season','2025-26').order('week_number',{ascending:false}).limit(1).single()
      .then(({data:latest})=>{
        if(!latest){setLoading(false);return}
        setWeek(latest.week_number)
        supabase.from('power_rankings').select('*, team:teams(id,name,logo_url,conference,division)').eq('season','2025-26').eq('week_number',latest.week_number).order('rank')
          .then(({data})=>{setRankings(data||[]);setLoading(false)})
      })
  },[])

  return (
    <div style={{maxWidth:1000,margin:'0 auto',padding:'24px 16px'}}>
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:4}}>
          <h1 style={{fontSize:26,fontWeight:900,color:'#1a1512',margin:0}}>⚡ Power Rankings</h1>
          {week>0
            ?<span style={{fontSize:12,color:'#8a8279',fontWeight:500}}>{isPT?`${formatWeekRange(week,'pt-PT')} · Época 2025-26`:`${formatWeekRange(week,'en-US')} · 2025-26 Season`}</span>
            :<span style={{fontSize:12,color:'#b45309',fontWeight:600,padding:'2px 8px',background:'#fef3c7',borderRadius:4}}>{isPT?'Edição Pré-Época':'Pre-Season Edition'}</span>}
        </div>
        <p style={{fontSize:13,color:'#8a8279',margin:0}}>
          {isPT?'Actualizado a cada ciclo de simulação. A ordem resulta de 9 critérios objetivos — passa o rato sobre cada um para ver o que significa.':'Updated every simulation cycle. The order comes from 9 objective criteria — hover any one to see what it means.'}
        </p>
      </div>

      {loading?<div style={{padding:40,textAlign:'center',color:'#8a8279'}}>{t('common.loading')}</div>
      :rankings.length===0?(
        <div style={{padding:48,textAlign:'center',background:'#faf8f5',border:'1px dashed #d4cdc5',borderRadius:12}}>
          <div style={{fontSize:32,marginBottom:12}}>📋</div>
          <div style={{fontSize:14,fontWeight:700,color:'#1a1512',marginBottom:6}}>{isPT?'Ainda sem rankings':'No rankings yet'}</div>
          <div style={{fontSize:12,color:'#8a8279'}}>{isPT?'Os Power Rankings serão publicados após o primeiro ciclo de simulação.':'Power Rankings will be published after the first simulation cycle.'}</div>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {rankings.map((r:any)=>{
            const isTop3=r.rank<=3
            const borderColor=r.rank===1?'#b45309':r.rank===2?'#6b7280':r.rank===3?'#92400e':'#d4cdc5'
            const chips = r.criteria ? buildChips(r.criteria, isPT) : null
            return(
              <div key={r.team_id} style={{borderRadius:12,border:'1px solid #d4cdc5',borderTop:`3px solid ${borderColor}`,background:isTop3?'#fffbeb':'#faf8f5'}}>
                <div style={{display:'flex',gap:14,padding:'14px 18px',alignItems:'flex-start'}}>
                  <div style={{width:40,flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:3,paddingTop:2}}>
                    <div style={{fontSize:isTop3?22:16,fontWeight:800,color:r.rank===1?'#b45309':r.rank===2?'#6b7280':r.rank===3?'#92400e':'#1a1512'}}>{r.rank}</div>
                    {r.trend==='new'||!r.previous_rank
                      ?<span style={{fontSize:9,fontWeight:700,padding:'1px 4px',borderRadius:3,background:'#dbeafe',color:'#1d4ed8'}}>NEW</span>
                      :r.trend==='up'?<span style={{fontSize:10,fontWeight:700,color:'#15803d'}}>▲{r.previous_rank-r.rank}</span>
                      :r.trend==='down'?<span style={{fontSize:10,fontWeight:700,color:'#dc2626'}}>▼{r.rank-r.previous_rank}</span>
                      :<span style={{fontSize:12,color:'#8a8279'}}>—</span>}
                  </div>
                  <div style={{width:44,height:44,flexShrink:0,borderRadius:8,overflow:'hidden',background:'#f0ece5',border:'1px solid #d4cdc5',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {r.team?.logo_url?<img src={r.team.logo_url} alt={r.team?.name} style={{width:36,height:36,objectFit:'contain'}}/>:<span style={{fontSize:10,fontWeight:700,color:'#8a8279'}}>{r.team_id}</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                      <Link href={`/team/${r.team_id}`} style={{fontSize:14,fontWeight:700,color:'#1a1512',textDecoration:'none'}}>{r.team?.name}</Link>
                      {(r.wins>0||r.losses>0)&&<span style={{fontSize:11,fontWeight:600,color:'#5c554e',background:'#e8e2d6',padding:'1px 6px',borderRadius:4}}>{r.wins}-{r.losses}</span>}
                      {r.ppg&&<span style={{fontSize:10,color:'#8a8279'}}>{r.ppg} {isPT?'marcados':'scored'} · {r.opp_ppg} {isPT?'sofridos':'allowed'}</span>}
                      <span style={{fontSize:10,color:'#8a8279',marginLeft:'auto'}}>{r.team?.conference} · {r.team?.division}</span>
                    </div>
                    {chips ? (
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0,1fr))',gap:6}}>
                        {chips.map(c=><CriteriaChip key={c.label} {...c}/>)}
                      </div>
                    ) : (
                      <p style={{fontSize:11,color:'#b0a89e',fontStyle:'italic',margin:0}}>{isPT?'Sem dados detalhados para esta semana.':'No detailed data for this week.'}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p style={{marginTop:16,fontSize:11,color:'#b0a898',textAlign:'center'}}>
        {isPT?'Rankings gerados automaticamente a partir de 9 critérios de dados reais.':'Rankings generated automatically from 9 real-data criteria.'}
      </p>
    </div>
  )
}

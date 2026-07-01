'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTranslation } from '@/components/I18nProvider'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
    <div style={{maxWidth:900,margin:'0 auto',padding:'24px 16px'}}>
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:4}}>
          <h1 style={{fontSize:26,fontWeight:900,color:'#1a1512',margin:0}}>⚡ Power Rankings</h1>
          {week>0
            ?<span style={{fontSize:12,color:'#8a8279',fontWeight:500}}>{isPT?`Semana ${week} · Época 2025-26`:`Week ${week} · 2025-26 Season`}</span>
            :<span style={{fontSize:12,color:'#b45309',fontWeight:600,padding:'2px 8px',background:'#fef3c7',borderRadius:4}}>{isPT?'Edição Pré-Época':'Pre-Season Edition'}</span>}
        </div>
        <p style={{fontSize:13,color:'#8a8279',margin:0}}>
          {isPT?'Actualizado a cada ciclo de simulação. Rankings pesam registo, forma recente e diferencial de pontos.':'Updated every simulation cycle. Rankings weigh record, recent form and scoring differential.'}
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
        <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5'}}>
          {rankings.map((r:any,idx:number)=>{
            const isTop3=r.rank<=3
            const borderColor=r.rank===1?'#b45309':r.rank===2?'#6b7280':r.rank===3?'#92400e':'transparent'
            return(
              <div key={r.team_id} style={{display:'flex',gap:14,padding:'14px 18px',background:isTop3?'#fffbeb':idx%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5',borderLeft:`4px solid ${isTop3?borderColor:'transparent'}`}}>
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
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5,flexWrap:'wrap'}}>
                    <span style={{fontSize:14,fontWeight:700,color:'#1a1512'}}>{r.team?.name}</span>
                    {(r.wins>0||r.losses>0)&&<span style={{fontSize:11,fontWeight:600,color:'#5c554e',background:'#e8e2d6',padding:'1px 6px',borderRadius:4}}>{r.wins}-{r.losses}</span>}
                    {r.last5&&r.last5!=='N/A'&&<span style={{fontSize:10,color:'#8a8279'}}>L5: {r.last5}</span>}
                    {r.ppg&&<span style={{fontSize:10,color:'#8a8279'}}>{r.ppg} PPG</span>}
                    <span style={{fontSize:10,color:'#8a8279',marginLeft:'auto'}}>{r.team?.conference} · {r.team?.division}</span>
                  </div>
                  <p style={{fontSize:12,color:'#3d3731',lineHeight:1.7,margin:0,fontStyle:'italic'}}>"{r.comment}"</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p style={{marginTop:16,fontSize:11,color:'#b0a898',textAlign:'center'}}>
        {isPT?'Rankings gerados automaticamente · Comentários pela Redação da NBA GM League':'Rankings generated automatically · Comments by NBA GM League Editorial'}
      </p>
    </div>
  )
}

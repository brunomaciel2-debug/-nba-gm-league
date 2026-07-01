'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'

type Transaction = {
  id: string; type: 'revenue' | 'expense'; category: string
  amount: number; description: string; season: string; week_number: number; created_at: string
}
type Franchise = { balance: number }

const CATEGORY_LABELS_EN: Record<string, string> = {
  tickets:'Ticket Sales', concessions:'Concessions', suites:'Premium & Suites', sponsor:'Sponsors',
  nba_subsidy:'NBA Subsidy', staff:'Coaching Staff', travel:'Away Travel', maintenance:'Facility Maintenance',
  operational:'Arena Staff', utilities:'Utilities', insurance:'Insurance', construction:'Construction', other:'Other',
}
const CATEGORY_LABELS_PT: Record<string, string> = {
  tickets:'Venda de Bilhetes', concessions:'Concessões', suites:'Camarotes Premium', sponsor:'Patrocínios',
  nba_subsidy:'Subsídio NBA', staff:'Staff Técnico', travel:'Viagens Fora', maintenance:'Manutenção',
  operational:'Staff do Pavilhão', utilities:'Utilidades', insurance:'Seguros', construction:'Construção', other:'Outros',
}
const CATEGORY_ICONS: Record<string, string> = {
  tickets:'🎟️', concessions:'🍔', suites:'⭐', sponsor:'🤝', nba_subsidy:'🏀',
  staff:'👔', travel:'✈️', maintenance:'🔧', operational:'🏟️', utilities:'⚡',
  insurance:'🛡️', construction:'🏗️', other:'📋',
}

function fmt(n: number) {
  const abs=Math.abs(n), sign=n<0?'-':''
  if(abs>=1000000) return sign+'$'+(abs/1000000).toFixed(1)+'M'
  if(abs>=1000) return sign+'$'+(abs/1000).toFixed(0)+'K'
  return sign+'$'+abs.toFixed(0)
}

type TooltipProps = { text: string, children: React.ReactNode }
function Tip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false)
  return (
    <span style={{position:'relative',display:'inline-flex',alignItems:'center'}}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show && (
        <span style={{position:'absolute',bottom:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',zIndex:100,
          background:'#1a1512',color:'#f5f1eb',fontSize:11,padding:'6px 10px',borderRadius:6,whiteSpace:'nowrap',
          boxShadow:'0 4px 12px rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.1)',pointerEvents:'none'}}>{text}</span>
      )}
    </span>
  )
}

function NetBadge({ value }: { value: number }) {
  const pos=value>=0
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,
      background:pos?'#dcfce7':'#fee2e2',color:pos?'#15803d':'#dc2626'}}>
      {pos?'▲':'▼'} {fmt(Math.abs(value))}
    </span>
  )
}

export default function FinancesTab({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const { profile } = useAuth()
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [franchise, setFranchise] = useState<Franchise|null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [gymCost, setGymCost] = useState(50000)
  const [arenaCost, setArenaCost] = useState(0)
  const [coachingSalary, setCoachingSalary] = useState(500000)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'actual'|'projections'>('actual')

  useEffect(() => {
    Promise.all([
      supabase.from('franchise_finances').select('*').eq('team_id', teamId).single(),
      supabase.from('franchise_transactions').select('*').eq('team_id', teamId).eq('season','2025-26').order('created_at',{ascending:false}),
      supabase.from('practice_facilities').select('monthly_cost').eq('team_id', teamId).single(),
      supabase.from('arena_concessions').select('monthly_maintenance').eq('team_id', teamId).single(),
      supabase.from('coaches').select('salary').eq('team_id', teamId),
    ]).then(([{data:ff},{data:tx},{data:gym},{data:arena},{data:coaches}])=>{
      setFranchise(ff); setTransactions(tx||[])
      setGymCost(gym?.monthly_cost||50000); setArenaCost(arena?.monthly_maintenance||0)
      setCoachingSalary(Math.round((coaches||[]).reduce((t:number,c:any)=>t+(c.salary||0)/12,0))||500000)
      setLoading(false)
    })
  }, [teamId])

  const CATEGORY_LABELS = isPT ? CATEGORY_LABELS_PT : CATEGORY_LABELS_EN

  if (!isGM) return (
    <div style={{padding:40,textAlign:'center',color:'#b0a89e',fontSize:13}}>
      🔒 {isPT ? 'Os dados financeiros são privados ao GM da franquia.' : 'Financial data is private to the franchise GM.'}
    </div>
  )
  if (loading) return <div style={{color:'#8a8279',padding:20}}>{t('common.loading')}</div>

  const totalRevenue = transactions.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0)
  const totalExpenses = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)
  const netResult = totalRevenue - totalExpenses

  const projMonthlyRev = 500000 + 450000
  const projMonthlyExp = coachingSalary + gymCost + arenaCost + 100000 + 80000 + 40000 + 200000
  const projNet = projMonthlyRev - projMonthlyExp
  const projAnnual = projNet * 9

  const PROJ_REV = isPT ? [
    {label:'Subsídio NBA',     val:500000,  tip:'500K$ fixos/mês do programa NBA'},
    {label:'Venda Bilhetes',   val:450000,  tip:'~20 jogos em casa · 65% ocupação'},
    {label:'Concessões',       val:0,       tip:'Sem concessões construídas — vai ao separador Pavilhão'},
    {label:'Patrocínios (fixo)',val:0,      tip:'Sem contratos de patrocínio ativos'},
    {label:'Patrocínios (bónus)',val:0,     tip:'Desbloqueado ao atingir objetivos de desempenho'},
  ] : [
    {label:'NBA Subsidy',      val:500000,  tip:'Fixed $500K/month from NBA programme'},
    {label:'Ticket Sales',     val:450000,  tip:'~20 home games · 65% attendance · base pricing'},
    {label:'Concessions',      val:0,       tip:'No concessions built yet — build in Arena tab'},
    {label:'Sponsors (fixed)', val:0,       tip:'No active sponsor contracts yet'},
    {label:'Sponsors (bonus)', val:0,       tip:'Unlocked by reaching performance targets'},
  ]

  const PROJ_EXP = isPT ? [
    {label:'Staff Técnico',    val:coachingSalary, tip:'Salários anuais ÷ 12'},
    {label:'Ginásio',          val:gymCost,        tip:'Custo mensal do ginásio'},
    {label:'Concessões',       val:arenaCost,      tip:'Manutenção mensal das concessões'},
    {label:'Staff Pavilhão',   val:100000,         tip:'Segurança, limpeza, staff de eventos · fixo'},
    {label:'Utilidades',       val:80000,          tip:'Energia, água, aquecimento/arrefecimento'},
    {label:'Seguros',          val:40000,          tip:'Seguro de responsabilidade civil e acidentes'},
    {label:'Viagens Fora',     val:200000,         tip:'~20 jogos fora/mês · voos, hotel, refeições'},
  ] : [
    {label:'Coaching Staff',   val:coachingSalary, tip:'Annual salaries ÷ 12 · coaches, trainers, physios'},
    {label:'Practice Facility',val:gymCost,        tip:'Monthly gym maintenance — upgrade in Facilities tab'},
    {label:'Arena Concessions',val:arenaCost,      tip:'Monthly maintenance of built concessions'},
    {label:'Arena Staff',      val:100000,         tip:'Security, cleaning, event staff · fixed'},
    {label:'Utilities',        val:80000,          tip:'Energy, water, heating/cooling'},
    {label:'Insurance',        val:40000,          tip:'Liability, property and accident insurance'},
    {label:'Away Travel',      val:200000,         tip:'~20 away games/month · flights, hotel, meals'},
  ]

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderRadius:12,marginBottom:16,
        background:(franchise?.balance||0)>=0?'#f0fdf4':'#fef2f2',border:`1px solid ${(franchise?.balance||0)>=0?'#bbf7d0':'#fecaca'}`}}>
        <div>
          <div style={{fontSize:11,color:'#8a8279',marginBottom:2}}>
            <Tip text={isPT?'Saldo inicial + todas as receitas - todas as despesas registadas até agora':'Starting balance + all revenues - all expenses recorded to date'}>
              <span style={{cursor:'help',textDecoration:'underline dotted',textDecorationColor:'#c8c0b4'}}>
                {isPT ? 'Saldo Atual' : 'Current Balance'}
              </span>
            </Tip>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:(franchise?.balance||0)>=0?'#15803d':'#dc2626'}}>
            {fmt(franchise?.balance||0)}
          </div>
        </div>
        {transactions.length>0&&<div style={{textAlign:'right'}}>
          <div style={{fontSize:11,color:'#8a8279',marginBottom:4}}>{isPT?'Época até agora':'Season to date'}</div>
          <NetBadge value={netResult}/>
        </div>}
      </div>

      <div style={{display:'flex',gap:6,marginBottom:16}}>
        {[{k:'actual',l:isPT?'💳 Extrato':'💳 Balance Sheet'},{k:'projections',l:isPT?'📊 Projeções':'📊 Projections'}].map((v:any)=>(
          <button key={v.k} onClick={()=>setView(v.k)}
            style={{padding:'6px 16px',fontSize:12,fontWeight:600,borderRadius:8,cursor:'pointer',
              border:`1px solid ${view===v.k?teamColor:'#d4cdc5'}`,background:view===v.k?teamColor:'#f0ece5',color:view===v.k?'#fff':'#5c554e'}}>
            {v.l}
          </button>
        ))}
      </div>

      {view==='actual' && (
        transactions.length===0?(
          <div style={{padding:48,textAlign:'center',background:'#faf8f5',border:'1px dashed #d4cdc5',borderRadius:12}}>
            <div style={{fontSize:32,marginBottom:12}}>📭</div>
            <div style={{fontSize:14,fontWeight:700,color:'#1a1512',marginBottom:6}}>{isPT?'Ainda sem transações':'No transactions yet'}</div>
            <div style={{fontSize:12,color:'#8a8279',lineHeight:1.6,maxWidth:320,margin:'0 auto'}}>
              {isPT?'Os registos financeiros aparecerão aqui quando a época começar — venda de bilhetes, custos de staff, despesas de viagem e mais.':'Financial records will appear here once the season begins — ticket sales, coaching costs, travel expenses and more.'}
            </div>
          </div>
        ):(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
              {[
                {label:isPT?'Total Receitas':'Total Revenue',   val:totalRevenue,  color:'#15803d', tip:isPT?'Soma de todas as receitas esta época':'Sum of all revenue transactions this season'},
                {label:isPT?'Total Despesas':'Total Expenses',  val:totalExpenses, color:'#dc2626', tip:isPT?'Soma de todas as despesas esta época':'Sum of all expense transactions this season'},
                {label:isPT?'Resultado da Época':'Season Result',val:netResult,    color:netResult>=0?'#15803d':'#dc2626', tip:isPT?'Resultado líquido: receitas menos despesas':'Net result: revenue minus expenses'},
              ].map(item=>(
                <Tip key={item.label} text={item.tip}>
                  <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${item.color}`,borderRadius:10,padding:14,cursor:'help',width:'100%'}}>
                    <div style={{fontSize:10,color:'#8a8279',marginBottom:4}}>{item.label}</div>
                    <div style={{fontSize:18,fontWeight:800,color:item.color}}>{fmt(item.val)}</div>
                  </div>
                </Tip>
              ))}
            </div>
            <div style={{borderRadius:10,overflow:'hidden',border:'1px solid #d4cdc5'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead>
                  <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                    <th style={{padding:'8px 12px',textAlign:'left',fontWeight:700,color:'#5c554e'}}>{isPT?'Data':'Date'}</th>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:700,color:'#5c554e'}}>{isPT?'Categoria':'Category'}</th>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:700,color:'#5c554e'}}>{isPT?'Descrição':'Description'}</th>
                    <th style={{padding:'8px 12px',textAlign:'right',fontWeight:700,color:'#5c554e'}}>{isPT?'Valor':'Amount'}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx,i)=>(
                    <tr key={tx.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <td style={{padding:'7px 12px',color:'#8a8279',whiteSpace:'nowrap'}}>
                        {new Date(tx.created_at).toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric'})}
                      </td>
                      <td style={{padding:'7px 10px'}}>
                        <span style={{display:'flex',alignItems:'center',gap:5}}>
                          <span>{CATEGORY_ICONS[tx.category]||'📋'}</span>
                          <span style={{color:'#1a1512'}}>{CATEGORY_LABELS[tx.category]||tx.category}</span>
                        </span>
                      </td>
                      <td style={{padding:'7px 10px',color:'#5c554e'}}>{tx.description||'—'}</td>
                      <td style={{padding:'7px 12px',textAlign:'right',fontWeight:700,color:tx.type==='revenue'?'#15803d':'#dc2626'}}>
                        {tx.type==='revenue'?'+':'-'}{fmt(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {view==='projections' && (
        <div>
          <div style={{marginBottom:14,padding:'8px 12px',borderRadius:8,background:'#fef9c3',border:'1px solid #d97706',fontSize:11,color:'#92400e',lineHeight:1.5}}>
            ⚠️ {isPT?'Estimativas com base na tua configuração atual. Os valores reais dependem do desempenho da equipa, assistência e contratos de patrocínio.':'These are estimates based on your current setup. Actual values depend on team performance, attendance and sponsor deals.'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
            {[
              {label:isPT?'Receita mensal est.':'Est. monthly revenue',  val:projMonthlyRev, color:'#15803d'},
              {label:isPT?'Despesas mensais est.':'Est. monthly expenses',val:projMonthlyExp, color:'#dc2626'},
              {label:isPT?'Resultado mensal est.':'Est. monthly result',  val:projNet, color:projNet>=0?'#15803d':'#dc2626'},
            ].map(item=>(
              <div key={item.label} style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid ${item.color}`,borderRadius:10,padding:14}}>
                <div style={{fontSize:10,color:'#8a8279',marginBottom:4}}>{item.label}</div>
                <div style={{fontSize:18,fontWeight:800,color:item.color}}>{fmt(item.val)}</div>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'3px solid #15803d',borderRadius:10,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#15803d',marginBottom:10}}>
                {isPT?'Fontes de Receita':'Revenue streams'}
              </div>
              {PROJ_REV.map(row=>(
                <div key={row.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid #f0ece5'}}>
                  <Tip text={row.tip}><span style={{fontSize:11,color:row.val>0?'#1a1512':'#b0a89e',cursor:'help'}}>{row.label}</span></Tip>
                  <span style={{fontSize:11,fontWeight:600,color:row.val>0?'#15803d':'#b0a89e'}}>{row.val>0?fmt(row.val):'—'}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',paddingTop:8,marginTop:4,borderTop:'2px solid #d4cdc5'}}>
                <span style={{fontSize:11,fontWeight:700,color:'#5c554e'}}>{isPT?'Total':'Total'}</span>
                <span style={{fontSize:12,fontWeight:800,color:'#15803d'}}>{fmt(projMonthlyRev)}</span>
              </div>
            </div>
            <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'3px solid #dc2626',borderRadius:10,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#dc2626',marginBottom:10}}>
                {isPT?'Custos Mensais':'Monthly costs'}
              </div>
              {PROJ_EXP.map(row=>(
                <div key={row.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid #f0ece5'}}>
                  <Tip text={row.tip}><span style={{fontSize:11,color:row.val>0?'#1a1512':'#b0a89e',cursor:'help'}}>{row.label}</span></Tip>
                  <span style={{fontSize:11,fontWeight:600,color:row.val>0?'#dc2626':'#b0a89e'}}>{row.val>0?fmt(row.val):'—'}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',paddingTop:8,marginTop:4,borderTop:'2px solid #d4cdc5'}}>
                <span style={{fontSize:11,fontWeight:700,color:'#5c554e'}}>{isPT?'Total':'Total'}</span>
                <span style={{fontSize:12,fontWeight:800,color:'#dc2626'}}>{fmt(projMonthlyExp)}</span>
              </div>
            </div>
          </div>
          <div style={{padding:'12px 16px',borderRadius:8,background:projAnnual>=0?'#f0fdf4':'#fef2f2',border:`1px solid ${projAnnual>=0?'#bbf7d0':'#fecaca'}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,fontWeight:600,color:'#5c554e'}}>{isPT?'Projeção da época completa (~9 meses)':'Full season projection (~9 months)'}</span>
            <span style={{fontSize:15,fontWeight:800,color:projAnnual>=0?'#15803d':'#dc2626'}}>{projAnnual>=0?'+':''}{fmt(projAnnual)}</span>
          </div>
          {projNet < 100000 && (
            <div style={{marginTop:12,padding:'10px 14px',background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:8,fontSize:11,color:'#5c554e',lineHeight:1.7}}>
              <strong style={{color:'#1a1512'}}>{isPT?'Como melhorar a tua projeção:':'How to improve your projection:'}</strong><br/>
              {isPT?'🍔 Constrói concessões no separador Pavilhão para aumentar a receita por jogo':'🍔 Build concessions in the Arena tab to increase per-game revenue'}<br/>
              {isPT?'🤝 Assina patrocinadores no separador Patrocinadores para receita mensal fixa':'🤝 Sign sponsors in the Sponsors tab for monthly fixed income'}<br/>
              {isPT?'🎟️ Otimiza os preços dos bilhetes — encontra o equilíbrio entre preço e assistência':'🎟️ Optimise ticket pricing — find the sweet spot between price and attendance'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

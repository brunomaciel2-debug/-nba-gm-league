'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/components/I18nProvider'
import { getWeekDates } from '@/lib/season-week-helper'

type Transaction = {
  id: string; type: 'revenue' | 'expense'; category: string
  amount: number; description: string; season: string; week_number: number; created_at: string
}
type Franchise = { balance: number }

const CATEGORY_LABELS_EN: Record<string, string> = {
  tickets:'Ticket Sales', concessions:'Concessions', supplies:'Concession Supplies', suites:'Premium & Suites', sponsor:'Sponsors',
  nba_subsidy:'NBA Subsidy', staff:'Coaching Staff', travel:'Away Travel', maintenance:'Facility Maintenance',
  operational:'Arena Staff', utilities:'Utilities', insurance:'Insurance', construction:'Construction',
  merchandise:'Jersey Sales', marketing:'Marketing Campaign', medical:'Medical Bill',
  scouting_maintenance:'Scouting Overhead', specialist:'Specialist Consultations', other:'Other',
}
const CATEGORY_LABELS_PT: Record<string, string> = {
  tickets:'Venda de Bilhetes', concessions:'Concessões', supplies:'Reposição de Stock', suites:'Camarotes Premium', sponsor:'Patrocínios',
  nba_subsidy:'Subsídio NBA', staff:'Staff Técnico', travel:'Viagens Fora', maintenance:'Manutenção',
  operational:'Staff do Pavilhão', utilities:'Utilidades', insurance:'Seguros', construction:'Construção',
  merchandise:'Venda de Jerseys', marketing:'Campanha de Marketing', medical:'Despesas Médicas',
  scouting_maintenance:'Custos de Scouting', specialist:'Consultas a Especialistas', other:'Outros',
}
const CATEGORY_ICONS: Record<string, string> = {
  tickets:'🎟️', concessions:'🍔', supplies:'📦', suites:'⭐', sponsor:'🤝', nba_subsidy:'🏀',
  staff:'👔', travel:'✈️', maintenance:'🔧', operational:'🏟️', utilities:'⚡',
  insurance:'🛡️', construction:'🏗️', merchandise:'👕', marketing:'📣', medical:'🏥',
  scouting_maintenance:'🔍', specialist:'🩺', other:'📋',
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

type ProjRow = { key:string, label:string, icon:string, tip:string, value:number, active:boolean }
function StatementTable({ title, subtitle, revRows, expRows, netColor, isPT }: {
  title:string, subtitle:string, revRows:ProjRow[], expRows:ProjRow[], netColor:(v:number)=>string, isPT:boolean,
}) {
  const revTotal = revRows.reduce((s,r)=>s+r.value,0)
  const expTotal = expRows.reduce((s,r)=>s+r.value,0)
  const net = revTotal - expTotal
  return (
    <div style={{borderRadius:10,overflow:'hidden',border:'1px solid #d4cdc5',marginBottom:16}}>
      <div style={{padding:'10px 14px',background:'#f0ece5',borderBottom:'1px solid #d4cdc5'}}>
        <div style={{fontSize:13,fontWeight:800,color:'#1a1512'}}>{title}</div>
        <div style={{fontSize:10,color:'#8a8279'}}>{subtitle}</div>
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
        <tbody>
          <tr><td colSpan={2} style={{padding:'6px 14px',fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'1px',color:'#15803d',background:'#f5f9f5'}}>{isPT?'Receitas':'Income'}</td></tr>
          {revRows.map(r=>(
            <tr key={r.key} style={{borderBottom:'1px solid #f0ece5'}}>
              <td style={{padding:'6px 14px'}}>
                <Tip text={r.tip}>
                  <span style={{cursor:'help',color:r.active?'#1a1512':'#b0a89e'}}>{r.icon} {r.label}</span>
                </Tip>
              </td>
              <td style={{padding:'6px 14px',textAlign:'right',fontWeight:600,color:r.active?'#15803d':'#b0a89e'}}>{r.value!==0?fmt(r.value):'—'}</td>
            </tr>
          ))}
          <tr style={{borderTop:'2px solid #d4cdc5'}}>
            <td style={{padding:'6px 14px',fontWeight:700,color:'#5c554e'}}>{isPT?'Total Receitas':'Total Income'}</td>
            <td style={{padding:'6px 14px',textAlign:'right',fontWeight:800,color:'#15803d'}}>{fmt(revTotal)}</td>
          </tr>
          <tr><td colSpan={2} style={{padding:'6px 14px',fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'1px',color:'#dc2626',background:'#fbf5f5'}}>{isPT?'Despesas':'Expenses'}</td></tr>
          {expRows.map(r=>(
            <tr key={r.key} style={{borderBottom:'1px solid #f0ece5'}}>
              <td style={{padding:'6px 14px'}}>
                <Tip text={r.tip}>
                  <span style={{cursor:'help',color:r.active?'#1a1512':'#b0a89e'}}>{r.icon} {r.label}</span>
                </Tip>
              </td>
              <td style={{padding:'6px 14px',textAlign:'right',fontWeight:600,color:r.active?'#dc2626':'#b0a89e'}}>{r.value!==0?fmt(r.value):'—'}</td>
            </tr>
          ))}
          <tr style={{borderTop:'2px solid #d4cdc5'}}>
            <td style={{padding:'6px 14px',fontWeight:700,color:'#5c554e'}}>{isPT?'Total Despesas':'Total Expenses'}</td>
            <td style={{padding:'6px 14px',textAlign:'right',fontWeight:800,color:'#dc2626'}}>{fmt(expTotal)}</td>
          </tr>
          <tr style={{borderTop:'2px solid #1a1512'}}>
            <td style={{padding:'8px 14px',fontWeight:800,color:'#1a1512'}}>{isPT?'Resultado Líquido':'Net Result'}</td>
            <td style={{padding:'8px 14px',textAlign:'right',fontWeight:800,fontSize:13,color:netColor(net)}}>{net>=0?'+':''}{fmt(net)}</td>
          </tr>
        </tbody>
      </table>
    </div>
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
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'actual'|'projections'>('actual')
  const [period, setPeriod] = useState<'yearly'|'monthly'>('yearly')

  useEffect(() => {
    Promise.all([
      supabase.from('franchise_finances').select('*').eq('team_id', teamId).single(),
      supabase.from('franchise_transactions').select('*').eq('team_id', teamId).eq('season','2025-26').order('created_at',{ascending:false}),
    ]).then(([{data:ff},{data:tx}])=>{
      setFranchise(ff); setTransactions(tx||[])
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

  // Every projection row is now derived from this team's OWN real
  // transaction history — a trailing $/week rate per category, extrapolated
  // to a full regular season (24 weeks, see season-week-helper.ts) or to one
  // month (~4.33 weeks). Previously most of these were flat guesses,
  // identical for every team and completely disconnected from what the
  // simulation actually charged/paid — this is what caused the Balance
  // Sheet and Projections tabs to contradict each other outright.
  const SEASON_WEEKS = 24
  const WEEKS_PER_MONTH = 4.33
  const weekNumbers = transactions.map(t=>t.week_number).filter((w):w is number => w!=null)
  const weeksElapsed = weekNumbers.length ? Math.max(1, Math.max(...weekNumbers) - Math.min(...weekNumbers) + 1) : 0

  const REVENUE_KEYS: {key:string, tipEn:string, tipPt:string}[] = [
    {key:'nba_subsidy',  tipEn:'Fixed $500K, actually paid every 4 weeks',            tipPt:'500K$ fixos, pagos de verdade a cada 4 semanas'},
    {key:'tickets',      tipEn:'Real revenue from home game attendance',              tipPt:'Receita real da assistência nos jogos em casa'},
    {key:'concessions',  tipEn:'Real revenue from built concessions — Arena tab',      tipPt:'Receita real das concessões construídas — separador Pavilhão'},
    {key:'sponsor',      tipEn:'Real fixed + bonus sponsor payments — Sponsors tab',   tipPt:'Pagamentos reais de patrocínio, fixos + bónus — separador Patrocinadores'},
    {key:'merchandise',  tipEn:'Real jersey sales revenue',                           tipPt:'Receita real da venda de jerseys'},
  ]
  const EXPENSE_KEYS: {key:string, tipEn:string, tipPt:string}[] = [
    {key:'staff',        tipEn:'Real coaching staff salaries, charged every 4 weeks', tipPt:'Salários reais do staff técnico, cobrados a cada 4 semanas'},
    {key:'operational',  tipEn:'Real game-day arena staff cost',                      tipPt:'Custo real de staff do pavilhão em dias de jogo'},
    {key:'travel',       tipEn:'Real away-game travel cost',                          tipPt:'Custo real de viagens em jogos fora'},
    {key:'maintenance',  tipEn:'Real gym + concessions monthly maintenance',          tipPt:'Manutenção mensal real do ginásio + concessões'},
    {key:'utilities',    tipEn:'Fixed $80K, charged every 4 weeks',                   tipPt:'80K$ fixos, cobrados a cada 4 semanas'},
    {key:'insurance',    tipEn:'Fixed $40K, charged every 4 weeks — covers 75% of every medical bill', tipPt:'40K$ fixos, cobrados a cada 4 semanas — cobre 75% de cada despesa médica'},
    {key:'supplies',     tipEn:'Real concession restock cost',                        tipPt:'Custo real de reposição das concessões'},
    {key:'medical',      tipEn:'Real medical bills from injuries, net of the 75% insurance coverage', tipPt:'Despesas médicas reais de lesões, já com os 75% do seguro descontados'},
    {key:'marketing',    tipEn:'Real marketing campaign spend',                       tipPt:'Gasto real em campanhas de marketing'},
    {key:'construction', tipEn:'Real one-off construction cost',                      tipPt:'Custo real de construção (pontual)'},
    {key:'scouting_maintenance', tipEn:'Real weekly scouting operation overhead',      tipPt:'Custo semanal real da operação de scouting'},
    {key:'specialist',   tipEn:'Real cost of sending injured players to a specialist', tipPt:'Custo real de levar jogadores lesionados a um especialista'},
  ]
  const EMPTY_TIP_EN = 'No data yet this season'
  const EMPTY_TIP_PT = 'Ainda sem dados esta época'

  const sumByCategory = (txs: Transaction[], type:'revenue'|'expense') => {
    const m: Record<string, number> = {}
    txs.filter(t=>t.type===type).forEach(t => { m[t.category] = (m[t.category]||0) + t.amount })
    return m
  }
  const revSums = sumByCategory(transactions, 'revenue')
  const expSums = sumByCategory(transactions, 'expense')

  // Projections tab: an ESTIMATE, extrapolated forward from the trailing
  // $/week rate — see comment above.
  const buildProjectedRows = (defs: {key:string,tipEn:string,tipPt:string}[], sums: Record<string,number>, windowWeeks: number): ProjRow[] =>
    defs.map(d => {
      const total = sums[d.key] || 0
      const active = total > 0
      const value = weeksElapsed > 0 ? Math.round((total / weeksElapsed) * windowWeeks) : 0
      return {
        key: d.key, label: CATEGORY_LABELS[d.key] || d.key, icon: CATEGORY_ICONS[d.key] || '📋',
        tip: active ? (isPT ? d.tipPt : d.tipEn) : (isPT ? EMPTY_TIP_PT : EMPTY_TIP_EN),
        value, active,
      }
    })

  const annualRev = buildProjectedRows(REVENUE_KEYS, revSums, SEASON_WEEKS)
  const annualExp = buildProjectedRows(EXPENSE_KEYS, expSums, SEASON_WEEKS)
  const monthlyRev = buildProjectedRows(REVENUE_KEYS, revSums, WEEKS_PER_MONTH)
  const monthlyExp = buildProjectedRows(EXPENSE_KEYS, expSums, WEEKS_PER_MONTH)

  const sumVal = (rows: ProjRow[]) => rows.reduce((s,r)=>s+r.value,0)
  const monthlyNet = sumVal(monthlyRev) - sumVal(monthlyExp)

  // Balance Sheet tab: the REAL ledger, no extrapolation — every dollar
  // shown here actually happened. "Annual" is the plain season-to-date sum;
  // "Current Month" buckets by the SIMULATED in-game calendar month (the
  // same month/year every week's real scheduled dates fall into, per
  // season-week-helper.ts) — not a rolling 4-week window, and not real
  // wall-clock date. A rolling window kept showing a big number right after
  // a new in-game month started (still counting weeks from the tail end of
  // the previous month); this resets to near-zero the moment the season's
  // own calendar crosses into a new month, like an actual bank statement.
  // A week that straddles a month boundary is credited to whichever month
  // it FINISHES in, same convention the Player of the Month sweep uses.
  const weekMonthKey = (w: number) => { const d = getWeekDates(w).end; return `${d.getFullYear()}-${d.getMonth()}` }
  const maxSimWeek = weekNumbers.length ? Math.max(...weekNumbers) : 0
  const currentMonthKey = maxSimWeek > 0 ? weekMonthKey(maxSimWeek) : null
  const currentMonthTx = transactions.filter(t => t.week_number != null && currentMonthKey != null && weekMonthKey(t.week_number) === currentMonthKey)
  const monthActualRevSums = sumByCategory(currentMonthTx, 'revenue')
  const monthActualExpSums = sumByCategory(currentMonthTx, 'expense')

  const buildActualRows = (defs: {key:string,tipEn:string,tipPt:string}[], sums: Record<string,number>): ProjRow[] =>
    defs.map(d => {
      const total = sums[d.key] || 0
      const active = total > 0
      return {
        key: d.key, label: CATEGORY_LABELS[d.key] || d.key, icon: CATEGORY_ICONS[d.key] || '📋',
        tip: active ? (isPT ? d.tipPt : d.tipEn) : (isPT ? EMPTY_TIP_PT : EMPTY_TIP_EN),
        value: total, active,
      }
    })

  const annualActualRev = buildActualRows(REVENUE_KEYS, revSums)
  const annualActualExp = buildActualRows(EXPENSE_KEYS, expSums)
  const monthActualRev = buildActualRows(REVENUE_KEYS, monthActualRevSums)
  const monthActualExp = buildActualRows(EXPENSE_KEYS, monthActualExpSums)

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
            <div style={{display:'flex',gap:6,marginBottom:12}}>
              {[{k:'yearly',l:isPT?'📅 Anual':'📅 Yearly'},{k:'monthly',l:isPT?'🗓️ Mensal':'🗓️ Monthly'}].map((v:any)=>(
                <button key={v.k} onClick={()=>setPeriod(v.k)}
                  style={{padding:'5px 14px',fontSize:11,fontWeight:600,borderRadius:8,cursor:'pointer',
                    border:`1px solid ${period===v.k?teamColor:'#d4cdc5'}`,background:period===v.k?teamColor+'18':'#faf8f5',color:period===v.k?'#1a1512':'#5c554e'}}>
                  {v.l}
                </button>
              ))}
            </div>
            {period==='yearly' ? (
              <StatementTable
                title={isPT?'📅 Época Completa (Real)':'📅 Full Season (Actual)'}
                subtitle={isPT?'Soma real de tudo o que já entrou/saiu esta época':'Real sum of everything in/out so far this season'}
                revRows={annualActualRev} expRows={annualActualExp} netColor={v=>v>=0?'#15803d':'#dc2626'} isPT={isPT}
              />
            ) : (
              <StatementTable
                title={isPT?'🗓️ Mês Corrente (Real)':'🗓️ Current Month (Actual)'}
                subtitle={isPT?'Soma real do mês corrente da época simulada':'Real sum for the current month of the simulated season'}
                revRows={monthActualRev} expRows={monthActualExp} netColor={v=>v>=0?'#15803d':'#dc2626'} isPT={isPT}
              />
            )}
            <div style={{fontSize:12,fontWeight:700,color:'#5c554e',margin:'4px 0 8px'}}>{isPT?'Todos os Lançamentos':'All Transactions'}</div>
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
        weeksElapsed===0 ? (
          <div style={{padding:48,textAlign:'center',background:'#faf8f5',border:'1px dashed #d4cdc5',borderRadius:12}}>
            <div style={{fontSize:32,marginBottom:12}}>📊</div>
            <div style={{fontSize:14,fontWeight:700,color:'#1a1512',marginBottom:6}}>{isPT?'Ainda sem dados suficientes':'Not enough data yet'}</div>
            <div style={{fontSize:12,color:'#8a8279',lineHeight:1.6,maxWidth:360,margin:'0 auto'}}>
              {isPT?'As projeções são calculadas a partir dos teus lançamentos financeiros reais desta época — aparecem aqui assim que a simulação gerar os primeiros.':'Projections are calculated from your own real financial transactions this season — they appear here as soon as the simulation generates the first ones.'}
            </div>
          </div>
        ) : (
        <div>
          <div style={{marginBottom:14,padding:'8px 12px',borderRadius:8,background:'#fef9c3',border:'1px solid #d97706',fontSize:11,color:'#92400e',lineHeight:1.5}}>
            ⚠️ {isPT
              ?`Cada linha é calculada a partir do que esta equipa já cobrou/pagou de verdade esta época (${weeksElapsed} semana${weeksElapsed!==1?'s':''} de dados), projetado para um mês (~4.3 semanas) ou para a época toda (24 semanas). Não é um número igual para todas as equipas — muda com o teu desempenho real.`
              :`Every row is calculated from what this team has actually charged/paid so far this season (${weeksElapsed} week${weeksElapsed!==1?'s':''} of data), projected to one month (~4.3 weeks) or to the full season (24 weeks). Not the same number for every team — it moves with your real performance.`}
          </div>
          <div style={{display:'flex',gap:6,marginBottom:12}}>
            {[{k:'yearly',l:isPT?'📅 Anual':'📅 Yearly'},{k:'monthly',l:isPT?'🗓️ Mensal':'🗓️ Monthly'}].map((v:any)=>(
              <button key={v.k} onClick={()=>setPeriod(v.k)}
                style={{padding:'5px 14px',fontSize:11,fontWeight:600,borderRadius:8,cursor:'pointer',
                  border:`1px solid ${period===v.k?teamColor:'#d4cdc5'}`,background:period===v.k?teamColor+'18':'#faf8f5',color:period===v.k?'#1a1512':'#5c554e'}}>
                {v.l}
              </button>
            ))}
          </div>
          {period==='yearly' ? (
            <StatementTable
              title={isPT?'📅 Época Completa (Anual)':'📅 Full Season (Annual)'}
              subtitle={isPT?`Projeção a partir de ${weeksElapsed} semana${weeksElapsed!==1?'s':''} de dados reais, escalada para 24 semanas`:`Projected from ${weeksElapsed} week${weeksElapsed!==1?'s':''} of real data, scaled to 24 weeks`}
              revRows={annualRev} expRows={annualExp} netColor={v=>v>=0?'#15803d':'#dc2626'} isPT={isPT}
            />
          ) : (
            <StatementTable
              title={isPT?'🗓️ Mês Corrente':'🗓️ Current Month'}
              subtitle={isPT?'Projeção escalada para ~4.3 semanas':'Projected, scaled to ~4.3 weeks'}
              revRows={monthlyRev} expRows={monthlyExp} netColor={v=>v>=0?'#15803d':'#dc2626'} isPT={isPT}
            />
          )}
          {monthlyNet < 100000 && (
            <div style={{marginTop:4,padding:'10px 14px',background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:8,fontSize:11,color:'#5c554e',lineHeight:1.7}}>
              <strong style={{color:'#1a1512'}}>{isPT?'Como melhorar o teu resultado:':'How to improve your result:'}</strong><br/>
              {isPT?'🍔 Constrói concessões no separador Pavilhão para aumentar a receita por jogo':'🍔 Build concessions in the Arena tab to increase per-game revenue'}<br/>
              {isPT?'🤝 Assina patrocinadores no separador Patrocinadores para receita mensal fixa':'🤝 Sign sponsors in the Sponsors tab for monthly fixed income'}<br/>
              {isPT?'🎟️ Otimiza os preços dos bilhetes — encontra o equilíbrio entre preço e assistência':'🎟️ Optimise ticket pricing — find the sweet spot between price and attendance'}
            </div>
          )}
        </div>
        )
      )}
    </div>
  )
}

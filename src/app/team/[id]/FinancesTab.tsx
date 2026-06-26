'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type FinanceRow = {
  month: number
  year: number
  label: string
  // Revenues
  rev_tickets: number
  rev_concessions: number
  rev_suites: number
  rev_sponsors_fixed: number
  rev_sponsors_incentive: number
  rev_nba_subsidy: number
  // Expenses
  exp_coaching_staff: number
  exp_gym_maintenance: number
  exp_arena_maintenance: number
  exp_operational: number
  exp_utilities: number
  exp_insurance: number
  exp_travel: number
  exp_construction: number
  // Computed
  total_revenue: number
  total_expenses: number
  net: number
  balance_end: number
}

type Franchise = {
  balance: number
}

type CoachingSalary = {
  total_monthly: number
}

const MONTHS = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep']

function fmt(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1000000) return sign + '$' + (abs/1000000).toFixed(1) + 'M'
  if (abs >= 1000) return sign + '$' + (abs/1000).toFixed(0) + 'K'
  return sign + '$' + abs.toFixed(0)
}

function fmtFull(n: number) {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString()
}

type TooltipProps = { text: string, children: React.ReactNode }
function Tip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false)
  return (
    <span style={{position:'relative',display:'inline-flex',alignItems:'center'}}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      {children}
      {show && (
        <span style={{
          position:'absolute', bottom:'calc(100% + 6px)', left:'50%',
          transform:'translateX(-50%)', zIndex:100,
          background:'#1a1512', color:'#f5f1eb', fontSize:11,
          padding:'6px 10px', borderRadius:6, whiteSpace:'nowrap',
          boxShadow:'0 4px 12px rgba(0,0,0,0.3)',
          border:'1px solid rgba(255,255,255,0.1)',
          pointerEvents:'none',
        }}>{text}</span>
      )}
    </span>
  )
}

function NetBadge({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700,
      background: positive ? '#dcfce7' : '#fee2e2',
      color: positive ? '#15803d' : '#dc2626',
    }}>
      {positive ? '▲' : '▼'} {fmt(Math.abs(value))}
    </span>
  )
}

function BarChart({ rows }: { rows: FinanceRow[] }) {
  if (!rows.length) return null
  const maxVal = Math.max(...rows.map(r => Math.max(r.total_revenue, r.total_expenses)), 1)
  return (
    <div style={{display:'flex', alignItems:'flex-end', gap:4, height:80, padding:'0 4px'}}>
      {rows.map((r, i) => (
        <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
          <div style={{width:'100%', display:'flex', gap:1, alignItems:'flex-end', height:70}}>
            <div style={{
              flex:1, background:'#15803d', borderRadius:'2px 2px 0 0', opacity:0.8,
              height: `${(r.total_revenue/maxVal)*100}%`, minHeight:2,
            }}/>
            <div style={{
              flex:1, background:'#dc2626', borderRadius:'2px 2px 0 0', opacity:0.7,
              height: `${(r.total_expenses/maxVal)*100}%`, minHeight:2,
            }}/>
          </div>
          <span style={{fontSize:8, color:'#8a8279'}}>{r.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function FinancesTab({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const { profile } = useAuth()
  const isGM = (profile as any)?.team_id === teamId || profile?.role === 'commissioner'

  const [franchise, setFranchise] = useState<Franchise|null>(null)
  const [rows, setRows] = useState<FinanceRow[]>([])
  const [coachingSalary, setCoachingSalary] = useState(0)
  const [gymMaintenance, setGymMaintenance] = useState(50000)
  const [arenaMaintenance, setArenaMaintenance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'monthly'|'annual'>('monthly')
  const [selectedMonth, setSelectedMonth] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('franchise_finances').select('*').eq('team_id', teamId).single(),
      supabase.from('coaches').select('salary').eq('team_id', teamId),
      supabase.from('practice_facilities').select('monthly_cost').eq('team_id', teamId).single(),
      supabase.from('arena_concessions').select('monthly_maintenance').eq('team_id', teamId).single(),
      supabase.from('franchise_transactions').select('*').eq('team_id', teamId).eq('season','2025-26').order('created_at'),
    ]).then(([{data:ff},{data:coaches},{data:gym},{data:arena},{data:transactions}]) => {
      setFranchise(ff)
      const totalCoaching = (coaches||[]).reduce((t:number,c:any)=>t+(c.salary||0)/12, 0)
      setCoachingSalary(Math.round(totalCoaching))
      setGymMaintenance(gym?.monthly_cost || 50000)
      setArenaMaintenance(arena?.monthly_maintenance || 0)

      // Build monthly rows from transactions
      const monthMap: Record<string, any> = {}
      for (const t of (transactions||[])) {
        const key = `${t.week_number}`
        if (!monthMap[key]) monthMap[key] = { week: t.week_number, items: [] }
        monthMap[key].items.push(t)
      }

      // Generate estimated monthly rows for 2025-26 season (Oct 2025 - Jun 2026)
      const estimatedRows: FinanceRow[] = MONTHS.map((label, i) => {
        const month = i + 10 > 12 ? i + 10 - 12 : i + 10
        const year = i < 3 ? 2025 : 2026

        // Base estimates
        const rev_tickets = 450000
        const rev_concessions = 0
        const rev_suites = 0
        const rev_sponsors_fixed = 0
        const rev_sponsors_incentive = 0
        const rev_nba_subsidy = 500000

        const exp_coaching_staff = totalCoaching > 0 ? Math.round(totalCoaching) : 500000
        const exp_gym_maintenance = gym?.monthly_cost || 50000
        const exp_arena_maintenance = arena?.monthly_maintenance || 0
        const exp_operational = 100000
        const exp_utilities = 80000
        const exp_insurance = 40000
        const exp_travel = 200000
        const exp_construction = 0

        const total_revenue = rev_tickets + rev_concessions + rev_suites + rev_sponsors_fixed + rev_sponsors_incentive + rev_nba_subsidy
        const total_expenses = exp_coaching_staff + exp_gym_maintenance + exp_arena_maintenance + exp_operational + exp_utilities + exp_insurance + exp_travel + exp_construction
        const net = total_revenue - total_expenses

        return {
          month, year, label,
          rev_tickets, rev_concessions, rev_suites,
          rev_sponsors_fixed, rev_sponsors_incentive, rev_nba_subsidy,
          exp_coaching_staff, exp_gym_maintenance, exp_arena_maintenance,
          exp_operational, exp_utilities, exp_insurance, exp_travel, exp_construction,
          total_revenue, total_expenses, net,
          balance_end: (ff?.balance || 25000000) + net * (i + 1),
        }
      })

      setRows(estimatedRows)
      setLoading(false)
    })
  }, [teamId])

  if (!isGM) return (
    <div style={{padding:40,textAlign:'center',color:'#b0a89e',fontSize:13}}>
      🔒 Financial data is private to the franchise GM.
    </div>
  )

  if (loading) return <div style={{color:'#8a8279',padding:20}}>Loading finances...</div>

  const currentMonth = rows[selectedMonth]
  const annualNet = rows.reduce((t,r)=>t+r.net, 0)
  const annualRevenue = rows.reduce((t,r)=>t+r.total_revenue, 0)
  const annualExpenses = rows.reduce((t,r)=>t+r.total_expenses, 0)

  const REV_ROWS = [
    {key:'rev_nba_subsidy',       label:'NBA Subsidy',          tip:'Fixed $500K/month from NBA revenue sharing programme'},
    {key:'rev_tickets',           label:'Ticket Sales',         tip:'Home games only · depends on attendance, pricing and team performance'},
    {key:'rev_concessions',       label:'Concessions',          tip:'Food, drink, merchandise · per-person adoption rates apply'},
    {key:'rev_suites',            label:'Premium & Suites',     tip:'Corporate suites, club seats, courtside lounge · fixed per game'},
    {key:'rev_sponsors_fixed',    label:'Sponsors (fixed)',     tip:'Monthly fixed contracts with sponsors'},
    {key:'rev_sponsors_incentive',label:'Sponsors (incentive)', tip:'Bonus payments when performance targets are met'},
  ]

  const EXP_ROWS = [
    {key:'exp_coaching_staff',    label:'Coaching Staff',       tip:'Head coach + assistants + trainers + physios · annual salary ÷ 12'},
    {key:'exp_gym_maintenance',   label:'Practice Facility',    tip:'Monthly maintenance of gym grade + all extras (pool, sauna, etc.)'},
    {key:'exp_arena_maintenance', label:'Arena Concessions',    tip:'Monthly maintenance of all built concessions and amenities'},
    {key:'exp_operational',       label:'Arena Staff',          tip:'Security, cleaning, event staff, hospitality · fixed monthly'},
    {key:'exp_utilities',         label:'Utilities',            tip:'Energy, water, heating/cooling for arena and practice facility'},
    {key:'exp_insurance',         label:'Insurance',            tip:'Liability, property, and player accident insurance'},
    {key:'exp_travel',            label:'Away Travel',          tip:'~20 away games/month · flights, hotel, meals · fixed estimate'},
    {key:'exp_construction',      label:'Construction',         tip:'One-time costs of builds started this month (deducted at start)'},
  ]

  return (
    <div>
      {/* Balance header */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'14px 18px', borderRadius:12, marginBottom:16,
        background: (franchise?.balance||0) >= 0 ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${(franchise?.balance||0) >= 0 ? '#bbf7d0' : '#fecaca'}`,
      }}>
        <div>
          <div style={{fontSize:11,color:'#8a8279',marginBottom:2}}>Current Balance</div>
          <div style={{fontSize:24,fontWeight:800,color:(franchise?.balance||0)>=0?'#15803d':'#dc2626'}}>
            {fmt(franchise?.balance||0)}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:11,color:'#8a8279',marginBottom:2}}>Season projection</div>
          <NetBadge value={annualNet}/>
        </div>
      </div>

      {/* View toggle */}
      <div style={{display:'flex',gap:6,marginBottom:16}}>
        {[{k:'monthly',l:'Monthly'},{k:'annual',l:'Annual summary'}].map((v:any)=>(
          <button key={v.k} onClick={()=>setView(v.k)}
            style={{padding:'6px 16px',fontSize:12,fontWeight:600,borderRadius:8,cursor:'pointer',
                    border:`1px solid ${view===v.k?teamColor:'#d4cdc5'}`,
                    background:view===v.k?teamColor:'#f0ece5',
                    color:view===v.k?'#fff':'#5c554e'}}>
            {v.l}
          </button>
        ))}
      </div>

      {/* ── MONTHLY VIEW ── */}
      {view==='monthly' && (
        <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>

          {/* Month selector */}
          <div style={{width:120,flexShrink:0}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279',marginBottom:8}}>Month</div>
            <div style={{display:'flex',flexDirection:'column',gap:2}}>
              {rows.map((r,i)=>(
                <button key={i} onClick={()=>setSelectedMonth(i)}
                  style={{
                    padding:'6px 10px', fontSize:11, fontWeight:600,
                    borderRadius:6, border:'none', textAlign:'left', cursor:'pointer',
                    background: selectedMonth===i ? teamColor : 'transparent',
                    color: selectedMonth===i ? '#fff' : '#5c554e',
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                  }}>
                  <span>{r.label} '{r.year.toString().slice(2)}</span>
                  <span style={{fontSize:9,opacity:0.8}}>{r.net>=0?'▲':'▼'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Month detail */}
          {currentMonth && (
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:'#1a1512'}}>
                    {currentMonth.label} {currentMonth.year}
                  </div>
                  <div style={{fontSize:11,color:'#8a8279'}}>
                    Balance end of month: <strong style={{color:'#1a1512'}}>{fmt(currentMonth.balance_end)}</strong>
                  </div>
                </div>
                <NetBadge value={currentMonth.net}/>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>

                {/* REVENUES */}
                <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid #15803d`,borderRadius:10,padding:14}}>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#15803d',marginBottom:10}}>
                    Revenues
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8a8279',marginBottom:6,paddingBottom:6,borderBottom:'1px solid #e2dcd5'}}>
                    <span>Total</span>
                    <strong style={{color:'#15803d'}}>{fmt(currentMonth.total_revenue)}</strong>
                  </div>
                  {REV_ROWS.map(row=>{
                    const val = (currentMonth as any)[row.key] || 0
                    return (
                      <div key={row.key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid #f0ece5'}}>
                        <Tip text={row.tip}>
                          <span style={{fontSize:11,color: val>0?'#1a1512':'#b0a89e',cursor:'help',textDecoration:'underline dotted',textDecorationColor:'#c8c0b4'}}>
                            {row.label}
                          </span>
                        </Tip>
                        <span style={{fontSize:11,fontWeight:600,color:val>0?'#15803d':'#b0a89e'}}>
                          {val>0?fmt(val):'—'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* EXPENSES */}
                <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:`3px solid #dc2626`,borderRadius:10,padding:14}}>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#dc2626',marginBottom:10}}>
                    Expenses
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8a8279',marginBottom:6,paddingBottom:6,borderBottom:'1px solid #e2dcd5'}}>
                    <span>Total</span>
                    <strong style={{color:'#dc2626'}}>{fmt(currentMonth.total_expenses)}</strong>
                  </div>
                  {EXP_ROWS.map(row=>{
                    const val = (currentMonth as any)[row.key] || 0
                    return (
                      <div key={row.key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid #f0ece5'}}>
                        <Tip text={row.tip}>
                          <span style={{fontSize:11,color:val>0?'#1a1512':'#b0a89e',cursor:'help',textDecoration:'underline dotted',textDecorationColor:'#c8c0b4'}}>
                            {row.label}
                          </span>
                        </Tip>
                        <span style={{fontSize:11,fontWeight:600,color:val>0?'#dc2626':'#b0a89e'}}>
                          {val>0?fmt(val):'—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Net result bar */}
              <div style={{
                marginTop:12,padding:'10px 14px',borderRadius:8,
                background: currentMonth.net>=0?'#f0fdf4':'#fef2f2',
                border:`1px solid ${currentMonth.net>=0?'#bbf7d0':'#fecaca'}`,
                display:'flex',justifyContent:'space-between',alignItems:'center',
              }}>
                <Tip text="Total revenues minus total expenses for this month">
                  <span style={{fontSize:12,fontWeight:600,color:'#5c554e',cursor:'help'}}>Monthly result</span>
                </Tip>
                <span style={{fontSize:14,fontWeight:800,color:currentMonth.net>=0?'#15803d':'#dc2626'}}>
                  {currentMonth.net>=0?'+':''}{fmt(currentMonth.net)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ANNUAL VIEW ── */}
      {view==='annual' && (
        <div>
          {/* Summary cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
            {[
              {label:'Total Revenue',  val:annualRevenue,  color:'#15803d', tip:'Sum of all revenue streams across the full season'},
              {label:'Total Expenses', val:annualExpenses, color:'#dc2626', tip:'Sum of all costs across the full season'},
              {label:'Season Result',  val:annualNet,      color:annualNet>=0?'#15803d':'#dc2626', tip:'Net profit or loss for the 2025-26 season'},
            ].map(item=>(
              <Tip key={item.label} text={item.tip}>
                <div style={{background:'#faf8f5',border:`1px solid #d4cdc5`,borderTop:`3px solid ${item.color}`,borderRadius:10,padding:14,cursor:'help',width:'100%'}}>
                  <div style={{fontSize:10,color:'#8a8279',marginBottom:4}}>{item.label}</div>
                  <div style={{fontSize:20,fontWeight:800,color:item.color}}>{fmt(item.val)}</div>
                </div>
              </Tip>
            ))}
          </div>

          {/* Bar chart */}
          <div style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderRadius:10,padding:14,marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#8a8279'}}>Revenue vs Expenses</div>
              <div style={{display:'flex',gap:10,fontSize:10,color:'#8a8279'}}>
                <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,borderRadius:1,background:'#15803d',display:'inline-block'}}/>Revenue</span>
                <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:8,height:8,borderRadius:1,background:'#dc2626',display:'inline-block'}}/>Expenses</span>
              </div>
            </div>
            <BarChart rows={rows}/>
          </div>

          {/* Annual breakdown table */}
          <div style={{borderRadius:10,overflow:'hidden',border:'1px solid #d4cdc5'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                  <th style={{padding:'8px 12px',textAlign:'left',fontWeight:700,color:'#5c554e'}}>Month</th>
                  <th style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:'#15803d'}}>Revenue</th>
                  <th style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:'#dc2626'}}>Expenses</th>
                  <th style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:'#5c554e'}}>Net</th>
                  <th style={{padding:'8px 12px',textAlign:'right',fontWeight:700,color:'#5c554e'}}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i)=>(
                  <tr key={i} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5',cursor:'pointer'}}
                    onClick={()=>{setView('monthly');setSelectedMonth(i)}}>
                    <td style={{padding:'7px 12px',fontWeight:600,color:'#1a1512'}}>{r.label} '{r.year.toString().slice(2)}</td>
                    <td style={{padding:'7px 10px',textAlign:'right',color:'#15803d',fontWeight:500}}>{fmt(r.total_revenue)}</td>
                    <td style={{padding:'7px 10px',textAlign:'right',color:'#dc2626',fontWeight:500}}>{fmt(r.total_expenses)}</td>
                    <td style={{padding:'7px 10px',textAlign:'right'}}>
                      <NetBadge value={r.net}/>
                    </td>
                    <td style={{padding:'7px 12px',textAlign:'right',fontWeight:600,color:'#1a1512'}}>{fmt(r.balance_end)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:'#f0ece5',borderTop:'2px solid #d4cdc5'}}>
                  <td style={{padding:'8px 12px',fontWeight:700,color:'#1a1512'}}>Season Total</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:'#15803d'}}>{fmt(annualRevenue)}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:'#dc2626'}}>{fmt(annualExpenses)}</td>
                  <td style={{padding:'8px 10px',textAlign:'right'}}><NetBadge value={annualNet}/></td>
                  <td style={{padding:'8px 12px',textAlign:'right',fontWeight:700,color:'#1a1512'}}>{fmt((franchise?.balance||0)+annualNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{marginTop:10,fontSize:10,color:'#8a8279'}}>
            Click any month to see the detailed breakdown.
          </div>
        </div>
      )}
    </div>
  )
}

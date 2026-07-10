'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/I18nProvider'

const SEASONS = ['2025-26','2026-27','2027-28','2028-29','2029-30']
const SALARY_CAP = 180_000_000 // matches teams.salary_cap, the cap used everywhere else in the app
const CURRENT_SEASON = '2025-26'
const CURRENT_YEAR = 2025

function fmt(n: number) { if (!n) return '—'; return '$'+(n/1000000).toFixed(1)+'M' }
function barColor(pct: number) {
  if (pct > 120) return '#e04040'; if (pct > 100) return '#ffa040'
  if (pct > 85) return '#ffd040'; return '#40e080'
}

export default function ContractsTable({ teamId, teamColor }: { teamId: string, teamColor: string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('id,name,pos,salary,contract_years').eq('team_id', teamId).eq('status','active').order('salary',{ascending:false}),
      // Cut players still count against THIS team's cap as dead money until
      // another team signs them (see /api/players/cut) — the roster query
      // above can't see them since team_id is already null.
      supabase.from('players').select('id,name,pos,dead_cap_amount').eq('previous_team_id', teamId).gt('dead_cap_amount', 0),
    ]).then(([{ data }, { data: deadCapPlayers }]) => {
      if (!data) return
      const built = data.map((p:any) => {
        const salaries: Record<string,number> = {}
        for (let i = 0; i < (p.contract_years||1); i++) {
          const yr = CURRENT_YEAR + i
          const s = `${yr}-${String(yr+1).slice(2)}`
          if (SEASONS.includes(s)) salaries[s] = p.salary
        }
        return { id:p.id, name:p.name, pos:p.pos, salary:p.salary, contract_years:p.contract_years, salaries, isDeadCap:false }
      })
      const deadRows = (deadCapPlayers||[]).map((p:any) => ({
        id:p.id, name:p.name, pos:p.pos, salary:p.dead_cap_amount, contract_years:1,
        salaries: { [CURRENT_SEASON]: p.dead_cap_amount }, isDeadCap:true,
      }))
      setRows([...built, ...deadRows]); setLoading(false)
    })
  }, [teamId])

  if (loading) return <div className="p-8 text-center text-sm" style={{color:'#6a5a4a'}}>{t('common.loading')}</div>

  const totals = SEASONS.reduce((acc,s) => { acc[s]=rows.reduce((sum,p)=>sum+(p.salaries[s]||0),0); return acc }, {} as Record<string,number>)
  const currentTotal = totals[CURRENT_SEASON] || 0
  const capPct = (currentTotal/SALARY_CAP)*100

  const cards = [
    {
      label: isPT ? 'Total Comprometido' : 'Total Committed',
      value: fmt(currentTotal),
      sub: isPT ? 'Época 2025-26' : '2025-26 season',
      color: barColor(capPct),
    },
    {
      label: isPT ? 'Margem Salarial' : 'Cap Space',
      value: currentTotal < SALARY_CAP ? fmt(SALARY_CAP - currentTotal) : '—',
      sub: currentTotal > SALARY_CAP ? (isPT ? 'Acima do tecto' : 'Over the cap') : (isPT ? 'Disponível' : 'Available'),
      color: currentTotal > SALARY_CAP ? '#e04040' : '#40e080',
    },
  ]

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {cards.map(card => (
          <div key={card.label} className="rounded-xl p-4" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
            <div className="text-xs mb-1" style={{color:'#8a8279'}}>{card.label}</div>
            <div className="text-xl font-black" style={{color:card.color}}>{card.value}</div>
            <div className="text-xs mt-0.5" style={{color:'#a89f97'}}>{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 mb-6" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
        <div className="flex justify-between text-xs mb-2" style={{color:'#8a8279'}}>
          <span>{isPT ? 'Folha Salarial 2025-26' : '2025-26 Payroll'}</span>
          <span style={{color:barColor(capPct)}}>{fmt(currentTotal)} / {fmt(SALARY_CAP)} {isPT ? 'tecto' : 'cap'}</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{background:'#e2dcd5'}}>
          <div className="h-full rounded-full transition-all" style={{width:Math.min(capPct,130)+'%',background:barColor(capPct),maxWidth:'100%'}}/>
        </div>
        <div className="flex justify-between text-xs mt-1" style={{color:'#a89f97'}}>
          <span>$0</span>
          <span>{isPT ? 'Tecto' : 'Cap'} ${(SALARY_CAP/1000000).toFixed(0)}M</span>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f0ece5'}}>
                <th className="px-4 py-3 text-left sticky left-0" style={{color:'#5c554e',background:'#f0ece5',borderBottom:'2px solid #d4cdc5',minWidth:160}}>
                  {isPT ? 'Jogador' : 'Player'}
                </th>
                <th className="px-3 py-3 text-center w-12" style={{color:'#5c554e',background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                  {isPT ? 'Pos' : 'Pos'}
                </th>
                {SEASONS.map((s,i) => (
                  <th key={s} className="px-4 py-3 text-right whitespace-nowrap"
                      style={{color:i===0?'#b45309':'#8a8279',background:'#f0ece5',borderBottom:'2px solid #d4cdc5',minWidth:100,fontWeight:i===0?700:500}}>
                    {s}{i===0?' ★':''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p,i) => (
                <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                  <td className="px-4 py-2.5 sticky left-0" style={{background:i%2===0?'#faf8f5':'#f5f1eb'}}>
                    <span className="font-semibold" style={{color:p.isDeadCap?'#8a8279':'#1a1512'}}>{p.name}</span>
                    {p.isDeadCap && <span className="ml-1.5 text-xs font-bold" style={{color:'#dc2626',fontSize:9}}>💀 {isPT?'DINHEIRO MORTO':'DEAD CAP'}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center" style={{color:'#8a8279'}}>{p.isDeadCap?'—':p.pos}</td>
                  {SEASONS.map((s,si) => {
                    const sal = p.salaries[s]
                    const isLast = sal && !p.salaries[SEASONS[si+1]] && !p.isDeadCap
                    return (
                      <td key={s} className="px-4 py-2.5 text-right font-semibold"
                          style={{color:sal?(p.isDeadCap?'#8a8279':isLast&&si<4?'#b45309':'#1a1512'):'#d4cdc5'}}>
                        {sal?fmt(sal):'—'}
                        {sal&&isLast&&si<4&&<span className="ml-1 text-xs" style={{color:'#ffa040',fontSize:9}}>{isPT?'EXP':'EXP'}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr style={{background:'#1a1512',borderTop:'2px solid #b45309'}}>
                <td className="px-4 py-3 font-black sticky left-0" style={{color:'#f5a623',background:'#1a1512'}}>
                  {isPT ? 'FOLHA SALARIAL TOTAL' : 'TOTAL PAYROLL'}
                </td>
                <td style={{background:'#1a1512'}}></td>
                {SEASONS.map(s => (
                  <td key={s} className="px-4 py-3 text-right font-black"
                      style={{color:totals[s]>SALARY_CAP?'#e04040':totals[s]>SALARY_CAP*0.9?'#ffa040':'#f5a623'}}>
                    {fmt(totals[s])}
                  </td>
                ))}
              </tr>
              <tr style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5'}}>
                <td className="px-4 py-2 sticky left-0" style={{color:'#8a8279',background:'#f5f1eb',fontSize:11}}>
                  {isPT ? 'Tecto Salarial' : 'Salary Cap'}
                </td>
                <td style={{background:'#f5f1eb'}}></td>
                {SEASONS.map(s => <td key={s} className="px-4 py-2 text-right" style={{color:'#8a8279',fontSize:11}}>${(SALARY_CAP/1000000).toFixed(0)}M</td>)}
              </tr>
              <tr style={{background:'#f5f1eb'}}>
                <td className="px-4 py-2 sticky left-0" style={{color:'#8a8279',background:'#f5f1eb',fontSize:11}}>
                  {isPT ? 'Margem / Excesso' : 'Space / Over'}
                </td>
                <td style={{background:'#f5f1eb'}}></td>
                {SEASONS.map(s => {
                  const diff = SALARY_CAP-(totals[s]||0)
                  return <td key={s} className="px-4 py-2 text-right font-semibold" style={{fontSize:11,color:diff>=0?'#15803d':'#e04040'}}>
                    {diff>=0?'+':''}{fmt(Math.abs(diff))}
                  </td>
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs mt-3" style={{color:'#8a8279'}}>
        {isPT ? '★ Época atual · EXP = contrato a expirar · Salários fixos em todos os anos do contrato' : '★ Current season · EXP = expiring contract · Salaries are fixed for all contract years'}
      </p>
    </div>
  )
}

'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

type Mode = 'stats' | 'attributes'

// Keyed by column `key`, not `label` — several attribute columns reuse the
// exact same display label as a per-game stats column (DREB/OREB appear in
// both STAT_COLS and ATTR_COLS), so a label-keyed lookup let the wrong
// tooltip ("per game" text) show up under the attribute-mode header.
const TOOLTIPS_EN: Record<string, string> = {
  ppg:'Points Per Game', rpg:'Total Rebounds Per Game', orpg:'Offensive Rebounds Per Game',
  drpg:'Defensive Rebounds Per Game', apg:'Assists Per Game', spg:'Steals Per Game',
  bpg:'Blocks Per Game', fgpct:'Field Goal %', tppct:'Three-Point %', ftpct:'Free Throw %',
  topg:'Turnovers Per Game', pfpg:'Personal Fouls Per Game', tf:'Technical Fouls (season total)',
  salary:'Current season salary',
  health:"This week's real health (0-100) — feeds in-game fatigue and injury chance.",
  moral:"This player's real moral (0-100) — feeds shot accuracy and weekly attribute growth.",
  three:'Three-Point Shooting (0-100)', layup:'Layup (0-100)', dunk:'Dunk (0-100)',
  mid:'Mid-Range (0-100)', ft:'Free Throw (0-100)', siq:'Shot IQ (0-100)',
  draw_foul:'Draw Foul (0-100)', blk:'Block (0-100)', stl:'Steal (0-100)',
  idef:'Interior Defense (0-100)', pdef:'Perimeter Defense (0-100)',
  def_reb:'Defensive Rebound (0-100)', off_reb:'Offensive Rebound (0-100)',
  stamina:'Stamina (0-100)', durability:'Durability (0-100)', ball_hdl:'Ball Handle (0-100)',
  pass_vis:'Pass Vision (0-100)', pass_iq:'Pass IQ (0-100)', assist_role:'Assist Role (0-100)',
  pressure:'Clutch (0-100)', consistency:'Consistency (0-100)', crowd_effect:'Crowd Effect (0-100)', streaky:'Streaky (0-100)',
}

const TOOLTIPS_PT: Record<string, string> = {
  ppg:'Pontos Por Jogo', rpg:'Total de Ressaltos Por Jogo', orpg:'Ressaltos Ofensivos Por Jogo',
  drpg:'Ressaltos Defensivos Por Jogo', apg:'Assistências Por Jogo', spg:'Roubos de Bola Por Jogo',
  bpg:'Desarmes de Lançamento Por Jogo', fgpct:'% de Lançamentos de Campo', tppct:'% de Lançamentos de 3 Pontos', ftpct:'% de Lances Livres',
  topg:'Perdas de Bola Por Jogo', pfpg:'Faltas Pessoais Por Jogo', tf:'Faltas Técnicas (total da época)',
  salary:'Salário da época actual',
  health:'Saúde real desta semana (0-100) — alimenta a fadiga em jogo e a chance de lesão.',
  moral:'Moral real deste jogador (0-100) — alimenta a pontaria e o desenvolvimento semanal de atributos.',
  three:'Lançamento de 3 Pontos (0-100)', layup:'Layup (0-100)', dunk:'Dunk (0-100)',
  mid:'Meia Distância (0-100)', ft:'Lances Livres (0-100)', siq:'Shot IQ (0-100)',
  draw_foul:'Provoca Falta (0-100)', blk:'Desarme de Lançamento (0-100)', stl:'Roubo de Bola (0-100)',
  idef:'Defesa Interior (0-100)', pdef:'Defesa de Perímetro (0-100)',
  def_reb:'Ressalto Defensivo (0-100)', off_reb:'Ressalto Ofensivo (0-100)',
  stamina:'Resistência/Stamina (0-100)', durability:'Durabilidade (0-100)', ball_hdl:'Drible (0-100)',
  pass_vis:'Visão de Jogo (0-100)', pass_iq:'Pass IQ (0-100)', assist_role:'Perfil de Assistência (0-100)',
  pressure:'Clutch/Pressão (0-100)', consistency:'Consistência (0-100)', crowd_effect:'Influência do Público (0-100)', streaky:'Irregular (0-100)',
}

function TH({ col, sortKey, sortDir, onSort, tooltips }: {
  col: { key: string, label: string, color: string, numeric: boolean },
  sortKey: string, sortDir: string,
  onSort: (k: string, n: boolean) => void,
  tooltips: Record<string, string>
}) {
  const tip = tooltips[col.key]
  const isActive = sortKey === col.key
  return (
    <th onClick={() => onSort(col.key, col.numeric)}
        className={`px-3 py-2.5 font-semibold select-none whitespace-nowrap ${col.numeric ? 'text-right cursor-pointer' : 'text-left'} ${col.key === 'name' ? 'sticky left-0 z-10' : ''}`}
        style={{ color: isActive ? (col.color||'#1d4ed8') : '#5c554e', background: col.key==='name' ? '#eee8df' : undefined }}>
      <span className="inline-flex items-center gap-0.5 group relative">
        {col.label}
        {tip && (
          <>
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full ml-0.5 flex-shrink-0"
                  style={{ background:'#d4cdc5', color:'#1e40af', fontSize:8, lineHeight:1 }}>i</span>
            <span className="absolute top-full left-0 mt-1 px-2.5 py-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
                  style={{ background:'#1a1512', color:'#f5f1eb', width:200, whiteSpace:'normal', lineHeight:1.5, fontWeight:400 }}>
              {tip}
            </span>
          </>
        )}
        {isActive && <span className="ml-0.5 text-xs">{sortDir==='desc'?'↓':'↑'}</span>}
      </span>
    </th>
  )
}

function attrColor(v: number) {
  if (v >= 90) return '#b45309'; if (v >= 80) return '#15803d'
  if (v >= 70) return '#1d4ed8'; if (v >= 60) return '#1a1512'; return '#5c554e'
}

const STAT_COLS = [
  { key:'name', label:'Player', color:'', numeric:false },
  { key:'pos',  label:'Pos',   color:'', numeric:false },
  { key:'ppg',   label:'PPG',   color:'#c2410c', numeric:true },
  { key:'rpg',   label:'RPG',   color:'#1e40af', numeric:true },
  { key:'orpg',  label:'OREB',  color:'#3a9aff', numeric:true },
  { key:'drpg',  label:'DREB',  color:'#2a7acf', numeric:true },
  { key:'apg',   label:'APG',   color:'#0e7490', numeric:true },
  { key:'spg',   label:'SPG',   color:'#7c3aed', numeric:true },
  { key:'bpg',   label:'BPG',   color:'#ff6040', numeric:true },
  { key:'fgpct', label:'FG%',   color:'#1a1512', numeric:true },
  { key:'tppct', label:'3P%',   color:'#b45309', numeric:true },
  { key:'ftpct', label:'FT%',   color:'#0e7490', numeric:true },
  { key:'topg',  label:'TO',    color:'#dc2626', numeric:true },
  { key:'pfpg',  label:'PF',    color:'#e06060', numeric:true },
  { key:'tf',    label:'TF',    color:'#ff4040', numeric:true },
  { key:'salary',label:'Salary',color:'#6b5f4e', numeric:true },
]

const ATTR_COLS = [
  { key:'name', label:'Player', color:'', numeric:false },
  { key:'pos',  label:'Pos',   color:'', numeric:false },
  { key:'health',label:'HLTH',color:'#166534',numeric:true},
  { key:'moral', label:'MRL', color:'#7c3aed',numeric:true},
  { key:'three',label:'3PT',color:'#b45309',numeric:true},
  { key:'layup',label:'LAY',color:'#c2410c',numeric:true},
  { key:'dunk', label:'DNK',color:'#ff6040',numeric:true},
  { key:'mid',  label:'MID',color:'#c2410c',numeric:true},
  { key:'ft',   label:'FT', color:'#0e7490',numeric:true},
  { key:'siq',  label:'SIQ',color:'#c2410c',numeric:true},
  { key:'draw_foul',label:'DF',color:'#c2410c',numeric:true},
  { key:'blk',  label:'BLK',color:'#ff6040',numeric:true},
  { key:'stl',  label:'STL',color:'#7c3aed',numeric:true},
  { key:'idef', label:'IDEF',color:'#166534',numeric:true},
  { key:'pdef', label:'PDEF',color:'#166534',numeric:true},
  { key:'def_reb',label:'DREB',color:'#1e40af',numeric:true},
  { key:'off_reb',label:'OREB',color:'#1e40af',numeric:true},
  { key:'stamina',label:'STA',color:'#7c3aed',numeric:true},
  { key:'durability',label:'DUR',color:'#7c3aed',numeric:true},
  { key:'ball_hdl',label:'BH',color:'#0e7490',numeric:true},
  { key:'pass_vis',label:'PV',color:'#0e7490',numeric:true},
  { key:'pass_iq',label:'PIQ',color:'#0e7490',numeric:true},
  { key:'assist_role',label:'AR',color:'#0e7490',numeric:true},
  { key:'pressure',label:'CLU',color:'#b45309',numeric:true},
  { key:'consistency',label:'CON',color:'#b45309',numeric:true},
  { key:'crowd_effect',label:'CE',color:'#b45309',numeric:true},
  { key:'streaky',label:'STR',color:'#b45309',numeric:true},
]

export default function RosterTable({ players, teamColor }: { players: any[], teamColor: string }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const TOOLTIPS = isPT ? TOOLTIPS_PT : TOOLTIPS_EN

  const [mode, setMode] = useState<Mode>('stats')
  const [sortKey, setSortKey] = useState('ppg')
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc')

  const rows = players.map((p: any) => {
    const s = p.player_stats?.[0] || {}
    const gp = s.games || 0
    const avg = (v: number) => gp > 0 ? parseFloat((v / gp).toFixed(1)) : 0
    const orpg = gp > 0 ? parseFloat(((s.off_reb||0)/gp).toFixed(1)) : 0
    const drpg = gp > 0 ? parseFloat(((s.def_reb||0)/gp).toFixed(1)) : 0
    return {
      id:p.id, name:p.name, pos:p.pos, photo_url:p.photo_url, salary:p.salary,
      ppg:avg(s.pts), rpg:parseFloat((orpg+drpg).toFixed(1))||avg(s.reb),
      orpg, drpg, apg:avg(s.ast), spg:avg(s.stl), bpg:avg(s.blk),
      fgpct:s.fga>0?parseFloat((s.fgm/s.fga*100).toFixed(1)):0,
      tppct:s.tpa>0?parseFloat((s.tpm/s.tpa*100).toFixed(1)):0,
      ftpct:s.fta>0?parseFloat((s.ftm/s.fta*100).toFixed(1)):0,
      topg:avg(s.turnovers), pfpg:gp>0?parseFloat(((s.fouls||0)/gp).toFixed(1)):0, tf:s.tech_fouls||0,
      health:p.health??100, moral:p.moral??80,
      three:p.three, layup:p.layup, dunk:p.dunk, mid:p.mid, ft:p.ft, siq:p.siq,
      draw_foul:p.draw_foul, blk:p.blk, stl:p.stl, idef:p.idef, pdef:p.pdef,
      def_reb:p.def_reb, off_reb:p.off_reb, stamina:p.stamina, durability:p.durability,
      ball_hdl:p.ball_hdl, pass_vis:p.pass_vis, pass_iq:p.pass_iq, assist_role:p.assist_role,
      pressure:p.pressure, consistency:p.consistency, crowd_effect:p.crowd_effect, streaky:p.streaky,
    }
  })

  const handleSort = (key: string, numeric: boolean) => {
    if (!numeric) return
    if (sortKey === key) setSortDir(d => d==='desc'?'asc':'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...rows].sort((a:any, b:any) => {
    const av=a[sortKey], bv=b[sortKey]
    if (typeof av==='number' && typeof bv==='number') return sortDir==='desc' ? bv-av : av-bv
    return 0
  })

  // Patch 'Player' label and 'Salary' label based on language
  const getColsWithLabels = (cols: typeof STAT_COLS) => cols.map(col => {
    if (col.key === 'name') return { ...col, label: isPT ? 'Jogador' : 'Player' }
    if (col.key === 'salary') return { ...col, label: isPT ? 'Salário' : 'Salary' }
    return col
  })

  const cols = getColsWithLabels(mode === 'stats' ? STAT_COLS : ATTR_COLS)

  const capFmt = (n:number) => n>=1000000?'$'+(n/1000000).toFixed(1)+'M':'$'+n.toLocaleString()
  const fmtVal = (key:string, val:any) => {
    if (key==='salary') return capFmt(val)
    if (['fgpct','tppct','ftpct'].includes(key)) return val>0?val+'%':'—'
    if (typeof val==='number') return val>0?val:'—'
    return val
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'#ddd7ca',border:'1px solid #d4cec3'}}>
          {(['stats','attributes'] as Mode[]).map(m=>(
            <button key={m} onClick={()=>{setMode(m);setSortKey(m==='stats'?'ppg':'three');setSortDir('desc')}}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{background:mode===m?'#d4cdc5':'transparent',color:mode===m?'#1d4ed8':'#5c554e'}}>
              {m==='stats' ? '📊 Stats' : (isPT ? '⚡ Atributos' : '⚡ Attributes')}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{color:'#9c8e7a'}}>
          {isPT ? 'Clica coluna para ordenar' : 'Click column to sort'}
        </span>
      </div>

      <div className="rounded-xl overflow-x-auto mb-2" style={{border:'1px solid #d4cec3',overflowY:'visible'}}>
        <table className="w-full text-xs" style={{minWidth:mode==='attributes'?900:640,borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
              {cols.map(col => (
                <TH key={col.key} col={col} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} tooltips={TOOLTIPS} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p:any,i:number)=>(
              <tr key={p.id} style={{background:i%2===0?'#ece7dd':'#e8e2d6',borderBottom:'1px solid #16120d'}}
                  className="hover:brightness-110 transition-all">
                {cols.map(col=>{
                  if (col.key==='name') return (
                    <td key="name" className="px-3 py-2 sticky left-0 z-10"
                        style={{background:i%2===0?'#ece7dd':'#e8e2d6'}}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0" style={{background:teamColor+'22'}}>
                          {p.photo_url
                            ?<img src={p.photo_url} alt="" className="w-full h-full object-cover"/>
                            :<div className="w-full h-full flex items-center justify-center text-xs font-black" style={{color:teamColor}}>
                               {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                             </div>}
                        </div>
                        <Link href={`/player/${p.id}`} className="font-semibold no-underline transition-colors whitespace-nowrap" style={{color:'#1a1512'}}
                              onMouseEnter={e=>e.currentTarget.style.color='#c8102e'} onMouseLeave={e=>e.currentTarget.style.color='#1a1512'}>
                          {p.name}
                        </Link>
                      </div>
                    </td>
                  )
                  if (col.key==='pos') return <td key="pos" className="px-3 py-2" style={{color:'#6b5f4e'}}>{p.pos}</td>
                  const val=(p as any)[col.key]
                  const isActive=sortKey===col.key
                  return (
                    <td key={col.key} className="px-3 py-2 text-right font-semibold"
                        style={{
                          color:mode==='attributes'&&col.numeric&&typeof val==='number'?attrColor(val):col.color||'#1a1512',
                          background:isActive?teamColor+'11':undefined,
                        }}>
                      {fmtVal(col.key,val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{color:'#b8ae9e'}}>
        {sorted.length} {isPT ? 'jogadores' : 'players'} · {mode==='stats'
          ? (isPT ? 'Médias por jogo · TF = faltas técnicas da época' : 'Per game averages · TF = season total technical fouls')
          : (isPT ? 'Avaliações 0–100 · Ouro ≥90 · Verde ≥80 · Azul ≥70' : 'Ratings 0–100 · Gold ≥90 · Green ≥80 · Blue ≥70')}
      </p>
    </div>
  )
}

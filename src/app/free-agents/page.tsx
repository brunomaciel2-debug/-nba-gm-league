'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcOvr, ovrColor } from '@/lib/ovr'
import { useTranslation } from '@/components/I18nProvider'

const POSITIONS = ['All','PG','SG','SF','PF','C']
type Mode = 'stats' | 'attributes'
type Tab  = 'players' | 'gleague' | 'staff'

const TOOLTIPS: Record<string,string> = {
  '3PT':'Three-Point Shooting (0-100)', LAY:'Layup (0-100)', DNK:'Dunk (0-100)',
  MID:'Mid-Range (0-100)', FT:'Free Throw (0-100)', SIQ:'Shot IQ (0-100)',
  DF:'Draw Foul (0-100)', BLK:'Block (0-100)', STL:'Steal (0-100)',
  IDEF:'Interior Defense (0-100)', PDEF:'Perimeter Defense (0-100)',
  DREB:'Def. Rebound (0-100)', OREB:'Off. Rebound (0-100)',
  STA:'Stamina (0-100)', DUR:'Durability (0-100)',
  BH:'Ball Handle (0-100)', PV:'Pass Vision (0-100)', PIQ:'Pass IQ (0-100)',
  AR:'Assist Role (0-100)', CLU:'Clutch (0-100)', CON:'Consistency (0-100)',
  CE:'Crowd Effect (0-100)', STR:'Streaky (0-100)',
  OVR:'Overall rating', AGE:'Player age', EXP:'NBA seasons played',
}

const TOOLTIPS_PT: Record<string,string> = {
  '3PT':'Lançamento de 3 Pontos (0-100)', LAY:'Layup (0-100)', DNK:'Afundanço (0-100)',
  MID:'Meia Distância (0-100)', FT:'Lance Livre (0-100)', SIQ:'Shot IQ (0-100)',
  DF:'Provoca Falta (0-100)', BLK:'Desarme de Lançamento (0-100)', STL:'Roubo de Bola (0-100)',
  IDEF:'Defesa Interior (0-100)', PDEF:'Defesa de Perímetro (0-100)',
  DREB:'Ressalto Defensivo (0-100)', OREB:'Ressalto Ofensivo (0-100)',
  STA:'Resistência (0-100)', DUR:'Durabilidade (0-100)',
  BH:'Drible (0-100)', PV:'Visão de Jogo (0-100)', PIQ:'Pass IQ (0-100)',
  AR:'Perfil de Assistência (0-100)', CLU:'Clutch (0-100)', CON:'Consistência (0-100)',
  CE:'Influência do Público (0-100)', STR:'Irregular (0-100)',
  OVR:'Classificação geral', AGE:'Idade do jogador', EXP:'Épocas de NBA jogadas',
}

const ATTR_COLS = [
  {key:'three',label:'3PT'},{key:'layup',label:'LAY'},{key:'dunk',label:'DNK'},
  {key:'mid',label:'MID'},{key:'ft',label:'FT'},{key:'siq',label:'SIQ'},
  {key:'draw_foul',label:'DF'},{key:'blk',label:'BLK'},{key:'stl',label:'STL'},
  {key:'idef',label:'IDEF'},{key:'pdef',label:'PDEF'},{key:'def_reb',label:'DREB'},
  {key:'off_reb',label:'OREB'},{key:'stamina',label:'STA'},{key:'durability',label:'DUR'},
  {key:'ball_hdl',label:'BH'},{key:'pass_vis',label:'PV'},{key:'pass_iq',label:'PIQ'},
  {key:'assist_role',label:'AR'},{key:'pressure',label:'CLU'},{key:'consistency',label:'CON'},
  {key:'crowd_effect',label:'CE'},{key:'streaky',label:'STR'},
]

function attrColor(v: number) {
  if (v >= 90) return '#b45309'; if (v >= 80) return '#15803d'
  if (v >= 70) return '#1d4ed8'; if (v >= 60) return '#1a1512'; return '#8a8279'
}

function salaryRange(ovr: number) {
  if (ovr >= 90) return '$30M–$45M'; if (ovr >= 85) return '$20M–$30M'
  if (ovr >= 80) return '$12M–$20M'; if (ovr >= 75) return '$8M–$14M'
  if (ovr >= 70) return '$5M–$10M';  if (ovr >= 65) return '$3M–$6M'
  if (ovr >= 60) return '$1.5M–$4M'; return '$1M–$2.5M'
}

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12,borderRadius:'50%',background:'#d4cdc5',color:'#5c554e',fontSize:8,fontWeight:700,lineHeight:1}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2 py-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{background:'#1a1512',color:'#f5f1eb',width:180,whiteSpace:'normal',lineHeight:1.4,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>
        {text}
      </span>
    </span>
  )
}

function SortTh({ label, active, dir, onClick, isPT }: { label: string, active: boolean, dir: string, onClick: () => void, isPT?: boolean }) {
  const tip = isPT ? (TOOLTIPS_PT[label] || TOOLTIPS[label]) : TOOLTIPS[label]
  return (
    <th onClick={onClick} className="px-2 py-2.5 text-center cursor-pointer select-none whitespace-nowrap"
        style={{background:'#f0ece5',color:active?'#c8102e':'#5c554e',fontSize:11,fontWeight:700,letterSpacing:'0.5px',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5'}}>
      {label}{tip && <Tip text={tip}/>}
      {active && <span style={{marginLeft:3}}>{dir==='desc'?'↓':'↑'}</span>}
    </th>
  )
}

const ROLE_COLORS: Record<string,string> = { head_coach:'#b45309', assistant_coach:'#1d4ed8', trainer:'#15803d', physio:'#6d28d9', scout:'#0e7490', mental_coach:'#9333ea' }

function staffRating(c: any) {
  if (c.role === 'physio') return c.rehab_speed || 0
  if (c.role === 'trainer') return Math.round(((c.conditioning||0)+(c.recovery_boost||0)+(c.injury_prevent||0))/3)
  if (c.role === 'scout') return Math.round(((c.scouting_evaluation||0)+(c.scouting_network||0)+(c.scouting_experience||0))/3)
  if (c.role === 'mental_coach') return Math.round(((c.morale_management||0)+(c.team_cohesion||0)+(c.composure_coaching||0))/3)
  return Math.round(((c.off_adjustment||0)+(c.def_adjustment||0)+(c.off_development||0)+(c.def_development||0)+(c.tactical_dev||0))/5)
}

export default function FreeAgentsPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const EXP_LABEL = (n: number) => {
    if (n === 0) return isPT ? 'Rookie' : 'Rookie'
    if (n === 1) return isPT ? '2ª Época' : '2nd Yr'
    if (n === 2) return isPT ? '3ª Época' : '3rd Yr'
    return isPT ? `${n} Épocas` : `${n} Yrs`
  }

  const [tab, setTab]       = useState<Tab>('players')
  const [players, setPlayers] = useState<any[]>([])
  const [staff, setStaff]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pos, setPos]       = useState('All')
  const [mode, setMode]     = useState<Mode>('attributes')
  const [sortKey, setSortKey] = useState('ovr')
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc')
  const [search, setSearch] = useState('')
  const [maxAge, setMaxAge] = useState(42)

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('*, photo_url, gleague_team_id, gleague_teams(id,name), player_stats(pts,reb,ast,stl,blk,games,fgm,fga,tpm,tpa,ftm,fta,season)').is('team_id', null).is('world_team_id', null).eq('status', 'active'),
      supabase.from('coaches').select('*').is('team_id', null),
    ]).then(([{ data: pl }, { data: st }]) => {
      setPlayers(pl || []); setStaff(st || []); setLoading(false)
    })
  }, [])

  const rows = players.map((p: any) => {
    const s = (p.player_stats || []).find((s: any) => s.season === '2025-26') || {}
    const gp = s.games || 0
    const avg = (v: number) => gp > 0 ? parseFloat((v / gp).toFixed(1)) : 0
    const ovr = calcOvr(p)
    return { ...p, ovr, ppg: avg(s.pts), rpg: avg(s.reb), apg: avg(s.ast), spg: avg(s.stl), bpg: avg(s.blk), fgpct: s.fga > 0 ? parseFloat((s.fgm/s.fga*100).toFixed(1)) : 0, tppct: s.tpa > 0 ? parseFloat((s.tpm/s.tpa*100).toFixed(1)) : 0, ftpct: s.fta > 0 ? parseFloat((s.ftm/s.fta*100).toFixed(1)) : 0, glTeam: p.gleague_teams?.name||null }
  })

  const isGleague = tab === 'gleague'
  const filtered = rows
    .filter(p => isGleague ? !!p.glTeam : !p.glTeam)
    .filter(p => pos === 'All' || p.pos === pos)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => (p.age || 25) <= maxAge)
    .sort((a: any, b: any) => {
      if (sortKey === 'name') { const r = a.name?.localeCompare(b.name)||0; return sortDir === 'asc' ? r : -r }
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc') }
  }

  const tabLabels: Record<Tab, string> = {
    players: isPT ? 'Agentes Livres' : 'Free Agents',
    gleague: isPT ? 'G-League' : 'G-Leaguers',
    staff: isPT ? 'Staff' : 'Staff',
  }

  const roleLabel = (role: string) => {
    if (!isPT) return role.replace(/_/g,' ').split(' ').map((w:string)=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')
    const map: Record<string,string> = { head_coach:'Head Coach', assistant_coach:'Ass. Treinador', trainer:'Preparador Físico', physio:'Fisioterapeuta', scout:'Olheiro', mental_coach:'Mental Coach' }
    return map[role] || role
  }

  return (
    <div className="max-w-full px-4 py-6">
      <div className="sec-hdr mb-4">
        <span className="sec-title">
          <i className="ti ti-user-plus" style={{fontSize:14,marginRight:6,color:'#c8102e'}}></i>
          {isPT ? 'Free Agents — 2025-26' : 'Free Agents — 2025-26'}
        </span>
        <span className="text-sm font-semibold" style={{color:'#8a8279'}}>
          {loading ? t('common.loading') : tab === 'staff' ? `${staff.length} ${isPT?'staff':'staff'}` : `${filtered.length} ${tab === 'gleague' ? 'G-Leaguers' : (isPT?'jogadores':'players')}`}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b" style={{borderColor:'#d4cdc5'}}>
        {(['players','gleague','staff'] as const).map(t2 => (
          <button key={t2} onClick={() => setTab(t2)}
            style={{padding:'10px 20px',fontSize:14,fontWeight:600,cursor:'pointer',background:'transparent',border:'none',
                    color:tab===t2?'#1a1512':'#5c554e',borderBottom:tab===t2?'3px solid #c8102e':'3px solid transparent',marginBottom:-1}}>
            {tabLabels[t2]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{color:'#8a8279'}}>{t('common.loading')}</div>
      ) : tab === 'staff' ? (
        /* ── Staff tab ── */
        <div>
          <div className="rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-end" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isPT?'Pesquisar staff...':'Search staff...'}
              className="px-3 py-1.5 rounded-lg text-sm flex-1" style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
          </div>
          <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f0ece5'}}>
                    <th className="px-3 py-2.5 text-left" style={{borderBottom:'2px solid #d4cdc5',fontWeight:700,fontSize:11,color:'#5c554e',minWidth:160}}>{isPT?'NOME':'NAME'}</th>
                    <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',fontSize:11,fontWeight:700,color:'#5c554e',padding:'10px 12px',textAlign:'left'}}>{isPT?'FUNÇÃO':'ROLE'}</th>
                    <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',fontSize:11,fontWeight:700,color:'#5c554e',padding:'10px 8px',textAlign:'center'}}>{isPT?'IDADE':'AGE'}</th>
                    <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',fontSize:11,fontWeight:700,color:'#5c554e',padding:'10px 8px',textAlign:'center'}}>{isPT?'AVALIAÇÃO':'RATING'}</th>
                    <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {staff.filter((c:any) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
                    .map((c:any, i:number) => {
                    const rc = ROLE_COLORS[c.role] || '#5c554e'
                    const rating = staffRating(c)
                    const rc2 = rating >= 80 ? '#b45309' : rating >= 70 ? '#15803d' : rating >= 60 ? '#1d4ed8' : '#8a8279'
                    return (
                      <tr key={c.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,overflow:'hidden',background:rc+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
                              {c.photo_url ? <img src={c.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:9,fontWeight:900,color:rc}}>{c.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</span>}
                            </div>
                            <div>
                              <Link href={`/staff/${c.id}`} className="font-semibold no-underline hover:underline" style={{color:'#1a1512'}}>{c.name}</Link>
                              {c.nationality && <span className="ml-1.5 text-xs" style={{color:'#8a8279'}}>{c.nationality}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:rc+'18',color:rc}}>{roleLabel(c.role)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center" style={{color:'#5c554e'}}>{c.age || '—'}</td>
                        <td className="px-3 py-2.5 text-center"><span style={{fontWeight:900,fontSize:14,color:rc2}}>{rating}</span></td>
                        <td className="px-3 py-2.5">
                          <Link href={`/staff/${c.id}`} className="text-xs font-bold px-3 py-1.5 rounded-lg no-underline" style={{background:'#c8102e',color:'#fff'}}>{isPT?'Ver':'View'}</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Player filters */}
          <div className="rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-end" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
            <div className="flex-1 min-w-36">
              <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>{t('common.search')}</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isPT?'Nome do jogador...':'Player name...'}
                className="w-full px-3 py-1.5 rounded-lg text-sm" style={{background:'#f0ece5',border:'1px solid #d4cdc5',color:'#1a1512',outline:'none'}}/>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>{isPT?'Posição':'Position'}</label>
              <div className="flex gap-1">
                {POSITIONS.map(p => (
                  <button key={p} onClick={() => setPos(p)}
                    className="text-xs font-bold px-2 py-1.5 rounded-lg"
                    style={{background:pos===p?'#1a1512':'#f0ece5',color:pos===p?'#fff':'#5c554e',border:'1px solid '+(pos===p?'#1a1512':'#d4cdc5')}}>
                    {p === 'All' ? (isPT?'Todos':'All') : p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{color:'#5c554e'}}>{isPT?`Idade máx: ${maxAge}`:`Max Age: ${maxAge}`}</label>
              <input type="range" min={18} max={45} value={maxAge} onChange={e => setMaxAge(+e.target.value)} className="w-28"/>
            </div>
            <div className="flex gap-1">
              {(['attributes','stats'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{background:mode===m?'#1a1512':'#f0ece5',color:mode===m?'#fff':'#5c554e',border:'1px solid '+(mode===m?'#1a1512':'#d4cdc5')}}>
                  {m === 'attributes' ? (isPT?'⚡ Atributos':'⚡ Attributes') : '📊 Stats'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
            <div className="overflow-x-auto">
              <table className="w-full" style={{borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#f0ece5'}}>
                    <th className="px-3 py-2.5 text-left sticky left-0 z-10"
                        style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5',minWidth:160,fontWeight:700,fontSize:11,color:'#5c554e'}}>
                      {isPT?'Jogador':'Player'}
                    </th>
                    <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 8px',fontWeight:700,fontSize:11,color:'#5c554e',textAlign:'center',borderRight:'1px solid #e2dcd5'}}>{isPT?'Pos':'Pos'}</th>
                    <SortTh label="OVR" active={sortKey==='ovr'} dir={sortDir} onClick={() => handleSort('ovr')} isPT={isPT}/>
                    <SortTh label="AGE" active={sortKey==='age'} dir={sortDir} onClick={() => handleSort('age')} isPT={isPT}/>
                    <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 8px',fontWeight:700,fontSize:11,color:'#5c554e',textAlign:'center',borderRight:'1px solid #e2dcd5'}}>
                      {isPT?'Exp':'EXP'}</th>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:700,fontSize:11,color:'#8a8279',whiteSpace:'nowrap',background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>Status</th>
                    {mode === 'attributes'
                      ? ATTR_COLS.map(c => <SortTh key={c.key} label={c.label} active={sortKey===c.key} dir={sortDir} onClick={() => handleSort(c.key)} isPT={isPT}/>)
                      : ['ppg','rpg','apg','spg','bpg'].map(k => <SortTh key={k} label={k.toUpperCase()} active={sortKey===k} dir={sortDir} onClick={() => handleSort(k)} isPT={isPT}/>)
                    }
                    <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',padding:'10px 8px',fontWeight:700,fontSize:11,color:'#5c554e',textAlign:'center',whiteSpace:'nowrap'}}>
                      {isPT?'Salário Est.':'Salary Ask'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={30} className="px-4 py-8 text-center" style={{color:'#8a8279'}}>{isPT?'Nenhum jogador encontrado.':'No players match.'}</td></tr>
                  ) : filtered.map((p: any, i: number) => {
                    const oc = ovrColor(p.ovr)
                    return (
                      <tr key={p.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e8e3db'}}>
                        <td className="px-3 py-2 sticky left-0 z-10 whitespace-nowrap" style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderRight:'1px solid #e2dcd5'}}>
                          <div className="flex items-center gap-2">
                            <div style={{width:20,height:20,borderRadius:4,flexShrink:0,overflow:'hidden',background:oc+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
                              {p.photo_url ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:8,fontWeight:900,color:oc}}>{p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</span>}
                            </div>
                            <Link href={`/player/${p.id}`} className="font-semibold no-underline hover:underline" style={{color:'#1a1512'}}>{p.name}</Link>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}>
                          <span style={{fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:4,background:'#e8e2d8',color:'#3d3731'}}>{p.pos}</span>
                        </td>
                        <td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}>
                          <span style={{fontWeight:900,fontSize:14,color:oc}}>{p.ovr}</span>
                        </td>
                        <td className="px-2 py-2 text-center text-sm" style={{color:'#5c554e',borderRight:'1px solid #e2dcd5'}}>{p.age ?? '—'}</td>
                        <td className="px-2 py-2 text-center" style={{borderRight:'1px solid #e2dcd5'}}>
                          <span style={{fontSize:11,fontWeight:600,color:(p.nba_experience??1)===0?'#6d28d9':'#5c554e'}}>{EXP_LABEL(p.nba_experience ?? 1)}</span>
                        </td>
                        <td style={{padding:'6px 8px'}}>
                          <span style={{display:'inline-block',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,background:p.glTeam?'#1a3a2a':'#2a1a0a',color:p.glTeam?'#4ade80':'#d4a04a'}}>{p.glTeam||'FA'}</span>
                        </td>
                        {mode === 'attributes'
                          ? ATTR_COLS.map(c => (
                              <td key={c.key} className="px-2 py-2 text-center" style={{borderRight:'1px solid #e8e3db'}}>
                                <span style={{fontSize:11,fontWeight:700,color:attrColor(p[c.key]||0)}}>{p[c.key]||0}</span>
                              </td>
                            ))
                          : ['ppg','rpg','apg','spg','bpg'].map(k => (
                              <td key={k} className="px-2 py-2 text-center text-sm font-semibold" style={{color:'#1a1512',borderRight:'1px solid #e8e3db'}}>
                                {p[k] || '—'}
                              </td>
                            ))
                        }
                        <td className="px-3 py-2 text-center whitespace-nowrap font-semibold text-xs" style={{color:'#1a1512'}}>
                          {salaryRange(p.ovr)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs" style={{background:'#f5f1eb',borderTop:'1px solid #e2dcd5',color:'#8a8279'}}>
              {isPT ? 'Clica nos cabeçalhos das colunas para ordenar · Passa o rato sobre i para definições' : 'Click column headers to sort · Hover i for definitions'}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

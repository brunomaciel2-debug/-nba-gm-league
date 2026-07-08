'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useTranslation } from '@/components/I18nProvider'

const ROLE_COLORS: Record<string,string> = {
  head_coach:'#b45309', assistant_coach:'#1d4ed8', trainer:'#15803d', physio:'#6d28d9', mental_coach:'#9333ea', social_media_manager:'#db2777'
}
const ATK: Record<string,string> = {motion:'Motion',pickroll:'P&R',transition:'Trans',iso:'Iso',post:'Post'}
const DEF: Record<string,string> = {man:'Man',zone23:'Zone',press:'Press',pack:'Pack'}

// Tooltip component for column headers
function ColTip({ text, children }: { text: string, children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center cursor-help"
          onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position:'absolute', bottom:'calc(100% + 4px)', left:'50%',
          transform:'translateX(-50%)', zIndex:200,
          background:'#1a1512', color:'#f5f1eb', fontSize:10,
          padding:'5px 8px', borderRadius:6, whiteSpace:'nowrap',
          boxShadow:'0 4px 12px rgba(0,0,0,0.3)',
          border:'1px solid rgba(255,255,255,0.1)', pointerEvents:'none',
        }}>{text}</span>
      )}
    </span>
  )
}

export default function CoachesAdminPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const [coaches, setCoaches] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('coaches').select('*').order('role').order('name'),
      supabase.from('teams').select('id,name,color,logo_url').not('id','in','(ALL,RVS)'),
    ]).then(([{data:c},{data:t2}]) => {
      setCoaches(c||[]); setTeams(t2||[]); setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-center" style={{color:'#5c554e'}}>{t('common.loading')}</div>

  const teamMap = Object.fromEntries(teams.map((t:any)=>[t.id,t]))
  const freeAgents = coaches.filter((c:any)=>!c.team_id)
  const byTeam: Record<string,any[]> = {}
  coaches.filter((c:any)=>c.team_id).forEach((c:any)=>{
    if(!byTeam[c.team_id])byTeam[c.team_id]=[]
    byTeam[c.team_id].push(c)
  })

  const personality = (v:number) => {
    if (isPT) {
      if(v<=3)return{label:'Calmo',color:'#1e40af'}
      if(v<=6)return{label:'Equilibrado',color:'#166534'}
      if(v<=8)return{label:'Intenso',color:'#c2410c'}
      return{label:'Impulsivo',color:'#dc2626'}
    }
    if(v<=3)return{label:'Calm',color:'#1e40af'}
    if(v<=6)return{label:'Balanced',color:'#166534'}
    if(v<=8)return{label:'Intense',color:'#c2410c'}
    return{label:'Hot-headed',color:'#dc2626'}
  }

  const roleLabel = (role: string) => {
    if (!isPT) return role.replace(/_/g,' ')
    const map: Record<string,string> = {
      head_coach:'Head Coach', assistant_coach:'Ass. Treinador',
      trainer:'Preparador Físico', physio:'Fisioterapeuta', scout:'Olheiro', mental_coach:'Mental Coach',
      social_media_manager:'Social Media Manager'
    }
    return map[role] || role.replace(/_/g,' ')
  }

  // Column header tooltips
  const COL_TIPS_EN: Record<string,string> = {
    OA:'Offensive Adjustment — reads opponent defence in real time',
    DA:'Defensive Adjustment — identifies and neutralises opponent offence',
    Sub:'Substitutions — rotation timing and matchup management',
    TO:'Timeout Management — when to call timeouts and late-game composure',
    OD:'Offensive Development — improves: 3PT, Layup, Dunk, Mid, FT, SIQ, DF',
    DD:'Defensive Development — improves: BLK, STL, IDEF, PDEF',
    Tac:'Tactical Development — improves: Pass Vision, Pass IQ, AR, REB positioning',
    Phy:'Physical Development — improves: Stamina, Durability',
    Men:'Mental Development — improves: Clutch, Consistency, Crowd Effect, Morale',
    Atk:'Preferred attack style — boosts team when GM orders match',
    Def:'Preferred defence style — boosts team when GM orders match',
    Pers:'Personality (1-10): Calm improves low-ego players, Intense improves high-ego',
    Cond:'Conditioning — reduces health loss per game and training session',
    Rec:'Recovery Boost — increases daily health recovery between games',
    Inj:'Injury Prevention — reduces base injury probability each 10pts above 60 = -5%',
    Rehab:'Rehab Speed — reduces injury recovery time; 80+ cuts absence by ~30%',
    Mor:'Morale Management — speeds up (or unlocks, below 50) weekly morale recovery',
    Coh:'Team Cohesion — more assisted baskets, fewer unforced turnovers',
    Comp:'Composure — dampens how much clutch/decisive moments cost the team',
  }
  const COL_TIPS_PT: Record<string,string> = {
    OA:'Ajuste Ofensivo — lê a defesa adversária em tempo real',
    DA:'Ajuste Defensivo — identifica e neutraliza o ataque adversário',
    Sub:'Substituições — timing de rotações e gestão de matchups',
    TO:'Gestão Tempos — quando pedir tempo e compostura no final',
    OD:'Des. Ataque — melhora: 3PT, Layup, Dunk, Mid, FT, SIQ, DF',
    DD:'Des. Defesa — melhora: BLK, STL, IDEF, PDEF',
    Tac:'Des. Tático — melhora: Visão, Pass IQ, AR, posicionamento REB',
    Phy:'Des. Físico — melhora: Resistência, Durabilidade',
    Men:'Des. Mental — melhora: Clutch, Consistência, Efeito Público, Moral',
    Atk:'Estilo de ataque preferido — bónus quando as ordens do GM coincidem',
    Def:'Estilo de defesa preferido — bónus quando as ordens do GM coincidem',
    Pers:'Personalidade (1-10): Calmo melhora ego baixo, Intenso melhora ego alto',
    Cond:'Condicionamento — reduz perda de saúde por jogo e treino',
    Rec:'Recuperação — aumenta recuperação diária de saúde entre jogos',
    Inj:'Prev. Lesões — reduz probabilidade base; cada 10pts acima de 60 = -5%',
    Rehab:'Velocidade de Rehab — reduz recuperação; 80+ corta ausência ~30%',
    Mor:'Gestão de Moral — acelera (ou desbloqueia, abaixo de 50) a recuperação semanal de moral',
    Coh:'Coesão de Equipa — mais cestos assistidos, menos perdas de bola',
    Comp:'Gestão de Pressão — reduz quanto os momentos decisivos/clutch custam à equipa',
  }
  const COL_TIPS = isPT ? COL_TIPS_PT : COL_TIPS_EN

  const headers = [
    {key:'Role',  label:isPT?'Função':'Role'},
    {key:'Name',  label:isPT?'Nome':'Name'},
    {key:'OA',    label:'OA'},
    {key:'DA',    label:'DA'},
    {key:'Sub',   label:'Sub'},
    {key:'TO',    label:'TO'},
    {key:'OD',    label:'OD'},
    {key:'DD',    label:'DD'},
    {key:'Tac',   label:'Tac'},
    {key:'Phy',   label:'Phy'},
    {key:'Men',   label:'Men'},
    {key:'Atk',   label:'Atk'},
    {key:'Def',   label:'Def'},
    {key:'Pers',  label:'Pers'},
    {key:'Cond',  label:'Cond'},
    {key:'Rec',   label:'Rec'},
    {key:'Inj',   label:'Inj'},
    {key:'Rehab', label:'Rehab'},
    {key:'Mor',   label:isPT?'Moral':'Mor'},
    {key:'Coh',   label:isPT?'Coesão':'Coh'},
    {key:'Comp',  label:isPT?'Pressão':'Comp'},
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{color:'#1a1612'}}>
          🎯 {isPT?'Staff Técnico — Todas as Equipas':'Coaching Staff — All Teams'}
        </h1>
        <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg no-underline" style={{background:'#d4cdc5',color:'#6b5f4e'}}>← Admin</Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        {Object.entries(byTeam).sort().map(([tid,staff])=>{
          const tm=teamMap[tid]
          return (
            <div key={tid} className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cec3'}}>
              <div className="flex items-center gap-2 px-4 py-2" style={{background:'#ddd7ca',borderBottom:'1px solid #d4cec3'}}>
                {tm?.logo_url&&<img src={tm.logo_url} alt="" className="w-5 h-5 object-contain"/>}
                <span className="font-bold" style={{color:'#1a1612'}}>{tm?.name||tid}</span>
                <span className="ml-auto text-xs" style={{color:'#6b5f4e'}}>{staff.length} {isPT?'staff':'staff'}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{background:'#ede8de',borderBottom:'1px solid #d4cec3'}}>
                      {headers.map(h=>(
                        <th key={h.key} className="px-2 py-1.5 text-left font-semibold" style={{color:'#6b5f4e',whiteSpace:'nowrap'}}>
                          {COL_TIPS[h.key] ? (
                            <ColTip text={COL_TIPS[h.key]}>{h.label}</ColTip>
                          ) : h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(staff as any[]).map((c:any,i:number)=>{
                      const rc=ROLE_COLORS[c.role]||'#5c554e'
                      const pers=personality(c.personality||5)
                      return(
                        <tr key={c.id} style={{background:i%2===0?'#ece7dd':'#e8e2d6',borderBottom:'1px solid #ddd8ce'}}>
                          <td className="px-2 py-1.5 font-semibold" style={{color:rc,whiteSpace:'nowrap'}}>{roleLabel(c.role)}</td>
                          <td className="px-2 py-1.5 font-semibold" style={{color:'#1a1612',whiteSpace:'nowrap'}}>
                            <Link href={`/staff/${c.id}`} style={{color:'#1a1612',textDecoration:'none'}}>{c.name}</Link>
                          </td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.off_adjustment>=80?'#b45309':'#5c554e'}}>{c.off_adjustment||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.def_adjustment>=80?'#15803d':'#5c554e'}}>{c.def_adjustment||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.substitutions||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.timeout_mgmt||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.off_development>=80?'#b45309':'#5c554e'}}>{c.off_development||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.def_development>=80?'#15803d':'#5c554e'}}>{c.def_development||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.tactical_dev||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.physical_dev||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.mental_dev||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:'#c2410c',whiteSpace:'nowrap'}}>{c.pref_atk_style?ATK[c.pref_atk_style]:'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:'#166534',whiteSpace:'nowrap'}}>{c.pref_def_style?DEF[c.pref_def_style]:'—'}</td>
                          <td className="px-2 py-1.5 text-center font-semibold" style={{color:pers.color}}>{c.personality||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.conditioning>=80?'#15803d':'#5c554e'}}>{c.conditioning||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.recovery_boost||'—'}</td>
                          <td className="px-2 py-1.5 text-center">{c.injury_prevent||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.rehab_speed>=80?'#6d28d9':'#5c554e'}}>{c.rehab_speed||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.morale_management>=80?'#9333ea':'#5c554e'}}>{c.morale_management||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.team_cohesion>=80?'#1d4ed8':'#5c554e'}}>{c.team_cohesion||'—'}</td>
                          <td className="px-2 py-1.5 text-center" style={{color:c.composure_coaching>=80?'#b45309':'#5c554e'}}>{c.composure_coaching||'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      <h2 className="text-sm font-bold mb-4" style={{color:'#1a1612'}}>
        🆓 {isPT?`Staff Livre (${freeAgents.length})`:`Free Agent Staff (${freeAgents.length})`}
      </h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        {freeAgents.map((c:any)=>{
          const rc=ROLE_COLORS[c.role]||'#5c554e'
          return(
            <div key={c.id} className="rounded-xl p-3" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
              <div className="text-xs font-semibold mb-0.5" style={{color:rc}}>{roleLabel(c.role)}</div>
              <div className="font-bold text-sm" style={{color:'#1a1612'}}>
                <Link href={`/staff/${c.id}`} style={{color:'#1a1612',textDecoration:'none'}}>{c.name}</Link>
              </div>
              <div className="text-xs mt-1" style={{color:'#6b5f4e'}}>
                {c.role==='physio'?`Rehab: ${c.rehab_speed}`:
                 c.role==='trainer'?`${isPT?'Cond':'Cond'}: ${c.conditioning} · ${isPT?'Rec':'Rec'}: ${c.recovery_boost}`:
                 c.role==='mental_coach'?`${isPT?'Moral':'Mor'}: ${c.morale_management} · ${isPT?'Coesão':'Coh'}: ${c.team_cohesion}`:
                 c.role==='social_media_manager'?`${isPT?'Envolv':'Eng'}: ${c.sm_engagement} · ${isPT?'Interação':'Fan'}: ${c.fan_interaction}`:
                 `OFF: ${c.off_adjustment} · DEF: ${c.def_adjustment}`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

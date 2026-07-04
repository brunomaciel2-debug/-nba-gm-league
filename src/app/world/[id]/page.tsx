'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { calcOvr, ovrColor } from '@/lib/ovr'
import { readableTeamColor } from '@/lib/color'
import { countryName } from '@/lib/country-pt'
import { useTranslation } from '@/components/I18nProvider'
import FriendlyButton from './FriendlyButton'

const ATTR_GROUPS_EN = [
  {label:'Scoring',    color:'#b45309', attrs:['usage','three','layup','dunk','mid','ft','siq','draw_foul']},
  {label:'Defense',    color:'#15803d', attrs:['blk','stl','idef','pdef']},
  {label:'Playmaking', color:'#1d4ed8', attrs:['ball_hdl','pass_vis','pass_iq','assist_role']},
  {label:'Physical',   color:'#6d28d9', attrs:['stamina','durability','def_reb','off_reb']},
  {label:'Mental',     color:'#c2410c', attrs:['pressure','consistency','crowd_effect']},
]
const ATTR_GROUPS_PT = [
  {label:'Ataque',        color:'#b45309', attrs:['usage','three','layup','dunk','mid','ft','siq','draw_foul']},
  {label:'Defesa',        color:'#15803d', attrs:['blk','stl','idef','pdef']},
  {label:'Criação de Jogo',color:'#1d4ed8', attrs:['ball_hdl','pass_vis','pass_iq','assist_role']},
  {label:'Físico',        color:'#6d28d9', attrs:['stamina','durability','def_reb','off_reb']},
  {label:'Mental',        color:'#c2410c', attrs:['pressure','consistency','crowd_effect']},
]
const ATTR_LABEL: Record<string,string> = {
  usage:'USG',three:'3PT',layup:'LAY',dunk:'DNK',mid:'MID',ft:'FT',siq:'SIQ',draw_foul:'DF',
  blk:'BLK',stl:'STL',idef:'IDEF',pdef:'PDEF',
  ball_hdl:'BH',pass_vis:'PV',pass_iq:'PIQ',assist_role:'AR',
  stamina:'STA',durability:'DUR',def_reb:'DREB',off_reb:'OREB',
  pressure:'CLU',consistency:'CON',crowd_effect:'CE',
}
const ATTR_TIP_EN: Record<string,string> = {
  USG:'Usage Rate (0-100)', '3PT':'Three-Point Shooting (0-100)',
  LAY:'Layup — rim finishing (0-100)', DNK:'Dunk (0-100)',
  MID:'Mid-Range (0-100)', FT:'Free Throw (0-100)',
  SIQ:'Shot IQ — shot selection (0-100)', DF:'Draw Foul (0-100)',
  BLK:'Block (0-100)', STL:'Steal (0-100)',
  IDEF:'Interior Defense (0-100)', PDEF:'Perimeter Defense (0-100)',
  BH:'Ball Handle (0-100)', PV:'Pass Vision (0-100)',
  PIQ:'Pass IQ (0-100)', AR:'Assist Role (0-100)',
  STA:'Stamina (0-100)', DUR:'Durability (0-100)',
  DREB:'Defensive Rebounding (0-100)', OREB:'Offensive Rebounding (0-100)',
  CLU:'Clutch (0-100)', CON:'Consistency (0-100)', CE:'Crowd Effect (0-100)',
  OVR:'Overall rating', AGE:'Player age',
}
const ATTR_TIP_PT: Record<string,string> = {
  USG:'Taxa de Utilização (0-100)', '3PT':'Lançamento de 3 Pontos (0-100)',
  LAY:'Layup — finalização perto do cesto (0-100)', DNK:'Afundanço (0-100)',
  MID:'Meia Distância (0-100)', FT:'Lance Livre (0-100)',
  SIQ:'Shot IQ — escolha de lançamento (0-100)', DF:'Provoca Falta (0-100)',
  BLK:'Desarme de Lançamento (0-100)', STL:'Roubo de Bola (0-100)',
  IDEF:'Defesa Interior (0-100)', PDEF:'Defesa de Perímetro (0-100)',
  BH:'Drible (0-100)', PV:'Visão de Jogo (0-100)',
  PIQ:'Pass IQ (0-100)', AR:'Perfil de Assistência (0-100)',
  STA:'Resistência (0-100)', DUR:'Durabilidade (0-100)',
  DREB:'Ressalto Defensivo (0-100)', OREB:'Ressalto Ofensivo (0-100)',
  CLU:'Clutch (0-100)', CON:'Consistência (0-100)', CE:'Influência do Público (0-100)',
  OVR:'Classificação geral', AGE:'Idade do jogador',
}

function attrColor(v: number) {
  if (v >= 85) return '#b45309'
  if (v >= 75) return '#15803d'
  if (v >= 65) return '#1d4ed8'
  return '#8a8279'
}

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-0.5 cursor-help align-middle">
      <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                    width:11,height:11,borderRadius:'50%',background:'#d4cdc5',
                    color:'#5c554e',fontSize:7,fontWeight:700,lineHeight:1}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2 py-1.5 rounded-lg text-xs
                       opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{background:'#1a1512',color:'#f5f1eb',width:180,whiteSpace:'normal',
                    lineHeight:1.4,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.3)',
                    position:'absolute'}}>
        {text}
      </span>
    </span>
  )
}

function ColTh({ label, color, active, dir, onClick, tip }: {
  label: string, color: string, active?: boolean, dir?: string, onClick?: () => void, tip?: string
}) {
  return (
    <th onClick={onClick}
        style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',borderRight:'1px solid #e2dcd5',
                padding:'8px 4px',textAlign:'center',whiteSpace:'nowrap',
                color:active?'#c8102e':color,fontSize:10,fontWeight:700,letterSpacing:'0.3px',
                cursor:onClick?'pointer':'default',userSelect:'none'}}>
      <span style={{display:'inline-flex',alignItems:'center',gap:1}}>
        {label}
        {tip && <Tip text={tip}/>}
        {active && <span style={{marginLeft:2}}>{dir==='desc'?'↓':'↑'}</span>}
      </span>
    </th>
  )
}

export default function WorldTeamPage({ params }: { params: { id: string } }) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const ATTR_GROUPS = isPT ? ATTR_GROUPS_PT : ATTR_GROUPS_EN
  const ATTR_TIP = isPT ? ATTR_TIP_PT : ATTR_TIP_EN

  const [team, setTeam]         = useState<any>(null)
  const [players, setPlayers]   = useState<any[]>([])
  const [friendlies, setFriendlies] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [sortKey, setSortKey]   = useState('ovr')
  const [sortDir, setSortDir]   = useState<'asc'|'desc'>('desc')

  useEffect(() => {
    const id = params.id.toUpperCase()
    Promise.all([
      supabase.from('world_teams').select('*').eq('id', id).single(),
      supabase.from('players')
        .select('*')
        .eq('world_team_id', id)
        .eq('nba_recruitable', false)
        .order('usage', { ascending: false }),
      supabase.from('friendly_requests')
        .select('*, nba:teams!friendly_requests_nba_team_id_fkey(id,name,logo_url,color)')
        .eq('world_team_id', id)
        .eq('status', 'confirmed')
        .order('scheduled_date'),
    ]).then(([{data:t},{data:pl},{data:fr}]) => {
      setTeam(t)
      setPlayers(pl||[])
      setFriendlies(fr||[])
      setLoading(false)
    })
  }, [params.id])

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d==='desc'?'asc':'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  if (loading) return <div style={{textAlign:'center',padding:48,color:'#8a8279'}}>{t('common.loading')}</div>
  if (!team)   return <div style={{textAlign:'center',padding:48,color:'#8a8279'}}>{isPT?'Equipa não encontrada.':'Team not found.'}</div>

  const tc = readableTeamColor(team.color||'#1d4ed8')

  const rows = players.map((p:any) => ({
    ...p, ovr: calcOvr(p)
  })).sort((a:any,b:any) => {
    const av=a[sortKey]??0, bv=b[sortKey]??0
    return sortDir==='desc' ? bv-av : av-bv
  })

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 16px'}}>
      <Link href="/teams" style={{fontSize:12,color:'#5c554e',textDecoration:'none',
            display:'inline-flex',alignItems:'center',gap:4,marginBottom:16}}>
        ← {isPT?'Equipas':'Teams'}
      </Link>

      {/* HEADER */}
      <div style={{borderRadius:16,padding:24,marginBottom:20,
                   background:'#e8e2d6',border:'1px solid #d4cec3',borderTop:`4px solid ${tc}`}}>
        <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:24}}>
          <div style={{width:96,height:96,borderRadius:16,background:tc+'22',
                       border:`2px solid ${tc}44`,display:'flex',alignItems:'center',
                       justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
            {team.logo_url
              ?<img src={team.logo_url} alt={team.name} style={{width:'100%',height:'100%',objectFit:'contain',padding:4}}/>
              :<span style={{fontSize:22,fontWeight:900,color:tc}}>{team.id}</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:tc,marginBottom:2}}>
              {team.continent} · {countryName(team.country, isPT)}
            </div>
            <h1 style={{fontSize:28,fontWeight:700,color:'#1a1512',margin:'0 0 4px'}}>{team.name}</h1>
            <div style={{fontSize:13,color:'#6b5f4e'}}>
              {team.arena && <span>{team.arena}</span>}
              {team.city && <span> · {team.city}</span>}
              {team.founded && <span> · {isPT?'Fundado em':'Est.'} {team.founded}</span>}
            </div>
            {team.description && (
              <p style={{fontSize:12,color:'#5c554e',marginTop:8,lineHeight:1.5,maxWidth:560}}>{team.description}</p>
            )}
          </div>
          <FriendlyButton worldTeamId={team.id} worldTeamName={team.name} />
        </div>
      </div>

      {/* INFO NOTICE */}
      <div style={{borderRadius:10,padding:'10px 16px',marginBottom:20,
                   background:'#fef9c3',border:'1px solid #b45309',
                   display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:14}}>🌍</span>
        <span style={{fontSize:12,color:'#b45309',fontWeight:600}}>
          {isPT
            ? 'Equipa internacional — os jogadores não estão disponíveis para contratos NBA. Apenas amigáveis de pré-época.'
            : 'International team — players are not available for NBA contracts. Pre-season friendlies only.'}
        </span>
      </div>

      {/* ROSTER */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',
                     color:'#5c554e',marginBottom:12,display:'flex',alignItems:'center',
                     justifyContent:'space-between'}}>
          <span>{isPT?'Plantel':'Roster'}</span>
          <span style={{fontWeight:400,color:'#8a8279'}}>{players.length} {isPT?'jogadores':'players'}</span>
        </div>
      </div>

      {players.length === 0 ? (
        <div style={{borderRadius:12,padding:32,textAlign:'center',
                     background:'#faf8f5',border:'1px solid #d4cdc5',marginBottom:32}}>
          <p style={{fontSize:13,color:'#8a8279'}}>{isPT?'Plantel ainda não disponível.':'Roster not yet available.'}</p>
        </div>
      ) : (
        <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #d4cdc5',marginBottom:32}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{background:'#f0ece5'}}>
                  <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',
                              borderRight:'1px solid #e2dcd5',padding:'10px 12px',
                              textAlign:'left',fontWeight:700,fontSize:11,color:'#5c554e',
                              position:'sticky',left:0,zIndex:10,minWidth:160}}>
                    {isPT?'Jogador':'Player'}
                  </th>
                  <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',
                              borderRight:'1px solid #e2dcd5',padding:'8px',
                              textAlign:'center',fontWeight:700,fontSize:11,color:'#5c554e'}}>POS</th>
                  <ColTh label="OVR" color="#1a1512" active={sortKey==='ovr'} dir={sortDir} onClick={()=>handleSort('ovr')} tip={ATTR_TIP.OVR}/>
                  <ColTh label="AGE" color="#5c554e" active={sortKey==='age'} dir={sortDir} onClick={()=>handleSort('age')} tip={ATTR_TIP.AGE}/>
                  <th style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5',
                              borderRight:'1px solid #e2dcd5',padding:'8px',
                              textAlign:'center',fontWeight:700,fontSize:11,color:'#5c554e'}}>{isPT?'NAC':'NAT'}</th>
                  {ATTR_GROUPS.map(g => g.attrs.map(a => (
                    <ColTh key={a} label={ATTR_LABEL[a]} color={g.color}
                           active={sortKey===a} dir={sortDir} onClick={()=>handleSort(a)} tip={ATTR_TIP[ATTR_LABEL[a]]}/>
                  )))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p:any, i:number) => {
                  const oc = ovrColor(p.ovr)
                  const bg = i%2===0?'#faf8f5':'#f5f1eb'
                  return (
                    <tr key={p.id} style={{background:bg,borderBottom:'1px solid #e2dcd5'}}>
                      <td style={{padding:'8px 12px',position:'sticky',left:0,zIndex:5,
                                  background:bg,borderRight:'1px solid #e2dcd5',whiteSpace:'nowrap'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:24,height:24,borderRadius:'50%',flexShrink:0,
                                       overflow:'hidden',background:oc+'18',display:'flex',
                                       alignItems:'center',justifyContent:'center'}}>
                            {p.photo_url
                              ?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                              :<span style={{fontSize:8,fontWeight:900,color:oc}}>
                                {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                              </span>}
                          </div>
                          <Link href={`/player/${p.id}`}
                                style={{fontWeight:600,color:'#1a1512',textDecoration:'none',fontSize:12}}>
                            {p.name}
                          </Link>
                        </div>
                      </td>
                      <td style={{padding:'6px 8px',textAlign:'center',borderRight:'1px solid #e2dcd5'}}>
                        <span style={{background:'#e8e2d8',color:'#3d3731',fontSize:10,
                                      fontWeight:600,padding:'2px 5px',borderRadius:4}}>{p.pos}</span>
                      </td>
                      <td style={{padding:'6px 4px',textAlign:'center',borderRight:'1px solid #e2dcd5'}}>
                        <span style={{fontWeight:900,fontSize:13,color:oc}}>{p.ovr}</span>
                      </td>
                      <td style={{padding:'6px 4px',textAlign:'center',color:'#5c554e',borderRight:'1px solid #e2dcd5'}}>
                        {p.age||'—'}
                      </td>
                      <td style={{padding:'6px 8px',textAlign:'center',fontSize:11,
                                  color:'#5c554e',borderRight:'1px solid #e2dcd5'}}>
                        {countryName(p.nationality, isPT)||'—'}
                      </td>
                      {ATTR_GROUPS.map(g => g.attrs.map(a => (
                        <td key={a} style={{padding:'6px 4px',textAlign:'center',borderRight:'1px solid #e8e3db'}}>
                          <span style={{color:attrColor(p[a]||0),fontWeight:700,fontSize:11}}>
                            {p[a]||0}
                          </span>
                        </td>
                      )))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:'8px 16px',background:'#f5f1eb',borderTop:'1px solid #e2dcd5',
                       fontSize:11,color:'#8a8279'}}>
            {isPT
              ? `${players.length} jogadores · Clica nas colunas para ordenar · Passa o rato em "i" para ver definições`
              : `${players.length} players · Click columns to sort · Hover i for definitions`}
          </div>
        </div>
      )}

      {/* SCHEDULED FRIENDLIES — bottom, centred */}
      <div style={{maxWidth:640,margin:'0 auto'}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.5px',
                     color:'#5c554e',marginBottom:12,textAlign:'center'}}>
          {isPT?'Amigáveis Agendados':'Scheduled Friendlies'}
        </div>
        {friendlies.length === 0 ? (
          <div style={{borderRadius:12,padding:24,textAlign:'center',
                       background:'#faf8f5',border:'1px solid #d4cdc5'}}>
            <p style={{fontSize:13,color:'#8a8279'}}>{isPT?'Ainda sem amigáveis agendados.':'No friendlies scheduled yet.'}</p>
            <p style={{fontSize:11,color:'#a89f97',marginTop:4}}>
              {isPT?'Os GMs podem propor um jogo usando o botão acima.':'GMs can propose a game using the button above.'}
            </p>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {friendlies.map((f:any) => {
              const ntc = readableTeamColor(f.nba?.color||'#1d4ed8')
              return (
                <div key={f.id} style={{borderRadius:10,padding:'14px 20px',
                                        background:'#faf8f5',border:'1px solid #d4cdc5',
                                        borderLeft:`4px solid ${ntc}`,
                                        display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:40,height:40,borderRadius:10,overflow:'hidden',
                               background:ntc+'18',flexShrink:0,display:'flex',
                               alignItems:'center',justifyContent:'center'}}>
                    {f.nba?.logo_url
                      ?<img src={f.nba.logo_url} alt="" style={{width:'100%',height:'100%',objectFit:'contain',padding:3}}/>
                      :<span style={{fontSize:10,fontWeight:900,color:ntc}}>{f.nba_team_id}</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#1a1512'}}>{f.nba?.name}</div>
                    <div style={{fontSize:12,color:'#8a8279',marginTop:2}}>
                      {new Date(f.scheduled_date).toLocaleDateString(isPT?'pt-PT':'en-US',{
                        weekday:'long',month:'long',day:'numeric',year:'numeric'
                      })}
                    </div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:6,
                                background:'#dcfce7',color:'#15803d',flexShrink:0}}>
                    ✓ {isPT?'Confirmado':'Confirmed'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

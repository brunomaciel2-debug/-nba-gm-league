'use client'
import { useTranslation } from '@/components/I18nProvider'
import { countryName } from '@/lib/country-pt'
import { countryFlag } from '@/lib/country-flags'
import { readableTeamColor } from '@/lib/color'
import Link from 'next/link'

const TYPE_LABEL_EN: Record<string,{label:string,color:string,bg:string}> = {
  guaranteed:       {label:'Guaranteed',    color:'#15803d', bg:'#dcfce7'},
  player_option:    {label:'Player Option', color:'#1d4ed8', bg:'#dbeafe'},
  team_option:      {label:'Team Option',   color:'#c2410c', bg:'#fee2e2'},
  two_way:          {label:'Two-Way',       color:'#6d28d9', bg:'#ede9fe'},
  qualifying_offer: {label:'QO',            color:'#b45309', bg:'#fef3c7'},
}
const TYPE_LABEL_PT: Record<string,{label:string,color:string,bg:string}> = {
  guaranteed:       {label:'Garantido',     color:'#15803d', bg:'#dcfce7'},
  player_option:    {label:'Opção Jogador', color:'#1d4ed8', bg:'#dbeafe'},
  team_option:      {label:'Opção Equipa',  color:'#c2410c', bg:'#fee2e2'},
  two_way:          {label:'Two-Way',       color:'#6d28d9', bg:'#ede9fe'},
  qualifying_offer: {label:'OQ',            color:'#b45309', bg:'#fef3c7'},
}

const AWARD_LABELS_EN: Record<string,string> = {
  potw_eastern:'Player of the Week (East)', potw_western:'Player of the Week (West)',
  potm_eastern:'Player of the Month (East)', potm_western:'Player of the Month (West)',
  mvp:'MVP', dpoy:'Defensive Player of the Year', roy:'Rookie of the Year',
  coy:'Coach of the Year', mip:'Most Improved Player', finals_mvp:'Finals MVP',
  all_nba_1:'1st Team All-NBA', all_nba_2:'2nd Team All-NBA', all_nba_3:'3rd Team All-NBA',
  all_rookie_1:'1st Rookie Team', all_rookie_2:'2nd Rookie Team',
  all_star_east:'All-Star (Eastern Conference)', all_star_west:'All-Star (Western Conference)',
}
const AWARD_LABELS_PT: Record<string,string> = {
  potw_eastern:'Jogador da Semana (Este)', potw_western:'Jogador da Semana (Oeste)',
  potm_eastern:'Jogador do Mês (Este)', potm_western:'Jogador do Mês (Oeste)',
  mvp:'MVP', dpoy:'Melhor Defesa da Liga', roy:'Melhor Rookie da Época',
  coy:'Melhor Treinador', mip:'Jogador Mais Melhorado', finals_mvp:'MVP das Finais',
  all_nba_1:'1º Quinteto All-NBA', all_nba_2:'2º Quinteto All-NBA', all_nba_3:'3º Quinteto All-NBA',
  all_rookie_1:'1º Quinteto de Rookies', all_rookie_2:'2º Quinteto de Rookies',
  all_star_east:'All-Star (Conferência Este)', all_star_west:'All-Star (Conferência Oeste)',
}
const AWARD_COLORS: Record<string,string> = {
  mvp:'#c8102e', dpoy:'#15803d', roy:'#6d28d9', finals_mvp:'#c8102e',
  all_nba_1:'#b45309', all_nba_2:'#5c554e', all_nba_3:'#8a8279',
  potw_eastern:'#b45309', potw_western:'#1d4ed8',
  potm_eastern:'#b45309', potm_western:'#1d4ed8',
  all_rookie_1:'#6d28d9', all_rookie_2:'#8a8279',
  all_star_east:'#e05050', all_star_west:'#5090d0',
}

function AttrBar({ value, color }: { value: number, color: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const barColor = value>=85?'#b45309':value>=70?color:value>=50?color+'99':'#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#d4cdc5'}}>
        <div className="h-full rounded-full" style={{width:pct+'%',background:barColor}}/>
      </div>
      <span className="text-xs font-bold w-7 text-right"
            style={{color:value>=85?'#b45309':value>=70?'#1a1512':value>=50?'#5c554e':'#dc2626'}}>
        {value}
      </span>
    </div>
  )
}

function OVR({ value }: { value: number }) {
  const color = value>=85?'#b45309':value>=75?'#15803d':value>=65?'#1d4ed8':'#5c554e'
  const bg    = value>=85?'#fef3c7':value>=75?'#dcfce7':value>=65?'#dbeafe':'#f0ece5'
  return (
    <div className="flex flex-col items-center justify-center rounded-xl p-3 min-w-[60px]"
         style={{background:bg,border:'1px solid '+color+'44'}}>
      <span className="text-2xl font-black" style={{color}}>{value}</span>
      <span className="text-xs font-semibold" style={{color}}>OVR</span>
    </div>
  )
}

function AttrTooltip({ tip }: { tip: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help align-middle">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-xs font-bold flex-shrink-0"
            style={{background:'#d4cdc5',color:'#5c554e',lineHeight:1,fontSize:9}}>i</span>
      <span className="absolute left-0 top-full mt-1 z-50 px-2.5 py-2 rounded-lg text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{background:'#1a1512',color:'#f5f1eb',width:220,whiteSpace:'normal',lineHeight:1.5,fontWeight:400,boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>
        {tip}
      </span>
    </span>
  )
}

const TX_LABELS_PT: Record<string,string> = { trade:'Troca', fa_signing:'Assinatura FA', cut:'Corte', draft:'Draft' }
const TX_LABELS_EN: Record<string,string> = { trade:'Trade', fa_signing:'FA Signing', cut:'Cut', draft:'Draft' }
const TX_COLORS: Record<string,{color:string,bg:string}> = {
  trade:{color:'#1d4ed8',bg:'#dbeafe'}, fa_signing:{color:'#15803d',bg:'#dcfce7'},
  cut:{color:'#dc2626',bg:'#fee2e2'}, draft:{color:'#6d28d9',bg:'#ede9fe'},
}

export default function PlayerPageClient({ player, stats, teamMap, transactions, injuries, contracts, playerAwards, lastGames, teamColor, ovr, currentContract, totalValue, actionButtons }: {
  player: any, stats: any[], teamMap?: Record<string, any>, transactions?: any[], injuries: any[], contracts: any[], playerAwards: any[],
  lastGames: any[], teamColor: string, ovr: number, currentContract: any, totalValue: number,
  actionButtons?: React.ReactNode
}) {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const p = player
  const tc = teamColor
  const capFmt = (n:number) => n ? '$'+(n/1000000).toFixed(2)+'M' : '—'
  const TYPE_LABEL = isPT ? TYPE_LABEL_PT : TYPE_LABEL_EN
  const AWARD_LABELS = isPT ? AWARD_LABELS_PT : AWARD_LABELS_EN

  const ATTR_GROUPS = [
    { label: isPT?'Ataque':'Scoring', color:'#b45309', attrs:[
      {key:'three',    label: isPT?'3 Pontos':'Three Point',         tip: isPT?'3 Pontos — capacidade de lançamento além da linha.':'Three Point — shooting ability from beyond the arc.'},
      {key:'layup',    label: 'Layup',                               tip: isPT?'Layup — capacidade de finalizar perto do cesto.':'Layup — finishing ability at the rim.'},
      {key:'dunk',     label: isPT?'Afundanço':'Dunk',               tip: isPT?'Afundanço — capacidade de finalizar com potência acima do cesto.':'Dunk — ability to finish with power above the rim.'},
      {key:'mid',      label: isPT?'Meia Distância':'Mid-Range',      tip: isPT?'Meia Distância — capacidade de pontuar de meia distância.':'Mid-Range — ability to score from mid-range.'},
      {key:'ft',       label: isPT?'Lances Livres':'Free Throws',    tip: isPT?'Lances Livres — precisão na linha de lance livre.':'Free Throws — free throw shooting accuracy.'},
      {key:'siq',      label: 'Shot IQ',                             tip: isPT?'Shot IQ — capacidade de decisão no lançamento.':'Shot IQ — decision-making on shot selection.'},
      {key:'draw_foul',label: isPT?'Provoca Falta':'Draw Foul',     tip: isPT?'Provoca Falta — qualidade do contacto que provoca quando ataca o cesto.':'Draw Foul — quality of the contact he draws when attacking the basket.'},
    ]},
    { label: isPT?'Defesa':'Defense', color:'#15803d', attrs:[
      {key:'blk',  label: isPT?'Desarme de Lançamento':'Block',                  tip: isPT?'Desarme de Lançamento — capacidade de travar lançamentos adversários.':'Block — ability to block opponent shots.'},
      {key:'stl',  label: isPT?'Roubo de Bola':'Steal',                     tip: isPT?'Roubo de Bola — capacidade de recuperar a bola.':'Steal — ability to strip the ball or intercept passes.'},
      {key:'idef', label: isPT?'Def. Interior':'Interior Defense',  tip: isPT?'Defesa Interior — capacidade de defender na zona do garrafão.':'Interior Defense — ability to defend in the paint.'},
      {key:'pdef', label: isPT?'Def. Perímetro':'Perimeter Defense',tip: isPT?'Defesa de Perímetro — capacidade de defender no exterior.':'Perimeter Defense — ability to guard on the perimeter.'},
    ]},
    { label: isPT?'Ressaltos':'Rebounding', color:'#1d4ed8', attrs:[
      {key:'def_reb', label: isPT?'Ressalto Def.':'Def. Rebound', tip: isPT?'Ressalto Defensivo — capacidade de recuperar ressaltos após falhanços adversários.':'Defensive Rebound — ability to secure rebounds after opponent misses.'},
      {key:'off_reb', label: isPT?'Ressalto Ofens.':'Off. Rebound', tip: isPT?'Ressalto Ofensivo — capacidade de recuperar lançamentos falhados da própria equipa.':'Offensive Rebound — ability to recover missed shots offensively.'},
    ]},
    { label: isPT?'Atletismo':'Athleticism', color:'#6d28d9', attrs:[
      {key:'stamina',    label: isPT?'Resistência':'Stamina',    tip: isPT?'Resistência — aguenta bem ao longo de um jogo.':'Stamina — endurance across a game.'},
      {key:'durability', label: isPT?'Durabilidade':'Durability',tip: isPT?'Durabilidade — resistência a lesões.':'Durability — resistance to injuries.'},
    ]},
    { label: isPT?'Criação de Jogo':'Playmaking', color:'#0e7490', attrs:[
      {key:'ball_hdl',    label: isPT?'Drible':'Ball Handle', tip: isPT?'Drible — capacidade de driblarem sob pressão.':'Ball Handling — ability to dribble under pressure.'},
      {key:'pass_vis',    label: isPT?'Visão de Jogo':'Pass Vision',    tip: isPT?'Ajuda a decidir quem fica com a assistência real quando este jogador está em campo — conta menos do que o Perfil de Assistência, mas conta.':'Helps decide who gets credited with the real assist when this player is on the floor — counts less than Assist Role, but it counts.'},
      {key:'pass_iq',     label: 'Pass IQ',                              tip: isPT?'Pass IQ — capacidade de decisão ao passar.':'Pass IQ — decision-making when passing.'},
      {key:'assist_role', label: isPT?'Perfil de Assistência':'Assist Role', tip: isPT?'Perfil de Assistência — como este jogador se encaixa num sistema focado em passes.':'Assist Role — how naturally this player fits into a pass-first role.'},
    ]},
    { label: isPT?'Psicológico':'Psychological', color:'#b45309', attrs:[
      {key:'pressure',     label: isPT?'Clutch/Pressão':'Clutch/Pressure', tip: isPT?'Clutch/Pressão — desempenho em momentos de alta pressão.':'Clutch/Pressure — performance in high-pressure moments.'},
      {key:'consistency',  label: isPT?'Consistência':'Consistency',        tip: isPT?'Consistência — variação de jogo a jogo.':'Consistency — game-to-game variance in performance.'},
      {key:'crowd_effect', label: isPT?'Influência do Público':'Crowd Effect',     tip: isPT?'Influência do Público — o quanto o barulho do público afecta este jogador.':'Crowd Effect — how much crowd noise affects this player.'},
      {key:'streaky',      label: isPT?'Irregular':'Streaky',               tip: isPT?'Irregular — tendência para fases quentes e frias.':'Streaky — tendency to have hot and cold streaks.'},
      {key:'trash_talk',   label: 'Trash Talk',                             tip: isPT?'Trash Talk — capacidade de entrar na cabeça dos adversários.':'Trash Talk — ability to get in opponents\'s heads.'},
    ]},
  ]

  const expLabel = (n: number) => {
    if (n === 0) return {label: 'Rookie', bg: '#6d28d9'}
    if (n === 1) return {label: isPT ? 'Sophomore' : 'Sophomore', bg: '#1d4ed8'}
    return {label: isPT ? `${n} épocas exp.` : `${n}yr exp`, bg: null}
  }
  const exp = expLabel(p.nba_experience ?? 1)

  return (
    <>
      {/* HEADER */}
      <div className="rounded-2xl p-6 mb-6"
           style={{background:'#faf8f5',borderTop:'4px solid '+tc,border:'1px solid #d4cdc5'}}>
        <div className="flex gap-5 flex-wrap items-start">
          <div className="flex-shrink-0">
            {p.photo_url
              ? <img src={p.photo_url} alt={p.name} className="w-40 h-40 rounded-xl object-cover" style={{border:'2px solid '+tc}}/>
              : <div className="w-40 h-40 rounded-xl flex items-center justify-center text-3xl font-black"
                     style={{background:tc+'18',color:tc,border:'2px solid '+tc+'33'}}>
                  {p.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{color:tc,letterSpacing:'1px'}}>
                  {p.world_team_id && p.world_teams ? `${p.world_teams.name} · ${countryName(p.world_teams.country, isPT)}` : p.teams?.name} · {p.pos}
                </div>
                <h1 className="text-3xl font-black mb-2" style={{color:'#1a1512'}}>{p.name}</h1>
                <div className="flex gap-3 text-sm flex-wrap items-center">
                  {p.nationality && (
                    <span style={{color:'#5c554e'}}>
                      {countryFlag(p.nationality) && <span className="mr-1">{countryFlag(p.nationality)}</span>}
                      {countryName(p.nationality, isPT)}
                    </span>
                  )}
                  {p.age && <span style={{color:'#5c554e'}}>{isPT?'Idade':'Age'} {p.age}</span>}
                  {exp.bg
                    ? <span className="text-xs px-2 py-0.5 rounded font-bold" style={{background:exp.bg,color:'#fff'}}>{exp.label}</span>
                    : <span style={{color:'#8a8279',fontSize:12}}>{exp.label}</span>
                  }
                  {p.status !== 'active' && (
                    <span className="px-2 py-0.5 rounded font-semibold text-xs" style={{background:'#fee2e2',color:'#dc2626'}}>
                      🏥 {p.injury_type||(isPT?'Lesionado':'Injured')}
                    </span>
                  )}
                </div>
              </div>
              <OVR value={ovr}/>
            </div>
            {currentContract && (
              <div className="flex gap-6 mt-3 flex-wrap">
                {[
                  {label: isPT?'Salário 2025-26':'2025-26 Salary', val: capFmt(currentContract.salary)},
                  {label: isPT?'Contrato':'Contract', val: `${contracts.length}${isPT?'ano(s)':'yr'}`},
                  {label: isPT?'Valor Total':'Total Value', val: capFmt(totalValue)},
                ].map(item=>(
                  <div key={item.label}>
                    <div className="text-xs" style={{color:'#8a8279'}}>{item.label}</div>
                    <div className="font-bold" style={{color:'#1a1512'}}>{item.val}</div>
                  </div>
                ))}
                <div>
                  <div className="text-xs" style={{color:'#8a8279'}}>{isPT?'Tipo':'Type'}</div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{background:TYPE_LABEL[currentContract.type]?.bg||'#f0ece5',
                                color:TYPE_LABEL[currentContract.type]?.color||'#5c554e'}}>
                    {TYPE_LABEL[currentContract.type]?.label||currentContract.type}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* G-League */}
      {p.gleague_team_id && !p.team_id && (
        <div style={{margin:'0 0 16px',padding:'16px',borderRadius:12,border:'1px solid #1a3a2a',background:'#0f1f15'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#4ade80',marginBottom:8,letterSpacing:1}}>G-LEAGUE CONTRACT</div>
          <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
            <div><div style={{fontSize:11,color:'#4ade80',opacity:0.7}}>{isPT?'Salário':'Salary'}</div><div style={{fontWeight:700,color:'#4ade80'}}>$50,000</div></div>
            <div><div style={{fontSize:11,color:'#4ade80',opacity:0.7}}>{isPT?'Tipo':'Type'}</div><div style={{fontWeight:700,color:'#4ade80'}}>G-League</div></div>
            <div><div style={{fontSize:11,color:'#4ade80',opacity:0.7}}>{isPT?'Época':'Season'}</div><div style={{fontWeight:700,color:'#4ade80'}}>2025-26</div></div>
          </div>
        </div>
      )}

      {/* G-League assignment */}
      {p.team_id && p.nba_recruitable !== false && (
        <div className="mb-4">
          {p.on_gleague_assignment ? (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                 style={{background:'#fef9c3',border:'1px solid #b45309'}}>
              <div className="text-xs font-semibold" style={{color:'#b45309'}}>
                {isPT ? 'Em Cedência para a G-League' : 'On G-League Assignment'}
              </div>
              <form action="/api/gleague/recall" method="POST">
                <input type="hidden" name="playerId" value={p.id}/>
                <button type="submit" className="text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{background:'#1d4ed8',color:'#fff'}}>
                  {isPT ? 'Regressar à NBA' : 'Recall to NBA'}
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl flex-wrap gap-2"
                 style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
              <div className="text-xs" style={{color:'#5c554e'}}>
                {isPT ? 'Disponível para cedência à G-League' : 'Available for G-League assignment'}
              </div>
              <form action="/api/gleague/assign" method="POST">
                <input type="hidden" name="playerId" value={p.id}/>
                <input type="hidden" name="teamId" value={p.team_id}/>
                <button type="submit" className="text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{background:'#15803d',color:'#fff'}}>
                  {isPT ? 'Enviar para G-League' : 'Send to G-League'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {p.nba_recruitable === false && (
        <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-2"
             style={{background:'#fef9c3',border:'1px solid #b45309'}}>
          <i className="ti ti-world" style={{fontSize:16,color:'#b45309'}}></i>
          <span className="text-xs font-semibold" style={{color:'#b45309'}}>
            {isPT
              ? 'Jogador internacional — não disponível para contratos NBA. Apenas amigáveis de pré-época.'
              : 'International player — not available for NBA contracts. Pre-season friendly only.'}
          </span>
        </div>
      )}

      {/* Action buttons: ContractExtensionPanel + CutButton — injected from page.tsx */}
      {actionButtons}

      {/* ATTRIBUTES */}
      <div className="sec-hdr mb-4"><span className="sec-title">{isPT?'Atributos':'Attributes'}</span></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {ATTR_GROUPS.map(group => (
          <div key={group.label} className="rounded-xl p-4"
               style={{background:'#faf8f5',border:'1px solid #d4cdc5',borderTop:'2px solid '+group.color}}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3"
                 style={{color:group.color,letterSpacing:'1px'}}>{group.label}</div>
            {group.attrs.map((attr:any) => (
              <div key={attr.key} className="mb-2">
                <div className="text-xs mb-0.5 flex items-center" style={{color:'#5c554e'}}>
                  {attr.label}
                  {attr.tip && <AttrTooltip tip={attr.tip}/>}
                </div>
                <AttrBar value={p[attr.key]||0} color={group.color}/>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* STATS */}
      <div className="sec-hdr mb-3"><span className="sec-title">{isPT?'Estatísticas da Época':'Season Statistics'}</span></div>
      {stats.length > 0 ? (
        <div className="rounded-xl overflow-hidden mb-6" style={{border:'1px solid #d4cdc5'}}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{minWidth:700}}>
              <thead>
                <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                  {[isPT?'Época':'Season',isPT?'Equipa':'Team','GP','MIN','PPG','RPG','APG','SPG','BPG','OREB','DREB','FG%','3P%','FT%','TO','PF','DD','TD','+/-'].map(h=>(
                    <th key={h} className="px-2.5 py-2.5 font-bold text-right first:text-left"
                        style={{color:'#5c554e',whiteSpace:'nowrap',fontSize:10}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s:any,i:number) => {
                  const gp=s.games||0
                  const avg=(v:number)=>gp>0?(v/gp).toFixed(1):'—'
                  const avgM=(v:number)=>gp>0?(v/gp).toFixed(0):'—'
                  const pctS=(m:number,a:number)=>a>0?(m/a*100).toFixed(1)+'%':'—'
                  const oreb=s.oreb||0
                  const dreb=s.reb?(s.reb-oreb):0
                  const pm=s.plus_minus||0
                  const st=teamMap?.[s.team_id]
                  const stc=st?readableTeamColor(st.color):'#8a8279'
                  return (
                    <tr key={s.id||i} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <td className="px-2.5 py-2.5 font-bold" style={{color:'#1a1512',whiteSpace:'nowrap'}}>{s.season}</td>
                      <td className="px-2.5 py-2.5" style={{whiteSpace:'nowrap'}}>
                        <span className="flex items-center gap-1.5 justify-end">
                          {st?.logo_url && <img src={st.logo_url} alt="" style={{width:14,height:14,objectFit:'contain'}}/>}
                          <span style={{color:stc,fontWeight:600,fontSize:11}}>{st?.name||s.team_id||'—'}</span>
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{gp}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{avgM(s.mins||0)}</td>
                      <td className="px-2.5 py-2.5 text-right font-bold" style={{color:'#b45309'}}>{avg(s.pts)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#15803d'}}>{avg(s.reb)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#1d4ed8'}}>{avg(s.ast)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#6d28d9'}}>{avg(s.stl)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#c2410c'}}>{avg(s.blk)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{avg(oreb)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{avg(dreb)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{pctS(s.fgm,s.fga)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{pctS(s.tpm,s.tpa)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{pctS(s.ftm,s.fta)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#dc2626'}}>{avg(s.turnovers)}</td>
                      <td className="px-2.5 py-2.5 text-right" style={{color:'#8a8279'}}>{avg(s.pf||0)}</td>
                      <td className="px-2.5 py-2.5 text-right font-bold" style={{color:s.double_doubles>0?'#1d4ed8':'#8a8279'}}>{s.double_doubles||0}</td>
                      <td className="px-2.5 py-2.5 text-right font-bold" style={{color:s.triple_doubles>0?'#6d28d9':'#8a8279'}}>{s.triple_doubles||0}</td>
                      <td className="px-2.5 py-2.5 text-right font-semibold"
                          style={{color:pm>0?'#15803d':pm<0?'#dc2626':'#8a8279'}}>
                        {pm>0?'+':''}{pm||0}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs" style={{color:'#a89f97',borderTop:'1px solid #e2dcd5',background:'#f5f1eb'}}>
            {isPT ? 'Médias por jogo · DD = Duplos-Duplos · TD = Triplos-Duplos · +/- = total da época' : 'Per game averages · DD = Double-Doubles · TD = Triple-Doubles · +/- = season total'}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4 text-center mb-6" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
          <p className="text-sm" style={{color:'#5c554e'}}>{isPT ? 'Sem estatísticas — a época ainda não começou.' : 'No stats yet — season hasn\'t started.'}</p>
        </div>
      )}

      {/* LAST 5 GAMES */}
      <div className="mt-6">
        <div className="sec-hdr mb-4"><span className="sec-title">{isPT?'Últimos 5 Jogos':'Last 5 Games'}</span></div>
        {lastGames.length === 0 ? (
          <div className="rounded-xl p-4 text-center" style={{background:'#faf8f5',border:'1px solid #d4cdc5'}}>
            <p className="text-sm" style={{color:'#8a8279'}}>{isPT?'Ainda não jogou nenhum jogo.':'No games played yet.'}</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{minWidth:600}}>
                <thead>
                  <tr style={{background:'#f0ece5',borderBottom:'2px solid #d4cdc5'}}>
                    {[isPT?'Data':'Date',isPT?'Jogo':'Matchup',isPT?'Resultado':'Result','MIN','PTS','REB','AST','STL','BLK','FG','3P','FT','+/-'].map(h=>(
                      <th key={h} className="px-2.5 py-2.5 font-bold text-right first:text-left"
                          style={{color:'#5c554e',fontSize:10,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lastGames.map((b:any,i:number) => {
                    const g = b.games
                    if (!g || !g.home || !g.away) return null
                    const isHome = g.home_team === p.team_id
                    const opp = isHome ? g.away : g.home
                    const myScore = isHome ? g.home_score : g.away_score
                    const oppScore = isHome ? g.away_score : g.home_score
                    const won = (myScore||0) > (oppScore||0)
                    const oppColor = readableTeamColor(opp?.color||'#5c554e')
                    const dateStr = g.played_at ? new Date(g.played_at).toLocaleDateString(isPT?'pt-PT':'en-US',{month:'short',day:'numeric'}) : '—'
                    return (
                      <tr key={b.id} style={{background:i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                        <td className="px-2.5 py-2.5 whitespace-nowrap" style={{color:'#8a8279'}}>{dateStr}</td>
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <span style={{color:'#8a8279'}}>{isHome?(isPT?'vs':'vs'):(isPT?'em':'@')} </span>
                          <span style={{color:oppColor,fontWeight:600}}>{opp?.name||'—'}</span>
                        </td>
                        <td className="px-2.5 py-2.5 font-bold whitespace-nowrap" style={{color:won?'#15803d':'#dc2626'}}>
                          {won?(isPT?'V':'W'):(isPT?'D':'L')} {myScore}-{oppScore}
                        </td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{b.mins||0}</td>
                        <td className="px-2.5 py-2.5 text-right font-bold" style={{color:'#b45309'}}>{b.pts||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#15803d'}}>{b.reb||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#1d4ed8'}}>{b.ast||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#6d28d9'}}>{b.stl||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#c2410c'}}>{b.blk||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{b.fgm||0}/{b.fga||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{b.tpm||0}/{b.tpa||0}</td>
                        <td className="px-2.5 py-2.5 text-right" style={{color:'#5c554e'}}>{b.ftm||0}/{b.fta||0}</td>
                        <td className="px-2.5 py-2.5 text-right font-semibold"
                            style={{color:(b.plus_minus||0)>0?'#15803d':(b.plus_minus||0)<0?'#dc2626':'#8a8279'}}>
                          {(b.plus_minus||0)>0?'+':''}{b.plus_minus||0}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* TRANSFER HISTORY */}
      <div className="mt-6 mb-6">
        <div className="sec-hdr mb-4"><span className="sec-title">{isPT?'Histórico de Transferências':'Transfer History'}</span></div>
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          {!transactions || transactions.length === 0 ? (
            <div className="px-4 py-5 text-center" style={{background:'#faf8f5'}}>
              <p className="text-sm" style={{color:'#8a8279'}}>{isPT?'Sem transferências registadas.':'No transfers on record.'}</p>
            </div>
          ) : transactions.map((tx:any,i:number) => {
            const fromTeam = tx.from_team_id ? teamMap?.[tx.from_team_id] : null
            const toTeam = tx.to_team_id ? teamMap?.[tx.to_team_id] : null
            const label = (isPT ? TX_LABELS_PT : TX_LABELS_EN)[tx.type] || tx.type
            const txColor = TX_COLORS[tx.type] || { color:'#5c554e', bg:'#f0ece5' }
            return (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                   style={{borderBottom:i<transactions.length-1?'1px solid #e2dcd5':'none',
                           background:i%2===0?'#faf8f5':'#f5f1eb'}}>
                <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{background:txColor.bg,color:txColor.color}}>{label}</span>
                <div className="flex items-center gap-2 text-sm flex-1 min-w-0" style={{color:'#1a1512'}}>
                  {fromTeam ? (
                    <span className="flex items-center gap-1.5 truncate">
                      {fromTeam.logo_url && <img src={fromTeam.logo_url} alt="" style={{width:16,height:16,objectFit:'contain'}}/>}
                      {fromTeam.name}
                    </span>
                  ) : <span style={{color:'#8a8279'}}>{isPT?'Agente Livre':'Free Agent'}</span>}
                  <span style={{color:'#b0a89e'}}>→</span>
                  {toTeam ? (
                    <span className="flex items-center gap-1.5 truncate">
                      {toTeam.logo_url && <img src={toTeam.logo_url} alt="" style={{width:16,height:16,objectFit:'contain'}}/>}
                      {toTeam.name}
                    </span>
                  ) : <span style={{color:'#8a8279'}}>{isPT?'Agente Livre':'Free Agent'}</span>}
                </div>
                <div className="text-xs flex-shrink-0" style={{color:'#8a8279'}}>
                  {tx.season}{tx.week_number ? ` · ${isPT?'Semana':'Week'} ${tx.week_number}` : ''}
                </div>
                {tx.type === 'trade' && tx.proposal_id && (
                  <a href={`/trade-center?proposal=${tx.proposal_id}`}
                     className="text-xs font-semibold no-underline flex-shrink-0" style={{color:'#1d4ed8'}}>
                    {isPT?'Ver Troca →':'View Trade →'}
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* INJURY HISTORY */}
      <div className="mt-6 mb-6">
        <div className="sec-hdr mb-4"><span className="sec-title">{isPT?'Histórico de Lesões':'Injury History'}</span></div>
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          {injuries.length === 0 ? (
            <div className="px-4 py-5 text-center" style={{background:'#faf8f5'}}>
              <p className="text-sm" style={{color:'#8a8279'}}>{isPT?'Sem histórico de lesões — está em plenas condições.':'No injury history — clean bill of health.'}</p>
            </div>
          ) : injuries.map((inj:any,i:number) => (
            <div key={inj.id} className="flex items-center gap-4 px-4 py-3"
                 style={{borderBottom:i<injuries.length-1?'1px solid #e2dcd5':'none',
                         background:i%2===0?'#faf8f5':'#f5f1eb'}}>
              <i className="ti ti-alert-triangle" style={{fontSize:16,color:'#dc2626',flexShrink:0}}></i>
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{color:'#dc2626'}}>{inj.injury_type}</div>
                <div className="text-xs mt-0.5" style={{color:'#8a8279'}}>
                  {new Date(inj.created_at).toLocaleDateString(isPT?'pt-PT':'en-US',{month:'long',day:'numeric',year:'numeric'})}
                </div>
              </div>
              <div className="text-sm font-semibold text-right" style={{color:'#5c554e'}}>
                {inj.games_out} {isPT ? `jogo${inj.games_out!==1?'s':''} falhado${inj.games_out!==1?'s':''}` : `game${inj.games_out!==1?'s':''} out`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AWARDS */}
      <div className="mt-2">
        <div className="sec-hdr mb-4"><span className="sec-title">{isPT?'Prémios & Distinções':'Awards & Honours'}</span></div>
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid #d4cdc5'}}>
          {playerAwards.length === 0 ? (
            <div className="px-4 py-6 text-center" style={{background:'#faf8f5'}}>
              <i className="ti ti-trophy" style={{fontSize:28,color:'#d4cdc5'}}></i>
              <p className="text-sm mt-2" style={{color:'#8a8279'}}>{isPT?'Ainda sem prémios':'No awards yet'}</p>
            </div>
          ) : playerAwards.map((a:any,i:number) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3"
                 style={{borderBottom:i<playerAwards.length-1?'1px solid #e2dcd5':'none',
                         background:i%2===0?'#faf8f5':'#f5f1eb'}}>
              <i className="ti ti-award" style={{fontSize:16,color:AWARD_COLORS[a.award_type]||'#b45309',flexShrink:0}}></i>
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{color:'#1a1512'}}>{AWARD_LABELS[a.award_type]||a.award_type}</div>
                <div className="text-xs" style={{color:'#8a8279'}}>
                  {a.season} · {a.period?.replace(/_p\d+$/,'').replace('week_',isPT?'Semana ':'Week ').replace('month_',isPT?'Mês ':'Month ').replace('season',isPT?'Época Completa':'Full Season')}
                </div>
              </div>
              {a.stats_context?.ppg && (
                <div className="text-xs font-semibold" style={{color:'#5c554e'}}>
                  {a.stats_context.ppg} PPG
                  {a.stats_context.rpg && ` · ${a.stats_context.rpg} RPG`}
                  {a.stats_context.apg && ` · ${a.stats_context.apg} APG`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CONTRACT */}
      {contracts.length > 0 && (
        <div className="mt-6">
          <div className="sec-hdr mb-3"><span className="sec-title">{isPT?'Contrato':'Contract'}</span></div>
          <div className="rounded-xl overflow-hidden mb-6" style={{border:'1px solid #d4cdc5'}}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{background:'#f0ece5',borderBottom:'1px solid #d4cdc5'}}>
                  <th className="px-4 py-2.5 text-left font-semibold" style={{color:'#5c554e'}}>{isPT?'Época':'Season'}</th>
                  <th className="px-4 py-2.5 text-right font-semibold" style={{color:'#5c554e'}}>{isPT?'Salário':'Salary'}</th>
                  <th className="px-4 py-2.5 text-right font-semibold" style={{color:'#5c554e'}}>{isPT?'Tipo':'Type'}</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c:any,i:number) => {
                  const typeInfo=TYPE_LABEL[c.type]||{label:c.type,color:'#5c554e',bg:'#f0ece5'}
                  const isCurrent=c.season==='2025-26'
                  return (
                    <tr key={c.id} style={{background:isCurrent?tc+'11':i%2===0?'#faf8f5':'#f5f1eb',borderBottom:'1px solid #e2dcd5'}}>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold" style={{color:isCurrent?tc:'#1a1512'}}>{c.season}</span>
                        {isCurrent && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{background:tc+'22',color:tc}}>{isPT?'Atual':'Current'}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold" style={{color:'#1a1512'}}>{capFmt(c.salary)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                              style={{background:typeInfo.bg,color:typeInfo.color}}>{typeInfo.label}</span>
                      </td>
                    </tr>
                  )
                })}
                <tr style={{background:'#f0ece5',borderTop:'2px solid #d4cdc5'}}>
                  <td className="px-4 py-2.5 font-bold" style={{color:'#1a1512'}}>{isPT?'Total':'Total'}</td>
                  <td className="px-4 py-2.5 text-right font-black" style={{color:'#c8102e'}}>{capFmt(totalValue)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

'use client'
import { useTranslation } from '@/components/I18nProvider'

function RuleCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div style={{ display:'flex', gap:14, padding:'16px 18px', background:'#faf8f5', border:'1px solid #d4cdc5', borderRadius:12 }}>
      <div style={{ fontSize:24, flexShrink:0 }}>{icon}</div>
      <div>
        <div style={{ fontSize:14, fontWeight:700, color:'#1a1512', marginBottom:4 }}>{title}</div>
        <div style={{ fontSize:13, color:'#5c554e', lineHeight:1.6 }}>{desc}</div>
      </div>
    </div>
  )
}

export default function GLeagueRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'🏀', title:'Jogos Simulados Automaticamente', desc:'Os jogos da G League são resolvidos sozinhos durante a simulação semanal, pela data real do calendário — não precisas de fazer nada. Um lote de até 120 jogos é processado de cada vez, sempre pela ordem cronológica correta, para nunca ficar para trás.' },
    { icon:'👥', title:'Mínimo de 10 Jogadores por Equipa', desc:'Todas as semanas, qualquer equipa da G League com menos de 10 jogadores recebe automaticamente reforços vindos da Free Agency. São sempre jogadores até 23 anos, que não pertencem ao Rest of the World nem a uma futura Draft Class — nunca é atribuído um prospect que ainda não foi draftado.' },
    { icon:'📊', title:'Box Score Real por Jogador', desc:'Cada jogo da G League gera agora uma box score completa e individual — pontos, ressaltos, assistências, roubos, bloqueios, FG, 3 Pontos, lances livres, perdas de bola e faltas para cada jogador em campo, tal como nos jogos da NBA. Nenhuma equipa fica alguma vez com menos de 5 jogadores em campo, e ninguém joga mais do que 42 minutos num jogo.' },
    { icon:'⬆️', title:'Jogador da NBA Enviado (Assignment)', desc:'Quando envias um jogador da tua equipa da NBA para a G League, ele passa automaticamente a ser a 1ª opção da equipa lá em baixo — titular garantido e o jogador com mais minutos, enquanto lá estiver. Se enviares vários ao mesmo tempo, todos passam à frente do resto do plantel, ordenados entre si pelo respetivo Usage.' },
    { icon:'📈', title:'Estatísticas na Página do Jogador', desc:'Qualquer jogador com pelo menos 1 jogo na G League ganha um separador extra na sua página — "G-League" — com Estatísticas da Época (médias por jogo, incluindo ressaltos ofensivos/defensivos, FG%, 3P%, duplos-duplos e triplos-duplos) e os Últimos 5 Jogos, junto do separador normal da NBA.' },
    { icon:'🚫', title:'Sem +/-', desc:'A G League não simula jogada a jogada quem está em campo, por isso não existe estatística de +/- para estes jogos — todas as outras estatísticas (pontos, ressaltos, assistências, etc.) são reais e guardadas normalmente.' },
  ] : [
    { icon:'🏀', title:'Games Simulate Automatically', desc:"G-League games resolve on their own during the weekly simulation, matched by real calendar date — you don't need to do anything. A batch of up to 120 games is processed at a time, always in the correct chronological order, so nothing ever falls behind." },
    { icon:'👥', title:'Minimum 10 Players Per Team', desc:'Every week, any G-League team with fewer than 10 players automatically gets reinforcements pulled from Free Agency. They are always players aged 23 or under, who belong to neither the Rest of the World pool nor a future draft class — a not-yet-drafted prospect is never assigned this way.' },
    { icon:'📊', title:'Real Per-Player Box Scores', desc:"Every G-League game now generates a full, individual box score — points, rebounds, assists, steals, blocks, FG, 3-pointers, free throws, turnovers, and fouls for every player who took the floor, just like NBA games. No team is ever left with fewer than 5 players on the floor, and nobody plays more than 42 minutes in a single game." },
    { icon:'⬆️', title:'NBA Player Assignment', desc:"When you assign a player from your NBA roster down to the G-League, he automatically becomes that team's 1st option — a guaranteed starter with the most minutes, for as long as he's down there. Assign several at once and they all rank ahead of the rest of the roster, ordered among themselves by their own Usage." },
    { icon:'📈', title:'Stats on the Player Page', desc:'Any player with at least 1 G-League game gets an extra tab on his player page — "G-League" — with Season Statistics (per-game averages, including offensive/defensive rebounds, FG%, 3P%, double-doubles and triple-doubles) and his Last 5 Games, right alongside the regular NBA tab.' },
    { icon:'🚫', title:'No +/-', desc:"The G-League doesn't simulate play-by-play who's on the floor, so there's no +/- stat for these games — every other stat (points, rebounds, assists, etc.) is real and tracked normally." },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🏀 {isPT?'Regras da G-League':'G-League Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como funcionam os jogos, os plantéis e as estatísticas da G League.':'How G-League games, rosters, and stats work.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
    </div>
  )
}

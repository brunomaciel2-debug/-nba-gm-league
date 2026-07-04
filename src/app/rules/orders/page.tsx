'use client'
import { useTranslation } from '@/components/I18nProvider'

export default function OrdersRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const sections = isPT ? [
    { title:'Rotação', color:'#1d4ed8', icon:'📋', rules:['Cada uma das 5 posições (Base, Escolta, Ala, Ala-Poste, Poste) tem 3 slots: Titular, 1º Suplente e 2º Suplente.','Atribui um jogador e minutos a cada slot. O total de minutos por posição tem de ser exatamente 48 — a barra fica verde quando atinges 48/48.','Um jogador só pode ser atribuído a posições compatíveis com o seu perfil.'] },
    { title:'Função com Bola por Jogador', color:'#c2410c', icon:'🏀', rules:['Independente dos minutos — define como cada jogador usa a bola quando a tem: Dominante, Equilibrado, ou Sem Bola.','Jogadores Dominantes controlam a maioria das posses. Jogadores Sem Bola movem-se sem a bola e finalizam jogadas criadas por outros.','Esta definição é sobre estilo de jogo, não sobre quem termina as jogadas de ataque.'] },
    { title:'Prioridades Ofensivas', color:'#b45309', icon:'🎯', rules:['Define a 1ª, 2ª e 3ª opção de ataque — os jogadores que recebem a bola com mais frequência em situações de meia-court.','Trata-se de quem finaliza as jogadas, não de quem controla a bola.'] },
    { title:'Táticas', color:'#15803d', icon:'🧠', rules:['Jogador de Clutch: recebe a bola nos últimos 2 minutos em jogos decididos por 5 pontos ou menos.','Ritmo (50–100): controla o quão rápido a equipa joga. Ritmo alto = mais posses por jogo.','Taxa de 3 Pontos (0–80%): percentagem de posses terminadas com lançamento de 3. Média NBA ronda os 38%.','Estilo Ofensivo: Motion, Pick & Roll, Contra-ataque, Isolamento, ou Poste.','Estilo Defensivo: Individual, Zona 2-3, Pressing Total, ou Defesa Fechada.'] },
    { title:'Intensidade de Treino', color:'#6d28d9', icon:'🏋️', rules:['Cinco níveis: Descanso, Leve, Normal, Intenso, Carga Máxima.','Afecta duas coisas ao mesmo tempo: a recuperação de saúde entre jogos (Descanso +150%, Leve +25%, Normal completa, Intenso −50%, Carga Máxima −75% e risco de lesão) e a velocidade a que os atributos dos jogadores evoluem (Descanso pode mesmo fazer regredir ligeiramente, Normal é o ritmo padrão, Carga Máxima quase duplica o ritmo de evolução).','Intensidade mais alta acelera a evolução dos jogadores mas reduz a recuperação entre jogos — é sempre uma troca.'] },
  ] : [
    { title:'Depth Chart', color:'#1d4ed8', icon:'📋', rules:['Each of the 5 positions (PG, SG, SF, PF, C) has 3 slots: Starter, 1st Sub, and 2nd Sub.','Assign a player and minutes to each slot. Total minutes per position must equal exactly 48 — the progress bar turns green at 48/48.','A player can only be assigned to compatible positions for their role.'] },
    { title:'Ball Role per Player', color:'#c2410c', icon:'🏀', rules:['Independent from minutes — this defines how each player uses the ball: Ball Dominant, Balanced, or Off-Ball.','Ball Dominant players control most possessions. Off-Ball players move without the ball and finish plays created by others.','This is about playstyle, not who finishes scoring plays.'] },
    { title:'Offensive Priorities', color:'#b45309', icon:'🎯', rules:['Set your 1st, 2nd, and 3rd scoring options — the players who receive the ball most often in half-court situations.','This is about who finishes plays, not who controls the ball.'] },
    { title:'Tactics', color:'#15803d', icon:'🧠', rules:['Clutch Player: gets the ball in the final 2 minutes in games decided by 5 points or fewer.','Pace (50–100): controls how fast your team plays. High pace = more possessions per game.','Three-Point Rate (0–80%): the percentage of possessions ending in a 3-point attempt. NBA average is ~38%.','Attack Style: Motion, Pick & Roll, Fast Break, Isolation, or Post-Up.','Defense Style: Man-to-Man, Zone 2-3, Full-Court Press, or Pack the Paint.'] },
    { title:'Training Intensity', color:'#6d28d9', icon:'🏋️', rules:['Five levels: Rest, Light, Normal, Intense, Max Load.','Affects two things at once: health recovery between games (Rest +150%, Light +25%, Normal full regen, Intense −50%, Max Load −75% and injury risk) and how fast player attributes actually develop (Rest can even cause a slight regression, Normal is the baseline pace, Max Load nearly doubles development speed).','Higher intensity speeds up player development but reduces recovery between games — it\'s always a trade-off.'] },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>📋 {t('ordersGuide.title')}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>{t('ordersGuide.subtitle')}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {sections.map(section => (
          <div key={section.title} style={{ background:'#faf8f5', border:'1px solid #d4cdc5', borderTop:`3px solid ${section.color}`, borderRadius:12, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ fontSize:18 }}>{section.icon}</span>
              <span style={{ fontSize:14, fontWeight:700, color:section.color }}>{section.title}</span>
            </div>
            <ul style={{ margin:0, paddingLeft:18, display:'flex', flexDirection:'column', gap:6 }}>
              {section.rules.map((r,i) => <li key={i} style={{ fontSize:13, color:'#5c554e', lineHeight:1.6 }}>{r}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#dbeafe', border:'1px solid #93c5fd' }}>
        <div style={{ fontSize:12, color:'#1d4ed8', lineHeight:1.7 }}>
          {isPT ? 'Cada posição precisa de exatamente 48 minutos · Função com Bola ≠ Prioridade Ofensiva · Ritmo, Taxa 3P, Estilo Ofensivo & Defensivo definem o plano de jogo · Intensidade de treino troca recuperação de saúde por velocidade de evolução dos jogadores.' : 'Each position needs exactly 48 minutes · Ball Role ≠ Offensive Priority · Pace, 3PT Rate, Attack & Defense Style shape your game plan · Training Intensity trades health recovery for player development speed.'}
        </div>
      </div>
    </div>
  )
}

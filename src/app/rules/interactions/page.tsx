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

export default function InteractionsRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'📊', title:'Como a Moral Sobe e Desce, Toda as Semanas', desc:'Todas as semanas, a moral de cada jogador aproxima-se de um "alvo merecido" que começa em 50 (neutro) e depois soma: até ±15 pela % de vitórias da equipa; ±12 se um jogador de uso alto não está a ser titular o suficiente (ou +8 se um suplente é titular a mais do que devia); e até ±12 conforme os pontos recentes dele estão acima ou abaixo da própria média da época. O alvo final fica sempre entre 15 e 92 — nunca fica preso permanentemente num extremo. Isto significa que a moral pode subir OU descer por estas razões, não é só recuperação passiva.' },
    { icon:'🧠', title:'O Papel do Mental Coach', desc:'O Mental Coach da equipa controla a velocidade com que a moral se aproxima desse alvo semanal, de 6% (Gestão de Moral fraca) a 22% (Gestão de Moral no máximo) do caminho percorrido por semana — um bom Mental Coach estabiliza a equipa mais depressa nesse número, quer seja para melhor ou para pior. Também tem outros 2 atributos com efeito direto em campo: Coesão de Equipa (mais assistências, menos perdas de bola) e Gestão de Pressão (menos quebra de rendimento em jogos decisivos/clutch).' },
    { icon:'🎯', title:'A Moral Afeta Mesmo o Jogo', desc:'Um jogador descontente literalmente lança pior: a precisão de lançamento varia entre 0.92x (moral 0) e 1.00x (moral 100) — um efeito real, por cima de qualquer outro modificador, aplicado a todos os tipos de lançamento. A moral também acelera ou trava o desenvolvimento passivo de atributos (ver página de Treino). Não é só um número decorativo.' },
    { icon:'🤕', title:'Lesões Também Pesam na Moral', desc:'Uma lesão desce a moral na hora, proporcional à gravidade — faz sentido, ninguém fica contente por ficar de fora.' },
    { icon:'😟', title:'Quando um Jogador Fica Descontente', desc:'Sempre que a Moral de um jogador cai abaixo de 40/100, há uma hipótese semanal de 25% de ele levantar uma queixa concreta — não uma queixa genérica, mas uma razão específica e credível, ajustada à situação real dele (um jogador que já joga 28+ minutos não vai pedir mais minutos).' },
    { icon:'📋', title:'Dois Tipos de Interação', desc:'Monitorizada: o jogador exige algo mensurável (mais minutos, ser titular, entrar nas prioridades ofensivas, ser o Jogador de Clutch, ser Defensor de Marcação, mais descanso, mais lançamentos de 3) — o sistema observa as tuas Ordens Semanais reais durante 2 semanas e resolve sozinho consoante o que realmente aconteceu. Imediata: o jogador expõe algo que precisa de uma resposta tua na hora.' },
    { icon:'🔍', title:'Nem Todo Clique é Igual', desc:'Para a maioria das exigências sérias (mentor veterano, conversas de contrato, conflitos de equipa, questões pessoais), Ceder ou Meio-Termo NÃO mudam a moral na hora — ficam registados como um compromisso, e só 2 semanas depois é que o sistema verifica, com dados reais (jogos, Ordens Semanais, propostas de contrato, créditos de treino gastos), se cumpriste mesmo. Já em interações mais leves (pedir para ver um Especialista por uma lesão, ou um simples desabafo geral), Ceder resolve a moral de imediato, tal como Recusar. Verifica sempre o prazo apresentado para saberes qual dos dois casos se aplica.' },
    { icon:'🎯', title:'Resposta Imediata — 3 Opções', desc:'Ceder ao Pedido e Meio-Termo abrem, na maioria dos casos, um período de verificação de 2 semanas (maior ou menor subida de moral consoante o que realmente aconteceres a fazer) — exceto nas exigências mais leves, onde resolvem de imediato. Recusar é sempre imediato e a moral desce logo. Se nunca responderes, ao fim de 2 semanas conta automaticamente como Recusa.' },
    { icon:'📈', title:'Resolução de Pedidos Monitorizados', desc:'Ao fim do prazo (normalmente 2 semanas): se cumpriste o que foi pedido, a moral sobe bastante (+20); se cumpriste só em parte, sobe pouco ou mantém-se (+5); se ignoraste completamente, desce ainda mais (-15).' },
    { icon:'🤝', title:'Pode Envolver Dois Jogadores', desc:'Algumas interações têm um "parceiro" — por exemplo, um jogador que pede para ser titular mais vezes ao lado de um companheiro específico (monitorizada: o sistema verifica nos jogos reais se os dois foram mesmo titulares juntos), ou um conflito de balneário entre dois jogadores. A tua resposta pode mexer na moral dos dois, não só de quem se queixou.' },
    { icon:'📄', title:'Nunca Contra as Regras do Jogo', desc:'Cada razão só aparece se houver mesmo algo que possas fazer sobre ela dentro das regras reais do simulador — por exemplo, "quer falar de extensão de contrato" só surge se o jogador tiver 2 anos ou menos de contrato, exatamente a mesma condição da Extensão de Contrato real. "Ceder" nunca garante um contrato novo por si só — é o sinal para ires à página dele e fazeres uma proposta real, que ainda passa pela decisão do próprio jogador.' },
    { icon:'💬', title:'Separador "Interações"', desc:'Cada equipa tem um separador próprio com todas as interações em aberto (com botões de resposta ou o progresso a ser monitorizado) e um histórico do que já foi resolvido — para veres sempre quantas conversas tens pendentes.' },
    { icon:'🎲', title:'Uma Pool Extensa e Credível', desc:'Mais de 20 razões possíveis, sobretudo profissionais (minutos, titularidade, contrato, papel na equipa, desenvolvimento, descanso) mas também pessoais (saudades de casa, pressão mediática, momentos difíceis) — cada uma só aparece se fizer sentido para a situação real do jogador.' },
  ] : [
    { icon:'📊', title:'How Morale Rises and Falls, Every Week', desc:"Every week, each player's morale drifts toward a \"deserved target\" that starts at 50 (neutral) and then adds: up to ±15 for the team's win%; ±12 if a high-usage player isn't starting enough (or +8 if a bench player is starting more than he should); and up to ±12 based on whether his recent scoring is above or below his own season average. The final target is always clamped between 15 and 92 — it never gets permanently stuck at an extreme. Morale can rise OR fall for these reasons, not just passively recover." },
    { icon:'🧠', title:"The Mental Coach's Role", desc:"The team's Mental Coach controls how fast morale drifts toward that weekly target, from 6% (poor Morale Management) up to 22% (maxed-out Morale Management) of the remaining distance per week — a great Mental Coach settles a team on the right number faster, for better or worse. He also has 2 other attributes with a direct on-court effect: Team Cohesion (more assists, fewer turnovers) and Composure (less choking in clutch/decisive games)." },
    { icon:'🎯', title:'Morale Genuinely Affects the Game', desc:"An unhappy player literally shoots worse: shooting accuracy scales between 0.92x (morale 0) and 1.00x (morale 100) — a real effect, stacked on top of every other modifier, applied to all shot types. Morale also speeds up or slows down passive attribute development (see the Training rules page). It's not just a decorative number." },
    { icon:'🤕', title:'Injuries Hit Morale Too', desc:"An injury drops morale immediately, proportional to its severity — makes sense, nobody's happy about being sidelined." },
    { icon:'😟', title:'When a Player Becomes Unhappy', desc:"Whenever a player's Morale drops below 40/100, there's a weekly 25% chance he raises a concrete complaint — not a generic one, but a specific, credible reason matched to his real situation (a player already playing 28+ minutes won't ask for more)." },
    { icon:'📋', title:'Two Kinds of Interaction', desc:"Monitored: the player demands something measurable (more minutes, a starting spot, an offensive priority slot, the Clutch role, the Lockdown Defender role, more rest, more 3-point looks) — the system watches your real Weekly Orders for 2 weeks and resolves itself based on what actually happened. Immediate: the player states something that needs a response from you right away." },
    { icon:'🔍', title:'Not Every Click Works the Same Way', desc:"For most serious demands (veteran mentor, contract talks, team conflicts, personal issues), Concede or Compromise do NOT change morale on the spot — they get logged as a commitment, and only 2 weeks later does the system check, against real data (games, Weekly Orders, contract offers, training credits actually spent), whether you really followed through. For lighter interactions (asking to see a Specialist for an injury, or a simple general check-in), Concede resolves morale instantly, just like Dismiss. Always check the deadline shown to know which case applies." },
    { icon:'🎯', title:'Immediate Response — 3 Choices', desc:"Concede and Compromise usually open a 2-week verification window (bigger or smaller morale boost depending on what you actually go on to do) — except for the lightest demands, which resolve instantly. Dismiss is always instant and morale drops right away. Leave it unanswered for 2 weeks and it auto-resolves as a Dismiss." },
    { icon:'📈', title:'Resolving Monitored Demands', desc:'At the deadline (usually 2 weeks): if you delivered on the demand, morale rises a lot (+20); if you partially delivered, it rises a little or holds steady (+5); if you ignored it entirely, it drops further (-15).' },
    { icon:'🤝', title:'Can Involve Two Players', desc:"Some interactions have a \"partner\" — for example, a player asking to start more often alongside a specific teammate (monitored: the system checks real games to see if the two actually started together), or a locker-room conflict between two players. Your response can move both players' morale, not just the one who complained." },
    { icon:'📄', title:'Never Against the Game\'s Own Rules', desc:'Every reason only shows up if there\'s actually something you can do about it within the simulator\'s real rules — for example, "wants extension talks" only appears if the player has 2 years or fewer left on his deal, the exact same condition as the real Contract Extension feature. "Concede" never guarantees a new contract by itself — it\'s the signal to go to his player page and make a real offer, which still goes through the player\'s own decision.' },
    { icon:'💬', title:'"Interactions" Tab', desc:'Every team has its own tab listing every open interaction (with response buttons or live monitored progress) and a history of everything already resolved — so you always know how many conversations are pending.' },
    { icon:'🎲', title:'An Extensive, Credible Pool', desc:'20+ possible reasons, mostly professional (minutes, starting role, contract, team role, development, rest) but also personal (homesickness, media pressure, hard personal moments) — each one only shows up if it actually fits the player\'s real situation.' },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>💬 {isPT?'Moral e Interações com Jogadores':'Morale & Player Interactions'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como a moral funciona semana a semana, e como e porque um jogador fica descontente.':'How morale works week to week, and how and why a player becomes unhappy.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#fee2e2', border:'1px solid #fca5a5' }}>
        <div style={{ fontSize:12, color:'#dc2626', lineHeight:1.7 }}>
          {isPT
            ? 'Moral afeta mesmo a precisão de lançamento (0.92x-1.00x) e o desenvolvimento · Moral < 40 = 25% de hipótese semanal de queixa · Monitorizada: 2 semanas de observação real, exceto pedidos leves que resolvem na hora · Sem resposta em 2 semanas = Recusa automática · Algumas interações mexem na moral de 2 jogadores.'
            : "Morale genuinely affects shooting accuracy (0.92x-1.00x) and development · Morale < 40 = 25% weekly chance of a complaint · Monitored: 2 real weeks of observation, except light demands which resolve instantly · No response in 2 weeks = automatic Dismiss · Some interactions move 2 players' morale."}
        </div>
      </div>
    </div>
  )
}

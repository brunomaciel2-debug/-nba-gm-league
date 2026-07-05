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
    { icon:'😟', title:'Quando um Jogador Fica Descontente', desc:'Sempre que a Moral de um jogador cai abaixo de 40/100, há uma hipótese semanal de 25% de ele levantar uma queixa concreta — não uma queixa genérica, mas uma razão específica e credível, ajustada à situação real dele (um jogador que já joga 34 minutos não vai pedir mais minutos).' },
    { icon:'📋', title:'Dois Tipos de Interação', desc:'Monitorizada: o jogador exige algo mensurável (mais minutos, ser titular, entrar nas prioridades ofensivas, ser o Jogador de Clutch, ser Defensor de Marcação, mais descanso, mais lançamentos de 3) — o sistema observa as tuas Ordens Semanais reais durante 2 semanas e resolve sozinho consoante o que realmente aconteceu. Imediata: o jogador expõe algo que exige uma resposta tua na hora.' },
    { icon:'🎯', title:'Resposta Imediata — 3 Opções', desc:'Ceder ao Pedido (maior subida de moral, mas nem sempre sem custo), Meio-Termo (subida pequena), Recusar (a moral desce). Se nunca responderes, ao fim de 2 semanas conta automaticamente como Recusa.' },
    { icon:'📈', title:'Resolução de Pedidos Monitorizados', desc:'Ao fim do prazo (normalmente 2 semanas): se cumpriste o que foi pedido, a moral sobe bastante (+20); se cumpriste só em parte, sobe pouco ou mantém-se (+5); se ignoraste completamente, desce ainda mais (-15).' },
    { icon:'🤝', title:'Pode Envolver Dois Jogadores', desc:'Algumas interações têm um "parceiro" — por exemplo, um jogador que pede para ser titular mais vezes ao lado de um companheiro específico (monitorizada: o sistema verifica nos jogos reais se os dois foram mesmo titulares juntos), ou um conflito de balneário entre dois jogadores. A tua resposta pode mexer na moral dos dois, não só de quem se queixou.' },
    { icon:'📄', title:'Nunca Contra as Regras do Jogo', desc:'Cada razão só aparece se houver mesmo algo que possas fazer sobre ela dentro das regras reais do simulador — por exemplo, "quer falar de extensão de contrato" só surge se o jogador tiver 2 anos ou menos de contrato, exatamente a mesma condição da Extensão de Contrato real. "Ceder" nunca garante um contrato novo por si só — é o sinal para ires à página dele e fazeres uma proposta real, que ainda passa pela decisão do próprio jogador.' },
    { icon:'💬', title:'Separador "Interações"', desc:'Cada equipa tem um separador próprio com todas as interações em aberto (com botões de resposta ou o progresso a ser monitorizado) e um histórico do que já foi resolvido — para veres sempre quantas conversas tens pendentes.' },
    { icon:'🎲', title:'Uma Pool Extensa e Credível', desc:'Mais de 20 razões possíveis, sobretudo profissionais (minutos, titularidade, contrato, papel na equipa, desenvolvimento, descanso) mas também pessoais (saudades de casa, pressão mediática, momentos difíceis) — cada uma só aparece se fizer sentido para a situação real do jogador.' },
  ] : [
    { icon:'😟', title:'When a Player Becomes Unhappy', desc:"Whenever a player's Morale drops below 40/100, there's a weekly 25% chance he raises a concrete complaint — not a generic one, but a specific, credible reason matched to his real situation (a player already playing 34 minutes won't ask for more)." },
    { icon:'📋', title:'Two Kinds of Interaction', desc:"Monitored: the player demands something measurable (more minutes, a starting spot, an offensive priority slot, the Clutch role, the Lockdown Defender role, more rest, more 3-point looks) — the system watches your real Weekly Orders for 2 weeks and resolves itself based on what actually happened. Immediate: the player states something that needs your response right away." },
    { icon:'🎯', title:'Immediate Response — 3 Choices', desc:"Concede (biggest morale boost, though not always free), Compromise (small boost), Dismiss (morale drops). Leave it unanswered for 2 weeks and it auto-resolves as a Dismiss." },
    { icon:'📈', title:'Resolving Monitored Demands', desc:'At the deadline (usually 2 weeks): if you delivered on the demand, morale rises a lot (+20); if you partially delivered, it rises a little or holds steady (+5); if you ignored it entirely, it drops further (-15).' },
    { icon:'🤝', title:'Can Involve Two Players', desc:"Some interactions have a \"partner\" — for example, a player asking to start more often alongside a specific teammate (monitored: the system checks real games to see if the two actually started together), or a locker-room conflict between two players. Your response can move both players' morale, not just the one who complained." },
    { icon:'📄', title:'Never Against the Game\'s Own Rules', desc:'Every reason only shows up if there\'s actually something you can do about it within the simulator\'s real rules — for example, "wants extension talks" only appears if the player has 2 years or fewer left on his deal, the exact same condition as the real Contract Extension feature. "Concede" never guarantees a new contract by itself — it\'s the signal to go to his player page and make a real offer, which still goes through the player\'s own decision.' },
    { icon:'💬', title:'"Interactions" Tab', desc:'Every team has its own tab listing every open interaction (with response buttons or live monitored progress) and a history of everything already resolved — so you always know how many conversations are pending.' },
    { icon:'🎲', title:'An Extensive, Credible Pool', desc:'20+ possible reasons, mostly professional (minutes, starting role, contract, team role, development, rest) but also personal (homesickness, media pressure, hard personal moments) — each one only shows up if it actually fits the player\'s real situation.' },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>💬 {isPT?'Regras de Interações com Jogadores':'Player Interactions Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como e porque um jogador fica descontente, e o que podes fazer sobre isso.':'How and why a player becomes unhappy, and what you can do about it.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#fee2e2', border:'1px solid #fca5a5' }}>
        <div style={{ fontSize:12, color:'#dc2626', lineHeight:1.7 }}>
          {isPT
            ? 'Moral < 40 = 25% de hipótese semanal de queixa · Monitorizada: 2 semanas de observação real · Imediata: 3 respostas com outcomes diferentes · Sem resposta em 2 semanas = Recusa automática · Algumas interações mexem na moral de 2 jogadores.'
            : 'Morale < 40 = 25% weekly chance of a complaint · Monitored: 2 real weeks of observation · Immediate: 3 responses with different outcomes · No response in 2 weeks = automatic Dismiss · Some interactions move 2 players\' morale.'}
        </div>
      </div>
    </div>
  )
}

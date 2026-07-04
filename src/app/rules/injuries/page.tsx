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

export default function InjuriesRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'🏥', title:'75 Tipos de Lesão', desc:'Físicas (entorses, roturas, fraturas) e psicológicas (ansiedade, esgotamento, quebras de confiança). Cada uma tem a sua própria gravidade e duração — de uma entorse ligeira de alguns dias a uma rotura grave que encerra a época.' },
    { icon:'🎲', title:'Como Acontece uma Lesão', desc:'Todas as semanas, cada jogador que joga tem uma pequena hipótese de se lesionar — a hipótese sobe se a Durability for baixa, se a saúde já estiver reduzida, ou se a equipa jogar a um ritmo muito alto (Pace). O estilo do adversário também conta: um ritmo alto, uma defesa "Pressing Total" ou um ataque muito baseado em isolamento/poste aumentam o teu risco nesse jogo.' },
    { icon:'💤', title:'Recuperação Semanal', desc:'Todas as semanas, a saúde do jogador recupera um pouco — mais depressa com Intensidade de Treino "Repouso/Leve", mais devagar com "Intensa". Um jogador com saúde abaixo de 50% fica indisponível para jogar até recuperar de volta acima desse valor.' },
    { icon:'⚡', title:'Saúde Reduzida = Pior em Campo', desc:'Um jogador "tocado" (saúde entre 50-99%) já não joga como se estivesse a 100% — a saúde afeta diretamente o desgaste dele durante o próprio jogo, reduzindo pontaria e a frequência com que a bola lhe chega, tal como acontece naturalmente com o cansaço ao longo de um jogo.' },
    { icon:'🔁', title:'Risco de Reincidência', desc:'Depois de recuperares de uma lesão, o jogador fica "frágil" nessa zona do corpo durante algumas semanas — o período varia consoante a lesão (de 1 a 6 semanas). Nesse período há mais hipótese de se lesionar outra vez, sobretudo na mesma zona.' },
    { icon:'🧑‍⚕️', title:'O Papel do Physio', desc:'Um Physio (equipa técnica) de qualidade acelera a recuperação de qualquer jogador atualmente lesionado, até 30% mais rápido com um Physio no máximo — e o inverso com um Physio fraco. Só conta enquanto o jogador estiver lesionado.' },
    { icon:'💵', title:'Despesas Médicas', desc:'Toda a lesão custa dinheiro automaticamente à tua equipa — a fatura sobe com a gravidade, de despesas ligeiras numa entorse até valores elevados numa lesão grave. Aparece nas tuas Finanças como despesa.' },
    { icon:'🩺', title:'Ver Especialista', desc:'Em lesões sérias, severas ou de risco de carreira, podes pagar para levar o jogador a um especialista externo — não o cura na hora, mas acelera a recuperação semanal dele (em cima do que o Physio já dá) até estar totalmente recuperado. Quanto mais grave a lesão, mais caro e maior a aceleração. Só pode ser usado uma vez por lesão.' },
    { icon:'📬', title:'Sempre Avisado', desc:'Recebes sempre uma notificação quando um jogador teu se lesiona, com o tipo de lesão, zona afetada, jogos estimados de paragem, e — se aplicável — a opção de consultar um especialista diretamente a partir da notificação.' },
  ] : [
    { icon:'🏥', title:'75 Injury Types', desc:'Physical (sprains, tears, fractures) and psychological (anxiety, burnout, confidence crises). Each has its own severity and duration — from a minor sprain lasting a few days to a serious tear that ends the season.' },
    { icon:'🎲', title:'How an Injury Happens', desc:'Every week, each player who plays has a small chance of getting hurt — the chance rises if Durability is low, if health is already reduced, or if the team plays at a very high Pace. The opponent\'s style matters too: a fast tempo, a "Full-Court Press" defense, or an offense heavy on isolation/post-ups all raise your risk in that game.' },
    { icon:'💤', title:'Weekly Recovery', desc:'Every week, a player\'s health recovers a bit — faster with "Rest/Light" Training Intensity, slower with "Intense." A player whose health drops below 50% becomes unavailable to play until it recovers back above that line.' },
    { icon:'⚡', title:'Reduced Health = Worse On Court', desc:'A "banged up" player (health between 50-99%) no longer plays like he\'s at 100% — health directly affects his in-game wear, reducing shooting accuracy and how often the ball comes his way, the same way normal fatigue already builds up over the course of a game.' },
    { icon:'🔁', title:'Reinjury Risk', desc:'After recovering from an injury, a player stays "fragile" in that body part for a few weeks — the window varies by injury (1 to 6 weeks). During that window he\'s more likely to get hurt again, especially in the same spot.' },
    { icon:'🧑‍⚕️', title:'The Physio\'s Role', desc:'A quality Physio (coaching staff) speeds up recovery for any player currently injured, up to 30% faster with a maxed-out Physio — and the reverse with a weak one. It only matters while the player is actually injured.' },
    { icon:'💵', title:'Medical Bills', desc:'Every injury automatically costs your team money — the bill scales with severity, from a small charge on a sprain up to a large one on a serious injury. It shows up in your Finances as an expense.' },
    { icon:'🩺', title:'See a Specialist', desc:'On serious, severe, or career-threatening injuries, you can pay to send the player to an outside specialist — it doesn\'t heal him instantly, but speeds up his weekly recovery (on top of whatever the Physio already gives) until he\'s fully healed. The worse the injury, the more it costs and the bigger the speedup. Usable only once per injury.' },
    { icon:'📬', title:'Always Notified', desc:'You always get a notification when one of your players gets hurt, with the injury type, body part, estimated games out, and — when it applies — the option to consult a specialist directly from the notification.' },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🏥 {isPT?'Regras de Lesões':'Injury Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como as lesões acontecem, como recuperar delas, e o que podes fazer para acelerar o processo.':'How injuries happen, how to recover from them, and what you can do to speed the process up.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#fee2e2', border:'1px solid #fca5a5' }}>
        <div style={{ fontSize:12, color:'#dc2626', lineHeight:1.7 }}>
          {isPT
            ? 'Saúde < 50% = indisponível · 50-99% = joga pior de verdade · Recuperação semanal automática · Physio acelera até 30% · Especialista: acelera (não cura na hora), uso único · Risco de reincidência 1-6 semanas · Estilo do adversário conta.'
            : 'Health < 50% = unavailable · 50-99% = genuinely plays worse · Automatic weekly recovery · Physio speeds it up to 30% · Specialist: speeds up (not instant), one-time use · 1-6 week reinjury risk · Opponent style matters.'}
        </div>
      </div>
    </div>
  )
}

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

export default function TrainingRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'
  const rules = isPT ? [
    { icon:'🌱', title:'Desenvolvimento Passivo (toda a semana, automático)', desc:'Independente de gastares créditos ou não, todos os jogadores têm uma chance semanal real de progredir em qualquer atributo abaixo do seu potencial. Depende da intensidade de treino que escolheste nas Ordens Semanais (Descanso a Muito Intenso), da idade (jogadores ≤22 anos evoluem ~1.5x mais depressa que a média; acima dos 31 a evolução cai a pique), saúde, moral, e da qualidade do Head Coach (Desenvolvimento de Jogador geral + IQ Ataque/Defesa), Assistant Coach (bónus de especialidade) e Preparador Físico (condicionamento, para atributos físicos). Acima dos 34 anos há também uma chance semanal de declínio de -1.' },
    { icon:'🏋️', title:'Slots de Treino (gasto manual de créditos)', desc:'Além do desenvolvimento passivo, cada categoria — Ataque, Defesa, Físico, Jogo de Equipa, Mental, Recuperação, Treino de Lançamento e Análise — tem o seu próprio slot que enche sozinho e te deixa investir créditos num jogador à tua escolha.' },
    { icon:'🔋', title:'Créditos Acumulam Automaticamente', desc:'Os slots acumulam % de enchimento todas as semanas. Cada vez que um slot atinge 100% paga 10 créditos e o excesso continua a acumular por cima — não pára ao ficar cheio, por isso podes deixar um slot a acumular várias rondas de créditos antes de gastares.' },
    { icon:'💰', title:'Custo por Ponto de Atributo (sobe com o nível)', desc:'Custa mais caro melhorar um jogador já bom: 0.5 crédito/ponto até aos 60, 1 crédito/ponto dos 61 aos 75, 2 créditos/ponto dos 76 aos 90, e 3 créditos/ponto dos 91 aos 99. Máximo de 3 créditos gastos por jogador por sessão de treino.' },
    { icon:'💪', title:'Como Gastar Créditos', desc:'No separador Treino, aloca créditos disponíveis a um jogador específico para acelerar o seu desenvolvimento nessa categoria. Podes dividir os créditos de um slot por vários jogadores em sessões diferentes, mas cada sessão individual está limitada a 3 créditos por jogador.' },
    { icon:'📈', title:'Tecto de Potencial', desc:'Cada jogador tem um tecto de potencial escondido para cada atributo. Nem o treino manual nem o desenvolvimento passivo o podem ultrapassar.' },
    { icon:'🎓', title:'Quem Enche Cada Slot', desc:'A velocidade de enchimento de cada slot depende do staff técnico certo para essa área: Ataque, Defesa, Lançamento, Jogo de Equipa, Mental e Análise dependem 60% do Head Coach + 40% do Assistant Coach (usando a especialidade dele nessa área); Físico e Recuperação dependem 70% do Preparador Físico + 30% do Head Coach. O grau do teu ginásio dá ainda um bónus extra de velocidade a TODOS os slots, não só Físico/Recuperação.' },
    { icon:'🔒', title:'Categorias Trancadas', desc:'Jogo de Equipa desbloqueia com qualquer ginásio construído (grau D ou superior); Análise precisa de ginásio Grau A; Recuperação precisa de piscina ou sauna; Treino de Lançamento precisa de máquina de lançamento; Mental desbloqueia quando o teu Head Coach tem 70+ na área Mental.' },
  ] : [
    { icon:'🌱', title:'Passive Development (every week, automatic)', desc:"Whether or not you spend any credits, every player has a real weekly chance to grow any attribute below their potential. It depends on the training intensity you set in Weekly Orders (Rest to Very Intense), age (players 22 or younger develop roughly 1.5x faster than average; growth falls off sharply past 31), health, morale, and the quality of your Head Coach (overall player development + offense/defense IQ), Assistant Coach (specialty bonus), and Trainer (conditioning, for physical attributes). Past age 34 there's also a weekly chance of a -1 decline." },
    { icon:'🏋️', title:'Training Slots (manual credit spending)', desc:'On top of passive development, each category — Offense, Defense, Physical, Playmaking, Mental, Recovery, Shooting Lab, and Analytics — has its own slot that fills on its own and lets you invest credits in a player of your choice.' },
    { icon:'🔋', title:'Credits Fill Automatically', desc:"Slots accumulate fill % each week. Every time a slot crosses 100% it pays out 10 credits and the overflow keeps accumulating on top — it doesn't stop once full, so you can let a slot bank several rounds of credits before spending." },
    { icon:'💰', title:'Cost Per Attribute Point (rises with level)', desc:"It costs more to improve an already-good player: 0.5 credits/point up to 60, 1 credit/point from 61-75, 2 credits/point from 76-90, and 3 credits/point from 91-99. Max 3 credits spent per player per training session." },
    { icon:'💪', title:'Spending Credits', desc:'In the Training tab, allocate available credits to a specific player to boost development in that category. You can spread a slot’s credits across several players over different sessions, but each individual session is capped at 3 credits per player.' },
    { icon:'📈', title:'Potential Cap', desc:'Every player has a hidden potential ceiling for each attribute. Neither manual training nor passive development can exceed it.' },
    { icon:'🎓', title:'Who Fills Each Slot', desc:"Each slot's fill speed depends on the specific staff member relevant to that area: Offense, Defense, Shooting, Playmaking, Mental and Analytics depend 60% on your Head Coach + 40% on your Assistant Coach (using their specialty in that area); Physical and Recovery depend 70% on your Trainer + 30% on your Head Coach. Your gym's grade also adds an extra speed bonus to ALL slots, not just Physical/Recovery." },
    { icon:'🔒', title:'Locked Categories', desc:'Playmaking unlocks with any built gym (Grade D or higher); Analytics needs a Grade A gym; Recovery needs a pool or sauna; Shooting Lab needs a shooting machine; Mental unlocks once your Head Coach has 70+ in the Mental area.' },
  ]
  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🏋️ {t('trainingRules.title')}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>{t('trainingRules.subtitle')}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#dcfce7', border:'1px solid #bbf7d0' }}>
        <div style={{ fontSize:12, color:'#15803d', lineHeight:1.7 }}>
          {isPT ? 'Desenvolvimento passivo acontece todas as semanas mesmo sem gastares nada · 8 categorias de treino manual, cada uma enche a uma velocidade diferente (staff certo + grau do ginásio) · Cada 100% paga 10 créditos e continua a acumular · Custo por ponto sobe com o nível (0.5 a 3cr) · Máx 3cr/jogador por sessão · Tudo limitado pelo potencial individual.' : "Passive development happens every week even if you spend nothing · 8 manual training categories, each filling at its own speed (right staff + gym grade) · Every 100% pays 10 credits and keeps accumulating · Cost per point rises with level (0.5 to 3cr) · Max 3cr/player per session · Everything capped by individual potential."}
        </div>
      </div>
    </div>
  )
}

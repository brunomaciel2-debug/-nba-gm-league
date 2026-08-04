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
    { icon:'🌱', title:'Desenvolvimento Passivo (toda a semana, automático)', desc:'Independente de gastares créditos ou não, todos os jogadores têm uma chance semanal real de progredir em qualquer atributo abaixo do seu potencial. Depende da intensidade de treino que escolheste nas Ordens Semanais (Descanso a Muito Intenso), da idade (jogadores ≤22 anos evoluem ~1.5x mais depressa que a média; acima dos 31 a evolução cai a pique), saúde, moral, e da qualidade do Head Coach (Desenvolvimento de Jogador geral + IQ Ataque/Defesa), Assistant Coach (bónus de especialidade) e Preparador Físico (condicionamento, para atributos físicos).' },
    { icon:'📉', title:'Risco de Declínio (também toda a semana, automático)', desc:'4 gatilhos independentes, por atributo — podem acontecer no mesmo jogador na mesma semana: idade acima de 34 (8% de hipótese de -1); não ter jogado minutos essa semana enquanto a equipa jogou; moral abaixo de 40; e lesão com mais de 1 semana de ausência prevista. "Não jogou" e "moral baixa" ficam sensivelmente mais prováveis a partir dos 28 anos, subindo de forma exponencial com a idade — um jogador de 34 anos tem quase 3x mais risco do que um de 28, e um de 38 tem mais de 5x. A lesão de longa duração tem a sua própria escala exponencial, própria da duração da lesão (não da idade): cada semana de ausência a mais que 1 aumenta o risco em 1.18x. Um atributo já no máximo do potencial também pode descer.' },
    { icon:'🏋️', title:'Slots de Treino (gasto manual de créditos)', desc:'Além do desenvolvimento passivo, cada categoria — Ataque, Defesa, Físico, Jogo de Equipa, Mental, Recuperação, Treino de Lançamento e Análise — tem o seu próprio slot que enche sozinho e te deixa investir créditos num jogador à tua escolha.' },
    { icon:'🔋', title:'Um Slot Cheio Espera por Ti', desc:'Os slots acumulam % de enchimento todas as semanas. Ao atingir 100%, o slot paga 5 créditos e para de encher — só volta a encher do zero depois de gastares esses 5 créditos todos. Não acumula vários lotes de créditos por gastar.' },
    { icon:'💰', title:'Custo: 1 Crédito = 1 Ponto', desc:'Cada crédito gasto sobe exatamente 1 ponto num atributo — não há custos diferentes por nível.' },
    { icon:'💪', title:'Como Gastar Créditos (limites por jogador)', desc:'No separador Treino, aloca créditos disponíveis a um jogador específico. Cada jogador está limitado a 3 créditos no total por SEMANA — não importa de qual slot vêm, mesmo que apliques em sessões separadas em dias diferentes — e a no máximo 1 crédito no mesmo atributo (os outros têm de ir para atributos diferentes). Isto obriga a espalhar o treino por vários jogadores em vez de concentrar tudo num só.' },
    { icon:'📈', title:'Tecto de Potencial', desc:'Cada jogador tem um tecto de potencial escondido para cada atributo. Nem o treino manual nem o desenvolvimento passivo o podem ultrapassar.' },
    { icon:'🎓', title:'Quem Enche Cada Slot', desc:'A velocidade de enchimento de cada slot depende do staff técnico certo para essa área: Ataque, Defesa, Lançamento, Jogo de Equipa, Mental e Análise dependem 60% do Head Coach + 40% do Assistant Coach (usando a especialidade dele nessa área); Físico e Recuperação dependem 70% do Preparador Físico + 30% do Head Coach. O grau do teu ginásio dá ainda um bónus extra de velocidade a TODOS os slots, não só Físico/Recuperação.' },
    { icon:'🔒', title:'Categorias Trancadas', desc:'Jogo de Equipa desbloqueia com qualquer ginásio construído (grau D ou superior); Análise precisa de ginásio Grau A; Recuperação precisa de piscina ou sauna; Treino de Lançamento precisa de máquina de lançamento; Mental desbloqueia quando o teu Head Coach tem 70+ na área Mental.' },
  ] : [
    { icon:'🌱', title:'Passive Development (every week, automatic)', desc:"Whether or not you spend any credits, every player has a real weekly chance to grow any attribute below their potential. It depends on the training intensity you set in Weekly Orders (Rest to Very Intense), age (players 22 or younger develop roughly 1.5x faster than average; growth falls off sharply past 31), health, morale, and the quality of your Head Coach (overall player development + offense/defense IQ), Assistant Coach (specialty bonus), and Trainer (conditioning, for physical attributes)." },
    { icon:'📉', title:'Decline Risk (also every week, automatic)', desc:"4 independent triggers, per attribute — can all hit the same player the same week: age past 34 (8% chance of -1); not playing any minutes that week while the team played; morale below 40; and an injury with a predicted absence over 1 week. \"Didn't play\" and \"low morale\" get noticeably more likely from age 28 onward, rising exponentially with age — a 34-year-old carries almost 3x the risk of a 28-year-old, and a 38-year-old over 5x. Long-term injury has its own exponential scale, based on the injury's own length rather than age: each week of absence beyond the first raises the risk 1.18x. An attribute already at its potential ceiling can still decline." },
    { icon:'🏋️', title:'Training Slots (manual credit spending)', desc:'On top of passive development, each category — Offense, Defense, Physical, Playmaking, Mental, Recovery, Shooting Lab, and Analytics — has its own slot that fills on its own and lets you invest credits in a player of your choice.' },
    { icon:'🔋', title:'A Full Slot Waits For You', desc:"Slots accumulate fill % each week. Once a slot hits 100%, it pays out 5 credits and stops filling — it only resumes from zero once you've spent all 5 of those credits. It doesn't bank multiple unspent batches." },
    { icon:'💰', title:'Cost: 1 Credit = 1 Point', desc:'Every credit spent raises an attribute by exactly 1 point — there\'s no rising cost by level.' },
    { icon:'💪', title:'Spending Credits (per-player limits)', desc:'In the Training tab, allocate available credits to a specific player. Each player is capped at 3 credits total per WEEK — no matter which slot they come from, even across separate sessions on different days — and at most 1 of those credits can go to the same attribute (the rest has to go to different attributes). This forces you to spread training across multiple players instead of stacking it all on one.' },
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
          {isPT ? 'Desenvolvimento passivo acontece todas as semanas mesmo sem gastares nada · 8 categorias de treino manual, cada uma enche a uma velocidade diferente (staff certo + grau do ginásio) · Ao chegar a 100% paga 5 créditos e pára até gastares tudo · 1 crédito = 1 ponto · Máx 3cr/jogador por semana (qualquer slot), máx 1cr/atributo · Tudo limitado pelo potencial individual.' : "Passive development happens every week even if you spend nothing · 8 manual training categories, each filling at its own speed (right staff + gym grade) · Hitting 100% pays 5 credits and pauses until you spend them all · 1 credit = 1 point · Max 3cr/player per week (any slot), max 1cr/attribute · Everything capped by individual potential."}
        </div>
      </div>
    </div>
  )
}

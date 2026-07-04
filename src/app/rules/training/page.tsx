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
    { icon:'🏋️', title:'Slots de Treino', desc:'Cada categoria de desenvolvimento — Ataque, Defesa, Físico, Jogo de Equipa, Mental, Recuperação, Treino de Lançamento e Análise — tem o seu próprio slot que se vai enchendo ao longo do tempo.' },
    { icon:'🔋', title:'Créditos Acumulam Automaticamente', desc:'Os slots acumulam créditos passivamente todas as semanas. Um slot fica "cheio" aos 100% e paga 10 créditos — o que sobrar transita para o ciclo seguinte, por isso nunca perdes progresso.' },
    { icon:'💪', title:'Como Gastar Créditos', desc:'No separador Treino, aloca créditos disponíveis a jogadores específicos para acelerar o seu desenvolvimento nessa categoria. Podes dividir os créditos de um slot por vários jogadores diferentes, não tens de gastar tudo no mesmo.' },
    { icon:'📈', title:'Tecto de Potencial', desc:'Cada jogador tem um tecto de potencial escondido para cada atributo. O treino acelera o progresso em direção a esse tecto mas não pode ultrapassá-lo.' },
    { icon:'🎓', title:'Quem Enche Cada Slot', desc:'A velocidade de enchimento de cada slot depende do staff técnico certo para essa área, não do plantel todo: Ataque, Defesa, Lançamento, Jogo de Equipa, Mental e Análise dependem 60% do Head Coach + 40% do Assistant Coach (usando a especialidade dele nessa área); Físico e Recuperação dependem 70% do Preparador Físico + 30% do Head Coach. Melhor staff nessa área específica = slot cheio mais depressa.' },
    { icon:'🔒', title:'Categorias Trancadas', desc:'Jogo de Equipa, Mental, Recuperação, Treino de Lançamento e Análise começam trancadas e desbloqueiam-se sozinhas quando cumpres a condição (grau de ginásio, piscina/sauna, máquina de lançamento, ou um Head Coach suficientemente bom na área Mental).' },
    { icon:'⏰', title:'Não Deixes os Slots Encher', desc:'Um slot cheio deixa de acumular até gastares os créditos. A caixa de entrada avisa-te quando há créditos disponíveis — verifica o separador Treino regularmente para não desperdiçar capacidade de desenvolvimento.' },
  ] : [
    { icon:'🏋️', title:'Training Slots', desc:'Each development category — Offense, Defense, Physical, Playmaking, Mental, Recovery, Shooting Lab, and Analytics — has its own slot that fills over time.' },
    { icon:'🔋', title:'Credits Fill Automatically', desc:'Slots accumulate credits passively each week. A slot is "full" at 100% and pays out 10 credits — any leftover carries into the next cycle, so you never lose progress.' },
    { icon:'💪', title:'Spending Credits', desc:'In the Training tab, allocate credits to specific players to boost development in that category. You can split a slot’s credits across several different players instead of spending it all on one.' },
    { icon:'📈', title:'Potential Cap', desc:'Every player has a hidden potential ceiling for each attribute. Training accelerates progress toward it but cannot exceed it.' },
    { icon:'🎓', title:'Who Fills Each Slot', desc:"Each slot's fill speed depends on the specific staff member relevant to that area, not the whole roster: Offense, Defense, Shooting, Playmaking, Mental and Analytics depend 60% on your Head Coach + 40% on your Assistant Coach (using their specialty in that area); Physical and Recovery depend 70% on your Trainer + 30% on your Head Coach. Better staff in that specific area fills the slot faster." },
    { icon:'🔒', title:'Locked Categories', desc:'Playmaking, Mental, Recovery, Shooting Lab and Analytics start locked and unlock automatically once you meet the requirement (gym grade, pool/sauna, shooting machine, or a Head Coach strong enough in the Mental area).' },
    { icon:'⏰', title:"Don't Let Slots Cap Out", desc:'A full slot stops accumulating until you spend its credits. The inbox will notify you when credits are ready — check the Training tab regularly to avoid wasting development capacity.' },
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
          {isPT ? '8 categorias de treino · Cada uma enche a uma velocidade diferente, consoante o staff técnico certo para essa área · Slot cheio paga 10 créditos, depois pára · Gasta créditos em jogadores (podes dividir por vários) para os empurrar em direção ao seu potencial.' : '8 training categories · Each one fills at its own speed based on the right staff member for that area · A full slot pays 10 credits, then stops · Spend credits on players (splittable across several) to push them toward their potential.'}
        </div>
      </div>
    </div>
  )
}

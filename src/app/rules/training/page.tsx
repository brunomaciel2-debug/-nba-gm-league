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
    { icon:'🔋', title:'Créditos Acumulam Automaticamente', desc:'Os slots acumulam créditos passivamente todas as semanas. Um slot fica "cheio" aos 10 créditos — uma vez cheio, deixa de acumular até gastares os créditos, por isso capacidade não usada é desperdiçada.' },
    { icon:'💪', title:'Como Gastar Créditos', desc:'No separador Treino, aloca créditos disponíveis a jogadores específicos para acelerar o seu desenvolvimento nessa categoria. Mais créditos num jogador = crescimento mais rápido em direção ao seu potencial.' },
    { icon:'📈', title:'Tecto de Potencial', desc:'Cada jogador tem um tecto de potencial escondido para cada atributo. O treino acelera o progresso em direção a esse tecto mas não pode ultrapassá-lo.' },
    { icon:'🎓', title:'Impacto do Staff Técnico', desc:'As classificações de desenvolvimento do teu Head Coach e Assistant Coach influenciam diretamente a eficácia das sessões de treino. Melhores treinadores aceleram o mesmo gasto de créditos.' },
    { icon:'⏰', title:'Não Deixes os Slots Encher', desc:'Os slots param de encher quando ficam cheios. A caixa de entrada notifica-te quando há créditos prontos — verifica o separador Treino regularmente para não desperdiçar capacidade de desenvolvimento.' },
  ] : [
    { icon:'🏋️', title:'Training Slots', desc:'Each development category — Offense, Defense, Physical, Playmaking, Mental, Recovery, Shooting Lab, and Analytics — has its own slot that fills over time.' },
    { icon:'🔋', title:'Credits Fill Automatically', desc:'Slots accumulate credits passively each week. A slot is full at 10 credits — once full it stops filling until you spend, so unused capacity is wasted.' },
    { icon:'💪', title:'Spending Credits', desc:'In the Training tab, allocate credits to specific players to boost development in that category. More credits invested = faster growth toward their potential.' },
    { icon:'📈', title:'Potential Cap', desc:'Every player has a hidden potential ceiling for each attribute. Training accelerates progress toward it but cannot exceed it.' },
    { icon:'🎓', title:'Coaching Staff Impact', desc:"Your Head Coach and Assistant Coach's development ratings directly influence training session effectiveness. Better coaches accelerate the same credit spend further." },
    { icon:'⏰', title:"Don't Let Slots Cap Out", desc:'Slots stop filling once full. The inbox will notify you when credits are ready — check the Training tab regularly to avoid wasting development capacity.' },
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
          {isPT ? '8 categorias de treino · Slots ficam cheios a 10 créditos, depois param · Gasta créditos em jogadores para os empurrar em direção ao seu potencial · Qualidade do treinador amplifica cada crédito gasto.' : '8 training categories · Slots fill to 10 credits max, then stop · Spend credits on players to push toward their potential · Coach quality amplifies every credit spent.'}
        </div>
      </div>
    </div>
  )
}

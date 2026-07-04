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

export default function DraftRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'📅', title:'Dois Dias, Duas Rondas', desc:'A Ronda 1 realiza-se a 23 de Junho; a Ronda 2 realiza-se na semana seguinte. A ordem das escolhas segue a classificação — pior registo escolhe primeiro, a mesma ordem já mostrada na Simulação de Draft.' },
    { icon:'📋', title:'A Tua Lista de Prioridades', desc:'Antes de cada ronda, ordena os prospectos que preferes por prioridade na tua Draft Board. Se a tua equipa tiver mais do que uma escolha nessa ronda, é UMA lista só, que cobre todas as tuas escolhas.' },
    { icon:'🎯', title:'Como as Escolhas São Resolvidas', desc:'Quando chega a tua vez, o sistema usa o primeiro prospecto da tua lista que ainda esteja disponível. Se já tiver sido escolhido por outra equipa antes de ti, passa automaticamente para a tua próxima opção, e por aí a fora.' },
    { icon:'🎲', title:'Sem Lista? Escolha Aleatória', desc:'Se não submeteres uma lista a tempo, ou se todos os prospectos que listaste já tiverem sido escolhidos, o sistema escolhe automaticamente um prospecto ao acaso entre os que restam.' },
    { icon:'⏳', title:'Janelas de Submissão', desc:'A lista da Ronda 1 pode ser submetida 2 semanas antes do Draft, até à semana anterior. A lista da Ronda 2 abre logo a seguir aos resultados da Ronda 1 serem conhecidos, e fecha antes da Ronda 2 se realizar.' },
    { icon:'💵', title:'Contrato de Rookie — Ronda 1', desc:'2 anos garantidos a um salário fixo por escolha: de $10,0M (1ª escolha) a $2,0M (30ª escolha), numa escada contínua. Cada escolha vale sempre o mesmo, sem surpresas.' },
    { icon:'💵', title:'Contrato de Rookie — Ronda 2', desc:'2 anos garantidos a $1,2M fixos, iguais para toda a gente da 31ª à 60ª escolha — sem disparidades entre picks.' },
    { icon:'👀', title:'Confirmação Pós-Draft', desc:'Ao ser escolhido, vês pela primeira vez os atributos completos do jogador (antes só via o que já tinhas revelado por scouting). Tens 7 dias para Confirmar o contrato ou deixá-lo tornar-se agente livre — enquanto não decides, ele não conta para o teu tecto salarial.' },
    { icon:'🔁', title:'Team Options (Anos 3 e 4)', desc:'Depois dos 2 anos garantidos, tens a opção de renovar por mais 1 ano a um salário fixo mais alto (também definido pela escolha, nunca uma percentagem do anterior), e o mesmo outra vez no ano seguinte. Se não exerceres a opção a tempo, o jogador torna-se agente livre.' },
  ] : [
    { icon:'📅', title:'Two Days, Two Rounds', desc:'Round 1 takes place on June 23; Round 2 the following week. Pick order follows the standings — worst record picks first, the same order already shown in the Mock Draft.' },
    { icon:'📋', title:'Your Priority List', desc:'Before each round, rank your preferred prospects on your Draft Board. If your team owns more than one pick that round, it\'s ONE combined list, covering all of your picks.' },
    { icon:'🎯', title:'How Picks Get Resolved', desc:'When your turn comes up, the system uses the first still-available prospect on your list. If they were already taken by another team before you, it automatically moves to your next choice, and so on.' },
    { icon:'🎲', title:'No List? Random Pick', desc:'If you don\'t submit a list in time, or every prospect you listed is already gone, the system automatically picks a random prospect from what\'s left.' },
    { icon:'⏳', title:'Submission Windows', desc:'The Round 1 list can be submitted 2 weeks before the Draft, up until the week before. The Round 2 list opens right after Round 1\'s results are known, and closes before Round 2 takes place.' },
    { icon:'💵', title:'Rookie Contract — Round 1', desc:'2 guaranteed years at a fixed salary by pick: from $10.00M (1st pick) down to $2.00M (30th pick), on a smooth scale. Every pick is always worth the same amount, no surprises.' },
    { icon:'💵', title:'Rookie Contract — Round 2', desc:'2 guaranteed years at a flat $1.20M, the same for everyone from pick 31 to pick 60 — no disparities between picks.' },
    { icon:'👀', title:'Post-Draft Confirmation', desc:'Once picked, you see the player\'s full attributes for the first time (before, you only saw what you\'d already scouted). You have 7 days to Confirm the contract or let him become a free agent — until you decide, he doesn\'t count against your cap.' },
    { icon:'🔁', title:'Team Options (Years 3 & 4)', desc:'After the 2 guaranteed years, you can exercise an option for 1 more year at a higher fixed salary (also set by pick, never a percentage of the previous one), and again the year after. If you don\'t exercise the option in time, the player becomes a free agent.' },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🎓 {isPT?'Regras do Draft':'Draft Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como funcionam as duas rondas do Draft, as listas de prioridades e os contratos de rookie.':'How the two Draft rounds, priority lists, and rookie contracts work.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#ede9fe', border:'1px solid #c4b5fd' }}>
        <div style={{ fontSize:12, color:'#6d28d9', lineHeight:1.7 }}>
          {isPT
            ? 'Ronda 1: 23 Junho, $10,0M→$2,0M por escolha · Ronda 2: semana seguinte, $1,2M fixo · Lista de prioridades salta para a opção seguinte se seres roubado · 7 dias para confirmar contrato · Team Options nos anos 3 e 4.'
            : 'Round 1: June 23, $10.00M→$2.00M by pick · Round 2: following week, flat $1.20M · Priority list falls through to the next choice if sniped · 7 days to confirm contract · Team Options in years 3 and 4.'}
        </div>
      </div>
    </div>
  )
}

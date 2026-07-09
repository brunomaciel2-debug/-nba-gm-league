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

export default function SatisfactionRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'📋', title:'Três Grupos, Três Avaliações Reais', desc:'A tua avaliação como GM combina 3 pontuações independentes — Fãs (40%), Administração (40%) e Patrocinadores (20%) — numa Avaliação Geral do GM. Cada uma vive na tua aba "Satisfação", atualizada todas as semanas, com o cálculo real por trás de cada número, não uma caixa preta.' },
    { icon:'🌱', title:'As Expetativas Ajustam-se à Tua Situação Real', desc:'Um Índice de Situação (0 = reconstrução total, 1 = contender a sério) é calculado a partir da qualidade real do plantel, da idade do quinteto principal, do número de jogadores com potencial A/B, e de escolhas de draft futuras acumuladas — não do teu registo de vitórias/derrotas desta época, para não haver circularidade ("sou perdoado porque estou em rebuild, mas estou em rebuild porque perco"). Uma equipa em reconstrução não é julgada como uma contender.' },
    { icon:'📣', title:'Fãs — O Que Realmente Querem Ver', desc:'Numa reconstrução, os fãs pesam os resultados em apenas 15% e o "fator empolgação" (jovens a desenvolver-se + prospects de alto potencial) em 50%. Numa contender, é o oposto: 65% resultados, 0% empolgação jovem — só um título satisfaz. A imagem externa (popularidade) e a cultura do balneário (moral do plantel + interações de jogadores por resolver) completam a nota.' },
    { icon:'🏛️', title:'Administração — Board, Não Adeptos', desc:'A Administração olha para o desempenho desportivo (com o mesmo ajuste à situação, mas com um piso de exigência mais alto), gestão desportiva (mais talento do que o teu tecto salarial sugere, escolhas de draft acumuladas), património (grau do ginásio, capacidade do pavilhão, saúde financeira) e crescimento real (seguidores, popularidade, investimento concluído em instalações).' },
    { icon:'🤝', title:'Patrocinadores — Objetivos Cumpridos, Sem Rodeios', desc:'A pontuação dos Patrocinadores é literalmente a percentagem de objetivos de patrocínio realmente cumpridos esta época (contando apenas objetivos já resolvidos ou de contratos já terminados — um objetivo ainda a decorrer num contrato ativo não conta como falha). Sem patrocinadores ativos = penalização ligeira, não neutra.' },
    { icon:'🔁', title:'Isto Tem Consequências Reais na Época Seguinte', desc:'Uma pontuação baixa de Patrocinadores limita a qualidade das ofertas de patrocínio disponíveis na época seguinte — só os templates mais baratos por escalão aparecem. Uma pontuação boa desbloqueia a gama completa, incluindo os patrocinadores premium.' },
    { icon:'⚠️', title:'Administração Descontente Durante Muito Tempo Tem Aviso Real', desc:'Se a pontuação da Administração ficar abaixo de 30 durante 8 semanas seguidas, recebes um aviso real na caixa de entrada — a paciência do board está a esgotar-se.' },
  ] : [
    { icon:'📋', title:'Three Groups, Three Real Evaluations', desc:'Your GM evaluation combines 3 independent scores — Fans (40%), Owners (40%), and Sponsors (20%) — into an Overall GM Approval rating. Each lives in your "Satisfaction" tab, updated every week, with the real math behind every number shown — not a black box.' },
    { icon:'🌱', title:'Expectations Adjust to Your Real Situation', desc:"A Win-Now Index (0 = full rebuild, 1 = true contender) is computed from real roster talent, top rotation age, count of A/B potential-grade players, and banked future draft picks — not this season's win/loss record, to avoid circularity (\"I'm forgiven because I'm rebuilding, but I'm rebuilding because I'm losing\"). A rebuilding team is never judged like a contender." },
    { icon:'📣', title:'Fans — What They Actually Want To See', desc:"During a rebuild, fans weigh results at just 15% and the \"excitement factor\" (young players developing + high-potential prospects) at 50%. For a contender, it's flipped: 65% results, 0% youth excitement — only a title truly satisfies. External image (popularity) and clubhouse culture (roster morale + unresolved player interactions) round out the score." },
    { icon:'🏛️', title:'Owners — Board, Not Fans', desc:"Owners look at sporting performance (same situational adjustment, but a higher bar), sporting management (more talent than your cap spend implies, banked draft capital), facilities/assets (gym grade, arena capacity, financial health), and real growth (followers, popularity, completed facility investment)." },
    { icon:'🤝', title:'Sponsors — Objectives Met, No Sugarcoating', desc:"The Sponsors score is literally the percentage of sponsor objectives actually met this season (only counting objectives that are resolved or belong to expired contracts — a still-pending objective under an active contract doesn't count as a failure). No active sponsors = a mild penalty, not neutral." },
    { icon:'🔁', title:'This Has Real Consequences Next Season', desc:'A low Sponsors score limits the quality of sponsor offers available next season — only the cheapest template per tier surfaces. A good score unlocks the full range, including premium sponsors.' },
    { icon:'⚠️', title:'Sustained Ownership Displeasure Gets a Real Warning', desc:'If your Owners score stays below 30 for 8 straight weeks, you get a real inbox warning — the board is losing patience.' },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>📋 {isPT?'Regras de Satisfação e Avaliação do GM':'GM Satisfaction & Evaluation Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como Fãs, Administração e Patrocinadores avaliam o teu trabalho real como GM — e por que as expetativas mudam consoante a tua situação.':'How Fans, Owners, and Sponsors evaluate your real work as GM — and why expectations change based on your situation.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
    </div>
  )
}

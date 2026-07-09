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
    { icon:'🌱', title:'A Tua Situação Real, em 6 Níveis', desc:'Um Índice de Situação (0 = reconstrução total, 1 = contender a sério) é calculado a partir da qualidade real do plantel, da idade do quinteto principal, do número de jogadores com potencial A/B, e de escolhas de draft futuras acumuladas — não do teu registo de vitórias/derrotas desta época, para não haver circularidade ("sou perdoado porque estou em rebuild, mas estou em rebuild porque perco"). Existem 6 situações possíveis: Reconstrução, Reconstrução Avançada, A Lutar pelos Playoffs, Equipa de Playoffs, Quer ser Contender, e Contender.' },
    { icon:'🔒', title:'As Expetativas Ficam Bloqueadas Logo Após a Free Agency', desc:'A tua situação (e os alvos de vitórias que dela resultam) é calculada UMA VEZ, assim que a Free Agency termina, e fica fixa até ao fim da época — recebes uma notificação real na caixa de entrada nesse momento. Se depois fizeres um trade que te transforme de repente numa contender ou num rebuild a meio da época, os Fãs e a Administração continuam a avaliar-te pela situação que tinhas quando a época começou. Um GM que assuma o cargo a meio da época tem os alvos bloqueados assim que chega.' },
    { icon:'📣', title:'Fãs — O Que Realmente Querem Ver', desc:'Numa reconstrução, os fãs pesam os resultados em apenas 15% e o "fator empolgação" (jovens a desenvolver-se + prospects de alto potencial) em 50%. Numa contender, é o oposto: 65% resultados, 0% empolgação jovem — só um título satisfaz. A imagem externa (popularidade) e a cultura do balneário (moral do plantel + interações de jogadores por resolver) completam a nota.' },
    { icon:'🏛️', title:'Administração — Mais Exigente que os Fãs nas Vitórias', desc:'A Administração usa a sua própria curva de vitórias esperadas, sempre mais dura que a dos Fãs para a mesma situação — mesmo numa reconstrução, o board quer ver um piso real de competitividade. Olha ainda para gestão desportiva (mais talento do que o teu tecto salarial sugere), património (grau do ginásio, capacidade do pavilhão) e — o mais importante — gestão financeira REAL: receitas menos despesas desde que as expetativas foram bloqueadas, não o saldo em caixa que possas ter herdado de um GM anterior.' },
    { icon:'📖', title:'Situação Real do Franchise — Não Frases Genéricas', desc:'Por baixo da pontuação, vês factos reais e específicos da tua equipa: um craque com o contrato quase a expirar, uma extensão que ele recusou, a falta de um segundo jogador de nível para o acompanhar, um jogador frágil com lesões repetidas, ou uma janela de título bem aberta com uma dupla blindada — sempre com nomes reais do teu plantel, nunca a mesma frase para duas equipas na mesma situação.' },
    { icon:'✅', title:'Alvos da Época — Um Checklist Diferente Para Cada Equipa', desc:'Além do número de vitórias, cada equipa recebe um conjunto PRÓPRIO de critérios objetivos, escolhido a partir de sinais reais no momento do bloqueio: renovar o contrato de um craque prestes a sair, vencer o teu rival real pelo menos uma vez, mostrar desenvolvimento jovem mensurável numa reconstrução, investir em instalações fracas, ou garantir um lugar nos playoffs. Duas equipas na mesma situação podem ter checklists completamente diferentes — cada critério tem um "i" com a explicação exata do que está a ser medido.' },
    { icon:'🤝', title:'Patrocinadores — Objetivos Cumpridos, Sem Rodeios', desc:'A pontuação dos Patrocinadores é literalmente a percentagem de objetivos de patrocínio realmente cumpridos esta época (contando apenas objetivos já resolvidos ou de contratos já terminados — um objetivo ainda a decorrer num contrato ativo não conta como falha). Sem patrocinadores ativos = penalização ligeira, não neutra.' },
    { icon:'🔁', title:'Isto Tem Consequências Reais na Época Seguinte', desc:'Uma pontuação baixa de Patrocinadores limita a qualidade das ofertas de patrocínio disponíveis na época seguinte — só os templates mais baratos por escalão aparecem. Uma pontuação boa desbloqueia a gama completa, incluindo os patrocinadores premium.' },
    { icon:'⚠️', title:'Administração Descontente Durante Muito Tempo Tem Aviso Real', desc:'Se a pontuação da Administração ficar abaixo de 30 durante 8 semanas seguidas, recebes um aviso real na caixa de entrada — a paciência do board está a esgotar-se.' },
  ] : [
    { icon:'📋', title:'Three Groups, Three Real Evaluations', desc:'Your GM evaluation combines 3 independent scores — Fans (40%), Owners (40%), and Sponsors (20%) — into an Overall GM Approval rating. Each lives in your "Satisfaction" tab, updated every week, with the real math behind every number shown — not a black box.' },
    { icon:'🌱', title:'Your Real Situation, in 6 Levels', desc:"A Win-Now Index (0 = full rebuild, 1 = true contender) is computed from real roster talent, top rotation age, count of A/B potential-grade players, and banked future draft picks — not this season's win/loss record, to avoid circularity (\"I'm forgiven because I'm rebuilding, but I'm rebuilding because I'm losing\"). There are 6 possible situations: Rebuild, Retool, Fighting for the Playoffs, Established Playoff Team, Rising Contender, and Contender." },
    { icon:'🔒', title:'Expectations Lock In Right After Free Agency', desc:"Your situation (and the win targets it produces) is calculated ONCE, right after Free Agency closes, and stays fixed for the rest of the season — you get a real inbox notification the moment it locks. If you later make a trade that suddenly turns you into a contender or a rebuild mid-season, Fans and Ownership keep judging you by the situation you had when the season started. A GM who takes over mid-season gets their targets locked in as soon as they arrive." },
    { icon:'📣', title:'Fans — What They Actually Want To See', desc:"During a rebuild, fans weigh results at just 15% and the \"excitement factor\" (young players developing + high-potential prospects) at 50%. For a contender, it's flipped: 65% results, 0% youth excitement — only a title truly satisfies. External image (popularity) and clubhouse culture (roster morale + unresolved player interactions) round out the score." },
    { icon:'🏛️', title:'Owners — Stricter Than Fans on Wins', desc:"Owners use their own win-expectation curve, always harsher than Fans' for the same situation — even in a rebuild, the board wants a real floor of competitiveness. They also look at sporting management (more talent than your cap spend implies), facilities/assets (gym grade, arena capacity), and — most importantly — REAL financial stewardship: revenue minus expenses since expectations were locked, not the cash balance you may have inherited from a previous GM." },
    { icon:'📖', title:'Real Franchise Situation — Not Generic Sentences', desc:"Below the score, you see real, team-specific facts: a star with a contract about to expire, an extension he turned down, the lack of a real second option to run alongside him, a fragile player with repeated injuries, or a wide-open title window with a locked-up duo — always with real names from your own roster, never the same sentence for two teams in the same situation." },
    { icon:'✅', title:'Season Targets — A Different Checklist For Every Team', desc:"Beyond the win total, every team gets its OWN set of objective criteria, selected from real signals the moment targets lock: renewing an expiring star's contract, beating your real rival at least once, showing measurable youth development in a rebuild, investing in weak facilities, or securing a playoff spot. Two teams in the same situation can end up with completely different checklists — every criterion has an \"i\" icon explaining exactly what's being measured." },
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

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

export default function FinancesRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'🎭', title:'Quatro Segmentos de Público', desc:'Cada jogo em casa atrai uma mistura de 4 públicos diferentes — Família/Casual, Jovem Adulto/Social, Fã Fiel, e Corporativo/Rico — cada um com o seu próprio limite de preço, lugar preferido, e hábitos de consumo. A mistura da tua equipa depende do tamanho real do mercado (mercados grandes como LA puxam mais público corporativo) e da popularidade da equipa.' },
    { icon:'💵', title:'O Preço do Bilhete Afeta Mesmo a Assistência', desc:'Cada segmento só compara com conforto até um certo preço para o seu lugar preferido — acima disso a assistência desse segmento cai a direito, até zero se o preço for absurdo. Um bilhete a preço normal não enche mais o pavilhão (não há bónus por ser barato), mas um preço demasiado alto esvazia-o a sério.' },
    { icon:'📱', title:'Social Media Manager — 3 Características Reais', desc:'Um novo membro do staff técnico (25-42 anos) com 3 atributos: Envolvimento (faz crescer, ou encolher, os seguidores reais da equipa todas as semanas), Interação com Fãs (hipótese semanal de um evento meet & greet/autógrafos), e Responsabilidade Social (hipótese semanal de um evento de caridade).' },
    { icon:'📈', title:'Seguidores — Um Contador Real, Não Decorativo', desc:'O número de seguidores sobe ou desce todas as semanas consoante a qualidade do Social Media Manager, e sobe extra sempre que um evento acontece. Quantos mais seguidores, mais essa equipa vende (merchandising, alcance online) e mais curiosidade genuína há em ver o jogo — não é só um número no ecrã.' },
    { icon:'🤝', title:'O Que os Eventos Realmente Mudam', desc:'Um evento de Interação com Fãs aumenta a fatia real de Fãs Fiéis no teu público (o segmento mais tolerante a preços altos) e sobe a moral de um jogador aleatório. Um evento de Responsabilidade Social sobe a popularidade real da equipa (o que já entra na fama/merchandising e na atratividade para agentes livres) e a fama de um jogador aleatório — como reconhecimento por bom carácter.' },
    { icon:'🎟️', title:'Bilhetes e Concessões Entram Mesmo nas Contas', desc:'A receita de bilhetes e de concessões é calculada jogo a jogo, a partir de quem realmente apareceu (não uma estimativa fixa), e entra diretamente no saldo da equipa e no extrato financeiro.' },
    { icon:'🍔', title:'Cada Concession Atrai um Público Diferente', desc:'Uma banca de comida básica ou a mascote atraem sobretudo família; o bar atrai sobretudo jovens adultos; o restaurante VIP, camarotes e lounge courtside são quase exclusivos do público corporativo. Construir a concession errada para a tua audiência real vende muito menos do que o esperado.' },
    { icon:'📦', title:'Reposição de Stock — Um Custo Real, Não Fixo', desc:'Cada concession com receita variável (comida, bar, loja da equipa) tem um custo real de reposição de mercadoria — entre 25% e 55% da própria receita dessa concession, consoante o tipo. Como a receita já reflete quem apareceu, este custo sobe e desce com a procura real, não é um número fixo.' },
    { icon:'🛡️', title:'Operações de Jogo em Casa', desc:'Segurança, stewards, bilheteira, limpeza, eletricistas, técnicos de som e luz, e animação — um custo real por jogo em casa, com uma base fixa (proporcional ao tamanho real do teu pavilhão) mais uma parte que sobe com a assistência real desse jogo.' },
    { icon:'✈️', title:'Viagens Fora — Baseado na Distância Real', desc:'O custo de cada jogo fora usa a distância real entre as cidades das duas equipas — um jogo a poucos quilómetros custa uma fração de uma viagem à costa oposta. O valor cobre voo charter, hotel e alimentação para toda a comitiva viajante (jogadores + staff técnico + segurança), e transporte terrestre no destino. Só a equipa visitante paga.' },
    { icon:'🏋️', title:'O Grau do Ginásio Tem Efeito Real', desc:'Grau A acelera mesmo o preenchimento dos slots de treino (o treinador continua a ser o fator principal), acelera a recuperação semanal de saúde, reduz o risco de lesão, e torna a equipa mais atrativa para agentes livres. Já não são só números decorativos.' },
    { icon:'🏗️', title:'Construir e Melhorar Custa Dinheiro a Sério', desc:'Melhorar o ginásio, construir extras, expandir o pavilhão, ou construir concessões desconta mesmo o custo do saldo da equipa — deixou de ser possível "construir de borla".' },
    { icon:'🔧', title:'Manutenção Mensal Real', desc:'O custo mensal de manter o ginásio e as concessões construídas é descontado de verdade todos os meses, não é só um número a subir no ecrã.' },
  ] : [
    { icon:'🎭', title:'Four Audience Segments', desc:"Every home game draws a mix of 4 distinct fan segments — Family/Casual, Young Adult/Social, Loyal Fan, and Corporate/Wealthy — each with its own price ceiling, preferred seating tier, and spending habits. Your team's mix depends on real market size (big markets like LA skew more corporate) and team popularity." },
    { icon:'💵', title:'Ticket Price Genuinely Affects Attendance', desc:"Each segment is comfortable up to a real price ceiling for its preferred seating tier — above that, its attendance drops off, all the way to zero if the price is absurd. A fair price doesn't sell out the building any faster (no bonus for going cheap), but an excessive one genuinely empties it." },
    { icon:'📱', title:'Social Media Manager — 3 Real Traits', desc:"A new coaching-staff role (age 25-42) with 3 attributes: Engagement (grows, or shrinks, the team's real follower count every week), Fan Interaction (weekly chance of a meet & greet/autograph event), and Social Responsibility (weekly chance of a charity event)." },
    { icon:'📈', title:'Followers — A Real Counter, Not Decorative', desc:"The follower count rises or falls every week based on the Social Media Manager's quality, and gets an extra bump whenever an event fires. More followers means more real jersey/merchandising sales (online, national reach) and genuinely more curiosity to attend games — not just a number on screen." },
    { icon:'🤝', title:'What The Events Actually Change', desc:"A Fan Interaction event grows the real Loyal Fan share of your crowd (the segment most tolerant of high prices) and lifts a random player's morale. A Social Responsibility event lifts real team popularity (already feeding fame/merchandising and free-agency attractiveness) and a random player's fame — recognition for good character." },
    { icon:'🎟️', title:'Tickets and Concessions Post Straight to the Books', desc:"Ticket and concession revenue is computed per game from who actually showed up (not a flat estimate), and posts directly to the team's balance and financial ledger." },
    { icon:'🍔', title:'Every Concession Draws a Different Crowd', desc:'A basic food stall or the mascot mostly draws families; the bar mostly draws young adults; the VIP restaurant, corporate suites, and courtside lounge are almost exclusively corporate. Building the wrong concession for your real crowd sells far less than expected.' },
    { icon:'📦', title:'Supply Restocking — A Real Cost, Not Flat', desc:"Every concession with variable revenue (food, bar, team store) has a real cost-of-goods-sold to restock — 25% to 55% of that concession's own revenue, depending on the type. Since revenue already reflects who showed up, this cost rises and falls with real demand, not a flat number." },
    { icon:'🛡️', title:'Home Game Operations', desc:'Security, stewards, ticket office, cleaning crew, electricians, sound/light techs, and entertainment — a real per-home-game cost, with a fixed baseline (sized to your real arena capacity) plus a part that scales with that game\'s real attendance.' },
    { icon:'✈️', title:'Away Travel — Based on Real Distance', desc:"Every away-game cost uses the real distance between the two teams' cities — a short regional trip costs a fraction of a true coast-to-coast one. It covers charter flight, hotel, and meals for the whole traveling party (players + coaching staff + security), plus ground transportation at the destination. Only the visiting team pays." },
    { icon:'🏋️', title:'Practice Facility Grade Has Real Effects', desc:"Grade A genuinely speeds up training slot fill (the coaching staff is still the primary driver), speeds up weekly health recovery, lowers injury risk, and makes the team more attractive to free agents. No longer just decorative numbers." },
    { icon:'🏗️', title:'Building and Upgrading Costs Real Money', desc:'Upgrading the gym, building extras, expanding the arena, or building concessions genuinely deducts the cost from the team\'s balance — "free" building is no longer possible.' },
    { icon:'🔧', title:'Real Monthly Maintenance', desc:"The monthly cost of maintaining the gym and any built concessions is actually deducted every month, not just a number that climbs on screen." },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>💰 {isPT?'Regras de Finanças e Economia da Arena':'Finances & Arena Economy Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como o público real da tua arena, os preços, as concessões, o ginásio e as viagens se traduzem em dinheiro real.':'How your arena\'s real audience, pricing, concessions, facilities, and travel translate into real money.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
    </div>
  )
}

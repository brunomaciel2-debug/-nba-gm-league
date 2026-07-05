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

export default function MerchandisingRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'👕', title:'Venda de Jerseys — Alcance Nacional, Não Só a Arena', desc:'Ao contrário dos bilhetes e concessões (que dependem da assistência em casa), a venda de jerseys é online e nacional — reflete o quão famoso o jogador é na liga toda, não quantas pessoas foram ao teu pavilhão.' },
    { icon:'⭐', title:'A Fama é Real e Persistente', desc:'Cada jogador tem um valor de Fama (0-100) que se ajusta todos os meses em direção a um "alvo merecido", calculado a partir da qualidade real, da forma recente comparada com a média da própria época, das vitórias da equipa, e de prémios recentes (All-Star, Jogador da Semana/Mês). Como é uma tendência lenta e mensal, um jogador querido mantém a fama (e as vendas) por algum tempo mesmo que a equipa comece a perder — não desaba de imediato.' },
    { icon:'🌆', title:'Big Market vs. Small Market', desc:'O mercado da equipa amplifica especificamente o poder de estrela — Los Angeles, Nova Iorque, Chicago, Golden State, Boston, Dallas e Toronto (o único time canadiano, com alcance nacional próprio) multiplicam por 1.5x tudo o que vier da qualidade, forma, prémios e campanhas de marketing; mercados pequenos (San Antonio, Indiana, Cleveland, Milwaukee, Utah, Orlando, Charlotte, Nova Orleães, Memphis, Oklahoma City) ficam a 0.8x; o resto fica no meio (1.1x). Isto só afeta o "bónus de estrela" — um jogador do banco não muda muito com o mercado, tal como na vida real.' },
    { icon:'📈', title:'Quanto Mais Fama, Exponencialmente Mais Vendas', desc:'A receita mensal de jerseys cresce de forma exponencial com a fama — um jogador do banco (fama ~40) é insignificante, mas uma superestrela global (fama 95+) pode gerar centenas de milhares de dólares por mês, tanto ou mais do que a bilheteira.' },
    { icon:'💰', title:'Entra Direto no Balanço', desc:'No fim de cada mês, a receita de jerseys de toda a equipa entra automaticamente no extrato financeiro (categoria "Venda de Jerseys") e no saldo da equipa — vê o separador Finanças ou Merchandising.' },
    { icon:'📣', title:'Campanha de Marketing — Investe na Imagem de um Jogador', desc:'Escolhe um jogador do teu plantel e um valor (Pequena $250K / Média $750K / Grande $2M) para investires na promoção dele. O investimento sai logo do saldo da equipa como despesa, e define um objetivo de fama a atingir.' },
    { icon:'⚠️', title:'O Timing Importa — Pode Correr Mal', desc:'A campanha só é bem-sucedida se o jogador continuar a jogar bem (forma igual ou acima da média da época) durante esse mês. Se ele cair de forma, se lesionar, ou não tiver minutos suficientes, a campanha falha — o dinheiro já foi gasto e o impulso de fama não acontece (ou até desce). Escolhe bem quando investires.' },
    { icon:'📋', title:'Relatório Mensal', desc:'No separador Merchandising de cada equipa vês os jogadores mais vendidos do mês, o histórico mensal de receita, e o estado de todas as campanhas de marketing (em curso, sucesso, ou falhada).' },
  ] : [
    { icon:'👕', title:'Jersey Sales — National Reach, Not Just the Arena', desc:"Unlike tickets and concessions (which depend on home attendance), jersey sales are online and national — they reflect how famous the player is league-wide, not how many people showed up to your arena." },
    { icon:'⭐', title:'Fame Is Real and Persistent', desc:'Every player has a Fame value (0-100) that adjusts every month toward a "deserved target", built from real quality, recent form vs. his own season average, team wins, and recent awards (All-Star, Player of the Week/Month). Because it\'s a slow monthly drift, a beloved player keeps his fame (and sales) for a while even if the team starts losing — it doesn\'t collapse instantly.' },
    { icon:'🌆', title:'Big Market vs. Small Market', desc:"A team's market specifically amplifies star power — Los Angeles, New York, Chicago, Golden State, Boston, Dallas, and Toronto (the only Canadian team, with its own national reach) multiply everything from quality, form, awards, and marketing campaigns by 1.5x; small markets (San Antonio, Indiana, Cleveland, Milwaukee, Utah, Orlando, Charlotte, New Orleans, Memphis, Oklahoma City) sit at 0.8x; everyone else is in between at 1.1x. This only affects the \"star bonus\" — a bench player barely changes with market size, just like in real life." },
    { icon:'📈', title:'More Fame = Exponentially More Sales', desc:"Monthly jersey revenue scales exponentially with fame — a bench player (fame ~40) is background noise, but a true global superstar (fame 95+) can generate hundreds of thousands of dollars a month, on par with or exceeding ticket sales." },
    { icon:'💰', title:'Goes Straight to the Balance Sheet', desc:'At the end of every month, the whole team\'s jersey revenue is automatically posted to the balance sheet (category "Jersey Sales") and the team\'s balance — check the Finances or Merchandising tab.' },
    { icon:'📣', title:"Marketing Campaign — Invest in a Player's Image", desc:'Pick a player on your roster and a budget (Small $250K / Medium $750K / Large $2M) to invest in promoting him. The spend comes out of your balance immediately as an expense, and sets a fame target to hit.' },
    { icon:'⚠️', title:'Timing Matters — It Can Go Wrong', desc:"The campaign only succeeds if the player keeps performing (form at or above his season average) during that month. If he slumps, gets hurt, or doesn't get enough minutes, the campaign backfires — the money's already spent and the fame boost doesn't happen (or even drops). Choose your moment carefully." },
    { icon:'📋', title:'Monthly Report', desc:"Every team's Merchandising tab shows the month's top sellers, the monthly revenue history, and the status of every marketing campaign (active, success, or backfired)." },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>👕 {isPT?'Regras de Merchandising':'Merchandising Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como funciona a fama dos jogadores, a venda de jerseys, e as campanhas de marketing.':'How player fame, jersey sales, and marketing campaigns work.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
    </div>
  )
}

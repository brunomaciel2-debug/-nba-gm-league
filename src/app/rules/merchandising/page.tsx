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
    { icon:'👕', title:'Venda de Jerseys — Alcance Nacional, Não Só a Arena', desc:'Ao contrário dos bilhetes e concessões (que dependem da assistência em casa), a venda de jerseys é online e nacional — reflete o quão popular o jogador é na liga toda, não quantas pessoas foram ao teu pavilhão.' },
    { icon:'🙈', title:'A Popularidade é um Atributo Escondido', desc:'Nunca vês um número de "fama" em lado nenhum — só o resultado real dela: quantas jerseys um jogador vende e quanto dinheiro isso traz. A popularidade existe internamente e move-se sozinha consoante a qualidade do jogador, a forma recente, o mercado da equipa e os prémios — não é algo que compres ou vejas diretamente.' },
    { icon:'🐢', title:'Sobe e Desce Devagar — É Preciso Consistência', desc:'A popularidade muda pouco a pouco, mês a mês. Um único mês fantástico quase não se nota; só depois de vários meses seguidos a jogar bem é que um jogador realmente se torna um favorito dos adeptos. Da mesma forma, uma popularidade elevada não desaparece com uma má semana — é preciso tempo para subir e tempo para descer.' },
    { icon:'🌆', title:'Big Market vs. Small Market', desc:'O mercado da equipa amplifica especificamente o poder de estrela — Los Angeles, Nova Iorque, Chicago, Golden State, Boston, Dallas e Toronto (o único time canadiano, com alcance nacional próprio) multiplicam por 1.5x o que vier da qualidade, forma e prémios; mercados pequenos (San Antonio, Indiana, Cleveland, Milwaukee, Utah, Orlando, Charlotte, Nova Orleães, Memphis, Oklahoma City) ficam a 0.8x; o resto fica no meio (1.1x). Isto só afeta o jogador com nível de estrela — um jogador do banco não muda muito com o mercado, tal como na vida real.' },
    { icon:'🌍', title:'Estrelas Transcendentes Levam a Fama Com Eles', desc:'Jogadores do nível de LeBron James, Doncic, Anthony Edwards ou Steph Curry são populares onde quer que joguem — são eles que tornam a franquia popular, não o contrário. Por isso, a partir de um certo nível de qualidade, o efeito do mercado pequeno deixa de os travar tanto — o talento deles simplesmente transcende onde jogam.' },
    { icon:'🌐', title:'Jogadores Estrangeiros Trazem o Seu País Com Eles', desc:'Além do mercado da equipa, jogadores internacionais ganham um impulso extra de popularidade vindo do seu país de origem — nações onde o basquetebol é quase uma religião (Eslovénia, Sérvia, Lituânia, Grécia, Letónia) seguem os seus melhores jogadores com uma paixão que muitas vezes ultrapassa a dos próprios adeptos da NBA. Isto soma-se ao efeito do mercado, não o substitui — um jogador internacional mediano numa equipa pequena ainda ganha um crédito real por ter um país inteiro a torcer por ele.' },
    { icon:'⭐', title:'Um Piso Real Para os Nomes Mais Conhecidos', desc:'Para os 100 jogadores mais populares da NBA de verdade (uma lista real, não gerada pelo jogo), a fama nunca cai abaixo de um valor mínimo — porque legado, carisma e reconhecimento de nome contam, mesmo que a forma da época não seja a melhor da liga. Um jogador só ultrapassa este piso através de brilho genuíno em jogo, mercado, ou nacionalidade — nunca o contrário.' },
    { icon:'📈', title:'Quanto Mais Popular, Exponencialmente Mais Vendas', desc:'A receita mensal de jerseys cresce de forma exponencial com a popularidade — um jogador do banco é insignificante, mas uma superestrela global pode gerar centenas de milhares de dólares por mês, tanto ou mais do que a bilheteira.' },
    { icon:'💰', title:'Entra Direto no Balanço', desc:'No fim de cada mês, a receita de jerseys de toda a equipa entra automaticamente no extrato financeiro (categoria "Venda de Jerseys") e no saldo da equipa — vê o separador Finanças ou Merchandising.' },
    { icon:'📣', title:'Campanha de Anúncios — Não é Comprar Popularidade', desc:'Escolhe um jogador do teu plantel e um valor (Pequena $250K / Média $750K / Grande $2M) para investires em anúncios/publicidade que usam a imagem dele para venderes mais jerseys esse mês — um aumento real e temporário nas vendas, não uma forma de inflar a popularidade escondida dele. É também a forma perfeita de testares se um jogador surpreendente é mesmo marketable, sem alterares nada a longo prazo.' },
    { icon:'⚠️', title:'O Timing Importa — Pode Correr Mal', desc:'A campanha só funciona se o jogador continuar a jogar bem (forma igual ou acima da média da época) durante esse mês. Se ele cair de forma, se lesionar, ou não tiver minutos suficientes, o dinheiro é desperdiçado — sem vendas extra nenhumas.' },
    { icon:'📋', title:'Relatório Mensal — Jerseys Vendidas', desc:'No separador Merchandising de cada equipa vês quantas jerseys cada jogador vendeu no mês, o valor ganho, o histórico mensal, e o estado de todas as campanhas de anúncios (em curso, sucesso, ou falhada).' },
  ] : [
    { icon:'👕', title:'Jersey Sales — National Reach, Not Just the Arena', desc:"Unlike tickets and concessions (which depend on home attendance), jersey sales are online and national — they reflect how popular the player is league-wide, not how many people showed up to your arena." },
    { icon:'🙈', title:'Popularity Is a Hidden Attribute', desc:"You never see a raw \"fame\" number anywhere — only its real result: how many jerseys a player sells and how much money that brings in. Popularity exists internally and moves on its own based on the player's quality, recent form, team market, and awards — it's not something you buy or see directly." },
    { icon:'🐢', title:'Rises and Falls Slowly — Consistency Required', desc:"Popularity changes little by little, month by month. A single great month barely registers; it takes several months of sustained good play for a player to genuinely become a fan favorite. Likewise, high popularity doesn't vanish after one bad week — it takes time to build and time to fade." },
    { icon:'🌆', title:'Big Market vs. Small Market', desc:"A team's market specifically amplifies star power — Los Angeles, New York, Chicago, Golden State, Boston, Dallas, and Toronto (the only Canadian team, with its own national reach) multiply quality/form/award-driven star power by 1.5x; small markets (San Antonio, Indiana, Cleveland, Milwaukee, Utah, Orlando, Charlotte, New Orleans, Memphis, Oklahoma City) sit at 0.8x; everyone else is in between at 1.1x. This only affects star-level players — a bench player barely changes with market size, just like in real life." },
    { icon:'🌍', title:'Transcendent Stars Carry Their Fame With Them', desc:"Players at the level of LeBron James, Doncic, Anthony Edwards, or Steph Curry are popular wherever they play — they make the FRANCHISE popular, not the other way around. So past a certain quality threshold, the small-market penalty stops holding them back as much — their talent simply transcends wherever they play." },
    { icon:'🌐', title:'International Players Bring Their Country With Them', desc:"On top of team market, international players get an extra popularity boost from their home country — nations where basketball is close to a national religion (Slovenia, Serbia, Lithuania, Greece, Latvia) follow their best players with a passion that often exceeds their own NBA fanbase. This stacks with the market effect, it doesn't replace it — even a modest international player on a small-market team gets real credit for having an entire country behind him." },
    { icon:'⭐', title:'A Real Floor for the Most Recognizable Names', desc:"For the NBA's actual 100 most popular players (a real ranking, not something the game generates), fame never drops below a minimum floor — because legacy, career achievements, and pure star charisma count, even if a player's form this season isn't the league's best. A player only exceeds this floor through genuine in-game brilliance, market, or nationality — never the other way around." },
    { icon:'📈', title:'More Popularity = Exponentially More Sales', desc:"Monthly jersey revenue scales exponentially with popularity — a bench player is background noise, but a true global superstar can generate hundreds of thousands of dollars a month, on par with or exceeding ticket sales." },
    { icon:'💰', title:'Goes Straight to the Balance Sheet', desc:'At the end of every month, the whole team\'s jersey revenue is automatically posted to the balance sheet (category "Jersey Sales") and the team\'s balance — check the Finances or Merchandising tab.' },
    { icon:'📣', title:"Ad Campaign — Not Buying Popularity", desc:"Pick a player on your roster and a budget (Small $250K / Medium $750K / Large $2M) to invest in ads/promo using his image to sell more of his jerseys that month — a real, temporary sales bump, not a way to inflate his hidden popularity. It's also the perfect way to test whether a surprising breakout player is genuinely marketable, without permanently changing anything." },
    { icon:'⚠️', title:'Timing Matters — It Can Go Wrong', desc:"The campaign only works if the player keeps performing (form at or above his season average) during that month. If he slumps, gets hurt, or doesn't get enough minutes, the money is wasted — no extra sales at all." },
    { icon:'📋', title:'Monthly Report — Jerseys Sold', desc:"Every team's Merchandising tab shows how many jerseys each player sold that month, the revenue earned, the monthly history, and the status of every ad campaign (active, success, or backfired)." },
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

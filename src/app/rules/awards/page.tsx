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

export default function AwardsRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'📅', title:'Prémio da Semana', desc:'Todas as semanas, o Jogador da Semana (um por conferência) e o Rookie da Semana (um só, liga inteira) são calculados a partir das box scores reais dos jogos dessa semana — pontos, ressaltos, assistências, roubos e bloqueios por jogo, com bónus extra para quem vence pelo menos metade dos jogos (ou faz 35+ pontos por jogo, no caso do Rookie). É preciso ter jogado pelo menos 2 jogos nessa semana para entrar na conta.' },
    { icon:'🗓️', title:'Prémio do Mês', desc:'O Jogador do Mês (um por conferência) e o Rookie do Mês (um só, liga inteira) usam o mesmo tipo de cálculo, mas somado ao longo do mês calendário completo (não um bloco fixo de 4 semanas) — é preciso ter jogado pelo menos 6 jogos nesse mês. O sistema verifica automaticamente todos os meses da época, por isso um mês nunca fica sem prémio, mesmo que algo falhe a meio.' },
    { icon:'🏆', title:'MVP e Melhor Defesa (DPOY)', desc:'No fim da época (mínimo 65 jogos), o MVP tem em conta pontos/ressaltos/assistências/roubos/bloqueios por jogo, com um bónus extra para quem joga numa equipa com mais vitórias. O Defensive Player of the Year olha só a roubos e bloqueios por jogo, com um bónus para quem joga numa das 10 equipas com melhor defesa da liga (menos pontos sofridos).' },
    { icon:'🌱', title:'Rookie of the Year e All-Rookie', desc:'Entre os jogadores no seu 1º ano, o Rookie of the Year é o que tiver melhor combinação de pontos, ressaltos e assistências por jogo. Os 10 melhores rookies dessa mesma lista formam as equipas All-Rookie 1ª e 2ª (5 jogadores cada).' },
    { icon:'⭐', title:'All-NBA (1ª, 2ª e 3ª Equipa)', desc:'Os 15 melhores jogadores da época segundo o mesmo cálculo do MVP são divididos em 3 equipas de 5 — All-NBA 1ª (top 5), 2ª (6º-10º) e 3ª (11º-15º).' },
    { icon:'📈', title:'Most Improved Player (MIP)', desc:'Compara a produção desta época (pontos + ressaltos×0.8 + assistências×1.2, por jogo) com a da época anterior do mesmo jogador — só entram jogadores com pelo menos 20 jogos em ambas as épocas, e só ganha quem realmente melhorou.' },
    { icon:'🧑‍💼', title:'Coach of the Year', desc:'Não é simplesmente o treinador com mais vitórias — é o Head Coach cuja equipa tem uma % de vitórias reais mais acima do que o talento do plantel (a mesma fórmula usada nas Power Rankings) fazia prever. Prémio para quem faz mais com o que tem.' },
  ] : [
    { icon:'📅', title:'Player/Rookie of the Week', desc:"Every week, Player of the Week (one per conference) and Rookie of the Week (one, league-wide) are calculated from that week's real box scores — points, rebounds, assists, steals, and blocks per game, with a bonus for winning at least half the games (or scoring 35+ PPG, for the Rookie award). A player needs at least 2 games that week to qualify." },
    { icon:'🗓️', title:'Player/Rookie of the Month', desc:'Player of the Month (one per conference) and Rookie of the Month (one, league-wide) use the same kind of scoring, but summed over the full real calendar month (not a fixed 4-week block) — a player needs at least 6 games that month. The system automatically double-checks every month of the season, so a month never ends up without a winner even if something fails midway.' },
    { icon:'🏆', title:'MVP and Defensive Player of the Year', desc:"At season's end (65-game minimum), MVP weighs points/rebounds/assists/steals/blocks per game, with a bonus for playing on a higher-win team. Defensive Player of the Year looks only at steals and blocks per game, with a bonus for playing on one of the league's 10 stingiest defenses (fewest points allowed)." },
    { icon:'🌱', title:'Rookie of the Year & All-Rookie', desc:'Among first-year players, Rookie of the Year goes to the best combination of points, rebounds, and assists per game. The top 10 rookies on that same list form the All-Rookie 1st and 2nd Teams (5 players each).' },
    { icon:'⭐', title:'All-NBA (1st, 2nd & 3rd Team)', desc:"The season's top 15 players by the same scoring used for MVP are split into 3 teams of 5 — All-NBA 1st (top 5), 2nd (6th-10th), and 3rd (11th-15th)." },
    { icon:'📈', title:'Most Improved Player', desc:"Compares this season's production (points + rebounds×0.8 + assists×1.2, per game) against the same player's prior season — only players with at least 20 games in both seasons qualify, and only a real improvement wins." },
    { icon:'🧑‍💼', title:'Coach of the Year', desc:"Not just the coach with the most wins — it's the Head Coach whose team's actual win percentage most exceeds what its roster talent alone (the same formula Power Rankings uses) would predict. Rewards doing more with what you've got." },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🏆 {isPT?'Regras de Prémios':'Awards Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como são calculados os prémios semanais, mensais e de fim de época.':'How the weekly, monthly, and season-end awards are calculated.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
    </div>
  )
}

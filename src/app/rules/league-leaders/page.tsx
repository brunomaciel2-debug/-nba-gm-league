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

export default function LeagueLeadersRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'📊', title:'7 Categorias na NBA', desc:'Pontos, Ressaltos, Assistências, Roubos e Bloqueios por jogo, mais FG% e % de 3 Pontos — os líderes de cada categoria, com foto e link direto para a página do jogador.' },
    { icon:'✅', title:'Regra Oficial de Qualificação', desc:'Igual à regra real da NBA: para entrar nas categorias por jogo (PPG, RPG, etc.) é preciso ter jogado em 70% dos jogos já realizados pela tua equipa. Para as percentagens de lançamento (FG%, 3P%) o mínimo é de conversões — 300 FG ou 82 triplos numa época completa — escalado à mesma percentagem de jogos já disputados. No início da época, com poucos jogos feitos, o mínimo desce proporcionalmente.' },
    { icon:'🌱', title:'Filtro "Só Rookies"', desc:'Podes alternar entre "Todos" e "Só Rookies" no topo da página — mesmas categorias e mesma regra de qualificação, só que limitado a jogadores no 1º ano de carreira.' },
    { icon:'🏀', title:'G-League Tem a Sua Própria Página', desc:'A G League tem os seus próprios League Leaders, com 8 categorias (as mesmas 7 da NBA mais Perdas de Bola). Como a época da G League é muito mais curta, não há regra de qualificação por percentagem de jogos — basta ter jogado pelo menos 2 jogos para entrar na conta (ou pelo menos 10 lançamentos/triplos tentados nas categorias de percentagem).' },
  ] : [
    { icon:'📊', title:'7 NBA Categories', desc:'Points, Rebounds, Assists, Steals, and Blocks per game, plus FG% and 3-Point %. — each category shows the top leaders with photo and a direct link to the player page.' },
    { icon:'✅', title:'Official Qualification Rule', desc:"Same as the real NBA rule: to appear in the per-game categories (PPG, RPG, etc.) a player must have appeared in 70% of his own team's games played so far. For shooting percentages (FG%, 3P%) the minimum is a makes total — 300 FG or 82 threes for a full season — scaled to that same fraction of games played. Early in the season, with fewer games played, the minimum scales down proportionally." },
    { icon:'🌱', title:'"Rookies Only" Filter', desc:'Toggle between "All Players" and "Rookies Only" at the top of the page — same categories, same qualification rule, just limited to first-year players.' },
    { icon:'🏀', title:'G-League Has Its Own Page', desc:'The G-League has its own League Leaders, with 8 categories (the same 7 as the NBA plus Turnovers). Since the G-League season is much shorter, there\'s no games-percentage qualification rule — a player just needs at least 2 games played to count (or at least 10 shot/3-point attempts for the percentage categories).' },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>📊 {isPT?'Regras de Líderes da Liga':'League Leaders Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como funcionam as categorias e a regra de qualificação dos League Leaders.':'How the League Leaders categories and qualification rule work.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
    </div>
  )
}

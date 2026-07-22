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

export default function TacticalSystemsRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'🔥', title:'Familiaridade — A Barra de Calor', desc:'Cada equipa tem uma familiaridade escondida (0-100%) com cada um dos 5 sistemas ofensivos (Motion, Pick & Roll, Contra-ataque, Isolamento, Poste). Só o teu GM e o Comissário veem esta barra, no separador "Sistemas" da tua equipa.' },
    { icon:'🌳', title:'A Árvore de Techs — Uma Pirâmide por Sistema', desc:'Cada sistema tem 15 "techs" temáticas organizadas numa pirâmide: 5 de nível 1, 4 de nível 2, 3 de nível 3, 2 de nível 4, e 1 de nível 5 (a maestria total do sistema). Escolhes uma tech desbloqueada para desenvolver de cada vez — como o sistema de treino.' },
    { icon:'🔓', title:'Desbloqueio por Posição na Árvore', desc:'As techs de nível 1 estão sempre disponíveis. Cada tech dos níveis seguintes tem exatamente duas techs "pai" no nível abaixo — as que ficam na mesma posição e na posição a seguir. Só desbloqueia quando AMBAS essas duas techs específicas estiverem dominadas (não bastam quaisquer duas dominadas no nível abaixo). Como cada nível tem menos techs que o anterior (5→4→3→2→1), chegar ao topo (nível 5, maestria total) exige dominar quase a árvore toda.' },
    { icon:'📈', title:'Só Progride se Usares o Sistema', desc:'A tech que estás a desenvolver só ganha progresso nas semanas em que esse sistema é o escolhido nas tuas Ordens Semanais (Ataque) — entre 3 e 12 pontos de progresso por semana, consoante a qualidade tática do teu staff técnico. Escolher sempre o mesmo sistema é o que realmente constrói familiaridade — não há atalhos.' },
    { icon:'📉', title:'Esquecimento de Cima para Baixo', desc:'Quando mudas de sistema, os outros 4 ficam parados — e o nível mais alto com qualquer progresso ainda restante perde 6 pontos por semana. Enquanto esse nível tiver qualquer progresso (mesmo que já não esteja 100% dominado), os níveis abaixo dele ficam totalmente protegidos; só depois de esse nível chegar mesmo a 0 é que o seguinte começa a esquecer-se.' },
    { icon:'⚔️', title:'Ainda Funciona Contra um Counter', desc:'Cada sistema tem um counter defensivo real (ex: Zona trava o Pick & Roll). Mas alta familiaridade recupera parte dessa desvantagem, até +12% de resistência com familiaridade máxima (100%) — uma equipa muito bem treinada num sistema consegue lutar contra um counter melhor do que uma equipa a estreá-lo, ainda que nenhuma familiaridade anule por completo um counter forte.' },
    { icon:'⚙️', title:'Cada Tech Tem um Efeito Real', desc:'Nenhuma tech é decorativa. Cada uma dá um bónus específico e real ao jogo — menos perdas de bola, mais assistências, melhor percentagem num tipo de lançamento específico, mais faltas provocadas, mais ressaltos, ou resistência extra contra uma defesa específica. Os bónus só contam enquanto esse sistema for o escolhido nessa semana.' },
    { icon:'🎯', title:'Temas Reais de Basquetebol', desc:'As techs seguem conceitos reais — no Pick & Roll: Bloqueio Direto, Lob para o Bloqueador, Pick & Pop (bónus extra se o bloqueador souber lançar de 3); no Poste: Gancho, Duplo Poste, Provocar Faltas; e por aí fora em cada um dos 5 sistemas.' },
  ] : [
    { icon:'🔥', title:'Familiarity — The Heat Bar', desc:'Every team has a hidden familiarity level (0-100%) with each of the 5 offensive systems (Motion, Pick & Roll, Fast Break, Isolation, Post-Up). Only your GM and the Commissioner see this bar, on your team\'s "Systems" tab.' },
    { icon:'🌳', title:'The Tech Tree — A Pyramid per System', desc:'Each system has 15 themed "techs" arranged in a pyramid: 5 at level 1, 4 at level 2, 3 at level 3, 2 at level 4, and 1 at level 5 (full system mastery). You pick one unlocked tech to develop at a time — same idea as the training system.' },
    { icon:'🔓', title:'Unlocking By Tree Position', desc:"Level 1's 5 techs are always available. Every tech in the levels above has exactly two \"parent\" techs in the level below it — the one in the same position and the one right after it. It only unlocks once BOTH of those specific parents are mastered (any two mastered techs below won't do). Since each level has fewer techs than the one below it (5→4→3→2→1), reaching the very top (level 5, full mastery) requires mastering nearly the whole tree." },
    { icon:'📈', title:'Only Progresses If You Use the System', desc:"The tech you're developing only gains progress in weeks where that system is the one chosen in your Weekly Orders (Offense) — 3 to 12 progress points per week depending on your coaching staff's tactical quality. Consistently picking the same system is what actually builds familiarity — there are no shortcuts." },
    { icon:'📉', title:'Forgetting Happens Top-Down', desc:"When you switch systems, the other 4 sit idle — and the highest tier with any progress still remaining loses 6 points per week. As long as that tier has any progress left (even if it's no longer fully mastered), everything below it stays fully protected; only once that tier actually reaches 0 does the one below it start fading." },
    { icon:'⚔️', title:'Still Works Against a Counter', desc:'Every system has a real defensive counter (e.g. Zone shuts down Pick & Roll). But high familiarity claws back some of that disadvantage, up to +12% resistance at maximum (100%) familiarity — a team that has really drilled a system can fight through a counter far better than one running it for the first time, though no amount of familiarity fully cancels a strong counter.' },
    { icon:'⚙️', title:'Every Tech Has a Real Effect', desc:"No tech is decorative. Each one gives a specific, real in-game bonus — fewer turnovers, more assists, better accuracy on a specific shot type, more drawn fouls, more rebounds, or extra resistance against one specific defense. Bonuses only count while that system is the one chosen that week." },
    { icon:'🎯', title:'Real Basketball Themes', desc:'Techs follow real concepts — in Pick & Roll: On-Ball Screen, Lob to the Screener, Pick & Pop (extra bonus if the screener can shoot 3s); in Post-Up: Hook Shot, Two-Man Post Game, Drawing Fouls; and so on across all 5 systems.' },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🔥 {isPT?'Familiaridade com Sistema Tático':'Tactical System Familiarity'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como a árvore de tecnologias por sistema ofensivo funciona, e como afeta o jogo.':'How the per-system tech tree works, and how it affects the game.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
    </div>
  )
}

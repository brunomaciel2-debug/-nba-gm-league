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
    { icon:'🌱', title:'Desenvolvimento Passivo (todo o mês, automático)', desc:'No fim de cada mês da época, a idade de cada jogador define um TECTO fixo do que pode subir ou tem de descer nesse mês — ver tabela abaixo. Para atingir o máximo do teu escalão, o jogador precisa de ter jogado 90%+ dos jogos da equipa nesse mês, com uma média de 20+ minutos por jogo. Quem fica aquém desse nível ainda pode evoluir, mas a uma fração bem menor (a penalização cresce mais depressa do que a diferença em si). A intensidade de treino, a qualidade do Head Coach, Assistant Coach e Preparador Físico, e a moral do jogador ajudam a aproximar-se do máximo quando não se atinge o requisito de jogos/minutos — mas nunca ultrapassam o tecto da idade.' },
    { icon:'📉', title:'Declínio por Idade (todo o mês, automático e obrigatório)', desc:'A partir dos 31 anos, o declínio deixa de ser um risco e passa a ser garantido todos os meses, com a mesma tabela de idade a definir quantos atributos descem e quanto: dos 31-32 já há sempre 1 atributo a perder 2 pontos (mesmo enquanto ainda cresce noutros 2 atributos); dos 33-34, 2 atributos a -1 e 1 a -2, sem qualquer crescimento; a partir dos 35, 3 atributos a -1 e 1 a -2, também sem crescimento algum. Este declínio não depende de jogos, minutos, treino ou moral — a idade sozinha decide.' },
    { icon:'🏋️', title:'Slots de Treino (gasto manual de créditos)', desc:'Além do desenvolvimento passivo, cada categoria — Ataque, Defesa, Físico, Jogo de Equipa, Mental, Recuperação, Treino de Lançamento e Análise — tem o seu próprio slot que enche sozinho e te deixa investir créditos num jogador à tua escolha.' },
    { icon:'🔋', title:'Um Slot Cheio Espera por Ti', desc:'Os slots acumulam % de enchimento todas as semanas. Ao atingir 100%, o slot paga 5 créditos e para de encher — só volta a encher do zero depois de gastares esses 5 créditos todos. Não acumula vários lotes de créditos por gastar.' },
    { icon:'💰', title:'Custo: 1 Crédito = 1 Ponto', desc:'Cada crédito gasto sobe exatamente 1 ponto num atributo — não há custos diferentes por nível.' },
    { icon:'💪', title:'Como Gastar Créditos (limites por jogador)', desc:'No separador Treino, aloca créditos disponíveis a um jogador específico. Cada jogador está limitado a 3 créditos no total por SEMANA — não importa de qual slot vêm, mesmo que apliques em sessões separadas em dias diferentes — e a no máximo 1 crédito no mesmo atributo (os outros têm de ir para atributos diferentes). Isto obriga a espalhar o treino por vários jogadores em vez de concentrar tudo num só.' },
    { icon:'📈', title:'Tecto de Potencial', desc:'Cada jogador tem um tecto de potencial escondido para cada atributo. Nem o treino manual nem o desenvolvimento passivo o podem ultrapassar.' },
    { icon:'🎓', title:'Quem Enche Cada Slot', desc:'A velocidade de enchimento de cada slot depende do staff técnico certo para essa área: Ataque, Defesa, Lançamento, Jogo de Equipa, Mental e Análise dependem 60% do Head Coach + 40% do Assistant Coach (usando a especialidade dele nessa área); Físico e Recuperação dependem 70% do Preparador Físico + 30% do Head Coach. O grau do teu ginásio dá ainda um bónus extra de velocidade a TODOS os slots, não só Físico/Recuperação.' },
    { icon:'🔒', title:'Categorias Trancadas', desc:'Jogo de Equipa desbloqueia com qualquer ginásio construído (grau D ou superior); Análise precisa de ginásio Grau A; Recuperação precisa de piscina ou sauna; Treino de Lançamento precisa de máquina de lançamento; Mental desbloqueia quando o teu Head Coach tem 70+ na área Mental.' },
  ] : [
    { icon:'🌱', title:'Passive Development (every month, automatic)', desc:"At the end of each calendar month, a player's age sets a fixed CEILING on what can grow or must decline that month — see the table below. Reaching your bracket's full ceiling requires playing 90%+ of the team's games that month, averaging 20+ minutes/game. Falling short still allows some growth, just at a much smaller fraction (the penalty grows faster than the shortfall itself). Training intensity, Head Coach / Assistant Coach / Trainer quality, and morale all help close the gap when the games/minutes bar isn't met — but they never push a player past their age ceiling." },
    { icon:'📉', title:'Age Decline (every month, automatic and mandatory)', desc:"From age 31 onward, decline stops being a risk and becomes guaranteed every month, using the same age table to set how many attributes drop and by how much: at 31-32 there's already always 1 attribute losing 2 points (even while 2 others still grow); at 33-34, 2 attributes at -1 and 1 at -2, with no growth at all; from 35 up, 3 attributes at -1 and 1 at -2, also with zero growth. This decline doesn't depend on games, minutes, training, or morale — age alone decides." },
    { icon:'🏋️', title:'Training Slots (manual credit spending)', desc:'On top of passive development, each category — Offense, Defense, Physical, Playmaking, Mental, Recovery, Shooting Lab, and Analytics — has its own slot that fills on its own and lets you invest credits in a player of your choice.' },
    { icon:'🔋', title:'A Full Slot Waits For You', desc:"Slots accumulate fill % each week. Once a slot hits 100%, it pays out 5 credits and stops filling — it only resumes from zero once you've spent all 5 of those credits. It doesn't bank multiple unspent batches." },
    { icon:'💰', title:'Cost: 1 Credit = 1 Point', desc:'Every credit spent raises an attribute by exactly 1 point — there\'s no rising cost by level.' },
    { icon:'💪', title:'Spending Credits (per-player limits)', desc:'In the Training tab, allocate available credits to a specific player. Each player is capped at 3 credits total per WEEK — no matter which slot they come from, even across separate sessions on different days — and at most 1 of those credits can go to the same attribute (the rest has to go to different attributes). This forces you to spread training across multiple players instead of stacking it all on one.' },
    { icon:'📈', title:'Potential Cap', desc:'Every player has a hidden potential ceiling for each attribute. Neither manual training nor passive development can exceed it.' },
    { icon:'🎓', title:'Who Fills Each Slot', desc:"Each slot's fill speed depends on the specific staff member relevant to that area: Offense, Defense, Shooting, Playmaking, Mental and Analytics depend 60% on your Head Coach + 40% on your Assistant Coach (using their specialty in that area); Physical and Recovery depend 70% on your Trainer + 30% on your Head Coach. Your gym's grade also adds an extra speed bonus to ALL slots, not just Physical/Recovery." },
    { icon:'🔒', title:'Locked Categories', desc:'Playmaking unlocks with any built gym (Grade D or higher); Analytics needs a Grade A gym; Recovery needs a pool or sauna; Shooting Lab needs a shooting machine; Mental unlocks once your Head Coach has 70+ in the Mental area.' },
  ]
  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🏋️ {t('trainingRules.title')}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>{t('trainingRules.subtitle')}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>

      <div style={{ marginTop:14, padding:'16px 18px', background:'#faf8f5', border:'1px solid #d4cdc5', borderRadius:12, overflowX:'auto' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1a1512', marginBottom:10 }}>
          📊 {isPT ? 'Tecto Mensal por Idade' : 'Monthly Ceiling by Age'}
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #d4cdc5' }}>
              <th style={{ textAlign:'left', padding:'6px 8px', color:'#6b5f4e' }}>{isPT?'Idade':'Age'}</th>
              <th style={{ textAlign:'left', padding:'6px 8px', color:'#166534' }}>{isPT?'Pode Crescer':'Can Grow'}</th>
              <th style={{ textAlign:'left', padding:'6px 8px', color:'#dc2626' }}>{isPT?'Tem de Descer':'Must Decline'}</th>
            </tr>
          </thead>
          <tbody>
            {[
              { age:'35+',   grow: isPT?'—':'—',                                          decline: isPT?'3 atrib. a -1, 1 atrib. a -2':'3 attrs at -1, 1 attr at -2' },
              { age:'33–34', grow: isPT?'—':'—',                                          decline: isPT?'2 atrib. a -1, 1 atrib. a -2':'2 attrs at -1, 1 attr at -2' },
              { age:'31–32', grow: isPT?'2 atrib. a +1':'2 attrs at +1',                   decline: isPT?'1 atrib. a -2':'1 attr at -2' },
              { age:'28–30', grow: isPT?'4 atrib. a +1':'4 attrs at +1',                   decline: '—' },
              { age:'26–27', grow: isPT?'5 atrib. a +1':'5 attrs at +1',                   decline: '—' },
              { age:'23–25', grow: isPT?'5 atrib. a +1, 1 atrib. a +2':'5 attrs at +1, 1 attr at +2', decline: '—' },
              { age:'21–22', grow: isPT?'6 atrib. a +1, 1 atrib. a +2':'6 attrs at +1, 1 attr at +2', decline: '—' },
              { age:'18–20', grow: isPT?'6 atrib. a +1, 1 atrib. a +3':'6 attrs at +1, 1 attr at +3', decline: '—' },
            ].map((row,i) => (
              <tr key={i} style={{ borderBottom: i<7?'1px solid #ede8de':'none' }}>
                <td style={{ padding:'6px 8px', fontWeight:700, color:'#1a1512' }}>{row.age}</td>
                <td style={{ padding:'6px 8px', color:'#166534' }}>{row.grow}</td>
                <td style={{ padding:'6px 8px', color:'#dc2626' }}>{row.decline}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize:11, color:'#8a8279', marginTop:10, lineHeight:1.5 }}>
          {isPT
            ? 'O máximo de "Pode Crescer" só se atinge jogando 90%+ dos jogos da equipa nesse mês com 20+ min/jogo de média. Abaixo disso, o crescimento é reduzido substancialmente (não apenas proporcional). O declínio a partir dos 31 é sempre garantido, independente de jogos, minutos, treino ou moral.'
            : 'The "Can Grow" maximum is only reached by playing 90%+ of the team\'s games that month at 20+ min/game average. Below that, growth is cut substantially (not just proportionally). Decline from age 31 up is always guaranteed, regardless of games, minutes, training, or morale.'}
        </div>
      </div>

      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#dcfce7', border:'1px solid #bbf7d0' }}>
        <div style={{ fontSize:12, color:'#15803d', lineHeight:1.7 }}>
          {isPT ? 'Desenvolvimento passivo acontece todas as semanas mesmo sem gastares nada · 8 categorias de treino manual, cada uma enche a uma velocidade diferente (staff certo + grau do ginásio) · Ao chegar a 100% paga 5 créditos e pára até gastares tudo · 1 crédito = 1 ponto · Máx 3cr/jogador por semana (qualquer slot), máx 1cr/atributo · Tudo limitado pelo potencial individual.' : "Passive development happens every week even if you spend nothing · 8 manual training categories, each filling at its own speed (right staff + gym grade) · Hitting 100% pays 5 credits and pauses until you spend them all · 1 credit = 1 point · Max 3cr/player per week (any slot), max 1cr/attribute · Everything capped by individual potential."}
        </div>
      </div>
    </div>
  )
}

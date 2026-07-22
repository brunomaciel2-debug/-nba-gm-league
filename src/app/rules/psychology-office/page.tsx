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

export default function PsychologyOfficeRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'🧠', title:'O Que É', desc:'Um gabinete com 3 slots onde atribuis um jogador a sessões privadas com o Mental Coach da equipa, acelerando a recuperação de moral dele além do que já acontece naturalmente todas as semanas.' },
    { icon:'💺', title:'3 Slots, Custos Diferentes', desc:'Slot 1: grátis. Slot 2: $45.000/semana. Slot 3: $80.000/semana. Cada slot só pode ter um jogador de cada vez, e um jogador não pode estar em duas slots ao mesmo tempo.' },
    { icon:'🎯', title:'Objetivo — 60 de Moral', desc:'Enquanto estiver na sessão, o jogador recebe um empurrão extra de moral todas as semanas em direção aos 60/100 — para além da recuperação natural que já teria de qualquer forma.' },
    { icon:'⏰', title:'Extra Hours — Até aos 75', desc:'Qualquer slot pode ativar "Extra Hours", subindo o objetivo de 60 para 75 de moral, a um custo semanal adicional: +$30.000 (Slot 1), +$40.000 (Slot 2), ou +$50.000 (Slot 3).' },
    { icon:'🎓', title:'A Velocidade Depende do Mental Coach', desc:'Quanto melhor a Gestão de Moral do teu Mental Coach, mais depressa o jogador se aproxima do objetivo — de cerca de 15% da distância que falta por semana (Mental Coach fraco) até 45% (Mental Coach excelente). Um Mental Coach fraco ainda ajuda, só que mais devagar.' },
    { icon:'🔓', title:'Liberta-se Sozinho', desc:'Ao atingir o objetivo de moral (60, ou 75 com Extra Hours) numa simulação semanal, a slot liberta-se logo nessa mesma semana — não precisas de te lembrar de a esvaziar. Podes sempre trocar o jogador de uma slot antes disso, se preferires.' },
    { icon:'💰', title:'Custo Real, Semana a Semana', desc:'O custo semanal de cada slot ocupada é debitado do saldo real da equipa e aparece nas tuas Finanças como despesa, todas as semanas em que a slot estiver ocupada.' },
  ] : [
    { icon:'🧠', title:'What It Is', desc:"A 3-slot office where you assign a player to private sessions with the team's Mental Coach, speeding up his morale recovery beyond what already happens naturally every week." },
    { icon:'💺', title:'3 Slots, Different Costs', desc:'Slot 1: free. Slot 2: $45,000/week. Slot 3: $80,000/week. Each slot holds only one player at a time, and a player can\'t be in two slots at once.' },
    { icon:'🎯', title:'Target — 60 Morale', desc:"While in session, the player gets an extra weekly morale push toward 60/100 — on top of whatever natural recovery he'd already get anyway." },
    { icon:'⏰', title:'Extra Hours — Up To 75', desc:'Any slot can turn on "Extra Hours," raising the target from 60 to 75 morale, at an added weekly cost: +$30,000 (Slot 1), +$40,000 (Slot 2), or +$50,000 (Slot 3).' },
    { icon:'🎓', title:'Speed Depends On the Mental Coach', desc:"The better your Mental Coach's Morale Management, the faster the player closes in on the target — from roughly 15% of the remaining gap per week (poor Mental Coach) up to 45% (excellent Mental Coach). A weak Mental Coach still helps, just slower." },
    { icon:'🔓', title:'Frees Up On Its Own', desc:"Once a weekly simulation pushes the player's morale to the target (60, or 75 with Extra Hours), the slot clears that same week — you don't have to remember to empty it. You can always swap the player out of a slot earlier if you prefer." },
    { icon:'💰', title:'A Real Cost, Every Week', desc:"Each occupied slot's weekly cost is deducted from the team's real balance and shows up in your Finances as an expense, every week the slot stays occupied." },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🧠 {isPT ? 'Regras do Psychology Office' : 'Psychology Office Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT ? 'Como funcionam as sessões privadas com o Mental Coach.' : 'How private sessions with the Mental Coach work.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#dcfce7', border:'1px solid #bbf7d0' }}>
        <div style={{ fontSize:12, color:'#15803d', lineHeight:1.7 }}>
          {isPT
            ? '3 slots: grátis / $45k / $80k por semana · Extra Hours sobe o objetivo de 60 para 75 (custo adicional) · Velocidade real depende do Mental Coach · Liberta-se sozinha ao atingir o objetivo · Custo debitado toda a semana, registado nas Finanças.'
            : "3 slots: free / $45k / $80k per week · Extra Hours raises the target from 60 to 75 (added cost) · Real speed depends on the Mental Coach · Frees up on its own on reaching target · Cost deducted every week, logged in Finances."}
        </div>
      </div>
    </div>
  )
}

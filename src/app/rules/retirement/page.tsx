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

export default function RetirementRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'🎂', title:'Idade de Elegibilidade — 35 Anos', desc:'Qualquer jogador com 35 anos ou mais entra todos os anos no processo de fim de carreira. É reavaliado época após época enquanto continuar ativo além dessa idade.' },
    { icon:'🤔', title:'Aviso Prévio — 2 Meses Antes do Fim da Época', desc:'A cerca de 8 semanas do fim da Época Regular, o teu jogador elegível informa-te (por notificação) de que está a ponderar retirar-se. É só um aviso — nada está decidido nesse momento, apenas um sinal para te preparares.' },
    { icon:'🏁', title:'A Decisão — No Fim da Época', desc:'No fim da Época Regular, cada jogador elegível decide se continua mais um ano ou se se retira em definitivo. Se ficar, volta a entrar no mesmo processo na época seguinte; se se retirar, sai do plantel e da liga para sempre.' },
    { icon:'📋', title:'Aparece nas Transferências', desc:'Uma retirada fica registada na página de Transações da equipa, tal como uma troca ou uma saída de free agency.' },
  ] : [
    { icon:'🎂', title:'Eligibility Age — 35 Years Old', desc:"Any player 35 or older enters the end-of-career process every year. He's re-evaluated season after season for as long as he stays active past that age." },
    { icon:'🤔', title:'Advance Warning — 2 Months Before Season End', desc:"About 8 weeks before the Regular Season ends, your eligible player lets you know (via notification) that he's pondering retirement. It's just a heads-up — nothing is decided at that point, just a signal to plan ahead." },
    { icon:'🏁', title:'The Decision — At Season End', desc:'At the end of the Regular Season, every eligible player decides whether to stay one more year or retire for good. If he stays, he re-enters the same process next season; if he retires, he leaves the roster and the league for good.' },
    { icon:'📋', title:'Shows Up In Transactions', desc:"A retirement is logged on the team's Transactions page, the same as a trade or a free-agency departure." },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>👴 {isPT ? 'Regras de Retirada' : 'Retirement Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT ? 'Como e quando um veterano encara o fim de carreira.' : 'How and when a veteran faces the end of his career.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#dcfce7', border:'1px solid #bbf7d0' }}>
        <div style={{ fontSize:12, color:'#15803d', lineHeight:1.7 }}>
          {isPT
            ? '35+ anos entra no processo todos os anos · Aviso ~2 meses antes do fim da época (nada decidido ainda) · Decisão real no fim da Época Regular · Fica registado nas Transações da equipa.'
            : '35+ enters the process every year · Warning ~2 months before season end (nothing decided yet) · Real decision at Regular Season end · Logged on the team\'s Transactions page.'}
        </div>
      </div>
    </div>
  )
}

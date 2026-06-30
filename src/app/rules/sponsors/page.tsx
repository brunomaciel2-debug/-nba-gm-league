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

export default function SponsorRulesPage() {
  const { t } = useTranslation()
  const tiers = [
    { icon:'👕', title: t('sponsorRules.jerseyTitle'), color:'#1d4ed8', desc: t('sponsorRules.jerseyDesc') },
    { icon:'🏀', title: t('sponsorRules.courtTitle'),  color:'#b45309', desc: t('sponsorRules.courtDesc') },
    { icon:'📺', title: t('sponsorRules.panelsTitle'), color:'#15803d', desc: t('sponsorRules.panelsDesc') },
  ]
  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🎯 {t('sponsorRules.title')}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:16 }}>{t('sponsorRules.subtitle')}</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
        {tiers.map(ti => (
          <div key={ti.title} style={{ padding:14, borderRadius:12, background:'#faf8f5', border:'1px solid #d4cdc5', borderTop:`3px solid ${ti.color}` }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{ti.icon}</div>
            <div style={{ fontSize:13, fontWeight:700, color:ti.color, marginBottom:4 }}>{ti.title}</div>
            <div style={{ fontSize:11, color:'#5c554e', lineHeight:1.5 }}>{ti.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <RuleCard icon="💵" title={t('capRules.rule1Title').includes('Cap') ? 'Fixed Monthly Payment' : 'Pagamento Mensal Fixo'} desc={t('capRules.rule1Title').includes('Cap') ? 'Every sponsor contract guarantees a fixed monthly payment regardless of performance, automatically credited to your balance.' : 'Todo contrato de patrocínio garante um pagamento mensal fixo independentemente do desempenho, creditado automaticamente no teu saldo.'} />
        <RuleCard icon="🎯" title={t('capRules.rule1Title').includes('Cap') ? 'Bonus Objectives' : 'Objetivos de Bónus'} desc={t('capRules.rule1Title').includes('Cap') ? 'Each sponsor includes measurable bonus objectives. Hitting a target pays out its bonus amount on top of the fixed salary.' : 'Cada patrocinador inclui objetivos de bónus mensuráveis. Atingir um objetivo paga o valor de bónus além do salário fixo.'} />
        <RuleCard icon="✅" title={t('capRules.rule1Title').includes('Cap') ? 'Automatic Tracking' : 'Acompanhamento Automático'} desc={t('capRules.rule1Title').includes('Cap') ? "Objectives are checked automatically after every simulation. The moment a target is hit, the bonus is credited and you receive an inbox notification." : "Os objetivos são verificados automaticamente após cada simulação. Assim que um objetivo é atingido, o bónus é creditado e recebes uma notificação."} />
        <RuleCard icon="🔢" title={t('capRules.rule1Title').includes('Cap') ? 'One Contract Per Tier' : 'Um Contrato por Tier'} desc={t('capRules.rule1Title').includes('Cap') ? 'A team can hold one active sponsor contract per tier at a time — three sponsors total.' : 'Uma equipa pode ter um contrato de patrocínio ativo por tier de cada vez — três patrocinadores no total.'} />
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#dcfce7', border:'1px solid #bbf7d0' }}>
        <div style={{ fontSize:12, color:'#15803d', lineHeight:1.7 }}>
          {t('capRules.rule1Title').includes('Cap') ? '3 tiers (Jersey, Court, Panels), one contract each · Fixed monthly pay + bonus objectives · Auto-tracked after every simulation' : '3 tiers (Camisola, Campo, Painéis), um contrato cada · Pagamento mensal fixo + objetivos de bónus · Acompanhamento automático após cada simulação'}
        </div>
      </div>
    </div>
  )
}

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
        <RuleCard icon="💰" title={t('capRules.rule1Title').includes('Cap') ? 'Payment Structure' : 'Estrutura de Pagamento'} desc={t('capRules.rule1Title').includes('Cap') ? 'Each contract has a fixed annual salary split into 12 equal monthly payments — a $1.2M/yr sponsor pays $100K every month. Bonus objectives can add up to a variable maximum shown per contract on top of that.' : 'Cada contrato tem um salário anual fixo dividido em 12 pagamentos mensais iguais — um patrocinador de 1.2M$/ano paga 100K$ todos os meses. Os objetivos de bónus podem somar até um máximo variável, mostrado por contrato, por cima disso.'} />
        <RuleCard icon="📊" title={t('capRules.rule1Title').includes('Cap') ? 'Tier Access Depends on Last Season' : 'Acesso aos Tiers Depende da Época Anterior'} desc={t('capRules.rule1Title').includes('Cap') ? "Which sponsors you can even see this season depends on last season's Sponsors Score (your bonus-objective hit rate): below 40, only the cheapest sponsor per tier is offered; 40-70, the bottom 2/3 of each tier; above 70, the full range including the top-paying sponsors. New GMs with no history start at a neutral 55 (mid-range access)." : "Os patrocinadores que sequer vês esta época dependem da Pontuação de Patrocinadores da época anterior (a tua taxa de objetivos de bónus cumpridos): abaixo de 40, só o patrocinador mais barato de cada tier; 40-70, os 2/3 mais baratos de cada tier; acima de 70, a gama completa incluindo os patrocinadores mais valiosos. GMs novos sem histórico começam num 55 neutro (acesso à gama intermédia)."} />
        <RuleCard icon="🧮" title={t('capRules.rule1Title').includes('Cap') ? 'How Sponsors Score Is Calculated' : 'Como se Calcula a Pontuação de Patrocinadores'} desc={t('capRules.rule1Title').includes('Cap') ? "It's simply: (bonus objectives you actually hit) ÷ (objectives offered that either got hit or expired) × 100. A team with no sponsor activity that season defaults to 40 — engagement is rewarded, not just avoiding failure." : "É simplesmente: (objetivos de bónus que cumpriste) ÷ (objetivos oferecidos que foram cumpridos ou expiraram) × 100. Uma equipa sem qualquer atividade de patrocínio nessa época fica com 40 por defeito — o envolvimento é recompensado, não basta evitar o falhanço."} />
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#dcfce7', border:'1px solid #bbf7d0' }}>
        <div style={{ fontSize:12, color:'#15803d', lineHeight:1.7 }}>
          {t('capRules.rule1Title').includes('Cap') ? '3 tiers (Jersey, Court, Panels), one contract each · Fixed monthly pay + bonus objectives · Auto-tracked after every simulation · Which sponsors you can sign next season depends on this season\'s Sponsors Score.' : '3 tiers (Camisola, Campo, Painéis), um contrato cada · Pagamento mensal fixo + objetivos de bónus · Acompanhamento automático após cada simulação · Os patrocinadores que consegues assinar na próxima época dependem da Pontuação de Patrocinadores desta época.'}
        </div>
      </div>
    </div>
  )
}

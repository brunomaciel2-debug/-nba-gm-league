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

export default function ContractRulesPage() {
  const { t } = useTranslation()
  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>📝 {t('contractRules.title')}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>{t('contractRules.subtitle')}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <RuleCard icon="🔒" title={t('contractRules.rule1Title')} desc={t('contractRules.rule1Desc')} />
        <RuleCard icon="💰" title={t('contractRules.rule2Title')} desc={t('contractRules.rule2Desc')} />
        <RuleCard icon="📈" title={t('contractRules.rule3Title')} desc={t('contractRules.rule3Desc')} />
        <RuleCard icon="📅" title={t('contractRules.rule4Title')} desc={t('contractRules.rule4Desc')} />
        <RuleCard icon="🎯" title={t('contractRules.rule5Title')} desc={t('contractRules.rule5Desc')} />
        <RuleCard icon="🚫" title={t('contractRules.rule6Title')} desc={t('contractRules.rule6Desc')} />
        <RuleCard icon="✋" title={t('contractRules.rule7Title')} desc={t('contractRules.rule7Desc')} />
        <RuleCard icon="🤔" title={t('contractRules.rule8Title')} desc={t('contractRules.rule8Desc')} />
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#dbeafe', border:'1px solid #93c5fd' }}>
        <div style={{ fontSize:12, color:'#1d4ed8', lineHeight:1.7 }}>
          {t('capRules.summaryTitle')}: {t('contractRules.rule2Title')} · +40% · 1–5 {t('common.years').toLowerCase()} · {t('contractRules.rule7Title').toLowerCase()}
        </div>
      </div>
    </div>
  )
}

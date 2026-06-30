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

export default function TradeRulesPage() {
  const { t } = useTranslation()
  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🔄 {t('tradeRules.title')}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>{t('tradeRules.subtitle')}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <RuleCard icon="⚖️" title={t('tradeRules.rule1Title')} desc={t('tradeRules.rule1Desc')} />
        <RuleCard icon="💰" title={t('tradeRules.rule2Title')} desc={t('tradeRules.rule2Desc')} />
        <RuleCard icon="🔀" title={t('tradeRules.rule3Title')} desc={t('tradeRules.rule3Desc')} />
        <RuleCard icon="🎓" title={t('tradeRules.rule4Title')} desc={t('tradeRules.rule4Desc')} />
        <RuleCard icon="📨" title={t('tradeRules.rule5Title')} desc={t('tradeRules.rule5Desc')} />
        <RuleCard icon="👑" title={t('tradeRules.rule6Title')} desc={t('tradeRules.rule6Desc')} />
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#dbeafe', border:'1px solid #93c5fd' }}>
        <div style={{ fontSize:12, color:'#1d4ed8', lineHeight:1.7 }}>
          ±15% + 1M$ · {t('tradeRules.rule2Title')} · {t('tradeRules.rule3Title')}
        </div>
      </div>
      <p style={{ marginTop:12, textAlign:'center' }}>
        <a href="/trade-center" style={{ fontSize:12, fontWeight:700, color:'#1d4ed8', textDecoration:'none' }}>
          {t('nav.tradeCenter')} →
        </a>
      </p>
    </div>
  )
}

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

export default function ScoutingRulesPage() {
  const { t } = useTranslation()
  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🔍 {t('scoutingGuide.title')}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>{t('scoutingGuide.subtitle')}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <RuleCard icon="🙈" title={t('scoutingGuide.rule1Title')} desc={t('scoutingGuide.rule1Desc')} />
        <RuleCard icon="🔒" title={t('scoutingGuide.rule2Title')} desc={t('scoutingGuide.rule2Desc')} />
        <RuleCard icon="👤" title={t('scoutingGuide.rule3Title')} desc={t('scoutingGuide.rule3Desc')} />
        <RuleCard icon="📈" title={t('scoutingGuide.rule4Title')} desc={t('scoutingGuide.rule4Desc')} />
        <RuleCard icon="🥉" title={t('scoutingGuide.rule5Title')} desc={t('scoutingGuide.rule5Desc')} />
        <RuleCard icon="🥈" title={t('scoutingGuide.rule6Title')} desc={t('scoutingGuide.rule6Desc')} />
        <RuleCard icon="🥇" title={t('scoutingGuide.rule7Title')} desc={t('scoutingGuide.rule7Desc')} />
        <RuleCard icon="💡" title={t('scoutingGuide.rule8Title')} desc={t('scoutingGuide.rule8Desc')} />
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#ede9fe', border:'1px solid #c4b5fd' }}>
        <div style={{ fontSize:12, color:'#6d28d9', lineHeight:1.7 }}>
          Tier 1: 100pts → 6 / 10cr · Tier 2: 250pts → 14 / 15cr + 15K$/sem · Tier 3: 400pts → 24 / 20cr + 40K$/sem
        </div>
      </div>
      <p style={{ marginTop:12, textAlign:'center' }}>
        <a href="/draft" style={{ fontSize:12, fontWeight:700, color:'#6d28d9', textDecoration:'none' }}>
          {t('nav.draft')} →
        </a>
      </p>
    </div>
  )
}

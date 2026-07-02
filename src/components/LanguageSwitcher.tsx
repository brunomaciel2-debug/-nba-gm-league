'use client'
import { useTranslation } from '@/components/I18nProvider'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation()

  return (
    <div style={{ display:'flex', alignItems:'center', gap:2, background:'#1a1512', borderRadius:8, padding:2 }}>
      <button
        onClick={() => setLocale('en')}
        title="English"
        style={{
          padding:'4px 7px', borderRadius:6, fontSize:16, cursor:'pointer', border:'none',
          background: locale === 'en' ? '#faf8f5' : 'transparent',
          opacity: locale === 'en' ? 1 : 0.5,
          lineHeight:1,
        }}>
        🇬🇧
      </button>
      <button
        onClick={() => setLocale('pt')}
        title="Português"
        style={{
          padding:'4px 7px', borderRadius:6, fontSize:16, cursor:'pointer', border:'none',
          background: locale === 'pt' ? '#faf8f5' : 'transparent',
          opacity: locale === 'pt' ? 1 : 0.5,
          lineHeight:1,
        }}>
        🇵🇹
      </button>
    </div>
  )
}

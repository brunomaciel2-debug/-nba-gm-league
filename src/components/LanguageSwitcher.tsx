'use client'
import { useTranslation } from '@/components/I18nProvider'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#1a1512', borderRadius: 8, padding: 2 }}>
      <button
        onClick={() => setLocale('en')}
        style={{
          padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
          background: locale === 'en' ? '#faf8f5' : 'transparent',
          color: locale === 'en' ? '#1a1512' : '#a89f97',
        }}>
        🇬🇧 EN
      </button>
      <button
        onClick={() => setLocale('pt')}
        style={{
          padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
          background: locale === 'pt' ? '#faf8f5' : 'transparent',
          color: locale === 'pt' ? '#1a1512' : '#a89f97',
        }}>
        🇵🇹 PT
      </button>
    </div>
  )
}

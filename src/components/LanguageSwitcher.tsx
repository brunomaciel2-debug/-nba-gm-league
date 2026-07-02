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
          padding:'3px 7px', borderRadius:6, fontSize:11, fontWeight:700,
          cursor:'pointer', border:'none', lineHeight:1,
          background: locale === 'en' ? '#faf8f5' : 'transparent',
          color: locale === 'en' ? '#1a1512' : '#a89f97',
          display:'flex', alignItems:'center', gap:4,
        }}>
        <img
          src="https://flagcdn.com/w20/gb.png"
          alt="EN"
          width={16}
          height={11}
          style={{ display:'block', borderRadius:1 }}
        />
        <span>EN</span>
      </button>
      <button
        onClick={() => setLocale('pt')}
        title="Português"
        style={{
          padding:'3px 7px', borderRadius:6, fontSize:11, fontWeight:700,
          cursor:'pointer', border:'none', lineHeight:1,
          background: locale === 'pt' ? '#faf8f5' : 'transparent',
          color: locale === 'pt' ? '#1a1512' : '#a89f97',
          display:'flex', alignItems:'center', gap:4,
        }}>
        <img
          src="https://flagcdn.com/w20/pt.png"
          alt="PT"
          width={16}
          height={11}
          style={{ display:'block', borderRadius:1 }}
        />
        <span>PT</span>
      </button>
    </div>
  )
}

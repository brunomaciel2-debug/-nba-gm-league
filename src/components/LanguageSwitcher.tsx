'use client'
import { useTranslation } from '@/components/I18nProvider'

// SVG flags inline - no external dependencies, no CSP issues
const FlagGB = () => (
  <svg width="18" height="12" viewBox="0 0 60 40" style={{display:'block',borderRadius:2,flexShrink:0}}>
    <rect width="60" height="40" fill="#012169"/>
    <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8"/>
    <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="5"/>
    <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="13"/>
    <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="8"/>
  </svg>
)

const FlagPT = () => (
  <svg width="18" height="12" viewBox="0 0 60 40" style={{display:'block',borderRadius:2,flexShrink:0}}>
    <rect width="60" height="40" fill="#FF0000"/>
    <rect width="24" height="40" fill="#006600"/>
    <circle cx="24" cy="20" r="8" fill="#FFD700" stroke="#FFD700" strokeWidth="1"/>
    <circle cx="24" cy="20" r="5.5" fill="#FF0000" stroke="#003399" strokeWidth="1"/>
    <rect x="20" y="17" width="8" height="6" fill="none" stroke="#003399" strokeWidth="1"/>
    <circle cx="22" cy="20" r="1" fill="#003399"/>
    <circle cx="26" cy="20" r="1" fill="#003399"/>
    <circle cx="24" cy="18" r="1" fill="#003399"/>
  </svg>
)

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation()

  return (
    <div style={{display:'flex',alignItems:'center',gap:2,background:'#1a1512',borderRadius:8,padding:2}}>
      <button
        onClick={() => setLocale('en')}
        title="English"
        style={{
          padding:'3px 7px', borderRadius:6, fontSize:11, fontWeight:700,
          cursor:'pointer', border:'none',
          background: locale === 'en' ? '#faf8f5' : 'transparent',
          color: locale === 'en' ? '#1a1512' : '#a89f97',
          display:'flex', alignItems:'center', gap:5,
        }}>
        <FlagGB/>
        EN
      </button>
      <button
        onClick={() => setLocale('pt')}
        title="Português"
        style={{
          padding:'3px 7px', borderRadius:6, fontSize:11, fontWeight:700,
          cursor:'pointer', border:'none',
          background: locale === 'pt' ? '#faf8f5' : 'transparent',
          color: locale === 'pt' ? '#1a1512' : '#a89f97',
          display:'flex', alignItems:'center', gap:5,
        }}>
        <FlagPT/>
        PT
      </button>
    </div>
  )
}

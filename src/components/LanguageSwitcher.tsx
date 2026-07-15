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

// `stacked`: two small standalone chips, one above the other — for the dark
// top nav bar, where there's more vertical room than horizontal room next to
// the Commissioner button. Default (unstacked) keeps the original single
// joined pill, used in the mobile menu panel where a wide row is free.
export default function LanguageSwitcher({ stacked }: { stacked?: boolean } = {}) {
  const { locale, setLocale } = useTranslation()

  if (stacked) {
    const chipStyle = (active: boolean): React.CSSProperties => ({
      padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700,
      cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4,
      background: active ? '#faf8f5' : 'rgba(255,255,255,0.08)',
      color: active ? '#1a1512' : '#a89f97',
    })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <button onClick={() => setLocale('en')} title="English" style={chipStyle(locale === 'en')}>
          <FlagGB/>EN
        </button>
        <button onClick={() => setLocale('pt')} title="Português" style={chipStyle(locale === 'pt')}>
          <FlagPT/>PT
        </button>
      </div>
    )
  }

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

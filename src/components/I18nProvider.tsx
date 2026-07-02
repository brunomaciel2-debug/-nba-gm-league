'use client'
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import en from './messages/en'
import pt from './messages/pt'

type Locale = 'en' | 'pt'
const MESSAGES = { en, pt }

type TranslationContextType = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (path: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<TranslationContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (path) => path,
})

export function useTranslation() {
  return useContext(I18nContext)
}

function getNested(obj: any, path: string): string | undefined {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj)
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str
  return Object.entries(vars).reduce((acc, [key, val]) => acc.replaceAll(`{${key}}`, String(val)), str)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  // Track whether the user manually changed the locale this session
  const userChose = useRef(false)

  useEffect(() => {
    // Read localStorage first — instant, no network
    const cached = localStorage.getItem('nba_gm_locale') as Locale | null
    if (cached === 'en' || cached === 'pt') {
      setLocaleState(cached)
    }

    // Then sync from DB — but ONLY if the user hasn't manually chosen yet
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('gm_profiles').select('language').eq('id', user.id).single()
      // Only apply DB value if user hasn't clicked a language button this session
      if (!userChose.current && (profile?.language === 'en' || profile?.language === 'pt')) {
        setLocaleState(profile.language)
        localStorage.setItem('nba_gm_locale', profile.language)
      }
    }).catch(() => {})
  }, [])

  const setLocale = async (newLocale: Locale) => {
    userChose.current = true          // Mark that the user made an explicit choice
    setLocaleState(newLocale)         // Instant UI update
    localStorage.setItem('nba_gm_locale', newLocale)
    // Persist to DB in background
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        await supabase.from('gm_profiles').update({ language: newLocale }).eq('id', user.id)
      }
    }).catch(() => {})
  }

  const t = (path: string, vars?: Record<string, string | number>): string => {
    const dict = MESSAGES[locale]
    const value = getNested(dict, path) ?? getNested(MESSAGES.en, path) ?? path
    return interpolate(value, vars)
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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
  return path.split('.').reduce(
    (acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined),
    obj
  )
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.split('{' + key + '}').join(String(val)),
    str
  )
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    const cached = localStorage.getItem('btc_locale') as Locale | null
    if (cached === 'en' || cached === 'pt') {
      setLocaleState(cached)
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('btc_locale', newLocale)
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
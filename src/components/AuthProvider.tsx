'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type AuthContextType = {
  user: any | null
  profile: any | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
  isCommissioner: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, loading: true,
  signIn: async () => {}, signOut: async () => {}, isCommissioner: false
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('gm_profiles').select('*, teams(*)').eq('id', userId).single()
    if (error) console.error('Profile load error:', error)
    else console.log('Profile loaded:', data?.display_name, data?.role)
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    return result
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, signIn, signOut,
      isCommissioner: profile?.role === 'commissioner'
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

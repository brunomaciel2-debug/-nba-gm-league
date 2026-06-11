'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signIn(email, password)
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{background:'#1a1610'}}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏀</div>
          <h1 className="text-2xl font-black" style={{color:'#f0ebe0'}}>NBA GM League</h1>
          <p className="text-sm mt-1" style={{color:'#8a7a6a'}}>Sign in to manage your franchise</p>
        </div>
        <div className="rounded-2xl p-8" style={{background:'#241f18',border:'1px solid #3a3228'}}>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{background:'#1a1610',border:'1px solid #3a3228',color:'#f0ebe0'}}
                placeholder="your@email.com" />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-semibold mb-1.5" style={{color:'#8a7a6a'}}>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{background:'#1a1610',border:'1px solid #3a3228',color:'#f0ebe0'}}
                placeholder="••••••••" />
            </div>
            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{background:'#2a0a0a',color:'#e04040'}}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
              style={{background:'#3a8adf',color:'#fff'}}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs mt-4" style={{color:'#5a4a3a'}}>
          Contact the Commissioner to get your account credentials.
        </p>
      </div>
    </div>
  )
}

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
         style={{background:'#ede8de'}}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏀</div>
          <h1 className="text-2xl font-black" style={{color:'#1a1612'}}>NBA GM League</h1>
          <p className="text-sm mt-1" style={{color:'#6b5f4e'}}>Sign in to manage your franchise</p>
        </div>
        <div className="rounded-2xl p-8" style={{background:'#e8e2d6',border:'1px solid #d4cec3'}}>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}}
                placeholder="your@email.com" />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-semibold mb-1.5" style={{color:'#6b5f4e'}}>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{background:'#ede8de',border:'1px solid #d4cec3',color:'#1a1612'}}
                placeholder="••••••••" />
            </div>
            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{background:'#fee2e2',color:'#dc2626'}}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
              style={{background:'#1d4ed8',color:'#e8e2d6'}}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs mt-4" style={{color:'#9c8e7a'}}>
          Contact the Commissioner to get your account credentials.
        </p>
      </div>
    </div>
  )
}

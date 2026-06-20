import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Public client — safe for browser and server, no fetch cache
export const supabase = createClient(url, anon, {
  global: { fetch: (url, opts = {}) => fetch(url, { ...opts, cache: 'no-store' }) }
})

// Admin client — SERVER ONLY (API routes, cron)
// Lazy-loaded to avoid crashing browser imports
export function getSupabaseAdmin() {
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!svc) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set — only call this server-side')
  return createClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (url, opts = {}) => fetch(url, { ...opts, cache: 'no-store' }) }
  })
}

// Keep supabaseAdmin as alias for server-side code that already uses it
export const supabaseAdmin = typeof window === 'undefined'
  ? createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || anon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (url, opts = {}) => fetch(url, { ...opts, cache: 'no-store' }) }
    })
  : null as any

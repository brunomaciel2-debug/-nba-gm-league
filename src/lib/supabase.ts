import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anon)

export const supabaseAdmin = typeof window === 'undefined'
  ? createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || anon, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null as any
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TEMPLATE_COLUMNS, TEMPLATE_EXAMPLE_ROWS } from '@/lib/prospect-expansion'
import { toCsv } from '@/lib/csv'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Commissioner-only downloadable CSV template for the Draft Class upload —
// headers plus 2 filled example rows so Bruno knows exactly what a valid
// row looks like before filling in ~30-60 real prospects himself.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('role').eq('id', user.id).single()
  if (gm?.role !== 'commissioner') return NextResponse.json({ error: 'Commissioner only' }, { status: 403 })

  const csv = toCsv(TEMPLATE_COLUMNS, TEMPLATE_EXAMPLE_ROWS)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="draft_class_template.csv"',
    },
  })
}

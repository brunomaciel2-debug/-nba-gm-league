import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCsv } from '@/lib/csv'
import { validateRow, expandProspectRow } from '@/lib/prospect-expansion'
import { setNextDraftSeason } from '@/lib/draft-lottery'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Commissioner-only Draft Class upload. Bruno provides the class himself —
// this parses his filled-in CSV template, validates every row up front
// (all-or-nothing: a bad row blocks the whole upload so nothing partial
// ever lands), expands each scouted row into the full attribute set the
// draft engine already expects, and rolls the season forward in
// draft_config so next year needs no code change either.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: gm } = await admin.from('gm_profiles').select('role').eq('id', user.id).single()
  if (gm?.role !== 'commissioner') return NextResponse.json({ error: 'Commissioner only' }, { status: 403 })

  const { season, csv } = await req.json()
  if (!season || typeof season !== 'string' || !season.trim()) {
    return NextResponse.json({ error: 'Missing draft class season (e.g. "2027")' }, { status: 400 })
  }
  if (!csv || typeof csv !== 'string') return NextResponse.json({ error: 'Missing CSV file contents' }, { status: 400 })

  const rawRows = parseCsv(csv)
  if (rawRows.length === 0) return NextResponse.json({ error: 'CSV file has no data rows' }, { status: 400 })

  const errors: string[] = []
  const validRows: ReturnType<typeof validateRow>['row'][] = []
  rawRows.forEach((raw, idx) => {
    const { row, errors: rowErrors } = validateRow(raw, idx + 2) // +2: header is row 1, data starts row 2
    if (rowErrors.length) errors.push(...rowErrors)
    else validRows.push(row)
  })

  const names = new Set<string>()
  validRows.forEach((row, idx) => {
    const key = row!.name.toLowerCase()
    if (names.has(key)) errors.push(`Row ${idx + 2}: duplicate prospect name "${row!.name}" in this file`)
    names.add(key)
  })

  if (errors.length) return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })

  const { count: existing } = await admin.from('prospects').select('id', { count: 'exact', head: true }).eq('season', season)
  if (existing && existing > 0) {
    return NextResponse.json({ error: `A Draft Class for season "${season}" already exists (${existing} prospects). Delete it first if you meant to replace it.` }, { status: 409 })
  }

  const inserts = validRows.map(row => {
    const expanded = expandProspectRow(row!)
    return {
      season, name: row!.name, pos: row!.pos, age: row!.age, nationality: row!.nationality,
      college: row!.college || null, height: row!.height_in || null, weight: row!.weight_lbs || null,
      overall: row!.overall, drafted: false,
      ...expanded,
    }
  })

  const { error: insertError } = await admin.from('prospects').insert(inserts)
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  await setNextDraftSeason(season)

  return NextResponse.json({ success: true, count: inserts.length })
}

import { NextRequest, NextResponse } from 'next/server'
import { resolveFreeAgencyMarket } from '@/lib/resolve-free-agency-core'

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === 'true'
  const result = await resolveFreeAgencyMarket(force)
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any))
  const result = await resolveFreeAgencyMarket(!!body.force)
  return NextResponse.json(result)
}

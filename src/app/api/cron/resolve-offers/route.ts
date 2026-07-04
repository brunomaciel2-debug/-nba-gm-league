import { NextRequest, NextResponse } from 'next/server'
import { resolveOffers } from '@/lib/resolve-offers-core'

export async function GET(req: NextRequest) {
  const result = await resolveOffers()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const result = await resolveOffers()
  return NextResponse.json(result)
}

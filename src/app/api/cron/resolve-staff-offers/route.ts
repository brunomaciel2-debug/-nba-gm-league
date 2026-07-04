import { NextRequest, NextResponse } from 'next/server'
import { resolveStaffOffers } from '@/lib/resolve-staff-offers-core'

export async function GET(req: NextRequest) {
  const result = await resolveStaffOffers()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const result = await resolveStaffOffers()
  return NextResponse.json(result)
}

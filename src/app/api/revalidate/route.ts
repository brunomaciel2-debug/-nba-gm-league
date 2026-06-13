import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') || '/'
  revalidatePath(path)
  revalidatePath('/', 'layout') // revalidate all
  return NextResponse.json({ revalidated: true, path })
}

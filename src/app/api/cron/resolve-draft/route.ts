import { NextRequest, NextResponse } from 'next/server'
import { resolveDraftRound, sweepExpiredDraftConfirmations, sweepExpiredRookieOptions } from '@/lib/draft-resolver'
import { resolveDraftLottery } from '@/lib/draft-lottery'

// Resolves both draft rounds (when their calendar week arrives, or always
// when force=true) and sweeps any expired post-draft confirmations / Team
// Option deadlines. Mirrors /api/cron/resolve-free-agency's shape exactly —
// a no-op most of the time, real work only when its internal checks pass.
// The lottery runs first — self-gated (no-op until playoffs are actually
// over), so it's safe to call unconditionally here too.
async function run(force: boolean) {
  const lottery = await resolveDraftLottery()
  const r1 = await resolveDraftRound(1, force)
  const r2 = await resolveDraftRound(2, force)
  const confirmSweep = await sweepExpiredDraftConfirmations()
  const optionSweep = await sweepExpiredRookieOptions()
  return { lottery, round1: r1, round2: r2, confirmSweep, optionSweep }
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === 'true'
  return NextResponse.json(await run(force))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any))
  return NextResponse.json(await run(!!body.force))
}

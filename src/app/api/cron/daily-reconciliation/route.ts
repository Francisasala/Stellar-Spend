/**
 * Daily reconciliation cron route.
 *
 * This route is deliberately thin: it authenticates the cron call and
 * delegates all reconciliation work to src/lib/reconciliation.ts so that
 * manual and scheduled runs share one implementation.
 *
 * Closes #1203
 */
import { NextRequest, NextResponse } from 'next/server';
import { runReconciliation } from '@/lib/reconciliation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const windowStart = url.searchParams.get('windowStart') ?? undefined;
  const windowEnd = url.searchParams.get('windowEnd') ?? undefined;
  const dryRun = url.searchParams.get('dryRun') === 'true';

  try {
    const result = await runReconciliation({ windowStart, windowEnd, dryRun });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

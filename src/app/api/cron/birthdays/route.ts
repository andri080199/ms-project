import { NextResponse } from 'next/server';
import { notifyBirthdaysToApprovalAdmins } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Validates the cron request using a shared secret supplied via either:
//   - ?token=<secret> query parameter (for simple cron services)
//   - Authorization: Bearer <secret> header (for Vercel Cron / standard bearer auth)
// Returns false if CRON_SECRET is not set — no secret means no access.
function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const url = new URL(req.url);
  const tokenFromQuery = url.searchParams.get('token');
  const header = req.headers.get('authorization') ?? '';
  const tokenFromHeader = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return tokenFromQuery === expected || tokenFromHeader === expected;
}

// Runs the birthday notification job and returns the result summary.
async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const result = await notifyBirthdaysToApprovalAdmins();
  return NextResponse.json({ success: true, data: result });
}

// Supports both GET (for simple URL-based cron triggers) and POST (for webhook-style triggers).
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

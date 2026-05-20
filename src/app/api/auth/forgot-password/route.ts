import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  generateRawToken,
  hashToken,
  RESET_RATE_LIMIT_MAX,
  RESET_RATE_LIMIT_WINDOW_MS,
  RESET_TOKEN_TTL_MS,
} from '@/lib/password-reset';
import { sendPasswordResetEmail } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

// POST /api/auth/forgot-password
//
// Security stance:
// - ALWAYS returns `{ success: true }` — the response must never reveal whether
//   an email address is registered (anti-enumeration attack).
// - Rate-limited per email: max 3 requests per hour using a DB sliding window.
//   (No Redis needed — token counts in DB are sufficient for this load.)
// - The raw token only appears in the email URL; the DB stores only its SHA-256 hash.
// - If the email send fails, the error is logged but the response is still `success: true`
//   to avoid leaking validity information.
export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    // Invalid format → 400. Safe: an empty/invalid email is not an existence signal
    // because the frontend also validates before submitting.
    return NextResponse.json({ success: false, error: 'Email tidak valid' }, { status: 400 });
  }

  const { email } = parsed.data;

  // Look up the user — if not found, fall through and still return success.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  if (user) {
    // Count how many reset tokens this user has created in the rate-limit window.
    const windowStart = new Date(Date.now() - RESET_RATE_LIMIT_WINDOW_MS);
    const recentCount = await prisma.passwordResetToken.count({
      where: {
        userId: user.id,
        createdAt: { gte: windowStart },
      },
    });

    if (recentCount >= RESET_RATE_LIMIT_MAX) {
      // Still return success — revealing the rate limit would help an attacker.
      console.warn(`[forgot-password] rate limit hit for user ${user.id}`);
      return NextResponse.json({ success: true });
    }

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        rawToken,
        expiresAt,
      });
    } catch (err) {
      // Log the error but do not propagate — a different response for send failures
      // vs. non-existent users would leak information.
      console.error(`[forgot-password] gagal kirim email ke user ${user.id}`, err);
    }
  }

  // Always respond with success regardless of whether the email exists.
  return NextResponse.json({ success: true });
}

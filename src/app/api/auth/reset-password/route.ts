import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/password-reset';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(6, 'Password minimal 6 karakter').max(200),
});

// POST /api/auth/reset-password
//
// Security:
// - The client sends the raw token; we hash it (SHA-256) before DB lookup so
//   the plaintext never touches the database.
// - Lookup is by `tokenHash` (unique index) — no iteration, no timing leak.
// - Invalid conditions (not found, already used, expired) all return the same
//   generic error message to prevent oracle attacks.
// - On success:
//     1. Update the user's password hash (bcrypt cost 10).
//     2. Mark the used token with `usedAt` so it can't be replayed.
//     3. Delete all other reset tokens for this user to invalidate stale links.
//   Steps 1–3 run in a single atomic transaction.
export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json(
      { success: false, error: first?.message ?? 'Input tidak valid' },
      { status: 400 },
    );
  }

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  // Use the same error message for all invalid states to prevent oracle attacks.
  const invalidMsg = 'Link reset tidak valid atau sudah kedaluwarsa';
  if (!record) {
    return NextResponse.json({ success: false, error: invalidMsg }, { status: 400 });
  }
  if (record.usedAt) {
    return NextResponse.json({ success: false, error: invalidMsg }, { status: 400 });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ success: false, error: invalidMsg }, { status: 400 });
  }

  const newHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    // Update the user's password.
    prisma.user.update({
      where: { id: record.userId },
      data: { password: newHash },
    }),
    // Mark this token as used so it cannot be replayed.
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate all other outstanding reset tokens for this user — prevents
    // an attacker with a stale link from resetting again.
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: record.userId,
        id: { not: record.id },
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageUsers } from '@/lib/permissions';
import { positionCreateSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

// Returns all positions ordered alphabetically with a user count on each.
// Requires super-admin privileges (canManageUsers).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageUsers(session.user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const data = await prisma.position.findMany({
      orderBy: { name: 'asc' },
      // _count.users lets the admin UI warn before deleting a position that still has members.
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data posisi' }, { status: 500 });
  }
}

// Creates a new position. Returns 409 if the name already exists (name has a unique constraint).
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageUsers(session.user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const parsed = positionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Validasi gagal' },
        { status: 400 }
      );
    }
    const exists = await prisma.position.findUnique({ where: { name: parsed.data.name } });
    if (exists) {
      return NextResponse.json({ success: false, error: 'Nama posisi sudah ada' }, { status: 409 });
    }
    const created = await prisma.position.create({ data: parsed.data });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal membuat posisi' }, { status: 500 });
  }
}

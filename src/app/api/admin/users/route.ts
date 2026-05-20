import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageUsers } from '@/lib/permissions';
import { userCreateSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

// GET /api/admin/users — lists all user accounts with full admin detail.
// Requires super-admin role (canManageUsers).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageUsers(session.user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const data = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        employeeId: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        isApprovalAdmin: true,
        phone: true,
        department: true,
        employmentStatus: true,
        spvId: true,
        positionId: true,
        joinDate: true,
        position: { select: { id: true, name: true, department: true } },
        spv: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data akun' }, { status: 500 });
  }
}

// POST /api/admin/users — creates a new user account.
// Requires super-admin role. Validates for duplicate email and employee ID.
// Automatically sets `isApprovalAdmin: true` for "People & GA Officer" positions.
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
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Validasi gagal' },
        { status: 400 }
      );
    }
    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) {
      return NextResponse.json({ success: false, error: 'Email sudah terdaftar' }, { status: 409 });
    }
    // Auto-grant approval-admin if the position is "People & GA Officer".
    let positionDefault: { isApprovalAdmin?: boolean } = {};
    if (parsed.data.positionId) {
      const pos = await prisma.position.findUnique({ where: { id: parsed.data.positionId } });
      if (!pos) {
        return NextResponse.json({ success: false, error: 'Posisi tidak ditemukan' }, { status: 400 });
      }
      if (pos.name === 'People & GA Officer') positionDefault = { isApprovalAdmin: true };
    }
    const employeeId = parsed.data.employeeId?.trim() || null;
    if (employeeId) {
      const dup = await prisma.user.findUnique({ where: { employeeId }, select: { id: true } });
      if (dup) {
        return NextResponse.json({ success: false, error: 'ID Karyawan sudah dipakai' }, { status: 409 });
      }
    }
    const hash = await bcrypt.hash(parsed.data.password, 10);
    const created = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        password: hash,
        phone: parsed.data.phone ?? null,
        positionId: parsed.data.positionId ?? null,
        department: parsed.data.department ?? null,
        employmentStatus: parsed.data.employmentStatus?.trim() || null,
        spvId: parsed.data.spvId ?? null,
        employeeId,
        isSuperAdmin: parsed.data.isSuperAdmin ?? false,
        isApprovalAdmin: parsed.data.isApprovalAdmin ?? positionDefault.isApprovalAdmin ?? false,
        joinDate: parsed.data.joinDate ? new Date(parsed.data.joinDate) : null,
      },
      select: { id: true, employeeId: true, email: true, name: true, isSuperAdmin: true, isApprovalAdmin: true },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal membuat akun' }, { status: 500 });
  }
}

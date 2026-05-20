import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageUsers } from '@/lib/permissions';
import { userUpdateSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/users/[id] — partially updates a user account.
// Requires super-admin role. Validates for self-SPV, duplicate email, and duplicate employee ID.
// An empty password field means "do not change the password".
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageUsers(session.user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Validasi gagal' },
        { status: 400 }
      );
    }
    const p = parsed.data;
    const data: Record<string, unknown> = { ...p };

    // Hash the new password if provided; otherwise remove it from the update payload.
    if (p.password) {
      data.password = await bcrypt.hash(p.password, 10);
    } else {
      delete data.password;
    }

    // Prevent a user from being set as their own supervisor.
    if (data.spvId === id) {
      return NextResponse.json({ success: false, error: 'User tidak bisa menjadi SPV dirinya sendiri' }, { status: 400 });
    }

    // Guard against email collision with another account.
    if (p.email) {
      const dup = await prisma.user.findFirst({
        where: { email: p.email, NOT: { id } },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json({ success: false, error: 'Email sudah dipakai' }, { status: 409 });
      }
    }

    // Guard against employee ID collision with another account.
    if (Object.prototype.hasOwnProperty.call(data, 'employeeId')) {
      const eid = (data.employeeId as string | null | undefined)?.trim() || null;
      if (eid) {
        const dup = await prisma.user.findFirst({
          where: { employeeId: eid, NOT: { id } },
          select: { id: true },
        });
        if (dup) {
          return NextResponse.json({ success: false, error: 'ID Karyawan sudah dipakai' }, { status: 409 });
        }
      }
      data.employeeId = eid;
    }

    // Normalize employmentStatus: trim whitespace, treat empty as null.
    if (Object.prototype.hasOwnProperty.call(data, 'employmentStatus')) {
      const es = (data.employmentStatus as string | null | undefined);
      data.employmentStatus = es && es.trim() ? es.trim() : null;
    }

    // Convert ISO date strings to Date objects for Prisma.
    if (Object.prototype.hasOwnProperty.call(data, 'birthdate')) {
      data.birthdate = p.birthdate ? new Date(p.birthdate) : null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'passportExpiry')) {
      data.passportExpiry = p.passportExpiry ? new Date(p.passportExpiry) : null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'joinDate')) {
      data.joinDate = p.joinDate ? new Date(p.joinDate) : null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, employeeId: true, email: true, name: true, isSuperAdmin: true, isApprovalAdmin: true },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal memperbarui akun' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — deletes a user account.
// Requires super-admin role. Prevents:
//   - Self-deletion
//   - Deletion of accounts with existing requests (data integrity)
//   - Deletion of accounts that still have subordinates (must reassign first)
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageUsers(session.user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await ctx.params;
    if (id === session.user.id) {
      return NextResponse.json({ success: false, error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 });
    }
    // Check for referential integrity — cannot delete if requests exist.
    const [ot, rb, trip, subordinates] = await Promise.all([
      prisma.overtimeRequest.count({ where: { userId: id } }),
      prisma.reimbursementRequest.count({ where: { userId: id } }),
      prisma.businessTripRequest.count({ where: { userId: id } }),
      prisma.user.count({ where: { spvId: id } }),
    ]);
    if (ot + rb + trip > 0) {
      return NextResponse.json(
        { success: false, error: 'Akun memiliki pengajuan — tidak bisa dihapus' },
        { status: 400 }
      );
    }
    if (subordinates > 0) {
      return NextResponse.json(
        { success: false, error: `Masih ada ${subordinates} bawahan — pindahkan dulu ke SPV lain` },
        { status: 400 }
      );
    }
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true, data: { id } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal menghapus akun' }, { status: 500 });
  }
}

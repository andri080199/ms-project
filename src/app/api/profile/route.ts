import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { profileUpdateSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

// Fields returned by both GET and PATCH for the current user's profile.
const SELECT = {
  id: true,
  employeeId: true,
  email: true,
  name: true,
  isSuperAdmin: true,
  isApprovalAdmin: true,
  phone: true,
  department: true,
  position: { select: { id: true, name: true } },
  additionalPhone: true,
  placeOfBirth: true,
  birthdate: true,
  gender: true,
  maritalStatus: true,
  bloodType: true,
  religion: true,
  nik: true,
  idAddress: true,
  postalCode: true,
  residentialAddress: true,
  passportNumber: true,
  passportExpiry: true,
  joinDate: true,
  // Used by Sidebar/MobileBottomNav to know if this user has subordinates.
  _count: { select: { subordinates: true } },
} as const;

// GET /api/profile — returns the authenticated user's full profile.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const data = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: SELECT,
    });
    if (!data) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil profil' }, { status: 500 });
  }
}

// PATCH /api/profile — updates the authenticated user's own profile.
// Restricted to super admins only (regular users cannot self-edit sensitive fields).
// Validates for duplicate email and employee ID before saving.
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.user.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Hanya super admin yang bisa mengubah profil' },
        { status: 403 }
      );
    }
    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Validasi gagal' },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const uid = session.user.id;

    // Guard against email collision with another account.
    if (d.email) {
      const dup = await prisma.user.findFirst({
        where: { email: d.email, NOT: { id: uid } },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json({ success: false, error: 'Email sudah dipakai' }, { status: 409 });
      }
    }

    // Guard against employee ID collision with another account.
    const eid = d.employeeId?.trim() || null;
    if (eid) {
      const dup = await prisma.user.findFirst({
        where: { employeeId: eid, NOT: { id: uid } },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json({ success: false, error: 'ID Karyawan sudah dipakai' }, { status: 409 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: uid },
      data: {
        name: d.name,
        ...(d.email !== undefined ? { email: d.email } : {}),
        employeeId: eid,
        phone: d.phone ?? null,
        additionalPhone: d.additionalPhone ?? null,
        placeOfBirth: d.placeOfBirth ?? null,
        birthdate: d.birthdate ? new Date(d.birthdate) : null,
        gender: d.gender ?? null,
        maritalStatus: d.maritalStatus ?? null,
        bloodType: d.bloodType ?? null,
        religion: d.religion ?? null,
        nik: d.nik ?? null,
        idAddress: d.idAddress ?? null,
        postalCode: d.postalCode ?? null,
        residentialAddress: d.residentialAddress ?? null,
        passportNumber: d.passportNumber ?? null,
        passportExpiry: d.passportExpiry ? new Date(d.passportExpiry) : null,
        joinDate: d.joinDate ? new Date(d.joinDate) : null,
      },
      select: SELECT,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal memperbarui profil' }, { status: 500 });
  }
}

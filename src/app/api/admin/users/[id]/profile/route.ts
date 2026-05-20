import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Fields returned for the admin profile view — excludes sensitive fields like password.
const PROFILE_SELECT = {
  id: true,
  employeeId: true,
  email: true,
  name: true,
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
} as const;

// Shared auth guard: requires an authenticated super admin. Returns a pre-built error response
// on failure so handlers can do a single early-return check.
async function guard() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null as never,
      fail: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (!session.user.isSuperAdmin) {
    return {
      session: null as never,
      fail: NextResponse.json(
        { success: false, error: 'Hanya super admin yang bisa mengubah profil karyawan' },
        { status: 403 }
      ),
    };
  }
  return { session, fail: null };
}

// Returns the full profile of any employee. Super-admin only.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { fail } = await guard();
    if (fail) return fail;
    const { id } = await ctx.params;
    const data = await prisma.user.findUnique({ where: { id }, select: PROFILE_SELECT });
    if (!data) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil profil' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PROFILE_SELECT = {
  id: true,
  employeeId: true,
  email: true,
  name: true,
  role: true,
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
} as const;

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


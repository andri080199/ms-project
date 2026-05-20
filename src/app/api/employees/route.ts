import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/employees — returns the public employee directory.
// All authenticated users can access this; it excludes sensitive fields like
// password, NIK, and address to keep it safe for the broad directory view.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const data = await prisma.user.findMany({
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        phone: true,
        department: true,
        employmentStatus: true,
        position: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data karyawan' }, { status: 500 });
  }
}

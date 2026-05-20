import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Returns all users marked as approval admins, excluding the caller themselves.
// Used by the reimbursement form to populate the approver picker and by
// the admin user form when assigning a reimbursement approver.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const data = await prisma.user.findMany({
      where: {
        isApprovalAdmin: true,
        // Exclude the caller to prevent someone from routing their own reimbursement to themselves.
        id: { not: session.user.id },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        position: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil daftar approval admin' }, { status: 500 });
  }
}

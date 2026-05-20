import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Returns a single reimbursement request with line items and full approval history.
// Viewable by: the request owner, the assigned approver, or any super admin.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await ctx.params;
    const item = await prisma.reimbursementRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, department: true, position: { select: { name: true } } } },
        approver: { select: { id: true, name: true, email: true, department: true, position: { select: { name: true } } } },
        items: true,
        approvals: {
          include: { approver: { select: { id: true, name: true, email: true, department: true, position: { select: { name: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });

    const isOwner = item.userId === session.user.id;
    // Unlike overtime/leave, the access check uses the designated approver rather than the SPV.
    const isChosenApprover = item.approverId === session.user.id;
    const canView = isOwner || !!session.user.isSuperAdmin || isChosenApprover;
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ success: true, data: item });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil detail' }, { status: 500 });
  }
}

// Cancels a reimbursement request by marking it CANCELLED.
// Only SUBMITTED or DRAFT requests can be cancelled.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await ctx.params;
    const item = await prisma.reimbursementRequest.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });
    if (item.userId !== session.user.id && !session.user.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (item.status !== 'SUBMITTED' && item.status !== 'DRAFT') {
      return NextResponse.json({ success: false, error: 'Hanya pengajuan SUBMITTED yang bisa dibatalkan' }, { status: 400 });
    }
    await prisma.reimbursementRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
    return NextResponse.json({ success: true, data: { id } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal membatalkan' }, { status: 500 });
  }
}

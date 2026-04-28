import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canSeeApprovalsInbox } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = session.user.role;
    const isSuperAdmin = !!session.user.isSuperAdmin;
    if (!canSeeApprovalsInbox(session.user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') === 'history' ? 'history' : 'pending';

    const userSelect = { id: true, name: true, email: true, role: true, department: true } as const;

    if (tab === 'pending') {
      const isSpv = role === 'SPV' && !isSuperAdmin;
      const isHrOrAdmin = role === 'HR' || role === 'ADMIN' || isSuperAdmin;

      const [overtimes, trips, reimbursements, leaves] = await Promise.all([
        prisma.overtimeRequest.findMany({
          where: isHrOrAdmin
            ? { status: 'SPV_APPROVED' }
            : isSpv
            ? { status: 'SUBMITTED', user: { spvId: session.user.id } }
            : { id: '__none__' },
          include: { user: { select: userSelect } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.businessTripRequest.findMany({
          where: isHrOrAdmin
            ? { status: 'SPV_APPROVED' }
            : isSpv
            ? { status: 'SUBMITTED', user: { spvId: session.user.id } }
            : { id: '__none__' },
          include: { user: { select: userSelect } },
          orderBy: { createdAt: 'desc' },
        }),
        isHrOrAdmin
          ? prisma.reimbursementRequest.findMany({
              where: { status: 'SUBMITTED' },
              include: { user: { select: userSelect }, items: true },
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),
        // Cuti: hanya SPV/ADMIN yang jadi atasan langsung yang melihat. HR tidak terlibat.
        isSpv
          ? prisma.leaveRequest.findMany({
              where: { status: 'SUBMITTED', user: { spvId: session.user.id } },
              include: { user: { select: userSelect } },
              orderBy: { createdAt: 'desc' },
            })
          : role === 'ADMIN'
          ? prisma.leaveRequest.findMany({
              where: { status: 'SUBMITTED', user: { spvId: session.user.id } },
              include: { user: { select: userSelect } },
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),
      ]);

      return NextResponse.json({ success: true, data: { overtimes, trips, reimbursements, leaves } });
    }

    // history — things this user has acted on
    const history = await prisma.approvalHistory.findMany({
      where: { approverId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        overtime: { include: { user: { select: userSelect } } },
        reimbursement: { include: { user: { select: userSelect }, items: true } },
        trip: { include: { user: { select: userSelect } } },
        leave: { include: { user: { select: userSelect } } },
        approver: { select: userSelect },
      },
    });
    return NextResponse.json({ success: true, data: { history } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil approvals' }, { status: 500 });
  }
}

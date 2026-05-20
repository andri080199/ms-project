import { NextResponse } from 'next/server';
import type { RequestStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/approvals?tab=pending|history
//
// Returns approval inbox data for the authenticated user.
//
// Tab "pending":
//   - Overtime/Trip (2-step): SUBMITTED → visible to the submitter's SPV;
//     SPV_APPROVED → visible to all approval admins.
//   - Reimbursement (1-step): SUBMITTED → visible to the chosen approver (or any super admin).
//   - Leave (1-step): SUBMITTED → visible to the submitter's SPV only.
//
// Tab "history":
//   - Super admins see all decisions; others see only their own decisions.
//   - Capped at the 100 most recent entries.
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') === 'history' ? 'history' : 'pending';

    // Shared Prisma select shapes reused across request types.
    const userSelect = {
      id: true,
      name: true,
      email: true,
      department: true,
      position: { select: { name: true } },
    } as const;
    const approverSelect = {
      id: true,
      name: true,
      email: true,
      department: true,
      position: { select: { name: true } },
    } as const;
    const approvalsInclude = {
      include: { approver: { select: approverSelect } },
      orderBy: { createdAt: 'asc' as const },
    };

    if (tab === 'pending') {
      const me = session.user.id;
      const isSuperAdmin = !!session.user.isSuperAdmin;
      const isApprovalAdmin = !!session.user.isApprovalAdmin;

      // OT / Trip — 2-step flow:
      // SUBMITTED  → only the submitter's SPV sees it
      // SPV_APPROVED → only approval admins see it
      // Super admin does NOT auto-see all — they must be a real SPV or approval admin.
      const twoStepWhere = isApprovalAdmin
        ? {
            OR: [
              { status: 'SUBMITTED' as RequestStatus, user: { spvId: me } },
              { status: 'SPV_APPROVED' as RequestStatus },
            ],
          }
        : { status: 'SUBMITTED' as RequestStatus, user: { spvId: me } };

      // Reimbursement — 1-step: submitter picks the approver; super admin sees all.
      const reimbursementWhere = isSuperAdmin
        ? { status: 'SUBMITTED' as RequestStatus }
        : { status: 'SUBMITTED' as RequestStatus, approverId: me };

      // Leave — 1-step: only the SPV sees it.
      const leaveWhere = { status: 'SUBMITTED' as RequestStatus, user: { spvId: me } };

      const [overtimes, trips, reimbursements, leaves] = await Promise.all([
        prisma.overtimeRequest.findMany({
          where: twoStepWhere,
          include: { user: { select: userSelect }, approvals: approvalsInclude },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.businessTripRequest.findMany({
          where: twoStepWhere,
          include: { user: { select: userSelect }, approvals: approvalsInclude },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.reimbursementRequest.findMany({
          where: reimbursementWhere,
          include: {
            user: { select: userSelect },
            approver: { select: userSelect },
            items: true,
            approvals: approvalsInclude,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.leaveRequest.findMany({
          where: leaveWhere,
          include: { user: { select: userSelect }, approvals: approvalsInclude },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return NextResponse.json({ success: true, data: { overtimes, trips, reimbursements, leaves } });
    }

    // History tab: super admin sees all; others see only their own decisions.
    const history = await prisma.approvalHistory.findMany({
      where: session.user.isSuperAdmin ? {} : { approverId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        overtime: { include: { user: { select: userSelect }, approvals: approvalsInclude } },
        reimbursement: {
          include: { user: { select: userSelect }, items: true, approvals: approvalsInclude },
        },
        trip: { include: { user: { select: userSelect }, approvals: approvalsInclude } },
        leave: { include: { user: { select: userSelect }, approvals: approvalsInclude } },
        approver: { select: approverSelect },
      },
    });
    return NextResponse.json({ success: true, data: { history } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil approvals' }, { status: 500 });
  }
}

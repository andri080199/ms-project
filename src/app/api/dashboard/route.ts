import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/dashboard
// Returns summary statistics and recent activity for the authenticated user's
// dashboard. All counts and the recent activity list are scoped to the current
// calendar month (server time), except the pending count which is all-time.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Run all DB queries in parallel for performance.
    const [pendingOt, pendingRb, pendingTrip, approvedOt, approvedRb, approvedTrip, rejectedOt, rejectedRb, rejectedTrip, rbThisMonth, recentOt, recentRb, recentTrip] =
      await Promise.all([
        // Pending counts (all-time, any in-progress status)
        prisma.overtimeRequest.count({ where: { userId, status: { in: ['SUBMITTED', 'SPV_APPROVED'] } } }),
        prisma.reimbursementRequest.count({ where: { userId, status: 'SUBMITTED' } }),
        prisma.businessTripRequest.count({ where: { userId, status: { in: ['SUBMITTED', 'SPV_APPROVED'] } } }),
        // Approved this month
        prisma.overtimeRequest.count({ where: { userId, status: 'DONE', hrApprovedAt: { gte: monthStart, lt: monthEnd } } }),
        prisma.reimbursementRequest.count({ where: { userId, status: 'DONE', hrApprovedAt: { gte: monthStart, lt: monthEnd } } }),
        prisma.businessTripRequest.count({ where: { userId, status: 'DONE', hrApprovedAt: { gte: monthStart, lt: monthEnd } } }),
        // Rejected this month
        prisma.overtimeRequest.count({ where: { userId, status: 'REJECTED', updatedAt: { gte: monthStart, lt: monthEnd } } }),
        prisma.reimbursementRequest.count({ where: { userId, status: 'REJECTED', updatedAt: { gte: monthStart, lt: monthEnd } } }),
        prisma.businessTripRequest.count({ where: { userId, status: 'REJECTED', updatedAt: { gte: monthStart, lt: monthEnd } } }),
        // Total reimbursement amount approved this month
        prisma.reimbursementRequest.aggregate({
          where: { userId, status: 'DONE', hrApprovedAt: { gte: monthStart, lt: monthEnd } },
          _sum: { totalAmount: true },
        }),
        // Last 5 of each request type for the activity feed
        prisma.overtimeRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 }),
        prisma.reimbursementRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5, include: { items: true } }),
        prisma.businessTripRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 }),
      ]);

    // Merge and sort all recent requests into a unified activity feed, capped at 10.
    const activity = [
      ...recentOt.map((r) => ({ kind: 'overtime' as const, id: r.id, title: 'Lembur', subtitle: r.reason, status: r.status, createdAt: r.createdAt })),
      ...recentRb.map((r) => ({ kind: 'reimbursement' as const, id: r.id, title: 'Reimbursement', subtitle: `${r.items.length} item`, status: r.status, createdAt: r.createdAt })),
      ...recentTrip.map((r) => ({ kind: 'business-trip' as const, id: r.id, title: 'Perjalanan Dinas', subtitle: r.destination, status: r.status, createdAt: r.createdAt })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        pending: pendingOt + pendingRb + pendingTrip,
        approvedThisMonth: approvedOt + approvedRb + approvedTrip,
        rejectedThisMonth: rejectedOt + rejectedRb + rejectedTrip,
        reimbursementTotalThisMonth: rbThisMonth._sum.totalAmount ?? 0,
        activity,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data dashboard' }, { status: 500 });
  }
}

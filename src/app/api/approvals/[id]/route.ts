import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { approvalActionSchema } from '@/lib/schemas';
import { notifyDecisionToSubmitter, notifyEscalatedToApprovalAdmins } from '@/lib/notifications';
import { formatDate, formatRupiah, formatTime, minutesToReadable } from '@/lib/utils';
import { LEAVE_TYPE_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Shared Prisma select for submitter fields needed by email notifications.
const submitterSelect = {
  id: true,
  name: true,
  email: true,
  spvId: true,
  department: true,
} as const;

// Builds a human-readable summary array for an overtime request (used in emails).
function overtimeSummary(o: {
  date: Date;
  startTime: Date;
  overtimeType: string;
  durationMinutes: number;
  reason: string;
}) {
  return [
    `Tanggal: ${formatDate(o.date)}`,
    `Tipe: ${o.overtimeType === 'PREMIUM_SHIFT' ? 'Premium Shift' : 'Overdays'}`,
    `Jam Mulai: ${formatTime(o.startTime)}`,
    `Durasi: ${minutesToReadable(o.durationMinutes)}`,
    `Alasan: ${o.reason}`,
  ];
}

// Builds a human-readable summary array for a business trip request.
function tripSummary(t: {
  destination: string;
  startDate: Date;
  endDate: Date;
  tripType: string;
  purpose: string;
}) {
  return [
    `Tujuan: ${t.destination}`,
    `Tanggal: ${formatDate(t.startDate)} — ${formatDate(t.endDate)}`,
    `Tipe: ${t.tripType === 'WEEKEND' ? 'Akhir Pekan' : 'Hari Kerja'}`,
    `Keperluan: ${t.purpose}`,
  ];
}

// Builds a human-readable summary array for a reimbursement request.
function reimbursementSummary(r: { totalAmount: number; itemCount: number }) {
  return [`Total: ${formatRupiah(r.totalAmount)}`, `Jumlah Item: ${r.itemCount}`];
}

// Builds a human-readable summary array for a leave request.
function leaveSummary(l: {
  leaveType: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
}) {
  return [
    `Jenis: ${LEAVE_TYPE_LABEL[l.leaveType] ?? l.leaveType}`,
    `Tanggal: ${formatDate(l.startDate)} — ${formatDate(l.endDate)}`,
    `Total Hari: ${l.totalDays} hari`,
    `Alasan: ${l.reason}`,
  ];
}

// Checks whether `me` is authorized to act on a 2-step request at its current status.
//
// 2-step flow (overtime / trip):
//   SUBMITTED    → only the submitter's SPV can act
//   SPV_APPROVED → only an approval admin can act
//
// Super admin does NOT bypass this — they must hold the SPV or approval-admin role.
function canActOnTwoStep(
  status: 'SUBMITTED' | 'SPV_APPROVED',
  submitterSpvId: string | null,
  me: string,
  isApprovalAdmin: boolean,
) {
  if (status === 'SUBMITTED') return submitterSpvId === me;
  return isApprovalAdmin;
}

// POST /api/approvals/[id]
// Processes an APPROVE or REJECT action on a pending request of any type.
// Validates authorization, updates request status, writes an ApprovalHistory record,
// and triggers email notifications — all as an atomic DB transaction.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = approvalActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Validasi gagal' },
        { status: 400 },
      );
    }
    const { type, action, comment } = parsed.data;
    const me = session.user.id;
    const myName = session.user.name ?? 'Approver';
    const isSuperAdmin = !!session.user.isSuperAdmin;
    const isApprovalAdmin = !!session.user.isApprovalAdmin;
    const decidedBy = { id: me, name: myName };
    const now = new Date();

    // ── Overtime ─────────────────────────────────────────────────────────────
    if (type === 'overtime') {
      const item = await prisma.overtimeRequest.findUnique({
        where: { id },
        include: { user: { select: submitterSelect } },
      });
      if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });
      if (item.status !== 'SUBMITTED' && item.status !== 'SPV_APPROVED') {
        return NextResponse.json({ success: false, error: `Tidak bisa memproses status ${item.status}` }, { status: 400 });
      }
      if (!canActOnTwoStep(item.status, item.user.spvId, me, isApprovalAdmin)) {
        return NextResponse.json({ success: false, error: 'Anda bukan approver untuk pengajuan ini' }, { status: 403 });
      }
      const summary = overtimeSummary(item);
      const stage = item.status === 'SUBMITTED' ? 'SPV' : 'HR';

      if (action === 'REJECT') {
        await prisma.$transaction([
          prisma.overtimeRequest.update({
            where: { id },
            data: { status: 'REJECTED', rejectedReason: comment ?? 'Ditolak' },
          }),
          prisma.approvalHistory.create({
            data: { approverId: me, stage, action: 'REJECT', overtimeId: id, comment },
          }),
        ]);
        notifyDecisionToSubmitter({ kind: 'overtime', requestId: id, submitter: item.user, summary, action, decidedBy, comment });
      } else if (item.status === 'SUBMITTED') {
        // Step 1 approve: advance to SPV_APPROVED and notify approval admins.
        await prisma.$transaction([
          prisma.overtimeRequest.update({
            where: { id },
            data: { status: 'SPV_APPROVED', spvApprovedAt: now },
          }),
          prisma.approvalHistory.create({
            data: { approverId: me, stage: 'SPV', action: 'APPROVE', overtimeId: id, comment },
          }),
        ]);
        notifyEscalatedToApprovalAdmins({ kind: 'overtime', requestId: id, submitter: item.user, summary, spvName: myName });
      } else {
        // Step 2 approve: mark as DONE and notify the submitter.
        await prisma.$transaction([
          prisma.overtimeRequest.update({
            where: { id },
            data: { status: 'DONE', hrApprovedAt: now },
          }),
          prisma.approvalHistory.create({
            data: { approverId: me, stage: 'HR', action: 'APPROVE', overtimeId: id, comment },
          }),
        ]);
        notifyDecisionToSubmitter({ kind: 'overtime', requestId: id, submitter: item.user, summary, action, decidedBy, comment });
      }
      return NextResponse.json({ success: true, data: { id } });
    }

    // ── Reimbursement ─────────────────────────────────────────────────────────
    if (type === 'reimbursement') {
      const item = await prisma.reimbursementRequest.findUnique({
        where: { id },
        include: {
          user: { select: submitterSelect },
          items: { select: { id: true } },
        },
      });
      if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });
      if (item.status !== 'SUBMITTED') {
        return NextResponse.json({ success: false, error: `Tidak bisa memproses status ${item.status}` }, { status: 400 });
      }
      // 1-step: only the chosen approver or a super admin can act.
      if (!isSuperAdmin && item.approverId !== me) {
        return NextResponse.json({ success: false, error: 'Anda bukan approver untuk reimbursement ini' }, { status: 403 });
      }
      const summary = reimbursementSummary({ totalAmount: item.totalAmount, itemCount: item.items.length });

      if (action === 'APPROVE') {
        await prisma.$transaction([
          prisma.reimbursementRequest.update({
            where: { id },
            data: { status: 'DONE', hrApprovedAt: now },
          }),
          prisma.approvalHistory.create({
            data: { approverId: me, stage: 'HR', action: 'APPROVE', reimbursementId: id, comment },
          }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.reimbursementRequest.update({
            where: { id },
            data: { status: 'REJECTED', rejectedReason: comment ?? 'Ditolak' },
          }),
          prisma.approvalHistory.create({
            data: { approverId: me, stage: 'HR', action: 'REJECT', reimbursementId: id, comment },
          }),
        ]);
      }
      notifyDecisionToSubmitter({ kind: 'reimbursement', requestId: id, submitter: item.user, summary, action, decidedBy, comment });
      return NextResponse.json({ success: true, data: { id } });
    }

    // ── Business Trip ─────────────────────────────────────────────────────────
    if (type === 'business-trip') {
      const item = await prisma.businessTripRequest.findUnique({
        where: { id },
        include: { user: { select: submitterSelect } },
      });
      if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });
      if (item.status !== 'SUBMITTED' && item.status !== 'SPV_APPROVED') {
        return NextResponse.json({ success: false, error: `Tidak bisa memproses status ${item.status}` }, { status: 400 });
      }
      if (!canActOnTwoStep(item.status, item.user.spvId, me, isApprovalAdmin)) {
        return NextResponse.json({ success: false, error: 'Anda bukan approver untuk pengajuan ini' }, { status: 403 });
      }
      const summary = tripSummary(item);
      const stage = item.status === 'SUBMITTED' ? 'SPV' : 'HR';

      if (action === 'REJECT') {
        await prisma.$transaction([
          prisma.businessTripRequest.update({
            where: { id },
            data: { status: 'REJECTED', rejectedReason: comment ?? 'Ditolak' },
          }),
          prisma.approvalHistory.create({
            data: { approverId: me, stage, action: 'REJECT', tripId: id, comment },
          }),
        ]);
        notifyDecisionToSubmitter({ kind: 'business-trip', requestId: id, submitter: item.user, summary, action, decidedBy, comment });
      } else if (item.status === 'SUBMITTED') {
        // Step 1 approve: advance to SPV_APPROVED.
        await prisma.$transaction([
          prisma.businessTripRequest.update({
            where: { id },
            data: { status: 'SPV_APPROVED', spvApprovedAt: now },
          }),
          prisma.approvalHistory.create({
            data: { approverId: me, stage: 'SPV', action: 'APPROVE', tripId: id, comment },
          }),
        ]);
        notifyEscalatedToApprovalAdmins({ kind: 'business-trip', requestId: id, submitter: item.user, summary, spvName: myName });
      } else {
        // Step 2 approve: mark as DONE.
        await prisma.$transaction([
          prisma.businessTripRequest.update({
            where: { id },
            data: { status: 'DONE', hrApprovedAt: now },
          }),
          prisma.approvalHistory.create({
            data: { approverId: me, stage: 'HR', action: 'APPROVE', tripId: id, comment },
          }),
        ]);
        notifyDecisionToSubmitter({ kind: 'business-trip', requestId: id, submitter: item.user, summary, action, decidedBy, comment });
      }
      return NextResponse.json({ success: true, data: { id } });
    }

    // ── Leave ─────────────────────────────────────────────────────────────────
    if (type === 'leave') {
      const item = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { user: { select: submitterSelect } },
      });
      if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });
      if (item.status !== 'SUBMITTED') {
        return NextResponse.json({ success: false, error: `Tidak bisa memproses status ${item.status}` }, { status: 400 });
      }
      // Leave is 1-step: only the direct SPV can approve — no escalation.
      if (item.user.spvId !== me) {
        return NextResponse.json({ success: false, error: 'Anda bukan approver untuk pengajuan ini' }, { status: 403 });
      }
      const summary = leaveSummary(item);

      if (action === 'REJECT') {
        await prisma.$transaction([
          prisma.leaveRequest.update({
            where: { id },
            data: { status: 'REJECTED', rejectedReason: comment ?? 'Ditolak' },
          }),
          prisma.approvalHistory.create({
            data: { approverId: me, stage: 'SPV', action: 'REJECT', leaveId: id, comment },
          }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.leaveRequest.update({
            where: { id },
            data: { status: 'DONE', spvApprovedAt: now },
          }),
          prisma.approvalHistory.create({
            data: { approverId: me, stage: 'SPV', action: 'APPROVE', leaveId: id, comment },
          }),
        ]);
      }
      notifyDecisionToSubmitter({ kind: 'leave', requestId: id, submitter: item.user, summary, action, decidedBy, comment });
      return NextResponse.json({ success: true, data: { id } });
    }

    return NextResponse.json({ success: false, error: 'Type tidak dikenal' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal memproses approval' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { approvalActionSchema } from '@/lib/schemas';
import { canApproveAsHr, canApproveAsSpv } from '@/lib/permissions';
import { notifyDecisionToSubmitter } from '@/lib/notifications';
import { formatDate, formatRupiah, formatTime, minutesToReadable } from '@/lib/utils';
import { LEAVE_TYPE_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

const submitterSelect = {
  id: true,
  name: true,
  email: true,
  spvId: true,
  department: true,
} as const;

function overtimeSummary(o: {
  date: Date;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  reason: string;
}) {
  return [
    `Tanggal: ${formatDate(o.date)}`,
    `Jam: ${formatTime(o.startTime)} — ${formatTime(o.endTime)}`,
    `Durasi: ${minutesToReadable(o.durationMinutes)}`,
    `Alasan: ${o.reason}`,
  ];
}

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

function reimbursementSummary(r: { totalAmount: number; itemCount: number }) {
  return [`Total: ${formatRupiah(r.totalAmount)}`, `Jumlah Item: ${r.itemCount}`];
}

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
        { status: 400 }
      );
    }
    const { type, action, comment } = parsed.data;
    const role = session.user.role;
    const approverId = session.user.id;
    const approverName = session.user.name ?? 'Approver';
    const decidedBy = { id: approverId, name: approverName };
    const now = new Date();

    if (type === 'overtime') {
      const item = await prisma.overtimeRequest.findUnique({
        where: { id },
        include: { user: { select: submitterSelect } },
      });
      if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });

      const summary = overtimeSummary(item);

      if (item.status === 'SUBMITTED') {
        if (!canApproveAsSpv(session.user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        if (role === 'SPV' && item.user.spvId !== approverId) {
          return NextResponse.json({ success: false, error: 'Bukan direct report Anda' }, { status: 403 });
        }
        if (action === 'APPROVE') {
          await prisma.$transaction([
            prisma.overtimeRequest.update({
              where: { id },
              data: { status: 'SPV_APPROVED', spvApprovedAt: now },
            }),
            prisma.approvalHistory.create({
              data: { approverId, stage: 'SPV', action: 'APPROVE', overtimeId: id, comment },
            }),
          ]);
          notifyDecisionToSubmitter({
            kind: 'overtime',
            requestId: id,
            submitter: item.user,
            summary,
            action: 'APPROVE',
            stage: 'SPV',
            decidedBy,
            comment,
            isFinalApproval: false,
          });
        } else {
          await prisma.$transaction([
            prisma.overtimeRequest.update({
              where: { id },
              data: { status: 'REJECTED', rejectedReason: comment ?? 'Ditolak oleh SPV' },
            }),
            prisma.approvalHistory.create({
              data: { approverId, stage: 'SPV', action: 'REJECT', overtimeId: id, comment },
            }),
          ]);
          notifyDecisionToSubmitter({
            kind: 'overtime',
            requestId: id,
            submitter: item.user,
            summary,
            action: 'REJECT',
            stage: 'SPV',
            decidedBy,
            comment,
            isFinalApproval: false,
          });
        }
      } else if (item.status === 'SPV_APPROVED') {
        if (!canApproveAsHr(session.user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        if (action === 'APPROVE') {
          await prisma.$transaction([
            prisma.overtimeRequest.update({
              where: { id },
              data: { status: 'DONE', hrApprovedAt: now },
            }),
            prisma.approvalHistory.create({
              data: { approverId, stage: 'HR', action: 'APPROVE', overtimeId: id, comment },
            }),
          ]);
          notifyDecisionToSubmitter({
            kind: 'overtime',
            requestId: id,
            submitter: item.user,
            summary,
            action: 'APPROVE',
            stage: 'HR',
            decidedBy,
            comment,
            isFinalApproval: true,
          });
        } else {
          await prisma.$transaction([
            prisma.overtimeRequest.update({
              where: { id },
              data: { status: 'REJECTED', rejectedReason: comment ?? 'Ditolak oleh HR' },
            }),
            prisma.approvalHistory.create({
              data: { approverId, stage: 'HR', action: 'REJECT', overtimeId: id, comment },
            }),
          ]);
          notifyDecisionToSubmitter({
            kind: 'overtime',
            requestId: id,
            submitter: item.user,
            summary,
            action: 'REJECT',
            stage: 'HR',
            decidedBy,
            comment,
            isFinalApproval: false,
          });
        }
      } else {
        return NextResponse.json({ success: false, error: `Tidak bisa memproses status ${item.status}` }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: { id } });
    }

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
      if (!canApproveAsHr(session.user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

      const summary = reimbursementSummary({ totalAmount: item.totalAmount, itemCount: item.items.length });

      if (action === 'APPROVE') {
        await prisma.$transaction([
          prisma.reimbursementRequest.update({
            where: { id },
            data: { status: 'DONE', hrApprovedAt: now },
          }),
          prisma.approvalHistory.create({
            data: { approverId, stage: 'HR', action: 'APPROVE', reimbursementId: id, comment },
          }),
        ]);
        notifyDecisionToSubmitter({
          kind: 'reimbursement',
          requestId: id,
          submitter: item.user,
          summary,
          action: 'APPROVE',
          stage: 'HR',
          decidedBy,
          comment,
          isFinalApproval: true,
        });
      } else {
        await prisma.$transaction([
          prisma.reimbursementRequest.update({
            where: { id },
            data: { status: 'REJECTED', rejectedReason: comment ?? 'Ditolak oleh HR' },
          }),
          prisma.approvalHistory.create({
            data: { approverId, stage: 'HR', action: 'REJECT', reimbursementId: id, comment },
          }),
        ]);
        notifyDecisionToSubmitter({
          kind: 'reimbursement',
          requestId: id,
          submitter: item.user,
          summary,
          action: 'REJECT',
          stage: 'HR',
          decidedBy,
          comment,
          isFinalApproval: false,
        });
      }
      return NextResponse.json({ success: true, data: { id } });
    }

    if (type === 'business-trip') {
      const item = await prisma.businessTripRequest.findUnique({
        where: { id },
        include: { user: { select: submitterSelect } },
      });
      if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });

      const summary = tripSummary(item);

      if (item.status === 'SUBMITTED') {
        if (!canApproveAsSpv(session.user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        if (role === 'SPV' && item.user.spvId !== approverId) {
          return NextResponse.json({ success: false, error: 'Bukan direct report Anda' }, { status: 403 });
        }
        if (action === 'APPROVE') {
          await prisma.$transaction([
            prisma.businessTripRequest.update({
              where: { id },
              data: { status: 'SPV_APPROVED', spvApprovedAt: now },
            }),
            prisma.approvalHistory.create({
              data: { approverId, stage: 'SPV', action: 'APPROVE', tripId: id, comment },
            }),
          ]);
          notifyDecisionToSubmitter({
            kind: 'business-trip',
            requestId: id,
            submitter: item.user,
            summary,
            action: 'APPROVE',
            stage: 'SPV',
            decidedBy,
            comment,
            isFinalApproval: false,
          });
        } else {
          await prisma.$transaction([
            prisma.businessTripRequest.update({
              where: { id },
              data: { status: 'REJECTED', rejectedReason: comment ?? 'Ditolak oleh SPV' },
            }),
            prisma.approvalHistory.create({
              data: { approverId, stage: 'SPV', action: 'REJECT', tripId: id, comment },
            }),
          ]);
          notifyDecisionToSubmitter({
            kind: 'business-trip',
            requestId: id,
            submitter: item.user,
            summary,
            action: 'REJECT',
            stage: 'SPV',
            decidedBy,
            comment,
            isFinalApproval: false,
          });
        }
      } else if (item.status === 'SPV_APPROVED') {
        if (!canApproveAsHr(session.user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        if (action === 'APPROVE') {
          await prisma.$transaction([
            prisma.businessTripRequest.update({
              where: { id },
              data: { status: 'DONE', hrApprovedAt: now },
            }),
            prisma.approvalHistory.create({
              data: { approverId, stage: 'HR', action: 'APPROVE', tripId: id, comment },
            }),
          ]);
          notifyDecisionToSubmitter({
            kind: 'business-trip',
            requestId: id,
            submitter: item.user,
            summary,
            action: 'APPROVE',
            stage: 'HR',
            decidedBy,
            comment,
            isFinalApproval: true,
          });
        } else {
          await prisma.$transaction([
            prisma.businessTripRequest.update({
              where: { id },
              data: { status: 'REJECTED', rejectedReason: comment ?? 'Ditolak oleh HR' },
            }),
            prisma.approvalHistory.create({
              data: { approverId, stage: 'HR', action: 'REJECT', tripId: id, comment },
            }),
          ]);
          notifyDecisionToSubmitter({
            kind: 'business-trip',
            requestId: id,
            submitter: item.user,
            summary,
            action: 'REJECT',
            stage: 'HR',
            decidedBy,
            comment,
            isFinalApproval: false,
          });
        }
      } else {
        return NextResponse.json({ success: false, error: `Tidak bisa memproses status ${item.status}` }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: { id } });
    }

    if (type === 'leave') {
      const item = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { user: { select: submitterSelect } },
      });
      if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });
      if (item.status !== 'SUBMITTED') {
        return NextResponse.json({ success: false, error: `Tidak bisa memproses status ${item.status}` }, { status: 400 });
      }
      if (!canApproveAsSpv(session.user)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      if (role === 'SPV' && item.user.spvId !== approverId) {
        return NextResponse.json({ success: false, error: 'Bukan direct report Anda' }, { status: 403 });
      }

      const summary = leaveSummary(item);

      if (action === 'APPROVE') {
        await prisma.$transaction([
          prisma.leaveRequest.update({
            where: { id },
            data: { status: 'DONE', spvApprovedAt: now },
          }),
          prisma.approvalHistory.create({
            data: { approverId, stage: 'SPV', action: 'APPROVE', leaveId: id, comment },
          }),
        ]);
        notifyDecisionToSubmitter({
          kind: 'leave',
          requestId: id,
          submitter: item.user,
          summary,
          action: 'APPROVE',
          stage: 'SPV',
          decidedBy,
          comment,
          isFinalApproval: true,
        });
      } else {
        await prisma.$transaction([
          prisma.leaveRequest.update({
            where: { id },
            data: { status: 'REJECTED', rejectedReason: comment ?? 'Ditolak oleh SPV' },
          }),
          prisma.approvalHistory.create({
            data: { approverId, stage: 'SPV', action: 'REJECT', leaveId: id, comment },
          }),
        ]);
        notifyDecisionToSubmitter({
          kind: 'leave',
          requestId: id,
          submitter: item.user,
          summary,
          action: 'REJECT',
          stage: 'SPV',
          decidedBy,
          comment,
          isFinalApproval: false,
        });
      }
      return NextResponse.json({ success: true, data: { id } });
    }

    return NextResponse.json({ success: false, error: 'Type tidak dikenal' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal memproses approval' }, { status: 500 });
  }
}

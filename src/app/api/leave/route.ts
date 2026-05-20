import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { leaveSchema } from '@/lib/schemas';
import { notifyNewSubmission } from '@/lib/notifications';
import { formatDate } from '@/lib/utils';
import { LEAVE_TYPE_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Returns all leave requests submitted by the authenticated user, newest first.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const data = await prisma.leaveRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, department: true } } },
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data cuti' }, { status: 500 });
  }
}

// Creates a new leave request. totalDays is derived from startDate and endDate (inclusive).
// Sends an email notification to the submitter's SPV after creation.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const json = await req.json();
    const parsed = leaveSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Validasi gagal' },
        { status: 400 }
      );
    }
    const { startDate, endDate, leaveType, reason, attachmentUrl } = parsed.data;
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Inclusive day count: e.g. Mon–Wed = 3 days.
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const created = await prisma.leaveRequest.create({
      data: {
        userId: session.user.id,
        startDate: start,
        endDate: end,
        totalDays,
        leaveType,
        reason,
        attachmentUrl: attachmentUrl ?? null,
        status: 'SUBMITTED',
      },
    });

    // Re-fetch submitter to get spvId for notification routing.
    const submitter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, spvId: true, department: true },
    });
    if (submitter) {
      void notifyNewSubmission({
        kind: 'leave',
        requestId: created.id,
        submitter,
        summary: [
          `Jenis: ${LEAVE_TYPE_LABEL[created.leaveType] ?? created.leaveType}`,
          `Tanggal: ${formatDate(created.startDate)} — ${formatDate(created.endDate)}`,
          `Total Hari: ${created.totalDays} hari`,
          `Alasan: ${created.reason}`,
        ],
      });
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal membuat pengajuan cuti' }, { status: 500 });
  }
}

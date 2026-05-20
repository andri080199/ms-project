import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { overtimeSchema } from '@/lib/schemas';
import { notifyNewSubmission } from '@/lib/notifications';
import { formatDate, formatTime, minutesToReadable } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Returns all overtime requests submitted by the authenticated user, newest first.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const data = await prisma.overtimeRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, department: true } } },
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data overtime' }, { status: 500 });
  }
}

// Creates a new overtime request and fires an email notification to the submitter's SPV.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const json = await req.json();
    const parsed = overtimeSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Validasi gagal' },
        { status: 400 }
      );
    }
    const { date, startTime, overtimeType, durationMinutes, reason, attachmentUrl } = parsed.data;
    const start = new Date(startTime);

    const created = await prisma.overtimeRequest.create({
      data: {
        userId: session.user.id,
        date: new Date(date),
        startTime: start,
        // endTime is computed later by the approver or a cron job; stored as null initially.
        endTime: null,
        durationMinutes,
        overtimeType,
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
        kind: 'overtime',
        requestId: created.id,
        submitter,
        summary: [
          `Tanggal: ${formatDate(created.date)}`,
          `Tipe: ${created.overtimeType === 'PREMIUM_SHIFT' ? 'Premium Shift' : 'Overdays'}`,
          `Jam Mulai: ${formatTime(created.startTime)}`,
          `Durasi: ${minutesToReadable(created.durationMinutes)}`,
          `Alasan: ${created.reason}`,
        ],
      });
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal membuat pengajuan overtime' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { overtimeSchema } from '@/lib/schemas';
import { notifyNewSubmission } from '@/lib/notifications';
import { formatDate, formatTime, minutesToReadable } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const data = await prisma.overtimeRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, role: true, department: true } } },
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data overtime' }, { status: 500 });
  }
}

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
    const { date, startTime, endTime, reason, attachmentUrl } = parsed.data;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

    const created = await prisma.overtimeRequest.create({
      data: {
        userId: session.user.id,
        date: new Date(date),
        startTime: start,
        endTime: end,
        durationMinutes,
        reason,
        attachmentUrl: attachmentUrl ?? null,
        status: 'SUBMITTED',
      },
    });

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
          `Jam: ${formatTime(created.startTime)} — ${formatTime(created.endTime)}`,
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

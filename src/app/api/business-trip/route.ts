import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { businessTripSchema } from '@/lib/schemas';
import { notifyNewSubmission } from '@/lib/notifications';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const data = await prisma.businessTripRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, role: true, department: true } } },
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data perjalanan dinas' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const json = await req.json();
    const parsed = businessTripSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Validasi gagal' },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const created = await prisma.businessTripRequest.create({
      data: {
        userId: session.user.id,
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
        destination: d.destination,
        purpose: d.purpose,
        tripType: d.tripType,
        attachmentUrl: d.attachmentUrl ?? null,
        status: 'SUBMITTED',
      },
    });

    const submitter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, spvId: true, department: true },
    });
    if (submitter) {
      void notifyNewSubmission({
        kind: 'business-trip',
        requestId: created.id,
        submitter,
        summary: [
          `Tujuan: ${created.destination}`,
          `Tanggal: ${formatDate(created.startDate)} — ${formatDate(created.endDate)}`,
          `Tipe: ${created.tripType === 'WEEKEND' ? 'Akhir Pekan' : 'Hari Kerja'}`,
          `Keperluan: ${created.purpose}`,
        ],
      });
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal membuat pengajuan perjalanan dinas' }, { status: 500 });
  }
}

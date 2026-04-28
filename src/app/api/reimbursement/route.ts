import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { reimbursementSchema } from '@/lib/schemas';
import { notifyNewSubmission } from '@/lib/notifications';
import { formatRupiah } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const data = await prisma.reimbursementRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, role: true, department: true } },
      },
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data reimbursement' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const json = await req.json();
    const parsed = reimbursementSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Validasi gagal' },
        { status: 400 }
      );
    }
    const totalAmount = parsed.data.items.reduce((a, b) => a + b.amount, 0);

    const created = await prisma.reimbursementRequest.create({
      data: {
        userId: session.user.id,
        totalAmount,
        status: 'SUBMITTED',
        items: {
          create: parsed.data.items.map((it) => ({
            category: it.category,
            amount: it.amount,
            transactionDate: new Date(it.transactionDate),
            description: it.description,
            receiptUrl: it.receiptUrl,
          })),
        },
      },
      include: { items: true },
    });

    const submitter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, spvId: true, department: true },
    });
    if (submitter) {
      void notifyNewSubmission({
        kind: 'reimbursement',
        requestId: created.id,
        submitter,
        summary: [
          `Total: ${formatRupiah(created.totalAmount)}`,
          `Jumlah Item: ${created.items.length}`,
        ],
      });
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal membuat pengajuan reimbursement' }, { status: 500 });
  }
}

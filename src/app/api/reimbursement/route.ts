import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { reimbursementSchema } from '@/lib/schemas';
import { notifyNewSubmission } from '@/lib/notifications';
import { formatRupiah } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Returns all reimbursement requests submitted by the authenticated user, newest first.
// Includes line items, the submitter's basic info, and the assigned approver.
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
        user: { select: { id: true, name: true, email: true, department: true } },
        approver: { select: { id: true, name: true, email: true, department: true } },
      },
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data reimbursement' }, { status: 500 });
  }
}

// Creates a new reimbursement request with one or more line items.
// Reimbursement uses a single-step approval flow: an approver is assigned at creation time.
// Priority order for approver selection: People & GA Officer → any other approval admin.
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

    // Prefer a "People & GA Officer" approval admin; fall back to any other approval admin.
    const peopleGa = await prisma.user.findFirst({
      where: {
        isApprovalAdmin: true,
        id: { not: session.user.id },
        position: { name: 'People & GA Officer' },
      },
      select: { id: true },
    });
    const approver =
      peopleGa ??
      (await prisma.user.findFirst({
        where: {
          isApprovalAdmin: true,
          id: { not: session.user.id },
        },
        orderBy: { name: 'asc' },
        select: { id: true },
      }));
    if (!approver) {
      return NextResponse.json(
        { success: false, error: 'Belum ada approval admin yang tersedia. Hubungi super admin.' },
        { status: 400 },
      );
    }

    const totalAmount = parsed.data.items.reduce((a, b) => a + b.amount, 0);

    const created = await prisma.reimbursementRequest.create({
      data: {
        userId: session.user.id,
        approverId: approver.id,
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

    // Re-fetch submitter to get spvId; reimbursement notifications route to the assigned approver
    // (not the SPV) since it bypasses the two-step SPV flow.
    const submitter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, spvId: true, department: true },
    });
    if (submitter) {
      void notifyNewSubmission({
        kind: 'reimbursement',
        requestId: created.id,
        submitter,
        approverId: approver.id,
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

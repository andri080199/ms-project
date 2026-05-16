import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await ctx.params;
    const item = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, department: true, spvId: true } },
        approvals: {
          include: { approver: { select: { id: true, name: true, email: true, role: true, department: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });

    const role = session.user.role;
    const isSpvOfOwner = role === 'SPV' && item.user.spvId === session.user.id;
    const canView = item.userId === session.user.id || role === 'HR' || role === 'ADMIN' || isSpvOfOwner;
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ success: true, data: item });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil detail' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await ctx.params;
    const item = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ success: false, error: 'Tidak ditemukan' }, { status: 404 });
    if (item.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (item.status !== 'SUBMITTED' && item.status !== 'DRAFT') {
      return NextResponse.json({ success: false, error: 'Hanya pengajuan SUBMITTED yang bisa dibatalkan' }, { status: 400 });
    }
    await prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
    return NextResponse.json({ success: true, data: { id } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal membatalkan' }, { status: 500 });
  }
}

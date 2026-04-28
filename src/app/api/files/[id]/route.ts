import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await ctx.params;
    const file = await prisma.attachment.findUnique({
      where: { id },
      select: { filename: true, mimeType: true, size: true, data: true },
    });
    if (!file) {
      return NextResponse.json({ success: false, error: 'File tidak ditemukan' }, { status: 404 });
    }
    const encoded = encodeURIComponent(file.filename);
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.size),
        'Content-Disposition': `inline; filename="${file.filename}"; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal mengambil file' }, { status: 500 });
  }
}

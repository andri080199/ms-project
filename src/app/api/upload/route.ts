import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File tidak ditemukan' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Tipe file tidak didukung' }, { status: 400 });
    }
    if (file.size > MAX) {
      return NextResponse.json({ success: false, error: 'Ukuran file maksimal 5MB' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    const created = await prisma.attachment.create({
      data: {
        filename: safeName,
        mimeType: file.type,
        size: file.size,
        data: buf,
        uploaderId: session.user.id,
      },
      select: { id: true },
    });
    return NextResponse.json({
      success: true,
      data: { id: created.id, url: `/api/files/${created.id}` },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal upload file' }, { status: 500 });
  }
}

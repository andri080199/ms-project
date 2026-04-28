import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const info = await sendMail({
      to: session.user.email,
      subject: '[FIERSA] Tes Notifikasi Email',
      html: `
        <div style="font-family: -apple-system, system-ui, sans-serif; padding: 24px; background: #f8fafc;">
          <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <h2 style="margin: 0 0 8px; color: #6d28d9;">FIERSA — Tes Email ✅</h2>
            <p style="color: #475569; line-height: 1.6;">Halo <b>${session.user.name ?? 'kamu'}</b>,</p>
            <p style="color: #475569; line-height: 1.6;">Kalau kamu nerima email ini, berarti SMTP FIERSA udah jalan dengan benar. Notifikasi pengajuan otomatis siap dipasang.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
            <div style="font-size: 12px; color: #94a3b8;">Email ini dikirim otomatis dari FIERSA — jangan reply.</div>
          </div>
        </div>
      `,
    });
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (e) {
    const err = e as Error;
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

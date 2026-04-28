import nodemailer from 'nodemailer';

let cached: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cached) return cached;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error('SMTP_USER / SMTP_PASS belum di-set di .env');
  }
  cached = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return cached;
}

export type MailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail(payload: MailPayload) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  return transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}

export function fireAndForgetMail(payload: MailPayload, label: string) {
  sendMail(payload).catch((err) => {
    console.error(`[mailer:${label}] gagal kirim email`, err);
  });
}

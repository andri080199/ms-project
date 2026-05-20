import nodemailer from 'nodemailer'; // library SMTP untuk Node.js (dipakai untuk Gmail/SMTP lain)
import { Resend } from 'resend'; // library API Resend (layanan email transaksional)

// Tipe payload email yang dikirim ke semua fungsi pengiriman
export type MailPayload = {
  to: string | string[]; // satu alamat atau array alamat tujuan
  subject: string; // subjek email
  html: string; // isi email dalam format HTML
  text?: string; // isi email dalam format teks biasa (opsional, fallback untuk client yang tidak support HTML)
};

// Tipe hasil pengiriman email yang dikembalikan setelah berhasil
export type MailResult = {
  // Message ID generik dari provider — SMTP messageId atau Resend email ID.
  messageId: string;
  // Provider yang benar-benar mengirim email ini (untuk debugging/logging).
  provider: MailProvider;
};

// Union tipe provider email yang didukung
type MailProvider = 'smtp' | 'resend';

// Baca env var MAIL_PROVIDER dan kembalikan nama provider yang valid.
// Melempar error jika nilai tidak dikenal — fail fast saat startup.
function resolveProvider(): MailProvider {
  const raw = (process.env.MAIL_PROVIDER ?? 'smtp').trim().toLowerCase(); // normalisasi ke lowercase
  if (raw === 'resend') return 'resend'; // gunakan Resend API
  if (raw === 'smtp' || raw === '') return 'smtp'; // gunakan SMTP (default)
  throw new Error(`MAIL_PROVIDER tidak dikenal: "${raw}". Pakai "smtp" atau "resend".`);
}

// ── Provider SMTP (nodemailer / Gmail) ────────────────────────────────────────

// Singleton transporter SMTP — dibuat sekali dan dipakai ulang untuk semua email
let smtpTransporter: nodemailer.Transporter | null = null;

// Kembalikan (dan buat secara lazy) singleton transporter SMTP nodemailer.
// Membutuhkan env var SMTP_USER dan SMTP_PASS.
function getSmtpTransporter(): nodemailer.Transporter {
  if (smtpTransporter) return smtpTransporter; // singleton sudah ada, pakai kembali

  const user = process.env.SMTP_USER; // akun email pengirim
  const pass = process.env.SMTP_PASS; // app password (bukan password login biasa)

  if (!user || !pass) {
    throw new Error('SMTP_USER / SMTP_PASS belum di-set di .env'); // gagal jika env tidak lengkap
  }

  // Buat transporter untuk Gmail dengan autentikasi akun
  smtpTransporter = nodemailer.createTransport({
    service: 'gmail', // preset konfigurasi Gmail
    auth: { user, pass }, // kredensial akun Gmail
  });

  return smtpTransporter;
}

// Kirim email via SMTP dan kembalikan hasil pengiriman.
async function sendViaSmtp(payload: MailPayload): Promise<MailResult> {
  const transporter = getSmtpTransporter(); // ambil singleton transporter
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!; // alamat pengirim (fallback ke SMTP_USER)

  const info = await transporter.sendMail({
    from, // alamat pengirim
    to: payload.to, // alamat tujuan
    subject: payload.subject, // subjek email
    html: payload.html, // isi HTML
    text: payload.text, // isi teks biasa (opsional)
  });

  return { messageId: info.messageId, provider: 'smtp' }; // kembalikan hasil
}

// ── Provider Resend (HTTPS API) ───────────────────────────────────────────────

// Singleton client Resend API
let resendClient: Resend | null = null;

// Kembalikan (dan buat secara lazy) singleton client Resend API.
// Membutuhkan env var RESEND_API_KEY.
function getResendClient(): Resend {
  if (resendClient) return resendClient; // singleton sudah ada, pakai kembali

  const apiKey = process.env.RESEND_API_KEY; // API key dari dashboard Resend
  if (!apiKey) {
    throw new Error('RESEND_API_KEY belum di-set di .env (butuh karena MAIL_PROVIDER=resend)');
  }

  resendClient = new Resend(apiKey); // buat client dengan API key
  return resendClient;
}

// Kirim email via Resend API dan kembalikan hasil pengiriman.
// Melempar error jika Resend mengembalikan error atau tidak ada email ID.
async function sendViaResend(payload: MailPayload): Promise<MailResult> {
  const client = getResendClient(); // ambil singleton client

  const from = process.env.RESEND_FROM; // alamat pengirim terverifikasi (format: "Nama <email@domain>")
  if (!from) {
    throw new Error('RESEND_FROM belum di-set di .env (format: "Nama <email@domain-verified>")');
  }

  // Resend API selalu menerima array alamat tujuan
  const to = Array.isArray(payload.to) ? payload.to : [payload.to];

  // Kirim email via API Resend
  const { data, error } = await client.emails.send({
    from,
    to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  // Jika API Resend mengembalikan error, lempar sebagai Error
  if (error) {
    throw new Error(`Resend error: ${error.name ?? 'Unknown'} — ${error.message ?? JSON.stringify(error)}`);
  }

  // Jika tidak ada ID yang dikembalikan, ada masalah dengan konfigurasi
  if (!data?.id) {
    throw new Error('Resend tidak return email id — cek API key & format from address');
  }

  return { messageId: data.id, provider: 'resend' }; // kembalikan hasil
}

// ── Public API ────────────────────────────────────────────────────────────────

// Kirim email menggunakan provider yang dikonfigurasi via MAIL_PROVIDER.
// Melempar error jika gagal — gunakan `fireAndForgetMail` jika caller tidak boleh memblok.
export async function sendMail(payload: MailPayload): Promise<MailResult> {
  const provider = resolveProvider(); // baca konfigurasi provider
  return provider === 'resend' ? sendViaResend(payload) : sendViaSmtp(payload); // routing ke provider
}

// Helper fire-and-forget: kirim email tanpa menunggu hasilnya atau menyebarkan error.
// Error hanya di-log dengan label yang diberikan untuk keperluan debugging.
// Dipakai untuk notifikasi non-kritis (pengajuan baru, keputusan) agar tidak memblok response API.
export function fireAndForgetMail(payload: MailPayload, label: string) {
  sendMail(payload).catch((err) => {
    console.error(`[mailer:${label}] gagal kirim email`, err); // log error tanpa re-throw
  });
}

// Kembalikan nama provider email aktif — dipakai oleh endpoint debug test email.
export function getActiveMailProvider(): MailProvider {
  return resolveProvider(); // baca dari env var
}

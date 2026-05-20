import { prisma } from '@/lib/prisma'; // Prisma Client untuk query database
import { fireAndForgetMail, sendMail } from '@/lib/mailer';
// fireAndForgetMail → kirim email tanpa menunggu (tidak memblok handler API)
// sendMail          → kirim email dengan await (memblok, melempar error jika gagal)

// Tipe discriminant untuk jenis pengajuan yang bisa dikirim notifikasi
export type RequestKind = 'overtime' | 'reimbursement' | 'business-trip' | 'leave';

// Label tampilan dalam Bahasa Indonesia untuk setiap jenis pengajuan (dipakai di subject/isi email)
const KIND_LABEL: Record<RequestKind, string> = {
  overtime: 'Lembur',
  reimbursement: 'Reimbursement',
  'business-trip': 'Perjalanan Dinas',
  leave: 'Cuti',
};

// Path URL untuk setiap jenis pengajuan — dipakai di tombol CTA dalam email notifikasi
const KIND_PATH: Record<RequestKind, string> = {
  overtime: '/overtime',
  reimbursement: '/reimbursement',
  'business-trip': '/business-trip',
  leave: '/leave',
};

// Tipe data pengaju yang dibutuhkan untuk routing dan isi email notifikasi
type Submitter = {
  id: string; // ID pengaju
  name: string; // nama lengkap pengaju
  email: string; // email pengaju (untuk notifikasi keputusan)
  spvId: string | null; // ID atasan langsung (untuk notifikasi pengajuan baru)
  department: string | null; // departemen pengaju (ditampilkan di email)
};

// Input untuk notifikasi pengajuan baru (ke approver)
type SubmissionInput = {
  kind: RequestKind; // jenis pengajuan
  requestId: string; // ID pengajuan (untuk logging)
  // Baris detail dalam format "Kunci: Nilai" untuk tabel di isi email
  summary: string[];
  submitter: Submitter; // data pengaju
  // Wajib untuk reimbursement: approver yang dipilih oleh pengaju
  approverId?: string | null;
};

// Input untuk notifikasi eskalasi (setelah SPV setujui, ke approval admin)
type EscalationInput = {
  kind: 'overtime' | 'business-trip' | 'leave'; // jenis pengajuan (bukan reimbursement)
  requestId: string; // ID pengajuan
  summary: string[]; // baris detail pengajuan
  submitter: Submitter; // data pengaju
  spvName: string; // nama SPV yang sudah menyetujui (langkah pertama)
};

// Input untuk notifikasi keputusan (approve/reject) ke pengaju
type DecisionInput = {
  kind: RequestKind; // jenis pengajuan
  requestId: string; // ID pengajuan
  summary: string[]; // baris detail pengajuan
  submitter: Submitter; // data pengaju
  action: 'APPROVE' | 'REJECT'; // keputusan yang diambil
  decidedBy: { id: string; name: string }; // approver yang mengambil keputusan
  comment: string | undefined; // komentar dari approver (opsional untuk approve, wajib untuk reject)
};

// Kembalikan URL dasar aplikasi untuk membuat link email (tombol CTA)
function appUrl() {
  return process.env.APP_URL ?? 'http://localhost:3000'; // fallback ke localhost untuk development
}

// Buat isi HTML email lengkap menggunakan template bersama.
// Semua email notifikasi menggunakan wrapper ini untuk tampilan yang konsisten.
function wrapHtml(opts: {
  badgeColor: string; // warna latar badge label (hex)
  badgeLabel: string; // teks badge (misal: "Pengajuan Baru", "Disetujui")
  title: string; // judul email (h2)
  greeting: string; // sapaan pembuka (misal: "Halo Budi,")
  intro: string; // paragraf pengantar
  rows: Array<[string, string]>; // pasangan [label, nilai] untuk tabel detail
  cta?: { label: string; href: string }; // tombol CTA opsional
  footerNote?: string; // catatan kaki opsional
}) {
  // Build baris-baris HTML tabel dari array rows
  const rowsHtml = opts.rows
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding: 8px 12px; color: #64748b; font-size: 13px; vertical-align: top; width: 140px;">${k}</td>
          <td style="padding: 8px 12px; color: #0f172a; font-size: 14px; font-weight: 500;">${v}</td>
        </tr>`,
    )
    .join(''); // gabungkan semua baris menjadi satu string HTML

  // Build HTML tombol CTA (hanya jika diberikan)
  const ctaHtml = opts.cta
    ? `<div style="margin-top: 20px; text-align: center;">
        <a href="${opts.cta.href}" style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #372463, #5F5082); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">${opts.cta.label}</a>
      </div>`
    : '';

  // Kembalikan HTML email lengkap dengan styling inline (email client tidak support CSS biasa)
  return `
    <div style="font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; padding: 24px; background: #f1f5f9;">
      <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <div style="display: inline-block; padding: 4px 12px; background: ${opts.badgeColor}; color: #fff; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px;">${opts.badgeLabel}</div>
        <h2 style="margin: 0 0 8px; color: #0f172a; font-size: 20px;">${opts.title}</h2>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 4px;">${opts.greeting}</p>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">${opts.intro}</p>
        <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 10px; overflow: hidden;">
          ${rowsHtml}
        </table>
        ${ctaHtml}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 12px;">
        <div style="font-size: 11px; color: #94a3b8; text-align: center;">${opts.footerNote ?? 'Email otomatis dari FIERSA (Finance, Integrated Employee Reimbursement System & Approval) — jangan reply.'}</div>
      </div>
    </div>
  `;
}

// Ambil field user minimal yang dibutuhkan untuk routing email notifikasi
function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true }, // hanya field yang diperlukan
  });
}

// Konversi data pengaju dan baris ringkasan ke pasangan [label, nilai]
// yang diharapkan oleh wrapHtml. Baris pertama selalu nama/departemen karyawan.
function summaryRows(submitter: Submitter, summary: string[]): Array<[string, string]> {
  // Baris pertama: nama karyawan + departemen (jika ada)
  const rows: Array<[string, string]> = [
    ['Karyawan', `${submitter.name}${submitter.department ? ` (${submitter.department})` : ''}`],
  ];

  // Parse setiap baris summary dari format "Kunci: Nilai" ke tuple [kunci, nilai]
  for (const line of summary) {
    const [k, ...rest] = line.split(':'); // split pada ":" pertama saja
    rows.push([k.trim(), rest.join(':').trim()]); // gabungkan kembali jika nilai mengandung ":"
  }

  return rows;
}

// ─── Fungsi notifikasi email ──────────────────────────────────────────────────

// Kirim notifikasi "pengajuan baru" ke approver yang tepat.
// Untuk reimbursement: notifikasi ke approver yang dipilih secara eksplisit.
// Untuk jenis lain: notifikasi ke atasan langsung (SPV) pengaju.
// Error ditangkap dan di-log — tidak boleh menyebar ke request handler.
export async function notifyNewSubmission(input: SubmissionInput) {
  try {
    const { kind, requestId, summary, submitter, approverId } = input;
    const label = KIND_LABEL[kind]; // label teks jenis pengajuan

    let approver: { id: string; name: string; email: string } | null = null;

    if (kind === 'reimbursement') {
      // Reimbursement: approver sudah ditentukan saat submit (bukan SPV)
      if (!approverId) {
        console.warn(`[notifyNewSubmission] reimbursement ${requestId} tidak ada approverId — notif di-skip`);
        return; // tidak ada approver yang dipilih, skip notifikasi
      }
      approver = await getUser(approverId); // ambil data approver dari database
      if (!approver?.email) {
        console.warn(`[notifyNewSubmission] approver ${approverId} tidak ditemukan / email kosong`);
        return; // approver tidak ditemukan atau tidak punya email, skip
      }
    } else {
      // Jenis lain: notifikasi ke SPV pengaju
      if (!submitter.spvId) {
        console.warn(`[notifyNewSubmission] submitter ${submitter.id} belum punya SPV — notif di-skip`);
        return; // pengaju belum punya SPV, skip notifikasi
      }
      approver = await getUser(submitter.spvId); // ambil data SPV dari database
      if (!approver?.email) {
        console.warn(`[notifyNewSubmission] SPV ${submitter.spvId} tidak ditemukan / email kosong`);
        return; // SPV tidak ditemukan atau tidak punya email, skip
      }
    }

    // Build HTML email notifikasi pengajuan baru
    const html = wrapHtml({
      badgeColor: '#5F5082', // warna ungu brand FIERSA
      badgeLabel: 'Pengajuan Baru',
      title: `Pengajuan ${label} Baru`,
      greeting: `Halo ${approver.name},`,
      intro: `Ada pengajuan <b>${label.toLowerCase()}</b> baru menunggu persetujuan Anda.`,
      rows: summaryRows(submitter, summary), // detail pengajuan dalam tabel
      cta: { label: 'Buka Persetujuan', href: `${appUrl()}/approvals` }, // tombol ke halaman approvals
    });

    // Kirim email secara fire-and-forget (tidak memblok response API)
    fireAndForgetMail(
      {
        to: approver.email, // email approver
        subject: `[FIERSA] Pengajuan ${label} baru dari ${submitter.name}`,
        html,
      },
      `new-submission:${kind}:${requestId}`, // label untuk logging
    );
  } catch (err) {
    console.error('[notifyNewSubmission] error', err); // log error tanpa menyebar
  }
}

// Kirim email eskalasi ke semua approval admin setelah SPV menyetujui
// pengajuan lembur, perjalanan dinas, atau cuti (alur 2-langkah, langkah 1 selesai).
// Super admin TIDAK dinotifikasi — mereka hanya bisa menyetujui secara manual.
export async function notifyEscalatedToApprovalAdmins(input: EscalationInput) {
  try {
    const { kind, requestId, summary, submitter, spvName } = input;
    const label = KIND_LABEL[kind]; // label teks jenis pengajuan

    // Ambil semua approval admin dari database
    const admins = await prisma.user.findMany({
      where: { isApprovalAdmin: true }, // hanya approval admin
      select: { id: true, name: true, email: true },
    });

    // Filter hanya email yang tidak kosong
    const recipients = admins.map((a) => a.email).filter(Boolean);
    if (recipients.length === 0) {
      console.warn(`[notifyEscalatedToApprovalAdmins] tidak ada approval admin — notif di-skip`);
      return; // tidak ada penerima, skip notifikasi
    }

    // Tambahkan baris "Disetujui SPV" ke tabel detail email
    const rows = summaryRows(submitter, summary);
    rows.push(['Disetujui SPV', spvName]); // nama SPV yang sudah menyetujui

    // Build HTML email eskalasi
    const html = wrapHtml({
      badgeColor: '#0ea5e9', // biru untuk eskalasi
      badgeLabel: 'Eskalasi Approval',
      title: `Pengajuan ${label} Menunggu Approval Admin`,
      greeting: `Halo Tim Approval,`,
      intro: `Pengajuan <b>${label.toLowerCase()}</b> sudah disetujui SPV dan menunggu persetujuan akhir.`,
      rows,
      cta: { label: 'Buka Persetujuan', href: `${appUrl()}/approvals` },
    });

    // Kirim ke semua approval admin sekaligus (array email)
    fireAndForgetMail(
      {
        to: recipients, // array email semua approval admin
        subject: `[FIERSA] ${label} ${submitter.name} menunggu approval admin`,
        html,
      },
      `escalated:${kind}:${requestId}`,
    );
  } catch (err) {
    console.error('[notifyEscalatedToApprovalAdmins] error', err);
  }
}

// Tipe data karyawan yang berulang tahun
type BirthdayPerson = {
  id: string; // ID user
  name: string; // nama karyawan
  email: string; // email karyawan
  department: string | null; // departemen (opsional)
  positionName: string | null; // nama posisi/jabatan (opsional)
  birthdate: Date; // tanggal lahir
};

// Cari karyawan yang berulang tahun hari ini (timezone Asia/Jakarta) dan kirim
// satu email konsolidasi ke semua approval admin.
//
// Mengembalikan jumlah untuk keperluan logging. Skip secara diam-diam jika:
//   - Tidak ada karyawan yang berulang tahun hari ini, atau
//   - Tidak ada approval admin yang terdaftar.
//
// Catatan: tanggal lahir disimpan dalam UTC (frontend mengirim .toISOString() dari dayjs lokal),
// jadi perbandingan dilakukan menggunakan Intl.DateTimeFormat di timezone Jakarta untuk
// menghindari error tanggal off-by-one akibat offset UTC.
export async function notifyBirthdaysToApprovalAdmins(): Promise<{
  birthdayCount: number; // jumlah karyawan yang berulang tahun hari ini
  recipientCount: number; // jumlah approval admin yang menerima email
  birthdays: { id: string; name: string }[]; // daftar karyawan yang berulang tahun
}> {
  const result = { birthdayCount: 0, recipientCount: 0, birthdays: [] as { id: string; name: string }[] };

  try {
    const tz = process.env.HRMS_TZ ?? 'Asia/Jakarta'; // timezone dari env, default Jakarta

    // Helper: ekstrak komponen tahun/bulan/hari untuk tanggal tertentu dalam timezone yang dikonfigurasi
    const partsAt = (d: Date) => {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, // gunakan timezone yang dikonfigurasi
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = fmt.formatToParts(d); // parse ke parts: [{ type: 'year', value: '2026' }, ...]
      return {
        year: Number(parts.find((p) => p.type === 'year')!.value), // tahun sebagai number
        month: Number(parts.find((p) => p.type === 'month')!.value), // bulan (1-12)
        day: Number(parts.find((p) => p.type === 'day')!.value), // hari (1-31)
      };
    };

    const now = new Date(); // waktu saat ini
    const today = partsAt(now); // komponen hari ini dalam timezone yang dikonfigurasi

    // Ambil semua user yang memiliki tanggal lahir dari database
    const usersWithBirthdate = await prisma.user.findMany({
      where: { birthdate: { not: null } }, // hanya user dengan birthdate yang terisi
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        birthdate: true,
        position: { select: { name: true } }, // nama jabatan
      },
    });

    // Filter ke karyawan yang bulan dan hari ulang tahunnya cocok dengan hari ini
    const birthdays: BirthdayPerson[] = [];
    for (const u of usersWithBirthdate) {
      if (!u.birthdate) continue; // skip jika null (seharusnya tidak terjadi karena filter di atas)
      const bd = partsAt(u.birthdate); // ekstrak bulan dan hari tanggal lahir dalam timezone Jakarta
      if (bd.month === today.month && bd.day === today.day) {
        // Bulan dan hari cocok — tambahkan ke daftar ulang tahun hari ini
        birthdays.push({
          id: u.id,
          name: u.name,
          email: u.email,
          department: u.department,
          positionName: u.position?.name ?? null,
          birthdate: u.birthdate,
        });
      }
    }

    result.birthdayCount = birthdays.length; // simpan jumlah untuk return value
    result.birthdays = birthdays.map((b) => ({ id: b.id, name: b.name })); // simpan daftar nama
    if (birthdays.length === 0) return result; // tidak ada yang ulang tahun hari ini, selesai

    // Ambil semua approval admin sebagai penerima email
    const admins = await prisma.user.findMany({
      where: { isApprovalAdmin: true },
      select: { email: true },
    });
    const recipients = admins.map((a) => a.email).filter(Boolean); // filter email kosong
    if (recipients.length === 0) {
      console.warn(`[notifyBirthdays] tidak ada approval admin — notif di-skip`);
      return result;
    }
    result.recipientCount = recipients.length; // simpan jumlah penerima

    // Format tanggal hari ini dalam Bahasa Indonesia (misal: "20 Mei 2026")
    const todayLabel = new Intl.DateTimeFormat('id-ID', {
      timeZone: tz,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);

    // Build baris tabel email: setiap karyawan = satu baris
    const rows: Array<[string, string]> = birthdays.map((b, i) => {
      const bd = partsAt(b.birthdate); // ekstrak tahun lahir untuk hitung usia
      const age = today.year - bd.year; // hitung usia (belum memperhitungkan apakah sudah melewati hari ini)
      const detailParts = [b.positionName, b.department].filter(Boolean).join(' · '); // gabungkan jabatan & departemen
      const value = `${b.name}${detailParts ? ` <span style="color:#94a3b8;font-weight:400;">(${detailParts})</span>` : ''} <span style="color:#94a3b8;font-weight:400;">— ${age} tahun</span>`;
      return [`${i + 1}.`, value]; // nomor urut + detail karyawan
    });

    // Build HTML email ulang tahun
    const html = wrapHtml({
      badgeColor: '#ec4899', // merah muda untuk tema ulang tahun
      badgeLabel: 'Ulang Tahun',
      title: `Ulang Tahun Karyawan Hari Ini`,
      greeting: `Halo Tim,`,
      intro: `Berikut karyawan yang berulang tahun pada <b>${todayLabel}</b>. Yuk, kirim ucapan selamat 🎉`,
      rows, // daftar karyawan yang berulang tahun
    });

    // Build nama singkat untuk subject email
    const namesShort = birthdays.length === 1
      ? birthdays[0].name // hanya satu orang: nama saja
      : `${birthdays[0].name} +${birthdays.length - 1} lainnya`; // lebih dari satu: nama pertama + jumlah lainnya

    // Kirim email ke semua approval admin
    fireAndForgetMail(
      {
        to: recipients,
        subject: `[FIERSA] 🎂 Ulang tahun hari ini: ${namesShort}`,
        html,
      },
      `birthdays:${today.month}-${today.day}`, // label untuk logging (bulan-hari)
    );

    return result;
  } catch (err) {
    console.error('[notifyBirthdaysToApprovalAdmins] error', err);
    return result; // kembalikan hasil parsial (bisa jadi sebagian data sudah diisi)
  }
}

// Kirim notifikasi keputusan (setuju/tolak) ke pengaju pengajuan.
// Menggunakan fire-and-forget — error di-log, tidak disebarkan ke caller.
export function notifyDecisionToSubmitter({
  kind,
  requestId,
  summary,
  submitter,
  action,
  decidedBy,
  comment,
}: DecisionInput) {
  if (!submitter.email) return; // pengaju tidak punya email, skip notifikasi

  const label = KIND_LABEL[kind]; // label teks jenis pengajuan
  const isApprove = action === 'APPROVE'; // apakah keputusannya menyetujui

  // Tambahkan baris "Diputuskan oleh" dan komentar ke tabel detail email
  const rows = summaryRows(submitter, summary);
  rows.push(['Diputuskan oleh', decidedBy.name]); // nama approver yang memutuskan
  if (comment) rows.push([isApprove ? 'Catatan' : 'Alasan', comment]); // komentar (label berbeda untuk approve/reject)

  // Tentukan warna dan label badge berdasarkan keputusan
  const badgeColor = isApprove ? '#16a34a' : '#dc2626'; // hijau untuk setuju, merah untuk tolak
  const badgeLabel = isApprove ? 'Disetujui' : 'Ditolak';
  const title = `Pengajuan ${label} ${isApprove ? 'Disetujui' : 'Ditolak'}`;

  // Teks pengantar email berdasarkan keputusan
  const intro = isApprove
    ? `Pengajuan <b>${label.toLowerCase()}</b> Anda telah <b>disetujui</b>.`
    : `Pengajuan <b>${label.toLowerCase()}</b> Anda telah <b>ditolak</b>.`;

  const subject = `[FIERSA] Pengajuan ${label} Anda ${isApprove ? 'disetujui' : 'ditolak'}`;

  // Build HTML email notifikasi keputusan
  const html = wrapHtml({
    badgeColor,
    badgeLabel,
    title,
    greeting: `Halo ${submitter.name},`, // sapaan personal ke pengaju
    intro,
    rows, // detail pengajuan + keputusan
    cta: { label: `Lihat Detail`, href: `${appUrl()}${KIND_PATH[kind]}` }, // link ke halaman daftar pengajuan
  });

  // Kirim email ke pengaju secara fire-and-forget
  fireAndForgetMail(
    {
      to: submitter.email, // email pengaju
      subject,
      html,
    },
    `decision:${kind}:${action}:${requestId}`, // label untuk logging
  );
}

// Kirim email reset password ke user.
// Menggunakan sendMail (awaitable, melempar error jika gagal) — bukan fire-and-forget —
// agar route handler bisa mengembalikan response error jika pengiriman email gagal.
//
// PENTING: caller harus sudah memverifikasi user ada di DB sebelum memanggil fungsi ini.
// Fungsi ini tidak melakukan pengecekan keberadaan user.
export async function sendPasswordResetEmail(opts: {
  to: string; // email tujuan
  name: string; // nama user (untuk sapaan)
  rawToken: string; // token reset password mentah (belum di-hash, untuk URL)
  expiresAt: Date; // waktu kedaluwarsa token
}): Promise<void> {
  const tz = process.env.HRMS_TZ ?? 'Asia/Jakarta'; // timezone untuk format waktu kedaluwarsa

  // Build URL reset password dengan token sebagai query parameter
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(opts.rawToken)}`;

  // Format waktu kedaluwarsa dalam Bahasa Indonesia (misal: "20 Mei 2026, 14:30")
  const expiresLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: tz,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(opts.expiresAt);

  // Build HTML email reset password
  const html = wrapHtml({
    badgeColor: '#7c3aed', // ungu untuk reset password
    badgeLabel: 'Reset Password',
    title: 'Reset Password Akun FIERSA',
    greeting: `Halo ${opts.name},`,
    intro:
      'Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah untuk mengatur password baru. ' +
      'Kalau bukan Anda yang request, abaikan email ini — password lama tetap aman.',
    rows: [
      ['Berlaku sampai', expiresLabel], // batas waktu token
      ['Sekali pakai', 'Link ini hanya bisa dipakai 1×'], // peringatan sekali pakai
    ],
    cta: { label: 'Reset Password', href: url }, // tombol utama dengan link reset
    footerNote:
      'Demi keamanan, link ini hanya berlaku 30 menit dan akan invalid setelah dipakai. ' +
      'Email otomatis dari FIERSA — jangan reply.',
  });

  // Kirim email dengan await (memblok) agar error bisa ditangkap oleh caller
  await sendMail({
    to: opts.to,
    subject: '[FIERSA] Reset Password Akun Anda',
    html,
  });
}

import { z } from 'zod'; // library validasi skema runtime dengan inferensi TypeScript otomatis

// ─── Schema validasi pengajuan lembur ─────────────────────────────────────────
// Memvalidasi input dari form pengajuan lembur.
// Tanggal harus dalam rentang [-30, +14] hari relatif terhadap hari ini.
export const overtimeSchema = z
  .object({
    date: z.string().min(1, 'Tanggal wajib diisi'), // tanggal lembur sebagai ISO string
    startTime: z.string().min(1, 'Jam mulai wajib diisi'), // jam mulai sebagai ISO string
    overtimeType: z.enum(['PREMIUM_SHIFT', 'OVERDAYS'], { errorMap: () => ({ message: 'Tipe overtime wajib dipilih' }) }), // jenis lembur
    durationMinutes: z.number().int().positive('Durasi harus > 0').max(60 * 24, 'Durasi maksimal 24 jam'), // durasi dalam menit (1-1440)
    reason: z.string().min(30, 'Alasan minimal 30 karakter').max(1000), // alasan lembur
    attachmentUrl: z.string().max(500).optional().nullable().or(z.literal('').transform(() => undefined)), // URL lampiran opsional (string kosong diubah ke undefined)
  })
  .superRefine((val, ctx) => {
    // Validasi silang antar field (tidak bisa dilakukan di level field individual)
    const d = new Date(val.date); // parse tanggal lembur

    if (Number.isNaN(d.getTime())) {
      // Tanggal tidak bisa di-parse (format salah)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'Tanggal tidak valid' });
      return;
    }

    const now = new Date();
    const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)); // selisih hari

    // Batasan mundur: maksimal 30 hari ke belakang
    if (diffDays < -30) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'Tanggal tidak boleh lebih dari 30 hari ke belakang' });
    }

    // Batasan maju: maksimal 14 hari ke depan
    if (diffDays > 14) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'Tanggal tidak boleh lebih dari 14 hari ke depan' });
    }

    const start = new Date(val.startTime); // parse jam mulai
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startTime'], message: 'Jam mulai tidak valid' });
    }
  });

// ─── Schema validasi satu item reimbursement ──────────────────────────────────
// Memvalidasi satu baris item pengeluaran dalam pengajuan reimbursement.
export const reimbursementItemSchema = z.object({
  category: z.enum(['KANDUNGAN', 'KACAMATA', 'GAS_FUEL', 'TRANSPORTATION', 'PARKING', 'CLIENT_ENTERTAINMENT', 'ATK_OFFICE', 'OFFICE_MAINTENANCE', 'TOLL', 'PRODUCT_DEV', 'HOTEL_DINAS', 'MEDICAL_BOD']), // kategori pengeluaran (harus salah satu dari enum)
  amount: z.number().int().positive('Jumlah harus > 0'), // jumlah Rupiah (integer positif)
  transactionDate: z.string().min(1, 'Tanggal transaksi wajib diisi'), // tanggal transaksi sebagai ISO string
  description: z.string().min(3, 'Deskripsi minimal 3 karakter').max(500), // deskripsi pengeluaran
  receiptUrl: z.string().max(500).optional().nullable().or(z.literal('').transform(() => undefined)), // URL struk (string kosong diubah ke undefined)
});

// ─── Schema validasi pengajuan reimbursement lengkap ──────────────────────────
// Memvalidasi keseluruhan submission — harus ada minimal 1 item.
export const reimbursementSchema = z.object({
  items: z.array(reimbursementItemSchema).min(1, 'Minimal 1 item reimbursement'), // array item, min 1
});

// ─── Schema validasi pengajuan perjalanan dinas ───────────────────────────────
// Memvalidasi input dari form perjalanan dinas.
// Tanggal selesai harus >= tanggal mulai dan durasi total tidak boleh melebihi 30 hari.
export const businessTripSchema = z
  .object({
    startDate: z.string().min(1, 'Tanggal mulai wajib diisi'), // tanggal mulai sebagai ISO string
    endDate: z.string().min(1, 'Tanggal selesai wajib diisi'), // tanggal selesai sebagai ISO string
    destination: z.string().min(2, 'Tujuan wajib diisi').max(200), // tujuan perjalanan
    purpose: z.string().min(30, 'Tujuan perjalanan minimal 30 karakter').max(1000), // keperluan perjalanan
    tripType: z.enum(['WEEKDAY', 'WEEKEND']), // jenis perjalanan (hari kerja / akhir pekan)
    attachmentUrl: z.string().max(500).optional().nullable().or(z.literal('').transform(() => undefined)), // URL lampiran opsional
  })
  .superRefine((val, ctx) => {
    // Validasi silang antar field tanggal
    const s = new Date(val.startDate); // parse tanggal mulai
    const e = new Date(val.endDate); // parse tanggal selesai

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      // Salah satu tanggal tidak valid
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'Tanggal tidak valid' });
      return;
    }

    // Tanggal selesai tidak boleh sebelum tanggal mulai
    if (e.getTime() < s.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Tanggal selesai harus >= tanggal mulai' });
    }

    // Hitung durasi inklusif (termasuk hari mulai dan selesai)
    const days = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days > 30) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Durasi maksimal 30 hari' });
    }
  });

// ─── Schema validasi pengajuan cuti ───────────────────────────────────────────
// Memvalidasi input dari form cuti.
// Tanggal selesai harus >= tanggal mulai dan durasi tidak boleh melebihi 90 hari.
export const leaveSchema = z
  .object({
    startDate: z.string().min(1, 'Tanggal mulai wajib diisi'), // tanggal mulai cuti sebagai ISO string
    endDate: z.string().min(1, 'Tanggal selesai wajib diisi'), // tanggal selesai cuti sebagai ISO string
    leaveType: z.enum([
      'ANNUAL',
      'SICK',
      'PERSONAL',
      'MARRIAGE',
      'CHILD_MARRIAGE',
      'CHILD_CIRCUMCISION',
      'CHILD_BAPTISM',
      'FAMILY_DEATH',
      'HOUSEHOLD_DEATH',
      'MATERNITY',
      'MENSTRUAL',
      'MISCARRIAGE',
      'HAJJ',
    ]), // jenis cuti
    reason: z.string().min(5, 'Alasan minimal 5 karakter').max(1000), // alasan cuti
    attachmentUrl: z.string().max(500).optional().nullable().or(z.literal('').transform(() => undefined)), // URL lampiran opsional
  })
  .superRefine((val, ctx) => {
    // Validasi silang antar field tanggal
    const s = new Date(val.startDate);
    const e = new Date(val.endDate);

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'Tanggal tidak valid' });
      return;
    }

    // Tanggal selesai tidak boleh sebelum tanggal mulai
    if (e.getTime() < s.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Tanggal selesai harus >= tanggal mulai' });
    }

    // Durasi inklusif maksimal 90 hari (untuk cuti panjang seperti melahirkan)
    const days = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days > 90) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Durasi maksimal 90 hari' });
    }
  });

// ─── Schema validasi aksi persetujuan ─────────────────────────────────────────
// Memvalidasi body yang dikirim ke POST /api/approvals/[id].
export const approvalActionSchema = z.object({
  type: z.enum(['overtime', 'reimbursement', 'business-trip', 'leave']), // jenis pengajuan
  action: z.enum(['APPROVE', 'REJECT']), // keputusan: setuju atau tolak
  comment: z.string().max(1000).optional(), // komentar dari approver (wajib untuk reject)
});

// ─── Schema validasi posisi/jabatan ───────────────────────────────────────────

// Memvalidasi body untuk membuat posisi baru.
export const positionCreateSchema = z.object({
  name: z.string().min(2, 'Nama posisi minimal 2 karakter').max(100), // nama jabatan
  department: z.string().max(100).nullable().optional().or(z.literal('').transform(() => null)), // departemen (string kosong diubah ke null)
});

// Memvalidasi body untuk memperbarui posisi yang sudah ada (semua field opsional).
export const positionUpdateSchema = positionCreateSchema.partial(); // semua field jadi opsional

// ─── Helper field bersama ─────────────────────────────────────────────────────

// Field ID karyawan: hanya digit, maksimal 20 karakter, atau null/kosong.
const employeeIdField = z
  .string()
  .max(20) // maksimal 20 digit
  .regex(/^\d+$/, 'ID Karyawan hanya boleh angka') // hanya angka
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null)); // string kosong diubah ke null

// Helper untuk string opsional yang bisa null — string kosong diubah ke null.
const emptyToNull = z.literal('').transform(() => null);
const optStr = (max = 500) => z.string().max(max).nullable().optional().or(emptyToNull);

// Helper untuk tanggal opsional yang bisa null — validasi apakah bisa di-parse sebagai Date.
const optDate = () =>
  z
    .string()
    .nullable()
    .optional()
    .or(emptyToNull)
    .refine((v) => v == null || v === '' || !Number.isNaN(new Date(v).getTime()), {
      message: 'Tanggal tidak valid', // format tanggal tidak bisa di-parse
    });

// ─── Schema validasi akun user ────────────────────────────────────────────────

// Memvalidasi body untuk membuat akun user baru via panel admin.
export const userCreateSchema = z.object({
  email: z.string().email('Email tidak valid'), // email valid
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100), // nama lengkap
  password: z.string().min(6, 'Password minimal 6 karakter').max(200), // password awal
  phone: z.string().max(30).optional().nullable(), // nomor telepon opsional
  positionId: z.string().optional().nullable(), // ID posisi/jabatan opsional
  department: z.string().max(100).optional().nullable(), // departemen opsional
  employmentStatus: z.string().max(100).optional().nullable(), // status karyawan opsional
  spvId: z.string().optional().nullable(), // ID atasan langsung opsional
  employeeId: employeeIdField, // ID karyawan (hanya digit)
  isSuperAdmin: z.boolean().optional(), // flag super admin
  isApprovalAdmin: z.boolean().optional(), // flag approval admin
  joinDate: optDate(), // tanggal bergabung opsional
});

// Memvalidasi body untuk memperbarui akun user yang sudah ada.
// Semua field opsional untuk mendukung partial update.
export const userUpdateSchema = z.object({
  email: z.string().email('Email tidak valid').optional(), // email baru (opsional)
  name: z.string().min(2).max(100).optional(), // nama baru (opsional)
  // String kosong berarti "pertahankan password yang ada" (tidak diubah)
  password: z.string().min(6).max(200).optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().max(30).nullable().optional(), // telepon baru
  positionId: z.string().nullable().optional(), // posisi baru
  department: z.string().max(100).nullable().optional(), // departemen baru
  employmentStatus: z.string().max(100).nullable().optional(), // status karyawan baru
  spvId: z.string().nullable().optional(), // atasan langsung baru
  employeeId: employeeIdField, // ID karyawan baru
  isSuperAdmin: z.boolean().optional(), // ubah flag super admin
  isApprovalAdmin: z.boolean().optional(), // ubah flag approval admin
  // ── Field profil tambahan (khusus update, tidak ada di create) ──────────
  additionalPhone: optStr(30), // telepon tambahan
  placeOfBirth: optStr(100), // tempat lahir
  birthdate: optDate(), // tanggal lahir
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(), // jenis kelamin
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).nullable().optional(), // status pernikahan
  bloodType: z.enum(['A', 'B', 'AB', 'O']).nullable().optional(), // golongan darah
  religion: optStr(50), // agama
  nik: optStr(30), // nomor KTP
  idAddress: optStr(500), // alamat sesuai KTP
  postalCode: optStr(10), // kode pos
  residentialAddress: optStr(500), // alamat domisili
  passportNumber: optStr(50), // nomor paspor
  passportExpiry: optDate(), // tanggal kedaluwarsa paspor
  joinDate: optDate(), // tanggal bergabung
});

// Memvalidasi PATCH /api/profile — pembaruan profil mandiri oleh user.
// Mirip dengan userUpdateSchema tapi tanpa field khusus admin (flag peran, password, spvId).
export const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100), // nama lengkap (wajib)
  email: z.string().email('Email tidak valid').optional(), // email baru (opsional)
  employeeId: employeeIdField, // ID karyawan
  phone: optStr(30), // nomor telepon
  additionalPhone: optStr(30), // telepon tambahan
  placeOfBirth: optStr(100), // tempat lahir
  birthdate: optDate(), // tanggal lahir
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(), // jenis kelamin
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).nullable().optional(), // status pernikahan
  bloodType: z.enum(['A', 'B', 'AB', 'O']).nullable().optional(), // golongan darah
  religion: optStr(50), // agama
  nik: optStr(30), // nomor KTP
  idAddress: optStr(500), // alamat sesuai KTP
  postalCode: optStr(10), // kode pos
  residentialAddress: optStr(500), // alamat domisili
  passportNumber: optStr(50), // nomor paspor
  passportExpiry: optDate(), // tanggal kedaluwarsa paspor
  joinDate: optDate(), // tanggal bergabung
});

// ─── Tipe TypeScript yang diinferensikan dari schema di atas ─────────────────
// Menggunakan z.infer agar tipe selalu sinkron dengan schema validasi
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type OvertimeInput = z.infer<typeof overtimeSchema>;
export type ReimbursementInput = z.infer<typeof reimbursementSchema>;
export type BusinessTripInput = z.infer<typeof businessTripSchema>;
export type LeaveInput = z.infer<typeof leaveSchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;

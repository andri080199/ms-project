// ─── Import tipe model dari Prisma ───────────────────────────────────────────
import type {
  OvertimeRequest, // tipe model pengajuan lembur
  ReimbursementRequest, // tipe model pengajuan reimbursement
  ReimbursementItem, // tipe model item baris dalam reimbursement
  BusinessTripRequest, // tipe model pengajuan perjalanan dinas
  LeaveRequest, // tipe model pengajuan cuti
  ApprovalHistory, // tipe model riwayat persetujuan (setiap langkah approve/reject)
  User, // tipe model user (karyawan)
  RequestStatus, // enum status pengajuan: DRAFT, SUBMITTED, APPROVED, dll.
} from '@prisma/client';

// ─── Tipe respons API generik ─────────────────────────────────────────────────
// Semua route API mengembalikan salah satu dari dua bentuk ini:
// - Sukses: { success: true, data: T }
// - Gagal:  { success: false, error: string }
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Tipe user publik minimal ─────────────────────────────────────────────────
// Field user yang aman untuk dikembalikan ke client (tidak ada password, dll.)
// Dipakai di endpoint list untuk data user yang disertakan di pengajuan.
export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'department'>;

// Tipe user yang dikembalikan sebagai approver dalam riwayat persetujuan.
// Menambahkan field posisi (jabatan) ke PublicUser.
export type ApproverUser = PublicUser & { position: { name: string } | null };

// Tipe user yang dikembalikan sebagai pengaju pada record pengajuan.
// Sama dengan ApproverUser — keduanya butuh nama + posisi untuk ditampilkan di modal.
export type SubmitterUser = PublicUser & { position: { name: string } | null };

// ─── Tipe pengajuan dengan relasi ────────────────────────────────────────────

// Pengajuan lembur beserta data pengaju dan riwayat persetujuan opsional.
export type OvertimeWithUser = OvertimeRequest & {
  user: SubmitterUser; // data pengaju
  approvals?: (ApprovalHistory & { approver: ApproverUser })[]; // riwayat persetujuan (opsional)
};

// Pengajuan reimbursement beserta data pengaju, item baris, dan riwayat persetujuan opsional.
export type ReimbursementWithItems = ReimbursementRequest & {
  user: SubmitterUser; // data pengaju
  items: ReimbursementItem[]; // daftar item pengeluaran
  approvals?: (ApprovalHistory & { approver: ApproverUser })[]; // riwayat persetujuan (opsional)
};

// Pengajuan perjalanan dinas beserta data pengaju dan riwayat persetujuan opsional.
export type BusinessTripWithUser = BusinessTripRequest & {
  user: SubmitterUser; // data pengaju
  approvals?: (ApprovalHistory & { approver: ApproverUser })[]; // riwayat persetujuan (opsional)
};

// Pengajuan cuti beserta data pengaju dan riwayat persetujuan opsional.
export type LeaveWithUser = LeaveRequest & {
  user: SubmitterUser; // data pengaju
  approvals?: (ApprovalHistory & { approver: ApproverUser })[]; // riwayat persetujuan (opsional)
};

// ─── Tipe union untuk inbox approvals ────────────────────────────────────────

// Discriminant untuk keempat jenis pengajuan — dipakai untuk type narrowing
export type RequestKind = 'overtime' | 'reimbursement' | 'business-trip' | 'leave';

// Discriminated union yang dipakai oleh inbox approvals untuk menampung semua jenis pengajuan.
// Pola { kind, data } memungkinkan TypeScript menyempitkan tipe data berdasarkan nilai kind.
export type InboxItem =
  | { kind: 'overtime'; data: OvertimeWithUser } // pengajuan lembur
  | { kind: 'reimbursement'; data: ReimbursementWithItems } // pengajuan reimbursement
  | { kind: 'business-trip'; data: BusinessTripWithUser } // pengajuan perjalanan dinas
  | { kind: 'leave'; data: LeaveWithUser }; // pengajuan cuti

// ─── Label teks manusiawi ─────────────────────────────────────────────────────

// Label dalam Bahasa Indonesia untuk setiap jenis cuti.
// Dipakai sebagai fallback saat terjemahan tidak tersedia.
export const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: 'Cuti Tahunan',
  SICK: 'Sakit',
  PERSONAL: 'Izin',
  MARRIAGE: 'Cuti Menikah (Special Leave)',
  CHILD_MARRIAGE: 'Cuti Menikahkan Anak (Special Leave)',
  CHILD_CIRCUMCISION: 'Cuti Khitanan Anak (Special Leave)',
  CHILD_BAPTISM: 'Cuti Baptis Anak (Special Leave)',
  FAMILY_DEATH: 'Cuti Keluarga Meninggal (Special Leave)',
  HOUSEHOLD_DEATH: 'Cuti Anggota Keluarga Dalam Satu Rumah Meninggal (Special Leave)',
  MATERNITY: 'Cuti Melahirkan (Special Leave)',
  MENSTRUAL: 'Cuti Haid (Special Leave)',
  MISCARRIAGE: 'Cuti Keguguran (Special Leave)',
  HAJJ: 'Cuti Ibadah Haji (Special Leave)',
};

// Label dalam Bahasa Indonesia untuk setiap RequestStatus.
// SPV_APPROVED dan HR_APPROVED keduanya ditampilkan sebagai "Menunggu" ke pengaju
// karena proses persetujuan belum selesai sepenuhnya.
export const STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT: 'Draft', // belum disubmit
  SUBMITTED: 'Menunggu', // sudah disubmit, menunggu persetujuan pertama
  SPV_APPROVED: 'Menunggu', // sudah disetujui SPV, menunggu HR
  HR_APPROVED: 'Menunggu', // sudah disetujui HR, menunggu proses final
  REJECTED: 'Ditolak', // ditolak di salah satu langkah
  DONE: 'Disetujui', // semua langkah persetujuan selesai
  CANCELLED: 'Dibatalkan', // dibatalkan oleh pengaju
};

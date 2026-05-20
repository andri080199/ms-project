'use client'; // tandai sebagai Client Component karena butuh hook useT (i18n context)

import type { RequestStatus } from '@prisma/client'; // tipe enum status pengajuan dari Prisma
import { useT } from '@/lib/i18n/provider'; // hook fungsi terjemahan string sesuai bahasa aktif

// Peta setiap RequestStatus ke kelas CSS pill badge yang sesuai.
// SPV_APPROVED dan HR_APPROVED berbagi gaya visual "submitted" (menunggu) karena
// keduanya masih dalam proses persetujuan, belum selesai sepenuhnya.
const CLASS: Record<RequestStatus, string> = {
  DRAFT: 'status-draft', // abu-abu — belum disubmit
  SUBMITTED: 'status-submitted', // biru — menunggu persetujuan
  SPV_APPROVED: 'status-submitted', // biru — sudah disetujui SPV, menunggu HR
  HR_APPROVED: 'status-submitted', // biru — sudah disetujui HR, menunggu proses final
  DONE: 'status-done', // hijau — selesai diproses
  REJECTED: 'status-rejected', // merah — ditolak
  CANCELLED: 'status-cancelled', // abu-abu — dibatalkan oleh pengaju
};

// Pill badge kecil yang menampilkan label berlokal untuk status pengajuan.
// Dipakai di tabel daftar pengajuan, modal detail, dan halaman approvals.
export default function StatusBadge({ status }: { status: RequestStatus }) {
  const t = useT(); // ambil fungsi terjemahan
  // Render span dengan kelas CSS dari map di atas + label yang sudah diterjemahkan
  return <span className={`status-pill ${CLASS[status]}`}>{t(`status.${status}`)}</span>;
}

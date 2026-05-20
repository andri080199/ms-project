'use client'; // tandai sebagai Client Component agar bisa pakai useState dan hooks lainnya

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { Button, Descriptions, Input, Modal, Typography, App } from 'antd';
// Button       → tombol Approve / Reject
// Descriptions → tabel deskripsi key-value (detail pengajuan)
// Input        → input teks, dipakai untuk TextArea komentar alasan
// Modal        → dialog overlay untuk menampilkan detail pengajuan
// Typography   → komponen teks terstruktur (Title, Text)
// App          → context global untuk message/notification

import { useState } from 'react'; // hook state React
import StatusBadge from './StatusBadge'; // badge status berwarna (SUBMITTED, APPROVED, dll.)

// ─── Import utilitas format ───────────────────────────────────────────────────
import { formatDate, formatDateTime, formatRupiah, formatTime } from '@/lib/utils';
// formatDate     → format tanggal ke string lokal singkat (misal: "20 Mei 2026")
// formatDateTime → format tanggal+waktu (misal: "20 Mei 2026, 14:30")
// formatRupiah   → format angka ke Rupiah (misal: "Rp 150.000")
// formatTime     → format waktu saja (misal: "14:30")

// ─── Import tipe data ─────────────────────────────────────────────────────────
import {
  type BusinessTripWithUser,
  type InboxItem,
  type LeaveWithUser,
  type OvertimeWithUser,
  type ReimbursementWithItems,
} from '@/lib/types';
// InboxItem            → union type untuk semua jenis pengajuan (kind + data)
// OvertimeWithUser     → data lembur lengkap dengan relasi user & approvals
// ReimbursementWithItems → data reimbursement lengkap dengan relasi items
// BusinessTripWithUser → data perjalanan dinas lengkap dengan relasi user
// LeaveWithUser        → data cuti lengkap dengan relasi user

import { useFormatters, useT } from '@/lib/i18n/provider';
// useT          → hook fungsi terjemahan string sesuai bahasa aktif
// useFormatters → hook fungsi format nilai (minutesToReadable, pluralDays, dll.)

// Destruktur subkomponen Typography yang dipakai
const { Title, Text } = Typography;

// Tipe props komponen ApprovalModal
type Props = {
  open: boolean; // kontrol buka/tutup modal
  item: InboxItem | null; // data pengajuan yang ditampilkan (null = loading atau belum ada)
  onClose: () => void; // callback saat modal ditutup (klik backdrop atau tombol close)
  onDone: () => void; // callback setelah aksi approve/reject berhasil
  // Jika true, sembunyikan tombol approve/reject — dipakai untuk tampilan riwayat read-only
  readOnly?: boolean;
};

// Modal untuk mereview dan menyetujui/menolak satu item inbox (lembur, reimbursement,
// perjalanan dinas, atau pengajuan cuti).
export default function ApprovalModal({ open, item, onClose, onDone, readOnly }: Props) {
  const [comment, setComment] = useState(''); // State: isi komentar/alasan dari approver
  const [loading, setLoading] = useState<'APPROVE' | 'REJECT' | null>(null); // State: aksi mana yang sedang diproses (untuk loading tombol)
  const { message } = App.useApp(); // API notifikasi global AntD
  const t = useT(); // fungsi terjemahan

  // Jika belum ada data (sedang loading atau modal belum dibuka dengan data), render null
  if (!item) return null;

  // ─── Handler: kirim keputusan approve/reject ke server ──────────────────────
  async function handle(action: 'APPROVE' | 'REJECT') {
    if (!item) return; // guard: pastikan data ada

    // Validasi: penolakan harus disertai komentar alasan
    if (action === 'REJECT' && !comment.trim()) {
      message.warning(t('approvalModal.rejectReasonRequired')); // tampilkan peringatan
      return; // batalkan aksi
    }

    setLoading(action); // tandai aksi mana yang sedang diproses (aktifkan loading tombol)

    try {
      // Kirim keputusan ke API approvals
      const res = await fetch(`/api/approvals/${item.data.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: item.kind, // jenis pengajuan: 'overtime' | 'reimbursement' | 'business-trip' | 'leave'
          action, // 'APPROVE' atau 'REJECT'
          comment: comment.trim() || undefined, // komentar (opsional untuk approve, wajib untuk reject)
        }),
      });
      const json = await res.json(); // parse response

      // Jika HTTP status error atau API mengembalikan success: false
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('approvalModal.errorProcess')); // tampilkan error
        return;
      }

      // Tampilkan notifikasi sukses sesuai aksi
      message.success(action === 'APPROVE' ? t('approvalModal.msgApproved') : t('approvalModal.msgRejected'));
      setComment(''); // reset komentar
      onDone(); // panggil callback untuk menutup modal dan me-refresh data parent
    } finally {
      setLoading(null); // matikan loading state (baik sukses maupun gagal)
    }
  }

  // ─── Tentukan judul modal berdasarkan jenis pengajuan ───────────────────────
  const title =
    item.kind === 'overtime'
      ? t('approvalModal.titleOvertime') // "Pengajuan Lembur"
      : item.kind === 'reimbursement'
      ? t('approvalModal.titleReimbursement') // "Pengajuan Reimbursement"
      : item.kind === 'business-trip'
      ? t('approvalModal.titleTrip') // "Pengajuan Perjalanan Dinas"
      : t('approvalModal.titleLeave'); // "Pengajuan Cuti"

  // ─── Tentukan label entri pertama timeline berdasarkan jenis pengajuan ───────
  const requestLabel =
    item.kind === 'overtime'
      ? t('approvalModal.requestLabelOvertime') // "Pengajuan Lembur"
      : item.kind === 'reimbursement'
      ? t('approvalModal.requestLabelReimbursement') // "Pengajuan Reimbursement"
      : item.kind === 'business-trip'
      ? t('approvalModal.requestLabelTrip') // "Pengajuan Perjalanan Dinas"
      : t('approvalModal.requestLabelLeave'); // "Pengajuan Cuti"

  // ─── Render modal ──────────────────────────────────────────────────────────
  return (
    // Modal AntD: lebar 720px, tanpa footer default, hancurkan saat hidden untuk reset state
    <Modal open={open} onCancel={onClose} footer={null} title={title} width={720} destroyOnHidden>
      <div className="approval-modal-content space-y-4">
        {/* Baris identitas pengaju: nama, departemen, email, dan status badge */}
        <div className="flex items-center justify-between">
          <div>
            {/* Nama pengaju (tebal) */}
            <Text strong style={{ color: 'rgb(var(--color-text-primary))' }}>
              {item.data.user.name}
            </Text>
            {/* Departemen dan email pengaju */}
            <div className="text-xs text-muted">
              {item.data.user.department ?? '—'} · {item.data.user.email}
            </div>
          </div>
          {/* Badge status pengajuan (SUBMITTED, APPROVED, dll.) */}
          <StatusBadge status={item.data.status} />
        </div>

        {/* Render bagian detail sesuai jenis pengajuan */}
        {item.kind === 'overtime' && <OvertimeDetail data={item.data} />} {/* detail lembur */}
        {item.kind === 'reimbursement' && <ReimbursementDetail data={item.data} />} {/* detail reimbursement */}
        {item.kind === 'business-trip' && <TripDetail data={item.data} />} {/* detail perjalanan dinas */}
        {item.kind === 'leave' && <LeaveDetail data={item.data} />} {/* detail cuti */}

        {/* Timeline riwayat persetujuan */}
        <div className="glass p-3 md:p-4">
          <Title level={5} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }}>
            {t('approvalModal.sectionHistory')} {/* judul section: "Riwayat" */}
          </Title>
          <div className="mt-3">
            {/* Entri pertama: pengajuan awal oleh user */}
            <TimelineEntry
              color="info" // warna biru — informasi/netral
              time={formatDateTime(item.data.createdAt)} // waktu pengajuan dibuat
              isLast={!item.data.approvals?.length} // jika belum ada approval, ini adalah entri terakhir
            >
              <span className="font-semibold">{requestLabel}</span> {/* label jenis pengajuan */}
              <span className="text-muted"> — {t('approvalModal.submittedByPrefix')} </span> {/* " — oleh " */}
              <span className="font-semibold">
                {item.data.user.name} {/* nama pengaju */}
                {item.data.user.position?.name ? ` - ${item.data.user.position.name}` : ''} {/* posisi pengaju jika ada */}
              </span>
            </TimelineEntry>

            {/* Entri selanjutnya: setiap aksi approve/reject yang sudah terjadi */}
            {item.data.approvals?.map((a, idx) => (
              <TimelineEntry
                key={a.id} // key unik untuk React
                color={a.action === 'APPROVE' ? 'success' : 'danger'} // hijau untuk approve, merah untuk reject
                time={formatDateTime(a.createdAt)} // waktu keputusan dibuat
                comment={a.comment} // komentar dari approver (jika ada)
                isLast={idx === (item.data.approvals?.length ?? 0) - 1} // tandai entri terakhir (tidak ada garis)
              >
                <span className="font-semibold">
                  {/* Label keputusan: "Disetujui" atau "Ditolak" */}
                  {a.action === 'APPROVE' ? t('approvalModal.decisionApproved') : t('approvalModal.decisionRejected')}
                </span>
                <span className="text-muted"> {t('approvalModal.decidedByPrefix')} </span> {/* " oleh " */}
                <span className="font-semibold">
                  {a.approver.name} {/* nama approver yang mengambil keputusan */}
                  {a.approver.position?.name ? ` - ${a.approver.position.name}` : ''} {/* posisi approver jika ada */}
                </span>
              </TimelineEntry>
            ))}
          </div>
        </div>

        {/* Area aksi: hanya tampil jika bukan mode read-only (yaitu untuk approver) */}
        {!readOnly && (
          <>
            {/* Input komentar/alasan dari approver */}
            <Input.TextArea
              value={comment} // nilai terkontrol dari state
              onChange={(e) => setComment(e.target.value)} // update state saat user mengetik
              rows={3} // tinggi default 3 baris
              placeholder={t('approvalModal.commentPlaceholder')} // placeholder teks
              maxLength={1000} // batas maksimum karakter
            />
            {/* Tombol Tolak dan Setujui */}
            <div className="flex gap-3 justify-end">
              {/* Tombol Tolak — merah, hanya aktif jika ada komentar alasan */}
              <Button danger onClick={() => handle('REJECT')} loading={loading === 'REJECT'}>
                {t('approvalModal.btnReject')} {/* label: "Tolak" */}
              </Button>
              {/* Tombol Setujui — primer (warna utama) */}
              <Button type="primary" onClick={() => handle('APPROVE')} loading={loading === 'APPROVE'}>
                {t('approvalModal.btnApprove')} {/* label: "Setujui" */}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Sub-komponen detail per jenis pengajuan ─────────────────────────────────

// Menampilkan tabel ringkasan untuk pengajuan lembur
function OvertimeDetail({ data }: { data: OvertimeWithUser }) {
  const t = useT(); // fungsi terjemahan
  const { minutesToReadable } = useFormatters(); // konversi menit ke format "X jam Y menit"

  return (
    // Descriptions: tabel key-value vertikal dengan border
    <Descriptions column={1} size="small" bordered>
      {/* Baris: tanggal lembur */}
      <Descriptions.Item label={t('approvalModal.rowDate')}>{formatDate(data.date)}</Descriptions.Item>
      {/* Baris: jenis lembur (PREMIUM_SHIFT / OVERDAYS) */}
      <Descriptions.Item label={t('approvalModal.rowOvertimeType')}>
        {data.overtimeType === 'PREMIUM_SHIFT' ? t('overtime.typePremiumShift') : t('overtime.typeOverdays')}
      </Descriptions.Item>
      {/* Baris: jam mulai lembur */}
      <Descriptions.Item label={t('approvalModal.rowTime')}>
        {formatTime(data.startTime)} {/* format: "14:30" */}
      </Descriptions.Item>
      {/* Baris: durasi lembur dalam format manusiawi (misal: "2 jam 30 menit") */}
      <Descriptions.Item label={t('approvalModal.rowDuration')}>{minutesToReadable(data.durationMinutes)}</Descriptions.Item>
      {/* Baris: alasan lembur */}
      <Descriptions.Item label={t('approvalModal.rowReason')}>{data.reason}</Descriptions.Item>
      {/* Baris lampiran — hanya tampil jika ada lampiran */}
      {data.attachmentUrl && (
        <Descriptions.Item label={t('approvalModal.rowAttachment')}>
          <a href={data.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary-light underline">
            {t('common.viewAttachment')} {/* label link: "Lihat Lampiran" */}
          </a>
        </Descriptions.Item>
      )}
      {/* Baris alasan penolakan — hanya tampil jika ada */}
      {data.rejectedReason && (
        <Descriptions.Item label={t('approvalModal.rowRejectedReason')}>{data.rejectedReason}</Descriptions.Item>
      )}
    </Descriptions>
  );
}

// Menampilkan tabel ringkasan + daftar item untuk pengajuan reimbursement
function ReimbursementDetail({ data }: { data: ReimbursementWithItems }) {
  const t = useT(); // fungsi terjemahan

  return (
    <div className="space-y-3">
      {/* Tabel ringkasan: total nilai dan jumlah item */}
      <Descriptions column={1} size="small" bordered>
        {/* Total nilai reimbursement dalam format Rupiah */}
        <Descriptions.Item label={t('approvalModal.rowTotal')}>{formatRupiah(data.totalAmount)}</Descriptions.Item>
        {/* Jumlah item dalam pengajuan */}
        <Descriptions.Item label={t('approvalModal.rowItemCount')}>{data.items.length}</Descriptions.Item>
        {/* Alasan penolakan — hanya tampil jika ada */}
        {data.rejectedReason && (
          <Descriptions.Item label={t('approvalModal.rowRejectedReason')}>{data.rejectedReason}</Descriptions.Item>
        )}
      </Descriptions>

      {/* Daftar item reimbursement satu per satu */}
      <div className="glass p-3">
        <Title level={5} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }}>
          {t('approvalModal.sectionItems')} {/* judul section: "Item Pengeluaran" */}
        </Title>
        <div className="mt-2 space-y-2">
          {data.items.map((it) => (
            <div key={it.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                {/* Nama kategori dan nilai item */}
                <div className="font-semibold">
                  {t(`reimbCategory.${it.category}`)} — {formatRupiah(it.amount)}
                </div>
                {/* Tanggal transaksi dan deskripsi item */}
                <div className="text-muted text-xs">
                  {formatDate(it.transactionDate)} · {it.description}
                </div>
                {/* Link struk/bukti pembayaran — hanya tampil jika ada */}
                {it.receiptUrl && (
                  <a href={it.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-primary-light underline">
                    {t('approvalModal.viewReceipt')} {/* label: "Lihat Struk" */}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Menampilkan tabel ringkasan untuk pengajuan cuti
function LeaveDetail({ data }: { data: LeaveWithUser }) {
  const t = useT(); // fungsi terjemahan
  const { pluralDays } = useFormatters(); // format jumlah hari ("1 hari" / "N hari")

  return (
    <Descriptions column={1} size="small" bordered>
      {/* Baris: jenis cuti (ANNUAL, SICK, dll.) — diterjemahkan */}
      <Descriptions.Item label={t('approvalModal.rowLeaveType')}>{t(`leaveType.${data.leaveType}`)}</Descriptions.Item>
      {/* Baris: rentang tanggal cuti */}
      <Descriptions.Item label={t('approvalModal.rowDate')}>
        {formatDate(data.startDate)} — {formatDate(data.endDate)}
      </Descriptions.Item>
      {/* Baris: total hari cuti dalam format manusiawi */}
      <Descriptions.Item label={t('approvalModal.rowTotalDays')}>{pluralDays(data.totalDays)}</Descriptions.Item>
      {/* Baris: alasan cuti */}
      <Descriptions.Item label={t('approvalModal.rowReason')}>{data.reason}</Descriptions.Item>
      {/* Baris lampiran — hanya tampil jika ada */}
      {data.attachmentUrl && (
        <Descriptions.Item label={t('approvalModal.rowAttachment')}>
          <a href={data.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary-light underline">
            {t('common.viewAttachment')} {/* label: "Lihat Lampiran" */}
          </a>
        </Descriptions.Item>
      )}
      {/* Baris alasan penolakan — hanya tampil jika ada */}
      {data.rejectedReason && (
        <Descriptions.Item label={t('approvalModal.rowRejectedReason')}>{data.rejectedReason}</Descriptions.Item>
      )}
    </Descriptions>
  );
}

// Satu langkah dalam timeline riwayat persetujuan.
// Menampilkan titik berwarna, timestamp, label aktor, dan kutipan komentar opsional.
function TimelineEntry({
  color, // warna titik: 'info' (biru), 'success' (hijau), 'danger' (merah)
  time, // string waktu yang sudah diformat
  comment, // komentar opsional dari approver
  isLast, // apakah ini entri terakhir (tidak tampilkan garis penghubung)
  children, // konten teks entri (nama aktor + label keputusan)
}: {
  color: 'info' | 'success' | 'danger';
  time: string;
  comment?: string | null;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  const dotColor = `rgb(var(--color-${color}))`; // warna titik dari CSS variable

  return (
    // Flex row: titik di kiri, konten di kanan
    <div className="flex gap-3 relative">
      {/* Kolom kiri: titik berwarna + garis penghubung vertikal */}
      <div className="flex flex-col items-center shrink-0">
        {/* Titik berwarna dengan ring cahaya lembut */}
        <span
          className="rounded-full mt-1.5"
          style={{
            width: 10,
            height: 10,
            background: dotColor, // warna titik sesuai aksi
            boxShadow: `0 0 0 3px rgb(var(--color-${color}) / 0.2)`, // ring transparan
          }}
        />
        {/* Garis penghubung vertikal — disembunyikan pada entri terakhir */}
        {!isLast && (
          <span
            className="w-px flex-1 mt-1"
            style={{ background: 'rgb(var(--color-text-primary) / 0.12)' }} // garis sangat transparan
          />
        )}
      </div>

      {/* Kolom kanan: konten entri (teks + timestamp + komentar) */}
      <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-3'}`}> {/* pb-3 untuk jarak ke entri berikutnya */}
        {/* Teks utama entri: nama aktor + label keputusan */}
        <div className="text-sm leading-snug break-words">{children}</div>
        {/* Timestamp */}
        <div className="text-xs text-muted mt-1">{time}</div>
        {/* Komentar dalam format kutipan — hanya tampil jika ada komentar */}
        {comment ? (
          <div
            className="text-xs italic text-muted mt-1.5 px-2.5 py-1.5 rounded-lg break-words"
            style={{ background: 'rgb(var(--color-text-primary) / 0.04)' }} // latar transparan
          >
            "{comment}" {/* isi komentar dalam tanda kutip */}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Menampilkan tabel ringkasan untuk pengajuan perjalanan dinas
function TripDetail({ data }: { data: BusinessTripWithUser }) {
  const t = useT(); // fungsi terjemahan

  return (
    <Descriptions column={1} size="small" bordered>
      {/* Baris: tujuan perjalanan */}
      <Descriptions.Item label={t('approvalModal.rowDestination')}>{data.destination}</Descriptions.Item>
      {/* Baris: rentang tanggal perjalanan */}
      <Descriptions.Item label={t('approvalModal.rowDate')}>
        {formatDate(data.startDate)} — {formatDate(data.endDate)}
      </Descriptions.Item>
      {/* Baris: jenis perjalanan (WEEKDAY / WEEKEND) — diterjemahkan */}
      <Descriptions.Item label={t('approvalModal.rowTripType')}>{t(`tripType.${data.tripType}`)}</Descriptions.Item>
      {/* Baris: keperluan/tujuan perjalanan */}
      <Descriptions.Item label={t('approvalModal.rowPurpose')}>{data.purpose}</Descriptions.Item>
      {/* Baris lampiran — hanya tampil jika ada */}
      {data.attachmentUrl && (
        <Descriptions.Item label={t('approvalModal.rowAttachment')}>
          <a href={data.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary-light underline">
            {t('common.viewAttachment')} {/* label: "Lihat Lampiran" */}
          </a>
        </Descriptions.Item>
      )}
      {/* Baris alasan penolakan — hanya tampil jika ada */}
      {data.rejectedReason && (
        <Descriptions.Item label={t('approvalModal.rowRejectedReason')}>{data.rejectedReason}</Descriptions.Item>
      )}
    </Descriptions>
  );
}

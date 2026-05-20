'use client'; // tandai sebagai Client Component agar bisa pakai useState, useEffect, dll.

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { App, Button, Popconfirm, Tag } from 'antd';
// App        → context global untuk message/notification
// Button     → tombol UI
// Popconfirm → dialog konfirmasi kecil sebelum aksi destruktif (batalkan)
// Tag        → label berwarna untuk jenis cuti

// ─── Import ikon dari Ant Design Icons ───────────────────────────────────────
import { PlusOutlined, CloseCircleOutlined } from '@ant-design/icons';
// PlusOutlined       → ikon "+" untuk tombol ajukan cuti
// CloseCircleOutlined → ikon "x" untuk tombol batalkan

import Link from 'next/link'; // komponen navigasi Next.js tanpa reload penuh
import { useEffect, useMemo, useState } from 'react'; // hooks React dasar

// ─── Import komponen internal aplikasi ───────────────────────────────────────
import RequestsTable from '@/components/RequestsTable'; // tabel generik untuk daftar pengajuan
import StatusBadge from '@/components/StatusBadge'; // badge warna sesuai status (SUBMITTED, APPROVED, dll.)
import ApprovalModal from '@/components/ApprovalModal'; // modal detail pengajuan (read-only di sini)
import PageHeader, { PageTitle } from '@/components/PageHeader'; // header halaman dengan judul & subtitle
import ColTitle from '@/components/ColTitle'; // judul kolom tabel dengan styling konsisten

// ─── Import utilitas ─────────────────────────────────────────────────────────
import { formatDate } from '@/lib/utils'; // format tanggal ke string lokal (misal: "20 Mei 2026")
import type { ColumnsType } from 'antd/es/table'; // tipe definisi kolom tabel AntD
import type { LeaveRequest } from '@prisma/client'; // tipe model Prisma untuk data cuti
import type { InboxItem, LeaveWithUser } from '@/lib/types'; // tipe gabungan untuk modal detail
import { useFormatters, useT } from '@/lib/i18n/provider';
// useT          → fungsi terjemahan string sesuai bahasa aktif
// useFormatters → fungsi format nilai (mis. pluralDays: "1 hari" / "3 hari")


export default function LeaveListPage() {
  // ─── State utama halaman ────────────────────────────────────────────────────

  // State: array data cuti yang ditampilkan di tabel
  const [rows, setRows] = useState<LeaveRequest[]>([]);

  // State: true selama data pertama kali sedang di-fetch (tampilkan skeleton)
  const [loading, setLoading] = useState(true);

  // State: id pengajuan yang sedang dalam proses pembatalan (untuk loading state tombol)
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // State: data detail pengajuan yang ditampilkan di modal (null = belum/sedang dimuat)
  const [detailItem, setDetailItem] = useState<InboxItem | null>(null);

  // State: kontrol apakah modal detail sedang terbuka
  const [detailOpen, setDetailOpen] = useState(false);

  // ─── Hooks utilitas ─────────────────────────────────────────────────────────
  const t = useT(); // fungsi terjemahan
  const { pluralDays } = useFormatters(); // format jumlah hari ("1 hari" / "N hari")
  const { message } = App.useApp(); // akses API notifikasi global AntD

  // ─── Fetch data saat komponen pertama kali mount ────────────────────────────
  useEffect(() => {
    // Buat AbortController agar fetch bisa dibatalkan saat komponen di-unmount
    const ctrl = new AbortController();

    // IIFE async untuk bisa pakai await di dalam useEffect
    (async () => {
      try {
        // Ambil daftar pengajuan cuti milik user yang sedang login
        // cache: 'no-store' → selalu ambil data terbaru, tidak pakai cache browser
        // signal: ctrl.signal → fetch bisa dibatalkan via ctrl.abort()
        const res = await fetch('/api/leave', { cache: 'no-store', signal: ctrl.signal });
        const json = await res.json(); // parse response JSON

        // Jika API mengembalikan success: true, simpan data ke state rows
        if (json.success) setRows(json.data);
        setLoading(false); // sembunyikan skeleton loader
      } catch (err) {
        // Jika error bukan AbortError (yaitu bukan karena unmount), hentikan loading
        if ((err as { name?: string })?.name !== 'AbortError') setLoading(false);
      }
    })();

    // Cleanup: batalkan fetch yang sedang berjalan jika komponen di-unmount
    // (mencegah state update pada komponen yang sudah tidak ada / React Strict Mode double-effect)
    return () => ctrl.abort();
  }, []); // [] → hanya jalankan sekali saat mount

  // Cek apakah pengajuan bisa dibatalkan (hanya status SUBMITTED atau DRAFT yang bisa dibatalkan)
  const isCancellable = (status: string) => status === 'SUBMITTED' || status === 'DRAFT';

  // ─── Handler: batalkan pengajuan cuti ──────────────────────────────────────
  const handleCancel = async (id: string) => {
    setCancellingId(id); // tandai pengajuan ini sedang dalam proses pembatalan (aktifkan loading tombol)

    try {
      // Kirim DELETE ke API untuk membatalkan pengajuan cuti
      const res = await fetch(`/api/leave/${id}`, { method: 'DELETE' });
      const json = await res.json(); // parse response

      if (json.success) {
        // Update state secara optimistik: ganti status jadi CANCELLED tanpa fetch ulang
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'CANCELLED' } : r)));
        message.success(t('common.cancelSuccess')); // tampilkan notifikasi sukses
      } else {
        // Tampilkan pesan error dari API, atau pesan default jika tidak ada
        message.error(json.error || t('common.cancelFailed'));
      }
    } catch {
      // Error jaringan atau parsing — tampilkan pesan gagal
      message.error(t('common.cancelFailed'));
    } finally {
      setCancellingId(null); // reset id yang sedang dibatalkan (matikan loading tombol)
    }
  };

  // ─── Handler: buka modal detail pengajuan ──────────────────────────────────
  const openDetail = async (id: string) => {
    setDetailOpen(true); // buka modal terlebih dahulu (tampilkan skeleton/loading di dalam modal)
    setDetailItem(null); // reset data lama agar tidak flash data pengajuan sebelumnya

    try {
      // Ambil detail pengajuan cuti berdasarkan id
      const res = await fetch(`/api/leave/${id}`, { cache: 'no-store' });
      const json = await res.json(); // parse response

      if (json.success) {
        // Bungkus data dalam InboxItem dengan kind 'leave' agar ApprovalModal tahu cara render-nya
        setDetailItem({ kind: 'leave', data: json.data as LeaveWithUser });
      } else {
        // Gagal memuat detail — tampilkan error dan tutup modal
        message.error(json.error || t('common.detailLoadFailed'));
        setDetailOpen(false);
      }
    } catch {
      // Error jaringan — tampilkan error dan tutup modal
      message.error(t('common.detailLoadFailed'));
      setDetailOpen(false);
    }
  };

  // ─── Definisi kolom tabel (di-memoize agar tidak re-render tanpa perlu) ────
  const columns: ColumnsType<LeaveRequest> = useMemo(
    () => [
      {
        // Kolom: jenis cuti (ANNUAL, SICK, dll.) ditampilkan sebagai tag berwarna cyan
        title: <ColTitle label={t('leave.colType')} />,
        dataIndex: 'leaveType', // ambil nilai dari field leaveType di data
        width: 150,
        render: (v: string) => <Tag color="cyan">{t(`leaveType.${v}`)}</Tag>, // terjemahkan kode jenis cuti
      },
      {
        // Kolom: tanggal mulai dan selesai cuti, digabung dengan "—"
        title: <ColTitle label={t('leave.colDates')} />,
        render: (_, r) => `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`, // format kedua tanggal
      },
      {
        // Kolom: total hari cuti (formatted: "1 hari" atau "3 hari")
        title: <ColTitle label={t('leave.colTotal')} />,
        dataIndex: 'totalDays',
        width: 130,
        render: (v) => <span className="whitespace-nowrap">{pluralDays(v)}</span>, // cegah text wrap
      },
      // Kolom: alasan cuti, dipotong jika terlalu panjang (ellipsis)
      { title: <ColTitle label={t('leave.colReason')} />, dataIndex: 'reason', ellipsis: true, width: 220 },
      {
        // Kolom: lampiran (attachment) — tampilkan link jika ada, atau "—" jika tidak ada
        title: <ColTitle label={t('leave.colAttachment')} />,
        dataIndex: 'attachmentUrl',
        width: 130,
        render: (v: string | null) =>
          v ? (
            // Ada lampiran: tampilkan link yang buka di tab baru
            // stopPropagation: cegah klik link memicu openDetail (row click handler)
            <a href={v} target="_blank" rel="noreferrer" className="text-primary-light underline" onClick={(e) => e.stopPropagation()}>
              {t('common.view')}
            </a>
          ) : (
            // Tidak ada lampiran: tampilkan tanda "—"
            <span className="text-muted">—</span>
          ),
      },
      {
        // Kolom: status pengajuan (SUBMITTED, APPROVED, REJECTED, CANCELLED, dll.)
        title: <ColTitle label={t('leave.colStatus')} />,
        dataIndex: 'status',
        width: 130,
        render: (v) => <StatusBadge status={v} />, // render badge berwarna sesuai status
      },
      {
        // Kolom: tombol aksi (batalkan) — hanya tampil jika status masih bisa dibatalkan
        title: <ColTitle label={t('common.actions')} />,
        key: 'actions',
        width: 140,
        // stopPropagation di level cell agar klik tombol tidak memicu onRowClick (buka modal detail)
        onCell: () => ({ onClick: (e) => e.stopPropagation() }),
        render: (_, r) =>
          isCancellable(r.status) ? (
            // Status bisa dibatalkan: tampilkan Popconfirm sebelum eksekusi pembatalan
            <Popconfirm
              title={t('common.cancelConfirmTitle')} // judul konfirmasi
              description={t('common.cancelConfirmDesc')} // pesan konfirmasi
              okText={t('common.yes')} // teks tombol konfirmasi
              cancelText={t('common.no')} // teks tombol batal
              okButtonProps={{ danger: true, loading: cancellingId === r.id }} // tombol OK merah + loading jika sedang diproses
              onConfirm={() => handleCancel(r.id)} // eksekusi pembatalan setelah konfirmasi
            >
              <Button danger size="small" icon={<CloseCircleOutlined />}>
                {t('common.cancelRequest')} {/* label tombol */}
              </Button>
            </Popconfirm>
          ) : (
            // Status tidak bisa dibatalkan: tampilkan "—"
            <span className="text-muted">—</span>
          ),
      },
    ],
    [t, pluralDays, cancellingId], // re-compute kolom hanya jika terjemahan, formatter, atau cancellingId berubah
  );

  // ─── Render halaman ─────────────────────────────────────────────────────────
  return (
    // Wrapper utama dengan jarak vertikal antar section
    <div className="space-y-6">
      {/* Header halaman: judul + tombol ajukan cuti baru */}
      <PageHeader>
        {/* Flex row: judul di kiri, tombol di kanan; wrap jika layar sempit */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Judul dan subtitle halaman */}
          <PageTitle title={t('leave.title')} subtitle={t('leave.subtitle')} />
          {/* Tombol navigasi ke halaman form pengajuan cuti baru */}
          <Link href="/leave/new">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              {t('leave.submit')} {/* label tombol: "Ajukan Cuti" */}
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Tabel daftar pengajuan cuti */}
      <RequestsTable<LeaveRequest>
        loading={loading} // tampilkan skeleton saat data sedang dimuat
        rows={rows} // data baris tabel
        columns={columns} // definisi kolom tabel
        rowKey="id" // key unik tiap baris (untuk React reconciliation)
        emptyText={t('leave.emptyList')} // teks saat tabel kosong
        onRowClick={(r) => openDetail(r.id)} // klik baris → buka modal detail
        // ── Tampilan mobile (card list, bukan tabel) ──────────────────────────
        mobileRender={(r) => (
          <div>
            {/* Baris pertama: jenis cuti (tag) + status badge */}
            <div className="flex items-center justify-between gap-2">
              <Tag color="cyan" style={{ margin: 0 }}>
                {t(`leaveType.${r.leaveType}`)} {/* terjemahkan kode jenis cuti */}
              </Tag>
              <StatusBadge status={r.status} /> {/* badge status */}
            </div>

            {/* Rentang tanggal cuti */}
            <div className="font-semibold mt-2">
              {formatDate(r.startDate)} — {formatDate(r.endDate)}
            </div>

            {/* Total hari cuti */}
            <div className="text-xs text-muted">{pluralDays(r.totalDays)}</div>

            {/* Alasan cuti (max 2 baris, dipotong jika panjang) */}
            <div className="text-sm mt-2 line-clamp-2">{r.reason}</div>

            {/* Link lampiran — hanya tampil jika ada lampiran */}
            {r.attachmentUrl && (
              <a
                href={r.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()} // cegah klik buka modal detail
                className="text-xs text-primary-light underline mt-1 inline-block"
              >
                {t('common.viewAttachment')} {/* label link: "Lihat Lampiran" */}
              </a>
            )}

            {/* Tombol batalkan — hanya tampil jika status masih bisa dibatalkan */}
            {isCancellable(r.status) && (
              // stopPropagation di level div agar klik area ini tidak buka modal detail
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <Popconfirm
                  title={t('common.cancelConfirmTitle')}
                  description={t('common.cancelConfirmDesc')}
                  okText={t('common.yes')}
                  cancelText={t('common.no')}
                  okButtonProps={{ danger: true, loading: cancellingId === r.id }} // loading saat diproses
                  onConfirm={() => handleCancel(r.id)} // eksekusi pembatalan
                >
                  <Button danger size="small" icon={<CloseCircleOutlined />}>
                    {t('common.cancelRequest')} {/* label tombol */}
                  </Button>
                </Popconfirm>
              </div>
            )}
          </div>
        )}
      />

      {/* Modal detail pengajuan cuti — readOnly karena ini tampilan user sendiri, bukan approver */}
      <ApprovalModal
        open={detailOpen} // kontrol buka/tutup modal
        item={detailItem} // data yang ditampilkan (null = loading)
        onClose={() => setDetailOpen(false)} // tutup modal saat klik backdrop atau tombol close
        onDone={() => setDetailOpen(false)} // tutup modal setelah aksi selesai (tidak ada aksi di readOnly)
        readOnly // mode read-only: sembunyikan tombol approve/reject
      />
    </div>
  );
}

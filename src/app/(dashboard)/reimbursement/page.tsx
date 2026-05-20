'use client'; // tandai sebagai Client Component agar bisa pakai useState, useEffect, dll.

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { App, Button, Popconfirm } from 'antd';
// App        → context global untuk message/notification
// Button     → tombol UI
// Popconfirm → dialog konfirmasi kecil sebelum aksi destruktif (batalkan)

// ─── Import ikon dari Ant Design Icons ───────────────────────────────────────
import { PlusOutlined, CloseCircleOutlined } from '@ant-design/icons';
// PlusOutlined        → ikon "+" untuk tombol ajukan reimbursement
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
import { formatDate, formatRupiah } from '@/lib/utils';
// formatDate   → format tanggal ke string lokal (misal: "20 Mei 2026")
// formatRupiah → format angka ke format mata uang Rupiah (misal: "Rp 150.000")

import type { ColumnsType } from 'antd/es/table'; // tipe definisi kolom tabel AntD
import type { ReimbursementItem, ReimbursementRequest } from '@prisma/client';
// ReimbursementRequest → tipe model Prisma untuk data pengajuan reimbursement
// ReimbursementItem    → tipe model Prisma untuk item-item dalam satu pengajuan

import type { InboxItem, ReimbursementWithItems } from '@/lib/types'; // tipe gabungan untuk modal detail
import { useT } from '@/lib/i18n/provider'; // hook fungsi terjemahan string sesuai bahasa aktif

// Tipe baris tabel: ReimbursementRequest + array items yang sudah di-include dari API
type Row = ReimbursementRequest & { items: ReimbursementItem[] };

export default function ReimbursementListPage() {
  // ─── State utama halaman ────────────────────────────────────────────────────

  // State: array data reimbursement yang ditampilkan di tabel
  const [rows, setRows] = useState<Row[]>([]);

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
  const { message } = App.useApp(); // akses API notifikasi global AntD

  // ─── Fetch data saat komponen pertama kali mount ────────────────────────────
  useEffect(() => {
    // Buat AbortController agar fetch bisa dibatalkan saat komponen di-unmount
    const ctrl = new AbortController();

    // IIFE async untuk bisa pakai await di dalam useEffect
    (async () => {
      try {
        // Ambil daftar pengajuan reimbursement milik user yang sedang login
        // cache: 'no-store' → selalu ambil data terbaru, tidak pakai cache browser
        // signal: ctrl.signal → fetch bisa dibatalkan via ctrl.abort()
        const res = await fetch('/api/reimbursement', { cache: 'no-store', signal: ctrl.signal });
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

  // ─── Handler: batalkan pengajuan reimbursement ──────────────────────────────
  const handleCancel = async (id: string) => {
    setCancellingId(id); // tandai pengajuan ini sedang diproses (aktifkan loading tombol)

    try {
      // Kirim DELETE ke API untuk membatalkan pengajuan reimbursement
      const res = await fetch(`/api/reimbursement/${id}`, { method: 'DELETE' });
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
    setDetailOpen(true); // buka modal terlebih dahulu (tampilkan loading di dalam modal)
    setDetailItem(null); // reset data lama agar tidak flash data pengajuan sebelumnya

    try {
      // Ambil detail pengajuan reimbursement berdasarkan id
      const res = await fetch(`/api/reimbursement/${id}`, { cache: 'no-store' });
      const json = await res.json(); // parse response

      if (json.success) {
        // Bungkus data dalam InboxItem dengan kind 'reimbursement' agar ApprovalModal tahu cara render-nya
        setDetailItem({ kind: 'reimbursement', data: json.data as ReimbursementWithItems });
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

  // ─── Helper: ringkasan deskripsi item reimbursement untuk kolom tabel ───────
  const itemSummary = (items: ReimbursementItem[]) => {
    if (!items.length) return '—'; // tidak ada item — tampilkan "—"
    const first = items[0].description; // ambil deskripsi item pertama
    // Jika lebih dari 1 item, tambahkan "(+N)" di belakangnya untuk menunjukkan jumlah item lainnya
    return items.length > 1 ? `${first} (+${items.length - 1})` : first;
  };

  // ─── Definisi kolom tabel (di-memoize agar tidak re-render tanpa perlu) ────
  const columns: ColumnsType<Row> = useMemo(
    () => [
      // Kolom: tanggal pengajuan dibuat (bukan tanggal acara)
      { title: <ColTitle label={t('reimbursement.colDate')} />, dataIndex: 'createdAt', render: (v) => formatDate(v), width: 130 },
      {
        // Kolom: deskripsi item pertama (+ jumlah item lainnya jika lebih dari 1)
        title: <ColTitle label={t('reimbursement.colDescription')} />,
        key: 'description', // key manual karena tidak pakai dataIndex langsung
        ellipsis: true, // potong teks jika terlalu panjang
        render: (_, r) => itemSummary(r.items), // panggil helper untuk ringkasan deskripsi
      },
      // Kolom: jumlah item dalam pengajuan (bilangan bulat)
      { title: <ColTitle label={t('reimbursement.colItems')} />, render: (_, r) => r.items.length, width: 80 },
      // Kolom: total nilai reimbursement dalam format Rupiah
      { title: <ColTitle label={t('reimbursement.colTotal')} />, dataIndex: 'totalAmount', render: (v) => formatRupiah(v), width: 140 },
      // Kolom: status pengajuan (SUBMITTED, APPROVED, REJECTED, CANCELLED, dll.)
      { title: <ColTitle label={t('reimbursement.colStatus')} />, dataIndex: 'status', render: (v) => <StatusBadge status={v} />, width: 120 },
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
    [t, cancellingId], // re-compute kolom hanya jika terjemahan atau cancellingId berubah
  );

  // ─── Render halaman ─────────────────────────────────────────────────────────
  return (
    // Wrapper utama dengan jarak vertikal antar section
    <div className="space-y-6">
      {/* Header halaman: judul + tombol ajukan reimbursement baru */}
      <PageHeader>
        {/* Flex row: judul di kiri, tombol di kanan; wrap jika layar sempit */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Judul dan subtitle halaman */}
          <PageTitle title={t('reimbursement.title')} subtitle={t('reimbursement.subtitle')} />
          {/* Tombol navigasi ke halaman form pengajuan reimbursement baru */}
          <Link href="/reimbursement/new">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              {t('reimbursement.submit')} {/* label tombol: "Ajukan Reimbursement" */}
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Tabel daftar pengajuan reimbursement */}
      <RequestsTable<Row>
        loading={loading} // tampilkan skeleton saat data sedang dimuat
        rows={rows} // data baris tabel
        columns={columns} // definisi kolom tabel
        rowKey="id" // key unik tiap baris
        emptyText={t('reimbursement.emptyList')} // teks saat tabel kosong
        onRowClick={(r) => openDetail(r.id)} // klik baris → buka modal detail
        // ── Tampilan mobile (card list, bukan tabel) ──────────────────────────
        mobileRender={(r) => (
          <div>
            {/* Baris pertama: total nilai reimbursement (tebal) + status badge */}
            <div className="flex items-center justify-between">
              <div className="font-semibold">{formatRupiah(r.totalAmount)}</div> {/* nilai total dalam Rupiah */}
              <StatusBadge status={r.status} /> {/* badge status */}
            </div>

            {/* Jumlah item dan tanggal pengajuan */}
            <div className="text-xs text-muted mt-1">
              {r.items.length} {t('approvals.itemsSuffix')} · {formatDate(r.createdAt)}
            </div>

            {/* Ringkasan deskripsi item reimbursement (max 2 baris) */}
            <div className="text-sm mt-1 line-clamp-2">{itemSummary(r.items)}</div>

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

      {/* Modal detail pengajuan reimbursement — readOnly karena ini tampilan user sendiri */}
      <ApprovalModal
        open={detailOpen} // kontrol buka/tutup modal
        item={detailItem} // data yang ditampilkan (null = loading)
        onClose={() => setDetailOpen(false)} // tutup modal saat klik backdrop atau tombol close
        onDone={() => setDetailOpen(false)} // tutup modal setelah aksi selesai
        readOnly // mode read-only: sembunyikan tombol approve/reject
      />
    </div>
  );
}

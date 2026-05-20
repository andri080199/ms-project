'use client'; // tandai komponen ini sebagai Client Component agar bisa pakai useState, useEffect, dll.

// ─── Import library UI dari Ant Design ───────────────────────────────────────
import { App, Button, Popconfirm } from 'antd';
// App      → menyediakan context untuk message/notification global
// Button   → tombol UI Ant Design
// Popconfirm → dialog konfirmasi kecil sebelum aksi destruktif (batalkan)

// ─── Import ikon dari Ant Design Icons ───────────────────────────────────────
import { PlusOutlined, CloseCircleOutlined } from '@ant-design/icons';
// PlusOutlined       → ikon "+" untuk tombol tambah pengajuan baru
// CloseCircleOutlined → ikon "×" untuk tombol batalkan pengajuan

// ─── Import utilitas routing Next.js ─────────────────────────────────────────
import Link from 'next/link'; // komponen Link Next.js untuk navigasi client-side tanpa reload

// ─── Import React hooks ──────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
// useEffect → menjalankan efek samping (fetch data) setelah render
// useMemo   → memoize nilai agar tidak dihitung ulang setiap render
// useState  → menyimpan state lokal komponen

// ─── Import komponen internal ─────────────────────────────────────────────────
import RequestsTable from '@/components/RequestsTable';   // tabel generik untuk semua jenis pengajuan
import StatusBadge from '@/components/StatusBadge';       // badge warna yang menampilkan status pengajuan
import ApprovalModal from '@/components/ApprovalModal';   // modal detail + timeline approval
import PageHeader, { PageTitle } from '@/components/PageHeader'; // header halaman (judul + tombol aksi)
import ColTitle from '@/components/ColTitle';             // judul kolom tabel dengan garis aksen

// ─── Import fungsi format tanggal & waktu ────────────────────────────────────
import { formatDate, formatTime } from '@/lib/utils';
// formatDate → format Date menjadi "DD MMM YYYY" (contoh: 15 Jan 2025)
// formatTime → format Date menjadi "HH:mm" (contoh: 08:30)

// ─── Import tipe data ─────────────────────────────────────────────────────────
import type { ColumnsType } from 'antd/es/table'; // tipe definisi kolom untuk AntD Table
import type { OvertimeRequest } from '@prisma/client'; // tipe model overtime dari Prisma (sesuai skema DB)
import type { InboxItem, OvertimeWithUser } from '@/lib/types'; // tipe InboxItem (union) dan OvertimeWithUser (dengan relasi user)

// ─── Import i18n (internasionalisasi) ────────────────────────────────────────
import { useFormatters, useT } from '@/lib/i18n/provider';
// useT          → fungsi translate `t('key')` berdasarkan locale aktif
// useFormatters → kumpulan formatter yang locale-aware (misal minutesToReadable)

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama halaman daftar overtime milik user yang sedang login
// ─────────────────────────────────────────────────────────────────────────────
export default function OvertimeListPage() {
  // State: array data overtime yang ditampilkan di tabel
  const [rows, setRows] = useState<OvertimeRequest[]>([]);

  // State: true selama data pertama kali sedang di-fetch (menampilkan skeleton)
  const [loading, setLoading] = useState(true);

  // State: id pengajuan yang sedang dalam proses pembatalan (untuk menampilkan loading pada tombol)
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // State: item yang sedang dibuka di modal detail (null = belum ada)
  const [detailItem, setDetailItem] = useState<InboxItem | null>(null);

  // State: apakah modal detail sedang terbuka
  const [detailOpen, setDetailOpen] = useState(false);

  // Fungsi translate berdasarkan locale aktif (id/en)
  const t = useT();

  // Destruktur minutesToReadable dari useFormatters → mengubah menit ke format "X jam Y menit"
  const { minutesToReadable } = useFormatters();

  // Ambil fungsi `message` dari App context AntD untuk menampilkan notifikasi toast
  const { message } = App.useApp();

  // ─── Fetch data overtime saat komponen pertama kali mount ──────────────────
  useEffect(() => {
    // Buat AbortController untuk membatalkan fetch jika komponen di-unmount sebelum selesai
    const ctrl = new AbortController();

    // IIFE async agar bisa pakai await di dalam useEffect
    (async () => {
      try {
        // Fetch daftar overtime milik user dari API
        // cache: 'no-store' → selalu ambil data terbaru, tidak pakai cache browser
        // signal: ctrl.signal → fetch ini bisa dibatalkan via ctrl.abort()
        const res = await fetch('/api/overtime', { cache: 'no-store', signal: ctrl.signal });

        // Parse response JSON
        const json = await res.json();

        // Jika API berhasil, simpan data ke state rows
        if (json.success) setRows(json.data);

        // Matikan indikator loading setelah data diterima
        setLoading(false);
      } catch (err) {
        // AbortError terjadi saat ctrl.abort() dipanggil (komponen unmount) → abaikan
        // Error lain (network, dsb) → tetap matikan loading agar UI tidak stuck
        if ((err as { name?: string })?.name !== 'AbortError') setLoading(false);
      }
    })();

    // Cleanup: batalkan fetch jika komponen unmount sebelum fetch selesai
    return () => ctrl.abort();
  }, []); // [] → hanya jalan sekali saat mount

  // ─── Helper: cek apakah status pengajuan masih bisa dibatalkan ─────────────
  // Hanya SUBMITTED dan DRAFT yang bisa dibatalkan; APPROVED/REJECTED/CANCELLED tidak bisa
  const isCancellable = (status: string) => status === 'SUBMITTED' || status === 'DRAFT';

  // ─── Handler: membatalkan pengajuan overtime ────────────────────────────────
  const handleCancel = async (id: string) => {
    // Tandai id ini sedang dalam proses cancel (tombol tampilkan loading spinner)
    setCancellingId(id);

    try {
      // Kirim DELETE ke API untuk membatalkan pengajuan dengan id tersebut
      const res = await fetch(`/api/overtime/${id}`, { method: 'DELETE' });

      // Parse response JSON dari API
      const json = await res.json();

      if (json.success) {
        // Update state rows secara optimistik: ganti status jadi CANCELLED tanpa fetch ulang
        // Ini lebih cepat daripada reload seluruh daftar dari server
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'CANCELLED' } : r)));

        // Tampilkan toast sukses
        message.success(t('common.cancelSuccess'));
      } else {
        // Tampilkan pesan error dari server, atau fallback ke pesan default
        message.error(json.error || t('common.cancelFailed'));
      }
    } catch {
      // Catch error jaringan (misal koneksi putus)
      message.error(t('common.cancelFailed'));
    } finally {
      // Selalu reset cancellingId setelah selesai (baik sukses maupun error)
      setCancellingId(null);
    }
  };

  // ─── Handler: membuka modal detail untuk satu pengajuan ────────────────────
  const openDetail = async (id: string) => {
    // Buka modal langsung (tampilkan loading spinner di dalam modal)
    setDetailOpen(true);

    // Kosongkan data sebelumnya agar modal tidak sempat menampilkan data lama
    setDetailItem(null);

    try {
      // Fetch detail lengkap pengajuan beserta user + approval history
      const res = await fetch(`/api/overtime/${id}`, { cache: 'no-store' });

      // Parse response
      const json = await res.json();

      if (json.success) {
        // Bungkus data ke dalam shape InboxItem dengan kind 'overtime'
        // ApprovalModal menerima InboxItem sebagai discriminated union
        setDetailItem({ kind: 'overtime', data: json.data as OvertimeWithUser });
      } else {
        // Tampilkan error dan tutup modal jika fetch gagal
        message.error(json.error || t('common.detailLoadFailed'));
        setDetailOpen(false);
      }
    } catch {
      // Error jaringan: tutup modal dan tampilkan pesan error
      message.error(t('common.detailLoadFailed'));
      setDetailOpen(false);
    }
  };

  // ─── Definisi kolom tabel untuk desktop ────────────────────────────────────
  // Dibungkus useMemo agar tidak direkonstruksi setiap render
  // Dependency: [t, minutesToReadable, cancellingId]
  //   - t & minutesToReadable berubah saat locale berganti → kolom perlu di-rebuild
  //   - cancellingId berubah agar tombol loading di kolom Actions update
  const columns: ColumnsType<OvertimeRequest> = useMemo(
    () => [
      {
        // Kolom Tanggal: menampilkan tanggal overtime dalam format "DD MMM YYYY"
        title: <ColTitle label={t('overtime.colDate')} />,
        dataIndex: 'date',           // ambil nilai dari field `date` di data row
        render: (v) => formatDate(v), // format Date object ke string yang readable
      },
      {
        // Kolom Tipe: PREMIUM_SHIFT atau OVERDAYS → diterjemahkan ke label yang readable
        title: <ColTitle label={t('overtime.colType')} />,
        dataIndex: 'overtimeType',
        render: (v: 'PREMIUM_SHIFT' | 'OVERDAYS') =>
          v === 'PREMIUM_SHIFT' ? t('overtime.typePremiumShift') : t('overtime.typeOverdays'),
      },
      {
        // Kolom Jam Mulai: diambil dari field startTime dan diformat ke "HH:mm"
        title: <ColTitle label={t('overtime.colTime')} />,
        render: (_, r) => formatTime(r.startTime), // r = seluruh row, bukan satu field
      },
      {
        // Kolom Durasi: menit dikonversi ke format "X jam Y menit" via minutesToReadable
        title: <ColTitle label={t('overtime.colDuration')} />,
        dataIndex: 'durationMinutes',
        render: (v) => minutesToReadable(v),
      },
      {
        // Kolom Alasan: teks alasan overtime, dipotong dengan ellipsis jika terlalu panjang
        title: <ColTitle label={t('overtime.colReason')} />,
        dataIndex: 'reason',
        ellipsis: true, // teks panjang akan terpotong (...) daripada memperlebar kolom
      },
      {
        // Kolom Lampiran: link "Lihat" jika ada file, atau "—" jika tidak ada
        title: <ColTitle label={t('overtime.colAttachment')} />,
        dataIndex: 'attachmentUrl',
        render: (v: string | null) =>
          v ? (
            // Ada lampiran: tampilkan link yang membuka file di tab baru
            // stopPropagation mencegah klik link memicu onRowClick (yang membuka modal)
            <a
              href={v}
              target="_blank"
              rel="noreferrer"
              className="text-primary-light underline"
              onClick={(e) => e.stopPropagation()}
            >
              {t('common.view')}
            </a>
          ) : (
            // Tidak ada lampiran: tampilkan tanda "—"
            <span className="text-muted">—</span>
          ),
      },
      {
        // Kolom Status: badge warna yang merepresentasikan status pengajuan
        title: <ColTitle label={t('overtime.colStatus')} />,
        dataIndex: 'status',
        render: (v) => <StatusBadge status={v} />, // StatusBadge menangani mapping status → warna+label
      },
      {
        // Kolom Aksi: tombol batalkan jika masih bisa dibatalkan, "—" jika tidak
        title: <ColTitle label={t('common.actions')} />,
        key: 'actions',
        width: 140, // lebar tetap agar kolom tidak melebar/mengecil
        // stopPropagation di level cell agar klik tombol tidak memicu onRowClick modal
        onCell: () => ({ onClick: (e) => e.stopPropagation() }),
        render: (_, r) =>
          isCancellable(r.status) ? (
            // Tampilkan Popconfirm (konfirmasi "Yakin mau batalkan?") sebelum memanggil handleCancel
            <Popconfirm
              title={t('common.cancelConfirmTitle')}       // judul dialog konfirmasi
              description={t('common.cancelConfirmDesc')}  // deskripsi peringatan di dialog
              okText={t('common.yes')}                     // label tombol konfirmasi
              cancelText={t('common.no')}                  // label tombol batal
              okButtonProps={{
                danger: true,                    // tombol OK berwarna merah (destruktif)
                loading: cancellingId === r.id,  // tampilkan spinner saat baris ini sedang dibatalkan
              }}
              onConfirm={() => handleCancel(r.id)} // panggil handleCancel setelah user konfirmasi
            >
              <Button danger size="small" icon={<CloseCircleOutlined />}>
                {t('common.cancelRequest')}
              </Button>
            </Popconfirm>
          ) : (
            // Status tidak bisa dibatalkan (APPROVED, REJECTED, CANCELLED): tampilkan "—"
            <span className="text-muted">—</span>
          ),
      },
    ],
    [t, minutesToReadable, cancellingId], // rebuild columns jika locale atau cancellingId berubah
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    // Container utama dengan gap vertikal antar section
    <div className="space-y-6">

      {/* PageHeader: area judul halaman + tombol aksi di kanan */}
      <PageHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Judul dan subjudul halaman */}
          <PageTitle title={t('overtime.title')} subtitle={t('overtime.subtitle')} />

          {/* Tombol "Ajukan Overtime" yang mengarah ke halaman form baru */}
          <Link href="/overtime/new">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              {t('overtime.submit')}
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/*
        RequestsTable: tabel generik yang menangani loading skeleton, empty state,
        dan mobile card fallback secara otomatis.
        Props:
          loading    → tampilkan skeleton saat data sedang di-fetch
          rows       → array data yang ditampilkan
          columns    → definisi kolom (desktop table)
          rowKey     → field unik untuk React key (id pengajuan)
          emptyText  → teks yang ditampilkan saat rows kosong
          onRowClick → callback saat baris di-klik (buka modal detail)
          mobileRender → render fungsi custom untuk tampilan kartu di mobile
      */}
      <RequestsTable<OvertimeRequest>
        loading={loading}
        rows={rows}
        columns={columns}
        rowKey="id"
        emptyText={t('overtime.emptyList')}
        onRowClick={(r) => openDetail(r.id)} // klik baris → fetch detail → buka modal
        mobileRender={(r) => (
          // Layout kartu untuk tampilan mobile (menggantikan tabel)
          <div>
            {/* Baris atas: tanggal di kiri, badge status di kanan */}
            <div className="flex items-center justify-between">
              <div className="font-semibold">{formatDate(r.date)}</div>
              <StatusBadge status={r.status} />
            </div>

            {/* Info ringkas: tipe overtime · jam mulai · durasi */}
            <div className="text-xs text-muted mt-1">
              {r.overtimeType === 'PREMIUM_SHIFT'
                ? t('overtime.typePremiumShift')
                : t('overtime.typeOverdays')}{' '}
              · {formatTime(r.startTime)} · {minutesToReadable(r.durationMinutes)}
            </div>

            {/* Alasan overtime, dipotong 2 baris jika terlalu panjang */}
            <div className="text-sm mt-2 line-clamp-2">{r.reason}</div>

            {/* Tampilkan link lampiran hanya jika ada */}
            {r.attachmentUrl && (
              <a
                href={r.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()} // cegah klik membuka modal
                className="text-xs text-primary-light underline mt-1 inline-block"
              >
                {t('common.viewAttachment')}
              </a>
            )}

            {/* Tombol batalkan: hanya muncul jika status masih SUBMITTED/DRAFT */}
            {isCancellable(r.status) && (
              // stopPropagation di div wrapper agar klik area ini tidak trigger onRowClick
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <Popconfirm
                  title={t('common.cancelConfirmTitle')}
                  description={t('common.cancelConfirmDesc')}
                  okText={t('common.yes')}
                  cancelText={t('common.no')}
                  okButtonProps={{
                    danger: true,
                    loading: cancellingId === r.id, // spinner khusus untuk baris yang sedang dibatalkan
                  }}
                  onConfirm={() => handleCancel(r.id)}
                >
                  <Button danger size="small" icon={<CloseCircleOutlined />}>
                    {t('common.cancelRequest')}
                  </Button>
                </Popconfirm>
              </div>
            )}
          </div>
        )}
      />

      {/*
        ApprovalModal: modal read-only yang menampilkan detail pengajuan lengkap
        beserta timeline approval (siapa yang approve/reject dan kapan).
        Props:
          open     → kontrol buka/tutup modal
          item     → data pengajuan yang ditampilkan (null = loading)
          onClose  → callback saat modal ditutup tanpa aksi
          onDone   → callback setelah aksi selesai (di sini sama dengan onClose karena read-only)
          readOnly → nonaktifkan tombol approve/reject (hanya tampilkan detail)
      */}
      <ApprovalModal
        open={detailOpen}
        item={detailItem}
        onClose={() => setDetailOpen(false)} // tutup modal
        onDone={() => setDetailOpen(false)}  // setelah done (di sini sama saja karena readOnly)
        readOnly // mode baca saja: sembunyikan tombol approve/reject
      />
    </div>
  );
}

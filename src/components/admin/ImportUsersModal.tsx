'use client'; // tandai sebagai Client Component karena butuh useState dan interaksi pengguna

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { App, Alert, Button, Modal, Table, Tag, Upload } from 'antd';
// App    → context global untuk message/notification
// Alert  → banner pesan info/sukses/error
// Button → tombol aksi
// Modal  → dialog overlay multi-step
// Table  → tabel hasil preview import
// Tag    → label berwarna untuk status aksi (CREATE/UPDATE/ERROR)
// Upload → komponen upload file (dipakai sebagai Dragger)

import type { ColumnsType } from 'antd/es/table'; // tipe definisi kolom tabel AntD
import { InboxOutlined } from '@ant-design/icons'; // ikon inbox untuk area drag-drop upload
import { useState } from 'react'; // hook state React
import { parseCsv } from '@/lib/csv'; // parser CSV untuk membaca file yang di-upload
import { useT } from '@/lib/i18n/provider'; // hook fungsi terjemahan string

// Tipe aksi per baris dalam hasil import
type Action = 'CREATE' | 'UPDATE' | 'ERROR';

// Tipe satu baris hasil import (dari dry-run atau commit)
type ImportResult = {
  index: number; // nomor baris dalam CSV (1-based)
  email: string; // email karyawan dari CSV
  name: string; // nama karyawan dari CSV
  action: Action; // aksi yang akan/sudah dilakukan
  message?: string; // pesan error/info opsional
};

// Tipe ringkasan hasil import
type Summary = {
  total: number; // total baris yang diproses
  create: number; // jumlah baris yang akan/sudah di-CREATE
  update: number; // jumlah baris yang akan/sudah di-UPDATE
  error: number; // jumlah baris yang gagal validasi
};

// Modal melewati tiga tahap:
//   upload  — user menjatuhkan atau memilih file CSV
//   preview — hasil dry-run ditampilkan; user bisa konfirmasi atau kembali
//   done    — import nyata selesai; menampilkan statistik akhir
type Stage = 'upload' | 'preview' | 'done';

// Tipe props komponen ImportUsersModal
type Props = {
  open: boolean; // kontrol buka/tutup modal
  onClose: () => void; // callback saat modal ditutup
  // Dipanggil setelah import nyata (bukan dry-run) selesai agar parent bisa refresh daftar
  onImported: () => void;
};

// Konfigurasi warna dan label untuk setiap kemungkinan aksi baris di tabel preview
const ACTION_TONE: Record<Action, { color: string; labelKey: string }> = {
  CREATE: { color: 'green', labelKey: 'adminUsers.importActionCreate' }, // hijau — buat akun baru
  UPDATE: { color: 'blue', labelKey: 'adminUsers.importActionUpdate' }, // biru — update akun yang ada
  ERROR: { color: 'red', labelKey: 'adminUsers.importActionError' }, // merah — validasi gagal
};

// Modal untuk mengimpor karyawan dari file CSV.
// Menggunakan pendekatan dua-fase: dry-run dulu untuk menampilkan preview,
// lalu import nyata setelah konfirmasi.
// Pencocokan dilakukan berdasarkan kolom `email` — email yang sudah ada → UPDATE, email baru → CREATE.
export default function ImportUsersModal({ open, onClose, onImported }: Props) {
  const t = useT(); // fungsi terjemahan
  const { message } = App.useApp(); // API notifikasi global AntD

  // ─── State modal ───────────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>('upload'); // tahap modal saat ini
  const [filename, setFilename] = useState<string>(''); // nama file CSV yang dipilih
  const [rows, setRows] = useState<Record<string, string>[]>([]); // baris data yang diparsing dari CSV
  const [results, setResults] = useState<ImportResult[]>([]); // hasil dry-run atau import nyata per baris
  const [summary, setSummary] = useState<Summary | null>(null); // ringkasan statistik hasil import
  const [loading, setLoading] = useState(false); // true saat sedang proses dry-run atau commit

  // ─── Reset semua state ke tahap upload awal ─────────────────────────────────
  function reset() {
    setStage('upload'); // kembali ke tahap pertama
    setFilename(''); // hapus nama file
    setRows([]); // hapus data CSV
    setResults([]); // hapus hasil
    setSummary(null); // hapus ringkasan
    setLoading(false); // matikan loading
  }

  // ─── Handler tutup modal — cegah penutupan saat proses berjalan ─────────────
  function handleClose() {
    if (loading) return; // jangan tutup saat sedang proses import
    reset(); // reset state
    onClose(); // panggil callback parent
  }

  // ─── Handler file yang dipilih/dijatuhkan ────────────────────────────────────
  // Parse file CSV yang dipilih, validasi, dan jalankan dry-run ke server untuk preview.
  async function handleFile(file: File): Promise<boolean> {
    try {
      // Validasi ekstensi file — hanya CSV yang diizinkan
      if (!file.name.toLowerCase().endsWith('.csv')) {
        message.error(t('adminUsers.importNotCsv')); // tampilkan error format file
        return false;
      }

      const text = await file.text(); // baca isi file sebagai string
      const parsed = parseCsv(text); // parse CSV ke header + array objek baris

      // Validasi: file harus memiliki minimal 1 baris data
      if (parsed.rows.length === 0) {
        message.error(t('adminUsers.importEmpty')); // tampilkan error file kosong
        return false;
      }

      // Validasi: file harus memiliki kolom 'email' (sebagai identifier pencocokan)
      if (!parsed.headers.includes('email')) {
        message.error(t('adminUsers.importMissingEmail')); // tampilkan error kolom email tidak ada
        return false;
      }

      setFilename(file.name); // simpan nama file untuk ditampilkan di preview
      setRows(parsed.rows); // simpan data CSV untuk dipakai saat commit
      setLoading(true); // aktifkan loading saat dry-run berjalan

      try {
        // Kirim baris data ke API dengan dryRun: true — server validasi tapi tidak tulis ke DB
        const res = await fetch('/api/admin/users/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: parsed.rows, dryRun: true }), // dry-run mode
        });
        const json = await res.json(); // parse response

        // Jika dry-run gagal di sisi server
        if (!res.ok || !json.success) {
          message.error(json.error ?? t('common.errorDefault'));
          return false;
        }

        // Simpan hasil dry-run dan pindah ke tahap preview
        setResults(json.data.results); // detail per baris (CREATE/UPDATE/ERROR)
        setSummary(json.data.summary); // ringkasan statistik
        setStage('preview'); // tampilkan tabel preview
      } finally {
        setLoading(false); // matikan loading setelah dry-run selesai
      }
    } catch (e) {
      message.error((e as Error).message); // tampilkan error parsing/jaringan
    }
    return false; // selalu kembalikan false agar AntD Upload tidak melakukan upload sendiri
  }

  // ─── Handler commit — import nyata setelah user konfirmasi preview ──────────
  async function commit() {
    setLoading(true); // aktifkan loading

    try {
      // Kirim data yang sama ke API dengan dryRun: false — tulis ke database
      const res = await fetch('/api/admin/users/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, dryRun: false }), // commit mode
      });
      const json = await res.json(); // parse response

      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.errorDefault')); // tampilkan error
        return;
      }

      // Import berhasil: update hasil final dan pindah ke tahap done
      setResults(json.data.results); // hasil final per baris
      setSummary(json.data.summary); // statistik akhir
      setStage('done'); // tampilkan halaman selesai
      onImported(); // beritahu parent untuk refresh daftar karyawan
    } finally {
      setLoading(false); // matikan loading
    }
  }

  // ─── Definisi kolom tabel hasil preview/done ────────────────────────────────
  const columns: ColumnsType<ImportResult> = [
    {
      // Kolom: nomor baris dalam CSV
      title: t('adminUsers.importColRow'),
      dataIndex: 'index',
      width: 60,
    },
    {
      // Kolom: aksi yang dilakukan (CREATE/UPDATE/ERROR) — ditampilkan sebagai tag berwarna
      title: t('adminUsers.importColAction'),
      dataIndex: 'action',
      width: 110,
      render: (a: Action) => {
        const tone = ACTION_TONE[a]; // ambil konfigurasi warna dan label
        return <Tag color={tone.color}>{t(tone.labelKey)}</Tag>; // render tag berwarna
      },
    },
    {
      // Kolom: email karyawan dari CSV
      title: t('adminUsers.importColEmail'),
      dataIndex: 'email',
      ellipsis: true, // potong jika terlalu panjang
    },
    {
      // Kolom: nama karyawan dari CSV
      title: t('adminUsers.importColName'),
      dataIndex: 'name',
      ellipsis: true,
    },
    {
      // Kolom: pesan error/info opsional per baris
      title: t('adminUsers.importColMessage'),
      dataIndex: 'message',
      render: (m: string | undefined) =>
        m ? <span className="text-xs text-muted">{m}</span> : <span className="text-xs text-muted">—</span>,
    },
  ];

  // Blokir commit jika ada baris dengan error dalam hasil dry-run
  const blocked = stage === 'preview' && (summary?.error ?? 0) > 0;

  // ─── Tombol footer dinamis berdasarkan tahap saat ini ───────────────────────
  const footer =
    stage === 'upload'
      ? [
          // Tahap upload: hanya tombol batal
          <Button key="close" onClick={handleClose} disabled={loading}>
            {t('adminUsers.btnCancel')}
          </Button>,
        ]
      : stage === 'preview'
      ? [
          // Tahap preview: tombol kembali + tombol konfirmasi import
          <Button key="back" onClick={reset} disabled={loading}>
            {t('adminUsers.importBack')} {/* kembali ke tahap upload */}
          </Button>,
          <Button
            key="commit"
            type="primary"
            loading={loading} // loading saat commit berjalan
            // Dinonaktifkan jika ada error ATAU tidak ada yang perlu di-CREATE/UPDATE
            disabled={blocked || (summary?.create ?? 0) + (summary?.update ?? 0) === 0}
            onClick={commit} // eksekusi import nyata
          >
            {t('adminUsers.importCommit')} {/* "Import Sekarang" */}
          </Button>,
        ]
      : [
          // Tahap done: hanya tombol tutup
          <Button key="done" type="primary" onClick={handleClose}>
            {t('adminUsers.importDoneClose')} {/* "Tutup" */}
          </Button>,
        ];

  // ─── Render modal ─────────────────────────────────────────────────────────
  return (
    <Modal
      open={open} // kontrol buka/tutup
      onCancel={handleClose} // handler klik backdrop atau tombol X
      title={t('adminUsers.importTitle')} // judul modal: "Import Karyawan dari CSV"
      width={920} // lebar modal cukup untuk tabel hasil preview
      destroyOnHidden // hancurkan saat hidden agar state reset saat dibuka kembali
      maskClosable={!loading} // cegah klik backdrop menutup modal saat proses berjalan
      footer={footer} // footer dinamis sesuai tahap
    >
      {/* ── Tahap 1: file picker dengan instruksi ──────────────────────────── */}
      {stage === 'upload' && (
        <div className="space-y-4 pt-2">
          {/* Banner info: petunjuk format CSV dan link template */}
          <Alert
            type="info"
            showIcon
            message={t('adminUsers.importHint')} // judul hint
            description={
              <div className="text-xs space-y-1">
                <div>{t('adminUsers.importHintMatch')}</div> {/* penjelasan pencocokan email */}
                <div>{t('adminUsers.importHintEmpty')}</div> {/* penjelasan kolom kosong */}
                <div>
                  {/* Link unduh template CSV contoh */}
                  <a
                    href="/api/admin/users/export?template=1" // endpoint template
                    className="underline"
                    style={{ color: 'rgb(var(--color-primary-light))' }}
                  >
                    {t('adminUsers.csvTemplate')} {/* "Unduh Template CSV" */}
                  </a>
                </div>
              </div>
            }
          />

          {/* Area drag-drop upload file CSV */}
          <Upload.Dragger
            accept=".csv,text/csv" // hanya terima file CSV
            multiple={false} // hanya satu file sekaligus
            showUploadList={false} // jangan tampilkan daftar file yang dipilih
            beforeUpload={handleFile} // handler file yang dipilih (menjalankan dry-run)
            disabled={loading} // nonaktifkan saat sedang proses
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined /> {/* ikon inbox besar */}
            </p>
            <p className="ant-upload-text">{t('adminUsers.importDropTitle')}</p> {/* "Klik atau seret file ke sini" */}
            <p className="ant-upload-hint">{t('adminUsers.importDropHint')}</p> {/* "Hanya file .csv" */}
          </Upload.Dragger>

          {/* Teks loading saat dry-run berjalan */}
          {loading && <div className="text-center text-sm text-muted">{t('adminUsers.importValidating')}</div>}
        </div>
      )}

      {/* ── Tahap 2 & 3: tabel hasil preview/done dengan banner ringkasan ──── */}
      {(stage === 'preview' || stage === 'done') && summary && (
        <div className="space-y-3 pt-2">
          {/* Banner ringkasan: hijau saat done, merah saat ada error, biru saat normal */}
          <Alert
            type={stage === 'done' ? 'success' : blocked ? 'error' : 'info'}
            showIcon
            message={
              <div className="font-semibold">
                {/* Judul: "Import Selesai" atau nama file CSV */}
                {stage === 'done' ? t('adminUsers.importDone') : filename}
              </div>
            }
            description={
              // Statistik: total, create, update, error
              <div className="text-xs flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <span>
                  {t('adminUsers.importStatTotal')}: <b>{summary.total}</b> {/* total baris */}
                </span>
                <span style={{ color: 'rgb(var(--color-success))' }}>
                  {t('adminUsers.importStatCreate')}: <b>{summary.create}</b> {/* baru dibuat */}
                </span>
                <span style={{ color: 'rgb(var(--color-primary-light))' }}>
                  {t('adminUsers.importStatUpdate')}: <b>{summary.update}</b> {/* diperbarui */}
                </span>
                <span style={{ color: 'rgb(var(--color-danger))' }}>
                  {t('adminUsers.importStatError')}: <b>{summary.error}</b> {/* error */}
                </span>
              </div>
            }
          />

          {/* Banner peringatan tambahan jika ada error yang memblokir commit */}
          {blocked && (
            <Alert type="warning" showIcon message={t('adminUsers.importBlocked')} />
          )}

          {/* Tabel detail hasil per baris */}
          <Table<ImportResult>
            dataSource={results} // data hasil per baris
            columns={columns} // definisi kolom tabel
            rowKey="index" // key unik = nomor baris
            size="small" // tampilan compact
            pagination={{ pageSize: 10, showSizeChanger: false }} // 10 baris per halaman
            scroll={{ x: 720 }} // scroll horizontal jika tabel terlalu lebar
          />
        </div>
      )}
    </Modal>
  );
}

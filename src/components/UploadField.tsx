'use client'; // tandai sebagai Client Component karena butuh useState, useEffect, dan fetch

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { App, Button, Upload } from 'antd';
// App    → context global untuk message/notification
// Button → tombol "Pilih File" yang ditampilkan saat belum ada file
// Upload → komponen upload AntD yang mengelola daftar file dan status

import { UploadOutlined } from '@ant-design/icons'; // ikon upload (panah ke atas)
import type { UploadFile } from 'antd'; // tipe deskriptor file dalam fileList AntD
import { useEffect, useState } from 'react'; // hooks React dasar
import { useT } from '@/lib/i18n/provider'; // hook fungsi terjemahan string

// Tipe props komponen UploadField
type Props = {
  // Nilai URL saat ini yang dikelola oleh field form parent (controlled component)
  value?: string | null;
  // Callback yang dipanggil dengan URL setelah upload berhasil,
  // atau `undefined` saat file dihapus
  onChange?: (url: string | undefined) => void;
  accept?: string; // tipe MIME yang diterima (default: gambar + PDF)
  buttonLabel?: string; // label tombol upload kustom
};

// Wrapper Upload Ant Design yang menyimpan file via `/api/upload` dan mengekspos
// string URL biasa ke field form parent. Merender tombol upload satu file
// dengan preview file yang sudah tersimpan.
export default function UploadField({
  value, // URL file saat ini (dari form parent)
  onChange, // callback untuk memberitahu form parent URL baru atau undefined
  accept = 'image/png,image/jpeg,image/webp,application/pdf', // tipe file yang diterima
  buttonLabel, // label tombol kustom (opsional)
}: Props) {
  const { message } = App.useApp(); // API notifikasi global AntD
  const t = useT(); // fungsi terjemahan
  const [uploading, setUploading] = useState(false); // State: true saat file sedang di-upload ke server
  const [fileList, setFileList] = useState<UploadFile[]>([]); // State: daftar file yang ditampilkan AntD Upload
  const label = buttonLabel ?? t('upload.defaultButton'); // label tombol: kustom atau default dari terjemahan

  // Sinkronkan tampilan fileList AntD setiap kali prop `value` berubah (dari form parent)
  useEffect(() => {
    if (value) {
      // Ada URL: tampilkan file dalam kondisi "done" dengan nama diambil dari akhir URL
      setFileList([
        {
          uid: '-1', // uid wajib ada di AntD, '-1' untuk file yang sudah ada
          name: value.split('/').pop() ?? 'file', // ambil nama file dari akhir path URL
          status: 'done', // status: file sudah berhasil diupload
          url: value, // URL file untuk link preview
        },
      ]);
    } else {
      setFileList([]); // tidak ada nilai: kosongkan daftar file
    }
  }, [value]); // re-run setiap kali value dari parent berubah

  // ─── Fungsi upload file ke server ─────────────────────────────────────────
  // Mengunggah File ke server dan mengembalikan URL hasil upload, atau null jika gagal.
  async function doUpload(file: File): Promise<string | null> {
    const fd = new FormData(); // buat FormData untuk mengirim file sebagai multipart
    fd.append('file', file); // tambahkan file dengan key 'file' sesuai yang diharapkan API
    setUploading(true); // aktifkan loading state tombol

    try {
      // Kirim file ke endpoint upload
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json(); // parse response

      // Jika HTTP status error atau API mengembalikan success: false
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('upload.failed')); // tampilkan pesan error
        return null; // kembalikan null untuk memberi tahu caller bahwa upload gagal
      }

      return json.data.url as string; // kembalikan URL file yang sudah di-upload
    } catch {
      // Error jaringan atau parsing
      message.error(t('upload.failed')); // tampilkan pesan gagal
      return null;
    } finally {
      setUploading(false); // matikan loading state (baik sukses maupun gagal)
    }
  }

  // ─── Render komponen Upload ────────────────────────────────────────────────
  return (
    <Upload
      accept={accept} // filter tipe file yang bisa dipilih di dialog file browser
      fileList={fileList} // daftar file yang dikontrol (controlled mode)
      maxCount={1} // hanya izinkan 1 file sekaligus
      // Hook sebelum upload: dijalankan saat user memilih file
      beforeUpload={async (file) => {
        // Upload file ke server dan dapatkan URL-nya
        const url = await doUpload(file);

        if (url) {
          // Upload berhasil: perbarui fileList untuk tampilan preview
          setFileList([{ uid: '-1', name: file.name, status: 'done', url }]);
          // Beritahu form parent dengan URL baru agar nilai form field diperbarui
          onChange?.(url);
        }

        // Kembalikan false untuk mencegah mekanisme upload bawaan AntD
        // (kita sudah handle upload sendiri via doUpload di atas)
        return false;
      }}
      // Hook saat user menghapus file yang sudah dipilih
      onRemove={() => {
        setFileList([]); // kosongkan daftar file di tampilan
        onChange?.(undefined); // beritahu form parent bahwa nilai dihapus
        return true; // konfirmasi penghapusan ke AntD
      }}
    >
      {/* Tombol "Pilih File" — hanya tampil saat belum ada file yang dipilih */}
      {fileList.length === 0 && (
        <Button icon={<UploadOutlined />} loading={uploading}>
          {label} {/* label tombol: kustom atau default ("Pilih File") */}
        </Button>
      )}
    </Upload>
  );
}

import dayjs from 'dayjs'; // library tanggal ringan untuk parsing, formatting, dan kalkulasi tanggal

// Format angka sebagai mata uang Rupiah Indonesia tanpa desimal.
// Contoh: 150000 → "Rp 150.000"
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', // format sebagai mata uang
    currency: 'IDR', // kode mata uang: Rupiah Indonesia
    maximumFractionDigits: 0, // tidak tampilkan sen/desimal
  }).format(amount);
}

// Format nilai tanggal ke string "DD MMM YYYY" (misal: "20 Mei 2026").
// Menerima objek Date atau string ISO.
export function formatDate(input: Date | string): string {
  return dayjs(input).format('DD MMM YYYY');
}

// Format nilai tanggal+waktu ke string "DD MMM YYYY, HH:mm" (misal: "20 Mei 2026, 14:30").
// Dipakai di timeline riwayat persetujuan.
export function formatDateTime(input: Date | string): string {
  return dayjs(input).format('DD MMM YYYY, HH:mm');
}

// Format nilai tanggal atau datetime ke string waktu saja "HH:mm" (misal: "14:30").
// Dipakai untuk menampilkan jam mulai lembur.
export function formatTime(input: Date | string): string {
  return dayjs(input).format('HH:mm');
}

// Konversi durasi dalam menit ke string manusiawi seperti "2 jam 30 menit".
// Dipakai untuk menampilkan durasi lembur di modal detail.
export function minutesToReadable(mins: number): string {
  const h = Math.floor(mins / 60); // hitung jam dari total menit
  const m = mins % 60; // sisa menit setelah jam dihitung
  if (h === 0) return `${m} menit`; // hanya menit: "45 menit"
  if (m === 0) return `${h} jam`; // hanya jam: "2 jam"
  return `${h} jam ${m} menit`; // jam dan menit: "2 jam 30 menit"
}

// Kembalikan true jika ada hari dalam rentang [start, end] yang jatuh pada Sabtu (6) atau Minggu (0).
// Dipakai untuk auto-detect apakah pengajuan perjalanan dinas harus bertipe WEEKEND.
export function isWeekendRange(start: Date, end: Date): boolean {
  const cur = new Date(start); // buat salinan tanggal mulai (tidak modifikasi original)
  cur.setHours(0, 0, 0, 0); // normalisasi ke awal hari (00:00:00.000) agar perbandingan akurat
  const last = new Date(end); // buat salinan tanggal akhir
  last.setHours(0, 0, 0, 0); // normalisasi ke awal hari

  // Iterasi setiap hari dari start sampai end (inklusif)
  while (cur.getTime() <= last.getTime()) {
    const day = cur.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    if (day === 0 || day === 6) return true; // ditemukan akhir pekan, langsung return true
    cur.setDate(cur.getDate() + 1); // maju ke hari berikutnya
  }

  return false; // tidak ada akhir pekan dalam rentang
}

// Bungkus data dalam bentuk response API yang berhasil.
// Semua endpoint API sukses mengembalikan { success: true, data: ... }
export function ok<T>(data: T) {
  return { success: true as const, data };
}

// Bungkus pesan error dalam bentuk response API yang gagal dengan HTTP status code.
// Semua endpoint API gagal mengembalikan { success: false, error: ... } dengan status HTTP yang sesuai.
export function fail(error: string, status = 400) {
  return { body: { success: false as const, error }, status }; // status default 400 Bad Request
}

// UTF-8 BOM — ditambahkan di awal agar Excel membuka CSV dengan encoding yang benar
// Tanpa BOM, Excel mungkin membuka file dengan encoding yang salah (misal: ANSI)
const BOM = '﻿'; // U+FEFF ZERO WIDTH NO-BREAK SPACE

// Tipe sel yang valid dalam tabel CSV
type CsvCell = string | number | boolean | null | undefined;

// Serialize array 2D sel menjadi string CSV (RFC 4180).
// Sel yang mengandung koma, double-quote, atau newline akan di-quote dan di-escape.
// Menambahkan UTF-8 BOM di awal agar file terbuka dengan benar di Excel.
export function formatCsv(headers: string[], rows: CsvCell[][]): string {
  // Fungsi escape untuk satu sel: konversi ke string dan quote jika perlu
  const escape = (v: CsvCell): string => {
    if (v === null || v === undefined) return ''; // null/undefined → string kosong
    const s = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v); // konversi ke string
    // Jika mengandung karakter khusus CSV, bungkus dengan double-quote dan escape quote di dalam
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`; // "" = escaped " dalam RFC 4180
    return s; // tidak ada karakter khusus, kembalikan apa adanya
  };

  // Baris pertama: header kolom
  const lines = [headers.map(escape).join(',')];
  // Baris selanjutnya: setiap row data
  for (const row of rows) lines.push(row.map(escape).join(','));

  // Gabungkan dengan CRLF (standar RFC 4180) dan tambahkan BOM di awal
  return BOM + lines.join('\r\n');
}

// Parse string CSV (dengan atau tanpa BOM) menjadi daftar header dan array objek baris.
// Menggunakan parser state-machine manual untuk menangani field yang di-quote dengan benar,
// termasuk koma dan double-quote yang di-escape di dalam field (RFC 4180 §2).
export function parseCsv(input: string): { headers: string[]; rows: Record<string, string>[] } {
  const text = input.replace(/^﻿/, ''); // hapus BOM di awal jika ada

  // Array 2D sel: setiap elemen adalah satu baris CSV, isinya array string field
  const cells: string[][] = [];
  let row: string[] = []; // baris yang sedang diparse
  let field = ''; // field yang sedang diparse
  let inQuotes = false; // apakah sedang di dalam field yang di-quote
  let i = 0; // posisi karakter saat ini

  // Helper: simpan field yang sudah selesai ke row
  const flushField = () => {
    row.push(field); // tambahkan field ke baris saat ini
    field = ''; // reset buffer field
  };

  // Helper: simpan baris yang sudah selesai ke cells
  const flushRow = () => {
    cells.push(row); // tambahkan baris ke daftar sel
    row = []; // reset buffer baris
  };

  // ── State machine parser karakter per karakter ──────────────────────────
  while (i < text.length) {
    const c = text[i]; // karakter saat ini

    if (inQuotes) {
      // ── Di dalam field yang di-quote ────────────────────────────────────
      if (c === '"') {
        // Dua double-quote berturutan di dalam field yang di-quote → quote literal yang di-escape
        if (text[i + 1] === '"') {
          field += '"'; // tambahkan satu " ke field
          i += 2; // lewati kedua karakter ""
          continue;
        }
        // Double-quote tunggal → akhir dari field yang di-quote
        inQuotes = false;
        i++;
        continue;
      }
      // Karakter lain di dalam quote: tambahkan apa adanya ke field
      field += c;
      i++;
      continue;
    }

    // ── Di luar field yang di-quote ─────────────────────────────────────
    // Pembuka quote — hanya valid di awal field (field masih kosong)
    if (c === '"' && field.length === 0) {
      inQuotes = true; // masuk mode quoted field
      i++;
      continue;
    }

    if (c === ',') { flushField(); i++; continue; } // pemisah field: simpan field, mulai yang baru
    if (c === '\r') { i++; continue; } // abaikan CR dalam CRLF (hanya proses \n)
    if (c === '\n') { flushField(); flushRow(); i++; continue; } // akhir baris: simpan field dan baris

    // Karakter biasa: tambahkan ke buffer field
    field += c;
    i++;
  }

  // Flush konten yang tersisa dari baris terakhir (jika tidak ada newline di akhir)
  if (field.length > 0 || row.length > 0) {
    flushField(); // simpan field terakhir
    flushRow(); // simpan baris terakhir
  }

  // Hapus baris kosong di akhir (misal: dari trailing newline di akhir file)
  while (cells.length > 0 && cells[cells.length - 1].every((c) => c === '')) cells.pop();

  // Jika tidak ada sel yang tersisa, kembalikan hasil kosong
  if (cells.length === 0) return { headers: [], rows: [] };

  // Baris pertama adalah header — trim whitespace dari setiap nama kolom
  const headers = cells[0].map((h) => h.trim());

  // Konversi baris data ke array objek { kolom: nilai }
  const out: Record<string, string>[] = [];
  for (let r = 1; r < cells.length; r++) {
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cells[r][j] ?? ''; // fallback ke string kosong jika kolom tidak ada
    }
    out.push(obj);
  }

  return { headers, rows: out };
}

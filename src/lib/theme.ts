/**
 * Sumber kebenaran tunggal untuk token warna aplikasi FIERSA.
 * Di-mirror sebagai CSS variables di globals.css — pastikan keduanya selalu sinkron.
 *
 * Palet: violet/iris yang diturunkan dari:
 *   #372463 (deep violet) · #5F5082 (medium iris) · #736692 (soft lavender)
 */

// Semua token warna yang dipakai di seluruh aplikasi
export const colors = {
  // ── Warna primer: skala violet/ungu dari terang ke gelap ─────────────────
  primary: {
    50: '#F2F0F7', // sangat terang — latar input/hover ringan
    100: '#E0DAEC', // terang
    200: '#BFB5CE', // agak terang
    300: '#9990AD', // medium — dipakai sebagai primaryLight (teks link)
    400: '#7A6F92', // agak gelap
    500: '#736692', // soft lavender
    600: '#685B82', // medium iris
    700: '#5F5082', // medium iris (lebih gelap) — dipakai sebagai warna tombol
    800: '#4B377A', // gelap
    900: '#372463', // deep violet — warna primer utama
  },

  secondary: '#4B3A73', // ungu sekunder

  // ── Warna aksen untuk highlight / tag ────────────────────────────────────
  accent: {
    fuchsia: '#5F5082', // iris medium
    cyan: '#9990AD', // lavender terang
    mint: '#736692', // soft lavender
  },

  // ── Warna latar belakang ──────────────────────────────────────────────────
  bg: {
    base: '#EEEDF2', // latar body utama (gradient start)
    canvas1: '#F5F3FA', // latar canvas level 1
    canvas2: '#ECE8F2', // latar canvas level 2
    canvas3: '#DFD9EA', // latar canvas level 3 (lebih gelap)
    elevated: '#372463', // deep violet — dipakai sebagai tint glass card
    overlay: '#1F1538', // overlay gelap untuk modal/backdrop
  },

  // ── Warna teks ────────────────────────────────────────────────────────────
  text: {
    primary: '#EEEEEE', // terang — dipakai DI DALAM glass card gelap
    secondary: '#CFC9DA', // sekunder terang — di dalam card
    muted: '#948AAA', // muted terang — di dalam card (hint, label)
    onCanvas: '#372463', // dark violet — dipakai langsung di atas body
    onCanvasMuted: '#5F5082', // iris muted di atas body
    inverse: '#1F1538', // teks gelap untuk latar terang
  },

  // ── Warna status / semantik ───────────────────────────────────────────────
  status: {
    success: '#2FA084', // hijau teal — DONE, APPROVED
    warning: '#D99E50', // kuning oranye — peringatan
    danger: '#C85C5C', // merah — REJECTED, error, aksi destruktif
    info: '#3C9C96', // teal biru — SUBMITTED, informasi netral
  },
} as const; // 'as const' memastikan semua nilai adalah literal type (tidak bisa diubah)

// ── Token semantik ────────────────────────────────────────────────────────────
// Alias bermakna untuk token yang sering dipakai bersama
export const semantic = {
  primary: colors.primary[900], // warna utama aplikasi (deep violet)
  primaryLight: colors.primary[300], // warna primer terang (untuk link, border aktif)
  primaryDark: colors.primary[900], // alias untuk primary (dipakai di beberapa tempat)
} as const;

import { randomBytes, createHash, timingSafeEqual } from 'crypto';
// randomBytes     → generator byte acak kriptografis (aman untuk token)
// createHash      → fungsi hashing (SHA-256 untuk menyimpan token di DB)
// timingSafeEqual → perbandingan buffer dalam waktu konstan (mencegah timing attack)

// Masa berlaku link reset password: 30 menit dalam milidetik
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Konstanta rate-limit: maksimal 3 permintaan reset per email per window 1 jam
export const RESET_RATE_LIMIT_MAX = 3;
export const RESET_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 jam dalam milidetik

// Generate token acak kriptografis 32-byte yang di-encode sebagai base64url.
// Token mentah dikirim ke user via link email dan TIDAK BOLEH disimpan di database.
// Hanya hash SHA-256-nya yang disimpan, mirip dengan pola penyimpanan password.
export function generateRawToken(): string {
  return randomBytes(32).toString('base64url'); // 32 byte = 256 bit entropi, URL-safe
}

// Hash token mentah dengan SHA-256 dan kembalikan hex digest untuk disimpan di database.
// SHA-256 cukup di sini karena token sudah memiliki entropi tinggi (256-bit acak);
// biaya komputasi bcrypt yang lambat hanya diperlukan untuk password entropi rendah.
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex'); // hex string 64 karakter
}

// Bandingkan dua string dalam waktu konstan untuk mencegah timing side-channel attack.
// Kedua nilai di-hash terlebih dahulu ke panjang yang sama sebelum timingSafeEqual dipanggil.
// Tanpa ini, attacker bisa mengukur waktu respons untuk menebak karakter token satu per satu.
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false; // panjang berbeda pasti tidak sama (short-circuit aman)
  return timingSafeEqual(Buffer.from(a), Buffer.from(b)); // perbandingan dalam waktu O(n) konstan
}

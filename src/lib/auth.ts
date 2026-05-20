import NextAuth, { type DefaultSession } from 'next-auth'; // library autentikasi NextAuth v5
import Credentials from 'next-auth/providers/credentials'; // provider login dengan email+password
import bcrypt from 'bcryptjs'; // library hashing password (compare hash saat login)
import { prisma } from './prisma'; // instance Prisma Client untuk query database

// ─── Augmentasi tipe NextAuth ────────────────────────────────────────────────
// Perluas tipe bawaan NextAuth dengan field kustom aplikasi ini.
// Tanpa ini, TypeScript tidak akan mengenali field isSuperAdmin/isApprovalAdmin di session.
declare module 'next-auth' {
  // Tipe Session yang dikembalikan oleh useSession() di client
  interface Session {
    user: {
      id: string; // ID user dari database (bukan sub JWT bawaan NextAuth)
      isSuperAdmin: boolean; // apakah user adalah super admin (akses penuh)
      isApprovalAdmin: boolean; // apakah user adalah approval admin (bisa approve semua)
      name: string; // nama lengkap user
      email: string; // email user
    } & DefaultSession['user']; // gabungkan dengan field bawaan NextAuth (image, dll.)
  }

  // Tipe User yang dikembalikan oleh fungsi authorize()
  interface User {
    id?: string; // ID user dari database
    isSuperAdmin?: boolean; // flag super admin
    isApprovalAdmin?: boolean; // flag approval admin
  }
}

// Perluas tipe JWT dengan field kustom yang akan disimpan dalam token
declare module '@auth/core/jwt' {
  interface JWT {
    id: string; // ID user dari database
    isSuperAdmin: boolean; // flag super admin
    isApprovalAdmin: boolean; // flag approval admin
  }
}

// ─── Konfigurasi dan ekspor NextAuth ─────────────────────────────────────────
// Ekspor handlers (GET/POST), auth (server-side session), signIn, dan signOut
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // izinkan semua host (diperlukan untuk deployment di balik reverse proxy)
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET, // rahasia untuk enkripsi JWT
  session: { strategy: 'jwt' }, // gunakan JWT (bukan database session) — stateless
  pages: { signIn: '/login' }, // redirect ke /login alih-alih halaman login bawaan NextAuth

  providers: [
    // Provider email + bcrypt — tidak menggunakan OAuth/SSO
    Credentials({
      name: 'credentials', // nama provider
      // Definisi field yang dikirim dari form login
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // Validasi kredensial terhadap database dan kembalikan objek user
      // (atau null untuk memicu error login gagal)
      async authorize(credentials) {
        // Pastikan email dan password adalah string (bukan undefined/null dari form)
        const email = typeof credentials?.email === 'string' ? credentials.email : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';

        // Jika salah satu kosong, tolak autentikasi
        if (!email || !password) return null;

        // Cari user di database berdasarkan email
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null; // user tidak ditemukan → login gagal

        // Bandingkan password yang diinput dengan hash yang tersimpan di database
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null; // password salah → login gagal

        // Kembalikan data user yang akan dimasukkan ke JWT
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin, // flag super admin dari database
          isApprovalAdmin: user.isApprovalAdmin, // flag approval admin dari database
        };
      },
    }),
  ],

  callbacks: {
    // ── Callback JWT: dijalankan saat token dibuat/diperbarui ──────────────
    // Menyimpan field kustom ke dalam JWT saat sign-in.
    // Saat trigger === 'update' (misal setelah edit profil), refresh token dari DB
    // agar perubahan peran (role) langsung berlaku tanpa perlu login ulang.
    async jwt({ token, user, trigger }) {
      // Saat pertama kali sign-in: user object tersedia, salin field ke token
      if (user) {
        token.id = user.id ?? token.sub ?? ''; // ID user (fallback ke sub JWT)
        token.isSuperAdmin = !!user.isSuperAdmin; // konversi ke boolean pasti
        token.isApprovalAdmin = !!user.isApprovalAdmin; // konversi ke boolean pasti
      }

      // Saat trigger 'update' (session.update() dipanggil di client):
      // fetch data user terbaru dari DB agar token mencerminkan perubahan terbaru
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { isSuperAdmin: true, isApprovalAdmin: true, name: true, email: true }, // hanya field yang dibutuhkan
        });
        if (fresh) {
          // Perbarui semua field token dengan data terbaru dari database
          token.isSuperAdmin = fresh.isSuperAdmin;
          token.isApprovalAdmin = fresh.isApprovalAdmin;
          token.name = fresh.name;
          token.email = fresh.email ?? token.email; // fallback ke email lama jika baru null
        }
      }

      return token; // kembalikan token (dengan atau tanpa perubahan)
    },

    // ── Callback Session: dijalankan saat session dibaca oleh client ────────
    // Menyalin field kustom dari JWT ke objek session yang tersedia di client.
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id; // ID user dari JWT
        session.user.isSuperAdmin = !!token.isSuperAdmin; // flag super admin
        session.user.isApprovalAdmin = !!token.isApprovalAdmin; // flag approval admin
      }
      return session; // kembalikan session yang sudah dilengkapi
    },

    // ── Callback Authorized: dijalankan oleh middleware untuk proteksi route ─
    // Route auth (login, lupa password, reset) selalu publik.
    // Semua route lain memerlukan session aktif.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl; // ambil path yang diminta
      const isLoggedIn = !!auth?.user; // cek apakah ada session aktif

      // Tentukan apakah ini adalah route autentikasi (publik)
      const isAuthRoute =
        pathname === '/login' || // halaman login
        pathname === '/forgot-password' || // halaman lupa password
        pathname === '/reset-password' || // halaman reset password
        pathname.startsWith('/api/auth'); // endpoint NextAuth (/api/auth/*)

      if (isAuthRoute) return true; // route auth selalu diizinkan
      return isLoggedIn; // route lain: izinkan hanya jika sudah login
    },
  },
});

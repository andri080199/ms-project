// Tipe minimal untuk cek akses — hanya butuh flag isSuperAdmin dari user
export type AccessUser = { isSuperAdmin?: boolean | null };

// Kembalikan true jika user memiliki flag super admin.
// Super admin memiliki akses penuh ke semua fitur admin di aplikasi.
export function isSuper(u: AccessUser): boolean {
  return !!u.isSuperAdmin; // konversi ke boolean pasti (null/undefined → false)
}

// Kembalikan true jika user diizinkan untuk membuat/memperbarui/menghapus akun karyawan lain.
// Saat ini hanya super admin yang memiliki izin ini.
export function canManageUsers(u: AccessUser): boolean {
  return isSuper(u); // delegasikan ke pengecekan super admin
}

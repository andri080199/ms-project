import { PrismaClient } from '@prisma/client'; // library ORM Prisma untuk query database

// Simpan instance client di globalThis agar hot-reload dalam development tidak membuat
// pool koneksi database baru setiap kali modul di-evaluasi ulang.
// Di production, modul hanya dievaluasi sekali jadi singleton ini tidak berbahaya.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Gunakan instance yang sudah ada di global jika tersedia (development hot-reload),
// atau buat instance baru jika belum ada.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Di development: log error dan warning ke console untuk debugging
    // Di production: hanya log error (hindari output verbose yang tidak perlu)
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Simpan instance ke global hanya di non-production (development/test)
// agar di-reuse saat hot-reload — di production ini tidak diperlukan
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

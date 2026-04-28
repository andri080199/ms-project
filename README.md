# HRMS Internal

Internal HR Management tool untuk pengajuan **Overtime**, **Reimbursement**, dan **Perjalanan Dinas**. Dibangun production-ready dengan Next.js 16 App Router, React 19, Prisma, PostgreSQL, dan Ant Design dengan tema glassmorphism indigo-violet.

## Fitur

- Autentikasi dengan Auth.js v5 (Credentials + JWT + bcrypt)
- Empat role: **EMPLOYEE**, **SPV**, **HR**, **ADMIN** dengan guard di middleware & server
- Alur approval 2-stage (SPV → HR) untuk Overtime & Perjalanan Dinas, HR-only untuk Reimbursement
- Dashboard ringkasan + aktivitas terbaru
- Form pengajuan dengan validasi Zod (server) + AntD (client)
- Inbox approval dengan tab "Menunggu Approval Saya" dan "Riwayat"
- Riwayat audit otomatis melalui model `ApprovalHistory`
- Upload bukti reimbursement (stub via `/api/upload`, disimpan ke `public/uploads`)
- UI glassmorphism + aurora background, font Manrope, Ant Design dark algorithm
- Responsive (kartu di mobile, tabel di desktop), loading skeleton, empty state, toast feedback
- Seluruh copy user-facing dalam Bahasa Indonesia

## Stack

- Next.js **16** (App Router, Turbopack) + React **19** + TypeScript strict
- TailwindCSS v3.4 + Ant Design v5 + `@ant-design/nextjs-registry`
- PostgreSQL 16 + Prisma v6
- Auth.js v5 (`next-auth@beta`) + bcryptjs
- Zod + dayjs
- Docker + docker-compose

## Menjalankan dengan Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Aplikasi tersedia di `http://localhost:3000`. Seed otomatis dijalankan saat container `app` pertama kali naik.

## Menjalankan Lokal (tanpa Docker)

Prasyarat: **Node.js 20+** dan PostgreSQL 16 yang running.

```bash
cp .env.example .env
# Sesuaikan DATABASE_URL ke instance Postgres Anda

npm install
npm run db:push
npm run db:seed
npm run dev
```

Buka `http://localhost:3000`.

## Kredensial Seed

| Role     | Email                    | Password  |
|----------|--------------------------|-----------|
| ADMIN    | admin@company.com        | admin123  |
| HR       | hr@company.com           | hr123     |
| SPV      | spv1@company.com         | spv123    |
| SPV      | spv2@company.com         | spv123    |
| EMPLOYEE | emp1@company.com         | emp123    |
| EMPLOYEE | emp2@company.com         | emp123    |
| EMPLOYEE | emp3@company.com         | emp123    |
| EMPLOYEE | emp4@company.com         | emp123    |

`emp1` & `emp2` → supervisor `spv1` · `emp3` & `emp4` → supervisor `spv2`.

## Environment Variables

| Variable          | Deskripsi                                                 |
|-------------------|-----------------------------------------------------------|
| `DATABASE_URL`    | Connection string PostgreSQL                              |
| `NEXTAUTH_SECRET` | Secret untuk JWT Auth.js (wajib diganti di production)    |
| `NEXTAUTH_URL`    | URL publik aplikasi (`http://localhost:3000` untuk dev)   |
| `AUTH_TRUST_HOST` | `true` bila di-deploy di belakang reverse proxy/docker    |

## Struktur Project

```
hrms-app/
├── docker-compose.yml
├── Dockerfile
├── middleware.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── src/
    ├── app/
    │   ├── layout.tsx · page.tsx · globals.css · providers.tsx
    │   ├── (auth)/login/page.tsx
    │   ├── (dashboard)/
    │   │   ├── layout.tsx
    │   │   ├── dashboard/page.tsx
    │   │   ├── overtime/{page,new/page}.tsx
    │   │   ├── reimbursement/{page,new/page}.tsx
    │   │   ├── business-trip/{page,new/page}.tsx
    │   │   └── approvals/page.tsx
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts
    │       ├── dashboard/route.ts
    │       ├── overtime/{route,[id]/route}.ts
    │       ├── reimbursement/{route,[id]/route}.ts
    │       ├── business-trip/{route,[id]/route}.ts
    │       ├── approvals/{route,[id]/route}.ts
    │       └── upload/route.ts
    ├── lib/
    │   ├── auth.ts · prisma.ts · permissions.ts
    │   ├── schemas.ts · utils.ts · types.ts
    └── components/
        ├── Sidebar.tsx · Header.tsx · GlassCard.tsx
        ├── StatusBadge.tsx · RequestsTable.tsx · ApprovalModal.tsx
        └── forms/{Overtime,Reimbursement,BusinessTrip}Form.tsx
```

## Alur Status

- **Overtime & Perjalanan Dinas:** `SUBMITTED` → (SPV) `SPV_APPROVED` → (HR) `DONE`. Reject bisa terjadi di stage mana pun.
- **Reimbursement:** `SUBMITTED` → (HR) `DONE`. Tidak melibatkan SPV.

Setiap aksi approve/reject mencatat row `ApprovalHistory` dengan pelaku, stage, komentar.

## Scripts

| Command              | Kegunaan                                         |
|----------------------|--------------------------------------------------|
| `npm run dev`        | Jalankan dev server                              |
| `npm run build`      | Build production                                 |
| `npm start`          | Jalankan production server                       |
| `npm run db:push`    | Sinkronkan schema Prisma ke database             |
| `npm run db:seed`    | Isi database dengan seed data                    |
| `npm run db:generate`| Generate Prisma client                           |

## Catatan Next.js 16

- `cookies()`, `headers()`, `draftMode()`, route `params`/`searchParams` semua async — sudah di-await di setiap handler.
- Route handler GET tidak di-cache default — pages yang butuh session memakai `export const dynamic = 'force-dynamic'`.
- `fetch()` di client memakai `cache: 'no-store'` bila datanya session-aware.

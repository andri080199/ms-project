# Akun Demo

Kredensial akun seed buat dev / testing. Di-generate sama `prisma/seed.ts` (hash pakai bcrypt). Jangan dipake di produksi.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@company.com` | `admin123` |
| HR | `hr@company.com` | `hr123` |
| SPV | `spv1@company.com`, `spv2@company.com` | `spv123` |
| Employee | `emp1@company.com` … `emp4@company.com` | `emp123` |

## Setup dari nol

Pastikan `.env` punya:

```env
DATABASE_URL="postgresql://hrms:hrms@localhost:5433/hrms?schema=public"
```

Lalu:

```bash
# 1. Start container postgres dari docker-compose (host port 5433)
docker compose up -d postgres

# 2. Push schema Prisma ke DB
npx prisma db push

# 3. Seed akun demo + sample data
npm run db:seed
```

## Re-seed (DB udah ada isinya)

```bash
npm run db:seed
```

Script-nya `deleteMany` dulu sebelum insert, jadi data demo bakal di-reset.

> **Catatan:** kalau pas re-seed muncul error `Foreign key constraint violated` (misalnya `Attachment_uploaderId_fkey` atau `LeaveRequest_userId_fkey`), artinya ada table baru yang belum di-handle di `prisma/seed.ts`. Cara cepat reset semua:
>
> ```bash
> docker exec hrms_postgres psql -U hrms -d hrms -c \
>   "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO hrms;"
> npx prisma db push
> npm run db:seed
> ```

Liat `prisma/seed.ts` buat daftar user lengkap + struktur departemen/position.

# Database & Deployment

Panduan operasional database HRMS — setup awal, ubah schema, seed, sync local ↔ Supabase, dan resolve error umum. Project pakai **Prisma + PostgreSQL** dengan workflow `prisma db push` (bukan migrations folder).

## Env vars

`.env` minimal:

| Var | Isi | Catatan |
| --- | --- | --- |
| `DATABASE_URL` | connection string Postgres | Local: `postgresql://hrms:hrms@localhost:5433/hrms?schema=public`. Supabase: ambil dari Settings → Database → **Session pooler** (port 5432). |

> ⚠️ **Jangan pakai Transaction pooler (port 6543)** buat `prisma db push` / `migrate`. Pooler itu ga support prepared statements. Pakai **Session pooler (5432)** atau **direct connection**.

## Setup pertama kali (local)

```bash
cd hrms-app
npm install                # otomatis jalan `prisma generate` via postinstall
npx prisma db push         # bikin semua tabel sesuai schema.prisma
npm run db:seed            # isi akun demo + data sample
```

Akun demo: liat [`demo-accounts.md`](./demo-accounts.md).

## Setup pertama kali (Supabase)

1. Bikin project Supabase, ambil connection string **Session pooler**.
2. Set `DATABASE_URL` di environment target (Vercel / `.env.production` / dst).
3. Jalanin schema push — bisa langsung di mesin lokal dgn override env:

```bash
DATABASE_URL="postgresql://postgres.xxx:PASS@aws-x.pooler.supabase.com:5432/postgres" \
  npx prisma db push
```

4. (Opsional) Seed produksi:

```bash
DATABASE_URL="<supabase-url>" npm run db:seed
```

> ⚠️ Seed bakal bikin akun `admin@company.com` / `hr@company.com` dgn password lemah. Buat produksi, **ubah password setelah seed** atau skip seeding dan bikin user manual.

## Ubah schema (nambah/ngurangin kolom/enum)

1. Edit `prisma/schema.prisma`.
2. Generate Prisma Client (buat type-safety di IDE):

   ```bash
   npm run db:generate
   ```

3. Push ke local dulu:

   ```bash
   npx prisma db push
   ```

4. Test app jalan, baru push ke Supabase (lihat bagian **Sync local → Supabase**).

### Kalau ada drop kolom / drop enum value

Prisma bakal warning data loss. Kalau emang sengaja:

```bash
npx prisma db push --accept-data-loss
```

Kalau data lama masih perlu, **dump dulu** sebelum push:

```sql
-- contoh
SELECT id, "baseRole" FROM "Position" WHERE "baseRole" IS NOT NULL;
```

> ⚠️ `--accept-data-loss` cuma toleransi drop **kolom/tabel**. Postgres tetep nolak drop **enum value** kalau masih ada row yg pake. Lo harus update/hapus row-nya dulu — lihat bagian **Sync local → Supabase** di bawah.

### Skenario: drift detected (DB udah ada, migrations folder kosong)

Kalau lo nge-run `npx prisma migrate dev` di project ini bakal kena:
```
Drift detected: Your database schema is not in sync with your migration history.
```

Itu **bukan bug** — project ini emang sengaja **gak pake folder `prisma/migrations`** (workflow `db push` only, sama kayak `docker-compose.yml`). Jangan paksa `migrate dev`. Pakai:

```bash
npx prisma db push
```

Kalau lo udah terlanjur `migrate reset` & DB jadi kosong total (tabel ilang semua), recover dgn:
```bash
npx prisma db push && npx tsx prisma/seed.ts
```

## Sync local → Supabase

Skenario: schema di local udah diubah, mau samain ke Supabase.

```bash
DATABASE_URL="<supabase-session-pooler-url>" npx prisma db push
```

Atau temporary edit `.env`, push, balikin lagi.

### Kalau push gagal karena enum value lama masih kepake

Contoh error:
```
invalid input value for enum "Xxx_new": "OLDVAL"
```

Artinya ada row di Supabase yg masih nyimpen value enum yg udah dihapus di schema baru. **Postgres ga bisa drop enum value selama masih dipake row.**

**Cara fix — kalau data masih sample, hapus aja:**

```sql
DELETE FROM "ReimbursementItem"
WHERE category::text IN ('OFFICE','HOTEL','MEAL','OTHER');
```

**Cara fix — kalau data perlu dipertahanin, map manual:**

Karena value baru belum ada di enum Supabase, **tambahin dulu** baru update:

```sql
ALTER TYPE "ReimbursementCategory" ADD VALUE IF NOT EXISTS 'HOTEL_DINAS';
ALTER TYPE "ReimbursementCategory" ADD VALUE IF NOT EXISTS 'ATK_OFFICE';
-- dst utk semua value baru

UPDATE "ReimbursementItem" SET category = 'HOTEL_DINAS' WHERE category::text = 'HOTEL';
UPDATE "ReimbursementItem" SET category = 'ATK_OFFICE'  WHERE category::text = 'OFFICE';
-- dst sesuai mapping
```

> `ADD VALUE` ga bisa di-pake di transaction yg sama dgn yg makenya — jalanin terpisah di Supabase SQL Editor (auto-commit per statement).

Habis itu baru `npx prisma db push --accept-data-loss`.

## Schema changes log

Catatan perubahan schema yg perlu treatment khusus pas migrasi DB existing. Kalau lo deploy ke environment baru / fresh DB, ini bisa di-skip — `prisma db push` auto-handle dari schema.prisma terbaru.

### LeaveType revamp (2026-05-27)

Enum `LeaveType` di `prisma/schema.prisma` di-rombak: **6 → 13 value**. Cuti khusus (special leave) ditambahin (pernikahan, kelahiran/keguguran, ibadah haji, dll), `UNPAID` & `OTHER` dihapus.

**Mapping:**

| Lama | Baru | Catatan |
| --- | --- | --- |
| `ANNUAL` | `ANNUAL` | tetep — "Cuti Tahunan" |
| `SICK` | `SICK` | tetep — "Sakit" |
| `PERSONAL` | `PERSONAL` | tetep tapi label berubah jadi "Izin" (sebelumnya "Pribadi") |
| `MATERNITY` | `MATERNITY` | tetep — sekarang masuk kategori Special Leave |
| `UNPAID` | ❌ dihapus | Migrasi ke `PERSONAL` (rekomendasi default) |
| `OTHER` | ❌ dihapus | Migrasi ke `PERSONAL` (rekomendasi default) |
| — | `MARRIAGE` | baru — Cuti Menikah |
| — | `CHILD_MARRIAGE` | baru — Cuti Menikahkan Anak |
| — | `CHILD_CIRCUMCISION` | baru — Cuti Khitanan Anak |
| — | `CHILD_BAPTISM` | baru — Cuti Baptis Anak |
| — | `FAMILY_DEATH` | baru — Cuti Keluarga Meninggal |
| — | `HOUSEHOLD_DEATH` | baru — Cuti Anggota Keluarga Dalam Satu Rumah Meninggal |
| — | `MENSTRUAL` | baru — Cuti Haid |
| — | `MISCARRIAGE` | baru — Cuti Keguguran |
| — | `HAJJ` | baru — Cuti Ibadah Haji |

**Migrasi DB existing (lokal / Supabase) — ada data lama:**

```sql
-- 1. Update row yg masih pake value lama (map ke value yg masih ada)
UPDATE "LeaveRequest"
   SET "leaveType" = 'PERSONAL'
 WHERE "leaveType"::text IN ('UNPAID','OTHER');
```

Lalu push schema:
```bash
npx prisma db push
```

**Kalau lupa update row dulu** dan langsung push, bakal kena:
```
ERROR: invalid input value for enum "LeaveType_new": "OTHER"
```

`--accept-data-loss` **gak nolong** di kasus ini — flag itu cuma buat drop kolom, bukan auto-convert enum value. Wajib update/delete row dulu.

**Kalau DB-nya disposable (dev/sample data)** — tinggal reset:
```bash
npx prisma db push --force-reset && npm run db:seed
```

**File yg berubah** (selain `schema.prisma`):
- `src/lib/schemas.ts` — Zod enum di `leaveSchema`
- `src/components/forms/LeaveForm.tsx` — `TYPE_KEYS` dropdown
- `src/lib/types.ts` — `LEAVE_TYPE_LABEL` (fallback label ID)
- `src/lib/i18n/dict.ts` — terjemahan ID + EN

## Seeding

Script seed: `prisma/seed.ts`.

```bash
npm run db:seed
```

Idempotensi: script pakai `upsert` di mayoritas data, **tapi cek dulu** sebelum jalanin di produksi — beberapa relasi (mis. reimbursement sample) bisa duplikat kalau seed dijalanin berkali-kali.

### Sync positions (khusus)

Kalau cuma mau update master data Position tanpa full seed:

```bash
npm run db:sync-positions
```

Detail: liat [`positions.md`](./positions.md).

## Reset database (DESTRUCTIVE)

⚠️ **Hapus semua data**. Jangan jalanin di Supabase produksi.

```bash
npx prisma db push --force-reset
npm run db:seed
```

## Backup & restore

- Manual / on-demand backup & restore: liat [`backup-restore.md`](./backup-restore.md).
- Setup backup terjadwal harian di VPS: liat [`backup-schedule.md`](./backup-schedule.md).

Selalu **dump dulu** sebelum jalanin operasi destruktif (drop kolom/enum, reset, force migrate).

## Inspect database

```bash
npx prisma studio          # GUI di localhost:5555
```

Atau langsung ke Supabase dashboard → Table Editor / SQL Editor.

## Troubleshooting

| Error | Penyebab | Fix |
| --- | --- | --- |
| `prepared statement "sX" already exists` | Pake Transaction Pooler (6543) | Ganti ke Session Pooler (5432) atau direct connection |
| `invalid input value for enum "X_new": "Y"` | Data lama masih pake enum value yg mau di-drop | Update/delete row dulu (mis. `UPDATE "LeaveRequest" SET "leaveType"='PERSONAL' WHERE "leaveType" IN ('UNPAID','OTHER')`), terus `db push` ulang |
| `Drift detected: ... migration history` | `migrate dev/reset` dipakai di project ini (yg pure `db push` workflow) | Jangan pakai `migrate`. Lihat **Skenario: drift detected** |
| `The table public.X does not exist` pas seed | Habis `migrate reset` di project tanpa folder migrations → DB kosong | `npx prisma db push && npx tsx prisma/seed.ts` |
| `column ... contains N non-null values` | Mau drop kolom tapi masih ada data | Dump dulu kalau perlu, terus `--accept-data-loss` |
| `relation "X" does not exist` di Supabase | Tabel emang belum dibuat di Supabase | Jalanin `prisma db push` ke Supabase dulu |
| `Environment variable not found: DATABASE_URL` | `.env` ga ke-load atau salah path | Pastiin di-jalanin dari folder `hrms-app/` |

## Catatan deployment

- `postinstall` hook otomatis jalanin `prisma generate` — di Vercel / build environment ga perlu manual.
- Untuk deploy ke Vercel: set `DATABASE_URL` di Project Settings → Environment Variables. Pake Session Pooler URL.
- Schema changes **ga otomatis ke-apply** waktu deploy. Selalu `prisma db push` manual ke target sebelum deploy app baru yg butuh kolom baru.

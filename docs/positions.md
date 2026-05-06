# Job Positions

Daftar master position (jabatan) di FIERSA. Source of truth ada di:

- **`prisma/seed.ts`** — array `positionSeed`. Dipake pas seed DB dari nol.
- **`scripts/sync-positions.ts`** — array `POSITIONS`. Dipake buat sync DB existing tanpa hapus user.

Kedua file harus tetap sinkron. Kalau ada penambahan/perubahan position, **update dua-duanya**.

## Daftar position (sesuai struktur Nodeflux)

| Department | Position | baseRole |
| --- | --- | --- |
| Board | CEO, CTO, COO | `ADMIN` |
| Technology | Engineering Manager, Solution Manager, Lead Product Manager, Product Manager | `SPV` |
| Technology | Sr. Software Engineer, Sr. AI Software Engineer, AI Software Engineer, Full Stack Engineer, Solution Engineer, Associate Software Engineer | `EMPLOYEE` |
| OPS - Project | Technical Project Manager Supervisor, Technical Project Manager | `SPV` |
| OPS - Project | Jr. Technical Project Manager, Jr. TechOps | `EMPLOYEE` |
| OPS - General Support | FAT Manager | `SPV` |
| OPS - General Support | Sr. FAT, OB | `EMPLOYEE` |
| People & Culture | People & GA Officer | `HR` |

> **Catatan:** posisi `People & GA Officer` itu **load-bearing** — `src/lib/notifications.ts` (`REIMBURSEMENT_APPROVER_POSITION`) ngecari user dengan position ini buat dikirimin notif reimbursement baru. Kalau dirubah/dihapus, notifikasi reimbursement bakal di-skip.

## Cara pake `sync-positions`

Skrip ini buat **DB yang udah ada datanya** dan lo gak mau kehilangan user/pengajuan. Beda sama `db:seed` yang nge-reset semua tabel.

```bash
npm run db:sync-positions
```

Yang dilakuin (idempotent — aman di-run berkali-kali):

1. **Upsert** semua position di array `POSITIONS` — yang belum ada dibikin, yang udah ada `baseRole` & `department`-nya disamain.
2. **Remap user** dari position legacy ke position baru lewat tabel `LEGACY_REMAP`. Misal:
   - `Super Admin` → `CTO`
   - `Manager HR` → `People & GA Officer`
   - `Supervisor Engineering` → `Engineering Manager`
   - `Supervisor Marketing` → `Technical Project Manager Supervisor`
   - `Staff Engineering` → `Sr. Software Engineer`
   - `Staff Marketing` → `Jr. Technical Project Manager`
3. **Hapus position legacy** setelah user-nya pindah (FK aman karena udah di-remap dulu).
4. **Warn** kalau masih ada position di DB yang gak ada di `POSITIONS` (artinya: legacy yg belum di-mapping, atau position custom yg lo bikin manual).

Output normal:

```
✓ Upsert 21 positions Nodeflux
  - "Super Admin" → "CTO" (1 user dipindah, position lama dihapus)
  ...
✓ Tidak ada position legacy tersisa
```

## Workflow umum

**Tambah position baru:**

1. Edit `POSITIONS` di `scripts/sync-positions.ts` + `positionSeed` di `prisma/seed.ts`.
2. `npm run db:sync-positions` — DB current ke-update.
3. Commit dua-duanya.

**Rename position (misal `OB` → `Office Boy`):**

1. Edit nama di `POSITIONS` & `positionSeed`.
2. Tambahin entry di `LEGACY_REMAP`:
   ```ts
   const LEGACY_REMAP: Record<string, string> = {
     'OB': 'Office Boy',
     // ...
   };
   ```
3. `npm run db:sync-positions` — user yang ada di `OB` otomatis pindah ke `Office Boy`, position lama dihapus.

**Hapus position:**

- Cek dulu ada user yang mereferensikan gak (`SELECT COUNT(*) FROM "User" WHERE "positionId" = ...`). Kalau ada, pindahin via `LEGACY_REMAP` dulu sebelum dihapus dari `POSITIONS`.

## Troubleshooting

- **`Authentication failed`** — `.env` `DATABASE_URL` nunjuk ke DB yang salah. Cek port (`5432` postgres-db, `5433` hrms_postgres) & user/password.
- **`Position di luar list Nodeflux yang masih ada`** — ada position custom di DB. Tambahin ke `POSITIONS` (kalau mau dipertahanin) atau ke `LEGACY_REMAP` (kalau mau dihapus & remap user-nya).
- **FK constraint pas hapus position** — pasti ada user yang masih reference. Tambahin position itu sebagai key di `LEGACY_REMAP` dengan target valid.

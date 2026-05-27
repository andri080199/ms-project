# Backup & Restore Database

Panduan backup dan restore database HRMS — manual & on-demand. Buat backup otomatis terjadwal, liat [`backup-schedule.md`](./backup-schedule.md).

Project pakai **PostgreSQL 16** (lihat `docker-compose.yml`). Tool standar yg dipake: `pg_dump`, `pg_restore`, `psql`.

## Kenapa perlu backup

- Sebelum `prisma db push --accept-data-loss` (drop kolom/enum).
- Sebelum migrasi data besar atau bulk update via SQL.
- Sebelum upgrade Postgres major version.
- Snapshot rutin sebelum demo / release production.

`prisma migrate reset` **bukan backup** — itu drop semua data.

## Tools yg dibutuhin

| Tool | Fungsi | Install (Ubuntu/WSL) |
| --- | --- | --- |
| `pg_dump` | Bikin file backup | `sudo apt install -y postgresql-client` |
| `pg_restore` | Restore dari format custom (`-Fc`) | (ikut paket di atas) |
| `psql` | Restore dari plain SQL & query manual | (ikut paket di atas) |

> ⚠️ **Versi `pg_dump` harus >= versi server.** Kalau server Postgres 16 dan `pg_dump` lo versi 14, dump-nya bakal nolak. Cek: `pg_dump --version`. Kalau ketinggalan, install `postgresql-client-16` spesifik.

## Format backup

Dua format yg umum dipake:

| Format | Flag | Kelebihan | Kekurangan |
| --- | --- | --- | --- |
| **Custom** | `-Fc` | Compact (auto-compressed), bisa restore parsial table, paralel | Wajib `pg_restore` (gak bisa cat ke `psql`) |
| **Plain SQL** | `-Fp` (default) | Human-readable, bisa di-`psql` langsung | File gede, gak ada compress bawaan |

**Rekomendasi: pakai `-Fc`** buat backup rutin, plain SQL cuma kalau lo perlu inspect manual.

---

## 1. Backup database lokal (Docker)

Setup local pake container `hrms_postgres` (lihat `docker-compose.yml`). Postgres-nya di dalem container, port di-expose ke host `5433`.

### Opsi A — `pg_dump` dari host (paling simple)

```bash
mkdir -p ./backups

pg_dump \
  -h localhost -p 5433 \
  -U hrms -d hrms \
  -Fc -f ./backups/hrms-$(date +%Y%m%d-%H%M%S).dump
```

Password (`hrms`) bakal diminta. Biar gak repot, set env var:
```bash
export PGPASSWORD=hrms
```

### Opsi B — `pg_dump` di dalem container (gak perlu install client di host)

```bash
mkdir -p ./backups

docker exec hrms_postgres pg_dump -U hrms -d hrms -Fc \
  > ./backups/hrms-$(date +%Y%m%d-%H%M%S).dump
```

Dump ditulis ke stdout container → redirect ke file di host.

### Opsi C — pakai `DATABASE_URL` langsung

Kalau `.env` udah ada `DATABASE_URL`:
```bash
export $(grep -v '^#' .env | xargs)
pg_dump "$DATABASE_URL" -Fc -f ./backups/hrms-$(date +%Y%m%d-%H%M%S).dump
```

---

## 2. Backup database Supabase

Ambil connection string **Session pooler** (port 5432) dari Supabase dashboard → Settings → Database. **Jangan pake Transaction pooler (6543)** — gak support `pg_dump`.

```bash
pg_dump "postgresql://postgres.xxx:PASS@aws-x.pooler.supabase.com:5432/postgres" \
  -Fc -f ./backups/hrms-supabase-$(date +%Y%m%d-%H%M%S).dump
```

> Supabase juga punya **built-in daily backup** di tab Database → Backups (Pro plan ke atas). Backup manual via `pg_dump` tetep berguna buat snapshot before-change atau buat ditarik ke lokal.

---

## 3. Backup khusus (data only / schema only / 1 table)

**Data only** (no `CREATE TABLE`, cuma `INSERT`):
```bash
pg_dump -h localhost -p 5433 -U hrms -d hrms \
  --data-only -Fc -f ./backups/data-only.dump
```

**Schema only** (no data):
```bash
pg_dump -h localhost -p 5433 -U hrms -d hrms \
  --schema-only -Fc -f ./backups/schema-only.dump
```

**Table tertentu** (mis. cuma `LeaveRequest`):
```bash
pg_dump -h localhost -p 5433 -U hrms -d hrms \
  -t '"LeaveRequest"' -Fc -f ./backups/leave-only.dump
```

> Tanda kutip ganda di nama table penting karena Prisma bikin nama PascalCase yg di Postgres dianggap case-sensitive.

---

## 4. Restore — dari format custom (`.dump`)

### Restore ke DB kosong (clean restore)

Skenario paling aman: drop DB lama, bikin baru, restore.

```bash
# Drop + recreate DB (HATI-HATI, semua data lama hilang)
docker exec hrms_postgres psql -U hrms -d postgres -c "DROP DATABASE IF EXISTS hrms;"
docker exec hrms_postgres psql -U hrms -d postgres -c "CREATE DATABASE hrms;"

# Restore
pg_restore -h localhost -p 5433 -U hrms -d hrms \
  --no-owner --no-privileges \
  ./backups/hrms-20260527-153000.dump
```

Flag penting:
- `--no-owner` → abaikan ownership di dump (penting kalau pindah antar instance dgn user beda)
- `--no-privileges` → abaikan `GRANT/REVOKE`
- `-j 4` → restore paralel 4 worker (lebih cepet buat DB besar)

### Restore ke DB existing (overwrite isi)

```bash
pg_restore -h localhost -p 5433 -U hrms -d hrms \
  --clean --if-exists --no-owner --no-privileges \
  ./backups/hrms-20260527-153000.dump
```

- `--clean` → `DROP` object dulu sebelum re-create
- `--if-exists` → biar gak error kalau object yg di-`DROP` gak ada

> ⚠️ `--clean` bakal drop semua tabel di DB target. Pastiin lo restore ke DB yg bener.

### Restore dari container Docker

```bash
# Copy dump ke dalem container dulu
docker cp ./backups/hrms-20260527-153000.dump hrms_postgres:/tmp/

# Lalu restore dari dalem container
docker exec hrms_postgres pg_restore -U hrms -d hrms \
  --clean --if-exists --no-owner --no-privileges \
  /tmp/hrms-20260527-153000.dump

# Bersihin file temp
docker exec hrms_postgres rm /tmp/hrms-20260527-153000.dump
```

---

## 5. Restore — dari plain SQL (`.sql`)

```bash
psql -h localhost -p 5433 -U hrms -d hrms -f ./backups/hrms.sql
```

Atau via container:
```bash
cat ./backups/hrms.sql | docker exec -i hrms_postgres psql -U hrms -d hrms
```

---

## 6. Verify backup (penting!)

**Backup yg gak pernah di-test = bukan backup.** Cek minimal sebelum diandelin:

### Cek integritas file dump

```bash
pg_restore -l ./backups/hrms-20260527-153000.dump | head -30
```

Kalau output-nya list table/index/data → file valid. Kalau error parsing → corrupt.

### Test restore ke DB sementara

Bikin DB throwaway, restore ke sana, cek count baris key tables:

```bash
docker exec hrms_postgres psql -U hrms -d postgres -c "CREATE DATABASE hrms_test;"

pg_restore -h localhost -p 5433 -U hrms -d hrms_test \
  --no-owner --no-privileges \
  ./backups/hrms-20260527-153000.dump

# Cek isi
docker exec hrms_postgres psql -U hrms -d hrms_test \
  -c 'SELECT COUNT(*) FROM "User"; SELECT COUNT(*) FROM "LeaveRequest";'

# Cleanup
docker exec hrms_postgres psql -U hrms -d postgres -c "DROP DATABASE hrms_test;"
```

Idealnya **test restore ke staging tiap bulan** biar tau backup-nya beneran berfungsi.

---

## 7. Compress & enkripsi (opsional tapi recommended)

Format custom (`-Fc`) udah auto-compressed level 5, tapi kalau mau lebih kecil atau pengen encrypt:

### Gzip plain SQL
```bash
pg_dump -h localhost -p 5433 -U hrms -d hrms | gzip -9 > ./backups/hrms.sql.gz
# restore
gunzip -c ./backups/hrms.sql.gz | psql -h localhost -p 5433 -U hrms -d hrms
```

### Encrypt dgn gpg (simetris)
```bash
pg_dump -h localhost -p 5433 -U hrms -d hrms -Fc \
  | gpg --symmetric --cipher-algo AES256 \
  > ./backups/hrms.dump.gpg

# restore
gpg --decrypt ./backups/hrms.dump.gpg | pg_restore -h localhost -p 5433 -U hrms -d hrms \
  --clean --if-exists --no-owner --no-privileges
```

Wajib enkripsi kalau backup mau disimpen di cloud storage publik atau dikirim via email/Slack.

---

## 8. Where to store backups

| Lokasi | Cocok buat | Catatan |
| --- | --- | --- |
| `./backups/` (host VPS) | Dev / quick snapshot | **Jangan diandalin sendiri** — kalau disk corrupt, hilang. Tambahin sync ke remote. |
| Object storage (S3, R2, GCS, Backblaze) | Production | Recommended. Aktifin versioning + lifecycle policy. |
| Backup server terpisah (rsync/scp) | Bare metal setup | Simpan di mesin fisik berbeda. |
| Supabase native | Project Supabase Pro+ | Built-in daily backup, retensi 7 hari (Pro). Tetep tambahin manual dump kalau perlu portability. |

Tambahin entry di `.gitignore` (udah ada di project ini? cek dulu) biar folder `backups/` gak ke-commit:

```gitignore
backups/
*.dump
*.dump.gpg
*.sql.gz
```

---

## Troubleshooting

**`pg_dump: server version mismatch`**
- `pg_dump --version` < versi server. Install client versi terbaru: `sudo apt install -y postgresql-client-16`.
- Atau pakai opsi B/C (dump dari dalem container) — versinya pasti match.

**`role "hrms" does not exist` saat restore**
- Restore ke DB yg user-nya beda. Pakai `--no-owner --no-privileges` biar ownership di-skip.

**`out of memory` saat restore DB besar**
- Tambahin `-j 4` (paralel) supaya tiap worker ambil chunk kecil-kecil.
- Atau tambah RAM swap sementara.

**`could not connect to server` ke Supabase**
- Pastiin pake **Session pooler (port 5432)**, bukan Transaction pooler (6543) atau direct connection (yg perlu IPv6).
- Cek IP lo udah di-allowlist (Supabase dashboard → Settings → Database → Network Restrictions).

**Backup file 0 byte / sangat kecil**
- Permission `pg_dump` ke DB salah. Cek user punya `CONNECT` + `USAGE` + `SELECT` di schema target.
- Disk penuh → cek `df -h`.

**Dump berhasil tapi restore data bentrok dgn schema baru**
- Skema target udah diubah (mis. enum value baru). Dua opsi:
  - Restore ke DB kosong dulu (versi schema lama), terus jalanin migrasi data ke schema baru.
  - Edit dump file plain SQL manual buat replace value lama → baru sebelum restore.

---

## Cheatsheet

```bash
# === BACKUP ===
# Local (docker)
docker exec hrms_postgres pg_dump -U hrms -d hrms -Fc > ./backups/hrms-$(date +%Y%m%d-%H%M%S).dump

# Supabase
pg_dump "$SUPABASE_DB_URL" -Fc -f ./backups/hrms-supa-$(date +%Y%m%d-%H%M%S).dump

# === RESTORE ===
# Ke DB kosong
pg_restore -h localhost -p 5433 -U hrms -d hrms --no-owner --no-privileges <file>.dump

# Overwrite DB existing
pg_restore -h localhost -p 5433 -U hrms -d hrms --clean --if-exists --no-owner --no-privileges <file>.dump

# === VERIFY ===
pg_restore -l <file>.dump | head
```

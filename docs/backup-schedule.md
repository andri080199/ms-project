# Jadwal Backup Otomatis

Panduan setup backup database HRMS otomatis tiap hari. Untuk backup manual / on-demand & detail tool, liat [`backup-restore.md`](./backup-restore.md).

## Rekomendasi default

| Item | Nilai | Alasan |
| --- | --- | --- |
| Frekuensi | **Harian, jam 02:00 WIB** | Trafik low, gak ganggu user. |
| Format | `pg_dump -Fc` | Compact + paralel restore. |
| Retensi | **7 daily + 4 weekly + 6 monthly** | Bisa rollback per hari minggu lalu, per minggu bulan ini, per bulan setengah tahun. |
| Lokasi primary | `/var/backups/hrms/` di VPS | Cepet diakses pas restore. |
| Lokasi secondary | Object storage (S3/R2/B2) | Disaster recovery — kalau VPS-nya mati total. |
| Enkripsi | gpg simetris (`AES256`) | Wajib kalau backup ke storage publik. |
| Monitoring | Email/Slack alert kalau gagal | Backup yg silent fail = bom waktu. |

## Step 1 — Bikin script backup

Bikin file: `/usr/local/bin/hrms-backup.sh`

```bash
#!/bin/bash
# HRMS daily backup script
set -euo pipefail

# ─── Config ─────────────────────────────────────────────────────────────────
BACKUP_DIR="/var/backups/hrms"
RETAIN_DAILY=7        # simpan 7 backup harian terakhir
RETAIN_WEEKLY=4       # simpan 4 backup mingguan (tiap hari minggu)
RETAIN_MONTHLY=6      # simpan 6 backup bulanan (tanggal 1)

# Pilih SALAH SATU sumber DB:
# Opsi A — DB lokal via Docker (sesuaikan nama container):
DB_CONTAINER="hrms_postgres"
DB_USER="hrms"
DB_NAME="hrms"

# Opsi B — Pakai DATABASE_URL (mis. Supabase). Uncomment & set:
# DATABASE_URL="postgresql://postgres.xxx:PASS@aws-x.pooler.supabase.com:5432/postgres"

# Webhook untuk notifikasi (opsional). Kosongin kalau gak pake.
SLACK_WEBHOOK=""

# ─── Persiapan ──────────────────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DAY_OF_WEEK=$(date +%u)     # 1=Senin, 7=Minggu
DAY_OF_MONTH=$(date +%d)

# Tentuin folder target berdasarkan tanggal
if [ "$DAY_OF_MONTH" = "01" ]; then
  TIER="monthly"
elif [ "$DAY_OF_WEEK" = "7" ]; then
  TIER="weekly"
else
  TIER="daily"
fi

TARGET_DIR="$BACKUP_DIR/$TIER"
mkdir -p "$TARGET_DIR"

OUTPUT_FILE="$TARGET_DIR/hrms-$TIMESTAMP.dump"

# ─── Notifikasi helper ──────────────────────────────────────────────────────
notify() {
  local status="$1"
  local message="$2"
  echo "[$(date +'%F %T')] $status: $message"
  if [ -n "$SLACK_WEBHOOK" ]; then
    curl -fsS -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"[HRMS Backup] $status: $message\"}" || true
  fi
}

trap 'notify "FAILED" "Backup gagal di host $(hostname). Cek log."' ERR

# ─── Dump DB ────────────────────────────────────────────────────────────────
if [ -n "${DATABASE_URL:-}" ]; then
  # Opsi B
  pg_dump "$DATABASE_URL" -Fc -f "$OUTPUT_FILE"
else
  # Opsi A — via docker exec
  docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$OUTPUT_FILE"
fi

# Verify file bukan 0 byte
if [ ! -s "$OUTPUT_FILE" ]; then
  notify "FAILED" "Backup file kosong: $OUTPUT_FILE"
  exit 1
fi

SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

# ─── Rotasi (hapus yg udah lewat retensi) ───────────────────────────────────
find "$BACKUP_DIR/daily"   -name 'hrms-*.dump' -type f -mtime "+$RETAIN_DAILY"           -delete 2>/dev/null || true
find "$BACKUP_DIR/weekly"  -name 'hrms-*.dump' -type f -mtime "+$((RETAIN_WEEKLY * 7))"  -delete 2>/dev/null || true
find "$BACKUP_DIR/monthly" -name 'hrms-*.dump' -type f -mtime "+$((RETAIN_MONTHLY * 31))" -delete 2>/dev/null || true

notify "OK" "Backup $TIER sukses ($SIZE) → $OUTPUT_FILE"
```

Set permission:
```bash
sudo chmod 700 /usr/local/bin/hrms-backup.sh
sudo chown root:root /usr/local/bin/hrms-backup.sh
```

> `chmod 700` penting karena script bisa berisi password DB. Jangan kasih world-readable.

Bikin folder backup:
```bash
sudo mkdir -p /var/backups/hrms/{daily,weekly,monthly}
sudo chmod 700 /var/backups/hrms
```

Tes manual dulu:
```bash
sudo /usr/local/bin/hrms-backup.sh
ls -lh /var/backups/hrms/daily/
```

Pastiin file muncul dan size masuk akal (DB kosong: ~50KB, DB dgn data: bisa MB-GB).

---

## Step 2 — Schedule dgn crontab (paling simple)

Edit root crontab:
```bash
sudo crontab -e
```

Tambahin:
```cron
# HRMS — backup DB tiap hari jam 02:00 WIB (server UTC → 19:00 UTC hari sebelumnya)
0 19 * * * /usr/local/bin/hrms-backup.sh >> /var/log/hrms-backup.log 2>&1
```

**Cek timezone server dulu:**
```bash
timedatectl
```
- Server `Asia/Jakarta` → cron `0 2 * * *`
- Server `UTC` → cron `0 19 * * *` (19:00 UTC = 02:00 WIB esok hari)

Verify cron ke-save:
```bash
sudo crontab -l
```

Liat log eksekusi:
```bash
tail -f /var/log/hrms-backup.log
```

---

## Step 2 (alt) — Schedule dgn systemd timer (lebih robust)

Lebih rapih kalau VPS lo udah pake systemd ecosystem (yg modern semua). Keuntungan:
- Log via `journalctl` (terindex, searchable).
- `Persistent=true` → backup catch-up kalau VPS lagi mati pas jadwal jalan.
- Bisa di-trigger manual gampang buat tes.

**1. Service file:** `/etc/systemd/system/hrms-backup.service`
```ini
[Unit]
Description=HRMS daily DB backup
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/hrms-backup.sh
User=root
```

**2. Timer file:** `/etc/systemd/system/hrms-backup.timer`
```ini
[Unit]
Description=Run HRMS backup daily at 02:00 Asia/Jakarta

[Timer]
OnCalendar=*-*-* 02:00:00 Asia/Jakarta
Persistent=true
Unit=hrms-backup.service

[Install]
WantedBy=timers.target
```

**3. Enable & start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hrms-backup.timer
```

**4. Verify:**
```bash
# Next trigger
systemctl list-timers hrms-backup.timer

# Log eksekusi terakhir
journalctl -u hrms-backup.service -n 50 --no-pager

# Trigger manual sekarang (buat tes)
sudo systemctl start hrms-backup.service
```

---

## Step 3 — Off-site replication (kritikal!)

Backup lokal aja **gak cukup** — kalau VPS lo kena ransomware atau disk corrupt, semua backup ikut hangus. Sync ke storage di luar VPS:

### Opsi A — `rclone` ke S3/R2/B2 (paling fleksibel)

Install:
```bash
sudo apt install -y rclone
rclone config   # interactive setup, ikutin wizard
```

Tambahin di akhir `/usr/local/bin/hrms-backup.sh` (sebelum `notify "OK"`):
```bash
# Upload ke remote (sesuaikan nama remote)
rclone copy "$OUTPUT_FILE" "myremote:hrms-backups/$TIER/" \
  --transfers=2 --checkers=4 \
  || notify "WARN" "Backup lokal sukses tapi upload remote gagal"
```

### Opsi B — `rsync` ke server lain

```bash
rsync -avz --delete \
  /var/backups/hrms/ \
  user@backup-server:/path/to/hrms/
```

Setup SSH key auth dulu biar gak prompt password.

### Opsi C — Backblaze B2 CLI (cheap & cheerful)

Bandwidth & storage murah, cocok buat backup retention panjang.

```bash
# Install b2 CLI: pipx install b2 (atau apt)
b2 authorize-account <keyId> <appKey>
b2 sync /var/backups/hrms/ b2://my-bucket/hrms/
```

### Lifecycle policy (penting!)

Di bucket S3/R2/B2, set lifecycle rule:
- **daily/** → expire setelah 14 hari
- **weekly/** → expire setelah 60 hari
- **monthly/** → expire setelah 365 hari

Ini ngebatesin biaya storage biar gak terus naik.

---

## Step 4 — Encrypt sebelum upload (kalau backup ke storage publik)

Edit script dump command jadi:
```bash
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc \
  | gpg --batch --yes --symmetric --cipher-algo AES256 \
        --passphrase-file /etc/hrms-backup.key \
  > "$OUTPUT_FILE.gpg"

OUTPUT_FILE="$OUTPUT_FILE.gpg"
```

Bikin passphrase file:
```bash
openssl rand -base64 48 | sudo tee /etc/hrms-backup.key > /dev/null
sudo chmod 600 /etc/hrms-backup.key
```

> ⚠️ **Backup passphrase file `/etc/hrms-backup.key` ke offline storage** (mis. password manager lo). Kalau hilang, backup-nya gak bisa di-decrypt — selamanya useless.

Cara restore:
```bash
gpg --batch --decrypt --passphrase-file /etc/hrms-backup.key \
  ./backups/hrms-20260527.dump.gpg \
  | pg_restore -h localhost -p 5433 -U hrms -d hrms \
      --clean --if-exists --no-owner --no-privileges
```

---

## Step 5 — Monitoring & alerting

### Slack webhook (paling cepet)

Set `SLACK_WEBHOOK` di script. Buat webhook: Slack App → Incoming Webhooks → Add to channel.

### Email via cron MAILTO

Cron otomatis email kalau ada stdout/stderr. Tambah di crontab:
```cron
MAILTO=ops@perusahaan.com
0 19 * * * /usr/local/bin/hrms-backup.sh
```

Butuh `mailutils` + SMTP relay (postfix/msmtp). Untuk simple-nya, mendingan Slack.

### Healthcheck.io / Cronitor (dead man's switch)

Ide: kalau backup berhasil → ping URL. Kalau **gak** ada ping dalam window tertentu → alert.

```bash
# Tambah di akhir script (setelah notify "OK")
curl -fsS -m 10 --retry 3 https://hc-ping.com/<uuid> > /dev/null || true
```

Beda dgn Slack/email: ini ngedeteksi **silent failure** — script crash sebelum sempet kirim notif.

---

## Step 6 — Test restore berkala

**Backup yg gak pernah di-test = bukan backup.** Bikin reminder bulanan buat:

1. Ambil 1 backup random dari `monthly/`.
2. Restore ke DB throwaway (lihat [`backup-restore.md`](./backup-restore.md#6-verify-backup-penting) section verify).
3. Cek count baris key tables match expectation.
4. Coba login ke app yg connect ke DB tersebut.

Catat hasilnya — kalau ada step yg gagal, fix scriptnya sebelum kelupaan.

---

## Backup khusus Supabase

Kalau pake Supabase, lo udah dapet **daily automated backup** built-in (Pro plan ke atas, retensi 7 hari). Tapi tetep bikin off-site dump sendiri karena:
- Backup Supabase cuma bisa restore ke project Supabase yg sama.
- Kalau lo mau migrasi keluar dari Supabase atau pull data ke lokal → harus `pg_dump` manual.
- Retensi 7 hari kadang gak cukup buat audit.

Setup yg sama, tinggal ganti opsi di script jadi pake `DATABASE_URL`:
```bash
DATABASE_URL="postgresql://postgres.xxx:PASS@aws-x.pooler.supabase.com:5432/postgres"
```

Catatan:
- Pakai **Session pooler (5432)**, **bukan** Transaction pooler (6543).
- Simpen `DATABASE_URL` di `/etc/hrms-backup.env` (chmod 600) lalu source di script — jangan hardcode password.

---

## Skenario disaster recovery

Latihan apa yg lo lakuin kalau:

### Skenario A: VPS lokal mati / data corrupt

1. SSH ke VPS baru / restore VPS lama.
2. Pasang Docker + clone repo.
3. `docker compose up -d postgres` (cuma DB).
4. Pull backup terbaru dari S3/B2: `rclone copy myremote:hrms-backups/daily/<latest>.dump /tmp/`
5. Restore: `pg_restore -h localhost -p 5433 -U hrms -d hrms --no-owner --no-privileges /tmp/<file>.dump`
6. `docker compose up -d` (full stack).
7. Sanity check: login, cek data terakhir.

**Target RTO** (recovery time): < 1 jam. **Target RPO** (data loss tolerance): < 24 jam (sesuai jadwal backup harian).

### Skenario B: Bug di app drop data secara silent

1. Identify kapan kejadian (cek log).
2. Cek backup sebelum kejadian masih ada.
3. Restore ke DB **terpisah** (`hrms_recovery`), jangan langsung overwrite produksi.
4. Query data yg ilang dari DB recovery, export, lalu insert balik ke produksi.

---

## Cheatsheet

```bash
# Cek status timer
systemctl list-timers hrms-backup.timer

# Trigger backup manual
sudo systemctl start hrms-backup.service

# Liat log
journalctl -u hrms-backup.service -n 50 --no-pager

# Cek file backup terbaru
ls -lhrt /var/backups/hrms/daily/ | tail -5

# Test restore ke DB sementara (lihat backup-restore.md untuk detail)
pg_restore -h localhost -p 5433 -U hrms -d hrms_test --no-owner --no-privileges <file>.dump
```

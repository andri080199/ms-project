# Cron / Scheduled Jobs FIERSA

Panduan setup scheduled jobs di HRMS — saat ini ada **1 cron**: notifikasi ulang tahun karyawan ke approval admin. Endpoint cron di app **bukan scheduler** — dia cuma HTTP route yg di-protect token. Pemicunya **harus diset di luar app** (system crontab, systemd, Vercel cron, GitHub Actions, dst).

## Daftar cron yg tersedia

| Endpoint | Tujuan | Schedule rekomendasi |
| --- | --- | --- |
| `GET/POST /api/cron/birthdays` | Kirim 1 email konsolidasi ke semua approval admin berisi daftar karyawan yg ultah hari ini | Harian, **08:00 Asia/Jakarta** |

Semua endpoint cron ada di `src/app/api/cron/<nama>/route.ts`.

## Env vars

Wajib di `.env`:

| Var | Isi | Catatan |
| --- | --- | --- |
| `CRON_SECRET` | string acak panjang | Generate: `openssl rand -hex 32`. Wajib match sama yg dikirim trigger. |
| `APP_URL` | base URL app | Buat tau URL endpoint cron yg mau dipanggil. |
| `HRMS_TZ` | timezone (opsional) | Default `Asia/Jakarta`. Dipake buat ngitung "hari ini" di birthday cron. |

## Autentikasi

Endpoint cron nolak request tanpa token. Dua cara kirim token:

**Cara 1 — query param:**
```
?token=<CRON_SECRET>
```

**Cara 2 — Authorization header:**
```
Authorization: Bearer <CRON_SECRET>
```

Salah satu cukup. Kalau salah/kosong → `401 Unauthorized`.

## Tes manual (sebelum setup scheduler)

Test dulu endpoint hidup & token bener:

```bash
curl "https://domain-lo.com/api/cron/birthdays?token=$CRON_SECRET"
```

Respons sukses:
```json
{
  "success": true,
  "data": {
    "birthdayCount": 1,
    "recipientCount": 2,
    "birthdays": [{ "id": "...", "name": "Andri" }]
  }
}
```

Kalau `birthdayCount: 0` → emang gak ada yg ultah hari ini (atau `birthdate` user kosong). Cek user di DB:
```sql
SELECT id, name, birthdate FROM "User" WHERE birthdate IS NOT NULL;
```

## Setup di VPS — Pilihan 1: crontab Linux (paling simple)

**Cek timezone server dulu:**
```bash
timedatectl
```

Liat baris `Time zone`. Mapping:
- `Asia/Jakarta` → cron expr **`0 8 * * *`** (jam 08:00 lokal)
- `UTC` → cron expr **`0 1 * * *`** (08:00 WIB = 01:00 UTC)

**Edit crontab user (jangan root kalau gak perlu):**
```bash
crontab -e
```

Tambahin (sesuaikan TZ & domain):
```cron
# FIERSA — birthday notif jam 08:00 WIB (server UTC)
0 1 * * * curl -fsS "https://domain-lo.com/api/cron/birthdays?token=GANTI_CRON_SECRET" >> /var/log/hrms-cron.log 2>&1
```

Penjelasan flag `curl`:
- `-f` → exit non-zero kalau HTTP error (biar `cron` bisa tau gagal)
- `-s` → silent (gak ada progress bar)
- `-S` → tetep print error meski silent

**Cek crontab udah ke-save:**
```bash
crontab -l
```

**Liat log eksekusi:**
```bash
tail -f /var/log/hrms-cron.log
# atau
grep CRON /var/log/syslog
```

## Setup di VPS — Pilihan 2: systemd timer (lebih robust)

Lebih rapih, logging via `journalctl`, auto-retry kalau server reboot, ada `OnBootSec` buat catch-up kalau server lagi mati pas jadwal jalan.

**1. Bikin service file:** `/etc/systemd/system/hrms-birthdays.service`
```ini
[Unit]
Description=FIERSA — birthday notification trigger
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -fsS "https://domain-lo.com/api/cron/birthdays?token=GANTI_CRON_SECRET"
```

**2. Bikin timer file:** `/etc/systemd/system/hrms-birthdays.timer`
```ini
[Unit]
Description=Run FIERSA birthday notif daily at 08:00 Asia/Jakarta

[Timer]
OnCalendar=*-*-* 08:00:00 Asia/Jakarta
Persistent=true
Unit=hrms-birthdays.service

[Install]
WantedBy=timers.target
```

`Persistent=true` artinya kalau server reboot di tengah jadwal yg ke-skip, dia bakal jalanin sekali pas boot.

**3. Enable & start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hrms-birthdays.timer
```

**4. Verifikasi:**
```bash
# liat next trigger
systemctl list-timers hrms-birthdays.timer

# liat log eksekusi terakhir
journalctl -u hrms-birthdays.service -n 50 --no-pager

# trigger manual sekarang (buat tes)
sudo systemctl start hrms-birthdays.service
```

## Setup di Vercel (kalau deploy ke Vercel, bukan VPS)

Tambahin `vercel.json` di root:
```json
{
  "crons": [
    {
      "path": "/api/cron/birthdays?token=GANTI_CRON_SECRET",
      "schedule": "0 1 * * *"
    }
  ]
}
```

⚠ **Catatan:**
- Schedule selalu UTC (gak bisa pake TZ Jakarta langsung). `0 1 * * *` = 08:00 WIB.
- Vercel Hobby tier max 2 cron, Pro tier max 40. [Docs](https://vercel.com/docs/cron-jobs).
- Token di URL aman karena Vercel cron call lewat internal network.

## Setup via GitHub Actions (alternatif gratis)

Bikin `.github/workflows/birthday-cron.yml`:
```yaml
name: Birthday Cron
on:
  schedule:
    - cron: '0 1 * * *' # 08:00 WIB
  workflow_dispatch:    # biar bisa trigger manual dari UI

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Hit endpoint
        run: |
          curl -fsS "${{ secrets.APP_URL }}/api/cron/birthdays?token=${{ secrets.CRON_SECRET }}"
```

Set `APP_URL` & `CRON_SECRET` di **Settings → Secrets and variables → Actions**.

⚠ GitHub schedule kadang delay 5–15 menit, dan auto-disable kalau repo gak ada aktivitas 60 hari.

## Troubleshooting

**`401 Unauthorized`**
- Cek `.env` di server udah ada `CRON_SECRET` (bukan cuma `.env.example`).
- Restart dev/prod server abis ubah `.env` (Next.js cuma baca env saat boot).
- Pastiin token di crontab match sama `.env` — copy-paste, jangan typo.

**`birthdayCount: 0` padahal ada yg ultah hari ini**
- Cek `birthdate` user gak null & format tanggalnya valid.
- Cron pake `HRMS_TZ` (default Asia/Jakarta) buat banding month+day — tahun di-ignore.
- Liat log server: ada `[notifyBirthdays]` warning?

**Email gak masuk**
- Cek `SMTP_*` di `.env` (liat [docs/email.md](./email.md)).
- Pastiin ada minimal 1 user dgn `isApprovalAdmin = true`.
- Cek folder spam.

**Cron gak jalan sama sekali (crontab)**
- `service cron status` — pastiin daemon hidup.
- Cek log: `grep CRON /var/log/syslog | tail -20`.
- Pastiin path absolut: `which curl` → biasanya `/usr/bin/curl`. Cron env minimalis, gak punya `$PATH` full.

**Cron gak jalan sama sekali (systemd)**
- `systemctl status hrms-birthdays.timer` — active?
- `systemctl list-timers --all | grep hrms` — next trigger time bener?
- `journalctl -u hrms-birthdays.service` — ada error?

## Nambahin cron baru

1. Bikin route: `src/app/api/cron/<nama>/route.ts`. Pola minimum (copy dari `birthdays/route.ts`):
   ```ts
   import { NextResponse } from 'next/server';
   export const dynamic = 'force-dynamic';
   export const runtime = 'nodejs';

   function isAuthorized(req: Request): boolean {
     const expected = process.env.CRON_SECRET;
     if (!expected) return false;
     const url = new URL(req.url);
     const tokenFromQuery = url.searchParams.get('token');
     const header = req.headers.get('authorization') ?? '';
     const tokenFromHeader = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
     return tokenFromQuery === expected || tokenFromHeader === expected;
   }

   async function handle(req: Request) {
     if (!isAuthorized(req)) {
       return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
     }
     // ... logic ...
     return NextResponse.json({ success: true, data: result });
   }

   export async function GET(req: Request) { return handle(req); }
   export async function POST(req: Request) { return handle(req); }
   ```

2. Tambahin entry-nya di **Daftar cron yg tersedia** di atas.
3. Tambahin trigger sesuai pilihan deploy (crontab / systemd / Vercel / Actions).

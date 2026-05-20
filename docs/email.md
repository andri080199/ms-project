# Email / Notifikasi FIERSA

Rangkuman cara kerja email di HRMS (FIERSA). Dipakai buat notifin approver pas ada pengajuan baru, dan notifin submitter pas pengajuannya diputuskan (approve/reject, per tahap SPV & HR).

## Stack

- **Transport:** dua provider, switch via env. Default **SMTP** (nodemailer/Gmail). Alternatif **Resend** (HTTPS API).
- **Switch:** env `MAIL_PROVIDER` — `"smtp"` (default) atau `"resend"`. Cuma satu yg aktif per proses.
- **Format:** HTML inline-styled, lebar maks 560px, tema sejalan sama glass UI FIERSA (gradient hijau `#1F6F5F → #2FA084`).

## Pilih provider

| | SMTP (Gmail) | Resend |
| --- | --- | --- |
| Protokol | SMTP port 587 | HTTPS REST API |
| Auth | App Password Gmail | API key (`re_xxx`) |
| Limit | Gmail 500/day | Free 100/day, 3000/month |
| `from` | Bisa pake `@gmail.com` | **Wajib** domain ter-verify SPF/DKIM di Resend |
| Deliverability | Tergantung reputasi Gmail | Bagus, ada dashboard bounce/open |
| Cocok buat | Dev & internal kecil | Production / volume nyata |

Ganti aktif tinggal edit `MAIL_PROVIDER` di `.env` terus **restart server** (env cuma dibaca pas boot).

## Env vars

Wajib di `.env` (liat `.env.example`):

**Umum (selalu):**

| Var | Isi | Catatan |
| --- | --- | --- |
| `MAIL_PROVIDER` | `smtp` \| `resend` | Default `smtp` kalau kosong. Selain itu → throw. |
| `APP_URL` | base URL app | Dipake buat CTA link, default `http://localhost:3000`. |

**Kalau `MAIL_PROVIDER=smtp`:**

| Var | Isi | Catatan |
| --- | --- | --- |
| `SMTP_USER` | email Gmail pengirim | Akun yg App Password-nya dipake. |
| `SMTP_PASS` | Gmail App Password 16 char | Bukan password login. Generate di https://myaccount.google.com/apppasswords. |
| `SMTP_FROM` | `Nama <email>` | Opsional, fallback ke `SMTP_USER`. |

Kalau kosong → `getSmtpTransporter()` throw pas email pertama mau dikirim.

**Kalau `MAIL_PROVIDER=resend`:**

| Var | Isi | Catatan |
| --- | --- | --- |
| `RESEND_API_KEY` | API key dari dashboard Resend | Format `re_...`. Generate di https://resend.com/api-keys. |
| `RESEND_FROM` | `Nama <email@domain-verified>` | **Wajib** pake domain yg udah verify di Resend (SPF/DKIM). Buat dev sementara boleh `onboarding@resend.dev` (cuma bisa kirim ke email akun signup). |

Kalau kosong / domain belum verify → Resend SDK throw, message di-pass-through ke caller.

## File utama

### `src/lib/mailer.ts`
Core transport — provider-agnostic. Pilih implementasi runtime via `MAIL_PROVIDER`.

**Public API (caller cuma sentuh ini):**

- `sendMail(payload)` → `Promise<MailResult>`. Dispatch ke SMTP/Resend sesuai env. Return `{ messageId, provider }`. Dipake kalau caller mau tahu hasil/error (mis. `/api/test-email`).
- `fireAndForgetMail(payload, label)` — kirim tanpa nunggu; error di-log dengan prefix `[mailer:<label>]`. Dipake di flow normal biar response API user ga ke-block sama transport.
- `getActiveMailProvider()` → `"smtp" | "resend"`. Buat debug endpoint.

**Internal:**

- `resolveProvider()` — baca `MAIL_PROVIDER` env, normalize lowercase, throw kalau value gak dikenal.
- `getSmtpTransporter()` — lazy-init `nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })`, cache module-level.
- `getResendClient()` — lazy-init `new Resend(apiKey)`, cache module-level.
- `sendViaSmtp(payload)` / `sendViaResend(payload)` — implementasi per provider. Resend di-pass `to` selalu sebagai array.

**Types:**

- `MailPayload` = `{ to: string | string[]; subject: string; html: string; text?: string }`.
- `MailResult` = `{ messageId: string; provider: "smtp" | "resend" }`.

### `src/lib/notifications.ts`
Layer bisnis di atas mailer. Bentukin HTML + tentuin recipient. Export 2 fungsi:

- `notifyNewSubmission({ kind, requestId, summary, submitter })` — dipanggil pas user submit pengajuan baru.
- `notifyDecisionToSubmitter({ kind, requestId, summary, submitter, action, stage, decidedBy, comment, isFinalApproval })` — dipanggil pas approver approve/reject.

`RequestKind` yg di-support: `overtime`, `reimbursement`, `business-trip`, `leave`.

Helper internal:
- `wrapHtml(opts)` — template email konsisten: badge warna, judul, greeting, tabel key-value, tombol CTA, footer disclaimer FIERSA.
- `summaryRows(submitter, summary)` — parse array string `"Label: value"` jadi baris tabel, selalu diawali baris `Karyawan`.
- `getUser(id)` / `getReimbursementApprovers()` — ambil penerima dari Prisma.
- `appUrl()` — resolve `APP_URL`.

### `src/app/api/test-email/route.ts`
`GET /api/test-email` — kirim email tes ke email session user yg lagi login. Auth pake `auth()` (next-auth). Return JSON `{ success, messageId }` kalau sukses, 401 kalau belum login, 500 kalau transport error. Pake `sendMail` (bukan fire-and-forget) biar error kebaca di response. Endpoint ini otomatis pake provider yg lagi aktif — gak perlu diubah pas switch SMTP ↔ Resend.

## Routing penerima

### Pengajuan baru (`notifyNewSubmission`)
- **reimbursement:** semua user dgn `position.name = "People & GA Officer"`. Kalau gak ada → log warn, skip.
- **overtime / business-trip / leave:** `submitter.spvId` (atasan langsung). Kalau submitter belum punya approval / email approver kosong → log warn, skip.

### Keputusan ke submitter (`notifyDecisionToSubmitter`)
Selalu kirim ke `submitter.email`. Kalau kosong langsung return (no-op).

## State & copy email keputusan

Logic di `notifyDecisionToSubmitter` bedain 3 state via badge + subject + copy:

| Kondisi | Badge | Warna | Subject |
| --- | --- | --- | --- |
| `action = REJECT` (tahap apa pun) | `Ditolak` | `#dc2626` | `[FIERSA] Pengajuan <X> Anda ditolak` |
| `APPROVE` & `isFinalApproval = true` | `Disetujui` | `#16a34a` | `[FIERSA] Pengajuan <X> Anda disetujui` |
| `APPROVE` & `isFinalApproval = false` (lolos SPV, lanjut HR) | `Lolos Tahap SPV` | `#0ea5e9` | `[FIERSA] Pengajuan <X> Anda lolos tahap SPV` |

`stage` (`SPV` / `HR`) dipetain ke label "atasan" / "HR" di baris `Diputuskan oleh`. Kalau ada `comment`, masuk baris `Catatan` (approve) atau `Alasan` (reject).

## Titik panggil di API

- `POST /api/overtime` → `notifyNewSubmission({ kind: 'overtime', ... })`
- `POST /api/reimbursement` → `notifyNewSubmission({ kind: 'reimbursement', ... })`
- `POST /api/business-trip` → `notifyNewSubmission({ kind: 'business-trip', ... })`
- `POST /api/leave` → `notifyNewSubmission({ kind: 'leave', ... })`
- `PATCH /api/approvals/[id]` → `notifyDecisionToSubmitter(...)` dipanggil 1x per cabang (overtime/reimbursement/business-trip/leave × SPV/HR × approve/reject), setelah transaksi Prisma selesai.

Semua panggilan di flow normal pake `fireAndForgetMail` di dalem `notifications.ts`, jadi endpoint API gak nunggu SMTP. Error ke-log aja, gak ngaruh ke response user.

## Error handling

- `notifyNewSubmission` dibungkus `try/catch` → error di-log `[notifyNewSubmission] error`, gak di-throw.
- `notifyDecisionToSubmitter` ga pake try/catch luar krn payload udah deterministik; tapi pengirimannya via `fireAndForgetMail` jadi error tetep ke-catch di dalem.
- `fireAndForgetMail` log format: `[mailer:<label>] gagal kirim email`. `label` biasanya `<event>:<kind>:<requestId>` (mis. `new-submission:leave:abc123`, `decision:overtime:HR:APPROVE:xyz`).

## Setup Resend (kalau mau pindah dari SMTP)

1. Signup di https://resend.com — boleh pake email Gmail, tier free 3000/month udah cukup buat HRMS internal.
2. **Verify domain** di dashboard → Domains → Add Domain. Resend kasih record DNS (SPF, DKIM, MX opsional). Tambahin ke DNS provider domain lo (Cloudflare/Namecheap/dst). Tunggu sampe status "Verified" (biasanya < 5 menit).
3. Generate API key: Dashboard → API Keys → Create. Copy `re_...` token.
4. Edit `.env`:
   ```env
   MAIL_PROVIDER="resend"
   RESEND_API_KEY="re_xxxxxxxxxxxx"
   RESEND_FROM="FIERSA Notifikasi <notif@domain-lo.com>"
   ```
5. **Restart server** (Next.js cuma baca env pas boot).
6. Tes via `/api/test-email`.

**Buat dev/test sementara (tanpa domain custom):**
```env
RESEND_FROM="FIERSA Test <onboarding@resend.dev>"
```
Tapi `to`-nya **wajib** email akun yg dipake signup Resend. Kalau coba kirim ke email lain → 403.

## Switch balik ke SMTP

Edit `.env`:
```env
MAIL_PROVIDER="smtp"
```
Restart. Var SMTP & Resend boleh dua-duanya kepasang — yg gak aktif diabaikan.

## Tes manual

1. Login ke app (next-auth session aktif).
2. GET `http://localhost:3000/api/test-email`.
3. Kalau respon `{ success: true, messageId }` → provider aktif jalan. Cek inbox `session.user.email`.
4. Kalau 500 → liat `error` di response body:
   - SMTP: biasanya App Password salah / Gmail belum ngizinin.
   - Resend: biasanya domain belum verified / API key salah / `from` gak match domain verified.

## Catatan operasional

- Transporter & Resend client di-cache per-proses. Kalau env berubah, **restart dev/prod server**.
- Gmail service punya rate limit per akun. Untuk produksi nyata, switch ke Resend.
- HTML email pake inline style (bukan `<style>` tag) biar kompatibel sama mail client.
- Mau nambah provider lain (SES/Mailgun)? Bikin `sendViaXxx(payload): Promise<MailResult>` di `mailer.ts`, tambahin di `resolveProvider()`. Caller gak perlu berubah.

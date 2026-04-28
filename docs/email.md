# Email / Notifikasi FIERSA

Rangkuman cara kerja email di HRMS (FIERSA). Dipakai buat notifin approver pas ada pengajuan baru, dan notifin submitter pas pengajuannya diputuskan (approve/reject, per tahap SPV & HR).

## Stack

- **Transport:** [nodemailer](https://nodemailer.com) via Gmail (`service: 'gmail'`).
- **Auth:** Gmail App Password (bukan password akun biasa).
- **Format:** HTML inline-styled, lebar maks 560px, tema sejalan sama glass UI FIERSA (gradient hijau `#1F6F5F → #2FA084`).

## Env vars

Wajib di `.env` (liat `.env.example`):

| Var | Isi | Catatan |
| --- | --- | --- |
| `SMTP_USER` | email Gmail pengirim | akun yg App Password-nya dipake |
| `SMTP_PASS` | Gmail App Password 16 char | bukan password login |
| `SMTP_FROM` | `Nama <email>` | opsional, fallback ke `SMTP_USER` |
| `APP_URL` | base URL app | dipake buat CTA link, default `http://localhost:3000` |

Kalau `SMTP_USER` / `SMTP_PASS` kosong, `getTransporter()` langsung throw pas email pertama mau dikirim.

## File utama

### `src/lib/mailer.ts`
Core transport. Expose 3 hal:

- `getTransporter()` — internal, bikin transporter nodemailer sekali terus di-cache di module-level (`cached`). Dipanggil lazy pas `sendMail` pertama.
- `sendMail(payload)` — kirim email, return promise `SentMessageInfo` nodemailer. Dipake kalau caller mau tahu hasil/error (mis. endpoint `/api/test-email`).
- `fireAndForgetMail(payload, label)` — kirim tanpa nunggu; error di-log ke console dengan prefix `[mailer:<label>]`. Ini yg dipake di flow normal biar response API user ga ke-block sama SMTP.

`MailPayload`: `{ to: string | string[], subject, html, text? }`.

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
`GET /api/test-email` — kirim email tes ke email session user yg lagi login. Auth pake `auth()` (next-auth). Return JSON `{ success, messageId }` kalau sukses, 401 kalau belum login, 500 kalau SMTP error. Pake `sendMail` (bukan fire-and-forget) biar error kebaca di response.

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

## Tes manual

1. Login ke app (next-auth session aktif).
2. GET `http://localhost:3000/api/test-email`.
3. Kalau respon `{ success: true, messageId }` → SMTP jalan. Cek inbox `session.user.email`.
4. Kalau 500 → liat `error` di response body, biasanya App Password salah / Gmail belum ngizinin.

## Catatan operasional

- Transporter di-cache per-proses. Kalau env berubah, restart dev server.
- Gmail service punya rate limit. Untuk produksi nyata, swap ke SMTP provider (Resend/SES/Mailgun) dengan ganti `nodemailer.createTransport` di `mailer.ts`. Interface caller gak berubah.
- HTML email pake inline style (bukan `<style>` tag) biar kompatibel sama mail client.

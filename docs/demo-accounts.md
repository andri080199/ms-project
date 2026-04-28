# Akun Demo

Kredensial akun seed buat dev / testing. Di-generate sama `prisma/seed.ts` (hash pakai bcrypt). Jangan dipake di produksi.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@company.com` | `admin123` |
| HR | `hr@company.com` | `hr123` |
| SPV | `spv1@company.com`, `spv2@company.com` | `spv123` |
| Employee | `emp1@company.com` … `emp4@company.com` | `emp123` |

## Cara re-seed

```bash
npx prisma db seed
```

Liat `prisma/seed.ts` buat daftar user lengkap + struktur departemen/position.

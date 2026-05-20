import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageUsers } from '@/lib/permissions';
import { formatCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// Canonical column order for employee CSV export and template.
// Password column is always exported as empty string to avoid leaking hashes.
export const EXPORT_HEADERS = [
  'employeeId',
  'email',
  'name',
  'password',
  'phone',
  'position',
  'department',
  'employmentStatus',
  'joinDate',
  'approvalEmail',
  'isSuperAdmin',
  'isApprovalAdmin',
  'additionalPhone',
  'placeOfBirth',
  'birthdate',
  'gender',
  'maritalStatus',
  'bloodType',
  'religion',
  'nik',
  'idAddress',
  'postalCode',
  'residentialAddress',
  'passportNumber',
  'passportExpiry',
] as const;

// Formats a Date as YYYY-MM-DD (ISO 8601 date part only) for CSV cells.
function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

// Generates a compact YYYYMMdd-HHmm timestamp for use in the exported filename.
function tsTag(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

// Exports employee data as a CSV file.
// ?template=1 returns a single example row with column headers and no real data —
// used as a download starter for bulk import.
// Without the query param, exports all employees (passwords redacted as empty strings).
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageUsers(session.user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const isTemplate = searchParams.get('template') === '1';

    if (isTemplate) {
      const example: string[] = [
        '1001',
        'budi@company.com',
        'Budi Santoso',
        'PasswordKuat123!',
        '081234567890',
        'Software Engineer',
        'Technology',
        'Karyawan Tetap',
        '2024-01-15',
        'manager@company.com',
        'false',
        'false',
        '081311112222',
        'Jakarta',
        '1995-06-20',
        'MALE',
        'SINGLE',
        'O',
        'Islam',
        '3173xxxxxxxx',
        'Jl. Sudirman 1',
        '12190',
        'Jl. Sudirman 1',
        'A1234567',
        '2030-12-31',
      ];
      const csv = formatCsv([...EXPORT_HEADERS], [example]);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="employee-template.csv"',
        },
      });
    }

    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: {
        position: { select: { name: true } },
        spv: { select: { email: true } },
      },
    });

    // Map each user to a row matching EXPORT_HEADERS order exactly.
    // Password column is always empty — hashes must never be exported.
    const rows: (string | null)[][] = users.map((u) => [
      u.employeeId,
      u.email,
      u.name,
      '',
      u.phone,
      u.position?.name ?? null,
      u.department,
      u.employmentStatus,
      fmtDate(u.joinDate),
      u.spv?.email ?? null,
      u.isSuperAdmin ? 'true' : 'false',
      u.isApprovalAdmin ? 'true' : 'false',
      u.additionalPhone,
      u.placeOfBirth,
      fmtDate(u.birthdate),
      u.gender,
      u.maritalStatus,
      u.bloodType,
      u.religion,
      u.nik,
      u.idAddress,
      u.postalCode,
      u.residentialAddress,
      u.passportNumber,
      fmtDate(u.passportExpiry),
    ]);

    const csv = formatCsv([...EXPORT_HEADERS], rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="employees-${tsTag()}.csv"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal export CSV' }, { status: 500 });
  }
}

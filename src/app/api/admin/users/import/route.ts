import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageUsers } from '@/lib/permissions';
import { DEPARTMENTS } from '@/lib/departments';

export const dynamic = 'force-dynamic';

type Row = Record<string, string>;

type Action = 'CREATE' | 'UPDATE' | 'ERROR';
type Result = { index: number; email: string; name: string; action: Action; message?: string };
type Summary = { total: number; create: number; update: number; error: number };

// Internal representation of a validated row ready to be written to the DB.
type Op =
  | { kind: 'CREATE'; data: Record<string, unknown>; password: string }
  | { kind: 'UPDATE'; data: Record<string, unknown>; password: string | null; existingId: string };

// Hard limit to prevent accidentally importing very large files in a single request.
const MAX_ROWS = 1000;

// Validation patterns and lookup sets used during row processing.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGITS_RE = /^\d+$/;
const BOOL_TRUE = new Set(['true', '1', 'yes', 'y', 'on']);
const BOOL_FALSE = new Set(['false', '0', 'no', 'n', 'off']);
const VALID_GENDER = new Set(['MALE', 'FEMALE']);
const VALID_MARITAL = new Set(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']);
const VALID_BLOOD = new Set(['A', 'B', 'AB', 'O']);
const VALID_DEPTS = new Set<string>(DEPARTMENTS);

// Parses common boolean representations; returns null if the value is unrecognised.
function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (BOOL_TRUE.has(v)) return true;
  if (BOOL_FALSE.has(v)) return false;
  return null;
}

// Two-phase import endpoint: ?dryRun=true validates all rows and returns a preview without
// writing anything to the DB; without dryRun it executes the actual upserts.
// Matching is done by email — existing email → UPDATE, new email → CREATE.
// Rows are processed sequentially so bcrypt hashing happens on-demand per row without
// blocking unrelated rows from being reported in case of an error.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageUsers(session.user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const rows: Row[] = Array.isArray(body?.rows) ? body.rows : [];
    const dryRun = !!body?.dryRun;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'CSV tidak berisi data' }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: `Maksimal ${MAX_ROWS} baris per import` },
        { status: 400 },
      );
    }

    // Pre-load all positions and users into memory to avoid N+1 queries during row processing.
    const [allPositions, allUsers] = await Promise.all([
      prisma.position.findMany({ select: { id: true, name: true } }),
      prisma.user.findMany({ select: { id: true, email: true, employeeId: true } }),
    ]);
    const posByName = new Map(allPositions.map((p) => [p.name.toLowerCase(), p]));
    const userByEmail = new Map(allUsers.map((u) => [u.email.toLowerCase(), u]));
    const userByEmpId = new Map(
      allUsers.filter((u) => u.employeeId).map((u) => [u.employeeId!, u]),
    );

    const results: Result[] = [];
    // ops[i] mirrors results[i] — null means the row errored and should be skipped during commit.
    const ops: (Op | null)[] = [];
    // Track emails/empIds seen so far in this import to catch intra-CSV duplicates.
    const seenEmails = new Set<string>();
    const seenEmpIds = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const email = (row.email ?? '').trim().toLowerCase();
      const name = (row.name ?? '').trim();

      // Helper that marks this row as an error and pushes a null op placeholder.
      const fail = (msg: string) => {
        results.push({ index: i + 1, email, name, action: 'ERROR', message: msg });
        ops.push(null);
      };

      if (!email || !EMAIL_RE.test(email)) {
        fail('Email tidak valid');
        continue;
      }
      if (seenEmails.has(email)) {
        fail('Email duplikat di CSV');
        continue;
      }
      seenEmails.add(email);

      const existing = userByEmail.get(email);

      if (!existing && (name.length < 2 || name.length > 100)) {
        fail('Nama wajib (2–100 karakter) untuk akun baru');
        continue;
      }
      if (name.length > 100) {
        fail('Nama maksimal 100 karakter');
        continue;
      }

      const hasCol = (k: string) => Object.prototype.hasOwnProperty.call(row, k);
      // For UPDATE rows, undefined means "don't touch this field".
      // For CREATE rows, undefined is not valid — use the provided emptyValForNew default instead.
      const emptyOrKeep = <T>(emptyValForNew: T): T | undefined => (existing ? undefined : emptyValForNew);

      // --- employeeId ---
      let employeeId: string | null | undefined = undefined;
      if (hasCol('employeeId')) {
        const raw = (row.employeeId ?? '').trim();
        if (raw === '') {
          employeeId = emptyOrKeep<null>(null);
        } else {
          if (!DIGITS_RE.test(raw)) {
            fail('Employee ID harus angka');
            continue;
          }
          if (raw.length > 20) {
            fail('Employee ID maksimal 20 digit');
            continue;
          }
          if (seenEmpIds.has(raw)) {
            fail(`Employee ID ${raw} duplikat di CSV`);
            continue;
          }
          seenEmpIds.add(raw);
          const owner = userByEmpId.get(raw);
          // Block if another user already owns this employee ID.
          if (owner && (!existing || owner.id !== existing.id)) {
            fail(`Employee ID ${raw} sudah dipakai user lain`);
            continue;
          }
          employeeId = raw;
        }
      }

      // --- position (resolved by name to ID) ---
      let positionId: string | null | undefined = undefined;
      if (hasCol('position')) {
        const raw = (row.position ?? '').trim();
        if (raw === '') {
          positionId = emptyOrKeep<null>(null);
        } else {
          const p = posByName.get(raw.toLowerCase());
          if (!p) {
            fail(`Posisi "${raw}" tidak ditemukan`);
            continue;
          }
          positionId = p.id;
        }
      }

      // --- department (validated against canonical list) ---
      let department: string | null | undefined = undefined;
      if (hasCol('department')) {
        const raw = (row.department ?? '').trim();
        if (raw === '') {
          department = emptyOrKeep<null>(null);
        } else {
          if (!VALID_DEPTS.has(raw)) {
            fail(`Departemen "${raw}" tidak valid`);
            continue;
          }
          department = raw;
        }
      }

      // --- approvalEmail → spvId (resolved by email to user ID) ---
      let spvId: string | null | undefined = undefined;
      if (hasCol('approvalEmail')) {
        const raw = (row.approvalEmail ?? '').trim().toLowerCase();
        if (raw === '') {
          spvId = emptyOrKeep<null>(null);
        } else {
          const s = userByEmail.get(raw);
          if (!s) {
            fail(`Approval "${raw}" tidak ditemukan`);
            continue;
          }
          spvId = s.id;
        }
      }
      // Prevent self-SPV assignment even when updating an existing user.
      if (existing && spvId === existing.id) {
        fail('User tidak bisa menjadi SPV dirinya sendiri');
        continue;
      }

      // --- boolean flags (isSuperAdmin, isApprovalAdmin) ---
      const parseFlag = (k: string): boolean | undefined => {
        if (!hasCol(k)) return undefined;
        const raw = (row[k] ?? '').trim();
        if (raw === '') return emptyOrKeep<boolean>(false);
        const v = parseBool(raw);
        if (v === null) throw new Error(`${k} harus true/false`);
        return v;
      };

      let isSuperAdmin: boolean | undefined;
      let isApprovalAdmin: boolean | undefined;
      try {
        isSuperAdmin = parseFlag('isSuperAdmin');
        isApprovalAdmin = parseFlag('isApprovalAdmin');
      } catch (e) {
        fail((e as Error).message);
        continue;
      }

      // --- enum fields (gender, maritalStatus, bloodType) ---
      const parseEnumField = <T extends string>(k: string, valid: Set<string>): T | null | undefined => {
        if (!hasCol(k)) return undefined;
        const raw = (row[k] ?? '').trim().toUpperCase();
        if (raw === '') return emptyOrKeep<null>(null);
        if (!valid.has(raw)) throw new Error(`${k} "${raw}" tidak valid`);
        return raw as T;
      };

      let gender: 'MALE' | 'FEMALE' | null | undefined;
      let maritalStatus: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | null | undefined;
      let bloodType: 'A' | 'B' | 'AB' | 'O' | null | undefined;
      try {
        gender = parseEnumField('gender', VALID_GENDER);
        maritalStatus = parseEnumField('maritalStatus', VALID_MARITAL);
        bloodType = parseEnumField('bloodType', VALID_BLOOD);
      } catch (e) {
        fail((e as Error).message);
        continue;
      }

      // --- date fields (birthdate, passportExpiry, joinDate) ---
      const parseDateField = (k: string): Date | null | undefined => {
        if (!hasCol(k)) return undefined;
        const raw = (row[k] ?? '').trim();
        if (raw === '') return emptyOrKeep<null>(null);
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) throw new Error(`${k} tanggal tidak valid (format YYYY-MM-DD)`);
        return d;
      };

      let birthdate: Date | null | undefined;
      let passportExpiry: Date | null | undefined;
      let joinDate: Date | null | undefined;
      try {
        birthdate = parseDateField('birthdate');
        passportExpiry = parseDateField('passportExpiry');
        joinDate = parseDateField('joinDate');
      } catch (e) {
        fail((e as Error).message);
        continue;
      }

      // --- free-text fields with max-length validation ---
      const parseStr = (k: string, maxLen: number): string | null | undefined => {
        if (!hasCol(k)) return undefined;
        const raw = (row[k] ?? '').trim();
        if (raw === '') return emptyOrKeep<null>(null);
        if (raw.length > maxLen) throw new Error(`${k} terlalu panjang (max ${maxLen})`);
        return raw;
      };

      let phone, employmentStatus, additionalPhone, placeOfBirth, religion, nik, idAddress, postalCode, residentialAddress, passportNumber;
      try {
        phone = parseStr('phone', 30);
        employmentStatus = parseStr('employmentStatus', 100);
        additionalPhone = parseStr('additionalPhone', 30);
        placeOfBirth = parseStr('placeOfBirth', 100);
        religion = parseStr('religion', 50);
        nik = parseStr('nik', 30);
        idAddress = parseStr('idAddress', 500);
        postalCode = parseStr('postalCode', 10);
        residentialAddress = parseStr('residentialAddress', 500);
        passportNumber = parseStr('passportNumber', 50);
      } catch (e) {
        fail((e as Error).message);
        continue;
      }

      // --- password: required for new accounts, optional for updates ---
      const password = (row.password ?? '').trim();
      if (!existing) {
        if (password.length < 6 || password.length > 200) {
          fail('Password wajib (6–200 karakter) untuk akun baru');
          continue;
        }
      } else if (password && (password.length < 6 || password.length > 200)) {
        fail('Password harus 6–200 karakter');
        continue;
      }

      // Build the Prisma data object from only the fields that are defined (not undefined).
      const data: Record<string, unknown> = {};
      const setIfDef = <T>(k: string, v: T | undefined) => {
        if (v !== undefined) data[k] = v;
      };

      // email is always set on CREATE; for UPDATE only name is allowed to change here
      // (email changes are handled via the individual user PATCH endpoint).
      if (existing) {
        if (name) data.name = name;
      } else {
        data.email = email;
        data.name = name;
      }
      setIfDef('employeeId', employeeId);
      setIfDef('phone', phone);
      setIfDef('positionId', positionId);
      setIfDef('department', department);
      setIfDef('employmentStatus', employmentStatus);
      setIfDef('joinDate', joinDate);
      setIfDef('spvId', spvId);
      setIfDef('isSuperAdmin', isSuperAdmin);
      setIfDef('isApprovalAdmin', isApprovalAdmin);
      setIfDef('additionalPhone', additionalPhone);
      setIfDef('placeOfBirth', placeOfBirth);
      setIfDef('birthdate', birthdate);
      setIfDef('gender', gender);
      setIfDef('maritalStatus', maritalStatus);
      setIfDef('bloodType', bloodType);
      setIfDef('religion', religion);
      setIfDef('nik', nik);
      setIfDef('idAddress', idAddress);
      setIfDef('postalCode', postalCode);
      setIfDef('residentialAddress', residentialAddress);
      setIfDef('passportNumber', passportNumber);
      setIfDef('passportExpiry', passportExpiry);

      if (existing) {
        ops.push({ kind: 'UPDATE', data, password: password || null, existingId: existing.id });
        results.push({ index: i + 1, email, name: name || existing.email, action: 'UPDATE' });
      } else {
        ops.push({ kind: 'CREATE', data, password });
        results.push({ index: i + 1, email, name, action: 'CREATE' });
      }
    }

    // Dry-run: return results without writing anything to the DB.
    if (dryRun) {
      return NextResponse.json({ success: true, data: { results, summary: countActions(results) } });
    }

    // Real import: execute each op, updating the result in-place on failure.
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (!op) continue;
      try {
        if (op.kind === 'CREATE') {
          const hashed = await bcrypt.hash(op.password, 10);
          const createData = { ...op.data, password: hashed } as Prisma.UserUncheckedCreateInput;
          await prisma.user.create({ data: createData });
        } else {
          const data: Record<string, unknown> = { ...op.data };
          if (op.password) data.password = await bcrypt.hash(op.password, 10);
          await prisma.user.update({
            where: { id: op.existingId },
            data: data as Prisma.UserUncheckedUpdateInput,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Gagal proses';
        results[i] = { ...results[i], action: 'ERROR', message: msg };
      }
    }

    return NextResponse.json({ success: true, data: { results, summary: countActions(results) } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Gagal import CSV' }, { status: 500 });
  }
}

// Tallies CREATE / UPDATE / ERROR counts from the full results array.
function countActions(results: Result[]): Summary {
  let create = 0;
  let update = 0;
  let error = 0;
  for (const r of results) {
    if (r.action === 'CREATE') create++;
    else if (r.action === 'UPDATE') update++;
    else if (r.action === 'ERROR') error++;
  }
  return { total: results.length, create, update, error };
}

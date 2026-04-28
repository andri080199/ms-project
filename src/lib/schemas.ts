import { z } from 'zod';

export const overtimeSchema = z
  .object({
    date: z.string().min(1, 'Tanggal wajib diisi'),
    startTime: z.string().min(1, 'Jam mulai wajib diisi'),
    endTime: z.string().min(1, 'Jam selesai wajib diisi'),
    reason: z.string().min(10, 'Alasan minimal 10 karakter').max(1000),
    attachmentUrl: z.string().max(500).optional().nullable().or(z.literal('').transform(() => undefined)),
  })
  .superRefine((val, ctx) => {
    const d = new Date(val.date);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'Tanggal tidak valid' });
      return;
    }
    const now = new Date();
    const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < -30) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'Tanggal tidak boleh lebih dari 30 hari ke belakang' });
    }
    if (diffDays > 14) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'Tanggal tidak boleh lebih dari 14 hari ke depan' });
    }
    const start = new Date(val.startTime);
    const end = new Date(val.endTime);
    if (!(end.getTime() > start.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'Jam selesai harus setelah jam mulai' });
    }
  });

export const reimbursementItemSchema = z.object({
  category: z.enum(['OFFICE', 'HOTEL', 'TOLL', 'TRANSPORTATION', 'MEAL', 'OTHER']),
  amount: z.number().int().positive('Jumlah harus > 0'),
  transactionDate: z.string().min(1, 'Tanggal transaksi wajib diisi'),
  description: z.string().min(3, 'Deskripsi minimal 3 karakter').max(500),
  receiptUrl: z.string().max(500).optional().nullable().or(z.literal('').transform(() => undefined)),
});

export const reimbursementSchema = z.object({
  items: z.array(reimbursementItemSchema).min(1, 'Minimal 1 item reimbursement'),
});

export const businessTripSchema = z
  .object({
    startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
    endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
    destination: z.string().min(2, 'Tujuan wajib diisi').max(200),
    purpose: z.string().min(10, 'Tujuan perjalanan minimal 10 karakter').max(1000),
    tripType: z.enum(['WEEKDAY', 'WEEKEND']),
    attachmentUrl: z.string().max(500).optional().nullable().or(z.literal('').transform(() => undefined)),
  })
  .superRefine((val, ctx) => {
    const s = new Date(val.startDate);
    const e = new Date(val.endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'Tanggal tidak valid' });
      return;
    }
    if (e.getTime() < s.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Tanggal selesai harus >= tanggal mulai' });
    }
    const days = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days > 30) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Durasi maksimal 30 hari' });
    }
  });

export const leaveSchema = z
  .object({
    startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
    endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
    leaveType: z.enum(['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'UNPAID', 'OTHER']),
    reason: z.string().min(5, 'Alasan minimal 5 karakter').max(1000),
    attachmentUrl: z.string().max(500).optional().nullable().or(z.literal('').transform(() => undefined)),
  })
  .superRefine((val, ctx) => {
    const s = new Date(val.startDate);
    const e = new Date(val.endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'Tanggal tidak valid' });
      return;
    }
    if (e.getTime() < s.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Tanggal selesai harus >= tanggal mulai' });
    }
    const days = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days > 90) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Durasi maksimal 90 hari' });
    }
  });

export const approvalActionSchema = z.object({
  type: z.enum(['overtime', 'reimbursement', 'business-trip', 'leave']),
  action: z.enum(['APPROVE', 'REJECT']),
  comment: z.string().max(1000).optional(),
});

const BASE_ROLE = z.enum(['EMPLOYEE', 'SPV', 'HR', 'ADMIN']);

export const positionCreateSchema = z.object({
  name: z.string().min(2, 'Nama posisi minimal 2 karakter').max(100),
  baseRole: BASE_ROLE,
  department: z.string().max(100).nullable().optional().or(z.literal('').transform(() => null)),
});

export const positionUpdateSchema = positionCreateSchema.partial();

const employeeIdField = z
  .string()
  .max(20)
  .regex(/^\d+$/, 'ID Karyawan hanya boleh angka')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

export const userCreateSchema = z.object({
  email: z.string().email('Email tidak valid'),
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  password: z.string().min(6, 'Password minimal 6 karakter').max(200),
  role: BASE_ROLE,
  phone: z.string().max(30).optional().nullable(),
  positionId: z.string().optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  spvId: z.string().optional().nullable(),
  employeeId: employeeIdField,
  isSuperAdmin: z.boolean().optional(),
});

const emptyToNull = z.literal('').transform(() => null);
const optStr = (max = 500) => z.string().max(max).nullable().optional().or(emptyToNull);
const optDate = () =>
  z
    .string()
    .nullable()
    .optional()
    .or(emptyToNull)
    .refine((v) => v == null || v === '' || !Number.isNaN(new Date(v).getTime()), {
      message: 'Tanggal tidak valid',
    });

export const userUpdateSchema = z.object({
  email: z.string().email('Email tidak valid').optional(),
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(6).max(200).optional().or(z.literal('').transform(() => undefined)),
  role: BASE_ROLE.optional(),
  phone: z.string().max(30).nullable().optional(),
  positionId: z.string().nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  spvId: z.string().nullable().optional(),
  employeeId: employeeIdField,
  isSuperAdmin: z.boolean().optional(),
  additionalPhone: optStr(30),
  placeOfBirth: optStr(100),
  birthdate: optDate(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).nullable().optional(),
  bloodType: z.enum(['A', 'B', 'AB', 'O']).nullable().optional(),
  religion: optStr(50),
  nik: optStr(30),
  idAddress: optStr(500),
  postalCode: optStr(10),
  residentialAddress: optStr(500),
  passportNumber: optStr(50),
  passportExpiry: optDate(),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().email('Email tidak valid').optional(),
  employeeId: employeeIdField,
  phone: optStr(30),
  additionalPhone: optStr(30),
  placeOfBirth: optStr(100),
  birthdate: optDate(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).nullable().optional(),
  bloodType: z.enum(['A', 'B', 'AB', 'O']).nullable().optional(),
  religion: optStr(50),
  nik: optStr(30),
  idAddress: optStr(500),
  postalCode: optStr(10),
  residentialAddress: optStr(500),
  passportNumber: optStr(50),
  passportExpiry: optDate(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export type OvertimeInput = z.infer<typeof overtimeSchema>;
export type ReimbursementInput = z.infer<typeof reimbursementSchema>;
export type BusinessTripInput = z.infer<typeof businessTripSchema>;
export type LeaveInput = z.infer<typeof leaveSchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;

import type {
  OvertimeRequest,
  ReimbursementRequest,
  ReimbursementItem,
  BusinessTripRequest,
  LeaveRequest,
  ApprovalHistory,
  User,
  RequestStatus,
} from '@prisma/client';

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'department'>;

export type OvertimeWithUser = OvertimeRequest & {
  user: PublicUser;
  approvals?: (ApprovalHistory & { approver: PublicUser })[];
};

export type ReimbursementWithItems = ReimbursementRequest & {
  user: PublicUser;
  items: ReimbursementItem[];
  approvals?: (ApprovalHistory & { approver: PublicUser })[];
};

export type BusinessTripWithUser = BusinessTripRequest & {
  user: PublicUser;
  approvals?: (ApprovalHistory & { approver: PublicUser })[];
};

export type LeaveWithUser = LeaveRequest & {
  user: PublicUser;
  approvals?: (ApprovalHistory & { approver: PublicUser })[];
};

export type RequestKind = 'overtime' | 'reimbursement' | 'business-trip' | 'leave';

export type InboxItem =
  | { kind: 'overtime'; data: OvertimeWithUser }
  | { kind: 'reimbursement'; data: ReimbursementWithItems }
  | { kind: 'business-trip'; data: BusinessTripWithUser }
  | { kind: 'leave'; data: LeaveWithUser };

export const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: 'Cuti Tahunan',
  SICK: 'Sakit',
  PERSONAL: 'Pribadi',
  MATERNITY: 'Melahirkan',
  UNPAID: 'Cuti Tanpa Bayar',
  OTHER: 'Lainnya',
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Menunggu',
  SPV_APPROVED: 'Disetujui SPV',
  HR_APPROVED: 'Disetujui HR',
  REJECTED: 'Ditolak',
  DONE: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

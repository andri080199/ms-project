import type { Role } from '@prisma/client';

export type AccessUser = { role: Role; isSuperAdmin?: boolean | null };

function isSuper(u: AccessUser): boolean {
  return !!u.isSuperAdmin;
}

export function canApproveAsSpv(u: AccessUser): boolean {
  return u.role === 'SPV' || u.role === 'ADMIN' || isSuper(u);
}

export function canApproveAsHr(u: AccessUser): boolean {
  return u.role === 'HR' || u.role === 'ADMIN' || isSuper(u);
}

export function canManageUsers(u: AccessUser): boolean {
  return u.role === 'ADMIN' || isSuper(u);
}

export function canSeeApprovalsInbox(u: AccessUser): boolean {
  return u.role === 'SPV' || u.role === 'HR' || u.role === 'ADMIN' || isSuper(u);
}

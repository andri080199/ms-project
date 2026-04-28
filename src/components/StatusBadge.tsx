'use client';

import type { RequestStatus } from '@prisma/client';
import { useT } from '@/lib/i18n/provider';

const CLASS: Record<RequestStatus, string> = {
  DRAFT: 'status-draft',
  SUBMITTED: 'status-submitted',
  SPV_APPROVED: 'status-spv',
  HR_APPROVED: 'status-hr',
  DONE: 'status-done',
  REJECTED: 'status-rejected',
  CANCELLED: 'status-cancelled',
};

export default function StatusBadge({ status }: { status: RequestStatus }) {
  const t = useT();
  return <span className={`status-pill ${CLASS[status]}`}>{t(`status.${status}`)}</span>;
}

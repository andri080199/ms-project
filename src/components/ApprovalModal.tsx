'use client';

import { Button, Descriptions, Input, Modal, Typography, App } from 'antd';
import { useState } from 'react';
import StatusBadge from './StatusBadge';
import { formatDate, formatDateTime, formatRupiah, formatTime } from '@/lib/utils';
import {
  type BusinessTripWithUser,
  type InboxItem,
  type LeaveWithUser,
  type OvertimeWithUser,
  type ReimbursementWithItems,
} from '@/lib/types';
import { useFormatters, useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

type Props = {
  open: boolean;
  item: InboxItem | null;
  onClose: () => void;
  onDone: () => void;
  readOnly?: boolean;
};

export default function ApprovalModal({ open, item, onClose, onDone, readOnly }: Props) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState<'APPROVE' | 'REJECT' | null>(null);
  const { message } = App.useApp();
  const t = useT();

  if (!item) return null;

  async function handle(action: 'APPROVE' | 'REJECT') {
    if (!item) return;
    if (action === 'REJECT' && !comment.trim()) {
      message.warning(t('approvalModal.rejectReasonRequired'));
      return;
    }
    setLoading(action);
    try {
      const res = await fetch(`/api/approvals/${item.data.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: item.kind, action, comment: comment.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('approvalModal.errorProcess'));
        return;
      }
      message.success(action === 'APPROVE' ? t('approvalModal.msgApproved') : t('approvalModal.msgRejected'));
      setComment('');
      onDone();
    } finally {
      setLoading(null);
    }
  }

  const title =
    item.kind === 'overtime'
      ? t('approvalModal.titleOvertime')
      : item.kind === 'reimbursement'
      ? t('approvalModal.titleReimbursement')
      : item.kind === 'business-trip'
      ? t('approvalModal.titleTrip')
      : t('approvalModal.titleLeave');

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={title} width={720} destroyOnHidden>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Text strong style={{ color: 'rgb(var(--color-text-primary))' }}>
              {item.data.user.name}
            </Text>
            <div className="text-xs text-muted">
              {item.data.user.department ?? '—'} · {item.data.user.email}
            </div>
          </div>
          <StatusBadge status={item.data.status} />
        </div>

        {item.kind === 'overtime' && <OvertimeDetail data={item.data} />}
        {item.kind === 'reimbursement' && <ReimbursementDetail data={item.data} />}
        {item.kind === 'business-trip' && <TripDetail data={item.data} />}
        {item.kind === 'leave' && <LeaveDetail data={item.data} />}

        {item.data.approvals && item.data.approvals.length > 0 && (
          <div className="glass p-3">
            <Title level={5} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }}>
              {t('approvalModal.sectionHistory')}
            </Title>
            <div className="mt-2 space-y-2">
              {item.data.approvals.map((a) => (
                <div key={a.id} className="text-sm flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold">{a.stage}</span> —{' '}
                    {a.action === 'APPROVE' ? t('approvalModal.decisionApproved') : t('approvalModal.decisionRejected')}{' '}
                    {t('approvalModal.decidedByPrefix')} <span className="font-semibold">{a.approver.name}</span>
                    {a.comment ? <div className="text-muted text-xs mt-0.5">“{a.comment}”</div> : null}
                  </div>
                  <div className="text-xs text-muted whitespace-nowrap">{formatDateTime(a.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!readOnly && (
          <>
            <Input.TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={t('approvalModal.commentPlaceholder')}
              maxLength={1000}
            />
            <div className="flex gap-3 justify-end">
              <Button danger onClick={() => handle('REJECT')} loading={loading === 'REJECT'}>
                {t('approvalModal.btnReject')}
              </Button>
              <Button type="primary" onClick={() => handle('APPROVE')} loading={loading === 'APPROVE'}>
                {t('approvalModal.btnApprove')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function OvertimeDetail({ data }: { data: OvertimeWithUser }) {
  const t = useT();
  const { minutesToReadable } = useFormatters();
  return (
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label={t('approvalModal.rowDate')}>{formatDate(data.date)}</Descriptions.Item>
      <Descriptions.Item label={t('approvalModal.rowTime')}>
        {formatTime(data.startTime)} — {formatTime(data.endTime)}
      </Descriptions.Item>
      <Descriptions.Item label={t('approvalModal.rowDuration')}>{minutesToReadable(data.durationMinutes)}</Descriptions.Item>
      <Descriptions.Item label={t('approvalModal.rowReason')}>{data.reason}</Descriptions.Item>
      {data.attachmentUrl && (
        <Descriptions.Item label={t('approvalModal.rowAttachment')}>
          <a href={data.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary-light underline">
            {t('common.viewAttachment')}
          </a>
        </Descriptions.Item>
      )}
      {data.rejectedReason && (
        <Descriptions.Item label={t('approvalModal.rowRejectedReason')}>{data.rejectedReason}</Descriptions.Item>
      )}
    </Descriptions>
  );
}

function ReimbursementDetail({ data }: { data: ReimbursementWithItems }) {
  const t = useT();
  return (
    <div className="space-y-3">
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t('approvalModal.rowTotal')}>{formatRupiah(data.totalAmount)}</Descriptions.Item>
        <Descriptions.Item label={t('approvalModal.rowItemCount')}>{data.items.length}</Descriptions.Item>
        {data.rejectedReason && (
          <Descriptions.Item label={t('approvalModal.rowRejectedReason')}>{data.rejectedReason}</Descriptions.Item>
        )}
      </Descriptions>
      <div className="glass p-3">
        <Title level={5} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }}>
          {t('approvalModal.sectionItems')}
        </Title>
        <div className="mt-2 space-y-2">
          {data.items.map((it) => (
            <div key={it.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-semibold">
                  {t(`reimbCategory.${it.category}`)} — {formatRupiah(it.amount)}
                </div>
                <div className="text-muted text-xs">
                  {formatDate(it.transactionDate)} · {it.description}
                </div>
                {it.receiptUrl && (
                  <a href={it.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-primary-light underline">
                    {t('approvalModal.viewReceipt')}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeaveDetail({ data }: { data: LeaveWithUser }) {
  const t = useT();
  const { pluralDays } = useFormatters();
  return (
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label={t('approvalModal.rowLeaveType')}>{t(`leaveType.${data.leaveType}`)}</Descriptions.Item>
      <Descriptions.Item label={t('approvalModal.rowDate')}>
        {formatDate(data.startDate)} — {formatDate(data.endDate)}
      </Descriptions.Item>
      <Descriptions.Item label={t('approvalModal.rowTotalDays')}>{pluralDays(data.totalDays)}</Descriptions.Item>
      <Descriptions.Item label={t('approvalModal.rowReason')}>{data.reason}</Descriptions.Item>
      {data.attachmentUrl && (
        <Descriptions.Item label={t('approvalModal.rowAttachment')}>
          <a href={data.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary-light underline">
            {t('common.viewAttachment')}
          </a>
        </Descriptions.Item>
      )}
      {data.rejectedReason && (
        <Descriptions.Item label={t('approvalModal.rowRejectedReason')}>{data.rejectedReason}</Descriptions.Item>
      )}
    </Descriptions>
  );
}

function TripDetail({ data }: { data: BusinessTripWithUser }) {
  const t = useT();
  return (
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label={t('approvalModal.rowDestination')}>{data.destination}</Descriptions.Item>
      <Descriptions.Item label={t('approvalModal.rowDate')}>
        {formatDate(data.startDate)} — {formatDate(data.endDate)}
      </Descriptions.Item>
      <Descriptions.Item label={t('approvalModal.rowTripType')}>{t(`tripType.${data.tripType}`)}</Descriptions.Item>
      <Descriptions.Item label={t('approvalModal.rowPurpose')}>{data.purpose}</Descriptions.Item>
      {data.attachmentUrl && (
        <Descriptions.Item label={t('approvalModal.rowAttachment')}>
          <a href={data.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary-light underline">
            {t('common.viewAttachment')}
          </a>
        </Descriptions.Item>
      )}
      {data.rejectedReason && (
        <Descriptions.Item label={t('approvalModal.rowRejectedReason')}>{data.rejectedReason}</Descriptions.Item>
      )}
    </Descriptions>
  );
}

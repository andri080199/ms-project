'use client';

import { App, Button, Popconfirm, Tag } from 'antd';
import { PlusOutlined, CloseCircleOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import RequestsTable from '@/components/RequestsTable';
import StatusBadge from '@/components/StatusBadge';
import ApprovalModal from '@/components/ApprovalModal';
import PageHeader, { PageTitle } from '@/components/PageHeader';
import ColTitle from '@/components/ColTitle';
import { formatDate } from '@/lib/utils';
import type { ColumnsType } from 'antd/es/table';
import type { LeaveRequest } from '@prisma/client';
import type { InboxItem, LeaveWithUser } from '@/lib/types';
import { useFormatters, useT } from '@/lib/i18n/provider';


export default function LeaveListPage() {
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InboxItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const t = useT();
  const { pluralDays } = useFormatters();
  const { message } = App.useApp();

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/leave', { cache: 'no-store', signal: ctrl.signal });
        const json = await res.json();
        if (json.success) setRows(json.data);
        setLoading(false);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const isCancellable = (status: string) => status === 'SUBMITTED' || status === 'DRAFT';

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/leave/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'CANCELLED' } : r)));
        message.success(t('common.cancelSuccess'));
      } else {
        message.error(json.error || t('common.cancelFailed'));
      }
    } catch {
      message.error(t('common.cancelFailed'));
    } finally {
      setCancellingId(null);
    }
  };

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailItem(null);
    try {
      const res = await fetch(`/api/leave/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setDetailItem({ kind: 'leave', data: json.data as LeaveWithUser });
      } else {
        message.error(json.error || t('common.detailLoadFailed'));
        setDetailOpen(false);
      }
    } catch {
      message.error(t('common.detailLoadFailed'));
      setDetailOpen(false);
    }
  };

  const columns: ColumnsType<LeaveRequest> = useMemo(
    () => [
      {
        title: <ColTitle label={t('leave.colType')} />,
        dataIndex: 'leaveType',
        width: 150,
        render: (v: string) => <Tag color="cyan">{t(`leaveType.${v}`)}</Tag>,
      },
      {
        title: <ColTitle label={t('leave.colDates')} />,
        render: (_, r) => `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
      },
      {
        title: <ColTitle label={t('leave.colTotal')} />,
        dataIndex: 'totalDays',
        width: 130,
        render: (v) => <span className="whitespace-nowrap">{pluralDays(v)}</span>,
      },
      { title: <ColTitle label={t('leave.colReason')} />, dataIndex: 'reason', ellipsis: true, width: 220 },
      {
        title: <ColTitle label={t('leave.colAttachment')} />,
        dataIndex: 'attachmentUrl',
        width: 130,
        render: (v: string | null) =>
          v ? (
            <a href={v} target="_blank" rel="noreferrer" className="text-primary-light underline" onClick={(e) => e.stopPropagation()}>
              {t('common.view')}
            </a>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        title: <ColTitle label={t('leave.colStatus')} />,
        dataIndex: 'status',
        width: 130,
        render: (v) => <StatusBadge status={v} />,
      },
      {
        title: <ColTitle label={t('common.actions')} />,
        key: 'actions',
        width: 140,
        onCell: () => ({ onClick: (e) => e.stopPropagation() }),
        render: (_, r) =>
          isCancellable(r.status) ? (
            <Popconfirm
              title={t('common.cancelConfirmTitle')}
              description={t('common.cancelConfirmDesc')}
              okText={t('common.cancelRequest')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, loading: cancellingId === r.id }}
              onConfirm={() => handleCancel(r.id)}
            >
              <Button danger size="small" icon={<CloseCircleOutlined />}>
                {t('common.cancelRequest')}
              </Button>
            </Popconfirm>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
    ],
    [t, pluralDays, cancellingId],
  );

  return (
    <div className="space-y-6">
      <PageHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PageTitle title={t('leave.title')} subtitle={t('leave.subtitle')} />
          <Link href="/leave/new">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              {t('leave.submit')}
            </Button>
          </Link>
        </div>
      </PageHeader>

      <RequestsTable<LeaveRequest>
        loading={loading}
        rows={rows}
        columns={columns}
        rowKey="id"
        emptyText={t('leave.emptyList')}
        onRowClick={(r) => openDetail(r.id)}
        mobileRender={(r) => (
          <div>
            <div className="flex items-center justify-between gap-2">
              <Tag color="cyan" style={{ margin: 0 }}>
                {t(`leaveType.${r.leaveType}`)}
              </Tag>
              <StatusBadge status={r.status} />
            </div>
            <div className="font-semibold mt-2">
              {formatDate(r.startDate)} — {formatDate(r.endDate)}
            </div>
            <div className="text-xs text-muted">{pluralDays(r.totalDays)}</div>
            <div className="text-sm mt-2 line-clamp-2">{r.reason}</div>
            {r.attachmentUrl && (
              <a
                href={r.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-primary-light underline mt-1 inline-block"
              >
                {t('common.viewAttachment')}
              </a>
            )}
            {isCancellable(r.status) && (
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <Popconfirm
                  title={t('common.cancelConfirmTitle')}
                  description={t('common.cancelConfirmDesc')}
                  okText={t('common.cancelRequest')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, loading: cancellingId === r.id }}
                  onConfirm={() => handleCancel(r.id)}
                >
                  <Button danger size="small" icon={<CloseCircleOutlined />}>
                    {t('common.cancelRequest')}
                  </Button>
                </Popconfirm>
              </div>
            )}
          </div>
        )}
      />

      <ApprovalModal
        open={detailOpen}
        item={detailItem}
        onClose={() => setDetailOpen(false)}
        onDone={() => setDetailOpen(false)}
        readOnly
      />
    </div>
  );
}

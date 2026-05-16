'use client';

import { App, Button, Popconfirm } from 'antd';
import { PlusOutlined, CloseCircleOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import RequestsTable from '@/components/RequestsTable';
import StatusBadge from '@/components/StatusBadge';
import ApprovalModal from '@/components/ApprovalModal';
import PageHeader, { PageTitle } from '@/components/PageHeader';
import ColTitle from '@/components/ColTitle';
import { formatDate, formatTime } from '@/lib/utils';
import type { ColumnsType } from 'antd/es/table';
import type { OvertimeRequest } from '@prisma/client';
import type { InboxItem, OvertimeWithUser } from '@/lib/types';
import { useFormatters, useT } from '@/lib/i18n/provider';


export default function OvertimeListPage() {
  const [rows, setRows] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InboxItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const t = useT();
  const { minutesToReadable } = useFormatters();
  const { message } = App.useApp();

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/overtime', { cache: 'no-store', signal: ctrl.signal });
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
      const res = await fetch(`/api/overtime/${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/overtime/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setDetailItem({ kind: 'overtime', data: json.data as OvertimeWithUser });
      } else {
        message.error(json.error || t('common.detailLoadFailed'));
        setDetailOpen(false);
      }
    } catch {
      message.error(t('common.detailLoadFailed'));
      setDetailOpen(false);
    }
  };

  const columns: ColumnsType<OvertimeRequest> = useMemo(
    () => [
      { title: <ColTitle label={t('overtime.colDate')} />, dataIndex: 'date', render: (v) => formatDate(v) },
      {
        title: <ColTitle label={t('overtime.colType')} />,
        dataIndex: 'overtimeType',
        render: (v: 'PREMIUM_SHIFT' | 'OVERDAYS') =>
          v === 'PREMIUM_SHIFT' ? t('overtime.typePremiumShift') : t('overtime.typeOverdays'),
      },
      {
        title: <ColTitle label={t('overtime.colTime')} />,
        render: (_, r) => formatTime(r.startTime),
      },
      {
        title: <ColTitle label={t('overtime.colDuration')} />,
        dataIndex: 'durationMinutes',
        render: (v) => minutesToReadable(v),
      },
      { title: <ColTitle label={t('overtime.colReason')} />, dataIndex: 'reason', ellipsis: true },
      {
        title: <ColTitle label={t('overtime.colAttachment')} />,
        dataIndex: 'attachmentUrl',
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
        title: <ColTitle label={t('overtime.colStatus')} />,
        dataIndex: 'status',
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
    [t, minutesToReadable, cancellingId],
  );

  return (
    <div className="space-y-6">
      <PageHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PageTitle title={t('overtime.title')} subtitle={t('overtime.subtitle')} />
          <Link href="/overtime/new">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              {t('overtime.submit')}
            </Button>
          </Link>
        </div>
      </PageHeader>

      <RequestsTable<OvertimeRequest>
        loading={loading}
        rows={rows}
        columns={columns}
        rowKey="id"
        emptyText={t('overtime.emptyList')}
        onRowClick={(r) => openDetail(r.id)}
        mobileRender={(r) => (
          <div>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{formatDate(r.date)}</div>
              <StatusBadge status={r.status} />
            </div>
            <div className="text-xs text-muted mt-1">
              {r.overtimeType === 'PREMIUM_SHIFT' ? t('overtime.typePremiumShift') : t('overtime.typeOverdays')} · {formatTime(r.startTime)} · {minutesToReadable(r.durationMinutes)}
            </div>
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

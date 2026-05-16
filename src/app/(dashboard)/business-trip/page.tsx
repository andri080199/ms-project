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
import { formatDate } from '@/lib/utils';
import type { ColumnsType } from 'antd/es/table';
import type { BusinessTripRequest } from '@prisma/client';
import type { BusinessTripWithUser, InboxItem } from '@/lib/types';
import { useT } from '@/lib/i18n/provider';


export default function BusinessTripListPage() {
  const [rows, setRows] = useState<BusinessTripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InboxItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const t = useT();
  const { message } = App.useApp();

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/business-trip', { cache: 'no-store', signal: ctrl.signal });
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
      const res = await fetch(`/api/business-trip/${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/business-trip/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setDetailItem({ kind: 'business-trip', data: json.data as BusinessTripWithUser });
      } else {
        message.error(json.error || t('common.detailLoadFailed'));
        setDetailOpen(false);
      }
    } catch {
      message.error(t('common.detailLoadFailed'));
      setDetailOpen(false);
    }
  };

  const columns: ColumnsType<BusinessTripRequest> = useMemo(
    () => [
      { title: <ColTitle label={t('businessTrip.colDestination')} />, dataIndex: 'destination' },
      {
        title: <ColTitle label={t('businessTrip.colDates')} />,
        render: (_, r) => `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
      },
      { title: <ColTitle label={t('businessTrip.colType')} />, dataIndex: 'tripType', render: (v) => t(`tripType.${v}`) },
      {
        title: <ColTitle label={t('businessTrip.colAttachment')} />,
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
      { title: <ColTitle label={t('businessTrip.colStatus')} />, dataIndex: 'status', render: (v) => <StatusBadge status={v} /> },
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
    [t, cancellingId],
  );

  return (
    <div className="space-y-6">
      <PageHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PageTitle title={t('businessTrip.title')} subtitle={t('businessTrip.subtitle')} />
          <Link href="/business-trip/new">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              {t('businessTrip.submit')}
            </Button>
          </Link>
        </div>
      </PageHeader>

      <RequestsTable<BusinessTripRequest>
        loading={loading}
        rows={rows}
        columns={columns}
        rowKey="id"
        emptyText={t('businessTrip.emptyList')}
        onRowClick={(r) => openDetail(r.id)}
        mobileRender={(r) => (
          <div>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{r.destination}</div>
              <StatusBadge status={r.status} />
            </div>
            <div className="text-xs text-muted mt-1">
              {formatDate(r.startDate)} — {formatDate(r.endDate)} · {t(`tripType.${r.tripType}`)}
            </div>
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

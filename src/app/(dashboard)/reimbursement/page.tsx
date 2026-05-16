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
import { formatDate, formatRupiah } from '@/lib/utils';
import type { ColumnsType } from 'antd/es/table';
import type { ReimbursementItem, ReimbursementRequest } from '@prisma/client';
import type { InboxItem, ReimbursementWithItems } from '@/lib/types';
import { useT } from '@/lib/i18n/provider';

type Row = ReimbursementRequest & { items: ReimbursementItem[] };

export default function ReimbursementListPage() {
  const [rows, setRows] = useState<Row[]>([]);
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
        const res = await fetch('/api/reimbursement', { cache: 'no-store', signal: ctrl.signal });
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
      const res = await fetch(`/api/reimbursement/${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/reimbursement/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setDetailItem({ kind: 'reimbursement', data: json.data as ReimbursementWithItems });
      } else {
        message.error(json.error || t('common.detailLoadFailed'));
        setDetailOpen(false);
      }
    } catch {
      message.error(t('common.detailLoadFailed'));
      setDetailOpen(false);
    }
  };

  const itemSummary = (items: ReimbursementItem[]) => {
    if (!items.length) return '—';
    const first = items[0].description;
    return items.length > 1 ? `${first} (+${items.length - 1})` : first;
  };

  const columns: ColumnsType<Row> = useMemo(
    () => [
      { title: <ColTitle label={t('reimbursement.colDate')} />, dataIndex: 'createdAt', render: (v) => formatDate(v), width: 130 },
      {
        title: <ColTitle label={t('reimbursement.colDescription')} />,
        key: 'description',
        ellipsis: true,
        render: (_, r) => itemSummary(r.items),
      },
      { title: <ColTitle label={t('reimbursement.colItems')} />, render: (_, r) => r.items.length, width: 80 },
      { title: <ColTitle label={t('reimbursement.colTotal')} />, dataIndex: 'totalAmount', render: (v) => formatRupiah(v), width: 140 },
      { title: <ColTitle label={t('reimbursement.colStatus')} />, dataIndex: 'status', render: (v) => <StatusBadge status={v} />, width: 120 },
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
          <PageTitle title={t('reimbursement.title')} subtitle={t('reimbursement.subtitle')} />
          <Link href="/reimbursement/new">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              {t('reimbursement.submit')}
            </Button>
          </Link>
        </div>
      </PageHeader>

      <RequestsTable<Row>
        loading={loading}
        rows={rows}
        columns={columns}
        rowKey="id"
        emptyText={t('reimbursement.emptyList')}
        onRowClick={(r) => openDetail(r.id)}
        mobileRender={(r) => (
          <div>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{formatRupiah(r.totalAmount)}</div>
              <StatusBadge status={r.status} />
            </div>
            <div className="text-xs text-muted mt-1">
              {r.items.length} {t('approvals.itemsSuffix')} · {formatDate(r.createdAt)}
            </div>
            <div className="text-sm mt-1 line-clamp-2">{itemSummary(r.items)}</div>
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

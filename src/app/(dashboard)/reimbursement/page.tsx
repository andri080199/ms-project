'use client';

import { Button, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import RequestsTable from '@/components/RequestsTable';
import StatusBadge from '@/components/StatusBadge';
import { formatDate, formatRupiah } from '@/lib/utils';
import type { ColumnsType } from 'antd/es/table';
import type { ReimbursementItem, ReimbursementRequest } from '@prisma/client';
import { useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;
type Row = ReimbursementRequest & { items: ReimbursementItem[] };

export default function ReimbursementListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/reimbursement', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setRows(json.data);
      setLoading(false);
    })();
  }, []);

  const columns: ColumnsType<Row> = useMemo(
    () => [
      { title: t('reimbursement.colDate'), dataIndex: 'createdAt', render: (v) => formatDate(v) },
      { title: t('reimbursement.colItems'), render: (_, r) => r.items.length },
      { title: t('reimbursement.colTotal'), dataIndex: 'totalAmount', render: (v) => formatRupiah(v) },
      { title: t('reimbursement.colStatus'), dataIndex: 'status', render: (v) => <StatusBadge status={v} /> },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
            {t('reimbursement.title')}
          </Title>
          <Text className="text-muted">{t('reimbursement.subtitle')}</Text>
        </div>
        <Link href="/reimbursement/new">
          <Button type="primary" icon={<PlusOutlined />} size="large">
            {t('reimbursement.submit')}
          </Button>
        </Link>
      </div>

      <RequestsTable<Row>
        loading={loading}
        rows={rows}
        columns={columns}
        rowKey="id"
        emptyText={t('reimbursement.emptyList')}
        mobileRender={(r) => (
          <div>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{formatRupiah(r.totalAmount)}</div>
              <StatusBadge status={r.status} />
            </div>
            <div className="text-xs text-muted mt-1">
              {r.items.length} {t('approvals.itemsSuffix')} · {formatDate(r.createdAt)}
            </div>
          </div>
        )}
      />
    </div>
  );
}

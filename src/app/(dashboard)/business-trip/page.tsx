'use client';

import { Button, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import RequestsTable from '@/components/RequestsTable';
import StatusBadge from '@/components/StatusBadge';
import { formatDate } from '@/lib/utils';
import type { ColumnsType } from 'antd/es/table';
import type { BusinessTripRequest } from '@prisma/client';
import { useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

export default function BusinessTripListPage() {
  const [rows, setRows] = useState<BusinessTripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/business-trip', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setRows(json.data);
      setLoading(false);
    })();
  }, []);

  const columns: ColumnsType<BusinessTripRequest> = useMemo(
    () => [
      { title: t('businessTrip.colDestination'), dataIndex: 'destination' },
      {
        title: t('businessTrip.colDates'),
        render: (_, r) => `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
      },
      { title: t('businessTrip.colType'), dataIndex: 'tripType', render: (v) => t(`tripType.${v}`) },
      {
        title: t('businessTrip.colAttachment'),
        dataIndex: 'attachmentUrl',
        render: (v: string | null) =>
          v ? (
            <a href={v} target="_blank" rel="noreferrer" className="text-primary-light underline">
              {t('common.view')}
            </a>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      { title: t('businessTrip.colStatus'), dataIndex: 'status', render: (v) => <StatusBadge status={v} /> },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
            {t('businessTrip.title')}
          </Title>
          <Text className="text-muted">{t('businessTrip.subtitle')}</Text>
        </div>
        <Link href="/business-trip/new">
          <Button type="primary" icon={<PlusOutlined />} size="large">
            {t('businessTrip.submit')}
          </Button>
        </Link>
      </div>

      <RequestsTable<BusinessTripRequest>
        loading={loading}
        rows={rows}
        columns={columns}
        rowKey="id"
        emptyText={t('businessTrip.emptyList')}
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
                className="text-xs text-primary-light underline mt-1 inline-block"
              >
                {t('common.viewAttachment')}
              </a>
            )}
          </div>
        )}
      />
    </div>
  );
}

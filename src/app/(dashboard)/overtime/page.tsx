'use client';

import { Button, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import RequestsTable from '@/components/RequestsTable';
import StatusBadge from '@/components/StatusBadge';
import { formatDate, formatTime } from '@/lib/utils';
import type { ColumnsType } from 'antd/es/table';
import type { OvertimeRequest } from '@prisma/client';
import { useFormatters, useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

export default function OvertimeListPage() {
  const [rows, setRows] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useT();
  const { minutesToReadable } = useFormatters();

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/overtime', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setRows(json.data);
      setLoading(false);
    })();
  }, []);

  const columns: ColumnsType<OvertimeRequest> = useMemo(
    () => [
      { title: t('overtime.colDate'), dataIndex: 'date', render: (v) => formatDate(v) },
      {
        title: t('overtime.colTime'),
        render: (_, r) => `${formatTime(r.startTime)} — ${formatTime(r.endTime)}`,
      },
      {
        title: t('overtime.colDuration'),
        dataIndex: 'durationMinutes',
        render: (v) => minutesToReadable(v),
      },
      { title: t('overtime.colReason'), dataIndex: 'reason', ellipsis: true },
      {
        title: t('overtime.colAttachment'),
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
      {
        title: t('overtime.colStatus'),
        dataIndex: 'status',
        render: (v) => <StatusBadge status={v} />,
      },
    ],
    [t, minutesToReadable],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
            {t('overtime.title')}
          </Title>
          <Text className="text-muted">{t('overtime.subtitle')}</Text>
        </div>
        <Link href="/overtime/new">
          <Button type="primary" icon={<PlusOutlined />} size="large">
            {t('overtime.submit')}
          </Button>
        </Link>
      </div>

      <RequestsTable<OvertimeRequest>
        loading={loading}
        rows={rows}
        columns={columns}
        rowKey="id"
        emptyText={t('overtime.emptyList')}
        mobileRender={(r) => (
          <div>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{formatDate(r.date)}</div>
              <StatusBadge status={r.status} />
            </div>
            <div className="text-xs text-muted mt-1">
              {formatTime(r.startTime)} — {formatTime(r.endTime)} · {minutesToReadable(r.durationMinutes)}
            </div>
            <div className="text-sm mt-2 line-clamp-2">{r.reason}</div>
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

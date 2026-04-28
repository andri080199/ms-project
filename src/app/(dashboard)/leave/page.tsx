'use client';

import { Button, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import RequestsTable from '@/components/RequestsTable';
import StatusBadge from '@/components/StatusBadge';
import { formatDate } from '@/lib/utils';
import type { ColumnsType } from 'antd/es/table';
import type { LeaveRequest } from '@prisma/client';
import { useFormatters, useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

export default function LeaveListPage() {
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useT();
  const { pluralDays } = useFormatters();

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/leave', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setRows(json.data);
      setLoading(false);
    })();
  }, []);

  const columns: ColumnsType<LeaveRequest> = useMemo(
    () => [
      {
        title: t('leave.colType'),
        dataIndex: 'leaveType',
        width: 150,
        render: (v: string) => <Tag color="cyan">{t(`leaveType.${v}`)}</Tag>,
      },
      {
        title: t('leave.colDates'),
        render: (_, r) => `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
      },
      { title: t('leave.colTotal'), dataIndex: 'totalDays', width: 100, render: (v) => pluralDays(v) },
      { title: t('leave.colReason'), dataIndex: 'reason', ellipsis: true },
      {
        title: t('leave.colAttachment'),
        dataIndex: 'attachmentUrl',
        width: 100,
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
        title: t('leave.colStatus'),
        dataIndex: 'status',
        width: 130,
        render: (v) => <StatusBadge status={v} />,
      },
    ],
    [t, pluralDays],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
            {t('leave.title')}
          </Title>
          <Text className="text-muted">{t('leave.subtitle')}</Text>
        </div>
        <Link href="/leave/new">
          <Button type="primary" icon={<PlusOutlined />} size="large">
            {t('leave.submit')}
          </Button>
        </Link>
      </div>

      <RequestsTable<LeaveRequest>
        loading={loading}
        rows={rows}
        columns={columns}
        rowKey="id"
        emptyText={t('leave.emptyList')}
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

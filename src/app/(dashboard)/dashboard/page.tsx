'use client';

import { Button, Skeleton, Typography } from 'antd';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';
import {
  ClockCircleOutlined,
  WalletOutlined,
  CarOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { formatDateTime, formatRupiah } from '@/lib/utils';
import type { RequestStatus } from '@prisma/client';
import { useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

type Activity = {
  kind: 'overtime' | 'reimbursement' | 'business-trip';
  id: string;
  title: string;
  subtitle: string;
  status: RequestStatus;
  createdAt: string;
};

type DashboardData = {
  pending: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  reimbursementTotalThisMonth: number;
  activity: Activity[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setData(json.data);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
          {t('dashboard.title')}
        </Title>
        <Text className="text-muted">{t('dashboard.subtitle')}</Text>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <SummaryCard label={t('dashboard.summaryPending')} value={loading ? undefined : data?.pending ?? 0} tone="amber" />
        <SummaryCard
          label={t('dashboard.summaryApproved')}
          value={loading ? undefined : data?.approvedThisMonth ?? 0}
          tone="emerald"
        />
        <SummaryCard
          label={t('dashboard.summaryRejected')}
          value={loading ? undefined : data?.rejectedThisMonth ?? 0}
          tone="rose"
        />
        <SummaryCard
          label={t('dashboard.summaryReimb')}
          value={loading ? undefined : formatRupiah(data?.reimbursementTotalThisMonth ?? 0)}
          tone="violet"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <QuickAction href="/overtime/new" icon={<ClockCircleOutlined />} label={t('dashboard.quickOvertime')} subtitle={t('dashboard.quickSubtitle')} />
        <QuickAction href="/reimbursement/new" icon={<WalletOutlined />} label={t('dashboard.quickReimbursement')} subtitle={t('dashboard.quickSubtitle')} />
        <QuickAction href="/business-trip/new" icon={<CarOutlined />} label={t('dashboard.quickTrip')} subtitle={t('dashboard.quickSubtitle')} />
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-3">
          <Title level={4} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }}>
            {t('dashboard.recentActivity')}
          </Title>
          <Text className="text-muted text-xs">{t('dashboard.last10')}</Text>
        </div>
        {loading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : !data?.activity.length ? (
          <div className="text-muted text-sm py-6 text-center">{t('dashboard.emptyActivity')}</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {data.activity.map((a) => (
              <li key={`${a.kind}-${a.id}`} className="py-3 flex items-start justify-between gap-3">
                <div className="flex gap-3 items-start">
                  <div className="mt-0.5">
                    {a.kind === 'overtime' && <ClockCircleOutlined />}
                    {a.kind === 'reimbursement' && <WalletOutlined />}
                    {a.kind === 'business-trip' && <CarOutlined />}
                  </div>
                  <div>
                    <div className="font-semibold">{a.title}</div>
                    <div className="text-muted text-xs line-clamp-1">{a.subtitle}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={a.status} />
                  <div className="text-xs text-muted">{formatDateTime(a.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value?: number | string;
  tone: 'amber' | 'emerald' | 'rose' | 'violet';
}) {
  const toneMap: Record<
    string,
    { bg: string; border: string; value: string; dot: string }
  > = {
    amber: {
      bg: 'rgb(var(--color-warning) / 0.14)',
      border: 'rgb(var(--color-warning) / 0.45)',
      value: '#8B5A18',
      dot: 'rgb(var(--color-warning))',
    },
    emerald: {
      bg: 'rgb(var(--color-success) / 0.14)',
      border: 'rgb(var(--color-success) / 0.45)',
      value: 'rgb(var(--color-primary-700))',
      dot: 'rgb(var(--color-success))',
    },
    rose: {
      bg: 'rgb(var(--color-danger) / 0.14)',
      border: 'rgb(var(--color-danger) / 0.45)',
      value: '#7C2929',
      dot: 'rgb(var(--color-danger))',
    },
    violet: {
      bg: 'rgb(var(--color-primary) / 0.14)',
      border: 'rgb(var(--color-primary) / 0.5)',
      value: 'rgb(var(--color-primary-700))',
      dot: 'rgb(var(--color-primary))',
    },
  };
  const t = toneMap[tone];
  return (
    <div
      className="p-5 rounded-2xl transition-transform hover:-translate-y-0.5"
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 8px 20px -10px rgba(15, 60, 51, 0.18)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block rounded-full"
          style={{ width: 8, height: 8, background: t.dot }}
        />
        <div
          className="text-xs font-medium"
          style={{ color: 'rgb(var(--color-text-on-canvas-muted))' }}
        >
          {label}
        </div>
      </div>
      <div
        className="text-2xl font-bold mt-2"
        style={{ color: t.value }}
      >
        {value === undefined ? <Skeleton.Input active size="small" /> : value}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
}) {
  return (
    <Link href={href} className="block">
      <GlassCard hover className="p-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'var(--gradient-brand)' }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-semibold">{label}</div>
          <div className="text-xs text-muted">{subtitle}</div>
        </div>
        <Button type="text" icon={<PlusOutlined />} />
      </GlassCard>
    </Link>
  );
}

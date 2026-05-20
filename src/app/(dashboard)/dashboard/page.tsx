'use client';

// Dashboard home page. Fetches summary stats and the last 10 activity items on mount.
// AbortController cancels the in-flight fetch if the component unmounts (e.g. fast navigation).

import { Button, Skeleton, Typography } from 'antd';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import GlassCard from '@/components/GlassCard';
import PageHeader, { PageTitle } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import Icon, {
  ClockCircleOutlined,
  WalletOutlined,
  CalendarOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ComponentProps } from 'react';

const PlaneSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
  </svg>
);
const PlaneIcon = (props: ComponentProps<typeof Icon>) => <Icon component={PlaneSvg} {...props} />;
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
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/dashboard', { cache: 'no-store', signal: ctrl.signal });
        const json = await res.json();
        if (json.success) setData(json.data);
        setLoading(false);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageTitle title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
      </PageHeader>

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

      <div className="hidden md:grid md:grid-cols-4 gap-4">
        <QuickAction href="/overtime/new" icon={<ClockCircleOutlined />} label={t('dashboard.quickOvertime')} subtitle={t('dashboard.quickSubtitle')} />
        <QuickAction href="/leave/new" icon={<CalendarOutlined />} label={t('dashboard.quickLeave')} subtitle={t('dashboard.quickSubtitle')} />
        <QuickAction href="/reimbursement/new" icon={<WalletOutlined />} label={t('dashboard.quickReimbursement')} subtitle={t('dashboard.quickSubtitle')} />
        <QuickAction href="/business-trip/new" icon={<PlaneIcon />} label={t('dashboard.quickTrip')} subtitle={t('dashboard.quickSubtitle')} />
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
                    {a.kind === 'business-trip' && <PlaneIcon />}
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

// Stat card with a colored dot indicator. `value` is undefined while loading
// (renders a skeleton) and can be a number or a pre-formatted string (e.g. Rupiah).
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
      className="p-3 md:p-5 rounded-2xl transition-transform hover:-translate-y-0.5 min-w-0 overflow-hidden"
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 8px 20px -10px rgba(55, 36, 99, 0.18)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="inline-block rounded-full shrink-0"
          style={{ width: 8, height: 8, background: t.dot }}
        />
        <div
          className="text-[11px] md:text-xs font-medium truncate"
          style={{ color: 'rgb(var(--color-text-on-canvas-muted))' }}
        >
          {label}
        </div>
      </div>
      <div
        className={`${typeof value === 'string' ? 'text-xs' : 'text-base'} md:text-2xl font-bold mt-1.5 md:mt-2 leading-tight break-all md:break-normal`}
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
      <GlassCard hover className="p-3 flex items-center gap-2.5">
        <span
          className="inline-flex items-center justify-center shrink-0 rounded-lg"
          style={{
            width: 36,
            height: 36,
            background: 'rgb(var(--color-primary) / 0.15)',
            border: '1px solid rgb(var(--color-primary) / 0.3)',
            color: 'rgb(var(--color-primary))',
            fontSize: 18,
          }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-tight truncate">{label}</div>
          <div className="text-[11px] text-muted truncate">{subtitle}</div>
        </div>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          style={{ color: 'rgb(var(--color-primary))' }}
        />
      </GlassCard>
    </Link>
  );
}

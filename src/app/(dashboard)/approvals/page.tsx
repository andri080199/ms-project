'use client';

import { Empty, Pagination, Segmented, Skeleton, Tabs, Typography } from 'antd';
import {
  ClockCircleOutlined,
  WalletOutlined,
  CalendarOutlined,
  CompassOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';
import ApprovalModal from '@/components/ApprovalModal';
import { formatDate, formatDateTime, formatRupiah, formatTime } from '@/lib/utils';
import {
  type InboxItem,
  type OvertimeWithUser,
  type BusinessTripWithUser,
  type ReimbursementWithItems,
  type LeaveWithUser,
} from '@/lib/types';
import { useFormatters, useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

type KindMeta = { icon: ReactNode; tone: string; bg: string; labelKey: string };
const KIND_META: Record<InboxItem['kind'], KindMeta> = {
  overtime: {
    icon: <ClockCircleOutlined style={{ fontSize: 20 }} />,
    tone: 'rgb(var(--color-warning))',
    bg: 'rgb(var(--color-warning) / 0.15)',
    labelKey: 'approvals.kindOvertime',
  },
  reimbursement: {
    icon: <WalletOutlined style={{ fontSize: 20 }} />,
    tone: 'rgb(var(--color-accent-mint))',
    bg: 'rgb(var(--color-accent-mint) / 0.15)',
    labelKey: 'approvals.kindReimbursement',
  },
  'business-trip': {
    icon: <CompassOutlined style={{ fontSize: 20 }} />,
    tone: 'rgb(var(--color-info))',
    bg: 'rgb(var(--color-info) / 0.15)',
    labelKey: 'approvals.kindTrip',
  },
  leave: {
    icon: <CalendarOutlined style={{ fontSize: 20 }} />,
    tone: 'rgb(var(--color-primary-light))',
    bg: 'rgb(var(--color-primary-light) / 0.15)',
    labelKey: 'approvals.kindLeave',
  },
};

type PendingPayload = {
  overtimes: OvertimeWithUser[];
  trips: BusinessTripWithUser[];
  reimbursements: ReimbursementWithItems[];
  leaves: LeaveWithUser[];
};

type HistoryRow = {
  id: string;
  stage: 'SPV' | 'HR';
  action: 'APPROVE' | 'REJECT';
  createdAt: string;
  comment: string | null;
  overtime: OvertimeWithUser | null;
  reimbursement: ReimbursementWithItems | null;
  trip: BusinessTripWithUser | null;
  leave: LeaveWithUser | null;
};

type KindFilter = 'all' | InboxItem['kind'];
type ActionFilter = 'all' | 'APPROVE' | 'REJECT';
const HISTORY_PAGE_SIZE = 10;

export default function ApprovalsPage() {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [pending, setPending] = useState<PendingPayload | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const t = useT();

  async function load(active: 'pending' | 'history') {
    setLoading(true);
    try {
      const res = await fetch(`/api/approvals?tab=${active}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        if (active === 'pending') setPending(json.data);
        else setHistory(json.data.history);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
  }, [tab]);

  const pendingItems: InboxItem[] = useMemo(() => {
    if (!pending) return [];
    return [
      ...pending.overtimes.map((o) => ({ kind: 'overtime' as const, data: o })),
      ...pending.trips.map((trip) => ({ kind: 'business-trip' as const, data: trip })),
      ...pending.reimbursements.map((r) => ({ kind: 'reimbursement' as const, data: r })),
      ...(pending.leaves ?? []).map((l) => ({ kind: 'leave' as const, data: l })),
    ];
  }, [pending]);

  function historyKind(h: HistoryRow): InboxItem['kind'] | null {
    if (h.overtime) return 'overtime';
    if (h.reimbursement) return 'reimbursement';
    if (h.trip) return 'business-trip';
    if (h.leave) return 'leave';
    return null;
  }

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    return history.filter((h) => {
      if (kindFilter !== 'all' && historyKind(h) !== kindFilter) return false;
      if (actionFilter !== 'all' && h.action !== actionFilter) return false;
      return true;
    });
  }, [history, kindFilter, actionFilter]);

  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return filteredHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredHistory, historyPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [kindFilter, actionFilter, tab]);

  return (
    <div className="space-y-6">
      <div>
        <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
          {t('approvals.title')}
        </Title>
        <Text className="text-muted">{t('approvals.subtitle')}</Text>
      </div>

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as 'pending' | 'history')}
        items={[
          { key: 'pending', label: t('approvals.tabPending') },
          { key: 'history', label: t('approvals.tabHistory') },
        ]}
      />

      {loading ? (
        <GlassCard className="p-6">
          <Skeleton active paragraph={{ rows: 5 }} />
        </GlassCard>
      ) : tab === 'pending' ? (
        pendingItems.length === 0 ? (
          <GlassCard className="p-10 flex items-center justify-center">
            <Empty description={<span className="text-muted">{t('approvals.emptyPending')}</span>} />
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-3 stagger">
            {pendingItems.map((it) => (
              <PendingRow
                key={`${it.kind}-${it.data.id}`}
                item={it}
                onClick={() => setSelected(it)}
              />
            ))}
          </div>
        )
      ) : (history ?? []).length === 0 ? (
        <GlassCard className="p-10 flex items-center justify-center">
          <Empty description={<span className="text-muted">{t('approvals.emptyHistory')}</span>} />
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented<KindFilter>
              value={kindFilter}
              onChange={(v) => setKindFilter(v)}
              options={[
                { label: t('approvals.filterAll'), value: 'all' },
                { label: t('approvals.filterOvertime'), value: 'overtime' },
                { label: t('approvals.filterReimb'), value: 'reimbursement' },
                { label: t('approvals.filterTrip'), value: 'business-trip' },
                { label: t('approvals.filterLeave'), value: 'leave' },
              ]}
            />
            <Segmented<ActionFilter>
              value={actionFilter}
              onChange={(v) => setActionFilter(v)}
              options={[
                { label: t('approvals.filterAll'), value: 'all' },
                { label: t('approvals.filterApproved'), value: 'APPROVE' },
                { label: t('approvals.filterRejected'), value: 'REJECT' },
              ]}
            />
            <Text className="text-muted text-xs ml-auto">
              {t('approvals.counter', { shown: filteredHistory.length, total: history!.length })}
            </Text>
          </div>

          {filteredHistory.length === 0 ? (
            <GlassCard className="p-10 flex items-center justify-center">
              <Empty description={<span className="text-muted">{t('approvals.emptyFilter')}</span>} />
            </GlassCard>
          ) : (
            <>
              <div className="flex flex-col gap-3 stagger">
                {pagedHistory.map((h) => {
                  const item: InboxItem | null = h.overtime
                    ? { kind: 'overtime', data: h.overtime }
                    : h.reimbursement
                    ? { kind: 'reimbursement', data: h.reimbursement }
                    : h.trip
                    ? { kind: 'business-trip', data: h.trip }
                    : h.leave
                    ? { kind: 'leave', data: h.leave }
                    : null;
                  if (!item) return null;
                  return <HistoryItem key={h.id} h={h} item={item} onClick={() => setSelected(item)} />;
                })}
              </div>

              {filteredHistory.length > HISTORY_PAGE_SIZE && (
                <div className="flex justify-center pt-2">
                  <Pagination
                    current={historyPage}
                    pageSize={HISTORY_PAGE_SIZE}
                    total={filteredHistory.length}
                    showSizeChanger={false}
                    onChange={setHistoryPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ApprovalModal
        open={!!selected}
        item={selected}
        readOnly={tab === 'history'}
        onClose={() => setSelected(null)}
        onDone={() => {
          setSelected(null);
          load(tab);
        }}
      />
    </div>
  );
}

function PendingRow({ item, onClick }: { item: InboxItem; onClick: () => void }) {
  const meta = KIND_META[item.kind];
  const t = useT();
  return (
    <GlassCard hover className="p-4 md:p-5 cursor-pointer">
      <div onClick={onClick} className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              width: 48,
              height: 48,
              background: meta.bg,
              border: `1px solid ${meta.tone}33`,
              color: meta.tone,
            }}
          >
            {meta.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: meta.tone }}
              >
                {t(meta.labelKey)}
              </span>
              <span className="text-muted">·</span>
              <span className="font-semibold truncate">{item.data.user.name}</span>
              {item.data.user.department && (
                <span className="text-xs text-muted">({item.data.user.department})</span>
              )}
            </div>
            <div className="mt-1.5 text-sm">
              <PendingDetail item={item} />
            </div>
          </div>
        </div>
        <div className="md:flex-shrink-0">
          <StatusBadge status={item.data.status} />
        </div>
      </div>
    </GlassCard>
  );
}

function PendingDetail({ item }: { item: InboxItem }) {
  const t = useT();
  const { minutesToReadable, pluralDays } = useFormatters();
  if (item.kind === 'overtime') {
    return (
      <div className="space-y-0.5">
        <div>
          {formatDate(item.data.date)} · {formatTime(item.data.startTime)} — {formatTime(item.data.endTime)}
          <span className="text-muted"> · {minutesToReadable(item.data.durationMinutes)}</span>
        </div>
        <div className="text-xs text-muted line-clamp-1">{item.data.reason}</div>
      </div>
    );
  }
  if (item.kind === 'business-trip') {
    return (
      <div className="space-y-0.5">
        <div>
          {item.data.destination} · {formatDate(item.data.startDate)} — {formatDate(item.data.endDate)}
        </div>
        <div className="text-xs text-muted line-clamp-1">{item.data.purpose}</div>
      </div>
    );
  }
  if (item.kind === 'reimbursement') {
    return (
      <div className="space-y-0.5">
        <div className="font-semibold">{formatRupiah(item.data.totalAmount)}</div>
        <div className="text-xs text-muted">
          {item.data.items.length} {t('approvals.itemsSuffix')}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      <div>
        {t(`leaveType.${item.data.leaveType}`)} ·{' '}
        {formatDate(item.data.startDate)} — {formatDate(item.data.endDate)}
        <span className="text-muted"> · {pluralDays(item.data.totalDays)}</span>
      </div>
      <div className="text-xs text-muted line-clamp-1">{item.data.reason}</div>
    </div>
  );
}

function HistoryItem({
  h,
  item,
  onClick,
}: {
  h: HistoryRow;
  item: InboxItem;
  onClick: () => void;
}) {
  const meta = KIND_META[item.kind];
  const t = useT();
  const isApprove = h.action === 'APPROVE';
  const decisionColor = isApprove ? 'rgb(var(--color-success))' : 'rgb(var(--color-danger))';
  const decisionBg = isApprove ? 'rgb(var(--color-success) / 0.15)' : 'rgb(var(--color-danger) / 0.15)';
  return (
    <GlassCard hover className="p-4 md:p-5 cursor-pointer">
      <div onClick={onClick} className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 48,
                height: 48,
                background: meta.bg,
                border: `1px solid ${meta.tone}33`,
                color: meta.tone,
              }}
            >
              {meta.icon}
            </div>
            <div
              className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full"
              style={{
                width: 20,
                height: 20,
                background: decisionBg,
                border: `2px solid rgb(var(--color-bg-base))`,
              }}
            >
              {isApprove ? (
                <CheckCircleFilled style={{ color: decisionColor, fontSize: 14 }} />
              ) : (
                <CloseCircleFilled style={{ color: decisionColor, fontSize: 14 }} />
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: meta.tone }}
              >
                {t(meta.labelKey)}
              </span>
              <span className="text-muted">·</span>
              <span className="font-semibold truncate">{item.data.user.name}</span>
            </div>
            <div className="text-xs text-muted mt-1">
              <span style={{ color: decisionColor, fontWeight: 600 }}>
                {isApprove ? t('approvals.decisionApproved') : t('approvals.decisionRejected')}
              </span>{' '}
              {t('approvals.stagePrefix')} <b>{h.stage}</b> · {formatDateTime(h.createdAt)}
            </div>
            {h.comment && (
              <div className="text-xs text-muted mt-1 italic line-clamp-1">“{h.comment}”</div>
            )}
          </div>
        </div>
        <div className="md:flex-shrink-0">
          <StatusBadge status={item.data.status} />
        </div>
      </div>
    </GlassCard>
  );
}

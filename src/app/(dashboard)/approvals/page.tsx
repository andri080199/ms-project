'use client';

// Approvals page with two tabs: Pending (requests awaiting action) and History (past decisions).
// Pending tab data is a flat list merged from all four request types (overtime/reimbursement/
// business-trip/leave). History tab supports client-side filtering by kind, status, and date range
// plus CSV export. Both tabs open the ApprovalModal on row click.

import { Button, DatePicker, Dropdown, Empty, Pagination, Segmented, Skeleton, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import RangePickerWithIndicator from '@/components/RangePickerWithIndicator';
import {
  ClockCircleOutlined,
  WalletOutlined,
  CalendarOutlined,
  CompassOutlined,
  DownOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import PageHeader, { PageTitle } from '@/components/PageHeader';
import ColTitle from '@/components/ColTitle';
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

type KindMeta = { icon: ReactNode; tone: string; bg: string; labelKey: string };
const KIND_META: Record<InboxItem['kind'], KindMeta> = {
  overtime: {
    icon: <ClockCircleOutlined />,
    tone: 'rgb(var(--color-success))',
    bg: 'rgb(var(--color-success) / 0.18)',
    labelKey: 'approvals.kindOvertime',
  },
  reimbursement: {
    icon: <WalletOutlined />,
    tone: 'rgb(var(--color-success))',
    bg: 'rgb(var(--color-success) / 0.18)',
    labelKey: 'approvals.kindReimbursement',
  },
  'business-trip': {
    icon: <CompassOutlined />,
    tone: 'rgb(var(--color-success))',
    bg: 'rgb(var(--color-success) / 0.18)',
    labelKey: 'approvals.kindTrip',
  },
  leave: {
    icon: <CalendarOutlined />,
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
type StatusFilter = 'all' | 'DONE' | 'REJECTED';
type DateRange = [Dayjs | null, Dayjs | null] | null;

type PendingTableRow = {
  rowKey: string;
  item: InboxItem;
};

type HistoryTableRow = {
  rowKey: string;
  h: HistoryRow;
  item: InboxItem;
};

const PAGE_SIZE = 10;

export default function ApprovalsPage() {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [pending, setPending] = useState<PendingPayload | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [periodRange, setPeriodRange] = useState<DateRange>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const t = useT();
  const { minutesToReadable, pluralDays } = useFormatters();

  useEffect(() => {
    setScrollEl(document.getElementById('page-scroll'));
  }, []);

  async function load(active: 'pending' | 'history', signal?: AbortSignal) {
    setLoading(true);
    try {
      const res = await fetch(`/api/approvals?tab=${active}`, { cache: 'no-store', signal });
      const json = await res.json();
      if (json.success) {
        if (active === 'pending') setPending(json.data);
        else setHistory(json.data.history);
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    load(tab, ctrl.signal);
    return () => ctrl.abort();
  }, [tab]);

  // Reset ke halaman 1 ketika filter berubah atau tab pindah
  useEffect(() => {
    setHistoryPage(1);
  }, [kindFilter, statusFilter, periodRange, tab]);
  useEffect(() => {
    setPendingPage(1);
  }, [tab]);

  const pendingRows: PendingTableRow[] = useMemo(() => {
    if (!pending) return [];
    return [
      ...pending.overtimes.map((o) => ({
        rowKey: `overtime-${o.id}`,
        item: { kind: 'overtime' as const, data: o },
      })),
      ...pending.trips.map((trip) => ({
        rowKey: `business-trip-${trip.id}`,
        item: { kind: 'business-trip' as const, data: trip },
      })),
      ...pending.reimbursements.map((r) => ({
        rowKey: `reimbursement-${r.id}`,
        item: { kind: 'reimbursement' as const, data: r },
      })),
      ...(pending.leaves ?? []).map((l) => ({
        rowKey: `leave-${l.id}`,
        item: { kind: 'leave' as const, data: l },
      })),
    ];
  }, [pending]);

  function historyKind(h: HistoryRow): InboxItem['kind'] | null {
    if (h.overtime) return 'overtime';
    if (h.reimbursement) return 'reimbursement';
    if (h.trip) return 'business-trip';
    if (h.leave) return 'leave';
    return null;
  }

  const historyRows: HistoryTableRow[] = useMemo(() => {
    if (!history) return [];
    const periodStartMs = periodRange?.[0]?.startOf('day').valueOf() ?? null;
    const periodEndMs = periodRange?.[1]?.endOf('day').valueOf() ?? null;
    const rows: HistoryTableRow[] = [];
    const seenRequestKeys = new Set<string>();
    for (const h of history) {
      const kind = historyKind(h);
      if (!kind) continue;
      const item: InboxItem = h.overtime
        ? { kind: 'overtime', data: h.overtime }
        : h.reimbursement
        ? { kind: 'reimbursement', data: h.reimbursement }
        : h.trip
        ? { kind: 'business-trip', data: h.trip }
        : { kind: 'leave', data: h.leave! };
      // Dedup: 1 baris per request (entry terlatest karena backend desc)
      const requestKey = `${kind}-${item.data.id}`;
      if (seenRequestKeys.has(requestKey)) continue;
      seenRequestKeys.add(requestKey);
      if (kindFilter !== 'all' && kind !== kindFilter) continue;
      if (statusFilter !== 'all' && item.data.status !== statusFilter) continue;
      if (periodStartMs !== null && periodEndMs !== null) {
        const ms = dayjs(h.createdAt).valueOf();
        if (ms < periodStartMs || ms > periodEndMs) continue;
      }
      rows.push({ rowKey: requestKey, h, item });
    }
    return rows;
  }, [history, kindFilter, statusFilter, periodRange]);

  // Sliced rows untuk mobile cards (desktop pagination ditangani Table sendiri)
  const pendingRowsSliced = useMemo(
    () => pendingRows.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE),
    [pendingRows, pendingPage],
  );
  const historyRowsSliced = useMemo(
    () => historyRows.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE),
    [historyRows, historyPage],
  );

  function handleDownloadCsv() {
    if (!periodRange || !periodRange[0] || !periodRange[1]) return;
    if (historyRows.length === 0) return;
    const headers = [
      t('approvals.colType'),
      t('approvals.colEmployee'),
      t('approvals.colDept'),
      t('approvals.colStatus'),
      t('approvals.colDate'),
      t('approvals.colDetail'),
      t('approvals.colComment'),
    ];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const statusLabel = (s: string) =>
      s === 'DONE'
        ? t('approvals.filterApproved')
        : s === 'REJECTED'
        ? t('approvals.filterRejected')
        : s;
    const lines = historyRows.map((r) => {
      const cells = [
        t(KIND_META[r.item.kind].labelKey),
        r.item.data.user.name,
        r.item.data.user.department ?? '',
        statusLabel(r.item.data.status),
        formatDateTime(r.h.createdAt),
        buildDetailText(r.item, t, minutesToReadable, pluralDays),
        r.h.comment ?? '',
      ];
      return cells.map(escape).join(',');
    });
    const csv = [headers.map(escape).join(','), ...lines].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const startTag = periodRange[0].format('YYYYMMDD');
    const endTag = periodRange[1].format('YYYYMMDD');
    a.download = `approval-history-${startTag}-${endTag}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const firstColCellStyle = { paddingLeft: 24 } as const;

  const pendingColumns: ColumnsType<PendingTableRow> = useMemo(
    () => [
      {
        title: <ColTitle label={t('approvals.colType')} />,
        key: 'type',
        width: 170,
        onHeaderCell: () => ({ style: firstColCellStyle }),
        onCell: () => ({ style: firstColCellStyle }),
        render: (_, r) => <KindTag kind={r.item.kind} />,
      },
      {
        title: <ColTitle label={t('approvals.colEmployee')} />,
        key: 'employee',
        width: 200,
        render: (_, r) => (
          <div className="min-w-0">
            <div className="font-semibold truncate">{r.item.data.user.name}</div>
            {r.item.data.user.department && (
              <div className="text-xs text-muted truncate">{r.item.data.user.department}</div>
            )}
          </div>
        ),
      },
      {
        title: <ColTitle label={t('approvals.colDetail')} />,
        key: 'detail',
        render: (_, r) => renderDetail(r.item, t, minutesToReadable, pluralDays),
      },
      {
        title: <ColTitle label={t('approvals.colStatus')} />,
        key: 'status',
        width: 140,
        render: (_, r) => <StatusBadge status={r.item.data.status} />,
      },
    ],
    [t, minutesToReadable, pluralDays],
  );

  const historyColumns: ColumnsType<HistoryTableRow> = useMemo(
    () => [
      {
        title: <ColTitle label={t('approvals.colType')} />,
        key: 'type',
        width: 170,
        onHeaderCell: () => ({ style: firstColCellStyle }),
        onCell: () => ({ style: firstColCellStyle }),
        render: (_, r) => <KindTag kind={r.item.kind} />,
      },
      {
        title: <ColTitle label={t('approvals.colEmployee')} />,
        key: 'employee',
        width: 180,
        render: (_, r) => (
          <div className="min-w-0">
            <div className="font-semibold truncate">{r.item.data.user.name}</div>
            {r.item.data.user.department && (
              <div className="text-xs text-muted truncate">{r.item.data.user.department}</div>
            )}
          </div>
        ),
      },
      {
        title: <ColTitle label={t('approvals.colStatus')} />,
        key: 'status',
        width: 150,
        render: (_, r) => <StatusBadge status={r.item.data.status} />,
      },
      {
        title: <ColTitle label={t('approvals.colDate')} />,
        key: 'date',
        width: 160,
        render: (_, r) => (
          <span className="text-xs text-muted">{formatDateTime(r.h.createdAt)}</span>
        ),
      },
      {
        title: <ColTitle label={t('approvals.colComment')} />,
        key: 'comment',
        render: (_, r) =>
          r.h.comment ? (
            <span className="text-xs italic line-clamp-2">“{r.h.comment}”</span>
          ) : (
            <span className="text-xs text-muted">—</span>
          ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-5 md:space-y-6 px-1 md:px-2">
      <PageHeader>
        <PageTitle title={t('approvals.title')} subtitle={t('approvals.subtitle')} />
        <div className="approvals-header-nav">
          <Tabs
            activeKey={tab}
            onChange={(k) => setTab(k as 'pending' | 'history')}
            items={[
              { key: 'pending', label: t('approvals.tabPending') },
              { key: 'history', label: t('approvals.tabHistory') },
            ]}
          />

          {tab === 'history' && (() => {
        const kindOptions = [
          { label: t('approvals.filterAll'), value: 'all' as const },
          { label: t('approvals.filterOvertime'), value: 'overtime' as const },
          { label: t('approvals.filterReimb'), value: 'reimbursement' as const },
          { label: t('approvals.filterTrip'), value: 'business-trip' as const },
          { label: t('approvals.filterLeave'), value: 'leave' as const },
        ];
        const statusOptions = [
          { label: t('approvals.filterAll'), value: 'all' as const },
          { label: t('approvals.filterApproved'), value: 'DONE' as const },
          { label: t('approvals.filterRejected'), value: 'REJECTED' as const },
        ];
        const kindLabel = kindOptions.find((o) => o.value === kindFilter)?.label ?? '';
        const statusLabel = statusOptions.find((o) => o.value === statusFilter)?.label ?? '';
        const counter = history ? (
          <span className="approvals-filter-counter">
            {t('approvals.counter', { total: historyRows.length })}
          </span>
        ) : null;
        const rangeReady = !!(periodRange && periodRange[0] && periodRange[1]);
        const downloadDisabled = !rangeReady || historyRows.length === 0;
        const downloadTitle = !rangeReady
          ? t('approvals.downloadRangeRequired')
          : historyRows.length === 0
          ? t('approvals.downloadRangeEmpty')
          : undefined;
        const downloadLabel = rangeReady
          ? `${t('approvals.downloadCsv')} (${historyRows.length})`
          : t('approvals.downloadCsv');

        return (
          <>
            {/* Desktop: glass panel with segmented pills */}
            <div className="approvals-filters approvals-filters-desktop glass">
              <Segmented<KindFilter>
                value={kindFilter}
                onChange={(v) => setKindFilter(v)}
                options={kindOptions}
              />
              <Segmented<StatusFilter>
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={statusOptions}
              />
              <RangePickerWithIndicator
                value={periodRange ?? undefined}
                onChange={(v) => setPeriodRange(v as DateRange)}
                format="DD MMM YYYY"
                placeholder={[t('approvals.periodPlaceholderStart'), t('approvals.periodPlaceholderEnd')]}
                allowClear
                classNames={{ popup: { root: 'app-date-popup' } }}
                className="approvals-period-picker"
              />
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadCsv}
                disabled={downloadDisabled}
                title={downloadTitle}
                className="approvals-download-btn"
              >
                {downloadLabel}
              </Button>
              {counter}
            </div>
            {/* Mobile filter — disusun jadi:
                Baris atas:  Type filter, Status filter, Download, records counter (push paling kanan)
                Baris bawah: Period (start + end DatePickers full-width)
                Period taro paling bawah biar tanggal start/end lega kelihatan. */}
            <div className="approvals-filters-mobile">
              <div className="filter-field">
                <span className="filter-field-label">{t('approvals.filterTypeLabel')}</span>
                <Dropdown
                  trigger={['click']}
                  overlayClassName="approvals-filter-menu"
                  menu={{
                    selectedKeys: [kindFilter],
                    items: kindOptions.map((o) => ({ key: o.value, label: o.label })),
                    onClick: ({ key }) => setKindFilter(key as KindFilter),
                  }}
                >
                  <button type="button" className="filter-trigger">
                    <span className="filter-trigger-value">{kindLabel}</span>
                    <DownOutlined className="filter-trigger-chevron" />
                  </button>
                </Dropdown>
              </div>
              <div className="filter-field">
                <span className="filter-field-label">{t('approvals.filterStatusLabel')}</span>
                <Dropdown
                  trigger={['click']}
                  overlayClassName="approvals-filter-menu"
                  menu={{
                    selectedKeys: [statusFilter],
                    items: statusOptions.map((o) => ({ key: o.value, label: o.label })),
                    onClick: ({ key }) => setStatusFilter(key as StatusFilter),
                  }}
                >
                  <button type="button" className="filter-trigger">
                    <span className="filter-trigger-value">{statusLabel}</span>
                    <DownOutlined className="filter-trigger-chevron" />
                  </button>
                </Dropdown>
              </div>
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleDownloadCsv}
                disabled={downloadDisabled}
                className="approvals-download-btn approvals-download-btn-mobile"
              >
                {downloadLabel}
              </Button>
              {counter}
              <div className="filter-field filter-field-period">
                <span className="filter-field-label">{t('approvals.filterPeriodLabel')}</span>
                {/* Mobile pakai dua DatePicker terpisah biar 1 tap = 1 pilihan
                    (RangePicker bawaan AntD butuh 2 tap di touch device).
                    Full-width supaya tanggal kelihatan jelas. */}
                <div className="filter-period-fields-mobile">
                  <DatePicker
                    value={periodRange?.[0] ?? null}
                    onChange={(v) => setPeriodRange([v, periodRange?.[1] ?? null])}
                    format="DD MMM YYYY"
                    placeholder={t('approvals.periodPlaceholderStart')}
                    allowClear
                    size="small"
                    inputReadOnly
                    classNames={{ popup: { root: 'app-date-popup' } }}
                  />
                  <DatePicker
                    value={periodRange?.[1] ?? null}
                    onChange={(v) => setPeriodRange([periodRange?.[0] ?? null, v])}
                    format="DD MMM YYYY"
                    placeholder={t('approvals.periodPlaceholderEnd')}
                    allowClear
                    size="small"
                    inputReadOnly
                    disabledDate={(c) => !!periodRange?.[0] && c.isBefore(periodRange[0]!, 'day')}
                    classNames={{ popup: { root: 'app-date-popup' } }}
                  />
                </div>
              </div>
            </div>
          </>
        );
          })()}
        </div>
      </PageHeader>

      {loading ? (
        <div className="glass p-6">
          <Skeleton active paragraph={{ rows: 5 }} />
        </div>
      ) : tab === 'pending' ? (
        pendingRows.length === 0 ? (
          <div className="glass p-10 flex items-center justify-center">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span className="text-muted">{t('approvals.emptyPending')}</span>}
            />
          </div>
        ) : (
          <>
            <div className="glass requests-table-card approvals-table-desktop">
              <Table<PendingTableRow>
                dataSource={pendingRows}
                columns={pendingColumns}
                rowKey="rowKey"
                size="middle"
                pagination={{
                  pageSize: PAGE_SIZE,
                  current: pendingPage,
                  showSizeChanger: false,
                  onChange: (p) => setPendingPage(p),
                }}
                scroll={{ x: 760 }}
                sticky={scrollEl ? { offsetHeader: 0, getContainer: () => scrollEl } : false}
                onRow={(r) => ({
                  onClick: () => setSelected(r.item),
                  style: { cursor: 'pointer' },
                })}
              />
            </div>
            <div className="approvals-cards-mobile glass">
              {pendingRowsSliced.map((r) => (
                <button
                  key={r.rowKey}
                  type="button"
                  onClick={() => setSelected(r.item)}
                  className="approval-card"
                >
                  <div className="approval-card-top">
                    <KindTag kind={r.item.kind} />
                    <StatusBadge status={r.item.data.status} />
                  </div>
                  <div className="approval-card-emp">
                    <div className="approval-card-name">{r.item.data.user.name}</div>
                    {r.item.data.user.department && (
                      <div className="approval-card-dept">{r.item.data.user.department}</div>
                    )}
                  </div>
                  <div className="approval-card-detail">
                    {renderDetail(r.item, t, minutesToReadable, pluralDays)}
                  </div>
                </button>
              ))}
              {pendingRows.length > PAGE_SIZE && (
                <div className="approvals-mobile-pagination">
                  <Pagination
                    current={pendingPage}
                    pageSize={PAGE_SIZE}
                    total={pendingRows.length}
                    onChange={(p) => setPendingPage(p)}
                    showSizeChanger={false}
                    size="small"
                    simple
                  />
                </div>
              )}
            </div>
          </>
        )
      ) : historyRows.length === 0 ? (
        <div className="glass p-10 flex items-center justify-center">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span className="text-muted">
                {(history ?? []).length === 0 ? t('approvals.emptyHistory') : t('approvals.emptyFilter')}
              </span>
            }
          />
        </div>
      ) : (
        <>
          <div className="glass requests-table-card approvals-table-desktop">
            <Table<HistoryTableRow>
              dataSource={historyRows}
              columns={historyColumns}
              rowKey="rowKey"
              size="middle"
              pagination={{
                pageSize: PAGE_SIZE,
                current: historyPage,
                showSizeChanger: false,
                onChange: (p) => setHistoryPage(p),
              }}
              scroll={{ x: 920 }}
              sticky={scrollEl ? { offsetHeader: 0, getContainer: () => scrollEl } : false}
              onRow={(r) => ({
                onClick: () => setSelected(r.item),
                style: { cursor: 'pointer' },
              })}
            />
          </div>
          <div className="approvals-cards-mobile glass">
            {historyRowsSliced.map((r) => (
              <button
                key={r.rowKey}
                type="button"
                onClick={() => setSelected(r.item)}
                className="approval-card"
              >
                <div className="approval-card-top">
                  <KindTag kind={r.item.kind} />
                  <StatusBadge status={r.item.data.status} />
                </div>
                <div className="approval-card-emp">
                  <div className="approval-card-name">{r.item.data.user.name}</div>
                  {r.item.data.user.department && (
                    <div className="approval-card-dept">{r.item.data.user.department}</div>
                  )}
                </div>
                <div className="approval-card-detail">
                  {renderDetail(r.item, t, minutesToReadable, pluralDays)}
                </div>
                <div className="approval-card-date">{formatDateTime(r.h.createdAt)}</div>
                {r.h.comment && (
                  <div className="approval-card-comment">“{r.h.comment}”</div>
                )}
              </button>
            ))}
            {historyRows.length > PAGE_SIZE && (
              <div className="approvals-mobile-pagination">
                <Pagination
                  current={historyPage}
                  pageSize={PAGE_SIZE}
                  total={historyRows.length}
                  onChange={(p) => setHistoryPage(p)}
                  showSizeChanger={false}
                  size="small"
                  simple
                />
              </div>
            )}
          </div>
        </>
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

// Colored pill badge showing the request type (overtime / reimbursement / trip / leave).
function KindTag({ kind }: { kind: InboxItem['kind'] }) {
  const meta = KIND_META[kind];
  const t = useT();
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap"
      style={{
        background: meta.bg,
        color: meta.tone,
        border: `1px solid ${meta.tone}33`,
      }}
    >
      <span style={{ fontSize: 12, lineHeight: 1 }}>{meta.icon}</span>
      {t(meta.labelKey)}
    </span>
  );
}

function renderDetail(
  item: InboxItem,
  t: (k: string) => string,
  minutesToReadable: (m: number) => string,
  pluralDays: (n: number) => string,
): ReactNode {
  if (item.kind === 'overtime') {
    return (
      <div className="space-y-0.5 min-w-0">
        <div className="text-sm">
          {formatDate(item.data.date)} ·{' '}
          {item.data.overtimeType === 'PREMIUM_SHIFT'
            ? t('overtime.typePremiumShift')
            : t('overtime.typeOverdays')}{' '}
          · {formatTime(item.data.startTime)}
          <span className="text-muted"> · {minutesToReadable(item.data.durationMinutes)}</span>
        </div>
        <div className="text-xs text-muted line-clamp-1">{item.data.reason}</div>
      </div>
    );
  }
  if (item.kind === 'business-trip') {
    return (
      <div className="space-y-0.5 min-w-0">
        <div className="text-sm">
          {item.data.destination} · {formatDate(item.data.startDate)} — {formatDate(item.data.endDate)}
        </div>
        <div className="text-xs text-muted line-clamp-1">{item.data.purpose}</div>
      </div>
    );
  }
  if (item.kind === 'reimbursement') {
    return (
      <div className="space-y-0.5 min-w-0">
        <div className="text-sm font-semibold">{formatRupiah(item.data.totalAmount)}</div>
        <div className="text-xs text-muted">
          {item.data.items.length} {t('approvals.itemsSuffix')}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-0.5 min-w-0">
      <div className="text-sm">
        {t(`leaveTypeShort.${item.data.leaveType}`)} · {formatDate(item.data.startDate)} —{' '}
        {formatDate(item.data.endDate)}
        <span className="text-muted"> · {pluralDays(item.data.totalDays)}</span>
      </div>
      <div className="text-xs text-muted line-clamp-1">{item.data.reason}</div>
    </div>
  );
}

function buildDetailText(
  item: InboxItem,
  t: (k: string) => string,
  minutesToReadable: (m: number) => string,
  pluralDays: (n: number) => string,
): string {
  if (item.kind === 'overtime') {
    const type =
      item.data.overtimeType === 'PREMIUM_SHIFT'
        ? t('overtime.typePremiumShift')
        : t('overtime.typeOverdays');
    return `${formatDate(item.data.date)} · ${type} · ${formatTime(item.data.startTime)} · ${minutesToReadable(
      item.data.durationMinutes,
    )} — ${item.data.reason}`;
  }
  if (item.kind === 'business-trip') {
    return `${item.data.destination} · ${formatDate(item.data.startDate)} — ${formatDate(item.data.endDate)} · ${item.data.purpose}`;
  }
  if (item.kind === 'reimbursement') {
    return `${formatRupiah(item.data.totalAmount)} (${item.data.items.length} ${t('approvals.itemsSuffix')})`;
  }
  return `${t(`leaveType.${item.data.leaveType}`)} · ${formatDate(item.data.startDate)} — ${formatDate(item.data.endDate)} · ${pluralDays(item.data.totalDays)} — ${item.data.reason}`;
}

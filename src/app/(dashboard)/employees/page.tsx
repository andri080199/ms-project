'use client';

import { Avatar, Empty, Input, Modal, Skeleton, Table } from 'antd';
import { WhatsAppOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import PageHeader, { PageTitle } from '@/components/PageHeader';
import ColTitle from '@/components/ColTitle';
import type { ColumnsType } from 'antd/es/table';
import { useT } from '@/lib/i18n/provider';


type Employee = {
  id: string;
  employeeId: string | null;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  employmentStatus: string | null;
  position: { id: string; name: string } | null;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function waUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let n = phone.replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('0')) n = '62' + n.slice(1);
  else if (!n.startsWith('62')) n = '62' + n;
  return `https://wa.me/${n}`;
}

function EmployeeAvatar({ name, size }: { name: string; size: number }) {
  return (
    <Avatar
      size={size}
      style={{
        backgroundColor: 'rgb(var(--color-primary-700))',
        color: '#fff',
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </Avatar>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] md:grid-cols-[140px_1fr] gap-2 md:gap-4 items-start">
      <dt
        className="text-[11px] md:text-sm pt-0.5"
        style={{ color: 'rgb(var(--color-text-muted))' }}
      >
        {label}
      </dt>
      <dd
        className="text-xs md:text-base m-0 break-words leading-snug"
        style={{ color: 'rgb(var(--color-text-primary))' }}
      >
        {children}
      </dd>
    </div>
  );
}

function WhatsAppButton({ phone, label, size = 28 }: { phone: string | null; label: string; size?: number }) {
  const url = waUrl(phone);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center rounded-full shrink-0 transition-transform hover:scale-105"
      style={{
        background: '#25D366',
        color: '#fff',
        width: size,
        height: size,
        fontSize: Math.round(size * 0.55),
      }}
      aria-label={label}
      title={label}
    >
      <WhatsAppOutlined />
    </a>
  );
}

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const t = useT();

  useEffect(() => {
    setScrollEl(document.getElementById('page-scroll'));
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/employees', { cache: 'no-store', signal: ctrl.signal });
        const json = await res.json();
        if (json.success) setRows(json.data);
        setLoading(false);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.employeeId ?? '').toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q) ||
        (u.employmentStatus ?? '').toLowerCase().includes(q) ||
        (u.position?.name ?? '').toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const columns: ColumnsType<Employee> = useMemo(
    () => [
      {
        title: '',
        key: 'avatar',
        width: 56,
        render: (_, r) => <EmployeeAvatar name={r.name} size={36} />,
      },
      {
        title: <ColTitle label={t('employees.colId')} />,
        dataIndex: 'employeeId',
        width: 140,
        render: (v: string | null) =>
          v ? (
            <span style={{ fontFamily: 'ui-monospace, monospace' }} className="text-primary-light">
              {v}
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        title: <ColTitle label={t('employees.colName')} />,
        dataIndex: 'name',
        render: (v, r) => (
          <div>
            <div className="font-semibold">{v}</div>
            <div className="text-xs text-muted">{r.email}</div>
          </div>
        ),
      },
      {
        title: <ColTitle label={t('employees.colPosition')} />,
        dataIndex: ['position', 'name'],
        render: (v) => v ?? <span className="text-muted">—</span>,
      },
      {
        title: <ColTitle label={t('employees.colDept')} />,
        dataIndex: 'department',
        render: (v) => v ?? <span className="text-muted">—</span>,
      },
      {
        title: <ColTitle label={t('employees.colStatus')} />,
        dataIndex: 'employmentStatus',
        render: (v: string | null) => v ?? <span className="text-muted">—</span>,
      },
      {
        title: <ColTitle label={t('employees.colPhone')} />,
        dataIndex: 'phone',
        render: (v: string | null) =>
          v ? (
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`tel:${v}`}
                onClick={(e) => e.stopPropagation()}
                className="text-primary-light"
              >
                {v}
              </a>
              <WhatsAppButton phone={v} label={t('employees.whatsapp')} />
            </div>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PageTitle title={t('employees.title')} subtitle={t('employees.subtitle')} />
          <Input.Search
            placeholder={t('employees.search')}
            allowClear
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: 260, maxWidth: '100%' }}
            maxLength={100}
          />
        </div>
      </PageHeader>

      {/* Desktop: full table */}
      <div className="hidden md:block">
        {loading ? (
          <div className="glass p-6">
            <Skeleton active paragraph={{ rows: 5 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass p-10 flex items-center justify-center">
            <Empty description={<span className="text-muted">{t('employees.emptySearch')}</span>} />
          </div>
        ) : (
          <div className="glass requests-table-card">
            <Table<Employee>
              dataSource={filtered}
              columns={columns}
              rowKey="id"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              sticky={scrollEl ? { offsetHeader: 0, getContainer: () => scrollEl } : false}
              onRow={(r) => ({
                onClick: () => setSelected(r),
                style: { cursor: 'pointer' },
              })}
            />
          </div>
        )}
      </div>

      {/* Mobile: compact table-like list inside a single card */}
      <div className="md:hidden">
        {loading ? (
          <div className="glass p-6">
            <Skeleton active paragraph={{ rows: 5 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass p-10 flex items-center justify-center">
            <Empty description={<span className="text-muted">{t('employees.emptySearch')}</span>} />
          </div>
        ) : (
          <ul className="glass overflow-hidden divide-y divide-white/10">
            {filtered.map((r) => (
              <li
                key={r.id}
                onClick={() => setSelected(r)}
                className="px-3 py-3 flex items-center gap-3 cursor-pointer transition-colors hover:bg-white/5 active:bg-white/10"
              >
                <EmployeeAvatar name={r.name} size={42} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-xs text-muted truncate">{r.position?.name ?? '—'}</div>
                </div>
                <WhatsAppButton phone={r.phone} label={t('employees.whatsapp')} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={!!selected}
        onCancel={() => setSelected(null)}
        title={t('employees.modalTitle')}
        footer={null}
        destroyOnHidden
        width={560}
        centered
      >
        {selected && (
          <div className="space-y-2.5 md:space-y-5">
            <div className="flex items-center gap-3 md:gap-4">
              <EmployeeAvatar name={selected.name} size={56} />
              <div className="min-w-0 flex-1">
                <div
                  className="font-semibold text-sm md:text-xl leading-tight truncate"
                  style={{ color: 'rgb(var(--color-text-primary))' }}
                >
                  {selected.name}
                </div>
                <div
                  className="text-xs md:text-base mt-0.5 truncate"
                  style={{ color: 'rgb(var(--color-text-muted))' }}
                >
                  {selected.position?.name ?? '—'}
                </div>
              </div>
              {selected.phone && (
                <WhatsAppButton
                  phone={selected.phone}
                  label={t('employees.whatsapp')}
                  size={32}
                />
              )}
            </div>

            <dl className="grid grid-cols-1 gap-2 md:gap-4 pt-2.5 md:pt-4 border-t border-white/10">
              <DetailRow label={t('employees.colId')}>
                {selected.employeeId ? (
                  <span style={{ fontFamily: 'ui-monospace, monospace' }} className="text-primary-light">
                    {selected.employeeId}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </DetailRow>
              <DetailRow label={t('employees.colEmail')}>
                <a href={`mailto:${selected.email}`} className="text-primary-light break-all">
                  {selected.email}
                </a>
              </DetailRow>
              <DetailRow label={t('employees.colPhone')}>
                {selected.phone ? (
                  <a href={`tel:${selected.phone}`} className="text-primary-light">
                    {selected.phone}
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </DetailRow>
              <DetailRow label={t('employees.colDept')}>
                {selected.department ?? <span className="text-muted">—</span>}
              </DetailRow>
              <DetailRow label={t('employees.colStatus')}>
                {selected.employmentStatus ?? <span className="text-muted">—</span>}
              </DetailRow>
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}

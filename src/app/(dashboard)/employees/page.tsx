'use client';

import { Input, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import RequestsTable from '@/components/RequestsTable';
import type { ColumnsType } from 'antd/es/table';
import { useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

type Employee = {
  id: string;
  employeeId: string | null;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  position: { id: string; name: string } | null;
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const t = useT();

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/employees', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setRows(json.data);
      setLoading(false);
    })();
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
        (u.position?.name ?? '').toLowerCase().includes(q)
    );
  }, [rows, filter]);

  const columns: ColumnsType<Employee> = useMemo(
    () => [
      {
        title: t('employees.colId'),
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
        title: t('employees.colName'),
        dataIndex: 'name',
        render: (v, r) => (
          <div>
            <div className="font-semibold">{v}</div>
            <div className="text-xs text-muted">{r.email}</div>
          </div>
        ),
      },
      {
        title: t('employees.colPosition'),
        dataIndex: ['position', 'name'],
        render: (v) => v ?? <span className="text-muted">—</span>,
      },
      {
        title: t('employees.colDept'),
        dataIndex: 'department',
        render: (v) => v ?? <span className="text-muted">—</span>,
      },
      {
        title: t('employees.colPhone'),
        dataIndex: 'phone',
        render: (v: string | null) =>
          v ? (
            <a href={`tel:${v}`} className="text-primary-light">
              {v}
            </a>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
            {t('employees.title')}
          </Title>
          <Text className="text-muted">{t('employees.subtitle')}</Text>
        </div>
        <Input.Search
          placeholder={t('employees.search')}
          allowClear
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 260, maxWidth: '100%' }}
          maxLength={100}
        />
      </div>

      <RequestsTable<Employee>
        loading={loading}
        rows={filtered}
        columns={columns}
        rowKey="id"
        emptyText={t('employees.emptySearch')}
        mobileRender={(r) => (
          <div className="space-y-1">
            <div className="min-w-0">
              <div className="font-semibold truncate">{r.name}</div>
              <div className="text-xs text-muted truncate">{r.email}</div>
            </div>
            <div className="text-xs text-muted space-y-0.5 pt-1">
              <div>
                <b>{t('employees.mobileId')}</b>{' '}
                {r.employeeId ? (
                  <span style={{ fontFamily: 'ui-monospace, monospace' }} className="text-primary-light">
                    {r.employeeId}
                  </span>
                ) : (
                  '—'
                )}
              </div>
              <div>
                <b>{t('employees.mobilePosition')}</b> {r.position?.name ?? '—'}
              </div>
              <div>
                <b>{t('employees.mobileDept')}</b> {r.department ?? '—'}
              </div>
              <div>
                <b>{t('employees.mobilePhone')}</b>{' '}
                {r.phone ? (
                  <a href={`tel:${r.phone}`} className="text-primary-light">
                    {r.phone}
                  </a>
                ) : (
                  '—'
                )}
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}

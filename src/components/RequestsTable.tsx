'use client';

import { Empty, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Key } from 'react';
import { useT } from '@/lib/i18n/provider';

type Props<T> = {
  loading?: boolean;
  rows: T[];
  columns: ColumnsType<T>;
  rowKey: keyof T | ((r: T) => Key);
  mobileRender?: (r: T) => React.ReactNode;
  emptyText?: string;
  onRowClick?: (r: T) => void;
};

export default function RequestsTable<T extends object>({
  loading,
  rows,
  columns,
  rowKey,
  mobileRender,
  emptyText,
  onRowClick,
}: Props<T>) {
  const t = useT();
  const empty = emptyText ?? t('table.empty');
  if (loading) {
    return (
      <div className="glass p-6">
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="glass p-10 flex items-center justify-center">
        <Empty description={<span className="text-muted">{empty}</span>} />
      </div>
    );
  }
  return (
    <>
      <div className="hidden md:block glass p-2 overflow-hidden">
        <Table<T>
          dataSource={rows}
          columns={columns}
          rowKey={rowKey as never}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          onRow={(r) => ({ onClick: () => onRowClick?.(r), style: { cursor: onRowClick ? 'pointer' : 'default' } })}
        />
      </div>
      {mobileRender && (
        <div className="md:hidden space-y-3 stagger">
          {rows.map((r) => (
            <div
              key={typeof rowKey === 'function' ? (rowKey as (x: T) => Key)(r) : String(r[rowKey as keyof T])}
              className="glass glass-hover p-4"
              onClick={() => onRowClick?.(r)}
            >
              {mobileRender(r)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

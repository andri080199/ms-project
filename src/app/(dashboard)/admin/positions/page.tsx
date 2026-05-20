'use client';

// Admin positions management page. Lists all positions with their user counts.
// Delete is blocked server-side (and disabled in the UI) when users are still assigned to a position.
// The name field uses AutoComplete with POSITION_OPTIONS as suggestions but allows free text.

import { App, AutoComplete, Button, Empty, Form, Modal, Popconfirm, Select, Skeleton, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, IdcardOutlined, TeamOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import GlassCard from '@/components/GlassCard';
import PageHeader, { PageTitle } from '@/components/PageHeader';
import { DEPARTMENT_OPTIONS } from '@/lib/departments';
import { POSITION_OPTIONS } from '@/lib/positions';
import { useT } from '@/lib/i18n/provider';


type Position = {
  id: string;
  name: string;
  department: string | null;
  createdAt: string;
  _count: { users: number };
};

type FormValues = {
  name: string;
  department: string;
};

export default function PositionsPage() {
  const t = useT();
  const [rows, setRows] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Position | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();

  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/positions', { cache: 'no-store', signal });
      const json = await res.json();
      if (json.success) setRows(json.data);
      else message.error(json.error ?? t('adminPositions.msgLoadFailed'));
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(p: Position) {
    setEditing(p);
    setOpen(true);
  }

  async function onFinish(values: FormValues) {
    setSaving(true);
    try {
      const body = {
        name: values.name.trim(),
        department: values.department,
      };
      const url = editing ? `/api/admin/positions/${editing.id}` : '/api/admin/positions';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.saveFailed'));
        return;
      }
      message.success(editing ? t('adminPositions.msgUpdated') : t('adminPositions.msgCreated'));
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(p: Position) {
    const res = await fetch(`/api/admin/positions/${p.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok || !json.success) {
      message.error(json.error ?? t('common.deleteFailed'));
      return;
    }
    message.success(t('adminPositions.msgDeleted'));
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PageTitle title={t('adminPositions.title')} subtitle={t('adminPositions.subtitle')} />
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreate}>
            {t('adminPositions.addButton')}
          </Button>
        </div>
      </PageHeader>

      {loading ? (
        <GlassCard className="p-6">
          <Skeleton active paragraph={{ rows: 5 }} />
        </GlassCard>
      ) : rows.length === 0 ? (
        <GlassCard className="p-10 flex items-center justify-center">
          <Empty description={<span className="text-muted">{t('adminPositions.emptyList')}</span>} />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3 stagger">
          {rows.map((p) => {
            const inUse = p._count.users > 0;
            return (
              <GlassCard key={p.id} hover className="p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className="flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{
                        width: 48,
                        height: 48,
                        background: 'var(--gradient-brand-soft)',
                        border: '1px solid var(--gradient-brand-border)',
                      }}
                    >
                      <IdcardOutlined style={{ fontSize: 22, color: 'rgb(var(--color-primary-200))' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base truncate">{p.name}</span>
                        {p.department && (
                          <Tag color="cyan" style={{ margin: 0 }}>
                            {p.department}
                          </Tag>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted mt-1.5">
                        <TeamOutlined />
                        <span>{t('adminPositions.userCount', { n: p._count.users })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 md:flex-shrink-0">
                    <Button icon={<EditOutlined />} onClick={() => openEdit(p)}>
                      {t('common.edit')}
                    </Button>
                    <Popconfirm
                      title={t('adminPositions.deleteConfirmTitle')}
                      description={t('adminPositions.deleteConfirmDesc')}
                      okText={t('common.delete')}
                      cancelText={t('common.cancel')}
                      okButtonProps={{ danger: true }}
                      disabled={inUse}
                      onConfirm={() => onDelete(p)}
                    >
                      <Tooltip title={inUse ? t('adminPositions.inUseTooltip') : ''}>
                        <Button danger icon={<DeleteOutlined />} disabled={inUse}>
                          {t('common.delete')}
                        </Button>
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        title={editing ? t('adminPositions.editTitle') : t('adminPositions.createTitle')}
        destroyOnHidden
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          className="space-y-4 pt-2"
          initialValues={
            editing
              ? {
                  name: editing.name,
                  department: editing.department ?? undefined,
                }
              : undefined
          }
          preserve={false}
        >
          <Form.Item
            label={t('adminPositions.labelName')}
            name="name"
            rules={[
              { required: true, message: t('adminPositions.nameRequired') },
              { min: 2, max: 100 },
            ]}
            tooltip={t('adminPositions.nameTooltip')}
          >
            <AutoComplete
              options={POSITION_OPTIONS}
              placeholder={t('adminPositions.namePlaceholder')}
              filterOption={(input, option) =>
                (option?.value?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
              }
              allowClear
              classNames={{ popup: { root: 'app-select-popup' } }}
            />
          </Form.Item>
          <Form.Item
            label={t('adminPositions.labelDept')}
            name="department"
            rules={[{ required: true, message: t('adminPositions.deptRequired') }]}
          >
            <Select
              placeholder={t('adminPositions.deptPlaceholder')}
              options={DEPARTMENT_OPTIONS}
              classNames={{ popup: { root: 'app-select-popup' } }}
            />
          </Form.Item>
          <div className="flex gap-2 justify-end">
            <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

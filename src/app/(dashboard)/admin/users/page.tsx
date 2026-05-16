'use client';

import { App, AutoComplete, Avatar, Button, DatePicker, Empty, Form, Input, Modal, Popconfirm, Select, Skeleton, Spin, Switch, Tabs, Tag, Tooltip } from 'antd';
import type { FormInstance } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, MailOutlined, PhoneOutlined, IdcardOutlined, ApartmentOutlined, UserOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import GlassCard from '@/components/GlassCard';
import PageHeader, { PageTitle } from '@/components/PageHeader';
import ProfileEditForm, {
  formValuesToApiBody,
  type ProfileEditable,
  type ProfileFormValues,
} from '@/components/ProfileEditForm';
import type { Role } from '@prisma/client';
import { useSession } from 'next-auth/react';
import { DEPARTMENT_OPTIONS } from '@/lib/departments';
import { useT } from '@/lib/i18n/provider';


type Position = { id: string; name: string; baseRole: Role; department: string | null };

type UserRow = {
  id: string;
  employeeId: string | null;
  email: string;
  name: string;
  role: Role;
  isSuperAdmin: boolean;
  phone: string | null;
  department: string | null;
  employmentStatus: string | null;
  joinDate: string | null;
  spvId: string | null;
  positionId: string | null;
  position: Position | null;
  spv: { id: string; name: string } | null;
  createdAt: string;
};

type FormValues = {
  email: string;
  name: string;
  password?: string;
  role: Role;
  phone?: string;
  positionId?: string;
  department?: string;
  employmentStatus?: string;
  joinDate?: Dayjs | null;
  spvId?: string;
  employeeId?: string;
  isSuperAdmin?: boolean;
};

const SUPER_ADMIN_DEFAULT_POSITION = 'People & GA Officer';

export default function UsersPage() {
  const { data: session } = useSession();
  const currentId = session?.user?.id;
  const t = useT();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [form] = Form.useForm<FormValues>();
  const profileFormRef = useRef<FormInstance<ProfileFormValues> | null>(null);
  const { message } = App.useApp();

  const [profileData, setProfileData] = useState<ProfileEditable | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'akun' | 'profil'>('akun');

  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([
        fetch('/api/admin/users', { cache: 'no-store', signal }).then((r) => r.json()),
        fetch('/api/admin/positions', { cache: 'no-store', signal }).then((r) => r.json()),
      ]);
      if (u.success) setRows(u.data);
      else message.error(u.error ?? t('adminUsers.msgLoadFailed'));
      if (p.success) setPositions(p.data);
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

  const spvOptions = useMemo(
    () =>
      rows
        .filter((u) => u.id !== editing?.id)
        .map((u) => ({
          value: u.id,
          label: `${u.name} — ${u.position?.name ?? t(`role.${u.role}`)}`,
        })),
    [rows, t, editing?.id],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.employeeId ?? '').toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q) ||
        (u.position?.name ?? '').toLowerCase().includes(q)
    );
  }, [rows, filter]);

  function openCreate() {
    setEditing(null);
    setProfileData(null);
    setActiveTab('akun');
    setOpen(true);
  }
  async function openEdit(u: UserRow) {
    setEditing(u);
    setProfileData(null);
    setActiveTab('akun');
    setOpen(true);
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/profile`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('adminUsers.msgProfileLoadFailed'));
        return;
      }
      setProfileData(json.data);
    } finally {
      setProfileLoading(false);
    }
  }

  const initialFormValues: FormValues = editing
    ? {
        email: editing.email,
        name: editing.name,
        role: editing.role,
        phone: editing.phone ?? undefined,
        positionId: editing.positionId ?? undefined,
        department: editing.department ?? undefined,
        employmentStatus: editing.employmentStatus ?? undefined,
        joinDate: editing.joinDate ? dayjs(editing.joinDate) : null,
        spvId: editing.spvId ?? undefined,
        employeeId: editing.employeeId ?? undefined,
        password: '',
        isSuperAdmin: editing.isSuperAdmin,
      }
    : { role: 'EMPLOYEE', name: '', email: '', isSuperAdmin: false, joinDate: null };

  async function onSave() {
    let accountValues: FormValues;
    try {
      accountValues = await form.validateFields();
    } catch {
      setActiveTab('akun');
      return;
    }
    if (!editing && !accountValues.password) {
      message.error(t('adminUsers.passwordRequiredNew'));
      setActiveTab('akun');
      return;
    }

    let profileBody: Record<string, unknown> = {};
    if (editing && profileData) {
      let profileValues: ProfileFormValues;
      try {
        profileValues = await profileFormRef.current!.validateFields();
      } catch {
        setActiveTab('profil');
        return;
      }
      const apiBody = formValuesToApiBody(profileValues);
      profileBody = {
        additionalPhone: apiBody.additionalPhone ?? null,
        placeOfBirth: apiBody.placeOfBirth ?? null,
        birthdate: apiBody.birthdate,
        gender: apiBody.gender ?? null,
        maritalStatus: apiBody.maritalStatus ?? null,
        bloodType: apiBody.bloodType ?? null,
        religion: apiBody.religion ?? null,
        nik: apiBody.nik ?? null,
        idAddress: apiBody.idAddress ?? null,
        postalCode: apiBody.postalCode ?? null,
        residentialAddress: apiBody.residentialAddress ?? null,
        passportNumber: apiBody.passportNumber ?? null,
        passportExpiry: apiBody.passportExpiry,
      };
    }

    setSaving(true);
    try {
      const pos = positions.find((p) => p.id === accountValues.positionId);
      const role = pos?.baseRole ?? accountValues.role ?? 'EMPLOYEE';
      const accountBody = {
        ...accountValues,
        role,
        phone: accountValues.phone || null,
        positionId: accountValues.positionId || null,
        department: accountValues.department || null,
        employmentStatus: accountValues.employmentStatus?.trim() || null,
        joinDate: accountValues.joinDate ? accountValues.joinDate.toISOString() : null,
        spvId: accountValues.spvId || null,
        employeeId: accountValues.employeeId?.trim() || null,
        isSuperAdmin: !!accountValues.isSuperAdmin,
      };
      const body = { ...accountBody, ...profileBody };
      const url = editing ? `/api/admin/users/${editing.id}` : '/api/admin/users';
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
      message.success(editing ? t('adminUsers.msgUpdated') : t('adminUsers.msgCreated'));
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(u: UserRow) {
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok || !json.success) {
      message.error(json.error ?? t('common.deleteFailed'));
      return;
    }
    message.success(t('adminUsers.msgDeleted'));
    load();
  }

  function onPositionChange(pid: string | undefined) {
    if (!pid) return;
    const p = positions.find((x) => x.id === pid);
    if (!p) return;
    const updates: Partial<FormValues> = { role: p.baseRole };
    if (p.department) updates.department = p.department;
    if (p.name === SUPER_ADMIN_DEFAULT_POSITION) updates.isSuperAdmin = true;
    queueMicrotask(() => form.setFieldsValue(updates));
  }

  const positionOptions = positions.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PageTitle title={t('adminUsers.title')} subtitle={t('adminUsers.subtitle')} />
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input.Search
              placeholder={t('adminUsers.search')}
              allowClear
              onChange={(e) => setFilter(e.target.value)}
              className="w-full sm:w-[260px]"
              maxLength={100}
            />
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreate}>
              {t('adminUsers.addButton')}
            </Button>
          </div>
        </div>
      </PageHeader>

      {loading ? (
        <GlassCard className="p-6">
          <Skeleton active paragraph={{ rows: 6 }} />
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-10 flex items-center justify-center">
          <Empty description={<span className="text-muted">{t('adminUsers.emptyList')}</span>} />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3 stagger">
          {filtered.map((u) => (
            <GlassCard key={u.id} hover className="p-4 md:p-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Avatar
                    size={48}
                    icon={<UserOutlined />}
                    style={{
                      background: 'var(--gradient-brand)',
                      flexShrink: 0,
                      color: 'rgb(var(--color-text-primary))',
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base truncate">{u.name}</span>
                      {u.isSuperAdmin && (
                        <Tag
                          color="volcano"
                          icon={<SafetyCertificateOutlined />}
                          style={{ margin: 0 }}
                        >
                          {t('role.SUPER_ADMIN')}
                        </Tag>
                      )}
                      {u.employeeId && (
                        <Tag
                          color="cyan"
                          style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}
                        >
                          #{u.employeeId}
                        </Tag>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted mt-1 truncate">
                      <MailOutlined />
                      <span className="truncate">{u.email}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mt-1.5">
                      {u.position?.name && (
                        <span className="flex items-center gap-1.5">
                          <IdcardOutlined />
                          {u.position.name}
                        </span>
                      )}
                      {u.department && (
                        <span className="flex items-center gap-1.5">
                          <ApartmentOutlined />
                          {u.department}
                        </span>
                      )}
                      {u.phone && (
                        <span className="flex items-center gap-1.5">
                          <PhoneOutlined />
                          {u.phone}
                        </span>
                      )}
                      {u.spv?.name && (
                        <span className="flex items-center gap-1.5">
                          {t('adminUsers.spvLabel')} <span style={{ color: 'rgb(var(--color-text-primary))' }}>{u.spv.name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 md:flex-shrink-0 flex-wrap">
                  <Button icon={<EditOutlined />} onClick={() => openEdit(u)}>
                    {t('adminUsers.btnEdit')}
                  </Button>
                  <Popconfirm
                    title={t('adminUsers.deleteConfirmTitle')}
                    description={t('adminUsers.deleteConfirmDesc')}
                    okText={t('adminUsers.btnDelete')}
                    cancelText={t('adminUsers.btnCancel')}
                    okButtonProps={{ danger: true }}
                    disabled={u.id === currentId}
                    onConfirm={() => onDelete(u)}
                  >
                    <Tooltip title={u.id === currentId ? t('adminUsers.deleteSelfTooltip') : ''}>
                      <Button danger icon={<DeleteOutlined />} disabled={u.id === currentId}>
                        {t('adminUsers.btnDelete')}
                      </Button>
                    </Tooltip>
                  </Popconfirm>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title={editing ? t('adminUsers.editTitle', { name: editing.name }) : t('adminUsers.createTitle')}
        width={editing ? 880 : 640}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>
            {t('adminUsers.btnCancel')}
          </Button>,
          <Button key="save" type="primary" loading={saving} onClick={onSave}>
            {t('adminUsers.btnSave')}
          </Button>,
        ]}
      >
        {editing ? (
          <Tabs
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as 'akun' | 'profil')}
            items={[
              {
                key: 'akun',
                label: t('adminUsers.tabAccount'),
                children: (
                  <AccountFormSection
                    form={form}
                    initialValues={initialFormValues}
                    editing={editing}
                    positionOptions={positionOptions}
                    spvOptions={spvOptions}
                    onPositionChange={onPositionChange}
                  />
                ),
              },
              {
                key: 'profil',
                label: t('adminUsers.tabProfile'),
                children: profileLoading || !profileData ? (
                  <div className="flex items-center justify-center py-12">
                    <Spin />
                  </div>
                ) : (
                  <ProfileEditForm
                    key={editing.id}
                    profile={profileData}
                    saving={false}
                    formRef={profileFormRef}
                    onSubmit={() => {}}
                    onCancel={() => setOpen(false)}
                    variant="modal"
                    hideIdentityFields
                    hideFooter
                  />
                ),
              },
            ]}
          />
        ) : (
          <AccountFormSection
            form={form}
            initialValues={initialFormValues}
            editing={null}
            positionOptions={positionOptions}
            spvOptions={spvOptions}
            onPositionChange={onPositionChange}
          />
        )}
      </Modal>
    </div>
  );
}

type AccountFormSectionProps = {
  form: FormInstance<FormValues>;
  initialValues: FormValues;
  editing: UserRow | null;
  positionOptions: { value: string; label: string }[];
  spvOptions: { value: string; label: string }[];
  onPositionChange: (pid: string | undefined) => void;
};

function AccountFormSection({
  form,
  initialValues,
  editing,
  positionOptions,
  spvOptions,
  onPositionChange,
}: AccountFormSectionProps) {
  const t = useT();
  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      className="space-y-3 pt-2"
      initialValues={initialValues}
      preserve={false}
    >
      <div className="grid md:grid-cols-2 gap-3">
        <Form.Item
          label={t('adminUsers.labelName')}
          name="name"
          rules={[{ required: true, message: t('adminUsers.nameRequired') }, { min: 2, max: 100 }]}
        >
          <Input placeholder={t('adminUsers.namePlaceholder')} maxLength={100} />
        </Form.Item>
        <Form.Item
          label={t('adminUsers.labelEmail')}
          name="email"
          rules={[{ required: true, message: t('adminUsers.emailRequired') }, { type: 'email' }]}
        >
          <Input placeholder={t('adminUsers.emailPlaceholder')} maxLength={150} />
        </Form.Item>
      </div>

      <Form.Item
        label={editing ? t('adminUsers.passwordLabelEdit') : t('adminUsers.passwordLabelNew')}
        name="password"
        rules={editing ? [] : [{ required: true, message: t('adminUsers.passwordRequiredField') }, { min: 6 }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder={editing ? t('adminUsers.passwordPlaceholderEdit') : t('adminUsers.passwordPlaceholderNew')}
          maxLength={100}
        />
      </Form.Item>

      <Form.Item
        label={t('adminUsers.labelEmployeeId')}
        name="employeeId"
        tooltip={t('adminUsers.empIdTooltip')}
        rules={[
          { pattern: /^\d+$/, message: t('adminUsers.empIdDigits') },
          { max: 20 },
        ]}
        normalize={(v: string | undefined) => (v ?? '').replace(/\D/g, '')}
      >
        <Input
          placeholder={t('adminUsers.empIdPlaceholder')}
          maxLength={20}
          inputMode="numeric"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        />
      </Form.Item>

      <div className="grid md:grid-cols-2 gap-3">
        <Form.Item
          label={t('adminUsers.labelPosition')}
          name="positionId"
          rules={[{ required: true, message: t('adminUsers.positionRequired') }]}
        >
          <Select
            showSearch
            placeholder={t('adminUsers.positionPlaceholder')}
            options={positionOptions}
            onChange={onPositionChange}
            optionFilterProp="label"
            classNames={{ popup: { root: 'app-select-popup' } }}
          />
        </Form.Item>
        <Form.Item
          label={t('adminUsers.labelDept')}
          name="department"
          rules={[{ required: true, message: t('adminUsers.deptRequired') }]}
        >
          <Select
            placeholder={t('adminUsers.deptPlaceholder')}
            options={DEPARTMENT_OPTIONS}
            classNames={{ popup: { root: 'app-select-popup' } }}
          />
        </Form.Item>
      </div>

      <Form.Item label={t('adminUsers.labelPhone')} name="phone">
        <Input placeholder={t('adminUsers.phonePlaceholder')} maxLength={30} />
      </Form.Item>

      <div className="grid md:grid-cols-2 gap-3">
        <Form.Item label={t('adminUsers.labelEmploymentStatus')} name="employmentStatus">
          <Input placeholder={t('adminUsers.employmentStatusPlaceholder')} maxLength={100} />
        </Form.Item>
        <Form.Item
          label={t('adminUsers.labelJoinDate')}
          name="joinDate"
          tooltip={t('adminUsers.joinDateTooltip')}
        >
          <DatePicker
            className="w-full"
            format="DD MMM YYYY"
            placeholder={t('adminUsers.joinDatePlaceholder')}
            classNames={{ popup: { root: 'app-date-popup' } }}
          />
        </Form.Item>
      </div>

      <Form.Item
        label={t('adminUsers.labelApproval')}
        name="spvId"
        tooltip={t('adminUsers.approvalTooltip')}
      >
        <ApproverSearch options={spvOptions} placeholder={t('adminUsers.approvalPlaceholder')} />
      </Form.Item>

      <Form.Item
        label={
          <span className="flex items-center gap-2">
            <SafetyCertificateOutlined style={{ color: 'rgb(var(--color-warning))' }} />
            {t('adminUsers.labelSuperAdmin')}
          </span>
        }
        name="isSuperAdmin"
        valuePropName="checked"
        tooltip={t('adminUsers.superAdminTooltip')}
      >
        <Switch checkedChildren={t('adminUsers.switchOn')} unCheckedChildren={t('adminUsers.switchOff')} />
      </Form.Item>
    </Form>
  );
}

type ApproverSearchProps = {
  value?: string;
  onChange?: (v: string | undefined) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
};

function ApproverSearch({ value, onChange, options, placeholder }: ApproverSearchProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    const matched = options.find((o) => o.value === value);
    setText(matched?.label ?? '');
  }, [value, options]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, text]);

  return (
    <AutoComplete
      value={text}
      options={filtered}
      placeholder={placeholder}
      allowClear
      classNames={{ popup: { root: 'app-select-popup' } }}
      onChange={(v: string) => {
        setText(v ?? '');
        if (!v) onChange?.(undefined);
      }}
      onSelect={(_v, opt) => {
        onChange?.(opt.value);
        setText(opt.label);
      }}
      onBlur={() => {
        const matched = options.find((o) => o.value === value);
        setText(matched?.label ?? '');
      }}
    />
  );
}

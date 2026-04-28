'use client';

import { App, Avatar, Button, Descriptions, Skeleton, Tag, Typography } from 'antd';
import {
  EditOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import GlassCard from '@/components/GlassCard';
import ProfileEditForm, {
  formValuesToApiBody,
  type ProfileFormValues,
} from '@/components/ProfileEditForm';
import type { BloodType, Gender, MaritalStatus, Role } from '@prisma/client';
import { useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

type Profile = {
  id: string;
  employeeId: string | null;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  department: string | null;
  position: { id: string; name: string } | null;
  additionalPhone: string | null;
  placeOfBirth: string | null;
  birthdate: string | null;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  bloodType: BloodType | null;
  religion: string | null;
  nik: string | null;
  idAddress: string | null;
  postalCode: string | null;
  residentialAddress: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
};

function calcAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const b = dayjs(birthdate);
  if (!b.isValid()) return null;
  return dayjs().diff(b, 'year');
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = dayjs(value);
  return d.isValid() ? d.format('DD MMM YYYY') : '—';
}

function valueOrDash(v: string | null | undefined): string {
  return v && v.trim().length > 0 ? v : '—';
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const canEdit = !!session?.user?.isSuperAdmin;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const { message } = App.useApp();
  const t = useT();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setProfile(json.data);
      } else {
        message.error(json.error ?? t('profile.msgLoadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFinish(values: ProfileFormValues) {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValuesToApiBody(values)),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.saveFailed'));
        return;
      }
      message.success(t('profile.msgUpdated'));
      setProfile(json.data);
      setMode('view');
    } finally {
      setSaving(false);
    }
  }

  const age = useMemo(() => (profile ? calcAge(profile.birthdate) : null), [profile]);

  if (loading) {
    return (
      <div className="space-y-6">
        <GlassCard className="p-6">
          <Skeleton avatar active paragraph={{ rows: 2 }} />
        </GlassCard>
        <GlassCard className="p-6">
          <Skeleton active paragraph={{ rows: 6 }} />
        </GlassCard>
      </div>
    );
  }

  if (!profile) {
    return (
      <GlassCard className="p-6">
        <Text className="text-muted">{t('profile.empty')}</Text>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
            {t('profile.title')}
          </Title>
          <Text className="text-muted">
            {mode === 'view'
              ? canEdit
                ? t('profile.subtitleView')
                : t('profile.subtitleViewNoEdit')
              : t('profile.subtitleEdit')}
          </Text>
        </div>
        {mode === 'view' && canEdit && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => setMode('edit')}>
            {t('profile.editButton')}
          </Button>
        )}
      </div>

      <GlassCard className="p-5 md:p-6">
        <div className="flex items-center gap-4 md:gap-5 flex-wrap">
          <Avatar
            size={84}
            icon={<UserOutlined />}
            style={{
              background: 'var(--gradient-brand)',
              color: 'rgb(var(--color-text-primary))',
              fontSize: 40,
              flexShrink: 0,
            }}
          />
          <div className="flex-1 min-w-0 space-y-1">
            <Title level={3} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }} ellipsis>
              {profile.name}
            </Title>
            <div className="flex items-center gap-2 flex-wrap">
              {profile.employeeId && (
                <Tag color="cyan" style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>
                  {profile.employeeId}
                </Tag>
              )}
              <Text className="text-muted text-sm">
                {profile.position?.name ?? '—'} · {profile.department ?? '—'}
              </Text>
            </div>
            <div className="flex items-center gap-4 flex-wrap pt-1">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                <MailOutlined /> {profile.email}
              </span>
              {profile.phone && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                  <PhoneOutlined /> {profile.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {mode === 'view' || !canEdit ? (
        <>
          <GlassCard className="p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <UserOutlined style={{ color: 'rgb(var(--color-primary-light))' }} />
              <Title level={4} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }}>
                {t('profile.sectionPersonal')}
              </Title>
            </div>
            <Descriptions
              column={{ xs: 1, sm: 2, md: 2, lg: 3 }}
              colon={false}
              layout="vertical"
              size="small"
              styles={{
                label: {
                  color: 'rgb(var(--color-text-muted))',
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  paddingBottom: 4,
                },
                content: { color: 'rgb(var(--color-text-primary))', fontSize: 14, paddingBottom: 16 },
              }}
            >
              <Descriptions.Item label={t('profile.labelEmployeeId')}>
                <span style={{ fontFamily: 'ui-monospace, monospace' }}>{valueOrDash(profile.employeeId)}</span>
              </Descriptions.Item>
              <Descriptions.Item label={t('profile.labelFullName')}>{valueOrDash(profile.name)}</Descriptions.Item>
              <Descriptions.Item label={t('profile.labelEmail')}>{profile.email}</Descriptions.Item>
              <Descriptions.Item label={t('profile.labelPhone')}>{valueOrDash(profile.phone)}</Descriptions.Item>
              <Descriptions.Item label={t('profile.labelAdditionalPhone')}>{valueOrDash(profile.additionalPhone)}</Descriptions.Item>
              <Descriptions.Item label={t('profile.labelPlaceOfBirth')}>{valueOrDash(profile.placeOfBirth)}</Descriptions.Item>
              <Descriptions.Item label={t('profile.labelBirthdate')}>
                {formatDate(profile.birthdate)}
                {age != null && <span className="text-muted text-xs ml-2">({age} {t('time.yearsSuffix')})</span>}
              </Descriptions.Item>
              <Descriptions.Item label={t('profile.labelGender')}>
                {profile.gender ? t(`gender.${profile.gender}`) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('profile.labelMarital')}>
                {profile.maritalStatus ? t(`marital.${profile.maritalStatus}`) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('profile.labelBlood')}>{valueOrDash(profile.bloodType)}</Descriptions.Item>
              <Descriptions.Item label={t('profile.labelReligion')}>{valueOrDash(profile.religion)}</Descriptions.Item>
            </Descriptions>
          </GlassCard>

          <GlassCard className="p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <IdcardOutlined style={{ color: 'rgb(var(--color-primary-light))' }} />
              <Title level={4} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }}>
                {t('profile.sectionIdentity')}
              </Title>
            </div>
            <Descriptions
              column={{ xs: 1, sm: 2, md: 2 }}
              colon={false}
              layout="vertical"
              size="small"
              styles={{
                label: {
                  color: 'rgb(var(--color-text-muted))',
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  paddingBottom: 4,
                },
                content: { color: 'rgb(var(--color-text-primary))', fontSize: 14, paddingBottom: 16 },
              }}
            >
              <Descriptions.Item label={t('profile.labelNik')}>{valueOrDash(profile.nik)}</Descriptions.Item>
              <Descriptions.Item label={t('profile.labelPostalCode')}>{valueOrDash(profile.postalCode)}</Descriptions.Item>
              <Descriptions.Item label={t('profile.labelPassportNumber')}>{valueOrDash(profile.passportNumber)}</Descriptions.Item>
              <Descriptions.Item label={t('profile.labelPassportExpiry')}>{formatDate(profile.passportExpiry)}</Descriptions.Item>
            </Descriptions>
          </GlassCard>

          <GlassCard className="p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <EnvironmentOutlined style={{ color: 'rgb(var(--color-primary-light))' }} />
              <Title level={4} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }}>
                {t('profile.sectionAddress')}
              </Title>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <Text className="text-muted text-xs uppercase tracking-wide">{t('profile.ktpAddressHint')}</Text>
                <div style={{ color: 'rgb(var(--color-text-primary))', whiteSpace: 'pre-wrap' }}>{valueOrDash(profile.idAddress)}</div>
              </div>
              <div className="space-y-1">
                <Text className="text-muted text-xs uppercase tracking-wide">{t('profile.residentialHint')}</Text>
                <div style={{ color: 'rgb(var(--color-text-primary))', whiteSpace: 'pre-wrap' }}>
                  {valueOrDash(profile.residentialAddress)}
                </div>
              </div>
            </div>
          </GlassCard>
        </>
      ) : (
        <ProfileEditForm
          profile={profile}
          saving={saving}
          onSubmit={onFinish}
          onCancel={() => setMode('view')}
        />
      )}
    </div>
  );
}

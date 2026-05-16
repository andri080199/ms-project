'use client';

import { Button, DatePicker, Form, Input, Select, Typography } from 'antd';
import type { FormInstance } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useRef } from 'react';
import GlassCard from '@/components/GlassCard';
import type { BloodType, Gender, MaritalStatus } from '@prisma/client';
import { useT } from '@/lib/i18n/provider';

const { Title } = Typography;

export type ProfileEditable = {
  employeeId: string | null;
  email: string;
  name: string;
  phone: string | null;
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

export type ProfileFormValues = {
  name: string;
  email: string;
  employeeId?: string;
  phone?: string;
  additionalPhone?: string;
  placeOfBirth?: string;
  birthdate?: Dayjs | null;
  gender?: Gender | null;
  maritalStatus?: MaritalStatus | null;
  bloodType?: BloodType | null;
  religion?: string;
  nik?: string;
  idAddress?: string;
  postalCode?: string;
  residentialAddress?: string;
  passportNumber?: string;
  passportExpiry?: Dayjs | null;
};

const BLOOD_OPTIONS = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'AB', label: 'AB' },
  { value: 'O', label: 'O' },
];
const RELIGION_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya'].map(
  (v) => ({ value: v, label: v })
);

export function profileToFormValues(p: ProfileEditable): ProfileFormValues {
  return {
    name: p.name,
    email: p.email,
    employeeId: p.employeeId ?? undefined,
    phone: p.phone ?? undefined,
    additionalPhone: p.additionalPhone ?? undefined,
    placeOfBirth: p.placeOfBirth ?? undefined,
    birthdate: p.birthdate ? dayjs(p.birthdate) : null,
    gender: p.gender ?? null,
    maritalStatus: p.maritalStatus ?? null,
    bloodType: p.bloodType ?? null,
    religion: p.religion ?? undefined,
    nik: p.nik ?? undefined,
    idAddress: p.idAddress ?? undefined,
    postalCode: p.postalCode ?? undefined,
    residentialAddress: p.residentialAddress ?? undefined,
    passportNumber: p.passportNumber ?? undefined,
    passportExpiry: p.passportExpiry ? dayjs(p.passportExpiry) : null,
  };
}

export function formValuesToApiBody(values: ProfileFormValues) {
  return {
    ...values,
    birthdate: values.birthdate ? values.birthdate.toISOString() : null,
    passportExpiry: values.passportExpiry ? values.passportExpiry.toISOString() : null,
  };
}

type Props = {
  profile: ProfileEditable;
  saving: boolean;
  onSubmit: (values: ProfileFormValues) => void | Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  variant?: 'page' | 'modal';
  hideIdentityFields?: boolean;
  hideFooter?: boolean;
  formId?: string;
  formRef?: React.MutableRefObject<FormInstance<ProfileFormValues> | null>;
};

export default function ProfileEditForm({
  profile,
  saving,
  onSubmit,
  onCancel,
  submitLabel,
  variant = 'page',
  hideIdentityFields = false,
  hideFooter = false,
  formId,
  formRef,
}: Props) {
  const t = useT();
  const [form] = Form.useForm<ProfileFormValues>();
  const birthdateWatch = Form.useWatch('birthdate', form);
  const formAge = birthdateWatch && birthdateWatch.isValid() ? dayjs().diff(birthdateWatch, 'year') : null;
  const initialValues = useMemo(() => profileToFormValues(profile), [profile]);
  const didInit = useRef(false);

  useEffect(() => {
    if (formRef) formRef.current = form;
  }, [form, formRef]);

  useEffect(() => {
    if (didInit.current) {
      form.setFieldsValue(initialValues);
    }
    didInit.current = true;
  }, [form, initialValues]);
  const useCards = variant === 'page';
  const buttonLabel = submitLabel ?? t('profile.saveButton');

  const genderOptions = useMemo(
    () => [
      { value: 'MALE', label: t('gender.MALE') },
      { value: 'FEMALE', label: t('gender.FEMALE') },
    ],
    [t],
  );
  const maritalOptions = useMemo(
    () => [
      { value: 'SINGLE', label: t('marital.SINGLE') },
      { value: 'MARRIED', label: t('marital.MARRIED') },
      { value: 'DIVORCED', label: t('marital.DIVORCED') },
      { value: 'WIDOWED', label: t('marital.WIDOWED') },
    ],
    [t],
  );

  const dataSection = (
    <>
      <Title level={4} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }}>
        {t('profile.sectionPersonal')}
      </Title>

      {!hideIdentityFields && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <Form.Item
              label={t('profile.labelEmployeeId')}
              name="employeeId"
              tooltip={t('profile.empIdTooltip')}
              rules={[
                { pattern: /^\d+$/, message: t('profile.empIdDigits') },
                { max: 20 },
              ]}
              normalize={(v: string | undefined) => (v ?? '').replace(/\D/g, '')}
            >
              <Input
                placeholder={t('profile.empIdPlaceholder')}
                maxLength={20}
                inputMode="numeric"
                style={{ fontFamily: 'ui-monospace, monospace' }}
              />
            </Form.Item>
            <Form.Item
              label={t('profile.labelEmail')}
              name="email"
              rules={[
                { required: true, message: t('profile.emailRequired') },
                { type: 'email', message: t('profile.emailInvalid') },
              ]}
            >
              <Input placeholder={t('profile.emailPlaceholder')} maxLength={150} />
            </Form.Item>
          </div>

          <Form.Item
            label={t('profile.labelFullName')}
            name="name"
            rules={[{ required: true, message: t('profile.nameRequired') }, { min: 2, max: 100 }]}
          >
            <Input placeholder={t('profile.namePlaceholder')} maxLength={100} />
          </Form.Item>

          <div className="grid md:grid-cols-2 gap-3">
            <Form.Item label={t('profile.labelPhone')} name="phone">
              <Input placeholder={t('profile.phonePlaceholder')} maxLength={30} />
            </Form.Item>
            <Form.Item label={t('profile.labelAdditionalPhone')} name="additionalPhone">
              <Input placeholder={t('profile.additionalPhonePlaceholder')} maxLength={30} />
            </Form.Item>
          </div>
        </>
      )}

      {hideIdentityFields && (
        <Form.Item label={t('profile.labelAdditionalPhone')} name="additionalPhone">
          <Input placeholder={t('profile.additionalPhonePlaceholder')} maxLength={30} />
        </Form.Item>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <Form.Item label={t('profile.labelPlaceOfBirth')} name="placeOfBirth">
          <Input placeholder={t('profile.placeOfBirthPlaceholder')} maxLength={100} />
        </Form.Item>
        <Form.Item label={t('profile.labelBirthdate')} name="birthdate">
          <DatePicker
            className="w-full"
            format="DD MMM YYYY"
            placeholder={t('profile.pickDate')}
            classNames={{ popup: { root: 'app-date-popup' } }}
            suffixIcon={
              formAge != null ? (
                <span className="text-xs text-muted">{t('profile.ageSuffixForm', { n: formAge })}</span>
              ) : undefined
            }
          />
        </Form.Item>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Form.Item label={t('profile.labelGender')} name="gender">
          <Select
            allowClear
            placeholder={t('profile.pickSelect')}
            options={genderOptions}
            classNames={{ popup: { root: 'app-select-popup' } }}
          />
        </Form.Item>
        <Form.Item label={t('profile.labelMarital')} name="maritalStatus">
          <Select
            allowClear
            placeholder={t('profile.pickSelect')}
            options={maritalOptions}
            classNames={{ popup: { root: 'app-select-popup' } }}
          />
        </Form.Item>
        <Form.Item label={t('profile.labelBlood')} name="bloodType">
          <Select
            allowClear
            placeholder={t('profile.pickSelect')}
            options={BLOOD_OPTIONS}
            classNames={{ popup: { root: 'app-select-popup' } }}
          />
        </Form.Item>
        <Form.Item label={t('profile.labelReligion')} name="religion">
          <Select
            allowClear
            placeholder={t('profile.pickSelect')}
            options={RELIGION_OPTIONS}
            classNames={{ popup: { root: 'app-select-popup' } }}
          />
        </Form.Item>
      </div>
    </>
  );

  const identitySection = (
    <>
      <Title level={4} style={{ margin: 0, color: 'rgb(var(--color-text-primary))' }}>
        {t('profile.sectionIdentityAddress')}
      </Title>

      <Form.Item label={t('profile.labelNik')} name="nik">
        <Input placeholder={t('profile.nikPlaceholder')} maxLength={30} />
      </Form.Item>

      <Form.Item label={t('profile.labelIdAddress')} name="idAddress">
        <Input.TextArea rows={3} maxLength={500} showCount placeholder={t('profile.idAddressPlaceholder')} />
      </Form.Item>

      <div className="grid md:grid-cols-3 gap-3">
        <Form.Item label={t('profile.labelPostalCode')} name="postalCode">
          <Input placeholder={t('profile.postalCodePlaceholder')} maxLength={10} />
        </Form.Item>
      </div>

      <Form.Item label={t('profile.labelResidentialAddress')} name="residentialAddress">
        <Input.TextArea rows={3} maxLength={500} showCount placeholder={t('profile.residentialPlaceholder')} />
      </Form.Item>

      <div className="grid md:grid-cols-2 gap-3">
        <Form.Item label={t('profile.labelPassportNumber')} name="passportNumber">
          <Input placeholder={t('profile.passportPlaceholder')} maxLength={50} />
        </Form.Item>
        <Form.Item label={t('profile.labelPassportExpiry')} name="passportExpiry">
          <DatePicker
            className="w-full"
            format="DD MMM YYYY"
            placeholder={t('profile.pickDate')}
            classNames={{ popup: { root: 'app-date-popup' } }}
          />
        </Form.Item>
      </div>
    </>
  );

  return (
    <Form<ProfileFormValues>
      form={form}
      layout="vertical"
      onFinish={onSubmit}
      initialValues={initialValues}
      className={useCards ? 'space-y-6' : 'space-y-5'}
      preserve={false}
      id={formId}
    >
      {useCards ? (
        <>
          <GlassCard className="p-5 md:p-6 space-y-4">{dataSection}</GlassCard>
          <GlassCard className="p-5 md:p-6 space-y-4">{identitySection}</GlassCard>
        </>
      ) : (
        <>
          <div className="space-y-3">{dataSection}</div>
          <div className="space-y-3 pt-2 border-t border-white/10">{identitySection}</div>
        </>
      )}

      {!hideFooter && (
        <div className={useCards ? 'flex justify-end gap-2 sticky bottom-4' : 'flex justify-end gap-2 pt-2'}>
          <Button htmlType="button" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" htmlType="submit" loading={saving} size={useCards ? 'large' : 'middle'}>
            {buttonLabel}
          </Button>
        </div>
      )}
    </Form>
  );
}
